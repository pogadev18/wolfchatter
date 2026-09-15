---
title: Toolchain spike before writing the M1 plan
date: 2026-09-15T10:00:00Z
agent: lead · claude-opus-5
phase: setup
outcome: learning
---

## What happened

pnpm 12, TypeScript 7, Vitest 5 and Biome 2.5 were all released after the agent's knowledge cutoff, so a throwaway workspace was built in the scratchpad before writing the M1 plan: install, typecheck, test, lint, and a `.ts` CLI run directly by Node 24. M1 itself was then built task by task in the scratchpad so the plan only contains verified code.

## What went well / what didn't

Worked: Vitest 5 `projects`, zod 4 (`z.uuid`, `z.iso.datetime`, trimming before length checks) and Node 24 running TypeScript files directly, even across workspace packages. Surprises: TypeScript 7 defaults `types` to `[]`, so tests failed on `crypto` until `"types": ["node"]`; TypeScript 7 has no programmatic API, so typescript-eslint can't run; Biome defaults to tabs and double quotes and deprecates `rules.recommended` in favour of `preset`; pnpm 12 holds back packages published in the last day and writes `minimumReleaseAgeExclude` into `pnpm-workspace.yaml`; the global pnpm 9.6 ignored the `packageManager` pin and hung on install.

## Takeaway

Upgrading to pnpm 12 is a prerequisite for M1, and the surprises that later tasks could hit again go into the Gotchas section of `CLAUDE.md`.
