---
title: What the whole-branch review found after seven task reviews
date: 2026-09-16T17:04:13Z
agent: implementer · claude-opus-5
phase: review
outcome: issue
severity: medium
commits: ['e370b84', 'f232dfd', '06bb687', '859d650', 'd4efe8e', 'a04d22e', '373546e', '186df0e', '0bf87c8', '3fc18e6', '07fd55f']
related: ['2026-09-16T1522-the-deploy-rehearsed-by-hand-and-the-step-it-would-have-fail', '2026-09-16T0633-three-trust-proxy-values-before-the-request-log-gave-the-rig', '2026-09-16T0835-a-shallow-clone-made-every-work-log-entry-point-at-the-same', '2026-09-16T1217-ci-catches-migration-drift-and-main-deploys-itself']
---

## What happened

Seven M4 tasks each passed their own review. A whole-branch review (`8c3e398..1f808df`) still
returned "ready to merge with fixes". Some of its findings sat inside a single task whose review
missed them (the hung health check, Retry on a 409, the heading levels). One had been seen and
deferred: Task 6's review noted as a Minor that `pnpm dlx` could fail at the last step, after the
API was live. The rest only showed across tasks, or between the code and the record. This fix wave
took them in one pass:

- **The deploy could fail after changing production.** The build and the `pnpm dlx` Netlify
  CLI ran after the migration and the API deploy. Both now run first, the CLI with `--version` and
  no secrets, and only a push-triggered CI run deploys.
- **A hung health check outlived its deadline.** `wait-for-health.ts` checked the deadline only
  between polls. Each attempt is now bounded by the time left, capped at 60 seconds. RED: both
  hung-request tests hit vitest's 15-second timeout. Against a local server that never answers,
  with a 1.5-second timeout, the old CLI was still running when killed at 10 seconds; the new one
  exits 1 after 1.6.
- **A migration could stall live traffic on a lock.** It now has a 2-second `lock_timeout`. RED:
  a query blocked by a held lock ended only when the 5-second statement timeout cancelled it
  (`57014`), and migrations have none. Against local Postgres, a `SELECT` queued behind a waiting
  `ALTER TABLE` finished at 2004 ms, 1 ms after the `ALTER` gave up; the real `migrate.ts` against
  a held lock exits 1 after 2.4 seconds, where the old one was still waiting at 10.
- **Retry was offered where it could never work** (a 409), and the e2e test for Retry passed only
  because its 409 stub changed its answer. It now uses a 429.
- **The error boundary** now has a Playwright test that aborts the devlog chunk. With the boundary
  removed in a scratch run, the fallback never appeared and the test failed.
- **Devlog bodies nested 183 `h2`s inside `h3` card titles.** They now render as `h4`; the first
  body heading's computed style and a screenshot of its card are identical before and after.
- **The record overclaimed.** The rehearsal entry said every step ran (the migration did not), the
  TRUST_PROXY entry ruled out forging it never tested, `INFRASTRUCTURE.md` promised timeouts no
  step has, and plan step P8 would have broken the first automatic deploy. All are corrected, and
  three known gaps are documented instead of fixed: the deploy hook builds `main`'s tip, the
  statement timeout may not survive Neon's pooler, and a Cloudflare Worker could forge its
  address.

## What went well / what didn't

Watching each new test fail first caught one weak ordering: the 409 text assertion fired before the
explicit "no Retry button" assertion, so I ran a scratch variant to see the button assertion fail
on its own (`Expected: 0, Received: 1`). Two of my own slips: `pnpm dlx --cache-dir=…` failed with
`ERR_PNPM_PACKAGE_MANAGER_ADD_RESOLVE_LATEST` because pnpm 12 read the flag as a package name
(`XDG_CACHE_HOME` worked), and a comment edit left a line past 100 columns, which Biome does not
wrap, so I amended that commit before moving on. A first draft of this entry also said every
finding sat between tasks, which the list above contradicts.

Two calls went beyond the brief. A top-level `#` also becomes `h4`, not `h3`, so no body heading
sits level with its card's title; no entry uses `#` today. And the plan got inline corrections for
premises this milestone disproved beyond the three the brief listed: T4's jsdom premise and 10-second
timeout, T6's step order, and D9's and P7's claim that the migration was rehearsed.

Still unverified: the dlx cache reuse that spares the publish a second resolution was observed with
pnpm 12.4.1 on macOS (8.5 seconds cold, then 0.5 with the same flags), not on the Linux runner. The
reordered workflow first runs in the first automatic deploy.

## Takeaway

A task review checks a task against its brief. It can miss a defect inside the task, as it did three
times here, and it cannot see one that spans tasks: a step order split across a workflow and its
documentation, or a claim copied from a work-log entry into a document. A Minor deferred at task
level can matter once the whole deploy path is in view. And the record needs the same scrutiny as
the code: the rehearsal's overclaim had already been repeated in two other documents.

A timeout checked only between attempts is not a deadline: bound each attempt by the time left.
And a fake clock whose sleep settles on `setImmediate`, once every promise already due has run, lets
a test race injected timers against real promises without waiting on real time.
