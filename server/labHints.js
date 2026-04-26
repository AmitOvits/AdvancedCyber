/**
 * URC lab discovery — headers only (DevTools → Network → Response headers).
 * Header values MUST be ASCII only; Node rejects Unicode in outgoing headers (500).
 */
export const URC_PERF_GRID_PATH = "/api/v2/diagnostics/perf-grid";

export function attachPerfGridHintHeaders(res) {
  const fullUrlExample = `${URC_PERF_GRID_PATH}?size=300&rounds=3&include=matrix`;

  res.set("X-URC-Lab-READ-THIS", "Security class: next request to try is below.");
  res.set("X-URC-Lab-1-Full-URL-Path", URC_PERF_GRID_PATH);
  res.set("X-URC-Lab-2-Method", "GET");
  res.set("X-URC-Lab-3-Example-Query", fullUrlExample);
  res.set(
    "X-URC-Lab-4-Auth",
    "Header: Authorization: Bearer YOUR_JWT  OR append  ?access_token=YOUR_JWT  (browser lab only).",
  );
  res.set(
    "X-URC-Lab-5-Get-JWT",
    "POST /api/v2/auth/login with demo student email+password - JSON body field: token.",
  );
  res.set(
    "X-URC-Lab-6-Why",
    "Query params size, rounds, include=matrix are NOT capped - unrestricted resource consumption (API abuse).",
  );
}
