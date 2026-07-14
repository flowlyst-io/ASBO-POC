import { z } from "zod";

/**
 * Typed, validated access to environment configuration.
 * Every value has a working local default — the app must boot with an empty env.
 */

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  DATABASE_URL: z.string().optional().default(""),
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),
  APP_ACCESS_CODE: z.string().optional().default("letmein"),
  INTERNAL_RUN_SECRET: z.string().optional().default("dev-secret"),
  MOCK_AI: z.string().optional().default("1"),
  DAILY_RUN_CAP: z.coerce.number().int().positive().optional().default(25),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}

export function isMockAi(): boolean {
  return getEnv().MOCK_AI !== "0";
}

/** Origin for internal self-triggering of the advance chain. */
export function getInternalOrigin(): string {
  // Prefer an explicit canonical origin: on Vercel, VERCEL_URL is the
  // deployment-specific domain that Deployment Protection guards, so self-calls
  // to it get a 401 HTML wall. Setting INTERNAL_ORIGIN to the stable production
  // URL lets the pipeline chain call itself unauthenticated-safe. Only fall back
  // to VERCEL_URL, then to the local dev server.
  const explicit = process.env.INTERNAL_ORIGIN;
  if (explicit) return explicit;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

/**
 * A non-terminal run that has shown no progress for this long is considered
 * stalled (its self-advance chain dropped). GET /api/runs/[id] re-triggers the
 * advance chain past this threshold, and the orchestrator only re-claims a
 * 'running' step once its activity is older than this. Kept comfortably above
 * one bounded unit of work (a single checklist/verify batch).
 */
export const STALL_THRESHOLD_MS = 60_000;
