---
title: Three TRUST_PROXY values before the request log gave the right one
date: 2026-09-16T06:33:00Z
agent: lead · claude-opus-5
phase: deploy
outcome: issue
severity: medium
commits: []
related: ['2026-09-15T1904-findings-deferred-from-the-m2-whole-branch-review']
---

## What happened

M4's runbook says to derive `TRUST_PROXY` from a real Render request rather than guess it. It took four attempts, and three of them were wrong.

1. **`uniquelocal`**, from Render's log showing `remoteAddress: 10.216.25.229`. Those lines were Render's own health checker on a 5-second cadence, not outside traffic.
2. **`loopback`**, after labelled probes showed external requests arriving from `127.0.0.1`. True on that instance. The next deploy replaced it, and the new instance received the same traffic from `10.25.232.132`: the peer address is a property of the instance, not of Render.
3. **`loopback,uniquelocal`**, which covered both. Rate-limit headers then showed four identical requests landing in four different buckets, so `req.ip` was still unstable.
4. The request log finally named the values: `172.68.192.197`, `162.158.14.78`, `172.70.246.236` — all inside Cloudflare's published ranges. Render fronts services with Cloudflare, so the first untrusted hop from the right was a Cloudflare edge machine, and Cloudflare answers from a different one per connection.

The value is `loopback,uniquelocal` plus Cloudflare's 15 IPv4 and 7 IPv6 ranges: 24 entries. Eight requests then shared one bucket, counting 9 down to 2, four of them carrying `X-Forwarded-For: 198.51.100.7`, and all four labelled probes logged the real client address.

## What went well / what didn't

Both failure modes the M2 review predicted were live at once, and neither raised an error. With the wrong trust list, every visitor on earth shared a handful of per-edge buckets — two strangers would have throttled each other at ten chatrooms a minute — while an attacker rotating across Cloudflare edges got a multiple of the limit. Nothing in the suite can see this: `inject()` has no proxy in front of it, and the deployed behaviour depends on a CDN nobody configured.

The instruments were ranked wrong. Rate-limit headers are a side effect of `req.ip` and cannot name it, so two rounds were spent inferring identity from a counter, including one reading — "a forged header gets its own bucket, so forging works" — that was plain wrong and came from router noise. Fastify's request log serialises `remoteAddress: req.ip` (`lib/logger-pino.js`), so it prints the exact value the rate limiter keys on. That measurement was available from the first minute and answered the question immediately.

## Takeaway

When a value is wrong, measure the value, not its consequences. Three proposals came from evidence that was a different code path each time: a health checker, then one instance's peer address, then a counter.

The list needs maintaining. If Cloudflare changes its ranges the symptom is not an error but a quiet return to per-edge buckets, so `INFRASTRUCTURE.md` carries the reasoning and a link to `cloudflare.com/ips-v4`. Forging by an ordinary client adding a header was never possible at any stage, and that is what the experiments tested: a forged entry sits left of the real address and resolution stops before reaching it. Forging from inside Cloudflare's own ranges is a different case, which nothing here tested and this entry first ruled out along with the rest: a later review reasoned from Cloudflare's documentation, without testing it against the live API, that a Cloudflare Worker's request to another Cloudflare-hosted site arrives from an address this list trusts, carrying whatever `X-Forwarded-For` the Worker set, so it could pick its own bucket. That gap is documented under "Known gaps" in `docs/INFRASTRUCTURE.md`.
