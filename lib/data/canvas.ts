"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  canvasConnections,
  canvasLayoutState,
} from "@/db/schema";
import type {
  CanvasEdge,
  CanvasLayoutPosition,
  CanvasPosition,
  CanvasViewport,
  ConnectionType,
} from "@/types/canvas";
import { requireOwnedRound } from "./ownership";
import { insertAuditLogEntry } from "./audit-log";

type CanvasConnectionInsert = typeof canvasConnections.$inferInsert;
type CanvasLayoutInsert = typeof canvasLayoutState.$inferInsert;

/**
 * Load all canvas edges (connections) for a round.
 * Returns edges that the user created (origin = 'manual' or accepted AI suggestions).
 */
export async function loadCanvasConnections(
  roundId: string,
  userId: string
): Promise<CanvasEdge[]> {
  await requireOwnedRound(roundId, userId);

  const rows = await db
    .select({
      id: canvasConnections.id,
      sourceNodeId: canvasConnections.fromNodeId,
      targetNodeId: canvasConnections.toNodeId,
      connectionType: canvasConnections.connectionType,
      note: canvasConnections.notes,
      createdBy: canvasConnections.createdBy,
      createdAt: canvasConnections.createdAt,
      updatedAt: canvasConnections.updatedAt,
    })
    .from(canvasConnections)
    .where(
      and(
        eq(canvasConnections.roundId, roundId),
        eq(canvasConnections.userId, userId)
      )
    )
    .orderBy(desc(canvasConnections.createdAt));

  return rows.map((row) => ({
    id: row.id,
    source_node_id: row.sourceNodeId,
    target_node_id: row.targetNodeId,
    connection_type: row.connectionType as ConnectionType,
    note: row.note,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }));
}

/**
 * Load canvas layout state (positions + viewport) for a round × user.
 */
export async function loadCanvasLayout(
  roundId: string,
  userId: string
): Promise<{
  positions: Record<string, CanvasPosition>;
  viewport: CanvasViewport;
}> {
  await requireOwnedRound(roundId, userId);

  const rows = await db
    .select()
    .from(canvasLayoutState)
    .where(
      and(
        eq(canvasLayoutState.roundId, roundId),
        eq(canvasLayoutState.userId, userId)
      )
    );

  const positions: Record<string, CanvasPosition> = {};
  let viewport: CanvasViewport = { x: 0, y: 0, zoom: 1 };

  for (const row of rows) {
    if (row.nodeType === "viewport") {
      viewport = {
        x: Number(row.panX || 0),
        y: Number(row.panY || 0),
        zoom: Number(row.zoom || 1),
      };
    } else {
      positions[row.nodeId] = {
        x: Number(row.posX || 0),
        y: Number(row.posY || 0),
      };
    }
  }

  return { positions, viewport };
}

/**
 * Create a new canvas connection (edge).
 */
