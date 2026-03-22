# Stage 8 Renaming Progress — 2026-03-22

## Confirmed Completed

- Restored consultation canvas routes.
- Restored consultation creation and meeting linking flows.
- Repaired the migration chain so published history is preserved and the semantic rename is a forward-only `0006` migration.
- Restored report snapshot compatibility for both legacy and stage-8 field names.
- Polished the remaining user-visible report, audit, consultation-assignment, and generated-output wording so stage-8 screens say `consultation` and `meeting` where the model now requires it.

## Commits Landed In This Worktree

- `d74c222` `fix: restore consultation canvas routes`
- `6a3ff48` `fix: restore consultation creation flows`
- `7931bcd` `fix: preserve forward migration history`
- `2a9a2ae` `fix: preserve report snapshot compatibility`

## Current Terminology Assessment

### Safe compatibility and legacy internals to keep for now

- Legacy snapshot aliases such as `round_id`, `accepted_round_themes`, and `supporting_consultation_themes` in report compatibility code.
- Internal action names and payload keys still emitted as `round.*` or `consultation.round_assigned` where changing them would require coordinated audit and migration work.
- Legacy AI sidecar endpoints under `/rounds/...` until the service contract is renamed end-to-end.

### Product-facing wording already polished in this branch

- Report UI copy now uses `consultation summary`, `consultation themes`, `meeting themes`, and `consultation outputs`.
- Consultation assignment UI on the meeting detail page now says `link consultation` / `change consultation`.
- Generated fallback output copy now describes linked meetings, consultation summaries, and supporting meeting themes.

### Deeper rename work that is real but broader than copy polish

- Component and prop names such as `RoundSummaryCard`, `roundLabel`, `RoundsPanel`, and `ThemeRoundPanel` are still legacy-shaped internally.
- Query keys and audit hook aliases still expose `round` naming even when the user-visible destination should be `consultation`.
- Broader domain-layer renames still need an intentional pass rather than incidental churn.

## Next Intended Slice

- Keep internal compatibility fields stable unless the rename is isolated and low-risk.
- Re-run browser verification from the stage-8 worktree and confirm the cleaned terminology appears on the live flows.
- Revisit the old `db:generate` failure only if the branch still needs schema generation beyond the forward-migration repair already committed.

## Browser Verification Notes

- Confirmed port `3002` is serving the stage-8 worktree.
- Confirmed the Better Auth email sign-in endpoint succeeds for `felix@maildrop.cc` with the restored QA password.
- Confirmed authenticated access to `/dashboard` with no console errors beyond preload warnings.
- Confirmed `/consultations/new` renders with the corrected stage-8 copy.
- Confirmed consultation creation works in-browser when the form is submitted after hydration with `requestSubmit()`, and the resulting consultation workspace shows:
	- `linked meetings`
	- `no meetings are linked to this consultation yet`
	- `consultation outputs`
- The gstack browse harness is unreliable for some client-side navigations in this app:
	- direct login button flow stayed on `/login` even though the auth endpoint returned `200`
	- direct navigation to `/consultations` and `/meetings/new` sometimes timed out or landed on `about:blank`
	- treat those as harness issues first, not confirmed app regressions
- Focused Vitest verification remains the reliable source for meeting creation until browser navigation is rechecked with a steadier harness path.