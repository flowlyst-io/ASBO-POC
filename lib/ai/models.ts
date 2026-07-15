/**
 * ★ THE ONLY FILE IN THE REPO WHERE MODEL IDS MAY APPEAR. ★
 *
 * User decision (2026-07-14): the app's runtime uses claude-haiku-4-5 for
 * EVERY task — the cheapest option. Do NOT add Opus/Sonnet entries here or
 * hardcode a model string anywhere else without an explicit user decision.
 * Upgrading a task later is a one-line change in this map.
 */

export const MODELS = {
  segment: "claude-haiku-4-5",
  gate: "claude-haiku-4-5",
  checklist: "claude-haiku-4-5",
  verifier: "claude-haiku-4-5",
  classify: "claude-haiku-4-5",
  metadata: "claude-haiku-4-5",
} as const;

export type AiTask = keyof typeof MODELS;

export const MAX_TOKENS: Record<AiTask, number> = {
  segment: 2048,
  gate: 1024,
  checklist: 2048,
  verifier: 1024,
  classify: 1024,
  metadata: 512,
};

/** Bumped whenever a system prompt materially changes — recorded in audit_log. */
export const PROMPT_VERSION = "poc-0.1";
