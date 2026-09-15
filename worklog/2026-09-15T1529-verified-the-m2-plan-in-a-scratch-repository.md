---
title: Verified the M2 plan in a scratch repository
date: 2026-09-15T15:29:27Z
agent: lead · claude-opus-5
phase: plan
outcome: learning
commits: []
related: []
---

## What happened

Before writing the M2 plan, the lead built all seven tasks in order in a scratch clone of `main` (7609265) against Postgres 17 in Docker, and took the plan's code blocks from that build. Replaying the blocks task by task into a fresh clone reproduced every count, ending at 136 tests. A Sonnet agent then followed the plan word for word in another clone and matched all 76 expected outputs. It reported three instruction problems, all fixed before the plan was shown to the user: Task 2's `pnpm dev` check needed an interactive terminal, a Task 4 break-and-restore step gave no count to confirm the restore, and the expected `pnpm install` output was stricter than what the install prints.

## What went well / what didn't

The scratch build caught five problems that the plan now handles:

- Fastify 5.12.4 silently ignores a hop count: with `trustProxy: 1`, `request.ip` stayed the socket address, so every client behind a proxy would share one rate-limit bucket. `trustProxy: true` took the left-most `X-Forwarded-For` address, which any client can spoof.
- A message containing a NUL character returned `500`, because Postgres cannot store `0x00` in text.
- Without a pool `error` listener, ending an idle connection with `pg_terminate_backend` raised an uncaught `terminating connection due to administrator command` (57P01), which would crash the API.
- pnpm 12 stopped with `ERR_PNPM_IGNORED_BUILDS` on drizzle-kit's esbuild dependency until `allowBuilds` recorded `esbuild: false`.
- Rooms and messages tests that shared one app filled its rate-limit buckets, so tests that write build a fresh app.

What didn't go well: a race test timed out about once in 35 runs. The failing requests returned `500` after about 5,003 ms, while TCP connects to port 5433 were fast and 5,600 connections made inside the container took at most 7 ms, which points at Docker Desktop's port forwarding on macOS. A 10-second pool timeout and 15-second API test timeouts gave 0 failures in 1,200 stress rounds. The lead also made its own mistakes: one scratch commit went through with a Biome failure because piping `pnpm check` into `grep` hid the exit code, and stashing the untracked `apps/api` made pnpm prune `node_modules`.

## Takeaway

A plan checked by its author still needs a replay by an agent that has only the plan: the three steps it flagged had worked only for someone who already knew what to expect. For a flaky test, measure where the time goes before raising a timeout.
