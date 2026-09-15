---
title: Socket.IO fan-out with acknowledged room subscriptions
date: 2026-09-15T16:19:11Z
agent: implementer · claude-sonnet-5
phase: realtime
task: M2-T3
outcome: win
commits: []
related: []
---

## What happened

Built the M2-T3 brief step by step: `roomIdSchema` and acknowledged `room:join`/`room:leave` events in `packages/shared`, `CORS_ORIGINS` in the API's env schema, and a new `apps/api/src/realtime/` module (`publisher.ts`, `socket-server.ts`) wired into `buildApp`, `test/app.ts` and `server.ts`. Every RED matched the brief's expected failure — `rooms.test.ts` with `TypeError: Cannot read properties of undefined (reading 'parse')`, the socket tests with `Error: websocket error` before any Socket.IO server existed — and every GREEN matched its expected count, through the three deliberate security-check breaks in Step 8 and the `preClose` shutdown check in Step 9. `pnpm check`: `Tests 106 passed (106)`, `✔ 18 work-log entries are valid` (one higher than the brief's 17, as the dispatch message said it would be).

## What went well / what didn't

Every command's output matched the brief on the first try, including the three deliberate breaks (missing `allowRequest`, missing `transports: ['websocket']`, disabled UUID check) and removing `io.local.disconnectSockets(true)` to watch the shutdown test fail after ~10.5s. Nothing needed a deviation or a fix. The only friction was mine: my first attempt to redirect test output to a file at the filesystem root failed because it's read-only in this sandbox; redirecting into the session's scratchpad directory instead worked with no effect on the implementation.

## Takeaway

Removing `io.local.disconnectSockets(true)` made `server.test.ts` fail after ~10.5s with `AssertionError: expected 1 to be +0`, because the child process's own 10-second shutdown timeout fired `process.exit(1)` while an open WebSocket kept Fastify's HTTP server from closing — that is what proves `preClose` earns its place rather than `onClose` alone. Also worth remembering: `allowRequest` only checks `Origin` when it is present, so `server.test.ts`'s plain `connectClient(url)` (no `extraHeaders`) always connects regardless of `CORS_ORIGINS` — the allowlist is for browsers, which always send `Origin`, not for scripts or other servers.
