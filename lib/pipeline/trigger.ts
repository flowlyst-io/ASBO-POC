import { after } from "next/server";

import { getEnv, getInternalOrigin } from "@/lib/config";

/**
 * Fire-and-forget trigger of the advance chain (pipeline-architecture skill).
 * Never awaited by callers; on Vercel wrapped in after() so the request can
 * finish while the trigger survives; locally falls back to a detached fetch.
 */
export function triggerAdvance(runId: string): void {
  const url = `${getInternalOrigin()}/api/runs/${runId}/advance`;
  const fire = () =>
    fetch(url, {
      method: "POST",
      headers: { "x-internal-secret": getEnv().INTERNAL_RUN_SECRET },
    }).catch(() => {
      // A dropped chain link is recoverable: re-POSTing advance resumes
      // from persisted state. Swallow to keep fire-and-forget semantics.
    });

  try {
    after(fire);
  } catch {
    void fire();
  }
}
