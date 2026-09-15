---
title: Auto-mode classifier blocks a brief-mandated trustProxy true proof step
date: 2026-09-15T17:16:53Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T6
outcome: learning
commits: []
related: ['2026-09-15T1716-rate-limits-proxy-allowlist-cors-and-helmet']
---

## What happened

Task 6's Step 6 asks to temporarily set `app.ts`'s `trustProxy` to `true`, then to `1`, to prove `security.test.ts` catches both misconfigurations, then restore it. Editing the ternary's true-branch to `true` and running `pnpm exec vitest run apps/api/src/http/security.test.ts` got refused before it ran: "Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Security Weaken]." The `1` (hop-count) variant, edited and run the same way right after, was not blocked and reproduced the brief's exact expected failure (`expected 429 to be 201`).

## What went well / what didn't

The `1` half of the proof went cleanly and matched the brief. The `true` half could not be completed. In these two runs the same `vitest run` command was allowed after the `1` edit and refused after the `true` edit, so the refusal seemed to depend on the pending change rather than the command text; two runs cannot show how the classifier actually decides. Per the harness's own instructions to not route around a denial's intent, I restored the correct code directly instead of retrying through another tool or invocation.

## Takeaway

A brief step that asks an agent to write a canonical insecure setting (`trustProxy: true`, permissive CORS, disabled auth) into a real file and then run something, even briefly and immediately reverted, may have the run refused by auto mode, as the `trustProxy: true` step was here. The next agent hitting this: don't fight the classifier, restore the brief's code, and report the gap rather than forcing the command through. Worth a note for whoever writes future briefs — such proof steps may need an interactive session or a "reason about the expected output" substitute instead of "run it and observe."
