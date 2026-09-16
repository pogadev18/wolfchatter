---
title: Chat panel with optimistic sends and retries
date: 2026-09-16T02:17:11Z
agent: implementer · claude-sonnet-5
phase: web
task: M3-T4
outcome: win
commits: []
related: []
---

## What happened

Built the message half of the chat: `listMessages`/`createMessage` on the API client, a messages cache that merges pages by id (`compareMessages` order), an outbox derived from TanStack's mutation cache for in-flight and failed sends, `localStorage`-backed username persistence, and `MessageList`/`MessageForm`/`RoomChat` wired into `ChatPanel`. Added `FitToContainer` so Leaflet re-centres when the bottom sheet resizes. Followed the brief's TDD order: failing unit tests, implementation, 5 break-and-restore proofs, failing e2e tests, implementation, 8 more proofs, then `pnpm check`.

## What went well / what didn't

Every one of the 13 break-and-restore proofs failed at exactly the line, assertion and message the brief predicted, with no surprises to report — the scratch-build verification behind this plan held up exactly. The only thing worth flagging as non-obvious: proof 2 for `messagesQueryOptions` (reading the cache before `await api.listMessages(...)`) works because JS evaluates function arguments left to right, so `queryClient.getQueryData(...)` runs synchronously before the `await` even suspends, not because of any timing race.

## Takeaway

The plan's constraint about hanging rejection handling off the mutation's `onError` rather than `mutate`'s own callback, and reading the mutation cache only after `await`, are both easy to get backwards; the brief's proof steps catch exactly those two mistakes if a future change reintroduces them.
