# Stage 6 Agent 2 — Architecture and Data Model
**Date:** 2026-03-20
**Branch:** `stage6/agent/architecture-data-model`
**Status:** Complete

## Architecture Goal

Create a graph-based evidence workspace that stays grounded in the existing consultation and theme workflow, rather than introducing a parallel system.

The graph store is a derived read model. Postgres remains the system of record.

```
Postgres (source of truth)
  → graph_outbox table (trigger-populated)
  → Redis queue (outbox relay worker reads, enqueues)
  → graph projection worker (dequeues, writes Neo4j)
  → Neo4j (derived graph read model)
  → canvas queries + report traversal
```

## Data Model

### New tables

#### `canvas_connections`

Typed directed edges between any two graph nodes. Nodes are themes, insights (people), group containers, or rounds. Edges are first-class: auditable, reviewable, and soft-deletable.

```sql
-- see: supabase/migrations/20260320100000_add_evidence_network_graph_tables.sql
canvas_connections (
  id uuid PK,
  round_id → consultation_rounds,
  user_id → auth.users,
  from_node_type text  CHECK ('theme' | 'insight' | 'person' | 'group'),
  from_node_id  uuid,
  to_node_type  text  CHECK ('theme' | 'insight' | 'person' | 'group'),
  to_node_id    uuid,
  connection_type text CHECK (
    'related_to' | 'supports' | 'contradicts' |
    'escalates'  | 'resolves'  | 'involves'
  ),
  notes text,
  confidence numeric(4,3) CHECK (0.000–1.000),  -- AI suggestions only
  origin text NOT NULL DEFAULT 'manual' CHECK ('manual' | 'ai_suggested'),
  ai_suggestion_accepted_at timestamptz,  -- NULL = pending review
  ai_suggestion_rationale   text,
  created_by uuid → auth.users,
  created_at timestamptz,
  updated_at timestamptz
)
```

Key decisions:
- `confidence` is only meaningful when `origin = 'ai_suggested'`; manual edges leave it null
- `ai_suggestion_accepted_at` being null means the suggestion has not yet been acted on; rejection = row deletion
- Directed edges are intentional; the canvas renders bidirectional display but the model is asymmetric so audit trails are unambiguous

#### `canvas_layout_state`

Per-node position for each round × user. One row per node per round per user. Viewport state (zoom, pan) stored as a special `node_type = 'viewport'` row with `node_id = round_id`.

```sql
canvas_layout_state (
  id uuid PK,
  round_id → consultation_rounds,
  user_id  → auth.users,
  node_type text CHECK ('theme' | 'insight' | 'person' | 'group' | 'viewport'),
  node_id   uuid,  -- = round_id when node_type = 'viewport'
  pos_x  numeric(10,2),
  pos_y  numeric(10,2),
  width  numeric(10,2),   -- null for point nodes
  height numeric(10,2),   -- null for point nodes
  zoom   numeric(6,4),    -- only used for viewport row
  pan_x  numeric(10,2),   -- only used for viewport row
  pan_y  numeric(10,2),   -- only used for viewport row
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE (round_id, user_id, node_type, node_id)
)
```

Layout state is never included in outbox events — it does not affect the graph projection.

#### `graph_outbox`

Append-only log of structural graph changes. Populated by triggers. Read by the outbox relay worker and forwarded to Redis. Never deleted; `processed_at` is set when the relay worker confirms enqueueing.

```sql
graph_outbox (
  id         bigserial PK,   -- ordering preserved for replay
  round_id   uuid,
  user_id    uuid,
  event_type text NOT NULL CHECK (
    'connection_added'    | 'connection_updated' | 'connection_removed' |
    'membership_added'    | 'membership_removed' |
    'group_added'         | 'group_updated'      | 'group_removed'
  ),
  source_table text NOT NULL,  -- 'canvas_connections' | 'round_theme_group_members' | 'round_theme_groups'
  source_id    uuid NOT NULL,
  payload      jsonb NOT NULL,
  processed_at timestamptz,    -- NULL = pending
  created_at   timestamptz NOT NULL DEFAULT now()
)
```

No RLS on `graph_outbox` — it is written only by internal triggers and read only by the outbox relay service (service role). Not exposed to client queries.

### Trigger strategy

One function per source table populates `graph_outbox` on INSERT, UPDATE, and DELETE:

- `trg_canvas_connections_outbox` → fires on `canvas_connections`
- `trg_round_theme_group_members_outbox` → fires on `round_theme_group_members`
- `trg_round_theme_groups_outbox` → fires on `round_theme_groups`

Each trigger writes a denormalised snapshot into `payload` sufficient for the projection worker to update Neo4j without a second Postgres read. Payload schema is defined in `lib/graph/types.ts`.

### Existing tables (unchanged)

