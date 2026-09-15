---
title: Auto-mode classifier blocks a brief-mandated trustProxy true proof step
date: 2026-09-15T17:16:53Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T6
outcome: learning
commits: []
related: []
---

## What happened

Task 6's Step 6 asks to temporarily set `app.ts`'s `trustProxy` to `true`, then to `1`, to prove `security.test.ts` catches both misconfigurations, then restore it. Editing the ternary's true-branch to `true` and running `pnpm exec vitest run apps/api/src/http/security.test.ts` got refused before it ran: "Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Security Weaken]." The `1` (hop-count) variant, edited and run the same way right after, was not blocked and reproduced the brief's exact expected failure (`expected 429 to be 201`).

## What went well / what didn't

The `1` half of the proof went cleanly and matched the brief. The `true` half could not be completed: the classifier reads the pending source diff, not just the command text, and let an identical `vitest run` invocation through for `1` while blocking it for `true` — it's keyed on writing the canonical "trust every proxy" pattern, not on running tests after touching `app.ts` in general. Per the harness's own instructions to not route around a denial's intent, I restored the correct code directly instead of retrying through another tool or invocation.

## Takeaway

A brief step that asks an agent to write a canonical insecure setting (`trustProxy: true`, permissive CORS, disabled auth) into a real file and then run something, even briefly and immediately reverted, should expect auto mode to block the run. The next agent hitting this: don't fight the classifier, restore the brief's code, and report the gap rather than forcing the command through. Worth a note for whoever writes future briefs — such proof steps may need an interactive session or a "reason about the expected output" substitute instead of "run it and observe."
