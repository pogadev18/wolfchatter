---
title: README, agent guide and roadmap for the web app
date: 2026-09-16T03:17:23Z
agent: implementer · claude-sonnet-5
phase: docs
task: M3-T6
outcome: win
commits: []
related: []
---

## What happened

Replaced `README.md`, `CLAUDE.md` and `docs/plans/README.md` with the task brief's verbatim text, and added one clause to PRD FR-5 about a permanently rejected message being removed with its reason. Before writing anything, checked every command and relative link the new text makes: `pnpm dev`'s ports, `apps/api/.env.example` and `apps/web/vite.config.ts`, the `apps/web/src/*` folders the agent guide now describes, and the two accessibility facts the brief could not know (`chat-panel.tsx`'s `role="status"` line, `room-chat.tsx`'s unlabelled `aria-live="polite"` region) — both matched, so the brief's testing notes needed no change.

## What went well / what didn't

The brief's Step 5 predicted `31 passed` from Playwright and `37 work-log entries`, left over from before Task 4's review fix added a test and two entries. `pnpm check` actually printed `32 passed (36.3s)` and, from `worklog:check`, `39 work-log entries are valid`; both match the task's corrected counts, so no doc text needed adjusting since none of the four files embeds a raw count.

## Takeaway

`ls worklog/*.md | wc -l` overcounts work-log entries by one: the directory also holds a `README.md` that isn't an entry. `pnpm worklog:check`'s printed count is the one to trust.
