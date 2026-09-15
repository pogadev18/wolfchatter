---
title: Lead rulings for the M3 plan
date: 2026-09-15T21:39:21Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
commits: []
related: ['2026-09-15T2139-verified-the-m3-plan-in-a-scratch-repository', '2026-09-15T1904-findings-deferred-from-the-m2-whole-branch-review']
---

## What happened

The user approved the M3 plan without changes. The approval covers the nine decisions flagged for sign-off:

- FR-5's new clause, that a message the API rejects for good is removed with the reason
- rejecting unpaired surrogates
- a wake-up notice driven by the socket's first connection
- the 300 ms double-click window
- Playwright inside `pnpm check`
- chatrooms seeded with SQL in end-to-end tests
- Chromium only
- recovering the newest 50 messages after a reconnect
- builds that require `VITE_API_URL`

Two process rulings came with it. The separate agent replay of the plan was skipped (see the related verification entry). The plan's first commit is pushed to `m3-web` at the user's request, and execution waits for the user's go-ahead. Task work stays unpushed until the whole-branch review.

Models:

- **Sonnet** implements all six tasks, because every task writes a work-log entry.
- **Sonnet** reviews each task and grades its entry against the `worklog` skill's quality bar.
- **Opus** reviews the whole branch and runs the fix wave; **Sonnet** runs the scoped re-review.

## What went well / what didn't

The plan settles 19 decisions before any code is written, and turns every M3 item from the M2 review into a task step. One gap remains: no agent that knows only the plan has followed its wording, so unclear steps will surface as rulings during execution.

## Takeaway

Rulings made during execution go into a lead entry when they are made, committed between tasks.
