---
title: Chatrooms on the map with optimistic creates
date: 2026-09-16T01:52:04Z
agent: implementer · claude-sonnet-5
phase: web
task: M3-T3
outcome: win
commits: []
related: []
---

## What happened

Implemented M3-T3 exactly to the brief: the API client (`src/api/client.ts`) with
`ApiRequestError` and the temporary/permanent/describe failure helpers, the single-click
detector (`src/map/single-click.ts`, 300 ms window keyed off Leaflet's `detail`), longitude
wrapping and nearest-world-copy placement (`src/map/longitude.ts`), the rooms cache
(`src/rooms/rooms-cache.ts`) with its merge-not-replace `queryFn`, `?room=` selection
(`src/rooms/selection.ts`, `use-room-selection.ts`), the panel view state machine
(`src/panel/panel-view.ts`), and the pins/clicks/map wiring (`map-clicks.tsx`,
`room-pins.tsx`, `map-view.tsx`) plus `app.tsx`, `main.tsx`, `services.tsx` and
`query-client.ts` to plug it together. `pnpm install` after bumping `package.json` added
only 4 packages (`react-router`, `@tanstack/react-query` and their transitives were already
present via other workspace packages), finished in 751 ms, and ended with
`using pnpm v12.4.1` as expected.

Followed strict TDD throughout: wrote all 6 unit test files verbatim, watched
`pnpm exec vitest run apps/web` fail with `Cannot find module` for each
(`Test Files  6 failed | 1 passed (7)`), implemented, watched it go to
`Test Files  7 passed (7)` / `Tests  50 passed (50)`. Same shape for the end-to-end tests:
`fixtures.ts` (rewritten `database` fixture with `createRoom`, plus `openAnotherBrowser`),
`e2e/map.ts` and `e2e/rooms.spec.ts` went in before any of Step 7's implementation, and
`pnpm test:e2e` failed exactly as predicted, `9 failed` / `7 passed` (the 5 pre-existing map
tests plus the double-click and drag tests, which pass with no implementation because
nothing creates chatrooms yet). Implemented Step 7, then `pnpm lint`,
`pnpm --filter @wolfchatter/web typecheck` and `pnpm test:e2e` were clean: `16 passed`.

Ran all 7 unit break-and-restore proofs and all 11 end-to-end ones from Step 5 and Step 8,
in order, restoring each before the next. Every one matched the brief's predicted failing
test, line and message exactly, including the precise numbers: proof 5 (drawing a pin at
`pin.lng` instead of `nearestWorldCopy(...)`) failed with `Received: 16384` on the nose,
and proof 6 (mutations retrying a 409) produced `Received length: 3` with all three request
bodies identical, confirming the retry sends the same client-generated id rather than
generating a new one per attempt. Proof 4 in the unit tests
(`rooms-cache.test.ts`'s "keeps a chatroom that reached the cache while the list was
loading") is the argument-evaluation-order trap the brief calls out by name: writing
`upsertRooms(queryClient.getQueryData(roomsKey), await api.listRooms())` reads the cache
before the request is even sent, and the test caught it immediately with a one-element
array where two were expected. `pnpm check` finished green: `Test Files  26 passed (26)`,
`Tests  198 passed (198)`, `16 passed` from Playwright, `✔ 34 work-log entries are valid`
(this entry's own commit brings it to 35).

## What went well / what didn't

Every proof matched the brief's predicted output verbatim on the first attempt — no proof
failed at an unexpected line, with an unexpected message, or needed a second try. That is
worth recording because it means the plan's own scratch-build verification (noted in the
plan's lead-ruling entries) held up under a from-scratch implementation, not just a replay.
The only friction was mechanical: each of the 11 end-to-end proofs reruns `vite build` and
`vite preview` from scratch (Playwright's `webServer` config, not something this task
controls), so the eleven `pnpm test:e2e --grep "<name>"` round trips took several minutes
of wall-clock time in total even though each individual test runs in 2-8 seconds. Nothing
to fix here since the proofs must run in the production build to match the plan's
Playwright setup; just budget for it.

## Takeaway

The `roomsQueryOptions` merge-after-await ordering and the mutation retry's same-payload
guarantee are both exactly the kind of bug a change months from now could silently
reintroduce (swap two argument positions, or "simplify" a `mutationFn` by inlining an id
generator) without any type error to catch it. Both now have a unit or end-to-end test
that fails at a specific, named assertion if that happens again.
