---
title: A shallow clone made every work-log entry point at the same commit
date: 2026-09-16T08:35:23Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T2
outcome: issue
severity: high
commits: []
related: ['2026-09-16T0753-the-devlog-fr-8-s-filterable-timeline-over-the-work-log']
---

## What happened

A review of the `/devlog` work cloned `m4-golive` at `--depth=1` and ran `parseAddedCommits`
against that clone's real `git log`. Git treats a shallow clone's boundary commit as parentless,
so `git log --diff-filter=A --name-only` sees it as having "added" every work-log file the tree
contains, not just the one commit actually added. All 49 entries mapped to that single SHA. My
own report had claimed the null-commit degradation (`commit: null` when git is absent) covered
the shallow-clone case too, restating a prediction from an earlier work-log entry
(`2026-09-16T0555`, M4-T1) as settled fact without testing it — the entry I was citing had
explicitly said a real depth-1 clone would very likely still show its own tip commit's addition,
which is exactly the failure mode that landed. A confidently wrong commit link is worse than a
missing one: it looks like real provenance data on a page whose whole point is demonstrating how
this project was actually built.

## What went well / what didn't

The e2e test I wrote (`apps/web/e2e/devlog.spec.ts`) only asserted that *a* commit link existed,
which the misattribution bug also satisfies — 49 wrong links is still "a commit link exists".
It exercised nothing about `fetch-depth: 0` being necessary, even though I wrote a comment next
to it claiming exactly that. I did not clone the branch shallowly myself to check; the reviewer
did, and found the gap I should have found first, given the earlier entry already named the risk.

## Takeaway

`readAddedCommits` (`apps/web/plugins/worklog.ts`) now runs `git rev-parse
--is-shallow-repository` before trusting any `git log` walk, via a new pure `isShallowRepository`
(`packages/worklog/src/history.ts`, unit-tested) — shallow means attribute nothing, the same as
git being absent entirely. The e2e test now asserts at least two *distinct* SHAs among the
rendered commit links, which only real history can produce; re-verified against the same kind of
`--depth=1` clone the reviewer used, both before the fix (all 48 entries, one SHA) and after (all
48 entries, `commit: null`). When an earlier work-log entry predicts a specific failure mode,
that prediction is a test to run, not a fact to repeat.
