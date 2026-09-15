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

Implemented M1-T4: agent setup. Wrote `reminder.test.ts` first and watched it fail with `Error: Cannot find module './reminder.ts'` (`pnpm exec vitest run packages/worklog/src/reminder.test.ts`), then implemented `needsWorklogReminder` and `parseGitStatus` in `packages/worklog/src/reminder.ts` and re-exported them from `index.ts`; the same test command went to `Tests 5 passed (5)`. Added `zod` and `@wolfchatter/worklog` as root devDependencies (the hooks live in `.claude/hooks/` and resolve imports from root `node_modules`) and pointed root `tsconfig.json` at `.claude/hooks/**/*.ts`. Wrote `format-edited-file.ts` (PostToolUse) and `worklog-reminder.ts` (Stop) plus `.claude/settings.json` wiring both hooks and a project-scripts-only permission allowlist. Verified both hooks by piping them the exact JSON Claude Code sends: the format hook turned `export const   messy = {a:1,\n b:"two"}` into `export const messy = { a: 1, b: 'two' }` with exit 0; the Stop hook exited 2 with the reminder text against the uncommitted, entry-less tree, then exited 0 both on `stop_hook_active:true` and on a `cwd` outside git (`/tmp`). Added `CLAUDE.md`, `AGENTS.md`, and the `worklog` skill, then linked the skill from `worklog/README.md`.

## What went well / what didn't

TDD and both hook verifications matched the brief's expected output exactly on the first try. The one thing that needed care: the controller's amendments point two different model names at two different places that look interchangeable at a glance — the `CLAUDE.md` Git bullet keeps `Claude Opus 5` as its illustrative example verbatim, while this entry's `agent` field, the actual commit trailer, and the `SKILL.md` "Phases" paragraph's `implementer`/`reviewer` examples all use `claude-sonnet-5`, the model that actually did the work. Easy to "fix" the doc's example into consistency with the real value and thereby drift from the brief's exact wording — I re-read both amendments side by side before writing either file to keep them apart. Also worth flagging: `.claude/settings.json` (with its PostToolUse hook) landed partway through this task, so this same session's own Edit/Write calls to `CLAUDE.md`/`AGENTS.md` could have been reformatted after the fact; I checked and Biome left both untouched.

## Takeaway

Generic doc text (an example format) and the record of what actually happened (a commit trailer, a work-log `agent` field) can cite different model names on purpose, and a byte-for-byte transcription task means checking each amendment against its exact target location rather than pattern-matching "same kind of value, must be the same everywhere."
