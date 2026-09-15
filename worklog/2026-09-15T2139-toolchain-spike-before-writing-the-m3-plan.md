---
title: Toolchain spike before writing the M3 plan
date: 2026-09-15T21:39:19Z
agent: lead · claude-opus-5
phase: setup
outcome: learning
commits: []
related: ['2026-09-15T1904-findings-deferred-from-the-m2-whole-branch-review']
---

## What happened

React 19.3, Vite 8.3, react-leaflet 5, Tailwind 4.3, React Router 8.3, TanStack Query 5.102 and Playwright 1.63 are all newer than the lead's training data. Before planning M3, the lead built a throwaway web package in a clone of `main` and exercised each tool. The spike covered install, typecheck, lint and build, a Vitest test against a real Socket.IO server, and Playwright runs against the M2 API.

## What went well / what didn't

Surprises that the plan now handles:

- **React Router is at 8.** It is ESM-only and `react-router-dom` is gone. 8.4.0 had been published that afternoon, inside pnpm 12's 24-hour hold, so the plan pins 8.3.1.
- **Biome blocks Tailwind.** Biome 2.5 stopped on `@theme` with `Tailwind-specific syntax is disabled` until `css.parser.tailwindDirectives` was turned on.
- **Playwright's start order.** Its runner starts web servers before `globalSetup` (`createGlobalSetupTasks` in `lib/runner/index.js`), so a database prepared in `globalSetup` would come too late for the API.
- **Leaflet's events.** A double-click arrived as `click` (detail 1), `click` (detail 2), then `dblclick`, and a drag fired no `click`. A click after panning twice round the world reported longitude 723.71, and a marker with no click handler passed its click on to the map.
- **Simulating the network.** `context.setOffline(true)` closed the socket at once (`transport close`). A routed WebSocket held open left the client connecting, as a cold start would.
- **Vite and Ctrl+C.** Vite 8 exits on SIGINT instead of handling it, so Ctrl+C on `pnpm dev` ends with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`, although both servers stop.
- **The M2 surrogate finding.** Against the M2 API, a message with a lone surrogate got 201, came back with U+FFFD, and the identical retry got 409. That confirmed the M2 review's finding.

Three probes went wrong before they told me anything:

- My first routed-socket probe closed with code 1006, which a close frame cannot carry, so it proved nothing until I reran it.
- A `pnpm add` failed because zsh expanded `workspace:*`.
- A SIGINT sent to pnpm alone left both servers running. A terminal's Ctrl+C signals the whole process group.

## Takeaway

For ordering questions such as web servers against `globalSetup`, read the tool's source instead of guessing from the docs. The surprises that later tasks could hit again are listed for `CLAUDE.md`'s gotchas in Task 6 of the plan.