| Table | Role in graph |
|---|---|
| `themes` | Node source: `node_type = 'theme'` |
| `people` | Node source: `node_type = 'person'` |
| `round_theme_groups` | Node source: `node_type = 'group'` |
| `round_theme_group_members` | Implicit edge: theme → group membership |
| `round_output_artifacts` | Consumes graph snapshot at generation time via `input_snapshot` |
| `audit_log` | Canvas edits append here alongside outbox row |

The canvas must not become a second source of truth for theme membership. `round_theme_group_members` remains canonical; the graph layers typed connections on top.

## Outbox Event Payload Shape

Defined in TypeScript at `lib/graph/types.ts`. Each event carries enough to write Neo4j without a round-trip to Postgres:

```ts
// connection_added / connection_updated
{
  connectionId: string,
  roundId: string,
  fromNodeType: GraphNodeType,
  fromNodeId: string,
  toNodeType: GraphNodeType,
  toNodeId: string,
  connectionType: ConnectionType,
  notes: string | null,
  confidence: number | null,
  origin: 'manual' | 'ai_suggested',
}

// connection_removed
{ connectionId: string, roundId: string }

// membership_added / membership_removed
{
  memberId: string,
  roundId: string,
  groupId: string,
  themeId: string,
  sourceConsultationId: string,
}

// group_added / group_updated / group_removed
{
  groupId: string,
  roundId: string,
  label: string,
  status: RoundThemeGroupStatus,
}
```

## Graph Snapshot Contract

When `round_output_artifacts` is generated, the `input_snapshot` jsonb must include a `graphNetwork` key so reports can consume the same graph state that was visible to the user at the time.

```ts
input_snapshot: {
  // ... existing fields ...
  graphNetwork: {
    snapshotAt: string,         // ISO timestamp
    nodes: GraphSnapshotNode[],
    edges: GraphSnapshotEdge[],
    layoutState: LayoutStateEntry[],
  }
}
```

See `lib/graph/types.ts` for full type definitions.

## Redis Queue Contract

The outbox relay worker:
1. Polls `graph_outbox WHERE processed_at IS NULL ORDER BY id ASC LIMIT 100`
2. Enqueues each event to a Redis list: `graph:events:{round_id}`
3. Sets `processed_at = now()` on each processed row
4. The graph projection worker (`workers/graph-projection`) dequeues from Redis and writes to Neo4j

If Redis is unavailable, the relay worker backs off and retries. Postgres writes are never blocked. The outbox remains the durable queue. Neo4j is always rebuildable by replaying all `graph_outbox` rows in `id` order.

## Persistence Strategy

- Canvas structural mutations go through the normal server-action flow
- Each structural change: (1) mutates Postgres, (2) appends `audit_log` row, (3) triggers `graph_outbox` row via database trigger
- Layout mutations go directly to `canvas_layout_state` with no outbox event
- TanStack Query invalidation fires on the `round_detail` query after each structural change
- Optimistic canvas edits are kept small (single edge or single node position) and reversed on server error
- AI suggestions land in `canvas_connections` with `origin = 'ai_suggested'` and `processed_at = NULL` on the audit side; they appear in the canvas as a distinct visual state (unreviewed) and do not affect evidence output until accepted

## Risks

| Risk | Mitigation |
|---|---|
| Force-directed layout becomes noisy at scale | Paginate by group; provide filter-to-subgraph as first-class interaction |
| Optimistic edits drift from server | Keep optimistic scope to single mutations; revert immediately on error |
| Typed edge proliferation | Provide filter-by-connection-type as a core canvas control |
| Redis / worker unavailable | Postgres writes never blocked; outbox row survives; worker replays on recovery |
| AI suggestions pollute audit trail | AI connections are visually distinguished, never included in evidence until explicitly accepted |
| Neo4j falls behind | Rebuildable from full outbox replay; canvas falls back to Postgres-direct query while lagging |

## Build Order

1. ✅ Define outbox event shape and graph snapshot contract (`lib/graph/types.ts`)
2. ✅ Postgres migration: `canvas_connections`, `canvas_layout_state`, `graph_outbox`, triggers, RLS
3. Next (Agent 1): Canvas workspace UI on the round detail page
4. Next: Outbox relay worker + Redis queue adapter
5. Next: Graph projection worker (Neo4j write path)
6. Next: AI suggestion service
7. Next (Agent 3): Report threading from same snapshot

## Contracts Published for Other Agents

**Agent 1 (canvas UI)** consumes:
- `canvas_connections` table via server actions
- `canvas_layout_state` table via server actions
- TypeScript types from `lib/graph/types.ts`:
  - `CanvasConnection`, `CanvasLayoutState`, `GraphNodeType`, `ConnectionType`

**Agent 3 (report threading)** consumes:
- `GraphNetworkSnapshot` type from `lib/graph/types.ts`
- `input_snapshot.graphNetwork` key in `round_output_artifacts`
