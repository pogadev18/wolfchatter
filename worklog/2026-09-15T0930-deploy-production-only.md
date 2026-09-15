---
title: Deploy production only and describe staging on paper
date: 2026-09-15T09:30:00Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
---

## What happened

The first design had a live staging environment with a promotion workflow. The user asked whether the brief requires it. It doesn't: the "at least 2 environments" rule belongs to the infrastructure and cost estimate, which the brief says needs no real deployment.

## What went well / what didn't

Questioning the scope removed a Render service, a Neon branch, a promotion workflow and per-environment config before any of it was built. PR preview deploys were dropped too, because they would have written test data into the production database.

## Takeaway

When CI passes on `main`, a GitHub Actions pipeline deploys the API to Render, waits for `/api/health` to report the new commit, then deploys the web app to Netlify. Staging will be described in `docs/INFRASTRUCTURE.md` (M4).
