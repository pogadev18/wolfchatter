---
title: The end-to-end suite sat two requests under the API's create limit
date: 2026-09-16T03:59:40Z
agent: implementer · claude-opus-5
phase: testing
task: M3-T5
outcome: issue
severity: low
commits: ['1fbbe00']
related: []
---

## What happened

`apps/api/src/http/limits.ts` hard-coded `{ max: 10, timeWindow: '1 minute' }` with no override. Every Playwright test shares `127.0.0.1`, the whole run finishes inside one window, and Decision 15 already counted the clicks: 8 of the 10 allowed creates. The margin was two requests, and nothing said so anywhere a test author would look — the next test that clicks the map would have turned the suite red with a `429` in some unrelated test several files later, long after the change that caused it.

`RATE_LIMIT_ROOMS_PER_MINUTE` and `RATE_LIMIT_MESSAGES_PER_MINUTE` now sit in `apps/api/src/env.ts`, defaulting to the PRD's 10 and 30 through `DEFAULT_ROOMS_PER_MINUTE`/`DEFAULT_MESSAGES_PER_MINUTE` in `limits.ts`, so a normal run and a deploy are unchanged. `playwright.config.ts` raises both to 1000 for the test API only. `buildTestApp` passes `DEFAULT_RATE_LIMITS`, so `security.test.ts` still measures the values the API ships with — its `expect(statusCodes(responses)).toEqual([...Array(10).fill(201), 429])` never moved.

RED on `env.test.ts`: `Tests 6 failed | 8 passed (14)`, the defaults `toEqual` plus the four rejected values. GREEN at `23 passed (23)` across `env.test.ts` and `security.test.ts` once the variables were threaded through `AppOptions.rateLimits` into both route plugins.

## What went well / what didn't

Wiring the limits through `buildApp` rather than reading `process.env` inside `limits.ts` kept the env boundary in one place, but it touched six files for two numbers. The cheap alternative — reading the environment at module load — would have made `limits.ts` throw in any test that imported it without a `DATABASE_URL`, so the wider change was the right one.

## Takeaway

A test suite that runs at 80% of a production limit is a trap with a delayed trigger: the failure lands in a test that did nothing wrong. Where a limit constrains the tests, make it a variable and set it in the harness, and leave the shipped default as the thing the unit tests measure.
