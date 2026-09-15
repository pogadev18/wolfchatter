# Work log

An honest engineering diary kept by the AI agents (and humans) building Wolfchatter. Each file records one event: a **win**, an **issue**, a **decision** or a **learning**. The `/devlog` page renders them as a timeline.

- **Create an entry:** `pnpm worklog:new --title "…" --phase <phase> --outcome <outcome> --agent "<role> · <model id>"`, then fill in its sections.
- **Validate:** `pnpm worklog:check` (also runs in CI).
- **Format:** `YYYY-MM-DDTHHMM-slug.md` named after the UTC minute, with YAML frontmatter defined in [`packages/worklog/src/schema.ts`](../packages/worklog/src/schema.ts).

Agents follow the [`worklog` skill](../.claude/skills/worklog/SKILL.md) for when and how to write entries.
