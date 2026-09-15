---
title: Postgres schema, migrations and a database per test file
date: 2026-09-15T15:35:29Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T1
outcome: win
commits: []
related: []
---

## What happened

Built `apps/api` from the M2-T1 brief step by step. Added `allowBuilds: esbuild: false` to `pnpm-workspace.yaml` (the `apps/*` glob was already there from the M1/plan commit) and `pnpm install` finished with no `ERR_PNPM_IGNORED_BUILDS`, just the expected `@esbuild-kit` deprecation warning. TDD cycle 1: `apps/api/src/env.test.ts` failed RED with `Error: Cannot find module './env.ts'`, then `env.ts` (a zod schema requiring a `postgres://` URL) made it `Tests 2 passed (2)`. Started Postgres with `pnpm db:up` (`Container wolfchatter-postgres-1 Healthy`). TDD cycle 2: `schema.test.ts` failed RED with `Error: Can't find meta/_journal.json file` from the global setup (no migration existed yet) and `No test files found, exiting with code 1`; `schema.ts` plus `pnpm db:generate --name create_rooms_and_messages` produced `drizzle/0000_create_rooms_and_messages.sql` byte-for-byte matching the brief's SQL, and the test went `Tests 5 passed (5)`. `pnpm db:migrate` printed `.env not found. Continuing without it.` then `✔ Migrations applied`. TDD cycle 3: `client.test.ts` passed first try (`Tests 1 passed (1)`), then I deliberately replaced `pool.on('error', onIdleError)` with `void onIdleError` to prove the test bites: it failed with `AssertionError: expected "vi.fn()" to be called once, but got 0 times` plus an unhandled `error: terminating connection due to administrator command` (code `57P01`) — the crash the listener exists to prevent. Restored the line from the brief and it passed again. Replaced `biome.json`, `.github/workflows/ci.yml` and `.claude/settings.json` as specified, then `pnpm check` gave `Test Files 12 passed (12)`, `Tests 81 passed (81)` and `✔ 15 work-log entries are valid`, with no Biome or `tsc` errors.

## What went well / what didn't

Every RED failure matched the brief's expected message exactly and every GREEN count matched on the first attempt — no deviation from the plan was needed anywhere in the 16 steps, which says the plan's scratch-repo verification was accurate. The one thing that took a second look was confirming `pnpm install` hadn't silently added new `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` (it sometimes does, per a CLAUDE.md gotcha); this run added none, so the file only carries the `allowBuilds` line I added by hand.

## Takeaway

Nothing surprising enough to need its own `issue` or `learning` entry this time — worth recording precisely because the previous M1 task-1 entry did hit a `minimumReleaseAgeExclude` surprise and this one didn't, confirming that gotcha is dependency-set-dependent rather than something every `pnpm install` triggers.
