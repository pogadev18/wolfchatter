---
title: "Web resilience: an error boundary, a request timeout, and a .env-aware
  build check"
date: 2026-09-16T10:08:44Z
agent: implementer · claude-sonnet-5
phase: web
task: M4-T4
outcome: win
commits: ['bbe5b5e', '5cedf20', 'fe72ac4']
related: ['2026-09-16T1033-a-10-second-default-timeout-couldn-t-cover-the-cold-start-it']
---

## What happened

Three findings the M3 review deferred to this milestone, all inside `apps/web`.

1. **Error boundary.** `app-error-boundary.tsx`: a class component (`getDerivedStateFromError` +
   `componentDidCatch`, both required — React has no hook for this) wrapping the whole tree in
   `main.tsx`, one level inside `StrictMode`. It shows one constant, honest sentence ("Something
   went wrong and this page can't recover from it. Reloading usually fixes it.") regardless of what
   was thrown, plus a Reload button, and logs the real error with `console.error` so it isn't
   swallowed. `boundaryMessage` deliberately ignores its `error` argument; `boundaryMessage.test.ts`
   (in `app-error-boundary.test.ts`) asserts the same string comes back for an `Error`, a thrown
   string, `undefined` and a plain object — a regression test for "don't pretend to know what went
   wrong," not a trivial constant check.

   Placement: outside every provider (`ServicesProvider`, `QueryClientProvider`, `BrowserRouter`),
   not just around `<Routes>`. First draft put it directly around `<Routes>`, inside the providers.
   Reconsidered before committing: recovery here is `window.location.reload()`, which restarts
   *everything* regardless of where the boundary sits, so narrower placement buys nothing and costs
   the (unlikely, never seen, not provably impossible) case of one of those providers throwing
   during render — which, with the narrower placement, would blank the page with nothing above it
   to catch the throw, i.e. exactly the bug this task exists to close. Moved it outside all three.
   It still sits above the `Suspense` guarding the lazy `/devlog` chunk, which matters because
   Suspense only catches a *pending* import, not a *failed* one — a chunk that fails to load throws
   past Suspense like any other render error and needs the boundary to turn into a message instead
   of a blank page.

   Testing, as the plan accepts: rendering the boundary needs jsdom and a component-testing
   library, which this repo deliberately doesn't have. `getDerivedStateFromError` and
   `boundaryMessage` are both plain functions callable with no DOM, so those are unit-tested
   directly (6 tests); the actual `render()`/JSX path is covered by inspection only, not a test.
   Saying that plainly rather than dressing it up.

2. **Request timeout.** `client.ts`: a `timeoutSignal(ms)` helper (`AbortController` + `setTimeout`,
   not `AbortSignal.timeout`) gives every request a 10 s deadline by default, overridable through a
   new `ApiClientOptions` (`{ fetchFn?, timeoutMs? }`) — the same options-object shape `createSocket`
   already uses, not a positional parameter. `request()` now always builds an `init` object (even a
   GET gets `{ signal }`) and clears the timer in a `finally`, so a request that settles normally —
   success or a thrown `ApiRequestError`/`ZodError` — never leaves a timer running.

   This changed `createApiClient`'s public shape, so every existing call in `client.test.ts` that
   passed `fetchFn` positionally had to become `{ fetchFn }` in the same edit as the three new
   timeout tests. Watched RED first: all 7 affected tests failed together, 5 of the old ones with
   `TypeError: fetchFn is not a function` (the old code tried to call the options object as a
   function) and the 2 new behavioural ones for the missing timeout logic itself — one shared,
   correct reason, not scattered ones. After the change, `pnpm exec vitest run
   apps/web/src/api/client.test.ts` went to 17/17. The new tests drive a mocked `fetchFn` that never
   settles on its own but does honour its signal (mirroring what a real `fetch` does), fire the
   timeout with `vi.advanceTimersByTime`, and check `vi.getTimerCount() === 0` after a normal
   response — no test waits any real seconds. `isTemporaryFailure`/`isPermanentFailure` needed no
   change: a timeout's rejection is never an `ApiRequestError`, so it already falls out as
   temporary; a test pins that down instead of only asserting it by reasoning.

3. **`loadEnv` in `vite.config.ts`.** Swapped `parseWebEnv(process.env)` for
   `parseWebEnv(loadEnv(mode, WEB_DIR, 'VITE_'))`, `WEB_DIR` being
   `dirname(fileURLToPath(import.meta.url))` (matching `plugins/worklog.ts`'s existing idiom — ESM
   has no `__dirname`). Left `plugins: [...]` and `build: {...}` untouched, as required; the only
   other change is `({ command }) => …` growing a `mode` for `loadEnv` to consume.

   Precedence: read Vite 8.3.0's actual `loadEnv` source rather than trusting the docs
   (`node_modules/vite/dist/node/chunks/node.js:5705`). It fills `env` from the parsed `.env*`
   files first (line 5728), then, as its very last step before returning (line 5730), does
   `for (const key in process.env) if (prefixes.some(p => key.startsWith(p))) env[key] =
   process.env[key]` — an unconditional overwrite of every `VITE_`-prefixed key from the real
   `process.env`, after the file values are already in place. So real environment variables always
   win over file values, confirmed from the implementation rather than assumed. This is exactly
   what the existing `if (command === 'serve') process.env.VITE_API_URL ??= DEV_API_URL` line
   depends on to keep working unchanged: it still mutates `process.env` directly (not a local
   `loadEnv` result), because Vite's *own*, separate internal env population for the dev server's
   `import.meta.env` also reads real `process.env` first — removing that mutation would have kept
   our own validation happy while leaving the actual dev server without a default.

`pnpm check` passes end to end: lint, both typechecks, 302 Vitest tests across 39 files, all 43
Playwright specs, 52 valid work-log entries.

## What went well / what didn't

Acceptance criterion 3 asks for two real `pnpm --filter @wolfchatter/web build` runs, one with
`VITE_API_URL` in `apps/web/.env.production` and one with no value anywhere. The second ran exactly
as specified and failed with the intended message. The first could not: this repository's own
`.claude/settings.json` denies reading *and* writing `.env`, `.env.local`, `.env.*.local`,
`.env.development`, `.env.test` and `.env.production` — a tool permission, not a request I could
argue around, so I didn't try alternate ways to write that exact path. Used `apps/web/.env.staging`
instead (not in the deny list) with `pnpm --filter @wolfchatter/web build --mode staging`, which
runs the identical `loadEnv(mode, WEB_DIR, 'VITE_')` line against a real `.env.<mode>` file — same
mechanism, different mode name. Confirmed the build both succeeded and actually used the file's
value (grepped the built bundle for a distinctive URL, after a first attempt at this check gave a
false positive: `https://api.example.com` is *also* the literal example string baked into
`env.ts`'s own error message, so it shows up in every build regardless of the real value — had to
switch to an obviously-fake, distinctive URL to tell the two apart). Also rebuilt with a real
`VITE_API_URL` env var set to a third, different value while the file was still in place, and
confirmed the bundle carried the env var's value and not the file's — the precedence claim above,
proven end to end rather than only read from source. Literal `.env.production` itself is unverified
by me; a human (or a session without this restriction) re-running the two commands from the brief
would take under a minute and would remove the last bit of doubt.

The boundary's placement (see above) is the one design decision I reversed mid-task: shipped it
around `<Routes>` first, matching the brief's literal wording most closely, then talked myself out
of it before committing once I asked what a full-page reload actually buys you regardless of
placement. Recording it here rather than only in the diff because "wraps both routes" undersells
what actually protects the most against the bug being fixed.

## Takeaway

Two things were worth checking against the actual installed code instead of trusting a description
of it: `loadEnv`'s precedence (confirmed by reading Vite's own source, not the docs, and then again
by grepping a real build's output for which of two distinct URLs won) and my own first build
verification, which silently passed for the wrong reason until a distinctive fixture value caught
it. A permission boundary blocking the literal `.env.production` file is a good rule on its own
terms — it stops exactly the kind of accident where a real secret gets read or overwritten by an
agent — and the honest response to hitting it was to prove the same code path a different way and
say so, not to find a way around the specific file it names.
