---
title: Fastify app with validation, errors, health and graceful shutdown
date: 2026-09-15T16:01:15Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T2
outcome: win
commits: []
related: []
---

## What happened

Built the HTTP skeleton from the M2-T2 brief step by step. Added `fastify` `5.12.4` and the `dev`/`start` scripts to `apps/api/package.json`, plus `dev` to the root; `pnpm install` finished `Done in 203ms using pnpm v12.4.1` with no `ERR_PNPM_IGNORED_BUILDS` and no new `minimumReleaseAgeExclude` entries. TDD cycle 1: the rewritten `env.test.ts` failed RED with `Tests  3 failed (3)` (defaults ignored, `PORT: '10000'` left as a string, and the invalid-variable message missing `PORT`); adding `HOST`, `PORT`, `LOG_LEVEL` and `RENDER_GIT_COMMIT` to `env.ts` made it `Tests  3 passed (3)`. TDD cycle 2: `http/errors.test.ts` and `health.test.ts` failed RED with `Cannot find module '../../test/app.ts'` and `'../test/app.ts'` (`Test Files  2 failed (2)`); adding `http/limits.ts`, `http/validation.ts` (the `ZodTypeProvider` + `zodValidatorCompiler` pair), `http/errors.ts`, `health.ts`, `app.ts` and `test/app.ts` made both pass, `Tests  9 passed (9)`. TDD cycle 3: `server.test.ts` failed RED with `Error: server exited early with code 1` (no `server.ts` yet); `server.ts` made it `Tests  1 passed (1)`. Deliberately deleted the `for (const signal of ['SIGINT', 'SIGTERM']...)` block to check the test actually exercises shutdown: it failed with `AssertionError: expected null to be +0 // Object.is equality`, because Node's default `SIGTERM` handling kills the process without an exit code; restoring the block from the brief passed again. Ran the real dev server with `pnpm dev`: `GET /api/health` returned `{"ok":true,"db":"up","commit":null}`, `GET /api/rooms` returned the `NOT_FOUND` error body, and `SIGINT` produced `"msg":"Shutting down"` then `"msg":"Server closed"` in the log, with `pgrep -f 'src/server.ts'` printing nothing afterward. `pnpm check` gave `Test Files  15 passed (15)`, `Tests  92 passed (92)`, no Biome or `tsc` output, and `✔ 17 work-log entries are valid` — one higher than the brief's 16, as the dispatch message said it would be for the lead's extra entry committed after Task 1.

## What went well / what didn't

Every RED matched the brief's expected message or count on the first attempt, and every GREEN count matched too, so the plan's scratch-repo verification held for this task as well; nothing needed a deviation or a fix. The only thing that took a deliberate second look was the work-log count itself: the dispatch message said it would read one higher than the brief text throughout, and `pnpm worklog:check` bore that out both before my entry (`17`, brief said `16`) and after, so I didn't mistake it for a bug in my own run.

## Takeaway

The deliberate-break step (removing the `SIGINT`/`SIGTERM` block) proved `server.test.ts` actually exercises graceful shutdown rather than just "the server starts": without the handler, Node's default `SIGTERM` action kills the process with `code: null` (a signal termination, not an explicit exit), which is exactly what the test's `expect(code).toBe(0)` step catches. Keeping `server.ts` (the real entry point, spawned as a child process only by `server.test.ts`) separate from `buildApp`/`test/app.ts` (used by every other test through `inject()`) is what makes that exit-code contract testable at all, since `inject()` never spawns a real process or delivers a real signal.
