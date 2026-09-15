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

**Fix round 1:** a task review found that the millisecond-precision test above could never fail: `pg` maps `timestamptz` to a JS `Date`, which is inherently millisecond-resolution, so `room.createdAt.toISOString()` reads back `'...123Z'` regardless of whether the column actually kept the extra digits — the assertion never touched what Postgres stored. Fixed by replacing the Drizzle/`Date` round-trip with a raw `SELECT created_at::text` and asserting `'2026-09-15 10:00:00.123+00'`. Proved RED for the right reason by temporarily removing `(3)` from both `created_at` columns in the *generated* `apps/api/drizzle/0000_create_rooms_and_messages.sql` (editing `schema.ts` alone changes nothing, since each test file's database is a copy of a template migrated from that SQL) and rerunning `pnpm exec vitest run apps/api/src/db/schema.test.ts`: it failed with `AssertionError: expected '2026-09-15 10:00:00.123456+00' to be '2026-09-15 10:00:00.123+00'`, the other 4 tests in the file still green. Restored the SQL file, confirmed `git diff --exit-code -- apps/api/drizzle` printed nothing and exited 0, reran the test for `Tests 5 passed (5)`, then `pnpm check` for `Tests 81 passed (81)` and `✔ 16 work-log entries are valid`.

## What went well / what didn't

Every RED failure matched the brief's expected message exactly and every GREEN count matched on the first attempt — no deviation from the plan was needed anywhere in the 16 steps, which says the plan's scratch-repo verification was accurate. The one thing that took a second look was confirming `pnpm install` hadn't silently added new `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` (it sometimes does, per a CLAUDE.md gotcha); this run added none, so the file only carries the `allowBuilds` line I added by hand. The real miss: I copied the precision test verbatim from the brief without noticing it asserted on a JS `Date`, which cannot distinguish millisecond from microsecond storage — a task reviewer caught it, I hadn't, even though I'd watched that exact test go RED then GREEN during TDD cycle 2 without questioning what the RED had actually proved.

## Takeaway

When a test's whole point is a database-level guarantee (here, a column's stored precision), assert on the value the database actually returns — `created_at::text` — not on a value that has already passed through a driver type which discards the distinction under test. A round-trip through `pg`'s `Date` mapping made the original assertion pass unconditionally, independent of `precision: 3`, so watching RED-then-GREEN is not enough on its own: the RED failure also has to be checked against the *right* cause, including for tests copied verbatim from a plan.
