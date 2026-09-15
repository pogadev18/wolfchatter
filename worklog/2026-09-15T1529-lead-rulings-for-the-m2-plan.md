---
title: Lead rulings for the M2 plan
date: 2026-09-15T15:29:28Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
commits: []
related: ['2026-09-15T1241-lead-rulings-and-model-choices-while-executing-the-m1-plan']
---

## What happened

The user approved the M2 plan and asked for one fix. PRD §2's Contract row said the shared package is the source of truth for env, but the plan validates env in `apps/api/src/env.ts` (decision 1, which closes M1 ruling R5). The row now says each app validates its own env, and the fix is committed with the plan.

Before Task 1, the lead checked every pair of tasks that share a file or an interface, comparing what each task exports with what later tasks consume, and each task's tests with its own code. Nothing conflicted. One ruling came out of the check: Task 7's brief stops before the plan's wrap-up. The script that extracts a task's text runs on until the next task heading, so it would hand the implementer the push and pull-request steps, which the lead runs after the whole-branch review.

Models:

- **Sonnet** implements all seven tasks. Every task writes a work-log entry, so none of them is code-only work for Haiku.
- **Sonnet** reviews each task and grades its entry against the `worklog` skill's quality bar.
- **Opus** reviews the whole branch.

## What went well / what didn't

The plan settles twelve decisions before any code is written, where M1 needed eight rulings during execution. Two parts remain unverified: the new force-push deny rules were checked against the permission docs but never against a real force push, and the `TRUST_PROXY` value for Render needs a live request in M4.

## Takeaway

Rulings made during execution go into the work log when they are made, not only into the lead's gitignored ledger, and the next implementer is told that the entry count is higher than the plan expects.
