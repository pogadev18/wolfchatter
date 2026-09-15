---
name: worklog
description: Record a work-log entry in worklog/. Use after finishing any plan task, after a failed attempt or surprising bug, and after any non-obvious decision. Entries are validated in CI and rendered on the /devlog page.
---

# Work log

The work log is the project's engineering diary. The `/devlog` page turns it into a timeline, so write for a reviewer who wants to know what really happened, including what went wrong.

## When to write an entry

| Situation | Outcome |
|---|---|
| You finished a plan task | `win` (or whichever outcome fits better) |
| Something failed, broke or surprised you | `issue`, with `--severity low\|medium\|high` |
| You chose between alternatives | `decision` |
| You learned something the next agent should know | `learning` (and consider adding it to Gotchas in CLAUDE.md) |

When you fix an earlier issue, add `related: [<issue entry id>]` to the new entry so the devlog links them.

## How

1. Create the file:

   ```bash
   pnpm worklog:new --title "Socket event arrived before the HTTP response" \
     --phase realtime --outcome issue --severity medium --task M2-T6 \
     --agent "implementer · claude-opus-5"
   ```

   Phases: `plan`, `setup`, `api`, `web`, `realtime`, `testing`, `deploy`, `docs`, `review`. Agent: `<role> · <model id>`, naming the model that did the work, such as `lead · claude-opus-5` for the main session, `implementer · claude-sonnet-5` or `reviewer · claude-sonnet-5` for subagents, and `human · <name>` for people.

2. Open the printed path and fill in all three sections: **What happened**, **What went well / what didn't**, **Takeaway**.
3. Run `pnpm worklog:check`.
4. Commit the entry in the same commit as the work it describes.

## Quality bar

- **Specific:** quote the command, the error message and the root cause. "`tsc` failed with `Cannot find name 'crypto'` because TypeScript 7 defaults `types` to `[]`" beats "fixed type errors".
- **Honest:** record mistakes and dead ends, including your own.
- **Short:** a few sentences per section.
- **Linked:** `related` for earlier entries, `commits` for earlier commits (the entry's own commit is found from its file history). Quote SHAs, as in `commits: ['1234567']`: YAML reads an all-digit SHA as a number, which fails the check.

## Example

```markdown
---
title: Rate limiter counted every client as one IP
date: 2026-09-16T11:20:00Z
agent: implementer · claude-opus-5
phase: api
task: M2-T5
outcome: issue
severity: medium
commits: []
related: []
---

## What happened

The 429 integration test passed locally, but behind Render's proxy every request carried the proxy's IP, so all users shared a single rate-limit bucket.

## What went well / what didn't

The test caught the limit itself, but it could not catch proxy behaviour, because `inject()` has no proxy in front of it.

## Takeaway

Fastify now trusts only the proxy in front of the API instead of `trustProxy: true`, which trusts every hop and lets any client spoof `X-Forwarded-For`. Tests prove that separate clients get separate buckets and that a spoofed header still hits the limit.
```
