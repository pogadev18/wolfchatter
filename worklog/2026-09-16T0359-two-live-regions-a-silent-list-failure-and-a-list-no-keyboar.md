---
title: Two live regions, a silent list failure and a list no keyboard could reach
date: 2026-09-16T03:59:19Z
agent: implementer · claude-opus-5
phase: web
task: M3-T4
outcome: issue
severity: medium
commits: ['e623bbb', '71bbe4d', '12e2cd1', '8beb9f0', '1ba40d8']
related: ['2026-09-16T0243-ruling-one-notice-at-a-time-in-the-chat-panel']
---

## What happened

The whole-branch review found three defects that 228 unit tests and 32 end-to-end tests had all missed.

`app.tsx` and `room-chat.tsx` each owned a notice and each rendered a `role="alert"` — the same shape as the Task 4 ruling, one level up. The easy path: a create fails for good, the app notice appears and the selection clears, the user presses **Back**, `?room=A` returns and `RoomChat` mounts, but the app notice was cleared only in `handleCreateRoom` and `handleSelectRoom`, never by history navigation or the opening URL. A send rejection in A then put two assertive regions on screen. `App` now holds the one notice, `RoomChat` reports upward through `onNotice` as `MessageForm` already reported through `onProblem`, and clears it in a mount effect — the panel keys `RoomChat` by chatroom id, so mounting *is* a room change. Playwright RED: `Expected: 0 Received: 1` for `panel.getByRole('alert')` after `goBack()`.

Nothing read `rooms.isError`: `panelView` returned `{kind:'loading'}` for an undefined list, so a failed `GET /api/rooms` showed an empty map, a permanent "Loading chatroom…" and a confident "Connected" — while `room-chat.tsx` already surfaced `messages.isError`. A new `{kind:'unavailable'}` view says "The chatrooms could not be loaded" in the panel and over the map. And `<ol aria-label="Messages">` scrolled with no `tabIndex`, so outside Chromium a keyboard-only user could not read the history at all (axe `scrollable-region-focusable`, WCAG 2.1.1).

## What went well / what didn't

The keyboard test I wrote first could not fail: `list.focus()` and a keyboard `End` both worked *without* `tabIndex`, because Chromium focuses scroll containers on its own. It went green against the broken code, which is the same trap the M3 plan review kept catching. It now asserts `toHaveAttribute('tabindex', '0')` as well, which does fail.

Worse, my own fix shipped a visual defect: the map's "could not be loaded" line was centred across the whole map, so the floating panel covered its right half on wide screens. No test asserts where it sits, and none would have. I only saw it because I opened the production build in a browser and looked at it (8beb9f0).

## Takeaway

Two of the three bugs were in the plan's own code, and the third was in a file the plan wrote without ever rendering it. All three were found by reading, not by running — and the one I introduced was found by looking, not by asserting. A test that passes before the fix is not a test; check every new assertion against the unfixed code, and look at anything visual in a real browser, because Playwright will happily agree that a covered element is visible.
