---
title: Workspace and toolchain are green
date: 2026-09-15T10:57:52Z
agent: implementer · claude-sonnet-5
phase: setup
task: M1-T1
outcome: win
commits: ['5cd93fb']
related: []
---

## What happened

Followed the M1 plan's Task 1 steps in order: scaffolded the root workspace (`package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`) and `@wolfchatter/shared` with its first contract piece, `roomChannel(roomId: string): \`room:${string}\``. Commands run: `pnpm install`, `pnpm test` before `realtime.ts` existed (RED), `pnpm check` after implementing it (GREEN), and a deliberate type-check gate experiment. This entry was written during Task 2, from Task 1's commit and its implementer's report.

## What went well / what didn't

`pnpm install` appended three packages to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (`@vitest/mocker@5.0.1`, `@vitest/spy@5.0.1`, `vitest@5.0.1`) — pnpm 12 holding back releases published in the last day — and those were kept rather than reverted, as the plan expected. The gate experiment appended `export const broken: number = 'not a number'` to `realtime.ts` and ran `pnpm typecheck`: it failed with `TS2322` at the exact expected line and `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`, proving `pnpm -r typecheck` really descends into `packages/shared` instead of silently no-op'ing. The line was removed and the file re-read to confirm it matched the plan's original 4 lines byte for byte. `pnpm check` then passed cleanly: Biome found nothing to fix, both `tsc` invocations were silent, and Vitest reported 1 file / 1 test passed.

## Takeaway

A type-check gate is only trustworthy once you've watched it actually fail; wiring `pnpm -r typecheck` into `typecheck` is not enough on its own; the Step 8 experiment is what proved it reaches workspace packages. The `minimumReleaseAgeExclude` lines pnpm writes on install are expected housekeeping from pnpm 12's release-age policy, not something to clean up.
