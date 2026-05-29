# Sprint 19 Task 03 — Spatial Layout Client — STATUS / HANDOFF

Branch `codex/sprint-19-task-03`, merged to `main`. Feature is **behind flag
`canvasSpatialLayout` (default OFF)** so partial merge is safe — nothing renders
until the flag is on AND the toolbar control (below) is wired.

Enable locally: `CANVAS_SPATIAL_LAYOUT_ENABLED=true` (allowlist of user ids, `*`, or `true`).

---

## DONE (committed, typecheck green, 18 tests pass)

| Commit | What |
|---|---|
| `07f3cd5` | `canvasSpatialLayout` flag in all 4 places (`lib/feature-flags.ts`, `hooks/use-feature-flags.ts` incl. `useCanvasSpatialLayoutEnabled()`) + `d3-force`/`@types/d3-force` dep |
| `6f8f7f2` | `CanvasGraphHandle` extended: `getLayoutItems()`, `getTopLevelPositions()`, `applyPositions(positions,{animate})`, `getLayoutSavePending()` — incl. group-child offset preservation (`translateGroupChildren`) + 600ms spring + prefers-reduced-motion guard + immediate persist via `saveLayoutNowRef` |
| `dac1e0c` | `lib/canvas-spatial-layout-core.ts` (`computeSpatialLayout`, mutation-safe, NaN clamp, unknown-edge drop) + `workers/canvas-spatial-layout.worker.ts` (thin wrapper) + 5 tests |
| `dca1213` | `hooks/use-spatial-layout.ts` orchestration (state machine `idle\|fetching\|applying`, payload build, POST, undo toast 5s, PostHog events, snapshot restore on error/timeout, save-pending guard) + 13 tests. Also restored flag/dep dropped by a concurrent-agent git race. |

Hook API for the shell:
```ts
const { state, runLayout } = useSpatialLayout({ roundId, graphRef: canvasGraphRef });
// state !== "idle" => show spinner
// runLayout({ scope: "all" })  OR  runLayout({ scope: "selected", selectedItemIds })
```

---

## NOT DONE — remaining work for takeover agent

### 1. Toolbar split control in `components/canvas/canvas-shell.tsx`  (MAIN remaining piece)
Plan = split button, placed right after `{toolbarOrganiseControl}` in the `ml-auto`
toolbar div (~line 784+), styled `variant="outline" size="sm"` to match Arrange.
- Only render when `useCanvasSpatialLayoutEnabled()` is true.
- **Primary action** "Cluster whole canvas" → opens a confirmation (whole-canvas
  reflow is destructive-ish) → on confirm `runLayout({ scope: "all" })`.
- **Dropdown** (`components/ui/dropdown-menu`): "Cluster whole canvas" + "Cluster
  selected items" — the latter enabled only when ≥3 valid selected layout items;
  `runLayout({ scope: "selected", selectedItemIds })`.
- Disabled + tooltip (`components/ui/tooltip`) when: valid item count `< 3`
  ("Add at least 3 insights to use cluster layout"), `state !== "idle"`, or
  `canvasGraphRef.current?.getLayoutSavePending()`.
- Spinner (`Loader2 animate-spin`) when `state !== "idle"`, else `Sparkles`.
- Valid item count in shell:
  `nodes.filter(n => n.type === "theme" || (n.type === "insight" && n.groupId == null)).length`.
- Selected item ids = `selectedNodeIds` (state at ~line 95); dedupe handled inside the hook.

### 2. Real Web Worker wiring in `hooks/use-spatial-layout.ts`
Hook currently calls `computeSpatialLayout` **synchronously on the main thread**
(jsdom has no `Worker`). `workers/canvas-spatial-layout.worker.ts` exists but is
**unused**. See `TODO(sprint-19)` in the hook. Wire the real `Worker` for prod with
a `typeof Worker !== "undefined"` sync fallback for SSR/test, and add worker
error/timeout tests (the timeout test currently uses the sync-compute-error path as
a stand-in). Decide & document if sync is acceptable for v1 (≤200 nodes).

### 3. Shell tests
flagged visibility, split dropdown, confirmation dialog, disabled tooltip, spinner,
and no regression to existing Arrange controls.

### 4. Pre-existing test failures
Full suite has pre-existing reds (≈5 canvas-shell + ≈10 other) from missing mock
exports unrelated to this task. Confirm your shell changes don't add new ones.

### 5. Cleanup
`docs-tmp-spatial-layout-contract.md` was the temp integration contract — already
removed. This STATUS file can be deleted once task fully lands.

---

## Lesson (process)
The graph/worker/hook agents committed in the **same git worktree concurrently**,
which rebased/clobbered history and dropped a commit + dep. Run file-disjoint agents
**sequentially**, or give each its own `isolation: "worktree"`. Verify `git log` +
`git status` after each agent.
