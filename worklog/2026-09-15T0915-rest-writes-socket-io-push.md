---
title: 'Real-time model: REST for writes, Socket.IO for push'
date: 2026-09-15T09:15:00Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
---

## What happened

Three approaches were compared with the user: (A) REST writes with Socket.IO broadcasts, (B) socket-first commands with acknowledgements, (C) NestJS with either model. The user chose A, with real-time from day one and Node.js as a hard requirement.

## What went well / what didn't

A keeps validation, rate limiting, error codes and logging in standard HTTP tooling (Fastify), and sending still works while a socket reconnects. The cost is two channels, and the sender receives its own message back, which clients absorb by upserting by id.

## Takeaway

The database is the source of truth, REST is the only way to change it, and sockets only fan out committed changes. Clients refetch after every reconnect, so best-effort socket delivery never leaves gaps.
