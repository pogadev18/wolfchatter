---
title: '`pnpm setup` is a built-in command, not a free script name'
date: 2026-09-15T09:45:00Z
agent: lead · claude-opus-5
phase: plan
outcome: issue
severity: medium
---

## What happened

The approved design said local setup was `pnpm setup` followed by `pnpm dev`. Self-reviewing the PRD showed that `setup` is a built-in pnpm command (it configures pnpm's global bin directory), so pnpm would run that instead of our script.

## What went well / what didn't

The mistake was caught before any code or docs depended on it. It came from naming a script without checking pnpm's own commands.

## Takeaway

Local setup is `pnpm install`, then `pnpm dev`, which starts Docker Postgres and applies migrations itself. The Gotchas section of `CLAUDE.md` (M1-T4) records the rule: never name a script after a built-in pnpm command.
