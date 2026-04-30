# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence. Without them, vibe coding is just yolo coding. With them, it is a superpower.

## Framework

- Vitest
- Node test environment

## Commands

```bash
bun run test
bun run test:watch
```

## Current Layers

- Unit tests: pure helpers such as env parsing, data mappers, request guards, and shared API helpers
- Integration tests: add these next around route handlers and critical server actions
- Smoke tests: use `bun run typecheck` alongside Vitest before shipping
- E2E tests: add Playwright when the user-facing flows stabilize

## Conventions

- Put tests in `tests/`
- Name files `*.test.ts`
- Prefer behavior assertions over existence checks
- Mock network and auth boundaries explicitly

## Manual Beta Checks

### Sprint 15 Task 06: Email Guidance + AI Personalisation

1. Open AI Personalisation settings and leave Evidence email guidance empty.
2. Open a meeting with a saved transcript and at least one accepted theme.
3. Generate an evidence email draft and note the subject/body shape.
4. Return to AI Personalisation settings and add a short guidance note such as `Keep the draft concise, lead with actions, and avoid repeating transcript wording.`
5. Go back to the same meeting and confirm the Evidence Email panel shows the settings link and the current guidance summary.
6. Generate a new draft and confirm the output shape changes in a meaningful way from the baseline draft.
7. Confirm the route still saves and reloads the guidance note after refresh.
8. Confirm round report generation does not yet use this new email guidance path; this remains a known gap outside Task 06 implementation scope.
