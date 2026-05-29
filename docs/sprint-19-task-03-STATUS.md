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

## DONE (continued — sprint-19 session 2)

| Commit | What |
|---|---|
| `ffd6cfb` | `canvas-shell.tsx` toolbar split button wired: `Network` icon, `Cluster layout` label, confirmation dialog, dropdown with rich two-line scope items, disabled/spinner states |
| `4b3eb39` | Shell tests: 12/12 pass. Fixed pre-existing `useCanvasFrames` mock gap, added `TooltipProvider` wrapper, added 7 cluster layout test cases. Fixed `DropdownMenuLabel` missing import. |

Enable locally: `CANVAS_SPATIAL_LAYOUT_ENABLED=*` in `.env.local`.

---

## NOT DONE — remaining work (optional / v2)

### 1. Real Web Worker wiring in `hooks/use-spatial-layout.ts`
Hook currently calls `computeSpatialLayout` **synchronously on the main thread**.
`workers/canvas-spatial-layout.worker.ts` exists but is unused. Sync is acceptable
for v1 (≤200 nodes). See `TODO(sprint-19)` comment in the hook.

### 2. Cleanup
This STATUS file can be deleted once task fully lands.

---

## Lesson (process)
The graph/worker/hook agents committed in the **same git worktree concurrently**,
which rebased/clobbered history and dropped a commit + dep. Run file-disjoint agents
**sequentially**, or give each its own `isolation: "worktree"`. Verify `git log` +
`git status` after each agent.
