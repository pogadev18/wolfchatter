# Wolfchatter

Real-time chat on a map: click anywhere to drop a pin and open a chatroom, click a pin to join it, and everyone in the room sees new messages instantly. Built for the Wolfpack Digital full-stack test.

**Live:** [wolfchatter.netlify.app](https://wolfchatter.netlify.app) · [devlog](https://wolfchatter.netlify.app/devlog) · [API health](https://wolfchatter-api.onrender.com/api/health)

> **Deployed and working end to end.** The web app runs on Netlify, the API on Render, and Postgres on Neon; GitHub Actions deploys every push to `main` automatically. The API is on Render's free tier and sleeps after 15 minutes idle — the first request after that took 33 seconds in testing, and the app shows "Waking up the server…" while it wakes. See [Deployment](#deployment) below and [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) for how.

## Documents

- [Technical PRD](docs/PRD.md): requirements and technical decisions
- [Infrastructure](docs/INFRASTRUCTURE.md): what is deployed, how it connects, and what staging and multi-instance scaling would take
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
| Chatrooms | A click adds the pin at once and creates the chatroom in the background; a create that fails removes the pin and says why, with a Retry unless the API rejected it for good (a 409 or a 400 would only fail again). The selected chatroom lives in the URL as `?room=<id>` |
| Messages | Sent optimistically and retried with the same id, so a retry never duplicates. A failed send stays with a Retry button; a message the API rejects for good is removed with the reason |
| Real time | One WebSocket connection. After every reconnect the app refetches the chatrooms, re-joins the open chatroom and refetches its messages once the join is acknowledged. That refetch returns the newest 50 messages, so a gap longer than 50 messages is not filled in: paging back through older ones is out of scope. The panel shows the connection status, and "Waking up the server…" when the first connection is slow |

## API

| Endpoint | Behaviour |
|---|---|
| `GET /api/health` | `{ ok, db, commit }`; 503 while the database is unreachable |
| `GET /api/rooms` | The newest 1000 chatrooms, oldest first |
| `POST /api/rooms` | `{ id, lat, lng }` → 201 chatroom, numbered by the server; 10 a minute per client |
| `GET /api/rooms/:id/messages` | The newest `limit` (default 50) messages before the `before` message id, oldest first |
| `POST /api/rooms/:id/messages` | `{ id, author, body }` → 201 message; 30 a minute per client |

Clients generate the ids, so retrying a write returns the stored item instead of a duplicate. Every error has the shape `{ error: { code, message, details? } }`. Socket.IO runs over WebSockets only: `room:created` reaches every client, and `message:created` reaches clients that joined the chatroom with `room:join`. The shared contract is in [`packages/shared`](packages/shared/src).

## Deployment

`main` deploys itself. On green CI, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) migrates the Neon database, triggers a Render deploy, waits for `/api/health` to report the new commit, builds the web app, and publishes it to Netlify — in that order, so nothing is published until the API it will talk to is confirmed live. See [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) for the full pipeline, every environment variable and why, free-tier limits, and what staging and multi-instance scaling would take (both are designed, not built).

## The devlog

[`/devlog`](https://wolfchatter.netlify.app/devlog) renders every file in [`worklog/`](worklog/) as a filterable timeline: wins, issues, decisions and learnings, each linked to the commit that added it. It exists because an AI-built process is only worth judging if the record includes what went wrong, not only what shipped — a failed attempt or a wrong assumption gets its own entry, the same as a finished feature. The page is built at compile time from `worklog/*.md` (`apps/web/plugins/worklog.ts`); nothing about it depends on the API being awake.

## Repository layout

```
apps/api               Fastify REST API, Socket.IO fan-out, Drizzle schema and migrations
apps/api/src/deploy    The deploy workflow's health poller (wait-for-health.ts)
apps/web               React web app: map, chat panel, real-time sync, Playwright tests
apps/web/plugins       Build-time Vite plugin: worklog/*.md -> the virtual:worklog module
apps/web/src/devlog    The /devlog timeline (FR-8)
packages/shared        API and real-time contract: zod schemas and types
packages/worklog       work-log schema, parser, CLIs and Stop-hook logic
worklog/               work-log entries, one Markdown file each
docs/                  PRD, plans and INFRASTRUCTURE.md (review docs follow)
.github/workflows      CI, and the deploy workflow that ships main
.claude/               Claude Code settings, hooks and skills
```

## How this repo is built with AI

Work follows the PRD and a plan per milestone, executed by one AI subagent per task with a review between tasks. [CLAUDE.md](CLAUDE.md) sets the conventions, hooks keep formatting consistent and prompt agents to keep the work log up to date, and every milestone lands as a pull request that CI must pass. The [devlog](https://wolfchatter.netlify.app/devlog) is the evidence: every win, issue, decision and learning from the build, in order, including what went wrong.
