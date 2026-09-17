---
title: TypeScript's NodeNext resolver refuses virtual:worklog because of the colon
date: 2026-09-16T07:52:47Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T2
outcome: issue
severity: medium
commits: []
related: []
---

## What happened

`devlog-page.tsx` is the first file under `apps/web/src` to actually `import { entries } from
'virtual:worklog'` — M4-T1 only declared the ambient module (`virtual-worklog.d.ts`), nothing
consumed it yet. `pnpm --filter @wolfchatter/web typecheck` failed with `TS2307: Cannot find
module 'virtual:worklog'`, plus a cascade of `implicit any` errors from treating `entries` as
untyped. That was surprising: the `.d.ts` file itself had typechecked cleanly since M4-T1, so the
ambient declaration looked correct.

`tsc --traceResolution` named the real cause: `Skipping module 'virtual:worklog' that looks like
an absolute URI, target file types: ...` — under `moduleResolution: "nodenext"`, TypeScript
parses any specifier containing a colon as a URI-scheme import (the same family as `node:fs` or
`data:`) and refuses to even look for an ambient `declare module` match for it, no matter which
file declares one. This fires for every *importer* of `virtual:worklog`, not just this one — the
`.d.ts` file typechecked fine on its own because nothing there *imports* the string, only
declares it.

## What went well / what didn't

Changing `moduleResolution` to `"bundler"` would fix it, but that setting lives in
`tsconfig.base.json`, shared by `apps/api`, which actually runs under Node's real ESM resolver —
weakening that project-wide to work around one virtual specifier felt like exactly the kind of
fix that trades a small, local problem for a large, invisible one.

The targeted fix: `apps/web/tsconfig.json` gained one line, `"paths": { "virtual:worklog":
["./src/virtual-worklog.d.ts"] }`. `paths` remapping is resolved before nodenext's URI check, so
it never gets a chance to reject the specifier — confirmed by rerunning `--traceResolution` after
the change and seeing the `virtual:worklog` lookups disappear entirely. Scoped to `apps/web`
alone, `apps/api`'s resolution is untouched.

## Takeaway

A Vite virtual module named `virtual:<name>` (the community convention this repo's own plugin
follows) cannot be consumed from `apps/web/src` under `moduleResolution: "nodenext"` without a
`paths` entry pointing the exact specifier at its `.d.ts` file — the ambient `declare module`
alone is not enough once TypeScript's Node-ESM emulation sees the colon. Anyone adding a second
`virtual:*` module to this app will need the same one-line `paths` entry, not a new `.d.ts` trick.
