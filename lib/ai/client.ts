import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { isMockAi } from "@/lib/config";
import { writeAudit } from "@/lib/audit";
import { MAX_TOKENS, MODELS, PROMPT_VERSION, type AiTask } from "./models";
import { mockStructured } from "./mock";

/**
 * The ONLY module in the repo allowed to import @anthropic-ai/sdk.
 * Pipeline stages call callStructured() — never the SDK directly.
 *
 * Server/scripts only (the guard below replaces the `server-only` package so
 * tsx scripts like stub-run can drive the pipeline in-process).
 */
if (typeof window !== "undefined") {
  throw new Error("lib/ai/client.ts must never be imported into client-side code");
}

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) anthropic = new Anthropic(); // key from ANTHROPIC_API_KEY
  return anthropic;
}

export interface CallOptions<S extends z.ZodType> {
  task: AiTask;
  runId: string | null;
  system: string;
  /**
   * Shared document-text prefix reused across calls (e.g. section pages for
   * every checklist criterion). Marked with cache_control so repeat calls hit
   * the prompt cache. Haiku 4.5 minimum cacheable prefix: 4096 tokens —
   * shorter prefixes silently don't cache, which is harmless.
   */
  cachedContext?: string;
  /** The per-call instruction/question (after the cached prefix). */
  user: string;
  schema: S;
}

/**
 * Structured LLM call: guaranteed schema-shaped output via messages.parse()
 * + zodOutputFormat. Every call (mock or real) writes an audit_log row.
 */
export async function callStructured<S extends z.ZodType>(
  opts: CallOptions<S>,
): Promise<z.infer<S>> {
  const { task, runId, system, cachedContext, user, schema } = opts;
  const model = MODELS[task];

  if (isMockAi()) {
    const result = schema.parse(mockStructured(task));
    await writeAudit(`agent:${task}`, "llm_call_mock", runId, {
      model: `mock(${model})`,
      promptVersion: PROMPT_VERSION,
    });
    return result;
  }

  const content: Anthropic.TextBlockParam[] = [];
  if (cachedContext) {
    content.push({
      type: "text",
      text: cachedContext,
      cache_control: { type: "ephemeral" },
    });
  }
  content.push({ type: "text", text: user });

  const response = await getClient().messages.parse({
    model,
    max_tokens: MAX_TOKENS[task],
    system,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(schema) },
  });

  await writeAudit(`agent:${task}`, "llm_call", runId, {
    model,
    promptVersion: PROMPT_VERSION,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens,
    cacheWriteTokens: response.usage.cache_creation_input_tokens,
    stopReason: response.stop_reason,
  });

  if (response.parsed_output == null) {
    throw new Error(
      `LLM call for task "${task}" returned no parseable output (stop_reason: ${response.stop_reason})`,
    );
  }
  return response.parsed_output;
}
