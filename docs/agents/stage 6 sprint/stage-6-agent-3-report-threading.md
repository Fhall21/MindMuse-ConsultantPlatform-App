# Stage 6 Agent 3 — Report Threading
**Date:** 2026-03-20
**Branch:** `stage6/agent/report-threading`
**Status:** Complete

## Report Goal

Make the report artifact a frozen representation of the same evidence network the consultant saw on the canvas at generation time.

The report layer should stop treating accepted/supporting themes plus label matching as the final source of truth. Narrative copy still matters, but the network snapshot becomes the structural source for standard, executive, and print output.

## Current Gap

Today the report pipeline is still flattened:

- `lib/actions/round-workflow.ts` stores `accepted_round_themes` and `supporting_consultation_themes` in `round_output_artifacts.input_snapshot`
- `components/reports/report-view.tsx` reconstructs relationships in `FindingsSection` by normalizing accepted labels and matching supporting themes back to those labels
- `components/reports/report-print-layout.tsx` uses the same flattened arrays for PDF output
- `lib/actions/reports.ts` derives counts from those arrays rather than from a graph snapshot

That means the rendered report can describe the evidence set, but it cannot faithfully reproduce the network structure, connection types, layout state, or accepted AI-assisted links that were visible in the workspace.

## Snapshot Contract

Agent 2 has already published the structural contract in `lib/graph/types.ts`:

- reports consume `GraphNetworkSnapshot`
- `round_output_artifacts.input_snapshot` gains `graphNetwork`
- the saved artifact remains the source of truth when a historical report is reopened

Required persisted shape at generation time:

```ts
input_snapshot: {
  round_id: string;
  consultations: string[];
  accepted_round_themes: Array<...>;           // legacy compatibility
  supporting_consultation_themes: Array<...>;  // legacy compatibility
  graphNetwork: {
    snapshotAt: string;
    nodes: GraphSnapshotNode[];
    edges: GraphSnapshotEdge[];
    layoutState: LayoutStateEntry[];
  };
}
```

Rules:

- `snapshotAt` is pinned when the artifact is generated, not when it is viewed later
- `graphNetwork` is read from the saved artifact, never reloaded live from Neo4j for historical report viewing
- accepted AI-suggested connections may appear in `edges`; pending suggestions do not
- layout metadata persists with the artifact so the visual ordering can be reconstructed or summarized consistently
- legacy fields remain during rollout so older reports and fallback rendering still work

## Render Shape

### Standard report

The standard report should show the network as a first-class section before or alongside the narrative findings:

- a network overview block with total nodes, typed edges, and snapshot timestamp
- a relationship ledger grouped by connection type
- subgroup visibility using saved group nodes and layout metadata
- supporting narrative sections derived from the same saved artifact
- source consultation and audit sections unchanged

This should feel like a readable report representation of the canvas, not a raw canvas embed.

### Executive report

The executive variant stays on the same snapshot, but condenses presentation:

- top nodes and most important typed relationships only
- compact summary of strongest clusters or central evidence threads
- same provenance basis as the standard report
- no separate executive-only data model

The executive report is a filtered view of the same frozen network, not a regenerated interpretation.

### Print / PDF output

PDF output must remain text-safe and reliable:

- printable network summary instead of an interactive canvas
- node + relationship tables, or sentence-form relationship rows such as `Theme A -> supports -> Theme B`
- notes and provenance carried through where available
- deterministic ordering so re-exported PDFs stay stable for the same artifact version

## Implementation Threading

### 1. Artifact generation

`lib/actions/round-workflow.ts`

- continue sending the flattened arrays used by the current AI report prompt
- additionally attach `graphNetwork` to `inputSnapshot` when the round output artifact is created
- treat the graph snapshot as the immutable structural record for that artifact version

### 2. Artifact loading

`lib/actions/reports.ts`

- parse `input_snapshot` against the Stage 6 graph-aware shape
- expose `graphNetwork` on the report detail model
- derive network counts from `graphNetwork` when present
- keep legacy count fallbacks for pre-Stage-6 artifacts that only have flattened arrays

