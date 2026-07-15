import type { AiTask } from "./models";

/**
 * MOCK_AI=1 mode: deterministic canned LLM outputs per task, shaped to match
 * the zod schemas in lib/schemas.ts (client.ts validates them with the real
 * schema before returning). Lets the entire pipeline + UI run end-to-end with
 * no API key. Keep outputs plausible — they drive the demo UI.
 */

let checklistCallCounter = 0;
let verifierCallCounter = 0;

/** Reset between runs so mock output is deterministic per run. */
export function resetMockState(): void {
  checklistCallCounter = 0;
  verifierCallCounter = 0;
}

const MOCK_FINDING_ROTATION = [
  {
    status: "met",
    confidence: "high",
    comment:
      "The requirement is satisfied. The relevant disclosure is present, clearly labeled, and consistent with the basic financial statements. (Mock finding — enable a real API key to generate genuine analysis.)",
    page: 3,
    pageTitle: "Letter of Transmittal",
    hlText:
      "The letter of transmittal, signed by the Superintendent and the Chief Financial Officer, is included in the introductory section of this report.",
  },
  {
    status: "partial",
    confidence: "medium",
    comment:
      "The disclosure is present but incomplete: one required element could not be located near the primary discussion. Recommend the district expand the note in future filings. (Mock finding.)",
    page: 58,
    pageTitle: "Notes to the Financial Statements",
    hlText:
      "The discount rate used to measure the total pension liability was 7.00 percent.",
  },
  {
    status: "not_met",
    confidence: "high",
    comment:
      "The required presentation was not found. The section presents fewer periods of trend data than the program requires. (Mock finding.)",
    page: 141,
    pageTitle: "Statistical Section",
    hlText: "Schedule of Changes in Net Position — Last Nine Fiscal Years",
  },
  {
    status: "cannot_determine",
    confidence: "low",
    comment:
      "The extracted text for the relevant pages is degraded, so compliance could not be judged with confidence. Human review required. (Mock finding.)",
    page: null,
    pageTitle: null,
    hlText: null,
  },
] as const;

export function mockStructured(task: AiTask): unknown {
  switch (task) {
    case "segment":
      return {
        financialStartPage: 15,
        statisticalStartPage: 130,
        complianceStartPage: null,
      };
    case "gate":
      return {
        status: "pass",
        explanation:
          "The independent auditor's report expresses an unmodified opinion on the basic financial statements. (Mock gate result.)",
        page: 11,
      };
    case "checklist": {
      const f = MOCK_FINDING_ROTATION[checklistCallCounter % MOCK_FINDING_ROTATION.length];
      checklistCallCounter += 1;
      return { ...f };
    }
    case "verifier": {
      // Flag every 7th finding to exercise the needs-human path in the UI.
      verifierCallCounter += 1;
      return verifierCallCounter % 7 === 0
        ? {
            confirmed: false,
            reason:
              "Cited passage could not be located on the referenced page; the page text differs from the quoted excerpt. (Mock verifier.)",
          }
        : { confirmed: true, reason: null };
    }
    case "classify":
      return {
        classification: "better",
        rationale:
          "Completeness gate passed on all six checks and most checklist criteria are met with high confidence; minor disclosure gaps keep this below 'best'. (Mock classification.)",
      };
    case "metadata":
      return {
        districtName: "Mockville Community School District",
        state: "IA",
        fiscalYearEnd: "2023-06-30",
      };
  }
}
