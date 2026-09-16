---
title: "Six M3 carry-overs: a11y status roles, honest failure text, and a
  retryable create notice"
date: 2026-09-16T11:30:11Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T5
outcome: win
commits: []
related: ['2026-09-16T0417-findings-deferred-from-the-m3-whole-branch-review', '2026-09-16T0243-ruling-one-notice-at-a-time-in-the-chat-panel']
---

## What happened

Closed all six defects the M3 whole-branch review deferred to M4 (see the related entry): the five
unscoped `getByRole('status')` locators in `realtime.spec.ts`, scoped to the panel via a new
`connectionStatus()` helper in `e2e/chat.ts` first, and watched stay green before touching anything
else; `role="status"` on the map's chatroom-list failure line; the map banner reading "The chatrooms
could not be loaded" even when a list is already on screen and only a background refresh failed
(now `roomsFailureText`, `panel-view.ts`, picks between that and a new `ROOMS_STALE` — "The chatroom
list may be out of date" — based on whether `rooms.data` is defined); a failed create's notice
growing a **Retry** button that re-sends the exact same id and coordinates; that same notice no
longer sitting over a chatroom the user opened after the failure was already in flight; the message
list only sticking to the bottom when the reader was already there (`stick-to-bottom.ts`); and
`use-room-selection.ts`'s `setSearchParams` calls preserving every query parameter they used to
discard (`room-params.ts`).

The Retry requirement forced the panel's notice to stop being a bare string. It is now
`{ text, retry?, roomId? }` (`panel/notice.ts`), with `roomId` existing for exactly one reason: a
pure `visibleNotice(notice, selectedRoomId)` can hide a notice once a *different* chatroom becomes
selected, without hiding it when the same failure's own `deselectRoom` clears the selection back to
none — those are different outcomes and the first passing test for the create-rejection flow
(`rooms.spec.ts`) already depends on the second one still showing the notice. `RoomChat` and
`MessageForm`'s own notices never set `roomId`, so they are untouched by the new rule and unaffected
by the type change beyond wrapping their strings as `{ text }`.

All six required test-first evidence and got it: a failing run for the right reason, then a passing
one, for every requirement except 1 (a refactor, required to *stay* green, confirmed both before and
after). `pnpm check`'s pieces all pass: lint, full typecheck, 320 unit tests, 48 Playwright specs.

## What went well / what didn't

**A self-inflicted flaky test, caught before it shipped.** My first version of the requirement-3
"stale" test relied on `realtime-sync.ts`'s existing behaviour — every socket `connect`, including
the first one, invalidates the chatroom list — to produce a *second*, distinct GET after the page's
own initial fetch, and mocked that second GET to fail. It passed first try. Sanity-checking the RED
side (temporarily reverting `roomsFailureText` to always return `ROOMS_UNAVAILABLE`) failed with
`element(s) not found` instead of a text mismatch — the map's status banner never appeared at all.
Re-running the original (correct) version showed the same thing intermittently: the initial mount
fetch and the connect-triggered invalidate are two calls to the same TanStack Query cache key, close
enough in time that they sometimes collapse into one real network request, and sometimes don't. My
test's assumption ("loading the page always produces two `/api/rooms` requests") was true often
enough to pass, not true always. Rewrote it to wait for the first successful fetch to render, *then*
force a second one deterministically with `context.setOffline(true)` / `setOffline(false)` — the
same idiom `realtime.spec.ts` already uses for FR-7's reconnect test. Three consecutive runs green,
then RED/GREEN re-confirmed against the final version. A test that passes on the first try is not
evidence it passes for the right reason; the sanity-check RED step is what caught this, not the
original GREEN.

**A live-browser false alarm, traced back to my own tooling.** Trying requirement 5 by hand (per
the brief's acceptance criterion 3), I selected an existing chatroom, killed the API, clicked an
empty map spot to start a doomed create, then clicked back on the first chatroom's *screen
coordinates* from an earlier screenshot. The notice showed up over the reselected chatroom anyway —
looked exactly like the bug requirement 5 exists to fix, still present. Before believing a manual
click over an automated, already-green test, I re-ran it with `find`/`ref`-based clicks instead of
remembered pixel coordinates, and it was clean: no notice, selection held. The actual cause: opening
a chatroom re-centres the map, so a second click at the *old* screen position of an already-selected
pin lands on bare map instead, silently starting a third create — a real one, that also fails, and
*its* rejection was what I was watching leak through, correctly, since nothing had reselected the
first chatroom after it fired. The fix was never wrong; my second click just wasn't hitting what I
thought it was. Also cost me some time before that: `lsof -ti:3000 | xargs kill` does not stop
`node --watch --env-file=.env.example --env-file-if-exists=.env src/server.ts` — `--watch` respawns
the worker `lsof` finds, so the API silently came back. `pkill -f "node --watch.*server.ts"` kills
the supervisor and actually holds the outage.

Confirmed by hand and working correctly: the map's "could not be loaded" banner as `role="status"`
after a full outage; a failed create's notice reading "Couldn't create the chatroom. The server
could not be reached. **Retry**"; clicking Retry after the API came back creating the chatroom for
real, at the original click position; and a failed create's notice *not* appearing over a chatroom
opened before the rejection arrived, once reselection actually targeted the right pin.

## Takeaway

Two different verification steps each caught something the other could not, and neither was the
first green run. The e2e suite's own RED/GREEN discipline caught a test that only sometimes tested
what it claimed to; a live click-through caught nothing about the product, but did catch that a
screenshot's remembered coordinates go stale the moment the map recentres — worth remembering the
next time a manual check disagrees with an automated one that a fresh `find` beats a fixed
coordinate, and the automated result is not automatically the one to doubt.