### 3. Browser rendering

`components/reports/report-view.tsx`

- replace label-matched relationship display as the primary representation
- render a dedicated network section from `graphNetwork`
- retain the narrative body and the existing consultation/audit sections
- use flattened theme sections only as a fallback when `graphNetwork` is absent

### 4. Print rendering

`components/reports/report-print-layout.tsx`

- render a print-safe network section from `graphNetwork`
- keep the standard/executive distinction at the presentation layer only
- preserve a deterministic fallback for artifacts created before the snapshot upgrade

## Provenance And Audit Rules

Typed connections are auditable only if the report snapshot can point back to evidence provenance.

Minimum expectations:

- node metadata should preserve the originating theme/group/person context needed for report labels
- relationship rows should keep `connectionType`, `connectionId`, `origin`, and optional notes
- accepted AI suggestions must remain identifiable as accepted AI-origin edges
- report viewing must not mutate the saved artifact or recalculate structure from current workspace state

If the workspace changes after a report is generated, the existing report remains unchanged. A new report version is required to capture the new network.

## Persistence And Versioning

Each `round_output_artifact` stores the graph snapshot that existed at generation time.

- reopening a report reads the saved `input_snapshot.graphNetwork`
- workspace changes after generation do not mutate prior artifacts
- a new report version is required to capture a newer network state

## Compatibility Strategy

Stage 6 should not break already-generated artifacts while the snapshot contract rolls out.

- If `graphNetwork` exists, it is the primary structural source
- If `graphNetwork` is missing, the report continues using the current flattened fields
- version history remains intact across both old and new artifacts
- export paths must work for both artifact shapes during rollout

## Risks

| Risk | Mitigation |
|---|---|
| Report view still depends on label matching | Make `graphNetwork` the primary relationship source and relegate flattened arrays to compatibility only |
| Historical report mutates when canvas changes | Always read the saved `input_snapshot.graphNetwork`, never the live graph |
| Executive view drifts from standard view | Both variants consume the same saved snapshot and only differ in presentation density |
| PDF becomes unreadable without interactivity | Use a text-safe relationship ledger and deterministic ordering |
| AI suggestions leak into reports before review | Exclude pending AI-suggested edges from the saved snapshot; include only accepted ones |

## Build Order

1. Agent 2 publishes `GraphNetworkSnapshot` and `input_snapshot.graphNetwork` contract
2. Agent 1 wires canvas generation so report creation has access to the saved network snapshot
3. Report generation stores `graphNetwork` on `round_output_artifacts`
4. Report loading and renderers switch to graph-first consumption with legacy fallback
5. PDF/export path adopts the same snapshot and fallback logic
6. QA verifies reopen, version immutability, executive condensation, and print fallback

## Contracts Published For Other Agents

**Agent 1 (canvas / round workflow)** should provide:

- the exact `GraphNetworkSnapshot` saved at report-generation time
- layout state for nodes and viewport
- only accepted structural edges in the snapshot

**Agent 2 (architecture / data model)** already provides:

- `GraphNetworkSnapshot`
- `GraphSnapshotNode`
- `GraphSnapshotEdge`
- `LayoutStateEntry`
- `input_snapshot.graphNetwork` as the persistence boundary

**Report consumers** will assume:

- `graphNetwork` may be absent on legacy artifacts
- node and edge arrays are already filtered to the artifact snapshot boundary
- layout ordering is stable enough to derive deterministic report summaries

## Verification

1. Generate a standard report, reopen it, and confirm the same node/edge/layout snapshot is shown.
2. Generate a report, then change the workspace graph and confirm the older report does not change.
3. Open the executive variant and verify it points to the same underlying nodes and edges as the standard report.
4. Export PDF and confirm the network section is present in text-safe form without requiring browser interactivity.
5. Open an older artifact without `graphNetwork` and confirm legacy fallback rendering still works.
