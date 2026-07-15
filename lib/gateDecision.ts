export type GateDecisionAction = "confirm_rejection" | "override";

/** Client helper for POST /api/runs/[runId]/gate-decision (intake + review pages). */
export async function postGateDecision(
  runId: string,
  action: GateDecisionAction,
): Promise<void> {
  const res = await fetch(`/api/runs/${runId}/gate-decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Gate decision failed (${res.status})`);
  }
}
