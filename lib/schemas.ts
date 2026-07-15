import { z } from "zod";

/**
 * Zod schemas for (a) structured LLM outputs — used with
 * client.messages.parse() + zodOutputFormat in lib/ai/client.ts — and
 * (b) API request validation.
 *
 * Part of the frozen contract alongside lib/types.ts.
 */

// --- LLM output shapes --------------------------------------------------------

export const SectionSchema = z.enum([
  "introductory",
  "financial",
  "statistical",
  "compliance",
]);

/**
 * segment step: locate the ACFR section boundaries from a per-page digest.
 * Pages before financialStartPage are introductory; null means the section
 * is absent from the document.
 */
export const SegmentResultSchema = z.object({
  financialStartPage: z
    .number()
    .int()
    .min(1)
    .describe("First page of the financial section (independent auditor's report or MD&A)."),
  statisticalStartPage: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe("First page of the statistical section, or null if absent."),
  complianceStartPage: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe("First page of the compliance / single-audit section, or null if absent."),
});
export type SegmentResult = z.infer<typeof SegmentResultSchema>;

/** gate step: one completeness check judgment. */
export const GateResultSchema = z.object({
  status: z.enum(["pass", "fail", "needs_human"]),
  explanation: z
    .string()
    .describe("One or two sentences citing the evidence, or exactly what is missing."),
  page: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe("Page number of the decisive evidence, if located."),
});
export type GateResult = z.infer<typeof GateResultSchema>;

/** checklist step: one criterion finding. */
export const CriterionFindingSchema = z.object({
  status: z.enum(["met", "not_met", "partial", "na", "cannot_determine"]),
  confidence: z.enum(["high", "medium", "low"]),
  comment: z
    .string()
    .describe("Reviewer-style draft comment: professional, specific, evidence-based."),
  page: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe("Page of the passage relied on. null ONLY when status is cannot_determine."),
  pageTitle: z.string().nullable(),
  hlText: z
    .string()
    .nullable()
    .describe("The exact passage relied on, quoted verbatim from the page text."),
});
export type CriterionFinding = z.infer<typeof CriterionFindingSchema>;

/** verify step: re-check one finding's citation. */
export const VerifierVerdictSchema = z.object({
  confirmed: z.boolean(),
  reason: z
    .string()
    .nullable()
    .describe("When not confirmed: why (citation missing, passage says otherwise, judgment does not follow)."),
});
export type VerifierVerdict = z.infer<typeof VerifierVerdictSchema>;

/** classify step: whole-application quality triage. */
export const ClassificationResultSchema = z.object({
  classification: z.enum(["best", "better", "good", "poor"]),
  rationale: z.string(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/** metadata task: detect district identity from the ACFR's leading pages. */
export const DistrictMetadataSchema = z.object({
  districtName: z
    .string()
    .nullable()
    .describe("Official school district name as printed on the cover / transmittal letter"),
  state: z.string().nullable().describe("Two-letter US state code, e.g. IA"),
  fiscalYearEnd: z
    .string()
    .nullable()
    .describe("Fiscal year end date in ISO format (YYYY-MM-DD), e.g. 2023-06-30"),
});
export type DistrictMetadata = z.infer<typeof DistrictMetadataSchema>;

// --- API request validation ----------------------------------------------------

export const CreateRunRequestSchema = z.object({
  applicationId: z.string().uuid(),
});

export const ReviewActionRequestSchema = z.object({
  action: z.enum(["accept", "reject", "edit", "undo"]),
  comment: z.string().max(5000).optional(),
});

/** POST /api/runs/[runId]/gate-decision — human confirms or overrides a gate failure. */
export const GateDecisionRequestSchema = z.object({
  action: z.enum(["confirm_rejection", "override"]),
});

export const DemoRequestSchema = z.object({
  sampleId: z.enum(["rockford_il_fy2023", "davenport_ia_fy2023", "griffin_spalding_ga_fy2023"]),
});

/** POST /api/applications/[applicationId]/assign — null unassigns. */
export const AssignRequestSchema = z.object({
  reviewerId: z.string().uuid().nullable(),
});
