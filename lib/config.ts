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
  // Vercel provides VERCEL_URL; locally default to the dev server.
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return process.env.INTERNAL_ORIGIN ?? "http://localhost:3000";
}