export async function createCanvasConnection(
  roundId: string,
  userId: string,
  connectionData: {
    fromNodeType: string;
    fromNodeId: string;
    toNodeType: string;
    toNodeId: string;
    connectionType: ConnectionType;
    note?: string;
  }
): Promise<CanvasEdge> {
  await requireOwnedRound(roundId, userId);

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(canvasConnections).values({
    id,
      roundId,
      userId,
      fromNodeType: connectionData.fromNodeType as CanvasConnectionInsert["fromNodeType"],
      fromNodeId: connectionData.fromNodeId as CanvasConnectionInsert["fromNodeId"],
      toNodeType: connectionData.toNodeType as CanvasConnectionInsert["toNodeType"],
      toNodeId: connectionData.toNodeId as CanvasConnectionInsert["toNodeId"],
    connectionType: connectionData.connectionType,
    notes: connectionData.note || null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await insertAuditLogEntry({
    userId,
    action: "created",
    entityType: "canvas_edge",
    entityId: id,
    metadata: connectionData,
  });

  return {
    id,
    source_node_id: connectionData.fromNodeId,
    target_node_id: connectionData.toNodeId,
    connection_type: connectionData.connectionType,
    note: connectionData.note || null,
    created_by: userId,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Update a canvas connection (edge).
 */
export async function updateCanvasConnection(
  roundId: string,
  userId: string,
  edgeId: string,
  updates: {
    connectionType?: ConnectionType;
    note?: string | null;
  }
): Promise<CanvasEdge> {
  await requireOwnedRound(roundId, userId);

  const existing = await db
    .select()
    .from(canvasConnections)
    .where(
      and(
        eq(canvasConnections.id, edgeId),
        eq(canvasConnections.roundId, roundId),
        eq(canvasConnections.userId, userId)
      )
    )
    .then((rows) => rows[0]);

  if (!existing) {
    throw new Error("Canvas connection not found");
  }

  const now = new Date();
  const updateData: Partial<CanvasConnectionInsert> = { updatedAt: now };

  if (updates.connectionType) {
    updateData.connectionType = updates.connectionType;
  }
  if (updates.note !== undefined) {
    updateData.notes = updates.note;
  }

  await db
    .update(canvasConnections)
    .set(updateData)
    .where(eq(canvasConnections.id, edgeId));

  await insertAuditLogEntry({
    userId,
    action: "updated",
    entityType: "canvas_edge",
    entityId: edgeId,
    metadata: { before: existing, after: { ...existing, ...updateData } },
  });

  const updated = await db
    .select()
    .from(canvasConnections)
    .where(eq(canvasConnections.id, edgeId))
    .then((rows) => rows[0]!);

  return {
    id: updated.id,
    source_node_id: updated.fromNodeId,
    target_node_id: updated.toNodeId,
    connection_type: updated.connectionType as ConnectionType,
    note: updated.notes,
    created_by: updated.createdBy,
    created_at: updated.createdAt.toISOString(),
    updated_at: updated.updatedAt.toISOString(),
  };
}

/**
 * Delete a canvas connection (edge).
 */
export async function deleteCanvasConnection(
  roundId: string,
  userId: string,
  edgeId: string
): Promise<void> {
  await requireOwnedRound(roundId, userId);

  const existing = await db
    .select()
    .from(canvasConnections)
    .where(
      and(
        eq(canvasConnections.id, edgeId),
        eq(canvasConnections.roundId, roundId),
        eq(canvasConnections.userId, userId)
      )
    )
    .then((rows) => rows[0]);

  if (!existing) {
    throw new Error("Canvas connection not found");
  }

  await db.delete(canvasConnections).where(eq(canvasConnections.id, edgeId));

  await insertAuditLogEntry({
    userId,
    action: "deleted",
    entityType: "canvas_edge",
    entityId: edgeId,
    metadata: existing,
  });
}

/**
 * Save canvas layout state (node positions + viewport).
 */
export async function saveCanvasLayout(
  roundId: string,
  userId: string,
  layout: {
    positions: Record<string, CanvasLayoutPosition>;
    viewport: CanvasViewport;
  }
): Promise<void> {
  await requireOwnedRound(roundId, userId);

  const now = new Date();

  // Upsert node positions
  for (const [nodeId, position] of Object.entries(layout.positions)) {
    await db
      .insert(canvasLayoutState)
      .values({
        id: crypto.randomUUID(),
        roundId,
        userId,
        nodeType: position.nodeType,
        nodeId: nodeId as CanvasLayoutInsert["nodeId"],
        posX: position.x.toString(),
        posY: position.y.toString(),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          canvasLayoutState.roundId,
          canvasLayoutState.userId,
          canvasLayoutState.nodeType,
          canvasLayoutState.nodeId,
        ],
        set: {
          posX: position.x.toString(),
          posY: position.y.toString(),
          updatedAt: now,
        },
      });
  }

  // Upsert viewport
  await db
    .insert(canvasLayoutState)
    .values({
      id: crypto.randomUUID(),
      roundId,
      userId,
      nodeType: "viewport",
      nodeId: roundId as CanvasLayoutInsert["nodeId"],
      zoom: layout.viewport.zoom.toString(),
      panX: layout.viewport.x.toString(),
      panY: layout.viewport.y.toString(),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        canvasLayoutState.roundId,
        canvasLayoutState.userId,
        canvasLayoutState.nodeType,
        canvasLayoutState.nodeId,
      ],
      set: {
        zoom: layout.viewport.zoom.toString(),
        panX: layout.viewport.x.toString(),
        panY: layout.viewport.y.toString(),
        updatedAt: now,
      },
    });
}
