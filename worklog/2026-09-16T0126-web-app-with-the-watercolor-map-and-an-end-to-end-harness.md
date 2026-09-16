---
title: Web app with the watercolor map and an end-to-end harness
date: 2026-09-16T01:26:44Z
agent: implementer · claude-sonnet-5
phase: web
task: M3-T2
outcome: win
commits: []
related: []
---

## What happened

Built `apps/web` from the brief: split tsconfigs (browser vs Node types), `env.ts` validating
`VITE_API_URL` as a path-free `http(s)` origin, the Vite/Tailwind/Leaflet shell, and the
Playwright harness (`environment.ts`, `prepare-database.ts`, `fixtures.ts` for a truncated
database and locally-served tiles per test). `pnpm install` finished `using pnpm v12.4.1` with no
`ERR_PNPM_IGNORED_BUILDS` and added no `minimumReleaseAgeExclude` entries. Wrote `env.test.ts`
first and watched it fail with `Cannot find module './env.ts'`, then implemented `env.ts` and got
`Tests 5 passed (5)`. Wrote the five `map.spec.ts` tests before any component existed; all five
failed with `Error: element(s) not found` against the named locators (the `5/18/11.jpg` tile, the
Zoom in button, an OpenStreetMap tile, the panel text, the panel itself), then implementing
`base-tiles.tsx`, `map-view.tsx`, `chat-panel.tsx` and `app.tsx` turned it into `5 passed` on the
first run.

Ran all six break-and-restore proofs from Step 8. Every one matched the brief's predicted output
verbatim, down to the exact float: moving the map centre 0.1° east gave `Expected: <= 1` /
`Received: 2.4318577777776227`; deleting `isolate` from `<main>` gave `TimeoutError:
locator.click: Timeout 5000ms exceeded` with the tile at `5/19/10.jpg` named as the interceptor;
deleting `flex-col` gave `expect(received).toMatchObject(expected)`. Restored each file with Write
using the plan's exact code block rather than reverting the Edit, so the format-on-edit hook never
got a chance to reflow the lines I'd touched. `pnpm dev` in the background, then `pkill -INT` on
both process patterns, produced all four expected log lines (`"msg":"Shutting down"`, `"msg":
"Server closed"`, `apps/web dev: Failed`, `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`), and `pgrep -f
'src/server.ts|vite/bin/vite.js'` printed nothing afterward. `pnpm check` finished at the brief's
predicted counts: `Test Files 20 passed (20)`, `Tests 153 passed (153)`, `5 passed` from
Playwright, `✔ 33 work-log entries are valid`.

## What went well / what didn't

Nothing deviated from the brief: every RED failure, every GREEN count, and all six break-and-restore
outputs matched on the first attempt, including the specific pixel-offset float in proof 2 and the
exact tile coordinates named in proofs 1 and 5. That is itself informative — the plan's own scratch
verification (noted in an earlier work-log entry) meant there was nothing here to debug. The one
place I paused to think was Step 1: the task instructions say to install pinned dependencies with
`pnpm add --save-exact`, but the brief's own Step 1 gives the full `package.json` content already
pinned and just says `Run: pnpm install`; I followed the brief verbatim (as directed) since writing
the exact versions directly and installing produces the identical pinned lockfile outcome.

## Takeaway

Restoring a broken proof step by writing back the plan's literal code block, instead of hand-editing
the change away, sidesteps the format-hook-reflow risk the constraints doc warns about — worth
keeping as the default technique for every future break-and-restore step, not just this task's.
