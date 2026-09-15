# Wolfchatter — Technical PRD

**Status:** Approved · **Date:** 2026-09-15 · **Scope:** Wolfpack Digital test, including the optional real-time part

Wolfchatter is a chat on a map: clicking the map drops a pin that opens a chatroom, clicking a pin opens that room, and everyone in it sees new messages instantly. **Done means** every requirement is covered by an automated test, the app runs locally with two commands, and `main` deploys to production through CI.

## 1. Functional requirements

IDs are referenced by plan tasks, test names and the review report.

- **FR-1 Map.** Full-screen Leaflet map with Stamen Watercolor tiles (Stadia Maps), centred on Cluj (46.7712, 23.6236) at zoom 5, zoom controls top-left and attribution bottom-right. Falls back to OpenStreetMap tiles on tile errors.
- **FR-2 Create a chatroom.** A single click adds a pin and a room titled "Chatroom N" (N set by the server), the panel switches to it and the message input gets focus. Drags and double-click zooms never create pins.
- **FR-3 Empty state.** With no room selected, the top-right panel reads "Click on the map to start a chat".
- **FR-4 Switch chatroom.** Clicking a pin switches the panel's title and messages and highlights the pin, without creating a new one. Pins created by other users never change your selection. The selection lives in the URL (`?room=<id>`); unknown ids show "Chatroom not found".
- **FR-5 Send a message.** Inputs "write your user name here" and "write message here" with **Submit**, as in the mockup. Author 1–32 and message 1–1000 characters after trimming; Enter submits; the username is remembered on the device. Messages show author, text and date/time; a failed send stays visible with a retry.
- **FR-6 Persistence.** Rooms and messages are stored in PostgreSQL and survive reloads and new sessions.
- **FR-7 Real-time.** New pins reach every connected user and new messages reach everyone viewing that room, without a reload. Events missed while disconnected are recovered on reconnect, and the panel shows the connection status.
- **FR-8 Devlog.** `/devlog` renders the AI work log (`worklog/*.md`) as a filterable timeline.

**Non-functional.**

- **Security:** server-side validation of all HTTP and socket input; per-IP rate limits (10 rooms and 30 messages per minute); 16 KB body limit; CORS allowlist; Helmet headers; messages rendered as plain text only.
- **Resilience:** idempotent writes; sending keeps working while the socket reconnects; a "Waking up the server…" state covers hosting cold starts.
- **Accessibility & layout:** labelled inputs, new messages announced through a polite live region, focus moved to the message input on room switch; the panel becomes a bottom sheet below 640 px.
- **Quality:** strict TypeScript, test-first API and core logic, green CI before every deploy.

**Out of scope.** Accounts, moderation, empty-room cleanup, marker clustering, paging older messages in the UI, and a deployed staging or multi-instance setup (designed in `INFRASTRUCTURE.md`).

## 2. Stack & architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19, Vite 8, react-leaflet 5, Tailwind 4, React Router | Leaflet is browser-only and SEO is irrelevant: a static SPA |
| Backend | **Node.js 24 LTS**, Fastify 5, Socket.IO 4.8 | Built-in validation and logging; rooms and auto-reconnect |
| Data | PostgreSQL 17, Drizzle ORM + migrations | Relational data with typed, SQL-shaped queries |
| Contract | zod 4 schemas in `packages/shared` | One source of truth for REST, socket events and env |
| Quality | Strict TypeScript, Biome, Vitest 5, Playwright | Unit, integration and two-browser E2E tests |
| Hosting | Netlify, Render, Neon, GitHub Actions | Free tiers, and Render holds WebSockets open |

A pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`. API routes own HTTP and validation; services own queries and rules, and publish events through a `publisher` interface that only the Socket.IO module implements.

## 3. Data model

```
rooms     id uuid PK · number int IDENTITY UNIQUE ("Chatroom N")
          lat, lng double precision with range CHECKs · created_at timestamptz
messages  id uuid PK · room_id uuid FK → rooms ON DELETE CASCADE
          author varchar(32) · body varchar(1000) · created_at timestamptz
          INDEX (room_id, created_at, id)
```

Clients generate UUIDs and inserts use `ON CONFLICT (id) DO NOTHING`, so retries never duplicate and optimistic items keep their id. The server owns `number` and `created_at`: numbering is race-free and ordering ignores client clocks. Room numbers always increase but may skip values, because a retried insert still consumes a sequence value; that is acceptable for a display label.

## 4. API & real-time delivery

```
GET  /api/health                                            → { ok, db, commit }
GET  /api/rooms                                             → Room[]
POST /api/rooms                { id, lat, lng }             → 201 Room
GET  /api/rooms/:id/messages   ?before=<messageId>&limit=50 → Message[], oldest first
POST /api/rooms/:id/messages   { id, author, body }         → 201 Message

Errors  { error: { code, message, details? } } with 400 / 404 / 429
Socket  client → room:join(id), room:leave(id)
        server → room:created (everyone), message:created (Socket.IO room "room:<id>")
```

1. **Writes go through REST only:** validate → insert → commit → publish. Sockets only fan out.
2. **Best-effort push, exact state on reconnect:** clients upsert events by id (absorbing their own echo), order by `(created_at, id)`, and refetch after every reconnect.
3. **Scaling (designed, not built):** `@socket.io/postgres-adapter` shares events across instances via Postgres LISTEN/NOTIFY (no Redis); WebSocket-only transport avoids sticky sessions.

## 5. Frontend state management

- **Server state:** TanStack Query 5 (`['rooms']`, `['rooms', id, 'messages']`), with optimistic create/send and rollback.
- **Real-time:** one `useRealtime()` hook owns the socket, follows the selected room and writes events into the query cache.
- **UI state:** selected room in the URL, username in `localStorage`, connection status via `useSyncExternalStore`; no global store.

## 6. Delivery & AI workflow

- **Local & CI:** `pnpm install`, then `pnpm dev`, which starts Docker Postgres, applies migrations and runs web and API together. Every PR and push runs lint, typecheck, unit and integration tests against Postgres, build, Playwright and a work-log check.
- **Production only, for now:** on green CI, GitHub Actions deploys the API to Render, waits for `/api/health` to report the commit, then deploys the web app to Netlify. Staging is designed in `INFRASTRUCTURE.md`.
- **AI workflow:** `CLAUDE.md` defines conventions and "done", `AGENTS.md` points other tools to it, and `.claude/` holds settings, hooks (format on edit, work-log reminder), the `worklog` and `self-review` skills and a `code-reviewer` agent. Work flows PRD → plan → one subagent per task with review → one PR per milestone.
- **Work log:** one Markdown file per entry in `worklog/`, with frontmatter validated by zod (`title`, `date`, `agent`, `phase`, `task`, `outcome: win | issue | decision | learning`, `severity` for issues, `commits`, `related`). At least one entry per task, plus every failed attempt and non-obvious decision.
- **Self review:** parallel reviewers per concern plus a verification pass produce `docs/review/REPORT.md`, with an FR → code → test matrix and fixed / not-fixed notes.

## 7. Risks & assumptions

- **Stadia tiles need a registered domain in production:** register the Netlify domain; OSM fallback.
- **Render's free tier sleeps (~1 min cold start):** health ping and "waking up" banner; paid instance in the infra plan.
- **A tool doesn't support TypeScript 7 yet:** fall back to TypeScript 6.0 while scaffolding.
- **Spam without accounts:** per-IP rate limits (with the API trusting Render's proxy for client IPs); moderation is out of scope.
- **Assumptions:** demo-level traffic, one API instance, anonymous self-chosen names, timestamps in the viewer's locale.
