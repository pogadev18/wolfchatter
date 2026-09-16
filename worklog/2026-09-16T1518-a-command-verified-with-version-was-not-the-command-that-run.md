---
title: A command verified with --version was not the command that runs
date: 2026-09-16T15:18:25Z
agent: implementer · claude-sonnet-5
phase: deploy
task: M4-T6
outcome: issue
severity: high
commits: ['f43330a']
related: ['2026-09-16T1219-pnpm-dlx-netlify-cli-27-7-0-needs-two-fixes-before-it-will-e']
---

## What happened

A live rehearsal of `deploy.yml` — run for real, after the round-1 review had already closed —
found a Critical defect in the Netlify publish step that neither I nor the round-1 review caught:
`netlify deploy --dir dist`, run from `apps/web` exactly as the workflow specifies, resolves
`dist` against the **repository root**, not the working directory. Reproduced directly:

```
$ cd apps/web && … pnpm dlx --allow-build=esbuild --allow-build=sharp --allow-build=unix-dgram \
    --package=netlify-cli@27.7.0 netlify deploy --prod --no-build --dir dist
Deploy path: /Users/pogadev18/Developer/wolfpack-challenge/dist
Error: The deploy directory "/Users/pogadev18/Developer/wolfpack-challenge/dist" has not been found.
```

My own comment on that step said the opposite: "`dist` below resolves relative to it [apps/web]".
That claim was never actually true, and nothing I did would have caught it, because the only
verification I ran against this exact `pnpm dlx` invocation was `netlify --version` — a flag
`deploy --dir` never touches. In the real workflow, this step is **last**: the database had
already migrated and the API had already deployed by the time it fails, so the failure mode is not
"nothing shipped," it's "production now runs the new API against the old web app" — silently, since
every step before this one succeeded.

Fixed by making `--dir` an absolute path: `--dir "$GITHUB_WORKSPACE/apps/web/dist"`.
`working-directory: apps/web` stays — it is what avoids the CLI's separate interactive
workspace-detection prompt (`ERR_USE_AFTER_CLOSE` with no TTY), a different problem the absolute
path does not touch. Rewrote the step's comment to say only what was actually observed: the
working directory avoids the prompt; separately, the CLI resolves `--dir` against the repository
root rather than the working directory, watched happen on a real invocation, cause not
established. Verified locally without an actual deploy (Claude Code's own safety system already
refuses `netlify deploy --prod` as a production-deploy action, correctly, and I did not try to
route around it a second time): built the real web app
(`VITE_API_URL=https://wolfchatter-api.onrender.com pnpm --filter @wolfchatter/web build`), then
confirmed `$GITHUB_WORKSPACE/apps/web/dist` resolves to that real, populated directory
(`index.html`, `assets/`, `favicon.svg`, `_redirects`) while `$GITHUB_WORKSPACE/dist` — what the
old relative `--dir dist` resolved to per the coordinator's report — does not exist on this
checkout at all, matching the reported error exactly.

## What went well / what didn't

"I verified the pin resolves" and "I verified the command runs" were already two different claims
by the time of the original submission's own work log (see the related entry): `netlify-cli@27.7.0
--version` proved the version pin and the `--allow-build`/`--package` fixes were sound, and that
entry's own takeaway said so explicitly. What it didn't do, and what round 1's review didn't
catch either, was extend that same skepticism to the **next** flag in the same command line.
`--version` and `--dir` are both just CLI arguments to the same binary; verifying one told me
nothing about the other, but it was easy to feel like it had, because it was the same pinned
version, the same `--allow-build` flags, the same `--package` fix — everything that had already
required real investigation once already looked settled.

The gap only closed because someone ran the actual `deploy` subcommand for real, against the real
site, with the real flags. No amount of re-reading the YAML, or re-reasoning about
`working-directory` and path semantics in the abstract, would have found this — I had a specific,
plausible, wrong belief about which directory `--dir` resolves against, and the only thing that
tests a belief like that is running the command and reading what it actually printed.

## Takeaway

A command is not verified by verifying a *different invocation* of the same binary, no matter how
much of the invocation is shared. `--version` exercises argument parsing and the binary's own
resolution machinery; it does not exercise `--dir`, or anything else `deploy` alone reads. The
honest scope of "I checked this" is the exact argument list that was actually run, not the family
of commands that share a pin.
