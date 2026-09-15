---
title: Rooms endpoints with idempotent creates
date: 2026-09-15T16:33:15Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T4
outcome: win
commits: []
related: []
---

## What happened

Implemented M2-T4 step by step: `TestDatabase.reset()` (`TRUNCATE rooms, messages RESTART IDENTITY`), the failing `rooms.test.ts`, `CONFLICT` in `packages/shared/src/errors.ts`, then `rooms/service.ts`, `rooms/routes.ts` and the `app.ts` wiring. RED matched the brief exactly: `Tests 7 failed (7)`, four `404` vs `201`, one `404` vs `409`, one `404` vs `200`, and the push test's 15s timeout. GREEN gave `Tests 7 passed (7)`. Removing `.onConflictDoNothing({ target: rooms.id })` reproduced the brief's `3 failed | 4 passed (7)` exactly — `500` instead of `201`/`409`, one `201` plus four `500`s in the race test — restoring it returned to 7 passed. `pnpm check`: `Tests 113 passed (113)`, `✔ 19 work-log entries are valid`.

## What went well / what didn't

Every RED and GREEN matched the brief's expected output on the first try; nothing needed a fix or deviation. The only surprise was cosmetic: after deleting the `.onConflictDoNothing` line, the format-on-edit hook collapsed the remaining `.insert(rooms).values(input).returning()` chain onto one line, which the guide's "copy the code block again" advice anticipates — pasting the brief's original multi-line block back restored it exactly.

## Takeaway

The service issues two statements rather than one `INSERT ... RETURNING` because, under `READ COMMITTED`, a losing racer's own `INSERT` returns no row from `onConflictDoNothing`, but a follow-up `SELECT` still sees the winner's committed row once its lock releases — that's what makes the 5-way concurrent-create test land on a single room. Without the `onConflictDoNothing` target, a duplicate id instead throws a raw Postgres unique-violation that the generic error handler reports as `500`, not the intended `409 CONFLICT` — worth remembering when touching this insert-then-read pattern elsewhere.
