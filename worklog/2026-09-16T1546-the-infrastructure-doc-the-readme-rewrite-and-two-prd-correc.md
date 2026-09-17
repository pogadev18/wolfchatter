---
title: The infrastructure doc, the README rewrite, and two PRD corrections
date: 2026-09-16T15:46:14Z
agent: implementer · claude-sonnet-5
phase: docs
task: M4-T7
outcome: win
commits: []
related:
  ['2026-09-16T0555-pg-treats-sslmode-require-as-verify-full-until-it-doesn-t',
  '2026-09-16T0633-three-trust-proxy-values-before-the-request-log-gave-the-rig',
  '2026-09-16T1522-the-deploy-rehearsed-by-hand-and-the-step-it-would-have-fail']
---

## What happened

Wrote `docs/INFRASTRUCTURE.md`, rewrote `README.md` for the deployed project, and made the small,
scoped corrections the brief named in the PRD, the roadmap and `CLAUDE.md`'s repository map. Read
every M4 work-log entry and the plan first, then `.github/workflows/deploy.yml` and `ci.yml`
directly for the pipeline's exact behaviour rather than the plan's original (partly struck-through)
description of it, per the brief.

Two claims needed checking against a provider's own documentation rather than this repository:

1. **Neon's pooled connection and `LISTEN`/`NOTIFY`.**
   Fetched `neon.com/docs/connect/connection-pooling` directly. It states Neon's pooler runs
   PgBouncer in transaction mode
   (`pool_mode=transaction`, connections returned to the pool after each transaction) and lists
   `LISTEN / NOTIFY` under "Not supported with pooled connections" for exactly that reason, then
   recommends a direct connection for schema migrations and `LISTEN`/`NOTIFY` alike — which also
   confirms *why* this project's migrations already use the direct string, a reason no work-log
   entry or plan document had stated outright.
2. **`TRUST_PROXY`'s Cloudflare ranges.** No file in the repository holds the literal value set on
   Render (it's dashboard-only, correctly — it's not a secret, but it's also not code). Fetched
   `cloudflare.com/ips-v4` and `/ips-v6` directly: 15 IPv4 ranges and 7 IPv6 ranges, which matches
   the count the trust-proxy work-log entry already recorded ("15 IPv4 and 7 IPv6 ranges: 24
   entries" once `loopback` and `uniquelocal` are added). That match is what let the document state
   the full value with confidence instead of a description of its shape.

Also fetched Render's and Neon's own docs for the free-tier figures (750 instance hours, 15-minute
spin-down, Render's own "about a minute" restart estimate against this project's measured 33
seconds; Neon's 5-minute autosuspend and 6-hour point-in-time-restore window on the free plan) and
confirmed `RENDER_GIT_COMMIT` and automatic `PORT` injection are both real, documented Render
behaviour rather than something this project configured.

PRD §7 corrected in place, narrowly, as instructed: the Stadia risk now states the measured
Referer behaviour instead of "needs a registered domain," and the Render cold-start estimate is
now the measured 33 seconds instead of "~1 min." Nothing else in the PRD changed.

## What went well / what didn't

Self-review caught three things worth recording because a test suite can't: the Piece table's
Stadia row pointed at "Free-tier realities" for the Referer explanation, but I'd actually written
that explanation under "Stadia Maps" in the "Environment, by provider" section — a stale
cross-reference from an earlier draft of the document's structure. The Mermaid diagram numbered
its `GitHub Actions` edges 1–4, which silently disagreed with the seven-step numbered list right
below it once the diagram collapsed several steps into one edge — removed the numbers rather than
make the diagram match seven-for-seven, since the ordering is already visible in both places.
README's own "about 30 seconds" line for the cold start didn't match the 33-second figure used
everywhere else, including three paragraphs later in the same document. All three were caught by
reading the finished documents as a reviewer would, not by writing them.

One gap in the brief's own source list: it names two specific work-log entries and "every entry
with `task: M4-T*`," but the richest account of the Netlify `--dir` defect and its immediate
predecessor are both tagged `task: M4-T6` (`2026-09-16T1518-...md`, `2026-09-16T1219-...md`),
which the grep does cover — worth noting only because it would have been easy to stop at the two
explicitly named entries and miss the fuller picture the T6 entries and the rehearsal entry
together give.

## Takeaway

The Neon and Cloudflare checks were both worth doing as an external fetch rather than trusting
description: the Neon page didn't just confirm the `LISTEN`/`NOTIFY` constraint the brief already
named, it also explained a fact nothing in this repository states — why migrations use the direct
connection string at all. Documentation that repeats a claim from a task brief without checking it
independently would have missed that connection entirely.
