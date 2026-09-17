---
title: zod v4 runs every check, even after an earlier one failed
date: 2026-09-16T09:36:00Z
agent: lead · claude-opus-5
phase: api
task: M4-T3
outcome: learning
commits: ['f4553d5']
related: ['2026-09-16T0914-six-hardening-findings-for-the-live-api-one-already-solved-b', '2026-09-16T0555-pg-treats-sslmode-require-as-verify-full-until-it-doesn-t']
---

## What happened

M4-T3 added a rule to `apps/api/src/env.ts`: a `DATABASE_URL` pointing anywhere but loopback must
carry `sslmode=verify-full`. It reads as a refinement layered on top of an existing URL check:

```ts
DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, … }).refine(hasVerifiedTlsOrIsLoopback, …)
```

and `hasVerifiedTlsOrIsLoopback` called `new URL(value)` without a guard, on the reasonable-looking
assumption that `z.url()` had already rejected anything unparseable. The task review checked that
assumption instead of sharing it, and found it false. zod v4 runs every check in a schema's list
regardless of whether an earlier one failed, so the refinement executes on arbitrary strings:

```
DATABASE_URL=""            -> TypeError: Invalid URL
DATABASE_URL="somestring"  -> TypeError: Invalid URL
DATABASE_URL  (unset)      -> Error: Invalid environment variables: … (as designed)
```

All five tests written for the new rule used syntactically valid URLs, so none of them went
anywhere near this path.

## What went well / what didn't

The rule exists because of a security downgrade that fails silently (see the related `sslmode`
entry), and it shipped with a failure mode of its own: instead of `parseEnv`'s aggregated message
naming the variable, a malformed value produced a bare `TypeError` with no clue which of the ten
variables caused it. The deploy workflow runs `pnpm db:migrate` with `DATABASE_URL` from a GitHub
secret, so the first person to meet this would have been someone reading a failed CI log — the
worst place to be handed an unreadable stack.

The same file already had the answer twelve lines above: `CORS_ORIGINS`'s refinement uses
`URL.canParse()` before constructing. The new code did not follow the neighbour it was written
next to.

## Takeaway

**A zod refinement must tolerate every input the schema can be handed, including input an earlier
check in the same chain already rejected.** Guard the parse, or use `URL.canParse` — never assume
a previous check short-circuited.

More generally: tests written for a new rule tend to exercise the rule, not the shapes that never
reach it. Both defects the reviews caught today were this same shape — code that was correct for
every input its own tests supplied.
