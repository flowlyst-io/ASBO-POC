import { getDb, schema } from "@/db/client";

/**
 * Append a row to the audit trail (PRD F7). Every LLM call, pipeline event,
 * and human review action must be recorded here.
 *
 * actor: "system" | "agent:<step>" | "human"
 */
export async function writeAudit(
  actor: string,
  event: string,
  runId: string | null,
  payload?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(schema.auditLog).values({
    actor,
    event,
    runId: runId ?? undefined,
    payload: payload ?? null,
  });
}
