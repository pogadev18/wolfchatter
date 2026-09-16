---
title: CI catches migration drift, and main deploys itself
date: 2026-09-16T12:17:30Z
agent: implementer · claude-sonnet-5
phase: deploy
task: M4-T6
outcome: win
commits: ['405388b', 'cca54ec']
related: ['2026-09-16T1219-pnpm-dlx-netlify-cli-27-7-0-needs-two-fixes-before-it-will-e']
---

## What happened

Implemented the last M4 code task: `apps/api/src/deploy/wait-for-health.ts` (a testable core plus
a thin CLI entry), a migration-drift check in `ci.yml`'s `checks` job, and a new `deploy.yml` that
runs after CI succeeds on `main`.

`wait-for-health.ts` polls a health endpoint until its `commit` field matches an expected SHA or a
timeout expires. Wrote all six rows of the behaviour table as tests first, against a `waitForHealth`
that only did `throw new Error('not implemented')` — every test failed for a reason that actually
named the missing behaviour: five failed because the promise rejected instead of resolving, and the
sixth (which itself expects a rejection) failed on the message-content assertion instead, since
"not implemented" names neither SHA the row requires. Implemented the real loop next — `fetch`,
`now` and `sleep` are all injected, and the test double advances a counter instead of waiting — and
all seven tests (six rows plus a spec-lock-in on the two defaults) went green with no real time
passing (524ms total, `pnpm exec vitest run apps/api/src/deploy/wait-for-health.test.ts`).
Smoke-tested the CLI for real too, against a throwaway local HTTP server: it polled through two
stale-commit responses before resolving, and separately timed out after 700ms with a message naming
both SHAs when the server never caught up — the same behaviour the unit tests already proved, now
proven end to end with a real `fetch`, a real `setTimeout`, and a real process exit code.

For the drift check: `pnpm db:generate` runs with no database (`drizzle.config.ts` sets no
`dbCredentials`). Made the brief's required throwaway edit to `schema.ts`, ran it, and drizzle-kit
generated a brand-new migration file — untracked, which turned out to matter (see below). `git add
-N apps/api/drizzle` before the `git diff --exit-code` fixes that: it stages new files with no
content, which is enough for the diff to treat them as additions and print their full text —
including the pending `ALTER TABLE` itself — before failing.

`deploy.yml` runs on `workflow_run` (after CI, on `main`) or `workflow_dispatch`, guarded so a
failed or cancelled CI run can never trigger it. It resolves `head_sha` over `github.sha` (the
latter is the branch tip at the moment the job starts, not the commit CI actually ran on), echoes
the resolved SHA first, checks out that commit with full history, migrates the database, fires the
Render deploy hook, waits for `wait-for-health.ts` to confirm the new commit is actually live,
builds the web app against `API_ORIGIN`, and publishes `dist` to Netlify from `apps/web`.

`pnpm check` passes in full: lint, typecheck across every package, 327 unit tests, 48 Playwright
end-to-end specs, 57 work-log entries.

## What went well / what didn't

**A check that passed my first real test, for the wrong reason.** My first instinct for the drift
check itself was `pnpm db:generate && git diff --exit-code -- apps/api/drizzle`, no `git add -N`.
Running it against the throwaway schema edit still caught the drift — exit code 1, diff printed —
which could easily have looked like confirmation the check was right. It wasn't: `drizzle-kit`
happened to also touch `meta/_journal.json`, an already-tracked file, on this particular change, and
that modification is what `git diff` actually saw. The new migration `.sql` and the new
`meta/*_snapshot.json` — the files that matter — are untracked, and `git diff` ignores untracked
files regardless of `--exit-code`; it would have reported "no drift" for a schema change that
somehow left the journal untouched, if such a change exists. Comparing `git status --porcelain`
(which does see untracked files) against the plain `git diff` on the same throwaway edit is what
surfaced the gap. `git add -N` closes it without giving up `git diff`'s ability to print full
content on failure, which a `git status`-only check wouldn't have.

Full TDD discipline held for `wait-for-health.ts` — every row watched RED for a distinct, correct
reason before any row went GREEN — and the CLI smoke test against a real server was worth doing
separately from the mocked unit tests: it is the only thing that exercised the real `fetch` and
`setTimeout` wiring the injected-dependency tests deliberately bypass.

The Netlify publish step took real investigation rather than transcription; that finding is its own
entry (related, above) since it stands on its own regardless of this task.

## Takeaway

A check is only as trustworthy as the thing it was actually watched failing against, and "it failed"
is not the same claim as "it failed for the reason I think." `git diff --exit-code` looked right and
even passed a real throwaway-edit test — coincidentally, because of an implementation detail of
`drizzle-kit` I hadn't verified held in general. `git add -N` makes the check correct by
construction instead of by luck, and the only way to tell the difference between those two was to
compare against a check built the other way and ask what each one actually saw.
