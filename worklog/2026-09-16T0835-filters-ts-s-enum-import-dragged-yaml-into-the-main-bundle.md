---
title: filters.ts's enum import dragged yaml into the main bundle
date: 2026-09-16T08:35:23Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T2
outcome: issue
severity: medium
commits: []
related: ['2026-09-16T0753-the-devlog-fr-8-s-filterable-timeline-over-the-work-log']
---

## What happened

`filters.ts` imports `WORKLOG_PHASES`/`WORKLOG_OUTCOMES`/`WORKLOG_AGENT_ROLES` from
`@wolfchatter/worklog`'s package root as real runtime values. A review found real `yaml`
internals (`yaml.org`, its parser's identifiers) inside `dist/assets/vendor-*.js` by grepping the
built output — the chunk `index.html` `modulepreload`s, so every visitor of `/`, the map, pays to
download `yaml` whether they ever open `/devlog` or not. My own report had called this "safe"
because moving the package to a real dependency "functionally changes nothing" — true for module
*resolution*, false for what a bundler decides to *keep*. The package's `index.ts` re-exports
`parse.ts`, which imports `yaml` for frontmatter parsing; without a `sideEffects` declaration,
the bundler could not prove the rest of that barrel was safe to drop just because `filters.ts`
only uses three arrays from `schema.ts`.

## What went well / what didn't

I asserted the "functionally nothing changes" claim without building and inspecting the output —
exactly the kind of claim the shallow-clone finding (logged separately) shows I should test
before writing down. This time the reviewer built the bundle and grepped it; I should have done
that myself before calling the dependency move harmless.

## Takeaway

Added `"sideEffects": false` to `packages/worklog/package.json` — true of every module in this
package (checked: `schema.ts`, `parse.ts`, `reminder.ts`, `validate.ts`, `create.ts`,
`devlog.ts`, `history.ts` only declare consts, functions and types at the top level; `src/cli/`
is never imported by anything the browser bundle reaches). Verified by grepping the rebuilt
`dist/assets/*.js` for `yaml.org` and yaml-internal identifiers (`YAMLMap`, `parseDocument`,
`createNode`): zero matches anywhere, not the main bundle, not even the lazy `/devlog` chunk that
doesn't need `yaml` either. The vendor chunk shrank by about 29 KB. That one-line, package-wide
fix was enough; a subpath export or a duplicated enum list was never needed. The lesson is the
verification habit, not the fix: "the bundler should tree-shake this" is a hypothesis, and
`grep dist/assets/*.js` is how you find out whether it did.
