---
title: Findings deferred from the M3 whole-branch review
date: 2026-09-16T04:17:00Z
agent: lead · claude-opus-5
phase: review
outcome: decision
commits: []
related: ['2026-09-16T0359-two-live-regions-a-silent-list-failure-and-a-list-no-keyboar', '2026-09-16T0359-the-end-to-end-suite-sat-two-requests-under-the-api-s-create', '2026-09-16T0243-ruling-one-notice-at-a-time-in-the-chat-panel', '2026-09-15T1904-findings-deferred-from-the-m2-whole-branch-review']
---

## What happened

Opus reviewed the whole branch against the PRD, the plan and the work-log bar, and judged the plan's nineteen decisions as well as the code. Its verdict was "with fixes", with no Critical findings. One Opus fix wave closed all four Important findings and nine smaller ones, and a Sonnet re-review confirmed every one.

The lead deferred the rest.

**M4:** a React error boundary; a request timeout and `AbortSignal` in the API client, since a hung POST shows "Sending…" for ever; `loadEnv` in `vite.config.ts`, because Vite resolves `.env` files after the config and the check only reads `process.env`; the message list scrolling to the bottom even when the reader has scrolled up; `setSearchParams` dropping any other query parameter; a failed create offering no Retry, unlike a failed send; `role="status"` on the map's failure line, which needs the five unscoped status locators in `realtime.spec.ts` scoped to the panel first; the create-failure notice being shown over whatever chatroom is open by then; and the map banner reading "could not be loaded" when an earlier list is still on screen and only the refresh failed.

**Accepted as they are:** the end-to-end job repeating the Postgres service block, which Actions cannot share in one file; the tile route written twice in the fixtures; `SETTLE_MS` sitting 500 ms above TanStack's first retry; a fixed wait to prove that nothing happened; `gcTime: Infinity` on every send; a swallowed join-acknowledgement timeout, which the next reconnect repairs; the uncancelled "slow" timer, unobservable because the status never returns to connecting; and `CLAUDE.md`'s partial `apps/web` folder list.

**Decisions the review would have made differently, kept anyway:** the 300 ms single-click window, which is shorter than the browsers' own double-click threshold, and Playwright inside `pnpm check`, which makes the inner loop pay a production build. The user signed both off, and widening the window would delay every optimistic pin, so the code now carries a comment naming the trade-off instead.

## What went well / what didn't

The review found what running the code could not. Two reviewers had already found one pair of alert regions; this one found an easier way to reach it — fail a create, press Back — and a silent failure nobody had looked for: when the chatroom list request fails, the map stays empty, the panel says "Loading chatroom…" and the status line says "Connected".

The fix wave then shipped its own visual defect, a banner the panel covered, which its author found only by opening the build and looking at it.

## Takeaway

Reviews that read code catch what suites and replays cannot, because a test only fails at a case someone thought of. The M4 list above is where the next plan starts.
