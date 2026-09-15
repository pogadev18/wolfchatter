---
title: Agent setup with format and work-log hooks
date: 2026-09-15T11:25:44Z
agent: implementer · claude-sonnet-5
phase: setup
task: M1-T4
outcome: win
commits: []
related: []
---

## What happened

Wrote `reminder.test.ts` first: `pnpm exec vitest run packages/worklog/src/reminder.test.ts` failed with `Error: Cannot find module './reminder.ts'`, then reported `Tests 5 passed (5)` once `needsWorklogReminder` and `parseGitStatus` existed. Added the PostToolUse hook `format-edited-file.ts`, the Stop hook `worklog-reminder.ts` and `.claude/settings.json`, with `zod` and `@wolfchatter/worklog` as root devDependencies so the hooks resolve their imports and root `tsconfig.json` type-checks them, then `CLAUDE.md`, `AGENTS.md` and the `worklog` skill. Each hook was checked by piping it a minimal version of the hook input JSON: the format hook turned `export const   messy = {a:1,\n b:"two"}` into `export const messy = { a: 1, b: 'two' }` and exited 0, and the Stop hook exited 2 with the reminder on the uncommitted tree, then 0 with `stop_hook_active: true` and with a `cwd` outside git (`/tmp`).

## What went well / what didn't

The test runs and both hook checks matched the plan's expected output on the first try. Model names needed care: the `CLAUDE.md` Git bullet keeps `Claude Opus 5` as its example, while this entry's `agent`, the commit trailer and the skill's subagent examples name `claude-sonnet-5`, the model that did the work. `.claude/settings.json` landed partway through the task, so the later edits to `CLAUDE.md` and `AGENTS.md` could have been reformatted by the new hook; Biome left both untouched.

## Takeaway

A docs example and the record of who did the work, such as a commit trailer or an entry's `agent`, can name different models on purpose. When transcribing exact text, check each value against its own target instead of making look-alike values match.
