---
title: Work-log package validates entries
date: 2026-09-15T10:57:57Z
agent: implementer · claude-sonnet-5
phase: setup
task: M1-T2
outcome: win
commits: []
related: []
---

## What happened

Built `@wolfchatter/worklog` following the plan's steps in order: `pnpm install` for the new package, then four TDD cycles — `pnpm exec vitest run packages/worklog/src/<file>.test.ts` for `schema` (RED: `Cannot find module './schema.ts'`, GREEN: 10 passed), `parse` (11 passed), `validate` (4 passed) and `create` (7 passed) — then `pnpm test` for the full workspace (5 files, 33 tests). Added the `cli/new.ts` and `cli/check.ts` CLIs and the root `worklog:new` / `worklog:check` scripts, then ran `pnpm worklog:new --title "Scaffolded the workspace" --phase setup` with no `--outcome` to confirm the CLI rejects bad input with exit code 1. Added `worklog/README.md` and transcribed the six planning-session entries, confirmed with `pnpm worklog:check` (6 valid), then created this entry and the M1-T1 entry with the CLI itself.

## What went well / what didn't

Unlike Task 1, this `pnpm install` added no new `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` — `yaml@2.9.1` and `zod@4.6.5` were already past pnpm 12's release-age window. Every RED failure was the exact expected "Cannot find module" error, never an assertion failure, and every GREEN count matched the plan's expected numbers exactly, which is a good sign the plan's own scratch-repo verification is trustworthy. Applied controller ruling R2 in `slugify`: the plan's own accent-stripping line hides literal invisible Unicode combining characters (U+0300–U+036F) inside a regex character class instead of writing them as an escaped range — easy to miss since they render as nothing in an editor or diff. Matching by Unicode category instead (`\p{M}` with the `u` flag) avoids depending on invisible source bytes, and the "strips accents" test still passes unchanged. Creating the M1-T1 and M1-T2 entries one command apart landed both in the same UTC minute (`2026-09-15T1057`); they still sort in the right order because `validateWorklog` compares the full `date` field (second precision) before falling back to `id`, not just the file name's minute.

## Takeaway

A regex character class is a bad place to hide non-printing characters — prefer a named Unicode property (`\p{M}`) over a range of code points you can't see in the source. TDD evidence is only convincing when the RED run is checked for the *right* failure, not just any failure; a missing-module error and a real bug can both make a test suite red.
