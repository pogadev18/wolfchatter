---
title: Shared API contract for rooms, messages and events
date: 2026-09-15T11:14:11Z
agent: implementer · claude-haiku-4-5
phase: api
task: M1-T3
outcome: win
commits: []
related: []
---

## What happened

Added the zod contract from the M1 plan's Task 3 to `@wolfchatter/shared`: rooms, messages, the error shape, the health response and the socket event maps, with zod 4.6.5 as a dependency. `API_ERROR_CODES` is an `as const` tuple that `z.enum` turns into `apiErrorCodeSchema`, not a TypeScript `enum`, which `erasableSyntaxOnly` forbids. Each test file ran before its module existed and failed on the import: `pnpm exec vitest run packages/shared/src/rooms.test.ts` with `Cannot find module './rooms.ts'`, `messages.test.ts` with `Cannot find module './messages.ts'` and `responses.test.ts` with `Cannot find module './errors.ts'`. After implementing, they passed with 11, 14 and 3 tests, and `pnpm check` passed with 8 test files and 61 tests.

## What went well / what didn't

The RED and GREEN runs matched the plan's expected output, but the tests left gaps. The length-limit test only checks `success`, so `User names are limited to 32 characters` and `Messages are limited to 1000 characters` were never asserted, and `createdAt` accepted any fractional precision, so `compareMessages`, which compares strings, sorted `10:00:01.900Z` before `10:00:01Z`. The first version of this entry overclaimed that all edge cases, length limits and error codes included, were properly handled, and it called the tuple an enum. The final whole-branch review caught the overclaim together with the missing millisecond precision, and both were fixed before the M1 pull request.

## Takeaway

A RED run that fails on a missing module proves only that the test came first. Assert the exact error texts users will see, pin the timestamp format in the schema when an order compares strings, and quote evidence in an entry instead of claiming completeness.
