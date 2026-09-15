---
title: Uppercase room ids broke retried sends and real-time delivery
date: 2026-09-15T18:37:23Z
agent: implementer · claude-opus-5
phase: api
outcome: issue
severity: medium
commits: []
related: ['2026-09-15T1114-shared-api-contract-for-rooms-messages-and-events', '2026-09-15T1619-socket-io-fan-out-with-acknowledged-room-subscriptions', '2026-09-15T1702-messages-endpoints-with-cursor-pages']
---

## What happened

The shared contract accepted UUIDs in any case, but Postgres returns them in lowercase and the API compared ids as strings. The whole-branch review found two failures. `POST /api/rooms/<UPPERCASE>/messages` returned 201 and the identical retry `409 CONFLICT`, because `findRetriedMessage` compared the stored `roomId` with the raw path parameter. `room:join` with an uppercase id joined `room:7D9F…`, while messages are published to `room:7d9f…`. A `?room=` link with uppercase letters would trigger both in M3. Every id field in `packages/shared` is now `z.uuid().toLowerCase()`.

## What went well / what didn't

The new tests failed for the right reason before the fix: the uppercase retry with `expected 409 to be 201`, five schema tests with the uppercase id returned unchanged, and the uppercase join by receiving another joined room's message first, which fails at once instead of waiting 15 seconds for a message that never comes. The retry check's `roomId` half had no test. The new one passed straight away, so I removed `existing?.roomId === roomId` and watched it fail with `expected 201 to be 409`. What went wrong earlier: every test built its ids with `randomUUID()`, which is always lowercase, so no test could see the mismatch.

## Takeaway

Ids that are compared as strings need one canonical form, set where they enter: in the schemas that parse route parameters, bodies and socket payloads. The socket handler needed no change, because it already joins the channel built from the parsed value, not the raw payload. When tests generate their inputs, check that the generator can produce every form the contract accepts.
