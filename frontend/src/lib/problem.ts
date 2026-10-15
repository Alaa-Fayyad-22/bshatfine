import { AdminApiError } from "./admin-api";
import { FALLBACK_RETRY_SECONDS } from "./rate-limit";

// What a failed action looks like to the UI. The components turn it into text
// (ProblemNotice), so the wording always comes from messages/*.json, except for
// `detail`, which is the API's own business-rule message (a 400 Problem Details).
export type Problem =
  | { kind: "detail"; text: string }
  | { kind: "api"; status: number }
  | { kind: "network" }
  | { kind: "rate"; seconds: number; nonce: number };

let nonce = 0;

export function rateProblem(seconds: number | null | undefined): Problem {
  return { kind: "rate", seconds: seconds ?? FALLBACK_RETRY_SECONDS, nonce: ++nonce };
}

export function toProblem(e: unknown): Problem {
  if (e instanceof AdminApiError) {
    if (e.status === 429) return rateProblem(e.retryAfter);
    if (e.detail) return { kind: "detail", text: e.detail };
    return { kind: "api", status: e.status };
  }
  return { kind: "network" };
}
