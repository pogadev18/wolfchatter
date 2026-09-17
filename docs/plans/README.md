# Roadmap

Wolfchatter is built in five milestones. Each one ends in a pull request that CI must pass and the user must approve before it merges.

Only the current milestone has a detailed plan. The next plan is written once the previous milestone has merged, so it builds on the code that actually exists instead of on guesses about code that doesn't. Before a plan is written, its code is built and checked task by task in a scratch repository, so the plan's code blocks and expected outputs are real.

| Milestone | Outcome | Requirements | Plan |
|---|---|---|---|
| **M1 Foundation** | pnpm workspace and toolchain, shared API contract, work-log tooling, agent setup, CI | Contract for FR-2 to FR-7; work-log format for FR-8 | [2026-09-15-m1-foundation.md](2026-09-15-m1-foundation.md) |
| **M2 API** | Fastify, Drizzle and Postgres: rooms and messages endpoints, validation, rate limits, Socket.IO fan-out, health check, graceful shutdown | Server side of FR-2 and FR-4 to FR-7 | [2026-09-15-m2-api.md](2026-09-15-m2-api.md) |
| **M3 Web app** | React map with watercolor tiles, pin creation and selection, chat panel with optimistic sending, real-time updates, connection and wake-up states; Playwright tests, including two browsers chatting live | FR-1 to FR-7 | [2026-09-15-m3-web.md](2026-09-15-m3-web.md) |
| **M4 Devlog and go-live** | `/devlog` timeline, GitHub Actions deploy to Render, Netlify and Neon, `INFRASTRUCTURE.md`, full README | FR-8, delivery | [2026-09-16-m4-golive.md](2026-09-16-m4-golive.md) |
| **M5 Self review** | Review skill, reviewer agent and checklist, run against the final code; fixes; `docs/review/REPORT.md` | All | Written after M4 merges |

CI grows with the code: M1 runs lint, typecheck, unit tests and the work-log check; M2 adds integration tests against Postgres; M3 adds the build and Playwright; M4 adds the deploy workflow, which runs only after CI passes on `main`.

## How a milestone runs

1. **Branch:** `m<N>-<name>` from `main`, starting with a commit that adds the milestone's plan.
2. **Tasks:** one fresh subagent per task (superpowers:subagent-driven-development), test-first, with a review before the next task starts.
3. **Work log:** each task commits at least one `worklog/` entry together with its work.
4. **Pull request:** CI must pass; the user reviews and approves the merge.
5. **Next plan:** written against the merged code and shown to the user before any work starts.

## Things only the user can do

| When | What |
|---|---|
| Before M1 | Upgrade pnpm to 12: `brew upgrade pnpm` |
| Before M2 | Have Docker Desktop running, for the local Postgres |
| Before M4 | Create Render, Neon and Stadia Maps accounts; create the Netlify site; register the Netlify domain with Stadia Maps; add the deploy secrets to the GitHub repository |
