# Wolfchatter

Real-time chat on a map: click anywhere to drop a pin and open a chatroom, click a pin to join it, and everyone in the room sees new messages instantly. Built for the Wolfpack Digital full-stack test.

> **Status: M1 Foundation.** The toolchain, shared API contract, work-log tooling and AI agent setup are in place. The API (M2) and the web app (M3) come next; see the [roadmap](docs/plans/README.md).

## Documents

- [Technical PRD](docs/PRD.md): requirements and technical decisions
- [Roadmap and milestone plans](docs/plans/README.md)
- [Agent guide](CLAUDE.md): conventions every AI tool follows in this repo
- [Work log](worklog/): wins, issues, decisions and learnings recorded during the build

## Getting started

You need Node.js 24 (see `.nvmrc`) and pnpm 12.

```bash
pnpm install
pnpm check
```

`pnpm check` runs everything CI runs: Biome, TypeScript, Vitest and the work-log check.

## Repository layout

```
packages/shared    API and real-time contract: zod schemas and types
packages/worklog   work-log schema, parser, CLIs and Stop-hook logic
worklog/           work-log entries, one Markdown file each
docs/              PRD and plans (infrastructure and review docs follow)
.claude/           Claude Code settings, hooks and skills
```

## How this repo is built with AI

Work follows the PRD and a plan per milestone, executed by one AI subagent per task with a review between tasks. [CLAUDE.md](CLAUDE.md) sets the conventions, hooks keep formatting consistent and prompt agents to keep the [work log](worklog/) up to date, and every milestone lands as a pull request that CI must pass.
