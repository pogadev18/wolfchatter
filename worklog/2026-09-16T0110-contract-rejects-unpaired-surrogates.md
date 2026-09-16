---
title: Contract rejects unpaired surrogates
date: 2026-09-16T01:10:28Z
agent: implementer · claude-sonnet-5
phase: api
task: M3-T1
outcome: win
commits: []
related: ['2026-09-15T1702-a-typed-nul-escape-becomes-a-real-nul-byte-on-write']
---

## What happened

Closed the M2 review's contract gap: added an `isWellFormed` refine (`String.prototype.isWellFormed()`)
next to the existing `hasNoNul` refine on both `author` and `body` in
`createMessageInputSchema`. Replaced both test files with the brief's versions first and watched
them fail exactly as predicted — `AssertionError: expected undefined to be 'User names cannot
contain unpaired su…'` in the contract test, `expected 201 to be 400` in the API test (`Tests 2
failed | 35 passed (37)`) — then made the three edits and got `Tests 37 passed (37)`. Ran both
break-and-restore proofs from Step 6 (drop the body refine; make `isWellFormed` also reject every
emoji); each produced the exact predicted failure count, message and assertion line, and
`git diff` afterward showed only the three intended edits. `pnpm check` finished at the predicted
counts: 148 tests, 32 valid work-log entries.

## What went well / what didn't

Every predicted output in the brief — RED failure text, GREEN counts, both break-and-restore
failures, `pnpm check` counts — matched on the first attempt; nothing needed debugging or
deviated from the plan. The NUL-escape hazard flagged in the earlier M2 entry (linked above) was
avoided by anchoring all three edits on the neighbouring `/** Body of POST... */` comment and the
two `.refine(hasNoNul, ...)` lines rather than the `hasNoNul` definition itself, so the escape's
six characters never appeared in an Edit call; the brief's own Node NUL-byte check confirmed no
real NUL byte landed. One small judgement call: Step 6's second break writes `isWellFormed`'s
replacement past Biome's 100-column limit as a single line; I pre-wrapped it across two lines
(identical semantics) since the constraints note the format hook would reflow it anyway, and
restored the original one-line form afterward.

## Takeaway

Anchoring Edit calls on text adjacent to a dangerous escape line, instead of the line itself,
continues to be the reliable way to touch `packages/shared/src/messages.ts` safely. When a plan's
proof steps predict exact failure text and counts, matching them precisely on the first try is
itself a signal the code under test has no hidden coupling — any deviation would have been worth
flagging as a finding rather than smoothing over.
