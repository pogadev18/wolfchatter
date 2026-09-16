# Wolfchatter

Real-time chat on a map: click anywhere to drop a pin and open a chatroom, click a pin to join it, and everyone in the room sees new messages instantly. Built for the Wolfpack Digital full-stack test.

> **Status: M3 Web app.** The map and chat work end to end: watercolor map, chatrooms and messages stored in Postgres, optimistic sending with retries, and live updates between browsers. The devlog page and deployment (M4) come next; see the [roadmap](docs/plans/README.md).

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

`pnpm dev` starts Postgres in Docker, applies the migrations, and runs the API at http://localhost:3000 and the web app at http://localhost:5173. Stop both with Ctrl+C; pnpm then reports the web server's exit as a failure, which is harmless. API defaults live in [`apps/api/.env.example`](apps/api/.env.example) and can be overridden in `apps/api/.env`; the web app reads `VITE_API_URL` (see [`apps/web/vite.config.ts`](apps/web/vite.config.ts)).

`pnpm check` runs everything CI runs: Biome, TypeScript, Vitest, the Playwright end-to-end tests and the work-log check. It needs Postgres (`pnpm db:up`, if `pnpm dev` isn't running) and, once per machine, Playwright's Chromium:

```bash
pnpm --filter @wolfchatter/web exec playwright install chromium
```

## Web app

| Area | How it works |
|---|---|
| Map | Stamen Watercolor tiles from Stadia Maps, switching to OpenStreetMap if a tile fails. A click counts once no second click follows within 300 ms, so double-clicks only zoom |
| Chatrooms | A click adds the pin at once and creates the chatroom in the background; a create the API rejects removes the pin and says why. The selected chatroom lives in the URL as `?room=<id>` |
| Messages | Sent optimistically and retried with the same id, so a retry never duplicates. A failed send stays with a Retry button; a message the API rejects for good is removed with the reason |
| Real time | One WebSocket connection. After every reconnect the app refetches the chatrooms, re-joins the open chatroom and refetches its messages once the join is acknowledged. The panel shows the connection status, and "Waking up the server…" when the first connection is slow |

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
apps/web           React web app: map, chat panel, real-time sync, Playwright tests
packages/shared    API and real-time contract: zod schemas and types
packages/worklog   work-log schema, parser, CLIs and Stop-hook logic
worklog/           work-log entries, one Markdown file each
docs/              PRD and plans (infrastructure and review docs follow)
.claude/           Claude Code settings, hooks and skills
```

## How this repo is built with AI

Work follows the PRD and a plan per milestone, executed by one AI subagent per task with a review between tasks. [CLAUDE.md](CLAUDE.md) sets the conventions, hooks keep formatting consistent and prompt agents to keep the [work log](worklog/) up to date, and every milestone lands as a pull request that CI must pass.
