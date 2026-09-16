---
title: Six hardening findings for the live API, one already solved by the library
date: 2026-09-16T09:14:15Z
agent: implementer · claude-sonnet-5
phase: api
task: M4-T3
outcome: win
commits:
  ['14cfff2', '96c843d', '6582b04', '800ecbc', '30bfac3', '936d065']
related:
  ['2026-09-16T0555-pg-treats-sslmode-require-as-verify-full-until-it-doesn-t',
  '2026-09-16T0633-three-trust-proxy-values-before-the-request-log-gave-the-rig']
---

## What happened

Six findings from the M2 review plus one from this morning's deploy, all inside `apps/api`.

1. **IPv6 rate-limit buckets** — turned out to need no production code. `@fastify/rate-limit`
   11.2.0's default `keyGenerator` already calls `normalizeIP(request.ip, ipv6Subnet)` with
   `ipv6Subnet` defaulting to 64, and already maps `::ffff:a.b.c.d` down to plain IPv4 — read
   straight out of the installed package's `index.js` and confirmed against its own
   `test/ip-normalization.test.js`. `security.test.ts` got three new tests (two addresses in one
   /64 share a bucket, a different /64 gets its own, an IPv4-mapped address shares the plain-IPv4
   bucket) and all three passed *before* `security.ts` changed at all. `ipv6Subnet: 64` is now
   pinned explicitly at the rate-limit registration, with a comment, so a future library default
   change can't silently widen or narrow every bucket with nothing failing.
2. **`room:join` cap** — `socket-server.ts` now caps chatroom membership at 10 per socket.
   `subscription()` (shared by join and leave) now lets `apply` return its own ack instead of
   always defaulting to `{ ok: true }`, so the join handler can answer `RATE_LIMITED` once
   `[...socket.rooms].filter(r => r.startsWith('room:')).length` reaches the cap. `room:leave`
   is unchanged. Four new tests in `socket-server.test.ts` (join to the cap, refused over it,
   freed by a leave, a second socket has its own allowance) — RED on only the "refused over it"
   case, exactly as expected, since the other three pass whether or not a cap exists.
3. **Bounded `GET /api/rooms`** — added `MAX_ROOMS_LISTED = 1000` to `http/limits.ts`.
   `createRoomsService` now takes `limit` as a constructor argument and queries
   `orderBy(desc(rooms.number)).limit(limit)` then reverses, the same shape
   `createMessagesService` already used for cursor pagination. `AppOptions` grew a
   `roomsListLimit` field threaded from `server.ts` (the real limit) and `test/app.ts` (same
   default, overridable). Two new tests in `rooms.test.ts`: a limit of 2 against 3 rooms keeps
   numbers 2 and 3, ascending; a limit of 5 against 3 rooms is unchanged. This changes what a
   client sees past 1000 chatrooms — the README's API table still says "every chatroom" and gets
   corrected in a later task.
4. **Statement timeout** — `db/client.ts` sets `statement_timeout` (a real `pg` pool option) to a
   new `STATEMENT_TIMEOUT_MS = 5_000`, with `connectDatabase` taking it as an optional third
   argument so a test isn't stuck waiting out 5 real seconds. Tests: a `SELECT pg_sleep(1)` under
   a 200 ms override rejects, a normal query under the same short override is unaffected, and the
   production constant is pinned at 5000 by a one-line test. RED: before the change, the sleeping
   query resolved normally instead of rejecting — the bug this closes, reproduced first.
5. **`.env` never reaching the tests** — `test/postgres.ts`'s `testServerUrl()` used to load
   `../.env` then `../.env.example`. Extracted `loadEnvExample(dir)`, which only ever reads
   `<dir>/.env.example`; `.env` is gone from the resolution entirely. Unit-tested against a
   throwaway `mkdtemp` directory (never `apps/api/`) holding both files with different values.
   See the precedence finding below.
6. **Verified TLS for a deployed database** — `env.ts` gained `isLoopbackHost` (127.0.0.0/8,
   `::1`, literal `localhost`) and a `.refine()` on `DATABASE_URL` requiring
   `sslmode=verify-full` for anything else, naming the fix in the error message. Five new tests
   in `env.test.ts`: IPv4 loopback and `::1` and `localhost` all pass with no `sslmode`; a hosted
   host with none is rejected; the same host with `sslmode=verify-full` passes.

`pnpm check` passes end to end: lint, full typecheck, all 291 Vitest tests across every project,
all 43 Playwright specs, `worklog:check`.

## What went well / what didn't

Requirement 1 is the one honest non-RED item: there was nothing to make fail, so the three new
tests are regression pins on a dependency behaviour, not proof of a fix. Saying that plainly here
because the brief specifically asked not to claim a RED phase that never happened.

Requirement 4 had a small surprise the source-reading in requirement 1 didn't prepare me for:
`db.execute()` on a `NodePgDatabase` doesn't reject with the raw `pg` `DatabaseError` — it wraps
it in a `DrizzleQueryError` and puts the original on `.cause`. My first assertion,
`.rejects.toMatchObject({ code: '57014' })`, failed with the code sitting one level down; the
existing reconnect test in the same file checks a *different* path (the error `pool.on('error')`
receives, which is genuinely unwrapped), so reading it first didn't warn me. Fixed by asserting
`.rejects.toMatchObject({ cause: { code: '57014' } })`. Small, but exactly the kind of thing that
only shows up by running the test rather than by reasoning about drizzle's source.

Requirement 5's precedence question took the most actual investigation. The comment on
`testServerUrl()` claimed "DATABASE_URL from the environment (CI), else from apps/api/.env, else
apps/api/.env.example, the same order `pnpm dev` uses" — and the loop's array was
`['../.env', '../.env.example']`. I did not trust either claim and measured `process.loadEnvFile`
directly (Node 24.13.1, via small throwaway scripts, never touching the repo's own `.env`):
calling it twice with the same key, or calling it after the key is already in `process.env`,
**the first setter always wins** — a second `loadEnvFile` call, or a pre-existing env var, is
never overwritten. `apps/api/package.json`'s `dev`/`db:migrate` scripts, by contrast, use Node's
CLI flags — `--env-file=.env.example --env-file-if-exists=.env` — and I measured those too: for
repeated `--env-file` flags, **the last one wins**, the opposite rule. Real environment variables
still beat both files under the CLI flags, matching the programmatic API. So: the comment's literal
claim, "the same order `pnpm dev` uses," is false — the loop's array is textually the *reverse* of
`pnpm dev`'s flag order — and that claim is what was wrong. The code's actual precedence
(env, then `.env`, then `.env.example`) was correct on its own terms, only by virtue of the loop
happening to list `.env` first under first-wins semantics while `pnpm dev` lists it last under
last-wins semantics. Since the fix removes `.env` from the test path entirely, the discrepancy is
moot for the new code, but it is a real trap: editing that array by "matching pnpm dev's order"
without knowing which API you're calling would have silently flipped the precedence.

## Takeaway

Two claims in this task explicitly asked to be checked against the installed code instead of
taken on faith, and both were worth the minute it took. `@fastify/rate-limit`'s default checked
out exactly as the brief described, which is why requirement 1 shipped as tests only. The old
`testServerUrl()` comment did not check out: my own first instinct, before measuring anything,
was also that a later `loadEnvFile` call would win — the common behaviour for config loaders, and
the actual behaviour of the CLI `--env-file` flags three lines away in the same package's
`package.json`. It's the opposite for the programmatic API. A codebase that uses both loading
styles for the same file, with opposite override rules, is exactly the situation where "the same
order X uses" is worth measuring rather than assuming.
