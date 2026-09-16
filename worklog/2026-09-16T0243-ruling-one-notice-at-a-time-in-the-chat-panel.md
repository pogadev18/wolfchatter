---
title: "Ruling: one notice at a time in the chat panel"
date: 2026-09-16T02:43:41Z
agent: lead · claude-opus-5
phase: web
task: M3-T4
outcome: decision
commits: []
related: ['2026-09-15T2139-verified-the-m3-plan-in-a-scratch-repository']
---

## What happened

Task 4's review found a defect in the plan's own code: `RoomChat` held a `rejection` alert and `MessageForm` a `problem` alert, two `role="alert"` regions in one panel. `rejection` was cleared only when a send started, and a client-side validation failure returns before that, so rejecting a message and then mistyping the next one left both alerts live.

The lead read both files, confirmed the path, and ruled the finding stands over the plan: the panel gets one notice with one owner, and a Playwright test covers reject then invalid. Task 4 Step 5 of the plan is superseded. The end-to-end count rises by one, so Task 5 ends at 32 rather than 31.

The re-review then found the same shape one level up, between `app.tsx`'s create-failure notice and the chatroom's own. That one is left to the whole-branch review, together with a **Retry** click that does not clear a stale notice.

## What went well / what didn't

The plan was built and replayed in a scratch repository, and this still got through: both alerts were reachable, but no test put them on screen together. A reviewer reading the code found in one pass what running it had not.

## Takeaway

Verification that only replays a plan proves the steps work, not that the design is right. Keep the task review as the place where the plan itself is judged.
