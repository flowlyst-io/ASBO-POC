import { after } from "next/server";

import { getEnv, getInternalOrigin } from "@/lib/config";

/**
 * Fire-and-forget trigger of the advance chain (pipeline-architecture skill).
 * Never awaited by callers; on Vercel wrapped in after() so the request can
 * finish while the trigger survives; locally falls back to a detached fetch.
 */
export function triggerAdvance(runId: string): void {
  const url = `${getInternalOrigin()}/api/runs/${runId}/advance`;
  const fire = async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-internal-secret": getEnv().INTERNAL_RUN_SECRET },
      });
      // A non-2xx here (e.g. a 401 HTML wall from Deployment Protection, or a
      // 500 scaffold throw) silently drops the chain link. We can't recover in
      // this fire-and-forget context, but it MUST be visible in the logs —
      // otherwise the run strands in 'running' with no trace. Auto-resume
      // (GET /api/runs/[id]) is the backstop.
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[triggerAdvance] advance chain got a non-OK response for run ${runId}: ` +
            `${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
        );
      }
    } catch {
      // A dropped chain link is recoverable: re-POSTing advance resumes
      // from persisted state. Swallow to keep fire-and-forget semantics.
    }
  };

  try {
    after(fire);
  } catch {
    void fire();
  }
}
