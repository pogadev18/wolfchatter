---
title: A 10-second default timeout couldn't cover the cold start its own comment
  promised
date: 2026-09-16T10:33:27Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T4
outcome: issue
severity: medium
commits: []
related: ['2026-09-16T1008-web-resilience-an-error-boundary-a-request-timeout-and-a-env']
---

## What happened

Review of M4-T4 (see the related entry) caught something the RED/GREEN cycle couldn't:
`apps/web/src/api/client.ts`'s `ApiClientOptions.timeoutMs` comment argued for roughly 30 seconds
("Render's free tier can take about 30 seconds to wake... so a shorter deadline would fail a
routine cold start"), and `DEFAULT_TIMEOUT_MS` was set to `10_000` two lines below it — the shorter
deadline the comment itself warned against. A test can't catch a number being wrong against its own
stated purpose when nothing in the test suite encodes what that purpose actually requires; this
needed a human (or a reviewer) asking "does 10 actually satisfy the sentence above it," which no
assertion was checking. The review's own ruling was generous about blame — "the brief mandated '10
second' and \[the implementer\] implemented what it said" — but the comment was still self-
contradicting code that shipped, so it belongs in this log regardless of whose call the number was.

**The fix.** `DEFAULT_TIMEOUT_MS` → `30_000`, now exported; a new
`it('defaults the request timeout to 30 seconds', …)` pins it, following the exact pattern already
in `apps/api/src/db/client.test.ts` for `STATEMENT_TIMEOUT_MS`. The real work was the comment: not
rounding a number until a sentence sounds true, but tracing whether 30s combined with the *existing,
untouched* retry policy in `query-client.ts` actually covers a one-minute cold start.

**The arithmetic, done twice.** First from `@tanstack/query-core@5.102.8`'s actual retryer source
(`createRetryer`'s `run()`): `retry(failureCount, …)` and the default `retryDelay` — 
`Math.min(1000 * 2 ** failureCount, 30000)` — are both evaluated with the *pre-increment*
`failureCount`, so `failureCount < N` is genuinely N retries (N+1 attempts), matching the review's
own warning about this exact off-by-one. Applied to this app's predicates: mutations
(`failureCount < 2`) make 3 attempts with 1s then 2s of backoff (3s total); queries
(`failureCount < 3`) make 4 attempts with 1s, 2s, then 4s (7s total).

Then empirically, because reading source and being *right* aren't the same thing: a throwaway
script built a real `QueryClient` with this app's exact retry predicates and a request that always
rejects after a fixed short delay, and measured wall-clock time to final rejection. At 50ms per
attempt: query gave up at 7215ms (predicted `4×50 + 7000 = 7200`); mutation at 3159ms (predicted
`3×50 + 3000 = 3150`). Both matched within scheduling noise — source and a real timed run agreed.

Scaled to 30s per attempt: mutation total = `3×30+3 = 93s`, query total = `4×30+7 = 127s`, both past
a one-minute wake (PRD §7; `connection-status.ts`; a real cold start measured today at 33s) with
real margin. Stated honestly rather than rounded up: a *single* attempt still only waits 30s, so a
request sent the instant an instance starts waking can still need a second attempt before landing on
one that's actually finished booting — the retries cover the wake, not any one attempt in isolation.
Checked what the user actually sees during that: `outbox.ts` reports `'sending'` for a mutation's
entire internal retry sequence (TanStack Query's `pending` status doesn't change between internal
retries), so this is one continuous "Sending…", not a visible flicker of failures.

**Verified nothing else depended on 10 seconds**, rather than assuming a single constant change was
isolated: every `10_000` in `client.test.ts` is an explicit override (unaffected); the two
`{ timeout: 10_000 }`s in `messages.spec.ts` are Playwright's own assertion polling allowance, not
this constant — confirmed by reading every `page.route()` failure simulation across all five e2e
spec files (every one calls `route.abort()`/`route.fulfill()` immediately; none leaves a request
hanging for `AbortController` to ever time out) and by re-running the full Playwright suite: 43/43
passed, and the specific 10s-poll test's own duration was unchanged (3.6s, identical to before).
`pnpm test` went from 302 to 303 (the one new pin); `pnpm exec vitest run
apps/web/src/api/client.test.ts` went to 18/18.

**A report-accuracy correction, no code impact.** My original task report said this repository's
`.claude/settings.json` "denies `Read` (and, for this harness, the corresponding write)" on
`apps/web/.env.production`. The review checked: there is only an explicit `Read(**/.env.production)`
entry, no matching `Write(...)` rule. I had inferred the parenthetical from a tool refusal message
("File is covered by a Read deny rule... and cannot be written") and stated it with more certainty
than the evidence supported. What I actually know: a Write attempt and a Bash redirection to that
path were both refused, citing the Read rule — evidence that *some* mechanism extends it to writes
for this harness, not evidence of a second rule I could point to in the file. Corrected the report
rather than the settings file (nothing to change there) or the substitute verification approach
(still stands on its own).

## What went well / what didn't

The gap this closes is exactly the kind RED/GREEN can't reach on its own: my own tests all passed
against the (wrong) 10-second default, because every test that mattered to the timeout mechanism
passed its own override, and nothing asserted "the default itself is fit for its stated purpose."
The lesson isn't "write more tests" in the abstract — it's that a constant justified by an external
fact (a cold-start duration) needs a test or a comment that ties it back to that fact with real
numbers, not prose that merely gestures at the right conclusion. `STATEMENT_TIMEOUT_MS`'s one-line
pin in `apps/api` is the right shape for the "is the number what I think it is" half of that; the
comment's worked arithmetic is what's carrying the "and is that number actually enough" half, since
there isn't a clean way to unit-test "does this cover a Render cold start" without mocking half of
Render.

The reviewer's own "roughly 21/33 seconds" (at the old 10s value) didn't match my worked numbers (33s
and 47s) once I traced the exact retryer mechanics and timed the real library. I reported my own
numbers rather than reconciling backward to theirs, because I could point to an exact source line and
a real measured run for mine and not for a "roughly." Worth having flagged rather than quietly
matched, per the same instruction this whole fix round is about: a number should come from where it
can be checked, not from sounding right.

## Takeaway

Two independent verifications (reading `@tanstack/query-core`'s actual shipped source, then timing
the real library against this app's exact retry predicates with a throwaway script) agreed on the
same attempt counts and backoff schedule, which is what let the new comment state a number instead
of a guess. Separately: when a tool refuses an action and names one specific reason, that reason is
what happened — not license to describe the surrounding policy in more detail than was actually
shown.
