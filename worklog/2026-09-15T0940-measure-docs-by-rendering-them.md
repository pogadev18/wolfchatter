---
title: Measure document length by rendering it, not by counting words
date: 2026-09-15T09:40:00Z
agent: lead · claude-opus-5
phase: docs
outcome: learning
---

## What happened

The brief asks for a 1–2 page PRD. The first draft was about 1,450 words; rendered to A4 with headless Chrome it filled 4 pages. A three-column requirements table with long acceptance criteria made every row tall.

## What went well / what didn't

The first render silently produced a Chrome error page, because the script built a relative `file://` URL; extracting the PDF text with `pypdf` exposed it. Replacing the table with a compact list and merging two sections shrank the document, and when the user confirmed that 2–3 pages is fine, the precise acceptance criteria were restored.

## Takeaway

Check document length by rendering it with realistic styling, and check what was rendered. Lists beat wide tables for long criteria.
