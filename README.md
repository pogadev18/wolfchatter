# Wolfchatter

Real-time chat on a map: click anywhere to drop a pin and open a chatroom, click a pin to join it, and everyone in the room sees new messages instantly. Built for the Wolfpack Digital full-stack test.

> **Status: M2 API.** The REST and Socket.IO API is in place: chatrooms and messages stored in Postgres, validation, rate limits and real-time fan-out. The web app (M3) comes next; see the [roadmap](docs/plans/README.md).

## Documents

- [Technical PRD](docs/PRD.md): requirements and technical decisions
- [Roadmap and milestone plans](docs/plans/README.md)
- [Agent guide](CLAUDE.md): conventions every AI tool follows in this repo
- [Work log](worklog/): wins, issues, decisions and learnings recorded during the build

## Getting started

You need Node.js 24 (see `.nvmrc`), pnpm 12 and Docker.

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts Postgres in Docker, applies the migrations and serves the API at http://localhost:3000; http://localhost:3000/api/health should answer `{"ok":true,"db":"up","commit":null}`. Defaults live in [`apps/api/.env.example`](apps/api/.env.example); override them in `apps/api/.env`.

`pnpm check` runs everything CI runs: Biome, TypeScript, Vitest and the work-log check. The API tests need Postgres, so run `pnpm db:up` first if `pnpm dev` isn't running.

## API

| Endpoint | Behaviour |
|---|---|
| `GET /api/health` | `{ ok, db, commit }`; 503 while the database is unreachable |
| `GET /api/rooms` | Every chatroom, oldest first |
| `POST /api/rooms` | `{ id, lat, lng }` → 201 chatroom, numbered by the server; 10 a minute per client |
| `GET /api/rooms/:id/messages` | The newest `limit` (default 50) messages before the `before` message id, oldest first |
| `POST /api/rooms/:id/messages` | `{ id, author, body }` → 201 message; 30 a minute per client |

Clients generate the ids, so retrying a write returns the stored item instead of a duplicate. Every error has the shape `{ error: { code, message, details? } }`. Socket.IO runs over WebSockets only: `room:created` reaches every client, and `message:created` reaches clients that joined the chatroom with `room:join`. The shared contract is in [`packages/shared`](packages/shared/src).

## Repository layout

```
apps/api           Fastify REST API, Socket.IO fan-out, Drizzle schema and migrations
packages/shared    API and real-time contract: zod schemas and types
packages/worklog   work-log schema, parser, CLIs and Stop-hook logic
worklog/           work-log entries, one Markdown file each
docs/              PRD and plans (infrastructure and review docs follow)
.claude/           Claude Code settings, hooks and skills
```

## How this repo is built with AI

Work follows the PRD and a plan per milestone, executed by one AI subagent per task with a review between tasks. [CLAUDE.md](CLAUDE.md) sets the conventions, hooks keep formatting consistent and prompt agents to keep the [work log](worklog/) up to date, and every milestone lands as a pull request that CI must pass.
