---
title: Messages endpoints with cursor pages
date: 2026-09-15T17:02:01Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T5
outcome: win
commits: []
related: []
---

## What happened

Added `GET`/`POST /api/rooms/:id/messages`: `messages/service.ts` (cursor pagination comparing
`(created_at, id)` as a tuple so tied timestamps are neither skipped nor repeated, idempotent
sends via `ON CONFLICT DO NOTHING`, a missing chatroom detected from the insert's `23503`
foreign-key violation) and `messages/routes.ts`, wired into `app.ts`. `vitest run
messages.test.ts` went from 11 failed (no routes registered, mostly `expected 404 to be 201`) to
1 failed once routes existed: the NUL-character case got `expected 500 to be 400`, because
Postgres rejected the byte itself before the contract could. Added a `hasNoNul` refinement to
`createMessageInputSchema`; both message test files then passed, 28 of 28.

## What went well / what didn't

Deliberately breaking the foreign-key error code and the tuple cursor comparison reproduced the
brief's predicted failures exactly (`expected 500 to be 404`; the paging test's
`expected [] to have a length of 1 but got +0`, from silently dropping the two rows that share the
cursor's timestamp), so both checks are proven to catch real regressions. What didn't go well:
writing the contract's NUL-rejecting escape sequence into `packages/shared/src/messages.ts` with
the Write tool did not produce the six-character escape text on disk; see the companion
`learning` entry for the detail and the fix.

## Takeaway

The service trusts the database's own constraints (the foreign key, the unique id) instead of
racy pre-checks, and the cursor comparison must be a tuple, not just `created_at`, or same-
millisecond rows go missing when paging. `pnpm check` passed clean: Biome, `tsc` across every
package, 125 of 125 tests, and 20 valid work-log entries (one more than the brief's own count
expects, per the lead's note that an extra entry landed after Task 1).
