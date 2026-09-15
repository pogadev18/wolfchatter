# Wolfchatter: agent guide

Real-time chat on a map, built for the Wolfpack Digital full-stack test. **Read [docs/PRD.md](docs/PRD.md) first:** it is the source of truth for requirements (FR-1…FR-8) and technical decisions. The roadmap and milestone plans live in [docs/plans/](docs/plans/README.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies (pnpm 12 required) |
| `pnpm check` | Everything CI runs: lint, typecheck, tests, work-log check |
| `pnpm lint` / `pnpm format` | Biome check / apply formatting and safe fixes |
| `pnpm typecheck` | `tsc --noEmit` for the root and every package |
| `pnpm test` | All Vitest projects; one file: `pnpm exec vitest run <path>` |
| `pnpm worklog:new --title "…" --phase <phase> --outcome <outcome> --agent "<role> · <model id>"` | Create a work-log entry |
| `pnpm worklog:check` | Validate every work-log entry |

## Repository map

- `packages/shared`: zod schemas and types for REST payloads, errors and socket events. Contract changes start here.
- `packages/worklog`: work-log schema, parser, validator, CLIs and the Stop-hook logic.
- `apps/api` (M2): Fastify, Socket.IO, Drizzle. `apps/web` (M3): React, Vite, react-leaflet.
- `worklog/`: one Markdown file per work-log entry, rendered at `/devlog`.
- `docs/`: PRD, plans, and later infrastructure and review docs.
- `.claude/`: settings, hooks and skills for Claude Code.

## Conventions

- **Node 24 runs TypeScript directly** (type stripping), with no build step. Use only erasable syntax (no `enum`, `namespace` or constructor parameter properties) and import relative files with their `.ts` extension.
- **Strict types, no `any`.** Validate every external input (HTTP bodies, socket payloads, env, files, hook stdin) with zod at the boundary, and infer types with `z.infer` rather than writing them twice.
- **Biome owns formatting:** 2 spaces, single quotes, no semicolons, 100 columns. A hook formats every file you edit; `pnpm format` fixes the rest.
- **Browser-safe packages:** `packages/shared` and `packages/worklog` (except `src/cli/`) will be bundled into the web app, so no `node:*` imports outside tests (Biome enforces it). `packages/shared` also has no Node types, so Node globals fail `pnpm typecheck` there.
- **Small, focused files** named in kebab-case after the domain (`rooms.ts`, `messages.ts`), with tests next to them as `*.test.ts`.
- **Dependencies** are pinned exactly (`pnpm add --save-exact`). Prefer a few lines of code over a new dependency.

## Testing

- Write the failing test first, watch it fail for the expected reason, implement, watch it pass.
- Test behaviour through public interfaces. Prefix a test with its requirement when one applies: `it('FR-5: rejects a blank message', …)`.
- Never skip, weaken or delete a test to get to green; fix the code or ask.

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
- Stamen Watercolor tiles come from Stadia Maps. Localhost needs no key; a deployed domain must be registered with Stadia.
- Leaflet fires `click` twice for a double-click, so map clicks must go through a single-click detector (M3).
