---
title: "Work log as build-time data: history, devlog and the Vite plugin"
date: 2026-09-16T06:58:45Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T1
outcome: win
commits: []
related: []
---

## What happened

Implemented M4-T1 end to end. `schema.ts`: `date` now uses `z.iso.datetime({ precision: 0 })`;
confirmed empirically first (a quick zod script) that the unconstrained schema accepts both
`2026-09-16T04:17:00.500Z` and `2026-09-16T04:17:00Z`, so the new rejection test was a genuine
RED against current behaviour, not an assumption. `packages/worklog/src/history.ts`
(`parseAddedCommits`) and `devlog.ts` (`buildDevlogEntries`) are new, pure, and exported from the
package's `index.ts`. `apps/web/plugins/worklog.ts` is the thin Vite plugin: reads `worklog/`
relative to its own `import.meta.url`, shells out to the exact `git log` command the brief gives,
feeds both pure functions, renders bodies with `marked.parse(md, { async: false })`, and serves
`virtual:worklog`. Added `apps/web/src/virtual-worklog.d.ts` (type-only import of `DevlogEntry`)
and registered the plugin in `vite.config.ts` (two-line diff: one import, one array entry —
nothing else in that file touched). Installed `marked` and `@wolfchatter/worklog` into
`apps/web` as exact devDependencies, per the plan's explicit call on that (the brief only says
"add"); no `minimumReleaseAgeExclude` entry was needed this time.

TDD: `schema.test.ts` — 1 new case failed as predicted (`expected true to be false`, current
schema accepts fractional seconds), then 14/14 passed after the one-line fix.
`history.test.ts` — 4 tests, all failed on "Cannot find module './history.ts'" before the file
existed, all passed after. `devlog.test.ts` — same pattern, 5/5. `pnpm worklog:check` stayed at
"45 work-log entries are valid" throughout. Full suite: `pnpm test` 248/248 across 35 files,
`pnpm typecheck` and `pnpm lint` clean.

Acceptance criteria 3 and 4 need the plugin's `resolveId`/`load` to actually run, but nothing in
`apps/web/src` imports `virtual:worklog` yet — that page is M4-T2's job, and the brief says not to
build it here. `pnpm --filter @wolfchatter/web build` alone would prove nothing about the data
(no consumer, so the module is never resolved). Instead I wrote a throwaway Node script that
imports the real plugin file and calls `resolveId('virtual:worklog')` then `load()` on the result
— exactly what Vite does — and evaluates the returned code as a module. Against this repository
(full history): 45 entries, newest first, every `commit` a 40-character hex SHA. With
`process.env.PATH` set to a directory with no `git` binary before importing the plugin: the same
45 entries, the plugin's own `console.warn` fired once, and every `commit` was `null`. I chose
"PATH without git" over a scratch shallow clone because it gives a deterministic all-null result;
a real `--depth 1` clone of this repository would very likely include the tip commit's own
worklog addition (`2026-09-16T0633-...`), which proves the degradation less cleanly than "git is
entirely unavailable" does. The script and its output aren't part of this commit.

## What went well / what didn't

Everything matched on the first attempt: the RED failures were exactly the predicted ones, and
GREEN counts matched with no debugging needed. One shell gotcha: `pnpm add ... "@wolfchatter/
worklog@workspace:*"` needs quoting — zsh tried to glob-expand the unquoted `*` in the repo root
and failed with "no matches found" before any package manager code ran. Also worth recording:
partway through this task `docs/plans/2026-09-16-m4-golive.md` picked up an unstaged change (an
IPv6 rate-limiting finding, D12-scope territory) that I did not make — presumably another session
working the same branch concurrently. I left it alone and staged only the files this task
touched, but a reader of `git status` mid-task would see it and might wonder.

## Takeaway

Proving a deliberately "thin, untested" Vite plugin still needs a real proof, not just "the two
pure functions are tested so the wiring must be fine." Calling `resolveId`/`load` directly on the
plugin object, the same way Rollup would, is a cheap way to exercise real wiring end-to-end
without needing a consumer module or a slow, fragile shallow-clone-plus-symlink setup — worth
reaching for again whenever a future task's acceptance criteria outrun what the current milestone
is allowed to wire into the app.
