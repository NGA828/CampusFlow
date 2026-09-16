import { ApiError } from "./client";
import { identity, record, rows } from "./coordination";
import type { AdminAlert } from "./types";

const invalid = () =>
  new ApiError(
    502,
    "The alert snapshot is incomplete. Re-check before taking action.",
  );
const targets = new Set([
  "/admin/campus",
  "/admin/services",
  "/admin/academics",
  "/admin/spatial",
  "/admin/users",
  "/admin/settings",
  "/admin/analytics",
  "/admin/dashboard",
]);
export function alertSnapshot(value: unknown) {
  const r = record(value);
  const keys = new Set<string>();
  const alerts = rows(r.alerts).map((value): AdminAlert => {
    const a = record(value);
    const key = identity(a.key);
    if (
      key.length > 160 ||
      keys.has(key) ||
      !["critical", "warning", "info"].includes(String(a.severity))
    )
      throw invalid();
    keys.add(key);
    return {
      key,
      title: identity(a.title),
      detail: identity(a.detail),
      severity: a.severity as AdminAlert["severity"],
      // Only known console destinations, never arbitrary URLs or protocol-relative links.
      target:
        typeof a.target === "string" && targets.has(a.target)
          ? a.target
          : undefined,
    };
  });
  const generated_at = identity(r.generated_at);
  if (!Number.isFinite(Date.parse(generated_at))) throw invalid();
  const counts = record(r.counts);
  if (
    typeof counts.acknowledged !== "number" ||
    !Number.isSafeInteger(counts.acknowledged) ||
    counts.acknowledged < 0
  )
    throw invalid();
  return {
    alerts,
    generated_at,
    counts: {
      // Counts describe this exact loaded snapshot, not another request or stale server totals.
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      acknowledged: counts.acknowledged,
    },
  };
}
export function confirmedAcknowledgement(value: unknown, fingerprint: string) {
  const r = record(value);
  if (r.acknowledged !== fingerprint)
    throw new ApiError(
      502,
      "The server did not confirm this condition. Re-check before trying again.",
    );
  return { acknowledged: fingerprint };
}
