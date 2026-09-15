# AGENTS.md

The instructions for AI agents working in this repository live in [CLAUDE.md](CLAUDE.md). Its conventions, commands, testing rules, work-log requirement and definition of done apply to every tool, not only Claude Code. Requirements are in [docs/PRD.md](docs/PRD.md).

Claude Code runs two hooks from `.claude/settings.json` that other tools don't: one formats every edited file, the other reminds the agent to keep the work log. Without them, run `pnpm format` before committing, and follow the [`worklog` skill](.claude/skills/worklog/SKILL.md) for when and how to write entries.
