import { setStepDetail, type StepContext, type StepOutcome } from "./orchestrate";

/**
 * F1 table extraction on financial-statement pages.
 *
 * TODO(phase-5): POC ships without dedicated table extraction — the native
 * text layer is passed through and Haiku reads statement text directly.
 * Production path per PRD: AWS Textract Tables selectively on
 * financial-statement pages; fallback Docling / Azure Document Intelligence
 * if accuracy < ~90%. Keep this step in the chain so the run_steps timeline
 * and UI match the production pipeline shape.
 */
export async function runTables({ db, runId }: StepContext): Promise<StepOutcome> {
  await setStepDetail(db, runId, "tables", { mode: "passthrough" });
  return { finished: true };
}
