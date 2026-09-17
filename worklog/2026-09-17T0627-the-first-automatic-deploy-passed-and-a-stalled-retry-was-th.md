---
title: The first automatic deploy passed, and a stalled retry was the hidden browser
date: 2026-09-17T06:27:08Z
agent: lead · claude-opus-5
phase: deploy
outcome: win
commits: ['c097753']
related: ['2026-09-16T1522-the-deploy-rehearsed-by-hand-and-the-step-it-would-have-fail', '2026-09-16T1733-findings-deferred-from-the-m4-whole-branch-review']
---

## What happened

PR #4 merged at 05:46:47Z as merge commit `c097753`. CI passed on `main` at 05:48:53Z, and `deploy.yml` started 3 seconds later from `workflow_run`: the first time the workflow's own YAML ran (run 35187218562). Every step passed, in 1 m 25 s. The migration took 2 seconds, so the `DATABASE_URL` secret passed the TLS rule. The hook returned a deploy id, `/api/health` reported `c097753` 51 seconds later, and the Netlify publish took 5 seconds. The user checked Render's Events and found exactly one deploy for `c097753`, via the hook. So Auto-Deploy is off and the migration really ran first. The live `index.html` loaded exactly the assets in the run's build log, and the devlog's 49 commit SHAs matched the 49 commits that had added entries.

Then the cold start was watched on the live site, after 18 idle minutes: "Waking up the server…" appeared at 3.9 seconds and "Connected" at 35.4 seconds. The first `GET /api/rooms` gave up at its 30-second deadline.

This commit also fixes the three planning-doc inaccuracies that the whole-branch review deferred, and replaces the "about a minute" in the cold-start comments with the measured 33–35 seconds.

## What went well / what didn't

Two results looked wrong, and neither was. The 51-second health wait looked too fast next to the rehearsal's 3 m 13 s. But the lockfile hadn't changed since the rehearsal build, and that rehearsal deploy was started by hand from Render's dashboard. Then no pins appeared for 54 seconds after "Connected", which looked like a broken retry. The in-app browser pane was hidden: `document.visibilityState` was `"hidden"`, and TanStack Query's retryer only continues while `focusManager.isFocused()` (query-core 5.102.8). The retry went out during the next tool batch and loaded 5 pins in 131 ms. On a visible page it would have gone out about a second after the deadline.

Still not exercised: the fork and failed-CI guards, a `head_sha` that differs from the branch tip, and rollback. The check also turned up Netlify's "Powered by Netlify" badge, on by default for Free projects created since 2026-08-19. At phone width it covers the chat panel's Devlog link. Turning it off is a setting in the user's Netlify project, so it was left to them.

## Takeaway

Check a page's visibility before diagnosing a stalled fetch in a browser nobody is looking at. And a suspiciously fast step deserves the same check as a slow one.
