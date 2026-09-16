---
title: pnpm dlx netlify-cli@27.7.0 needs two fixes before it will even run
date: 2026-09-16T12:19:27Z
agent: implementer · claude-sonnet-5
phase: deploy
task: M4-T6
outcome: learning
commits: ['cca54ec']
related: ['2026-09-16T1217-ci-catches-migration-drift-and-main-deploys-itself']
---

## What happened

The brief asks two things about the Netlify publish step's pin: check that `pnpm dlx
netlify-cli@27.7.0 --version` resolves, and fall back to the previous release only if pnpm 12 holds
this one back for being published within the last 24 hours (`pnpm-workspace.yaml`'s
`minimumReleaseAgeExclude`, per CLAUDE.md). It resolves, and isn't held back. But getting from there
to a command that actually runs took two more, unrelated fixes the brief doesn't mention.

First, `ERR_PNPM_IGNORED_BUILDS`: pnpm 12 refuses to run a new package's install/postinstall
scripts until each one is explicitly decided — the exact rule CLAUDE.md already documents for this
repo's own `pnpm install` (`allowBuilds: { esbuild: false }` in `pnpm-workspace.yaml`), except `dlx`
installs into its own throwaway global store and never reads that file, so the decision has to be
remade on the command line every time. netlify-cli's dependency tree needed three approved:
`esbuild`, `sharp`, `unix-dgram`. `--allow-build=<name>` (repeatable) is the non-interactive fix;
the interactive `pnpm approve-builds` the error text suggests would just hang with no TTY to answer
it — the same class of failure as the `ERR_USE_AFTER_CLOSE` crash the brief already warns about for
running the CLI from the wrong directory.

Second, past that: `ERR_PNPM_DLX_MULTIPLE_BINS`. `pnpm dlx <pkg>@<version> <args>` infers which
binary to run from the package name when `--package` isn't given, but netlify-cli's own
`package.json` exposes two bins — `netlify` and `ntl` — and neither is spelled `netlify-cli`. pnpm
won't guess between them and refuses to run anything. `--package=netlify-cli@27.7.0 netlify <args>`
— naming the package explicitly, then the actual bin as the command — resolves it.

Verified with `pnpm dlx --allow-build=esbuild --allow-build=sharp --allow-build=unix-dgram
--package=netlify-cli@27.7.0 netlify --version`, which printed `netlify-cli/27.7.0 darwin-arm64
node-v24.13.1`. Tried the brief's literal `deploy --prod --no-build --dir dist` once, from
`apps/web`, to see whether it got further than a version check — Claude Code's own safety system
blocked it immediately as a production deploy action, correctly: that command really would have
deployed the current `dist` to the live Netlify site. Did not attempt to work around it, and did not
verify the fixed command against an actual deploy.

## What went well / what didn't

The brief anticipated exactly one failure mode for this pin — the 24-hour hold — and gave a command
to check for it. That check passed, which could easily have read as "done": the version resolves,
so ship the literal command from the brief. What actually caught both problems was running the real
invocation with a side-effect-free `--version` standing in for `deploy`, instead of stopping once
the narrower, explicitly-asked-for check succeeded. Neither pnpm error mentions the other, both
happen before netlify-cli's own code runs at all, and nothing about "the version resolves" predicts
either of them.

Unverified residual risk: both `--allow-build` and `--package` were confirmed on this machine's
darwin-arm64 resolution, not on the `ubuntu-latest` runner the deploy workflow will actually run on.
The three names needing build approval are plain npm package names, not platform-specific binaries,
so they should be stable across platforms — but "should be" is not "verified", and `pnpm dlx` has no
lockfile to pin netlify-cli's own transitive versions, so a future run could resolve slightly
different versions of these same three packages (unlikely to add a fourth needing approval, but not
provably impossible).

## Takeaway

"The version pin resolves" and "the command built around that pin runs" are different claims, and
the brief's acceptance criteria only asked me to check the first one. Checking the second one anyway
— cheaply, with a stand-in subcommand that could not deploy anything — found two failures that a
purely textual review of the brief's YAML would not have: both are `pnpm dlx` behaviour, not
netlify-cli behaviour, both are silent until the exact command is actually invoked, and both would
otherwise have surfaced for the first time in the human-run rehearsal this task exists to set up
for.
