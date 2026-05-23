/**
 * Shared canvas visual constants.
 *
 * Single source of truth for the colour + label used to render a
 * `ConnectionType` everywhere — canvas edges, snapshot edge overlay, report
 * legends. Keep parity between live canvas and report outputs.
 */
import type { ConnectionType } from "@/types/canvas";

export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  causes: "#ef4444",
  influences: "#f97316",
  supports: "#22c55e",
  contradicts: "#dc2626",
  // Muted slate: distinct from supports/contradicts but quieter than related_to,
  // signalling "background framing, not direct evidence".
  context: "#64748b",
  related_to: "#6b7280",
};

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  causes: "Causes",
  influences: "Influences",
  supports: "Supports",
  contradicts: "Contradicts",
  context: "Context",
  related_to: "Related to",
};

/** Connection types rendered with a dashed stroke instead of solid. */
export const DASHED_CONNECTION_TYPES: ReadonlySet<ConnectionType> = new Set(["contradicts"]);
