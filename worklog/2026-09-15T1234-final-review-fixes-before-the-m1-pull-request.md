---
title: Final review fixes before the M1 pull request
date: 2026-09-15T12:34:55Z
agent: implementer · claude-opus-5
phase: review
outcome: issue
severity: medium
commits: ['67ee45a', '13055fb', 'a26071f', '6650879', '40b44d7']
related: ['2026-09-15T1114-shared-api-contract-for-rooms-messages-and-events']
---

## What happened

The whole-branch review of M1 asked for fixes before the pull request. Worst: `z.iso.datetime()` accepted any fractional precision while `compareMessages` compares ISO strings, so `10:00:01.900Z` sorted before `10:00:01Z`; room and message `createdAt` now require `precision: 3`, which `Date#toISOString()` always writes. `pnpm worklog:new` defaulted `--agent` to `claude-opus-5`, a label with no role that may name the wrong model, and the schema accepted any string, so the flag is now required and `agent` must match `<role> · <name>`. The M1-T3 entry claimed every edge case was handled and called an `as const` tuple an enum, so it was rewritten from the task's RED errors and test counts, and the FR-5 max-length texts are now asserted. The skill's example no longer teaches `trustProxy: true`, which lets any client spoof `X-Forwarded-For`.

Hardening followed: the Stop hook runs git in `CLAUDE_PROJECT_DIR`, `worklog/README.md` no longer silences the reminder, `pnpm install *` no longer auto-approves new dependencies, `.claude/settings.local.json` is ignored, `packages/shared` has no Node types, Biome keeps `node:*` imports out of the worklog core, CI cancels only superseded pull-request runs, and entries sort by code units instead of `localeCompare`. `AGENTS.md` now explains the hooks other tools lack, the skill says to quote SHAs, and four older entries got accuracy fixes. The lead deferred the remaining minor findings and records them in a separate entry.

## What went well / what didn't

The new tests failed for the right reason first: the timestamp and agent cases with `expected true to be false`, and the `worklog/README.md` case with `expected false to be true`. The same-date sort test passes against the old `localeCompare` in the default `en-US` locale but fails under `LC_ALL=th_TH.UTF-8`, whose collation ignores punctuation, so in CI it guards against a regression rather than proving the bug. A temporary `export const leak = process.env.HOME` in `packages/shared` failed `pnpm typecheck` with `TS2591: Cannot find name 'process'`, and in a scratch clone the Stop hook, run from `packages/worklog` after an unlogged commit, went from exit 0 to exit 2.

## Takeaway

String order is time order only when every timestamp has the same precision, so the contract schema enforces it. A default that guesses who did the work makes the log dishonest: require the label and validate its shape. An entry that claims completeness without quoting evidence can't be checked, and the M1-T3 entry's claims were wrong.
