import type { CanvasNode } from "@/types/canvas";

export type CardDensity = "compact" | "expanded";

/** Per-card override wins; undefined follows global density. */
export function resolveCardExpanded(
  perCard: boolean | undefined,
  globalDensity: CardDensity
): boolean {
  if (perCard === true) return true;
  if (perCard === false) return false;
  return globalDensity === "expanded";
}

/** Flip resolved expand state; clear override when it matches global default. */
export function toggleExpandedOverride(
  perCard: boolean | undefined,
  globalDensity: CardDensity
): boolean | undefined {
  const resolved = resolveCardExpanded(perCard, globalDensity);
  if (resolved) {
    return globalDensity === "expanded" ? false : undefined;
  }
  return globalDensity === "compact" ? true : undefined;
}

/** Heuristic for showing the per-card expand chevron when text is likely clamped. */
export function cardHasClampableText(node: CanvasNode): boolean {
  if (node.description?.trim()) return true;
  return node.label.length > 48;
}
