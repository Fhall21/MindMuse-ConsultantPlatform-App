import { FRAME_COLORS, type FrameColor } from "@/types/canvas";

const FRAME_COLOR_SET = new Set<string>(FRAME_COLORS);

function isFrameColor(value: unknown): value is FrameColor {
  return typeof value === "string" && FRAME_COLOR_SET.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export interface FrameCreatePayload {
  name: string;
  nodeIds: string[];
  viewport: { x: number; y: number; zoom: number };
  position?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: FrameColor;
}

export interface FrameUpdatePayload {
  name?: string;
  nodeIds?: string[];
  viewport?: { x: number; y: number; zoom: number };
  position?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: FrameColor;
}

/**
 * Validate POST body for frame creation. Returns parsed payload or null + error.
 * `name`, `node_ids`, and `viewport` are required. Bounding box and color are optional
 * (defaults applied at the data layer).
 */
export function parseFrameCreateBody(body: unknown):
  | { ok: true; payload: FrameCreatePayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || !b.name.trim()) {
    return { ok: false, error: "Missing or invalid field: name" };
  }
  if (!Array.isArray(b.node_ids) || !b.node_ids.every((v) => typeof v === "string")) {
    return { ok: false, error: "Missing or invalid field: node_ids" };
  }
  const vp = b.viewport as Record<string, unknown> | undefined;
  if (
    !vp ||
    !isFiniteNumber(vp.x) ||
    !isFiniteNumber(vp.y) ||
    !isFiniteNumber(vp.zoom)
  ) {
    return { ok: false, error: "Missing or invalid field: viewport" };
  }

  const payload: FrameCreatePayload = {
    name: b.name,
    nodeIds: b.node_ids as string[],
    viewport: { x: vp.x, y: vp.y, zoom: vp.zoom },
  };
  if (typeof b.position === "number") payload.position = b.position;
  if (isFiniteNumber(b.x)) payload.x = b.x;
  if (isFiniteNumber(b.y)) payload.y = b.y;
  if (isFiniteNumber(b.width) && b.width > 0) payload.width = b.width;
  if (isFiniteNumber(b.height) && b.height > 0) payload.height = b.height;
  if (isFrameColor(b.color)) payload.color = b.color;

  return { ok: true, payload };
}

/**
 * Validate PATCH body for frame update. All fields optional. Returns updates object
 * for the data layer (camelCase keys).
 */
export function parseFrameUpdateBody(body: unknown):
  | { ok: true; updates: FrameUpdatePayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const updates: FrameUpdatePayload = {};

  if (typeof b.name === "string") updates.name = b.name;
  if (Array.isArray(b.node_ids) && b.node_ids.every((v) => typeof v === "string")) {
    updates.nodeIds = b.node_ids as string[];
  }
  const vp = b.viewport as Record<string, unknown> | undefined;
  if (vp && isFiniteNumber(vp.x) && isFiniteNumber(vp.y) && isFiniteNumber(vp.zoom)) {
    updates.viewport = { x: vp.x, y: vp.y, zoom: vp.zoom };
  }
  if (typeof b.position === "number") updates.position = b.position;
  if (isFiniteNumber(b.x)) updates.x = b.x;
  if (isFiniteNumber(b.y)) updates.y = b.y;
  if (isFiniteNumber(b.width) && b.width > 0) updates.width = b.width;
  if (isFiniteNumber(b.height) && b.height > 0) updates.height = b.height;
  if (isFrameColor(b.color)) updates.color = b.color;

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "No valid fields to update" };
  }
  return { ok: true, updates };
}
