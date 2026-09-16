---
title: pg treats sslmode=require as verify-full, until it doesn't
date: 2026-09-16T05:55:11Z
agent: lead · claude-opus-5
phase: deploy
outcome: learning
commits: []
related: []
---

## What happened

M4's provider runbook puts the first real use of the Neon connection string on the user's own laptop, before Render exists: run `pnpm db:migrate` against Neon and see what `pg` makes of a hosted database. It printed `✔ Migrations applied`, and a warning:

> SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'. In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

Neon hands out connection strings ending in `?sslmode=require`. Today `pg` reads that as `verify-full` and checks the certificate chain, which is why the migration connected at all. After pg v9, the same string will mean libpq's `require`: encrypt the connection, verify nothing — accept any certificate, including an attacker's.

## What went well / what didn't

The step was in the plan to catch a specific predicted failure: `pg` and Neon disagreeing about TLS, surfacing as `self-signed certificate in certificate chain` or `The server does not support SSL connections`. That failure did not happen — Neon's certificate verifies against the system trust store, so the strict interpretation succeeds.

What the step found instead was the opposite shape of problem: not something broken now, but something that breaks silently later. A dependency bump would downgrade production to unverified TLS with no error, no warning and no test failing. The predicted bug would have announced itself; this one would not have.

## Takeaway

Every deployed `DATABASE_URL` says `sslmode=verify-full` explicitly — the Neon direct string used for migrations, the pooled string the API reads on Render, and the GitHub secret the deploy workflow uses. It is identical behaviour today, it survives pg v9, and it stops a security warning from printing on every migration and every cold start, where it would be one line of noise among the lines that matter. The local Postgres is untouched: it is plain TCP on 127.0.0.1 with no `sslmode` at all.

Running the real command against the real provider from a laptop cost about a minute and produced a finding no scratch repository could have: the warning only exists because a hosted database was on the other end.
