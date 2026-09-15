---
title: Lead rulings while executing the M2 plan
date: 2026-09-15T15:56:42Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
commits: []
related: ['2026-09-15T1529-lead-rulings-for-the-m2-plan']
---

## What happened

The lead's rulings against the committed plan text, added between tasks as they are made.

- **Task 1:** the task review showed that the plan's millisecond-precision test for `created_at` passed whether or not the column had `precision: 3`, because `pg` turns both values into a JS `Date`, which only holds milliseconds. The lead accepted the finding: PRD §3 and §4 order messages by `(created_at, id)`, and the contract's timestamps are millisecond strings. The implementer changed the test in place to read `created_at::text`, and proved it fails when the generated migration loses its `(3)`.
- **Task 6:** Claude Code's permission classifier refused the plan's temporary switch to `trustProxy: true`, so the run showing the spoofing test fail never happened. The lead accepted the task without it instead of looking for a way around the refusal: the scratch build had seen that failure (`expected 201 to be 429`), the hop-count half of the step ran, and the task reviewer traced the same outcome through Fastify's source.

## What went well / what didn't

The Task 1 defect was in the plan, although the plan had been built and replayed. The schema tests' only failing run happened before the migration existed, so this assertion was never seen failing for the property it names. The reviewer caught it by checking the claim against the live database instead of trusting the plan. The fixed assertion expects `+00`, so it relies on Postgres reporting times in UTC, which holds for the Docker and CI databases; that is left for the whole-branch review.

The lead also got something wrong. The Task 5 dispatch said the NUL escape in the shared message schema could be written safely with the Write or Edit tool, but both wrote a real NUL byte, and the lead's own scratch notes had already said to build the backslash with `chr(92)`. The check commands in the same dispatch caught it, and the implementer recorded it in a `learning` entry.

## Takeaway

A test seen failing only because its setup is missing proves nothing about its assertion. Each assertion needs a failing run that breaks the property it names. A plan step that weakens a security setting on purpose may be refused by the agent's permission classifier, so such a test needs other evidence as well.
