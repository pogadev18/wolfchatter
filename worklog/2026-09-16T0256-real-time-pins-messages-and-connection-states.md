---
title: Real-time pins, messages and connection states
date: 2026-09-16T02:56:56Z
agent: implementer · claude-sonnet-5
phase: realtime
task: M3-T5
outcome: win
commits: []
related: []
---

## What happened

Added the socket layer: `createSocket` (WebSockets only, `autoConnect: false`), a
`useSyncExternalStore` connection-status store, `createRealtimeSync` (refetches rooms and
re-joins the open chatroom on every `connect`, refetching its messages once the join is
acknowledged), `useRealtime`/`useConnectionStatusText`, and `newestArrival` for the polite
announcement. Wired these into `services.tsx`, `main.tsx`, `query-client.ts` (`staleTime:
Infinity`), `chat-panel.tsx` (the `role="status"` line) and `app.tsx`. Wrote the real
Socket.IO `startSocketServer` test double and `apps/web/e2e/realtime.spec.ts`. All 8 unit
break-and-restore proofs and all 7 end-to-end proofs failed at exactly the assertion and
message the brief predicted, so no debugging was needed there. Final `pnpm check`: 33 test
files / 228 unit tests, 32 Playwright tests, `pnpm test:e2e` green on three consecutive runs.

## What went well / what didn't

Went well: every one of the 15 break-and-restore proofs matched the brief's predicted
failure line for line on the first try. The one real judgment call was `room-chat.tsx`: the
brief's own code block predates the Task 4 fix that gave the panel a single `notice` state
reported through `MessageForm`'s `onProblem` prop, so pasting it verbatim would have
reintroduced the two-alert bug. I merged the brief's new `useArrivalAnnouncement`/live-region
addition onto the already-fixed file instead. The brief also says to "keep it `role="status"`
(polite)" for the new live region, which read as if it wanted a literal `role="status"`
attribute; doing that would have given the page two `role="status"` elements and broken
`getByRole('status')` in the connection-status assertions. Proof 5 (delete
`{announcement.text}`) and proof 6 (hard-code `'Connecting…'`) each found exactly one element
for their selector, confirming `aria-live="polite"` with no `role` — as the brief's literal
JSX already showed — was the correct reading, and the parenthetical was just naming "polite"
by example rather than prescribing the attribute.

## Takeaway

When a brief's quoted code block predates a documented fix to that same file, treat the
fix's description as the authority and re-derive the merge instead of pasting the block
verbatim. The break-and-restore proofs are also a good cross-check for that kind of judgment
call: if the merge had been wrong, proof 5 or 6 would have failed against a second
`role="status"` element instead of the predicted message.
