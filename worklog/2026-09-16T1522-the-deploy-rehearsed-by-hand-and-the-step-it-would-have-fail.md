---
title: The deploy rehearsed by hand, and the step it would have failed at
date: 2026-09-16T15:22:00Z
agent: lead · claude-opus-5
phase: deploy
outcome: issue
severity: high
commits: ['f43330a']
related: ['2026-09-16T1518-a-command-verified-with-version-was-not-the-command-that-run', '2026-09-16T1217-ci-catches-migration-drift-and-main-deploys-itself', '2026-09-16T0633-three-trust-proxy-values-before-the-request-log-gave-the-rig']
---

## What happened

The plan meant to rehearse `deploy.yml` by triggering it by hand from `m4-golive` (decision D9).
That was never possible: `workflow_dispatch`, like `workflow_run`, only exists for a workflow file
on the **default branch**. The plan identified that trap for the automatic trigger and wrote D9 as
though the manual one escaped it. The user found it by looking for a Deploy workflow in the Actions
tab and not seeing one. D9 is struck through in the plan rather than rewritten.

So the rehearsal ran each step's real command by hand, in the workflow's order, against the real
providers:

| Step | What ran | Result |
|---|---|---|
| CI | PR #4 on GitHub's runners | green: drift check, full-history checkout, 48 Playwright specs |
| API | Render pointed at `m4-golive`, Manual Deploy | booted under the new TLS rule; `db: "up"` |
| Health | `node apps/api/src/deploy/wait-for-health.ts --commit 5e842d1…` | held through the old commit, resolved when Render served the branch: 18:07:53 → 18:11:06 |
| Build | `VITE_API_URL=… pnpm --filter @wolfchatter/web build` | 321 ms; API origin in the bundle; 44 distinct commit SHAs in the devlog chunk |
| Publish | the workflow's exact `netlify deploy` command, from `apps/web` | **failed**, then published with one argument changed |
| Live | curl, then the app's own browser, then the user in two browsers | all green — below |

The publish failed with `Deploy path: /Users/pogadev18/Developer/wolfpack-challenge/dist` — the
repository root. The step runs from `apps/web`, and its comment said `dist` "resolves relative to
it". It does not. The same command with `--dir "$PWD/dist"` uploaded eight files and went live in
13 seconds. Every automatic deploy would have failed at this step — **after** migrating Neon and
deploying the API, leaving production on the new API and the old web app. `f43330a` fixes the
workflow; the related entry records how a command confirmed with `--version` got that far.

Two smaller findings. Changing a Render service's branch with Auto-Deploy off **deploys nothing**:
`/api/health` kept reporting `main`'s commit until a manual deploy. And a cold start took **33
seconds** twice, against the PRD's "about a minute".

Live verification: 20 of 20 map tiles loaded from `tiles.stadiamaps.com` with none broken, and the
attribution was the watercolor layer's, so the OpenStreetMap fallback never fired; the socket
status read `Connected`; `/devlog` and a filtered devlog URL answered 200 through `_redirects`;
CORS allowed `https://wolfchatter.netlify.app` and sent no allow-origin header for a foreign
origin. The user then confirmed in two browsers that messages and new pins both reach the other
window without a reload, and that the other window's selection does not move.

## What went well / what didn't

The rehearsal found the one defect that no review could see. The `netlify deploy` command had been
through an implementer, a task review on Opus and a scoped re-review, and every one confirmed it by
resolving the binary with `--version`, a flag that never reads `--dir`. Reading the workflow could
not reveal where the CLI resolves a relative path; only running it could.

It also cost a false alarm: a grep for `commit/<sha>` in the built devlog found nothing, because
the page builds its GitHub links at runtime. Grepping the data rather than the URL settled it.

Pointing Render at the branch before merging was worth the extra step. The morning's credential
rotation had the user re-paste `DATABASE_URL`, and T3 turned a wrong value into an API that refuses
to boot. That would now show up as a failed deploy on a branch nobody serves, not as an outage on
`main`.

## Takeaway

**Rehearse the real commands against the real providers, in order.** The failure sat at the last
step of the chain, so only a rehearsal that ran every step before it would reach it. Confirming a
command with a harmless flag proves the binary resolves, and nothing about the arguments that do
the work.

**A deploy trigger that only exists on the default branch cannot be rehearsed from a feature
branch.** The YAML plumbing itself — the SHA resolution, the fork guard, the secret wiring — is
first exercised by the automatic run after the merge, so that run needs watching.
