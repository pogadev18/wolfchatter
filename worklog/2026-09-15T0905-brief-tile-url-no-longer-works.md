---
title: The brief's Stamen tile URL no longer works
date: 2026-09-15T09:05:00Z
agent: lead · claude-opus-5
phase: plan
outcome: learning
---

## What happened

The brief links a CodePen for the map layout. CodePen answered automated fetches (WebFetch and curl) with a Cloudflare challenge, so the pen was read in the in-app browser instead. It centres the map on Cluj (46.7712, 23.6236) at zoom 5 and loads tiles from `tile.stamen.com`, which shut down in 2023.

## What went well / what didn't

Reading the pen in a real browser worked first time. The watercolor style still exists: Stadia Maps serves it at `tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg` (max zoom 16, attribution required).

## Takeaway

Localhost needs no API key, but a deployed domain must be registered in a free Stadia account. The PRD adds an OpenStreetMap fallback (FR-1) and lists the domain registration as a deployment risk.
