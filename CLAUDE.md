# Wolfchatter: agent guide

Real-time chat on a map, built for the Wolfpack Digital full-stack test. **Read [docs/PRD.md](docs/PRD.md) first:** it is the source of truth for requirements (FR-1…FR-8) and technical decisions. The roadmap and milestone plans live in [docs/plans/](docs/plans/README.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies (pnpm 12 required) |
| `pnpm dev` | Start Postgres in Docker, apply migrations, and run the API on port 3000 and the web app on port 5173 |
| `pnpm check` | Everything CI runs: lint, typecheck, tests, end-to-end tests, work-log check. Needs Postgres (`pnpm db:up`) and Playwright's Chromium |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Postgres (`compose.yaml`, port 5433) |
| `pnpm db:generate --name <change>` | Generate a migration after editing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm lint` / `pnpm format` | Biome check / apply formatting and safe fixes |
| `pnpm typecheck` | `tsc --noEmit` for the root and every package |
| `pnpm test` | All Vitest projects; one file: `pnpm exec vitest run <path>` |
| `pnpm test:e2e` | Build the web app and run Playwright against it and a fresh API; one test: `pnpm test:e2e --grep "<title>"` |
| `pnpm --filter @wolfchatter/web exec playwright install chromium` | Install Playwright's Chromium, once per machine |
| `pnpm worklog:new --title "…" --phase <phase> --outcome <outcome> --agent "<role> · <model id>"` | Create a work-log entry |
| `pnpm worklog:check` | Validate every work-log entry |

## Repository map

- `packages/shared`: zod schemas and types for REST payloads, errors and socket events. Contract changes start here.
- `packages/worklog`: work-log schema, parser, validator, CLIs and the Stop-hook logic.
- `apps/api`: Fastify routes and services per domain (`src/rooms/`, `src/messages/`), Socket.IO fan-out (`src/realtime/`), the Drizzle schema (`src/db/`) and generated migrations (`drizzle/`). Test helpers live in `apps/api/test/`.
- `apps/web`: React 19 and Vite 8. `src/map/` (Leaflet map, pins, clicks), `src/rooms/` and `src/messages/` (queries, optimistic writes, the chat panel's parts), `src/realtime/` (socket, cache sync, connection status) and `src/panel/`. End-to-end tests live in `apps/web/e2e/`, and test helpers in `apps/web/test/`.
- `worklog/`: one Markdown file per work-log entry, rendered at `/devlog`.
- `docs/`: PRD, plans, and later infrastructure and review docs.
- `.claude/`: settings, hooks and skills for Claude Code.

## Conventions

- **Node 24 runs TypeScript directly** (type stripping), with no build step. Use only erasable syntax (no `enum`, `namespace` or constructor parameter properties) and import relative files with their `.ts` extension.
- **Strict types, no `any`.** Validate every external input (HTTP bodies, socket payloads, env, files, hook stdin) with zod at the boundary, and infer types with `z.infer` rather than writing them twice.
- **Biome owns formatting:** 2 spaces, single quotes, no semicolons, 100 columns. A hook formats every file you edit; `pnpm format` fixes the rest.
- **Browser-safe packages:** `packages/shared` and `packages/worklog` (except `src/cli/`) will be bundled into the web app, so no `node:*` imports outside tests (Biome enforces it). `packages/shared` also has no Node types, so Node globals fail `pnpm typecheck` there.
- **Small, focused files** named in kebab-case after the domain (`rooms.ts`, `messages.ts`), with tests next to them as `*.test.ts`. In `apps/api` each domain is a folder: `rooms/routes.ts`, `rooms/service.ts` and `rooms/rooms.test.ts`.
- **Dependencies** are pinned exactly (`pnpm add --save-exact`). Prefer a few lines of code over a new dependency.

## Testing

- Write the failing test first, watch it fail for the expected reason, implement, watch it pass.
- Test behaviour through public interfaces. Prefix a test with its requirement when one applies: `it('FR-5: rejects a blank message', …)`.
- Never skip, weaken or delete a test to get to green; fix the code or ask.
- API tests run against real Postgres. `createTestDatabase()` gives each test file its own copy of a migrated template database, and `buildTestApp()` builds the app with test defaults.
- Web unit tests run in Node, so logic lives in plain modules (`*-cache.ts`, `outbox.ts`, `realtime-sync.ts`) that components only wire up. Socket tests use `startSocketServer()`, a local Socket.IO server that can hold back acknowledgements and drop connections.
- Playwright tests run one at a time against the production build, an API on port 3100 and a `wolfchatter_e2e` database that is emptied before each test. Map tiles are served locally. The API allows 10 chatroom creates a minute and every test shares one client address, so only tests about creating chatrooms click the map; the rest call `database.createRoom()`.

## Work log (required)

Use the `worklog` skill. Every task commits at least one entry together with its work, and every failed attempt, surprising bug or non-obvious decision gets one too. Be honest about what went wrong; the log is a diary, not a changelog. A Stop hook reminds you when work changed since the last entry.

## Git

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`) in small, focused commits.
- One branch and pull request per milestone (`m1-foundation`, `m2-api`, …).
- End every commit message with a `Co-Authored-By:` trailer naming the Claude model that wrote it, such as `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never push to `main`, force-push, or merge a pull request without the user's approval.

## Definition of done

1. `pnpm check` passes.
2. Tests cover the behaviour, and the behaviour matches the PRD.
3. A work-log entry describes what happened.
4. Docs are updated when a contract, command or decision changes.

## Gotchas

- `pnpm setup` is a built-in pnpm command. Never name a script after one.
- pnpm 12 holds back packages published in the last 24 hours and may add `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml`. Commit them.
- TypeScript 7 has no programmatic API, so tools that need one (typescript-eslint and similar) don't work. Lint with Biome.
- TypeScript 7 defaults `types` to `[]`: a package that uses Node globals needs `"types": ["node"]`.
- Stamen Watercolor tiles come from Stadia Maps. Register the deployed domain, but the check that actually bites is different from the one the PRD assumed: measured on the live tile server, *any* `Referer` is served and a request with **no** `Referer` gets a 401. So never set `Referrer-Policy: no-referrer` anywhere — a meta tag, a `netlify.toml` headers block, a hardening pass — or every tile 401s and the map silently drops to the OpenStreetMap fallback.
- Leaflet fires `click` twice for a double-click, so map clicks go through `createSingleClickDetector` (`apps/web/src/map/single-click.ts`).
- Leaflet hands a click on a marker to the map when the marker has no `click` handler of its own, which would create a chatroom under an existing pin.
- Playwright starts `webServer` commands before `globalSetup`, so the end-to-end database is prepared inside the API's command in `apps/web/playwright.config.ts`.
- Biome 2.5 rejects Tailwind 4's CSS directives unless `css.parser.tailwindDirectives` is on (it is, in `biome.json`).
- React Router 8 has no `react-router-dom`: import everything from `react-router`.
- A web build needs `VITE_API_URL`; only the dev server has a default (`http://127.0.0.1:3000`).
- Playwright's `getByLabel` matches substrings: `getByLabel('Message')` also finds the "Messages" list, so pass `{ exact: true }`.
- A Playwright drag that releases the mouse mid-move leaves Leaflet panning with inertia. Pause for 100 ms before `mouse.up()` when a test needs the map to stay put.
- pnpm 12 refuses to run dependency build scripts until each package is decided in `allowBuilds` (`ERR_PNPM_IGNORED_BUILDS`). `esbuild` is `false`: its binary comes from an optional dependency.
- Fastify silently ignores a numeric `trustProxy`, and `true` lets clients spoof their address. The API trusts only the proxies listed in `TRUST_PROXY`. On Render that list must include **Cloudflare's published ranges** as well as `loopback,uniquelocal`: Render fronts services with Cloudflare, so without them `req.ip` is whichever Cloudflare edge answered and every visitor shares a handful of rate-limit buckets. Fastify logs `remoteAddress: req.ip`, so the request log — not rate-limit headers — is what tells you the resolved value.
- zod v4 runs **every** check in a schema's list even after an earlier one fails, so a `.refine()` receives input that `z.url()` (or any preceding check) already rejected. Guard anything that can throw — `URL.canParse` before `new URL` — or a malformed variable produces a bare `TypeError` instead of the aggregated error naming it.
- Never edit generated migrations in `apps/api/drizzle/`: change `schema.ts` and run `pnpm db:generate`.
- `drizzle-kit generate` **exits 0 when it fails**. A rename needs its interactive "rename, or drop and add?" prompt, and with no TTY it prints `Error: Interactive prompts require a TTY terminal`, writes nothing, and still exits 0 — so never trust its exit code alone. CI's drift check requires a recognised success line and rejects any `Error:` line for exactly this reason.
- The deploy workflow migrates the database *before* it deploys the API (`.github/workflows/deploy.yml`), against whichever version is still serving traffic during the build. Every migration must stay compatible with that running code: additive changes only, and a rename or drop needs an expand/contract pair across two deploys instead of one.
- Connect to the local Postgres by `127.0.0.1`, not `localhost`. On macOS, resolving `localhost` sometimes took 5 seconds before Node even tried to connect: 4 stalls in 10,500 connects, and none in 10,500 by `127.0.0.1`. The pool still waits up to 10 seconds and API tests time out after 15, so a slow test is not necessarily a hang.
