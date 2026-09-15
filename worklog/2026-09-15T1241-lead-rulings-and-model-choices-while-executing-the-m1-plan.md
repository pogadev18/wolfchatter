---
title: Lead rulings and model choices while executing the M1 plan
date: 2026-09-15T12:41:13Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
commits: []
related: ['2026-09-15T1234-final-review-fixes-before-the-m1-pull-request']
---

## What happened

M1 ran with one subagent per task and a review after each. The lead checked the plan against itself and the PRD before Task 1; that check and Task 1's report produced eight rulings that amend the committed plan:

- **R1:** Task 5 stopped at its commit. The push and pull request waited for the whole-branch review, so the PR shows reviewed code.
- **R2:** `slugify` strips accents with `/\p{M}/gu`. The plan's regex hid invisible combining characters, probably an artefact of JSON escaping.
- **R3:** each entry's `agent` names the model that did the work, instead of always `claude-opus-5`.
- **R4:** the toolchain-spike entry no longer claims that every surprise went into the Gotchas in `CLAUDE.md`.
- **R5:** M1 has no env schema, although PRD §2 puts env in `packages/shared`. The M2 and M3 plans decide where env validation lives.
- **R6:** CI runs on pull requests and on pushes to `main`, the lead's reading of the PRD's "every PR and push".
- **R7:** the M1-T1 entry, written during Task 2, lists Task 1's commit.
- **R8:** commit trailers name the model that wrote each commit. Task 1's implementer raised this, and the user confirmed it.

Models:
- **Sonnet** implemented Tasks 1, 2, 4 and 5. Task 5 moved from Haiku after the lead pointed out that Haiku's prose would be plainer, and the user chose Sonnet.
- **Haiku** implemented Task 3.
- **Sonnet** reviewed every task.
- **Opus** reviewed the whole branch and made its fixes.

## What went well / what didn't

All five task reviews passed without Critical or Important findings. A live check proved the format hook: a messy file written with Claude Code's Write tool came back formatted. The Stop hook has only been verified with piped JSON; its live check waits for the next session.

What didn't go well: the task reviews compared the code with the plan, not the plan's own judgment. They approved an overclaiming M1-T3 entry, and code the plan itself got wrong. The whole-branch review caught both (see the related entry).

The lead left five findings for later:
- the Stop hook reminding on every stop;
- `git diff --output` being allowed;
- force-push variants missing from the deny rules;
- keeping `pnpm/action-setup@v6`;
- work-log dates that still accept fractional seconds.

Items that need later code, such as `timestamptz(3)` storage and the proxy trust setting, move into the M2 and M4 plans.

## Takeaway

Code verified before planning still needs a fresh whole-branch review. Task reviewers should grade work-log entries against the `worklog` skill's quality bar, not only the schema. Commit rulings to the log when they are made: until this entry, they lived only in the lead's gitignored ledger.
