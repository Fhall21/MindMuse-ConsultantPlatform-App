# Agent 4 — Canvas UI Progress

**Branch:** `worktree-sprint-6-agent-4-alongside-sprint-stub`
**Last updated:** 2026-03-20

## 2026-03-23 Implementation Notes

- Canvas route is now restored from the round detail page via `/canvas/round/[roundId]`.
- Drag responsiveness was fixed by moving React Flow nodes into local `useNodesState` / `useEdgesState` state. Do not revert this to a server-driven `nodes={buildFlowNodes(...)}` render loop or drag lag/snap-back will return.
- Group containers now use a flat React Flow runtime model. Child insight cards are positioned absolutely in the canvas, and group motion is handled by translating child cards in app state. Do not reintroduce React Flow parent-child nesting unless the whole canvas model is being redesigned.
- Theme group containers are expected to visually encompass their children with generous spacing and room for descriptions, rather than acting as small preview cards.

---

## Completed

### Task 1 — API Routes ✓ (commit: ffca331)
- `db/schema/domain.ts` — `canvasConnections` + `canvasLayoutState` Drizzle tables
- `drizzle/0002_add_canvas_tables.sql` — migration (already applied to local DB)
- `lib/data/canvas.ts` — data functions:
  - `loadCanvasConnections(roundId, userId)`
  - `loadCanvasLayout(roundId, userId)`
  - `createCanvasConnection(roundId, consultationId, userId, data)`
  - `updateCanvasConnection(roundId, consultationId, userId, edgeId, updates)`
  - `deleteCanvasConnection(roundId, consultationId, userId, edgeId)`
  - `saveCanvasLayout(roundId, userId, layout)` — layout.positions keyed by nodeId, each entry has `{ nodeType, x, y }`
- `lib/data/audit-log.ts` — exported `insertAuditLogEntry`
- API routes:
  - `GET  /api/client/consultations/[id]/canvas`
  - `POST /api/client/consultations/[id]/canvas/edges`
  - `PATCH /api/client/consultations/[id]/canvas/edges/[edgeId]`
  - `DELETE /api/client/consultations/[id]/canvas/edges/[edgeId]`
  - `POST /api/client/consultations/[id]/canvas/layout`

---

## Remaining Tasks

### Task 2 — React Flow Graph Rendering (IN PROGRESS)
- Install complete: `@xyflow/react@12.10.1`
- **Next:**
  1. Create `hooks/use-canvas.ts` — TanStack Query wrapper for GET /canvas
  2. Create `components/canvas/canvas-graph.tsx` — React Flow provider + node/edge rendering
  3. Update `components/canvas/canvas-shell.tsx` — replace `GraphAreaPlaceholder` with `CanvasGraph`
  4. Add custom node components: `ThemeNode`, `InsightNode`
  5. Add custom edge with connection type label

### Task 3 — Node/Edge Detail Panel
- Replace `NodeDetailPanelPlaceholder` in `canvas-shell.tsx`
- `EdgeEditForm` — connection type dropdown + note textarea (max 500 chars) + delete
- Props: `selectedId: string | null`, `nodes: CanvasNode[]`, `edges: CanvasEdge[]`, callbacks

### Task 4 — AI Suggestions Panel
- Replace `AiSuggestionsPanelPlaceholder` in `canvas-shell.tsx`
- Cards: source node → target node, suggested type, rationale
- Accept / Reject buttons → POST/DELETE to AI suggestion routes (to be added)
- "Generate" button → user-initiated only

### Task 5 — Filter Integration
- Wire `CanvasFilterState` to React Flow node/edge visibility
- `acceptedOnly`, `nodeTypes`, `connectionTypes`, `searchQuery`, `subgroups`

### Task 6 — Layout Persistence
- Debounce 1s on node drag → POST /canvas/layout
- Load layout on mount (already returned in GET /canvas response)

---

## Key Contracts

### Canvas GET response shape
```ts
{
  consultation_id: string;
  round_id: string;
  nodes: CanvasNode[];    // from types/canvas.ts
  edges: CanvasEdge[];   // from types/canvas.ts
  viewport: CanvasViewport;
}
```

### Layout save body
```ts
{
  positions: Record<string, { nodeType: string; x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
}
```

### Edge create body
```ts
{
  from_node_type: "theme" | "insight";
  from_node_id: string;
  to_node_type: "theme" | "insight";
  to_node_id: string;
  connection_type: "causes" | "influences" | "supports" | "contradicts" | "related_to";
  note?: string;
}
```

---

## Important Context

- Shadcn UI preset `aKpFZLe` only — no other UI libraries
- All AI calls must be **user-initiated** (button click), never on mount
- Every edge create/update/delete writes `audit_log` entry
- `canvas-shell.tsx` is the layout owner — import graph and panels into it
- `types/canvas.ts` is the canonical type source — do not re-define
- The page route is `/canvas/[consultationId]` — fetches consultation stub (needs real query)
- Canvas is per-round: a consultation's `roundId` is the graph key

## File Locations (worktree)
```
components/canvas/canvas-shell.tsx     — shell scaffold (already exists, replace placeholders)
components/canvas/canvas-graph.tsx     — TO CREATE: React Flow integration
components/canvas/node-detail-panel.tsx — TO CREATE: edge edit form
components/canvas/ai-suggestions-panel.tsx — TO CREATE
hooks/use-canvas.ts                    — TO CREATE: TanStack Query hook
types/canvas.ts                        — exists, do not modify
```
