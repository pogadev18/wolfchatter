---
title: "The devlog: FR-8's filterable timeline over the work log"
date: 2026-09-16T07:53:10Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T2
outcome: win
commits: []
related: ['2026-09-16T0752-typescript-s-nodenext-resolver-refuses-virtual-worklog-becau']
---

## What happened

Built `/devlog` end to end on M4-T1's `virtual:worklog`. Routing: `main.tsx` now wraps `<Routes>`
around `App` (`/`) and the new `DevlogPage` (`/devlog`), with a catch-all redirect to `/`;
`useRealtime()` stays inside `App` alone, so `/devlog` never calls `socket.connect()` — checked
directly (`page.on('websocket', ...)` records nothing) rather than assumed from reading the code.

`apps/web/src/devlog/`: `filters.ts` (pure) reads `phase`/`outcome`/`agent` from the URL, drops
anything that isn't a real value from `@wolfchatter/worklog`'s own enums, and returns both the
visible entries and — separately — the dropdown options, computed from the entries actually
present rather than the full enum (today that's the only visible difference: all 9 phases and
all 4 outcomes are in use, but only 2 of the 4 agent roles are, so the Agent filter offers just
"lead" and "implementer"). `group-by-day.ts` (pure) buckets entries by the viewer's local
calendar day via `Intl.DateTimeFormat('en-CA', ...)`, keeping incoming order. `entry-card.tsx`
renders one entry: time, phase/outcome/severity/task/agent as one metadata line (outcome in red
when it's an "issue"), the title, then `entry.html` via `dangerouslySetInnerHTML` — commented at
the insertion point, pointing at the trust argument on `DevlogEntry.html` in
`packages/worklog/src/devlog.ts` — then commit and `related` links. `commit` links go to
`https://github.com/pogadev18/wolfchatter/commit/<sha>`; a `null` commit renders no link, and a
`related` id is only ever linked when it resolves to a real entry, so a stale or unknown id
degrades to nothing rather than a dead link. `devlog-body.css` hand-rolls prose styling
(headings, lists, code, blockquotes) scoped to `.devlog-body`, since there is no
`@tailwindcss/typography` plugin here and the Markdown arrives as a finished HTML string I
cannot attach classNames to.

Filters live in the URL as `?phase=&outcome=&agent=`, merged rather than replaced on every
change (`withFilter` clones the current `URLSearchParams` and only touches the one key) —
otherwise picking a second filter would silently drop the first, since `setSearchParams(obj)`
replaces the whole query string. Added `apps/web/public/_redirects` and `fetch-depth: 0` on the
e2e job's checkout in `ci.yml` (only that job; `pnpm check`'s `checks` job is untouched).

`DevlogPage` is lazy-loaded from `main.tsx` (`React.lazy` + `Suspense`): the brief points out the
work log "only grows," and every visitor of `/` — the map, the actual product — was otherwise
paying to download the whole rendered log whether they ever opened `/devlog` or not. Checked, not
assumed: the production build now emits `devlog-page-*.js` (240 KB, worklog content included) as
its own chunk, separate from the ~19 KB main entry chunk that `/` needs.

TDD: `filters.test.ts` (15 tests) and `group-by-day.test.ts` (5 tests) both started on "Cannot
find module" before their implementation files existed, then passed once written. The
day-grouping tests use timestamps chosen to be timezone-safe (same UTC second ± minutes for "one
group", 24 hours apart at the same UTC clock time for "two groups") rather than asserting a
specific zone, since the grouping key follows the viewer's local time zone by design.

## What went well / what didn't

The 7 new `e2e/devlog.spec.ts` tests all passed first try against the real, ever-growing
`worklog/` content — deliberately written around relative properties (newest-first ordering,
"narrows", "at least one commit link exists") rather than exact counts or titles, since this is
the one spec file with no per-test fixture to reset. One real Playwright gotcha found while
writing the "related link" test: an entry id like `2026-09-16T0555-...` starts with a digit, so
`page.locator('#2026-...')` is an invalid CSS id selector (bare identifiers can't start with a
digit) — `page.locator('[id="..."]')`, an attribute selector, has no such restriction. The
production code never hits this: it only ever uses the id in an HTML `id` attribute and a `#`
URL fragment, both of which accept any string, and native fragment navigation resolves by
`getElementById`, not `querySelector`.

The other real finding, `related: [...]` above, cost more time than anything else in this task —
see that entry.

## Takeaway

`filterDevlog`'s options come from the full entry list, not the currently-filtered one, on
purpose: narrowing by phase should never make an outcome option disappear out from under the
user. Verified by hand in the browser as well as in `filters.test.ts`, since that is exactly the
kind of thing that is easy to get backwards and still pass a shallower test.
