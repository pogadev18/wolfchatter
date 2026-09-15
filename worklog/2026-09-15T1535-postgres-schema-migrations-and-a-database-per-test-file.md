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

Built `apps/api` from the M2-T1 brief: the env and Drizzle schemas, the generated migration, the connection pool and a migrated database per test file. With `allowBuilds: esbuild: false` added, `pnpm install` finished without `ERR_PNPM_IGNORED_BUILDS`. RED runs failed with `Cannot find module './env.ts'` and, for `schema.test.ts`, `Can't find meta/_journal.json file`, because no migration existed yet. `client.test.ts` passed first try, so I replaced `pool.on('error', onIdleError)` with `void onIdleError`: it failed with `expected "vi.fn()" to be called once, but got 0 times` and an unhandled `57P01`, the crash the listener prevents. `pnpm check` passed with 81 tests.

**Fix round 1:** a task review found that the millisecond-precision test could never fail: `pg` turns `timestamptz` into a JS `Date`, which only holds milliseconds. The test now reads `created_at::text`. Removing `(3)` from the generated SQL, which the template database is migrated from, made it fail with `expected '2026-09-15 10:00:00.123456+00' to be '2026-09-15 10:00:00.123+00'`. After restoring it, `git diff --exit-code -- apps/api/drizzle` printed nothing and `pnpm check` passed again.

## What went well / what didn't

Every RED and GREEN matched the brief on the first attempt, but that did not show the plan was accurate: its precision test could not fail, and the fix round rewrote it. I copied that test verbatim and watched it go RED, then GREEN, without asking what the RED proved: it had failed only because the migration was missing. The task reviewer caught it; I hadn't.

## Takeaway

When a test exists to prove a database guarantee, such as a column's stored precision, assert on what the database returns (`created_at::text`), not on a value a driver type has already rounded. A RED run only counts if it fails for the property the test names, and that holds for tests copied from a plan too.
