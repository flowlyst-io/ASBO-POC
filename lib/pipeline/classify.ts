import { eq } from "drizzle-orm";

import { schema } from "@/db/client";
import { callStructured } from "@/lib/ai/client";
import { writeAudit } from "@/lib/audit";
import { ClassificationResultSchema } from "@/lib/schemas";

import { setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

/**
 * F5 quality classification & triage: best / better / good / poor, grounded
 * in the gate results and findings summary.
 *
 * TODO(phase-3): ground in ASBO's historical decisions (few-shot examples +
 * pgvector retrieval of similar past cases) once the historical corpus
 * arrives — PRD blocking dependency #2.
 */
export async function runClassify({ db, runId, run }: StepContext): Promise<StepOutcome> {
  const gateChecks = await db
    .select()
    .from(schema.gateChecks)
    .where(eq(schema.gateChecks.runId, runId));
  const findings = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.runId, runId));

  const statusCounts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});
  const flagged = findings.filter((f) => f.verifierStatus === "flagged").length;

  const summary = [
    `Completeness gate: ${gateChecks.map((g) => `${g.checkKey}=${g.status}`).join(", ")}`,
    ...(run.gateOverride
      ? [
          "NOTE: the completeness gate flagged this submission and a human reviewer overrode it to proceed with review — weigh the flagged checks accordingly.",
        ]
      : []),
    `Findings by status: ${JSON.stringify(statusCounts)}`,
    `Verifier-flagged (needs human): ${flagged} of ${findings.length}`,
    "Notable findings:",
    ...findings
      .filter((f) => f.status !== "met")
      .slice(0, 15)
      .map((f) => `- [${f.status}] ${f.num} ${f.title}: ${f.comment.slice(0, 200)}`),
  ].join("\n");

  const result = await callStructured({
    task: "classify",
    runId,
    system:
      "You are triaging an ACFR application for the ASBO Certificate of Excellence review program. Classify overall submission quality as best, better, good, or poor based on the completeness gate and checklist findings summary. Routing intent: best/better get light-touch review, good gets standard review, poor goes to a senior reviewer. You are NOT deciding the award — only triaging review depth. Give a concise rationale.",
    user: summary,
    schema: ClassificationResultSchema,
  });

  await db
    .update(schema.runs)
    .set({ classification: result.classification, classificationRationale: result.rationale })
    .where(eq(schema.runs.id, runId));

  await setStepDetail(db, runId, "classify", { classification: result.classification });
  await writeAudit("agent:classify", "classification_complete", runId, {
    classification: result.classification,
  });

  return { finished: true };
}
