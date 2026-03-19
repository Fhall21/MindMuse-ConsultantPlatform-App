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
