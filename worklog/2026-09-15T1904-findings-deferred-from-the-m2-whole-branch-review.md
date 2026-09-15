---
title: Findings deferred from the M2 whole-branch review
date: 2026-09-15T19:04:00Z
agent: lead · claude-opus-5
phase: review
outcome: decision
commits: []
related: ['2026-09-15T1837-uppercase-room-ids-broke-retried-sends-and-real-time-deliver', '2026-09-15T1842-postgres-connects-by-localhost-stalled-in-the-name-lookup-no', '2026-09-15T1845-ordering-tests-that-could-not-fail-and-stale-docs-and-entrie', '2026-09-15T1556-lead-rulings-while-executing-the-m2-plan']
---

## What happened

Opus reviewed the whole branch against the PRD, the plan and the work-log bar, judging the plan's decisions as well as the code. Its verdict was "with fixes", with no Critical findings. One Opus fix wave addressed three Important findings (uppercase ids, ordering tests that could not fail, three misstated entries) and three doc findings (PRD §4, the Postgres stall, the `CLAUDE.md` layout line), and a Sonnet re-review confirmed all six. That re-review also flagged a `CLAUDE.md` testing bullet as undisclosed; `git log -S` showed Task 7 had added it, as planned, so nothing changed.

The lead deferred the rest:

- **M3 plan:** unpaired surrogate characters pass the message schema and `pg` stores them as U+FFFD, so a retry answers 409. That is a new contract rule. The review's client advice also goes to M3: WebSocket transport, re-join and wait for the acknowledgement before refetching, merge fetched pages by id, wrap longitudes, retry with the exact payload.
- **M4 plan:** `apps/api/.env` overrides reach the tests; rate-limit IPv6 clients by /64; cap `room:join` per socket; bound `GET /api/rooms`; add a statement timeout; decide where migrations run; set `CORS_ORIGINS` explicitly; check in CI that migrations match the schema.
- **M5 self-review:** services throw HTTP-shaped `ApiError`s, although PRD §2 says routes own HTTP.
- **Accepted:** a reused message id sent to an unknown room answers 409, not 404. The force-push deny rules miss combined short flags such as `-uf`, but `CLAUDE.md` forbids force-pushes anyway. The task reviews' cosmetic minors stay as they are.

## What went well / what didn't

The review found defects that the plan's verification cannot see. Like Task 1's precision test, the ordering tests had only been seen failing before the code existed, and the contract let ids through in any case. It also overturned the lead's diagnosis: plan decision 10 and the lead's verification entry blamed Docker Desktop's port forwarding for the 5-second stall, but in 10,500 connects per host they only happened when connecting by `localhost`, never by `127.0.0.1` (see the related issue entry).

## Takeaway

A plan has to prove each property test by breaking that property, ordering included, and give ids one canonical form at the contract boundary. The M3 and M4 plans start from the lists above.
