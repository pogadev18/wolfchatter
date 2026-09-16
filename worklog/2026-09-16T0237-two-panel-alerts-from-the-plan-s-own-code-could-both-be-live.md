---
title: Two panel alerts from the plan's own code could both be live at once
date: 2026-09-16T02:37:01Z
agent: implementer · claude-sonnet-5
phase: web
task: M3-T4
outcome: issue
severity: medium
commits: []
related: ['2026-09-16T0217-chat-panel-with-optimistic-sends-and-retries']
---

## What happened

Review found that `MessageForm`'s validation `problem` and `RoomChat`'s send `rejection` were two independent `role="alert"` regions, both taken verbatim from the M3-T4 brief. `rejection` cleared only inside `onSend`, which a validation failure never reaches, so a stale rejection and a new problem could both render at once — two assertive live regions announcing over each other, which the suite's own singular `panel.getByRole('alert')` locator had been silently assuming away. Reproduction: a permanently rejected send, then a submit that fails client-side validation.

## What went well / what didn't

Fixed by giving the panel one owner: `MessageForm` now reports a problem upward through a new `onProblem` prop instead of rendering its own alert, and `RoomChat` holds a single `notice` state that both `onRejected` and `onProblem` write to, rendering one `<p role="alert">`. Wrote the regression test first against the unfixed code and watched it fail with `Expected: 1, Received: 2` on `toHaveCount`, confirming the exact defect before touching the components.

## Takeaway

A brief's code blocks are not proof against cross-component interaction bugs: each alert was correct in isolation, and the plan's own proof steps never combined them. `pnpm check` now covers 27 end-to-end tests instead of 26.
