import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { resetMockState } from "@/lib/ai/mock";
import { MODELS } from "@/lib/ai/models";
import { writeAudit } from "@/lib/audit";
import { GATE_CHECK_KEYS, STEP_ORDER } from "@/lib/types";

/**
 * Create a run for an application's ACFR document: the runs row plus the
 * 7 run_steps and 6 gate_checks skeleton rows. Shared by POST /api/runs and
 * scripts/stub-run.ts so both paths are identical.
 */
export async function createRunForApplication(applicationId: string): Promise<string> {
  const db = await getDb();

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.applicationId, applicationId));
  if (!doc || doc.kind !== "acfr") {
    throw new Error(`No ACFR document for application ${applicationId}`);
  }

  resetMockState();

  const [run] = await db
    .insert(schema.runs)
    .values({
      applicationId,
      documentId: doc.id,
      status: "queued",
      modelSnapshot: MODELS, // audit: which models this run used (PRD F7)
    })
    .returning();

  await db
    .insert(schema.runSteps)
    .values(STEP_ORDER.map((step) => ({ runId: run.id, step, status: "pending" as const })));
  await db
    .insert(schema.gateChecks)
    .values(
      GATE_CHECK_KEYS.map((checkKey) => ({ runId: run.id, checkKey, status: "pending" as const })),
    );

  await writeAudit("system", "run_created", run.id, { documentId: doc.id });

  return run.id;
}
