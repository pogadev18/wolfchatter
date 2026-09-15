---
title: Verified the M3 plan in a scratch repository
date: 2026-09-15T21:39:20Z
agent: lead · claude-opus-5
phase: plan
outcome: learning
commits: []
related: ['2026-09-15T2139-toolchain-spike-before-writing-the-m3-plan']
---

## What happened

The lead built all six tasks in order in a scratch clone of `main` (c298211), against Postgres 17 in Docker. The plan's code blocks come from that build. A script then replayed each task's files into a fresh clone and ran every failing step, every property proof and every full check. All of them reproduced, ending at 228 unit tests, 31 end-to-end tests and 38 work-log entries.

The brief also asked for a separate agent to follow the plan word for word. The user skipped that replay after asking why M3 was being coded twice, once to verify and once to execute.

## What went well / what didn't

Building first caught defects that the plan now avoids:

- **The merge test caught the lead's own code.** The rooms merge test failed against the lead's first `queryFn`. `upsertRooms(queryClient.getQueryData(roomsKey), await api.listRooms())` reads the cache before the request is sent, because arguments are evaluated left to right.
- **A hit test that could not fail.** Removing `isolate` did not fail the panel's trial click, because map tiles ignore the pointer. Once the test made tiles hit-testable, tile `5/19/10.jpg` intercepted the click.
- **Pins in the wrong place.** After twelve fast Playwright drags, a pin was drawn 8,611 px from its click. A 100 ms pause before `mouse.up()` fixed it in 3 of 3 runs. Leaflet's inertia is the likely cause, but that is not proven.
- **A label matched two elements.** `getByLabel('Message')` also matched the "Messages" list once messages existed.
- **A possible crash in rendering.** One validation break made `useMutationState`'s selector throw on `.parse`, which would crash the app; the selectors now use `safeParse`.
- **Proofs that failed at the wrong line.** One re-join break also removed the first join, another referenced a variable outside its scope, and a `vi.waitFor` passed on a count that was about to change. Each was rewritten until it failed at the assertion it proves.

What didn't go well: verification took hours with too few status updates, and the user had to ask what was taking so long. The new CI job stays unverified until the pull request runs it.

## Takeaway

A property proof counts only when it fails at the assertion it names, so read the failing line and not just the red result. Estimate verification time up front, and report progress between phases.
