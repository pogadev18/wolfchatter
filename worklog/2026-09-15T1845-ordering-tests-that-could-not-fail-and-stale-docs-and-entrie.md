---
title: Ordering tests that could not fail, and stale docs and entries
date: 2026-09-15T18:45:35Z
agent: implementer · claude-opus-5
phase: review
outcome: issue
severity: low
commits: ['176b8e7', 'e337512']
related: ['2026-09-15T1633-rooms-endpoints-with-idempotent-creates', '2026-09-15T1702-messages-endpoints-with-cursor-pages', '2026-09-15T1535-postgres-schema-migrations-and-a-database-per-test-file', '2026-09-15T1716-auto-mode-classifier-blocks-a-brief-mandated-trustproxy-true', '2026-09-15T1734-readme-agent-guide-and-roadmap-for-the-api', '2026-09-15T1837-uppercase-room-ids-broke-retried-sends-and-real-time-deliver', '2026-09-15T1842-postgres-connects-by-localhost-stalled-in-the-name-lookup-no']
---

## What happened

The M2 whole-branch review asked for fixes before the pull request; the uppercase-id bug and the `localhost` stall have their own entries. Both FR-6 ordering tests passed with their ORDER BY term removed, in 5 of 5 runs: Postgres read messages through the `(room_id, created_at, id)` index, which already orders ties by id, and returned rooms in insertion order. Three entries misstated what happened: Task 1 called the plan accurate, Task 6 stated the classifier's internals, and Task 7 overstated the deny rules and the permission lesson. PRD §4 predated the acknowledged joins, and `CLAUDE.md` lacked the API's domain folders.

## What went well / what didn't

The messages test database now turns off index scans through a new `createTestDatabase(settings)` option, so Postgres sorts the rows itself, and the tied rows go in neither id order nor its reverse. The rooms test updates room 1, so its row is stored after the others. With the terms removed, both tests failed in 5 of 5 runs (rooms came back `[2, 3, 1]`), and so did the cursor paging test. Restoring the terms made all three pass again, with `git diff --exit-code` clean on both services. The corrected entries keep their authors' labels.

## Takeaway

An ordering test proves its ORDER BY only if the database could return the rows in another order. An index that already sorts them, or rows stored in the expected order, hides a missing term, so break the term and watch the test fail before trusting it.
