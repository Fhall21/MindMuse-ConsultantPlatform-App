# Evidence Network Canvas — Feature Spec
**Date:** 2026-03-20
**Status:** Locked (Agent 1 output — Agent 2 and Agent 3 depend on this)
**Author:** Stage 6 Agent 1

---

## Problem Statement

The evidence trail in a consultation is currently fragmented:

- Themes are grouped in a list-style flow with no visible relationships
- Insights are treated as flat labels rather than first-class nodes
- Report output summarises groups, not a connection model
- Systematic factors (causes, influences, contradictions) are invisible in the current UI

The canvas makes the interrelated nature of themes and insights **visible, editable, and reportable** in one place.

---

## Feature Boundary

### In scope

- Persistent graph canvas per consultation
- Typed connections between themes and insights (see [Connection Types](#connection-types))
- Connection notes (freetext, max 500 chars)
- Quick filters: node type, connection type, subgroup, accepted-only, search
- Multi-select and bulk subgroup assignment
- AI connection suggestions — review-gated, not auto-applied
- Layout persistence (position + viewport) restored on page load
- Network snapshot captured at report generation
- Report section: standard and executive rendering of the same snapshot
- Audit log entry for every structural change

### Out of scope (this sprint)

- Live multi-user collaboration
- Mobile-native canvas gestures beyond responsive browser support
- Scheduling or CRM features
- Rewriting consultation intake or evidence-email generation
- A bespoke canvas renderer (use a graph library; React Flow is preferred)

---

## Route

```
/consultations/[id]/canvas
```

Accessible from the consultation detail page via a "Canvas" tab or button.
Also linked from the sidebar Consultations sub-menu.

---

## Node Types

| Type | Source table | Label field | Accepted field |
|---|---|---|---|
| `theme` | `themes` | `label` | `accepted` |
| `insight` | `themes` (where `is_user_added = true`) OR a future `insights` table | `label` | `accepted` |

> Agent 2 note: decide whether `insight` is a separate table or a flag on `themes`. The canvas type system works either way — `CanvasNodeType` in `types/canvas.ts` is the discriminant.

---

## Connection Types

```
causes       — A is a causal factor of B
influences   — A shapes or affects B without direct causation
supports     — A provides evidence for B
contradicts  — A and B are in tension
related_to   — generic / unclassified
```

Connections are directed (source → target). Both directions are meaningful.

All connection creates, edits, and deletes must write an audit log entry.

---

## Canvas Layout Persistence

Layout state is a `CanvasLayout` record (see `types/canvas.ts`):

```
consultation_id  — FK to consultation
positions        — JSONB map of node_id → {x, y}
viewport         — {x, y, zoom}
saved_at         — timestamp
```

**Save trigger:** debounced 1 s after the last drag/pan/zoom interaction, plus explicit save on connection create/edit/delete.

**Storage:** Postgres JSONB column on a `canvas_layouts` table. Neo4j holds a derived copy for traversal. On mismatch, Postgres is authoritative.

---

## AI Connection Suggestions

Suggestions are generated on explicit user request (button click — never automatic).

The AI service receives the current node list and returns a ranked list of `AiConnectionSuggestion` records (see `types/canvas.ts`).

Each suggestion:
- is shown in a "Suggestions" panel on the canvas
- requires explicit Accept or Reject from the consultant
- writes an audit log entry when reviewed
- is never auto-applied to the graph

If the consultant accepts a suggestion, it becomes a `CanvasEdge` and is written to Postgres + queued for Neo4j projection.

---

## Network Snapshot (Agent 3 contract)

When a report is generated, the canvas assembles a `NetworkSnapshot` (see `types/canvas.ts`) and attaches it to `RoundOutputArtifact.input_snapshot` under the key `"network"`.

```json
{
  "network": {
    "version": 1,
    "captured_at": "...",
    "consultation_id": "...",
    "nodes": [...],
    "edges": [...]
  }
}
```

The snapshot is **immutable after capture**. Reports always render from the snapshot, not the live graph.

Agent 3 reads this shape to render the network section. The `version` field is bumped if the shape changes — Agent 3 should gate on `snapshot.network?.version === 1`.

---

## Audit Trail

Every structural change emits an `audit_log` entry with:

| Field | Value |
|---|---|
| `entity_type` | `"canvas_edge"` or `"canvas_layout"` or `"ai_suggestion"` |
| `entity_id` | The affected record's id |
| `action` | `"created"` / `"updated"` / `"deleted"` / `"accepted"` / `"rejected"` |
| `actor_id` | `users.id` of the acting consultant |
| `metadata` | JSON snapshot of the record before change |

---

## Data Flow

```
User action on canvas
    → API route (Next.js)
    → Write to Postgres (canvas_edges / canvas_layouts / ai_suggestions)
    → Write audit_log entry
    → Postgres trigger / outbox event
    → Redis queue  [Agent 2 owns this boundary]
    → Graph projection worker
    → Neo4j read model  [Agent 2 owns this boundary]

Report generation
    → Read live graph from Postgres / Neo4j
    → Assemble NetworkSnapshot
    → Attach to RoundOutputArtifact.input_snapshot["network"]
    → Render report sections from snapshot  [Agent 3 owns this boundary]
```

---

## Canvas UI Regions

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: filters · subgroup · AI suggest · save status │
├────────────────────────────────┬────────────────────────┤
│                                │  Side panel:           │
│  Graph area                    │  - Selected node/edge  │
│  (React Flow canvas)           │    detail + edit form  │
│                                │  - AI suggestions      │
│                                │    review list         │
└────────────────────────────────┴────────────────────────┘
```

---

## Downstream Agent Contracts

| Agent | What they read from this spec |
|---|---|
| Agent 2 | Connection types, canvas_layouts schema, audit trail shape, data flow boundary |
| Agent 3 | `NetworkSnapshot` type and key path in `input_snapshot`, report section rendering |
| Agent 4 | Sprint stub — no dependency on canvas internals |

All shared types live in `types/canvas.ts`. Import from there — do not re-define.
