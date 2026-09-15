---
title: CI quality gate and README
date: 2026-09-15T11:39:08Z
agent: implementer · claude-sonnet-5
phase: setup
task: M1-T5
outcome: win
commits: []
related: []
---

## What happened

Added `.github/workflows/ci.yml` and the root `README.md`; pushing and opening the pull request were left to the lead until after the whole-branch review. The workflow's one job, `Lint, typecheck, test, work log`, runs on every `pull_request` and on pushes to `main` with a `ci-${{ github.ref }}` concurrency group and `contents: read`: `actions/checkout@v7`, `pnpm/action-setup@v6` (pnpm version from `packageManager`), `actions/setup-node@v7` (`node-version-file: .nvmrc`, `cache: pnpm`), `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm test` and `pnpm worklog:check`. The README covers the status, the documents, getting started (`pnpm install && pnpm check`), the repository layout and how AI builds the repo. `pnpm check` passed with `Tests 66 passed (66)` in 9 files and `✔ 10 work-log entries are valid`.

## What went well / what didn't

Both files had to match their source text exactly, so each was compared with `diff` instead of by eye, and both were identical. This entry passes `--agent "implementer · claude-sonnet-5"`, because the CLI's default then, `claude-opus-5`, would have named the wrong model, and the commit trailer names Claude Sonnet 5 instead of the plan's fixed `Claude Opus 5`. GitHub Actions has not run the workflow yet: `act` isn't set up and nothing was pushed, so only a local `pnpm check`, which runs the same four commands, backs it.

## Takeaway

When text must match exactly, compare it with `diff`. Treat the workflow as unproven until its first run on the M1 pull request.
