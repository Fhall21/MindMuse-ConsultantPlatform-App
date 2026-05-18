/**
 * Pure (client-safe) helpers for injecting inline `[N]` citation markers into
 * report text. The bundle is loaded server-side via lib/report-references.ts
 * and serialised across the wire to the client where these helpers operate.
 */

export interface ClientCitationBundle {
  numberByInsightId: Record<string, number>;
  labelByInsightId: Record<string, string>;
}

export function injectInlineCitationMarkers(
  source: string,
  bundle: ClientCitationBundle
): string {
  const entries = Object.entries(bundle.labelByInsightId)
    .map(([insightId, label]) => ({
      label,
      number: bundle.numberByInsightId[insightId],
    }))
    .filter((e): e is { label: string; number: number } =>
      typeof e.number === "number" && e.label.trim().length > 0
    )
    .sort((a, b) => b.label.length - a.label.length);

  if (entries.length === 0) return source;

  let output = source;
  for (const { label, number } of entries) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Idempotent: skip when the label is already followed by a [N] marker.
    const pattern = new RegExp(`(${escaped})(?!\\s*\\[\\d)`, "g");
    output = output.replace(pattern, `$1 [${number}]`);
  }
  return output;
}
