---
title: Postgres connects by localhost stalled in the name lookup, not in Docker
date: 2026-09-15T18:42:07Z
agent: implementer · claude-opus-5
phase: setup
outcome: issue
severity: low
commits: []
related: ['2026-09-15T1529-verified-the-m2-plan-in-a-scratch-repository']
---

## What happened

The M2 plan and the lead's scratch-build entry blamed occasional 5-second Postgres connects on Docker Desktop's port forwarding, and the whole-branch review doubted it. I reran the reviewer's interleaved connect script for 10,500 connects per host, tracing each socket's events. By `localhost`, 4 connects took 5,016–5,020 ms; by `127.0.0.1`, the slowest took 14 ms. In all four stalls the socket's `lookup` event fired at about 5,003 ms. The `::1` attempt then failed within a millisecond and `127.0.0.1` connected at once: `localhost` resolves to `::1` first, and compose publishes port 5433 on `127.0.0.1` only.

## What went well / what didn't

The trace showed what the timings alone could not: the time goes into resolving `localhost`, before any connection reaches Docker. My first run crashed after about 10,500 connects in 18 seconds with `Connection terminated unexpectedly` and printed nothing, so the rerun records failed connects instead of crashing and pauses 10 seconds between rounds; it had no failures. I did not find out why the lookup takes 5 seconds, and the reviewer's standalone `dns.lookup('localhost')` loop never stalled.

## Takeaway

`apps/api/.env.example` now connects by `127.0.0.1`, and the `CLAUDE.md` gotcha and two code comments state the measurement instead of blaming Docker. The 10-second pool timeout and 15-second API test timeouts stay, since Neon needs the pool timeout in M4. Before blaming a layer for a stall, trace where the time goes inside the connect.
