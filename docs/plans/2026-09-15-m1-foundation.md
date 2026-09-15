# M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the pnpm workspace, the shared API contract, the work-log tooling, the agent configuration and CI that every later milestone builds on.

**Architecture:** Two workspace packages ship as TypeScript source with no build step. `@wolfchatter/shared` holds the zod contract for REST payloads, errors and socket events; `@wolfchatter/worklog` holds the work-log schema, parser, validator and CLIs. Node 24 runs the CLIs and the Claude Code hooks directly through type stripping, `tsc --noEmit` only checks types, and CI runs the same pnpm scripts developers run locally.

**Tech Stack:** Node.js 24 LTS · pnpm 12.4.1 · TypeScript 7.0.2 · Biome 2.5.13 · Vitest 5.0.1 · zod 4.6.5 · yaml 2.9.1 · GitHub Actions

**Spec:** [docs/PRD.md](../PRD.md). Roadmap: [docs/plans/README.md](README.md).

**How this plan was verified:** every task was built in order in a scratch repository before this plan was written. Each code block below is that verified code, already formatted by Biome, and each "Expected" output was observed there.

## Global Constraints

- Node.js `>=24.11.0` (`.nvmrc`: `24`). TypeScript runs through Node's type stripping: erasable syntax only, and relative imports keep their `.ts` extension.
- pnpm `12.4.1`, pinned in `packageManager`. Never name a script after a built-in pnpm command such as `setup`.
- TypeScript `7.0.2` in strict mode, checked with `tsc --noEmit` per package. No tools that need the TypeScript API.
- Biome `2.5.13`: 2-space indent, single quotes, no semicolons, 100 columns, `preset: recommended`.
- Vitest `5.0.1` with root `projects`. Tests sit next to the code as `*.test.ts`; tests tied to a requirement start with `FR-n:`.
- zod `4.6.5`, yaml `2.9.1` and `@types/node` `24.13.4`, all pinned exactly.
- Package names are `@wolfchatter/<name>`; workspace dependencies use `workspace:*`.
- Message limits from the PRD: author 1–32 and message 1–1000 characters, after trimming.
- Conventional Commits. Every commit message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- From Task 2 on, every task commits at least one `worklog/` entry together with its work.
- All work happens on the `m1-foundation` branch. Nothing is pushed to `main`.

## Before you start

- [ ] `pnpm --version` prints `12.4.1` or a later 12.x. If it prints anything older, **stop and ask the user** to run `brew upgrade pnpm`. An older pnpm ignores the version pin and hangs on install.
- [ ] `node --version` prints `v24.11.0` or later.
- [ ] `git branch --show-current` prints `m1-foundation`, and `git status` is clean. The branch already contains this plan.

## File map

| Path | Task | Responsibility |
|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `.nvmrc` | 1, 2, 4 | Workspace, pinned toolchain, root scripts |
| `tsconfig.base.json`, `tsconfig.json` | 1, 4 | Shared compiler options; type-checking root files and hooks |
| `biome.json` | 1 | Lint and format rules, including no `node:*` imports in `packages/shared` |
| `vitest.config.ts` | 1 | Test projects |
| `packages/shared/src/realtime.ts` | 1, 3 | Socket event contract and room channel names |
| `packages/shared/src/rooms.ts` | 3 | Room schema, create-room input, panel title |
| `packages/shared/src/messages.ts` | 3 | Message schema, create-message input, list query, ordering |
| `packages/shared/src/errors.ts`, `health.ts` | 3 | Error and health response shapes |
| `packages/worklog/src/schema.ts` | 2 | Entry frontmatter schema |
| `packages/worklog/src/parse.ts` | 2 | Parse and check a single entry file |
| `packages/worklog/src/validate.ts` | 2 | Check a whole folder of entries |
| `packages/worklog/src/create.ts` | 2 | Build a new entry from CLI options |
| `packages/worklog/src/cli/new.ts`, `check.ts` | 2 | `pnpm worklog:new` and `pnpm worklog:check` |
| `packages/worklog/src/reminder.ts` | 4 | Decide whether the Stop hook should remind the agent |
| `worklog/` | 2+ | Work-log entries and the folder README |
| `CLAUDE.md`, `AGENTS.md` | 4 | Instructions for AI agents |
| `.claude/settings.json`, `.claude/hooks/*.ts` | 4 | Permissions, format-on-edit hook, work-log reminder hook |
| `.claude/skills/worklog/SKILL.md` | 4 | When and how to write work-log entries |
| `.github/workflows/ci.yml` | 5 | CI quality gate |
| `README.md` | 5 | Project overview and quick start |

The tasks are sequential: each one builds on the previous.

---

### Task 1: Workspace and toolchain (M1-T1)

Proves the toolchain end to end with the first real piece of the contract: the Socket.IO channel for a chatroom (PRD §4).

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/realtime.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/realtime.test.ts`
- Generated: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: root scripts `check`, `format`, `lint`, `test` and `typecheck`; the package `@wolfchatter/shared` exporting `roomChannel(roomId: string)`, which returns the template literal type `` `room:${string}` ``.

- [ ] **Step 1: Create the root workspace files**

`package.json`:

```json
{
  "name": "wolfchatter",
  "version": "0.0.0",
  "private": true,
  "description": "Real-time chat on a map",
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": {
    "node": ">=24.11.0"
  },
  "scripts": {
    "check": "pnpm lint && pnpm typecheck && pnpm test",
    "format": "biome check --write .",
    "lint": "biome check .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json && pnpm -r typecheck"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "@types/node": "24.13.4",
    "typescript": "7.0.2",
    "vitest": "5.0.1"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

`.nvmrc`:

```text
24
```

`tsconfig.base.json` holds the compiler options every package extends:

```json
{
  "compilerOptions": {
    "target": "es2024",
    "lib": ["es2024"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  }
}
```

`tsconfig.json` type-checks root-level files:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["vitest.config.ts"]
}
```

`biome.json`. The override stops `packages/shared` from importing Node modules, because the web app will bundle it:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended"
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "overrides": [
    {
      "includes": ["packages/shared/src/**", "!**/*.test.ts"],
      "linter": {
        "rules": {
          "correctness": {
            "noNodejsModules": "error"
          }
        }
      }
    }
  ]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
```

- [ ] **Step 2: Create the `@wolfchatter/shared` package**

`packages/shared/package.json`. The `exports` field points at TypeScript source, so consumers need no build step:

```json
{
  "name": "@wolfchatter/shared",
  "version": "0.0.0",
  "private": true,
  "description": "API and real-time contract shared by the Wolfchatter API and web app",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "24.13.4"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install**

Run: `pnpm install`

Expected: ends with `Done in …s using pnpm v12.4.1`. pnpm 12 holds back packages published in the last 24 hours, so it may append `minimumReleaseAgeExclude` entries (such as `vitest@5.0.1`) to `pnpm-workspace.yaml`. Keep them.

- [ ] **Step 4: Write the failing test**

`packages/shared/src/realtime.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { roomChannel } from './realtime.ts'

describe('roomChannel', () => {
  it('prefixes the room id so room channels never collide with socket ids', () => {
    expect(roomChannel('3f1c2d9e-8a7b-4c6d-9e0f-1a2b3c4d5e6f')).toBe(
      'room:3f1c2d9e-8a7b-4c6d-9e0f-1a2b3c4d5e6f',
    )
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm test`

Expected: FAIL with `Error: Cannot find module './realtime.ts' imported from …/packages/shared/src/realtime.test.ts`.

- [ ] **Step 6: Implement**

`packages/shared/src/realtime.ts`:

```ts
/** Socket.IO room that receives `message:created` events for one chatroom. */
export function roomChannel(roomId: string): `room:${string}` {
  return `room:${roomId}`
}
```

`packages/shared/src/index.ts`:

```ts
export * from './realtime.ts'
```

- [ ] **Step 7: Run the full check**

Run: `pnpm check`

Expected: Biome prints `No fixes applied.`, both `tsc` runs print no errors, and Vitest prints `Test Files  1 passed (1)` and `Tests  1 passed (1)`.

- [ ] **Step 8: Prove the type-check gate reaches the packages**

pnpm 12 doesn't prefix recursive output with package names, so check that `pnpm -r typecheck` really runs inside `packages/shared`. Temporarily append this line to `packages/shared/src/realtime.ts`:

```ts
export const broken: number = 'not a number'
```

Run: `pnpm typecheck`

Expected: `src/realtime.ts(6,14): error TS2322: Type 'string' is not assignable to type 'number'.` and `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`. Delete the line and run `pnpm typecheck` again: no errors.

- [ ] **Step 9: Commit**

There is no work-log entry for this task yet: the tool arrives in Task 2, which records this task too.

```bash
git add .
git commit -F - <<'EOF'
chore: set up pnpm workspace with TypeScript 7, Biome and Vitest

Adds @wolfchatter/shared with the first piece of the contract, roomChannel().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Work-log package and first entries (M1-T2)

Builds the work log behind PRD §6 and FR-8: a validated entry format, a CLI to create entries, a check for CI, and the entries for the planning session and Task 1.

**Files:**
- Create: `packages/worklog/package.json`, `packages/worklog/tsconfig.json`
- Create: `packages/worklog/src/schema.ts`, `parse.ts`, `validate.ts`, `create.ts`, `index.ts`, `cli/new.ts`, `cli/check.ts`
- Test: `packages/worklog/src/schema.test.ts`, `parse.test.ts`, `validate.test.ts`, `create.test.ts`
- Create: `worklog/README.md` and eight entries
- Modify: `package.json` (work-log scripts; `check` also runs the work-log check)

**Interfaces:**
- Consumes: the Task 1 workspace.
- Produces, exported from `@wolfchatter/worklog`:
  - `worklogFrontmatterSchema`, `WORKLOG_PHASES`, `WORKLOG_OUTCOMES`, `WORKLOG_SEVERITIES`, and the types `WorklogFrontmatter`, `WorklogEntry` (`WorklogFrontmatter & { id: string; body: string }`), `WorklogPhase`, `WorklogOutcome`, `WorklogSeverity`
  - `parseWorklogFile(fileName: string, content: string): ParseResult`, where `ParseResult = { ok: true; entry: WorklogEntry } | { ok: false; errors: string[] }`
  - `fileStamp(isoDate: string): string`
  - `validateWorklog(files: readonly WorklogFile[]): WorklogReport`, where `WorklogFile = { name; content }` and `WorklogReport = { entries: WorklogEntry[]; errors: string[] }`
  - `buildEntry(options: NewEntryOptions): { fileName: string; content: string }` and `slugify(title: string): string`
- Produces root scripts: `pnpm worklog:new` and `pnpm worklog:check`.

- [ ] **Step 1: Create the package and install its dependencies**

`packages/worklog/package.json`:

```json
{
  "name": "@wolfchatter/worklog",
  "version": "0.0.0",
  "private": true,
  "description": "Work-log entry schema, parser and CLIs behind worklog/ and the /devlog page",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "24.13.4"
  },
  "dependencies": {
    "yaml": "2.9.1",
    "zod": "4.6.5"
  }
}
```

`packages/worklog/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

Run: `pnpm install`

Expected: `Done in …s using pnpm v12.4.1`.

- [ ] **Step 2: Write the failing schema test**

`packages/worklog/src/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { worklogFrontmatterSchema } from './schema.ts'

const base = {
  title: 'Scaffolded the workspace',
  date: '2026-09-15T14:32:00Z',
  agent: 'implementer · claude-opus-5',
  phase: 'setup',
  outcome: 'win',
}

describe('worklogFrontmatterSchema', () => {
  it('accepts a minimal entry and defaults the link lists', () => {
    expect(worklogFrontmatterSchema.parse(base)).toEqual({ ...base, commits: [], related: [] })
  })

  it('requires a severity for issues', () => {
    const result = worklogFrontmatterSchema.safeParse({ ...base, outcome: 'issue' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['severity'])
  })

  it('accepts an issue with a severity', () => {
    const issue = { ...base, outcome: 'issue', severity: 'high' }
    expect(worklogFrontmatterSchema.safeParse(issue).success).toBe(true)
  })

  it('rejects a severity on other outcomes', () => {
    expect(worklogFrontmatterSchema.safeParse({ ...base, severity: 'low' }).success).toBe(false)
  })

  it.each([
    ['an unknown phase', { phase: 'coding' }],
    ['an unknown outcome', { outcome: 'meh' }],
    ['a malformed task id', { task: 'task 3' }],
    ['a malformed commit', { commits: ['not-a-sha'] }],
    ['a date without a timezone', { date: '2026-09-15T14:32:00' }],
    ['an unknown field', { mood: 'great' }],
  ])('rejects %s', (_case, override) => {
    expect(worklogFrontmatterSchema.safeParse({ ...base, ...override }).success).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run packages/worklog/src/schema.test.ts`

Expected: FAIL with `Error: Cannot find module './schema.ts'`.

- [ ] **Step 4: Implement the schema**

`packages/worklog/src/schema.ts`:

```ts
import { z } from 'zod'

export const WORKLOG_PHASES = [
  'plan',
  'setup',
  'api',
  'web',
  'realtime',
  'testing',
  'deploy',
  'docs',
  'review',
] as const
export const WORKLOG_OUTCOMES = ['win', 'issue', 'decision', 'learning'] as const
export const WORKLOG_SEVERITIES = ['low', 'medium', 'high'] as const

export type WorklogPhase = (typeof WORKLOG_PHASES)[number]
export type WorklogOutcome = (typeof WORKLOG_OUTCOMES)[number]
export type WorklogSeverity = (typeof WORKLOG_SEVERITIES)[number]

const GIT_SHA = /^[0-9a-f]{7,40}$/
const TASK_ID = /^M\d+-T\d+$/

/** Frontmatter of a `worklog/*.md` entry. */
export const worklogFrontmatterSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(120),
    date: z.iso.datetime(),
    agent: z.string().trim().min(1).max(80),
    phase: z.enum(WORKLOG_PHASES),
    task: z.string().regex(TASK_ID, { error: 'task must look like M1-T3' }).optional(),
    outcome: z.enum(WORKLOG_OUTCOMES),
    severity: z.enum(WORKLOG_SEVERITIES).optional(),
    commits: z.array(z.string().regex(GIT_SHA, { error: 'commits must be git SHAs' })).default([]),
    related: z.array(z.string()).default([]),
  })
  .refine((entry) => (entry.outcome === 'issue') === (entry.severity !== undefined), {
    error: 'severity is required for issues and not allowed for other outcomes',
    path: ['severity'],
  })

export type WorklogFrontmatter = z.infer<typeof worklogFrontmatterSchema>

export interface WorklogEntry extends WorklogFrontmatter {
  /** File name without `.md`, e.g. `2026-09-15T0905-stamen-tiles-moved`. */
  id: string
  /** Markdown below the frontmatter. */
  body: string
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm exec vitest run packages/worklog/src/schema.test.ts`

Expected: `Tests  10 passed (10)`.

- [ ] **Step 6: Write the failing parser test**

`packages/worklog/src/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fileStamp, parseWorklogFile } from './parse.ts'

const validContent = `---
title: Stamen tiles moved to Stadia Maps
date: 2026-09-15T09:05:00Z
agent: lead · claude-opus-5
phase: plan
outcome: learning
---

## What happened

The CodePen's tile URL points at tile.stamen.com, which shut down in 2023.
`

describe('fileStamp', () => {
  it('turns an ISO date into the file name prefix', () => {
    expect(fileStamp('2026-09-15T09:05:59Z')).toBe('2026-09-15T0905')
  })
})

describe('parseWorklogFile', () => {
  it('parses a valid entry and derives the id from the file name', () => {
    const result = parseWorklogFile('2026-09-15T0905-stamen-tiles.md', validContent)
    expect(result).toMatchObject({
      ok: true,
      entry: {
        id: '2026-09-15T0905-stamen-tiles',
        title: 'Stamen tiles moved to Stadia Maps',
        outcome: 'learning',
        commits: [],
        related: [],
      },
    })
    expect(result.ok && result.entry.body.startsWith('## What happened')).toBe(true)
  })

  it.each([
    'notes.md',
    '2026-09-15-stamen.md',
    '2026-09-15T0905-Stamen_Tiles.md',
    '2026-09-15T0905-stamen.txt',
  ])('rejects the file name %s', (fileName) => {
    expect(parseWorklogFile(fileName, validContent)).toEqual({
      ok: false,
      errors: ['file name must look like 2026-09-15T1432-short-slug.md'],
    })
  })

  it('rejects content without frontmatter', () => {
    expect(parseWorklogFile('2026-09-15T0905-stamen.md', '# Just a heading')).toEqual({
      ok: false,
      errors: ['missing frontmatter: start the file with a --- block'],
    })
  })

  it('reports invalid YAML', () => {
    const result = parseWorklogFile('2026-09-15T0905-stamen.md', '---\ntitle: [unclosed\n---\nbody')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]).toMatch(/^frontmatter is not valid YAML/)
  })

  it('reports schema errors with their field', () => {
    const content = validContent.replace('outcome: learning', 'outcome: issue')
    expect(parseWorklogFile('2026-09-15T0905-stamen.md', content)).toEqual({
      ok: false,
      errors: ['severity: severity is required for issues and not allowed for other outcomes'],
    })
  })

  it('rejects a date that does not match the file name', () => {
    expect(parseWorklogFile('2026-09-15T1000-stamen.md', validContent)).toEqual({
      ok: false,
      errors: ['date 2026-09-15T09:05:00Z does not match the file name prefix 2026-09-15T1000'],
    })
  })

  it('rejects a body that only has headings', () => {
    const content = validContent.replace(/The CodePen.*\n/, '')
    expect(parseWorklogFile('2026-09-15T0905-stamen.md', content)).toEqual({
      ok: false,
      errors: ['body is empty: describe what happened, what went well or not, and the takeaway'],
    })
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm exec vitest run packages/worklog/src/parse.test.ts`

Expected: FAIL with `Error: Cannot find module './parse.ts'`.

- [ ] **Step 8: Implement the parser**

`packages/worklog/src/parse.ts`:

```ts
import { parse as parseYaml } from 'yaml'
import { type WorklogEntry, worklogFrontmatterSchema } from './schema.ts'

const FILE_NAME = /^(\d{4}-\d{2}-\d{2}T\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const HEADING = /^#{1,6} .*$/gm
const MIN_BODY_LENGTH = 20

export type ParseResult = { ok: true; entry: WorklogEntry } | { ok: false; errors: string[] }

/** `2026-09-15T14:32:10Z` → `2026-09-15T1432`, the prefix of every entry's file name. */
export function fileStamp(isoDate: string): string {
  return `${isoDate.slice(0, 10)}T${isoDate.slice(11, 13)}${isoDate.slice(14, 16)}`
}

export function parseWorklogFile(fileName: string, content: string): ParseResult {
  const name = FILE_NAME.exec(fileName)
  if (!name) {
    return { ok: false, errors: ['file name must look like 2026-09-15T1432-short-slug.md'] }
  }
  const blocks = FRONTMATTER.exec(content)
  if (!blocks) {
    return { ok: false, errors: ['missing frontmatter: start the file with a --- block'] }
  }
  const [, frontmatter = '', body = ''] = blocks

  let data: unknown
  try {
    data = parseYaml(frontmatter)
  } catch (error) {
    return { ok: false, errors: [`frontmatter is not valid YAML: ${String(error)}`] }
  }

  const result = worklogFrontmatterSchema.safeParse(data)
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
      ),
    }
  }

  const errors: string[] = []
  if (fileStamp(result.data.date) !== name[1]) {
    errors.push(`date ${result.data.date} does not match the file name prefix ${name[1]}`)
  }
  if (body.replace(HEADING, '').trim().length < MIN_BODY_LENGTH) {
    errors.push('body is empty: describe what happened, what went well or not, and the takeaway')
  }
  if (errors.length > 0) return { ok: false, errors }

  const id = fileName.slice(0, -'.md'.length)
  return { ok: true, entry: { ...result.data, id, body: body.trim() } }
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `pnpm exec vitest run packages/worklog/src/parse.test.ts`

Expected: `Tests  11 passed (11)`.

- [ ] **Step 10: Write the failing folder-validation test**

`packages/worklog/src/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateWorklog } from './validate.ts'

function entryFile(name: string, fields: Record<string, string>) {
  const frontmatter = Object.entries({
    title: 'An entry title',
    agent: 'lead · claude-opus-5',
    phase: 'plan',
    outcome: 'decision',
    ...fields,
  })
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  return {
    name,
    content: `---\n${frontmatter}\n---\n\nEnough body text to describe what happened.\n`,
  }
}

describe('validateWorklog', () => {
  it('returns valid entries oldest first', () => {
    const report = validateWorklog([
      entryFile('2026-09-15T1000-later.md', { date: '2026-09-15T10:00:00Z' }),
      entryFile('2026-09-15T0900-earlier.md', { date: '2026-09-15T09:00:00Z' }),
    ])
    expect(report.errors).toEqual([])
    expect(report.entries.map((entry) => entry.id)).toEqual([
      '2026-09-15T0900-earlier',
      '2026-09-15T1000-later',
    ])
  })

  it('prefixes errors with the file name', () => {
    expect(validateWorklog([{ name: 'oops.md', content: '' }]).errors).toEqual([
      'oops.md: file name must look like 2026-09-15T1432-short-slug.md',
    ])
  })

  it('accepts related links to existing entries', () => {
    const report = validateWorklog([
      entryFile('2026-09-15T0900-bug.md', {
        date: '2026-09-15T09:00:00Z',
        outcome: 'issue',
        severity: 'medium',
      }),
      entryFile('2026-09-15T0930-fix.md', {
        date: '2026-09-15T09:30:00Z',
        outcome: 'win',
        related: '[2026-09-15T0900-bug]',
      }),
    ])
    expect(report.errors).toEqual([])
  })

  it('flags related links to missing entries', () => {
    const report = validateWorklog([
      entryFile('2026-09-15T0930-fix.md', {
        date: '2026-09-15T09:30:00Z',
        related: '[2026-09-15T0900-nope]',
      }),
    ])
    expect(report.errors).toEqual([
      '2026-09-15T0930-fix.md: related entry "2026-09-15T0900-nope" does not exist',
    ])
  })
})
```

- [ ] **Step 11: Run it to verify it fails**

Run: `pnpm exec vitest run packages/worklog/src/validate.test.ts`

Expected: FAIL with `Error: Cannot find module './validate.ts'`.

- [ ] **Step 12: Implement folder validation**

`packages/worklog/src/validate.ts`:

```ts
import { parseWorklogFile } from './parse.ts'
import type { WorklogEntry } from './schema.ts'

export interface WorklogFile {
  name: string
  content: string
}

export interface WorklogReport {
  /** Valid entries, oldest first. */
  entries: WorklogEntry[]
  /** One line per problem, prefixed with the file name. */
  errors: string[]
}

export function validateWorklog(files: readonly WorklogFile[]): WorklogReport {
  const entries: WorklogEntry[] = []
  const errors: string[] = []

  for (const file of files) {
    const result = parseWorklogFile(file.name, file.content)
    if (result.ok) entries.push(result.entry)
    else errors.push(...result.errors.map((error) => `${file.name}: ${error}`))
  }

  const knownIds = new Set(files.map((file) => file.name.replace(/\.md$/, '')))
  for (const entry of entries) {
    for (const id of entry.related) {
      if (!knownIds.has(id)) errors.push(`${entry.id}.md: related entry "${id}" does not exist`)
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return { entries, errors }
}
```

- [ ] **Step 13: Run it to verify it passes**

Run: `pnpm exec vitest run packages/worklog/src/validate.test.ts`

Expected: `Tests  4 passed (4)`.

- [ ] **Step 14: Write the failing entry-builder test**

`packages/worklog/src/create.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildEntry, slugify } from './create.ts'
import { parseWorklogFile } from './parse.ts'

const now = new Date('2026-09-15T14:32:47.123Z')
const agent = 'implementer · claude-opus-5'

describe('slugify', () => {
  it('keeps lowercase letters and digits joined by dashes', () => {
    expect(slugify('Socket event arrived before the HTTP response!')).toBe(
      'socket-event-arrived-before-the-http-response',
    )
  })

  it('strips accents', () => {
    expect(slugify('Întâlnire cu echipa')).toBe('intalnire-cu-echipa')
  })

  it('stops at 60 characters without a trailing dash', () => {
    const slug = slugify(`${'word '.repeat(20)}end`)
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('buildEntry', () => {
  it('names the file after the UTC minute and the title', () => {
    const { fileName } = buildEntry({
      title: 'Scaffolded the workspace',
      phase: 'setup',
      outcome: 'win',
      task: 'M1-T1',
      agent,
      now,
    })
    expect(fileName).toBe('2026-09-15T1432-scaffolded-the-workspace.md')
  })

  it('writes frontmatter that parses once the body is filled in', () => {
    const { fileName, content } = buildEntry({
      title: 'Rate limiter: ignored proxy IPs',
      phase: 'api',
      outcome: 'issue',
      severity: 'medium',
      agent,
      now,
    })
    const filled = content.replace(
      '## What happened\n',
      '## What happened\n\nAll clients shared one rate-limit bucket.\n',
    )
    expect(parseWorklogFile(fileName, filled)).toMatchObject({
      ok: true,
      entry: {
        title: 'Rate limiter: ignored proxy IPs',
        date: '2026-09-15T14:32:47Z',
        severity: 'medium',
        commits: [],
        related: [],
      },
    })
  })

  it('leaves the body empty so the check forces a real description', () => {
    const { fileName, content } = buildEntry({
      title: 'Empty entry',
      phase: 'docs',
      outcome: 'learning',
      agent,
      now,
    })
    expect(parseWorklogFile(fileName, content).ok).toBe(false)
  })

  it('rejects options that would create an invalid entry', () => {
    expect(() =>
      buildEntry({ title: 'Broken', phase: 'api', outcome: 'issue', agent, now }),
    ).toThrow()
    expect(() => buildEntry({ title: '!!!', phase: 'api', outcome: 'win', agent, now })).toThrow(
      'title must contain letters or digits',
    )
  })
})
```

- [ ] **Step 15: Run it to verify it fails**

Run: `pnpm exec vitest run packages/worklog/src/create.test.ts`

Expected: FAIL with `Error: Cannot find module './create.ts'`.

- [ ] **Step 16: Implement the entry builder and the package entry point**

`packages/worklog/src/create.ts`:

```ts
import { stringify } from 'yaml'
import { fileStamp } from './parse.ts'
import {
  type WorklogOutcome,
  type WorklogPhase,
  type WorklogSeverity,
  worklogFrontmatterSchema,
} from './schema.ts'

export interface NewEntryOptions {
  title: string
  phase: WorklogPhase
  outcome: WorklogOutcome
  agent: string
  task?: string | undefined
  severity?: WorklogSeverity | undefined
  now: Date
}

const MAX_SLUG_LENGTH = 60

const BODY_TEMPLATE = `## What happened

## What went well / what didn't

## Takeaway
`

export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '')
}

/** Builds a new entry file with an empty body template; throws if the options are invalid. */
export function buildEntry(options: NewEntryOptions): { fileName: string; content: string } {
  const date = `${options.now.toISOString().slice(0, 19)}Z`
  const frontmatter = worklogFrontmatterSchema.parse({
    title: options.title,
    date,
    agent: options.agent,
    phase: options.phase,
    task: options.task,
    outcome: options.outcome,
    severity: options.severity,
  })
  const slug = slugify(frontmatter.title)
  if (slug === '') throw new Error('title must contain letters or digits')
  return {
    fileName: `${fileStamp(date)}-${slug}.md`,
    content: `---\n${stringify(frontmatter)}---\n\n${BODY_TEMPLATE}`,
  }
}
```

`packages/worklog/src/index.ts`:

```ts
export * from './create.ts'
export * from './parse.ts'
export * from './schema.ts'
export * from './validate.ts'
```

- [ ] **Step 17: Run the package tests**

Run: `pnpm test`

Expected: `Test Files  5 passed (5)` and `Tests  33 passed (33)`.

- [ ] **Step 18: Add the CLIs and root scripts**

`packages/worklog/src/cli/new.ts`:

```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { buildEntry } from '../create.ts'
import { WORKLOG_OUTCOMES, WORKLOG_PHASES, WORKLOG_SEVERITIES } from '../schema.ts'

const USAGE = `Usage: pnpm worklog:new --title "…" --phase <${WORKLOG_PHASES.join('|')}>
  --outcome <${WORKLOG_OUTCOMES.join('|')}> [--severity <${WORKLOG_SEVERITIES.join('|')}>]
  [--task M1-T2] [--agent "implementer · claude-opus-5"] [--dir worklog]`

const argsSchema = z.object({
  title: z.string(),
  phase: z.enum(WORKLOG_PHASES),
  outcome: z.enum(WORKLOG_OUTCOMES),
  severity: z.enum(WORKLOG_SEVERITIES).optional(),
  task: z.string().optional(),
  agent: z.string(),
  dir: z.string(),
})

try {
  const { values } = parseArgs({
    options: {
      title: { type: 'string' },
      phase: { type: 'string' },
      outcome: { type: 'string' },
      severity: { type: 'string' },
      task: { type: 'string' },
      agent: { type: 'string', default: 'claude-opus-5' },
      dir: { type: 'string', default: 'worklog' },
    },
  })
  const { dir, ...options } = argsSchema.parse(values)
  const { fileName, content } = buildEntry({ ...options, now: new Date() })
  const path = join(dir, fileName)
  if (existsSync(path)) throw new Error(`${path} already exists`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path, content)
  console.log(`Created ${path}\nFill in its sections, then run pnpm worklog:check.`)
} catch (error) {
  console.error(error instanceof z.ZodError ? z.prettifyError(error) : String(error))
  console.error(`\n${USAGE}`)
  process.exitCode = 1
}
```

`packages/worklog/src/cli/check.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { validateWorklog } from '../validate.ts'

const { values } = parseArgs({ options: { dir: { type: 'string', default: 'worklog' } } })
const { dir } = values

if (!existsSync(dir)) {
  console.error(`✖ ${dir}/ does not exist`)
  process.exit(1)
}

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }))
const { entries, errors } = validateWorklog(files)

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`)
  console.error(`\n${errors.length} problem(s) in ${dir}/`)
  process.exit(1)
}
console.log(`✔ ${entries.length} work-log entries are valid`)
```

Replace the root `package.json` with:

```json
{
  "name": "wolfchatter",
  "version": "0.0.0",
  "private": true,
  "description": "Real-time chat on a map",
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": {
    "node": ">=24.11.0"
  },
  "scripts": {
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm worklog:check",
    "format": "biome check --write .",
    "lint": "biome check .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json && pnpm -r typecheck",
    "worklog:check": "node packages/worklog/src/cli/check.ts",
    "worklog:new": "node packages/worklog/src/cli/new.ts"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "@types/node": "24.13.4",
    "typescript": "7.0.2",
    "vitest": "5.0.1"
  }
}
```

- [ ] **Step 19: Check that the CLI rejects bad input**

Run: `pnpm worklog:new --title "Scaffolded the workspace" --phase setup`

Expected (exit code 1):

```text
✖ Invalid option: expected one of "win"|"issue"|"decision"|"learning"
  → at outcome

Usage: pnpm worklog:new --title "…" --phase <plan|setup|api|web|realtime|testing|deploy|docs|review>
  --outcome <win|issue|decision|learning> [--severity <low|medium|high>]
  [--task M1-T2] [--agent "implementer · claude-opus-5"] [--dir worklog]
```

- [ ] **Step 20: Add the folder README and the planning-session entries**

These six entries record real events from the planning session on 2026-09-15, before any code existed.

`worklog/README.md`:

```markdown
# Work log

An honest engineering diary kept by the AI agents (and humans) building Wolfchatter. Each file records one event: a **win**, an **issue**, a **decision** or a **learning**. The `/devlog` page renders them as a timeline.

- **Create an entry:** `pnpm worklog:new --title "…" --phase <phase> --outcome <outcome>`, then fill in its sections.
- **Validate:** `pnpm worklog:check` (also runs in CI).
- **Format:** `YYYY-MM-DDTHHMM-slug.md` named after the UTC minute, with YAML frontmatter defined in [`packages/worklog/src/schema.ts`](../packages/worklog/src/schema.ts).
```

`worklog/2026-09-15T0905-brief-tile-url-no-longer-works.md`:

```markdown
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
```

`worklog/2026-09-15T0915-rest-writes-socket-io-push.md`:

```markdown
---
title: 'Real-time model: REST for writes, Socket.IO for push'
date: 2026-09-15T09:15:00Z
agent: lead · claude-opus-5
phase: plan
outcome: decision
---

## What happened

Three approaches were compared with the user: (A) REST writes with Socket.IO broadcasts, (B) socket-first commands with acknowledgements, (C) NestJS with either model. The user chose A, with real-time from day one and Node.js as a hard requirement.

## What went well / what didn't

A keeps validation, rate limiting, error codes and logging in standard HTTP tooling (Fastify), and sending still works while a socket reconnects. The cost is two channels, and the sender receives its own message back, which clients absorb by upserting by id.

## Takeaway

The database is the source of truth, REST is the only way to change it, and sockets only fan out committed changes. Clients refetch after every reconnect, so best-effort socket delivery never leaves gaps.
```

`worklog/2026-09-15T0930-deploy-production-only.md`:

```markdown
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

When CI passes on `main`, a GitHub Actions pipeline deploys the API to Render, waits for `/api/health` to report the new commit, then deploys the web app to Netlify. Staging is described in `docs/INFRASTRUCTURE.md`.
```

`worklog/2026-09-15T0940-measure-docs-by-rendering-them.md`:

```markdown
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
```

`worklog/2026-09-15T0945-pnpm-setup-is-a-built-in-command.md`:

```markdown
---
title: '`pnpm setup` is a built-in command, not a free script name'
date: 2026-09-15T09:45:00Z
agent: lead · claude-opus-5
phase: plan
outcome: issue
severity: medium
---

## What happened

The approved design said local setup was `pnpm setup` followed by `pnpm dev`. Self-reviewing the PRD showed that `setup` is a built-in pnpm command (it configures pnpm's global bin directory), so pnpm would run that instead of our script.

## What went well / what didn't

The mistake was caught before any code or docs depended on it. It came from naming a script without checking pnpm's own commands.

## Takeaway

Local setup is `pnpm install`, then `pnpm dev`, which starts Docker Postgres and applies migrations itself. The Gotchas section of `CLAUDE.md` (M1-T4) records the rule: never name a script after a built-in pnpm command.
```

`worklog/2026-09-15T1000-toolchain-spike-before-planning-m1.md`:

```markdown
---
title: Toolchain spike before writing the M1 plan
date: 2026-09-15T10:00:00Z
agent: lead · claude-opus-5
phase: setup
outcome: learning
---

## What happened

pnpm 12, TypeScript 7, Vitest 5 and Biome 2.5 were all released after the agent's knowledge cutoff, so a throwaway workspace was built in the scratchpad before writing the M1 plan: install, typecheck, test, lint, and a `.ts` CLI run directly by Node 24. M1 itself was then built task by task in the scratchpad so the plan only contains verified code.

## What went well / what didn't

Worked: Vitest 5 `projects`, zod 4 (`z.uuid`, `z.iso.datetime`, trimming before length checks) and Node 24 running TypeScript files directly, even across workspace packages. Surprises: TypeScript 7 defaults `types` to `[]`, so tests failed on `crypto` until `"types": ["node"]`; TypeScript 7 has no programmatic API, so typescript-eslint can't run; Biome defaults to tabs and double quotes and deprecates `rules.recommended` in favour of `preset`; pnpm 12 holds back packages published in the last day and writes `minimumReleaseAgeExclude` into `pnpm-workspace.yaml`; the global pnpm 9.6 ignored the `packageManager` pin and hung on install.

## Takeaway

Upgrading to pnpm 12 is a prerequisite for M1, and the surprises above go into the Gotchas section of `CLAUDE.md`.
```

Run: `pnpm worklog:check`

Expected: `✔ 6 work-log entries are valid`.

- [ ] **Step 21: Record Task 1 and this task in the work log**

Create one entry per task with the CLI, then fill in each file's three sections with what actually happened: the commands you ran, anything that failed or surprised you (for example the `minimumReleaseAgeExclude` entries pnpm added, or the type-check gate experiment) and the takeaway.

```bash
pnpm worklog:new --title "Workspace and toolchain are green" --phase setup --outcome win \
  --task M1-T1 --agent "implementer · claude-opus-5"
pnpm worklog:new --title "Work-log package validates entries" --phase setup --outcome win \
  --task M1-T2 --agent "implementer · claude-opus-5"
```

Use a more specific title if something notable happened; if a step failed, use `--outcome issue --severity <level>` instead. An entry whose sections are still empty fails the check.

Run: `pnpm worklog:check`

Expected: `✔ 8 work-log entries are valid`.

- [ ] **Step 22: Run the full check**

Run: `pnpm check`

Expected: no Biome or `tsc` errors, `Tests  33 passed (33)` and `✔ 8 work-log entries are valid`.

- [ ] **Step 23: Commit**

```bash
git add .
git commit -F - <<'EOF'
feat(worklog): add work-log schema, parser, CLIs and first entries

Entries are Markdown files with zod-validated frontmatter. `pnpm worklog:new`
creates one and `pnpm worklog:check` validates the folder. Includes the
planning-session entries and the entries for M1-T1 and M1-T2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Shared API contract (M1-T3)

Turns PRD §3–§4 into the zod schemas and types that the API (M2) and the web app (M3) will both import. Covers the contract side of FR-2, FR-5 and FR-7.

**Files:**
- Modify: `packages/shared/package.json` (adds zod)
- Create: `packages/shared/src/rooms.ts`, `messages.ts`, `errors.ts`, `health.ts`
- Modify: `packages/shared/src/realtime.ts` (adds the socket event maps), `packages/shared/src/index.ts`
- Test: `packages/shared/src/rooms.test.ts`, `messages.test.ts`, `responses.test.ts`
- Create: one `worklog/` entry

**Interfaces:**
- Consumes: `roomChannel` from Task 1.
- Produces, exported from `@wolfchatter/shared`:
  - Rooms: `roomSchema`, `roomListSchema`, `createRoomInputSchema` (`{ id, lat, lng }`), the types `Room` (`{ id: string; number: number; lat: number; lng: number; createdAt: string }`) and `CreateRoomInput`, and `roomTitle(room: Pick<Room, 'number'>): string`
  - Messages: `messageSchema`, `messageListSchema`, `createMessageInputSchema` (`{ id, author, body }`, trimmed), `listMessagesQuerySchema` (`{ before?: string; limit: number }`), the types `Message` (`{ id; roomId; author; body; createdAt }`), `CreateMessageInput` and `ListMessagesQuery`, the constants `AUTHOR_MAX_LENGTH = 32`, `BODY_MAX_LENGTH = 1000` and `MESSAGES_PAGE_SIZE = 50`, and `compareMessages(a, b): number`
  - Errors: `API_ERROR_CODES` (`VALIDATION_FAILED`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL`), `apiErrorCodeSchema`, `apiErrorResponseSchema`, and the types `ApiErrorCode` and `ApiErrorResponse`
  - Health: `healthResponseSchema` (`{ ok: boolean; db: 'up' | 'down'; commit: string | null }`) and the type `HealthResponse`
  - Real-time: `ServerToClientEvents` (`'room:created'`, `'message:created'`), `ClientToServerEvents` (`'room:join'`, `'room:leave'`) and `roomChannel`
- Timestamps are ISO 8601 strings in UTC (`Date#toISOString()`), and ids are UUIDs generated by the client.

- [ ] **Step 1: Add zod to the package**

Replace `packages/shared/package.json` with:

```json
{
  "name": "@wolfchatter/shared",
  "version": "0.0.0",
  "private": true,
  "description": "API and real-time contract shared by the Wolfchatter API and web app",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "24.13.4"
  },
  "dependencies": {
    "zod": "4.6.5"
  }
}
```

Run: `pnpm install`

Expected: `Done in …s using pnpm v12.4.1`.

- [ ] **Step 2: Write the failing rooms test**

`packages/shared/src/rooms.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRoomInputSchema, roomSchema, roomTitle } from './rooms.ts'

const validRoom = {
  id: '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f',
  number: 1,
  lat: 46.7712,
  lng: 23.6236,
  createdAt: '2026-09-15T10:00:00.000Z',
}

describe('roomSchema', () => {
  it('accepts a room as the API serialises it', () => {
    expect(roomSchema.parse(validRoom)).toEqual(validRoom)
  })

  it.each([
    ['a latitude above 90', { lat: 90.1 }],
    ['a latitude below -90', { lat: -90.1 }],
    ['a longitude above 180', { lng: 180.1 }],
    ['a longitude below -180', { lng: -180.1 }],
    ['a room number below 1', { number: 0 }],
    ['an id that is not a UUID', { id: 'room-1' }],
    ['a timestamp that is not ISO 8601', { createdAt: '15/09/2026' }],
  ])('rejects %s', (_case, override) => {
    expect(roomSchema.safeParse({ ...validRoom, ...override }).success).toBe(false)
  })
})

describe('createRoomInputSchema', () => {
  it('FR-2: accepts the id and coordinates of a map click', () => {
    const input = { id: validRoom.id, lat: 45.5, lng: -12.25 }
    expect(createRoomInputSchema.parse(input)).toEqual(input)
  })

  it('drops server-owned fields sent by a client', () => {
    expect(createRoomInputSchema.parse({ ...validRoom, number: 99 })).toEqual({
      id: validRoom.id,
      lat: validRoom.lat,
      lng: validRoom.lng,
    })
  })
})

describe('roomTitle', () => {
  it('FR-2: formats the title shown in the chat panel', () => {
    expect(roomTitle({ number: 7 })).toBe('Chatroom 7')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run packages/shared/src/rooms.test.ts`

Expected: FAIL with `Error: Cannot find module './rooms.ts'`.

- [ ] **Step 4: Implement rooms**

`packages/shared/src/rooms.ts`:

```ts
import { z } from 'zod'

export const roomSchema = z.object({
  id: z.uuid(),
  number: z.int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  createdAt: z.iso.datetime(),
})
export type Room = z.infer<typeof roomSchema>

export const roomListSchema = z.array(roomSchema)

/** Body of `POST /api/rooms`. The client generates the id, so retries are idempotent. */
export const createRoomInputSchema = roomSchema.pick({ id: true, lat: true, lng: true })
export type CreateRoomInput = z.infer<typeof createRoomInputSchema>

/** The panel title from the mockup, e.g. "Chatroom 2". */
export function roomTitle(room: Pick<Room, 'number'>): string {
  return `Chatroom ${room.number}`
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm exec vitest run packages/shared/src/rooms.test.ts`

Expected: `Tests  11 passed (11)`.

- [ ] **Step 6: Write the failing messages test**

`packages/shared/src/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  AUTHOR_MAX_LENGTH,
  BODY_MAX_LENGTH,
  compareMessages,
  createMessageInputSchema,
  listMessagesQuerySchema,
  messageSchema,
} from './messages.ts'

const id = '0b6c8f7e-1d2a-4b3c-9d4e-5f6a7b8c9d0e'
const roomId = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f'

describe('createMessageInputSchema', () => {
  it('FR-5: trims the author and body', () => {
    expect(createMessageInputSchema.parse({ id, author: '  ana  ', body: '\n hello \t' })).toEqual({
      id,
      author: 'ana',
      body: 'hello',
    })
  })

  it('FR-5: rejects a blank author with a readable message', () => {
    const result = createMessageInputSchema.safeParse({ id, author: '   ', body: 'hello' })
    expect(result.error?.issues[0]?.message).toBe('Enter a user name')
  })

  it('FR-5: rejects a blank message with a readable message', () => {
    const result = createMessageInputSchema.safeParse({ id, author: 'ana', body: '   ' })
    expect(result.error?.issues[0]?.message).toBe('Write a message')
  })

  it('FR-5: applies the length limits after trimming', () => {
    const longestAuthor = 'a'.repeat(AUTHOR_MAX_LENGTH)
    const longestBody = 'b'.repeat(BODY_MAX_LENGTH)
    const parse = (author: string, body: string) =>
      createMessageInputSchema.safeParse({ id, author, body }).success

    expect(parse(` ${longestAuthor} `, longestBody)).toBe(true)
    expect(parse(`${longestAuthor}a`, 'hello')).toBe(false)
    expect(parse('ana', `${longestBody}b`)).toBe(false)
  })

  it('requires a UUID so retried requests can be deduplicated', () => {
    expect(
      createMessageInputSchema.safeParse({ id: '42', author: 'ana', body: 'hi' }).success,
    ).toBe(false)
  })
})

describe('messageSchema', () => {
  it('accepts a message as the API serialises it', () => {
    const message = {
      id,
      roomId,
      author: 'ana',
      body: 'hello',
      createdAt: '2026-09-15T10:00:00.000Z',
    }
    expect(messageSchema.parse(message)).toEqual(message)
  })
})

describe('listMessagesQuerySchema', () => {
  it('defaults to a page of 50 messages', () => {
    expect(listMessagesQuerySchema.parse({})).toEqual({ limit: 50 })
  })

  it('coerces query-string values', () => {
    expect(listMessagesQuerySchema.parse({ before: id, limit: '20' })).toEqual({
      before: id,
      limit: 20,
    })
  })

  it.each(['0', '101', '2.5', 'abc'])('rejects limit=%s', (limit) => {
    expect(listMessagesQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  it('rejects a cursor that is not a message id', () => {
    expect(listMessagesQuerySchema.safeParse({ before: 'yesterday' }).success).toBe(false)
  })
})

describe('compareMessages', () => {
  it('orders by createdAt, then by id', () => {
    const first = {
      id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
      createdAt: '2026-09-15T10:00:00.000Z',
    }
    const second = {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: '2026-09-15T10:00:01.000Z',
    }
    const third = {
      id: '00000000-0000-4000-8000-000000000002',
      createdAt: '2026-09-15T10:00:01.000Z',
    }

    expect([third, first, second].sort(compareMessages)).toEqual([first, second, third])
    expect(compareMessages(second, second)).toBe(0)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm exec vitest run packages/shared/src/messages.test.ts`

Expected: FAIL with `Error: Cannot find module './messages.ts'`.

- [ ] **Step 8: Implement messages**

`compareMessages` compares strings by code point rather than with `localeCompare`, so the order matches Postgres's `ORDER BY created_at, id` for ISO timestamps and lowercase UUIDs.

`packages/shared/src/messages.ts`:

```ts
import { z } from 'zod'

export const AUTHOR_MAX_LENGTH = 32
export const BODY_MAX_LENGTH = 1000
export const MESSAGES_PAGE_SIZE = 50

export const messageSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  author: z.string().min(1).max(AUTHOR_MAX_LENGTH),
  body: z.string().min(1).max(BODY_MAX_LENGTH),
  createdAt: z.iso.datetime(),
})
export type Message = z.infer<typeof messageSchema>

export const messageListSchema = z.array(messageSchema)

/** Body of `POST /api/rooms/:id/messages`. Values are trimmed before the length checks. */
export const createMessageInputSchema = z.object({
  id: z.uuid(),
  author: z
    .string()
    .trim()
    .min(1, { error: 'Enter a user name' })
    .max(AUTHOR_MAX_LENGTH, { error: `User names are limited to ${AUTHOR_MAX_LENGTH} characters` }),
  body: z
    .string()
    .trim()
    .min(1, { error: 'Write a message' })
    .max(BODY_MAX_LENGTH, { error: `Messages are limited to ${BODY_MAX_LENGTH} characters` }),
})
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>

/** Query of `GET /api/rooms/:id/messages`: the newest `limit` messages older than `before`. */
export const listMessagesQuerySchema = z.object({
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(MESSAGES_PAGE_SIZE),
})
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>

type Ordered = Pick<Message, 'createdAt' | 'id'>

/** The one message order used everywhere: by `createdAt`, then by `id`. */
export function compareMessages(a: Ordered, b: Ordered): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `pnpm exec vitest run packages/shared/src/messages.test.ts`

Expected: `Tests  14 passed (14)`.

- [ ] **Step 10: Write the failing error and health response test**

`packages/shared/src/responses.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { apiErrorResponseSchema } from './errors.ts'
import { healthResponseSchema } from './health.ts'

describe('apiErrorResponseSchema', () => {
  it('accepts the shared error shape with optional details', () => {
    const response = {
      error: { code: 'VALIDATION_FAILED', message: 'Invalid body', details: [{ path: 'body' }] },
    }
    expect(apiErrorResponseSchema.parse(response)).toEqual(response)
  })

  it('rejects error codes outside the contract', () => {
    const response = { error: { code: 'TEAPOT', message: 'I am a teapot' } }
    expect(apiErrorResponseSchema.safeParse(response).success).toBe(false)
  })
})

describe('healthResponseSchema', () => {
  it('allows a missing commit for local runs', () => {
    expect(healthResponseSchema.parse({ ok: true, db: 'up', commit: null })).toEqual({
      ok: true,
      db: 'up',
      commit: null,
    })
  })
})
```

- [ ] **Step 11: Run it to verify it fails**

Run: `pnpm exec vitest run packages/shared/src/responses.test.ts`

Expected: FAIL with `Error: Cannot find module './errors.ts'`.

- [ ] **Step 12: Implement the error and health shapes**

`packages/shared/src/errors.ts`:

```ts
import { z } from 'zod'

export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL',
] as const

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** The single error shape every API endpoint returns. */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
```

`packages/shared/src/health.ts`:

```ts
import { z } from 'zod'

/** `GET /api/health`. `commit` lets the deploy workflow confirm which version is live. */
export const healthResponseSchema = z.object({
  ok: z.boolean(),
  db: z.enum(['up', 'down']),
  commit: z.string().nullable(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
```

- [ ] **Step 13: Run it to verify it passes**

Run: `pnpm exec vitest run packages/shared/src/responses.test.ts`

Expected: `Tests  3 passed (3)`.

- [ ] **Step 14: Add the socket event maps and export everything**

These are types only. `tsc` checks them now, and the Socket.IO server (M2) and client (M3) will use them as generics.

Replace `packages/shared/src/realtime.ts` with:

```ts
import type { Message } from './messages.ts'
import type { Room } from './rooms.ts'

/** Events the API pushes to browsers. */
export interface ServerToClientEvents {
  /** A chatroom was created. Sent to every connected client. */
  'room:created': (room: Room) => void
  /** A message was posted. Sent only to the room's channel. */
  'message:created': (message: Message) => void
}

/** Events browsers send to the API. */
export interface ClientToServerEvents {
  'room:join': (roomId: string) => void
  'room:leave': (roomId: string) => void
}

/** Socket.IO room that receives `message:created` events for one chatroom. */
export function roomChannel(roomId: string): `room:${string}` {
  return `room:${roomId}`
}
```

Replace `packages/shared/src/index.ts` with:

```ts
export * from './errors.ts'
export * from './health.ts'
export * from './messages.ts'
export * from './realtime.ts'
export * from './rooms.ts'
```

- [ ] **Step 15: Run the full check**

Run: `pnpm check`

Expected: no Biome or `tsc` errors, `Test Files  8 passed (8)`, `Tests  61 passed (61)` and `✔ 8 work-log entries are valid`.

- [ ] **Step 16: Record the task in the work log**

```bash
pnpm worklog:new --title "Shared API contract for rooms, messages and events" --phase api \
  --outcome win --task M1-T3 --agent "implementer · claude-opus-5"
```

Fill in the three sections with what actually happened, and use a more specific title or a different outcome if something notable happened. Then run `pnpm worklog:check`.

Expected: `✔ 9 work-log entries are valid`.

- [ ] **Step 17: Commit**

```bash
git add .
git commit -F - <<'EOF'
feat(shared): add zod contract for rooms, messages, errors and socket events

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Agent setup (M1-T4)

Commits the AI workflow described in PRD §6: agent instructions, a hook that formats every edited file, a hook that reminds agents to keep the work log, and the `worklog` skill.

**Files:**
- Create: `packages/worklog/src/reminder.ts`
- Test: `packages/worklog/src/reminder.test.ts`
- Modify: `packages/worklog/src/index.ts`, `package.json` (the hooks need `zod` and `@wolfchatter/worklog` at the root), `tsconfig.json` (type-checks the hooks), `worklog/README.md`
- Create: `.claude/hooks/format-edited-file.ts`, `.claude/hooks/worklog-reminder.ts`, `.claude/settings.json`, `.claude/skills/worklog/SKILL.md`, `CLAUDE.md`, `AGENTS.md`
- Create: one `worklog/` entry

**Interfaces:**
- Consumes: `@wolfchatter/worklog` from Task 2.
- Produces:
  - `needsWorklogReminder(changedPaths: readonly string[]): boolean` and `parseGitStatus(output: string): string[]`, exported from `@wolfchatter/worklog`
  - A PostToolUse hook for `Edit|Write|MultiEdit` that runs `biome check --write` on the edited file and never blocks
  - A Stop hook that exits with code 2 and a reminder when files changed since the last commit that touched `worklog/` (plus uncommitted changes) without a new entry. Changes under `worklog/` and `docs/plans/` don't count as work. The hook is quiet when `stop_hook_active` is true.

- [ ] **Step 1: Write the failing reminder test**

`packages/worklog/src/reminder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { needsWorklogReminder, parseGitStatus } from './reminder.ts'

describe('needsWorklogReminder', () => {
  it('reminds when work changed without a work-log entry', () => {
    expect(needsWorklogReminder(['packages/shared/src/rooms.ts'])).toBe(true)
  })

  it('stays quiet when an entry was added alongside the work', () => {
    const changed = ['packages/shared/src/rooms.ts', 'worklog/2026-09-15T1432-rooms.md']
    expect(needsWorklogReminder(changed)).toBe(false)
  })

  it('stays quiet when nothing changed or only a plan was ticked off', () => {
    expect(needsWorklogReminder([])).toBe(false)
    expect(needsWorklogReminder(['docs/plans/2026-09-15-m1-foundation.md'])).toBe(false)
  })
})

describe('parseGitStatus', () => {
  it('reads modified, untracked and renamed paths', () => {
    const output = [
      ' M package.json',
      '?? worklog/2026-09-15T1432-new.md',
      'R  src/new-name.ts',
      'src/old-name.ts',
      '',
    ].join('\0')
    expect(parseGitStatus(output)).toEqual([
      'package.json',
      'worklog/2026-09-15T1432-new.md',
      'src/new-name.ts',
    ])
  })

  it('keeps spaces in paths and handles a clean tree', () => {
    expect(parseGitStatus(' M docs/my notes.md\0')).toEqual(['docs/my notes.md'])
    expect(parseGitStatus('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run packages/worklog/src/reminder.test.ts`

Expected: FAIL with `Error: Cannot find module './reminder.ts'`.

- [ ] **Step 3: Implement the reminder logic and export it**

`packages/worklog/src/reminder.ts`:

```ts
/** Changes under these paths never need a work-log entry of their own. */
const EXEMPT_PREFIXES = ['worklog/', 'docs/plans/']

/**
 * True when work changed but no work-log entry did. The Stop hook uses this to
 * ask the agent to record what happened before it finishes.
 */
export function needsWorklogReminder(changedPaths: readonly string[]): boolean {
  const addedEntry = changedPaths.some((path) => path.startsWith('worklog/'))
  const changedWork = changedPaths.some(
    (path) => !EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix)),
  )
  return changedWork && !addedEntry
}

/** Paths from `git status --porcelain=v1 -z`. Renames and copies report their new path only. */
export function parseGitStatus(output: string): string[] {
  const records = output.split('\0')
  const paths: string[] = []
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (!record) continue
    paths.push(record.slice(3))
    // A rename or copy is followed by a separate record holding the original path.
    if (record.startsWith('R') || record.startsWith('C')) index++
  }
  return paths
}
```

Replace `packages/worklog/src/index.ts` with:

```ts
export * from './create.ts'
export * from './parse.ts'
export * from './reminder.ts'
export * from './schema.ts'
export * from './validate.ts'
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run packages/worklog/src/reminder.test.ts`

Expected: `Tests  5 passed (5)`.

- [ ] **Step 5: Make the hooks' dependencies resolvable from the root**

The hooks live in `.claude/hooks/`, so Node resolves their imports from the root `node_modules`.

Replace the root `package.json` with:

```json
{
  "name": "wolfchatter",
  "version": "0.0.0",
  "private": true,
  "description": "Real-time chat on a map",
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": {
    "node": ">=24.11.0"
  },
  "scripts": {
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm worklog:check",
    "format": "biome check --write .",
    "lint": "biome check .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json && pnpm -r typecheck",
    "worklog:check": "node packages/worklog/src/cli/check.ts",
    "worklog:new": "node packages/worklog/src/cli/new.ts"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "@types/node": "24.13.4",
    "@wolfchatter/worklog": "workspace:*",
    "typescript": "7.0.2",
    "vitest": "5.0.1",
    "zod": "4.6.5"
  }
}
```

Replace `tsconfig.json` with:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": [".claude/hooks/**/*.ts", "vitest.config.ts"]
}
```

Run: `pnpm install`

Expected: `Done in …s using pnpm v12.4.1`, and `node_modules/@wolfchatter/worklog` now exists.

- [ ] **Step 6: Add the hooks and settings**

`.claude/hooks/format-edited-file.ts`:

```ts
// PostToolUse hook: format each file Claude edits with Biome so agent output always
// matches `pnpm lint`. It never blocks an edit; anything Biome can't fix fails in CI.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const hookInputSchema = z.object({
  cwd: z.string(),
  tool_input: z.object({ file_path: z.string() }),
})

const input = hookInputSchema.safeParse(JSON.parse(readFileSync(0, 'utf8')))
if (input.success) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.data.cwd
  const biome = join(projectDir, 'node_modules', '.bin', 'biome')
  spawnSync(
    biome,
    ['check', '--write', '--no-errors-on-unmatched', input.data.tool_input.file_path],
    {
      cwd: projectDir,
      stdio: 'ignore',
    },
  )
}
```

`.claude/hooks/worklog-reminder.ts`:

```ts
// Stop hook: when work changed since the last work-log entry, ask Claude to record it
// before ending the turn. Exit code 2 blocks the stop and shows stderr to Claude.
// On the retry `stop_hook_active` is true, so the reminder can never loop.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { needsWorklogReminder, parseGitStatus } from '@wolfchatter/worklog'
import { z } from 'zod'

const hookInputSchema = z.object({
  cwd: z.string(),
  stop_hook_active: z.boolean().default(false),
})

const REMINDER = `Work changed since the last work-log entry. Before finishing, record it with the
worklog skill: pnpm worklog:new …, fill in the sections, pnpm worklog:check, then commit
the entry with the work. If this change genuinely needs no entry, say why and stop.`

const input = hookInputSchema.parse(JSON.parse(readFileSync(0, 'utf8')))

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: input.cwd, encoding: 'utf8', stdio: 'pipe' })
}

/** Files changed in commits after the last one that touched worklog/, plus uncommitted changes. */
function changedSinceLastEntry(): string[] {
  const lastEntryCommit = git(['log', '-1', '--format=%H', '--', 'worklog/']).trim()
  const committed =
    lastEntryCommit === ''
      ? []
      : git(['diff', '--name-only', `${lastEntryCommit}..HEAD`])
          .split('\n')
          .filter(Boolean)
  const uncommitted = parseGitStatus(
    git(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
  )
  return [...committed, ...uncommitted]
}

if (!input.stop_hook_active) {
  let changed: string[] = []
  try {
    changed = changedSinceLastEntry()
  } catch {
    // Not a git checkout, or git is unavailable: never block the session over it.
  }
  if (needsWorklogReminder(changed)) {
    process.stderr.write(`${REMINDER}\n`)
    process.exit(2)
  }
}
```

`.claude/settings.json`. The allow list only covers the project's own scripts and local git commands; pushing and anything else still asks:

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm install *)",
      "Bash(pnpm check *)",
      "Bash(pnpm lint *)",
      "Bash(pnpm format *)",
      "Bash(pnpm typecheck *)",
      "Bash(pnpm test *)",
      "Bash(pnpm worklog:new *)",
      "Bash(pnpm worklog:check *)",
      "Bash(pnpm exec biome *)",
      "Bash(pnpm exec tsc *)",
      "Bash(pnpm exec vitest *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)"
    ],
    "deny": [
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Read(**/.env)",
      "Read(**/.env.local)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/format-edited-file.ts"],
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/worklog-reminder.ts"],
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7: Verify the format hook**

Pipe it the JSON that Claude Code sends after an edit:

```bash
printf 'export const   messy = {a:1,\n b:"two"}\n' > packages/shared/src/messy.ts
echo "{\"cwd\":\"$PWD\",\"tool_input\":{\"file_path\":\"$PWD/packages/shared/src/messy.ts\"}}" \
  | CLAUDE_PROJECT_DIR="$PWD" node .claude/hooks/format-edited-file.ts
cat packages/shared/src/messy.ts
rm packages/shared/src/messy.ts
```

Expected: exit code 0, and the file now reads `export const messy = { a: 1, b: 'two' }`.

- [ ] **Step 8: Verify the Stop hook**

This task's changes are uncommitted and have no work-log entry yet, so the hook should remind:

```bash
echo "{\"cwd\":\"$PWD\",\"stop_hook_active\":false}" | node .claude/hooks/worklog-reminder.ts; echo "exit=$?"
```

Expected:

```text
Work changed since the last work-log entry. Before finishing, record it with the
worklog skill: pnpm worklog:new …, fill in the sections, pnpm worklog:check, then commit
the entry with the work. If this change genuinely needs no entry, say why and stop.
exit=2
```

Claude Code's retry must pass, and so must a directory outside git:

```bash
echo "{\"cwd\":\"$PWD\",\"stop_hook_active\":true}" | node .claude/hooks/worklog-reminder.ts; echo "exit=$?"
echo '{"cwd":"/tmp"}' | node .claude/hooks/worklog-reminder.ts; echo "exit=$?"
```

Expected: `exit=0` twice.

- [ ] **Step 9: Add the agent instructions**

`CLAUDE.md`:

```markdown
# Wolfchatter: agent guide

Real-time chat on a map, built for the Wolfpack Digital full-stack test. **Read [docs/PRD.md](docs/PRD.md) first:** it is the source of truth for requirements (FR-1…FR-8) and technical decisions. The roadmap and milestone plans live in [docs/plans/](docs/plans/README.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies (pnpm 12 required) |
| `pnpm check` | Everything CI runs: lint, typecheck, tests, work-log check |
| `pnpm lint` / `pnpm format` | Biome check / apply formatting and safe fixes |
| `pnpm typecheck` | `tsc --noEmit` for the root and every package |
| `pnpm test` | All Vitest projects; one file: `pnpm exec vitest run <path>` |
| `pnpm worklog:new --title "…" --phase <phase> --outcome <outcome>` | Create a work-log entry |
| `pnpm worklog:check` | Validate every work-log entry |

## Repository map

- `packages/shared`: zod schemas and types for REST payloads, errors and socket events. Contract changes start here.
- `packages/worklog`: work-log schema, parser, validator, CLIs and the Stop-hook logic.
- `apps/api` (M2): Fastify, Socket.IO, Drizzle. `apps/web` (M3): React, Vite, react-leaflet.
- `worklog/`: one Markdown file per work-log entry, rendered at `/devlog`.
- `docs/`: PRD, plans, and later infrastructure and review docs.
- `.claude/`: settings, hooks and skills for Claude Code.

## Conventions

- **Node 24 runs TypeScript directly** (type stripping), with no build step. Use only erasable syntax (no `enum`, `namespace` or constructor parameter properties) and import relative files with their `.ts` extension.
- **Strict types, no `any`.** Validate every external input (HTTP bodies, socket payloads, env, files, hook stdin) with zod at the boundary, and infer types with `z.infer` rather than writing them twice.
- **Biome owns formatting:** 2 spaces, single quotes, no semicolons, 100 columns. A hook formats every file you edit; `pnpm format` fixes the rest.
- **`packages/shared` must run in browsers and Node:** no `node:*` imports outside tests (Biome enforces it).
- **Small, focused files** named in kebab-case after the domain (`rooms.ts`, `messages.ts`), with tests next to them as `*.test.ts`.
- **Dependencies** are pinned exactly (`pnpm add --save-exact`). Prefer a few lines of code over a new dependency.

## Testing

- Write the failing test first, watch it fail for the expected reason, implement, watch it pass.
- Test behaviour through public interfaces. Prefix a test with its requirement when one applies: `it('FR-5: rejects a blank message', …)`.
- Never skip, weaken or delete a test to get to green; fix the code or ask.

## Work log (required)

Use the `worklog` skill. Every task commits at least one entry together with its work, and every failed attempt, surprising bug or non-obvious decision gets one too. Be honest about what went wrong; the log is a diary, not a changelog. A Stop hook reminds you when work changed since the last entry.

## Git

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`) in small, focused commits.
- One branch and pull request per milestone (`m1-foundation`, `m2-api`, …).
- End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never push to `main`, force-push, or merge a pull request without the user's approval.

## Definition of done

1. `pnpm check` passes.
2. Tests cover the behaviour, and the behaviour matches the PRD.
3. A work-log entry describes what happened.
4. Docs are updated when a contract, command or decision changes.

## Gotchas

- `pnpm setup` is a built-in pnpm command. Never name a script after one.
- pnpm 12 holds back packages published in the last 24 hours and may add `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml`. Commit them.
- TypeScript 7 has no programmatic API, so tools that need one (typescript-eslint and similar) don't work. Lint with Biome.
- TypeScript 7 defaults `types` to `[]`: a package that uses Node globals needs `"types": ["node"]`.
- Stamen Watercolor tiles come from Stadia Maps. Localhost needs no key; a deployed domain must be registered with Stadia.
- Leaflet fires `click` twice for a double-click, so map clicks must go through a single-click detector (M3).
```

`AGENTS.md`:

```markdown
# AGENTS.md

The instructions for AI agents working in this repository live in [CLAUDE.md](CLAUDE.md). Its conventions, commands, testing rules, work-log requirement and definition of done apply to every tool, not only Claude Code. Requirements are in [docs/PRD.md](docs/PRD.md).
```

- [ ] **Step 10: Add the `worklog` skill and link it from the folder README**

`.claude/skills/worklog/SKILL.md`:

````markdown
---
name: worklog
description: Record a work-log entry in worklog/. Use after finishing any plan task, after a failed attempt or surprising bug, and after any non-obvious decision. Entries are validated in CI and rendered on the /devlog page.
---

# Work log

The work log is the project's engineering diary. The `/devlog` page turns it into a timeline, so write for a reviewer who wants to know what really happened, including what went wrong.

## When to write an entry

| Situation | Outcome |
|---|---|
| You finished a plan task | `win` (or whichever outcome fits better) |
| Something failed, broke or surprised you | `issue`, with `--severity low\|medium\|high` |
| You chose between alternatives | `decision` |
| You learned something the next agent should know | `learning` (and consider adding it to Gotchas in CLAUDE.md) |

When you fix an earlier issue, add `related: [<issue entry id>]` to the new entry so the devlog links them.

## How

1. Create the file:

   ```bash
   pnpm worklog:new --title "Socket event arrived before the HTTP response" \
     --phase realtime --outcome issue --severity medium --task M2-T6 \
     --agent "implementer · claude-opus-5"
   ```

   Phases: `plan`, `setup`, `api`, `web`, `realtime`, `testing`, `deploy`, `docs`, `review`. Agents: `lead · claude-opus-5` for the main session, `implementer · claude-opus-5` or `reviewer · claude-opus-5` for subagents, `human · <name>` for people.

2. Open the printed path and fill in all three sections: **What happened**, **What went well / what didn't**, **Takeaway**.
3. Run `pnpm worklog:check`.
4. Commit the entry in the same commit as the work it describes.

## Quality bar

- **Specific:** quote the command, the error message and the root cause. "`tsc` failed with `Cannot find name 'crypto'` because TypeScript 7 defaults `types` to `[]`" beats "fixed type errors".
- **Honest:** record mistakes and dead ends, including your own.
- **Short:** a few sentences per section.
- **Linked:** `related` for earlier entries, `commits` for earlier commits (the entry's own commit is found from its file history).

## Example

```markdown
---
title: Rate limiter counted every client as one IP
date: 2026-09-16T11:20:00Z
agent: implementer · claude-opus-5
phase: api
task: M2-T5
outcome: issue
severity: medium
commits: []
related: []
---

## What happened

The 429 integration test passed locally, but behind Render's proxy every request carried the proxy's IP, so all users shared a single rate-limit bucket.

## What went well / what didn't

The test caught the limit itself, but it could not catch proxy behaviour, because `inject()` has no proxy in front of it.

## Takeaway

Fastify now runs with `trustProxy: true`, and a test sends `X-Forwarded-For` to prove that separate clients get separate buckets.
```
````

Replace `worklog/README.md` with:

```markdown
# Work log

An honest engineering diary kept by the AI agents (and humans) building Wolfchatter. Each file records one event: a **win**, an **issue**, a **decision** or a **learning**. The `/devlog` page renders them as a timeline.

- **Create an entry:** `pnpm worklog:new --title "…" --phase <phase> --outcome <outcome>`, then fill in its sections.
- **Validate:** `pnpm worklog:check` (also runs in CI).
- **Format:** `YYYY-MM-DDTHHMM-slug.md` named after the UTC minute, with YAML frontmatter defined in [`packages/worklog/src/schema.ts`](../packages/worklog/src/schema.ts).

Agents follow the [`worklog` skill](../.claude/skills/worklog/SKILL.md) for when and how to write entries.
```

- [ ] **Step 11: Record the task in the work log and confirm the hook is satisfied**

```bash
pnpm worklog:new --title "Agent setup with format and work-log hooks" --phase setup \
  --outcome win --task M1-T4 --agent "implementer · claude-opus-5"
```

Fill in the three sections, then run the Stop hook again:

```bash
echo "{\"cwd\":\"$PWD\"}" | node .claude/hooks/worklog-reminder.ts; echo "exit=$?"
```

Expected: `exit=0`, because the new entry sits alongside the work.

- [ ] **Step 12: Run the full check**

Run: `pnpm check`

Expected: no Biome or `tsc` errors, `Test Files  9 passed (9)`, `Tests  66 passed (66)` and `✔ 10 work-log entries are valid`.

- [ ] **Step 13: Commit**

```bash
git add .
git commit -F - <<'EOF'
feat: add agent guide, Claude Code hooks and worklog skill

CLAUDE.md sets conventions and the definition of done; AGENTS.md points other
tools to it. A PostToolUse hook formats edited files with Biome, and a Stop
hook asks the agent to write a work-log entry when work changed without one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 14: Tell the lead that the hooks start in the next session**

Claude Code reads hooks when a session starts, so the session that ran this task may not use them until it restarts (or until they're reviewed in `/hooks`). Steps 7, 8 and 11 already proved they work.

---

### Task 5: CI, README and pull request (M1-T5)

Adds the CI quality gate from PRD §6, a README for reviewers, and opens the milestone pull request.

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`
- Create: one `worklog/` entry

**Interfaces:**
- Consumes: the root scripts from Tasks 1–4.
- Produces: a GitHub Actions job named `Lint, typecheck, test, work log`, which runs on every pull request and every push to `main`. M4's deploy workflow will require it to pass.

- [ ] **Step 1: Add the CI workflow**

`pnpm/action-setup` reads the pnpm version from `packageManager`, so it isn't repeated here. `biome ci` is the read-only form of `biome check` and annotates problems on the pull request.

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  checks:
    name: Lint, typecheck, test, work log
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint (Biome)
        run: pnpm exec biome ci .

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Work log
        run: pnpm worklog:check
```

- [ ] **Step 2: Add the README**

`README.md`:

````markdown
# Wolfchatter

Real-time chat on a map: click anywhere to drop a pin and open a chatroom, click a pin to join it, and everyone in the room sees new messages instantly. Built for the Wolfpack Digital full-stack test.

> **Status: M1 Foundation.** The toolchain, shared API contract, work-log tooling and AI agent setup are in place. The API (M2) and the web app (M3) come next; see the [roadmap](docs/plans/README.md).

## Documents

- [Technical PRD](docs/PRD.md): requirements and technical decisions
- [Roadmap and milestone plans](docs/plans/README.md)
- [Agent guide](CLAUDE.md): conventions every AI tool follows in this repo
- [Work log](worklog/): wins, issues, decisions and learnings recorded during the build

## Getting started

You need Node.js 24 (see `.nvmrc`) and pnpm 12.

```bash
pnpm install
pnpm check
```

`pnpm check` runs everything CI runs: Biome, TypeScript, Vitest and the work-log check.

## Repository layout

```
packages/shared    API and real-time contract: zod schemas and types
packages/worklog   work-log schema, parser, CLIs and Stop-hook logic
worklog/           work-log entries, one Markdown file each
docs/              PRD and plans (infrastructure and review docs follow)
.claude/           Claude Code settings, hooks and skills
```

## How this repo is built with AI

Work follows the PRD and a plan per milestone, executed by one AI subagent per task with a review between tasks. [CLAUDE.md](CLAUDE.md) sets the conventions, hooks keep formatting consistent and prompt agents to keep the [work log](worklog/) up to date, and every milestone lands as a pull request that CI must pass.
````

- [ ] **Step 3: Run the full check**

Run: `pnpm check`

Expected: no Biome or `tsc` errors, `Tests  66 passed (66)` and `✔ 10 work-log entries are valid`.

- [ ] **Step 4: Record the task in the work log**

```bash
pnpm worklog:new --title "CI quality gate and README" --phase setup --outcome win \
  --task M1-T5 --agent "implementer · claude-opus-5"
```

Fill in the three sections, then run `pnpm worklog:check`.

Expected: `✔ 11 work-log entries are valid`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -F - <<'EOF'
ci: run lint, typecheck, tests and work-log check on every PR

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: Push the branch and open the pull request**

The user approved this flow for milestone pull requests. Never merge without their explicit OK.

```bash
git push -u origin m1-foundation
gh pr create --base main --head m1-foundation --title "M1: Foundation" --body-file - <<'EOF'
## Summary

M1 of the [roadmap](https://github.com/pogadev18/wolfchatter/blob/m1-foundation/docs/plans/README.md), following [the M1 plan](https://github.com/pogadev18/wolfchatter/blob/m1-foundation/docs/plans/2026-09-15-m1-foundation.md):

- pnpm 12 workspace with TypeScript 7, Biome 2.5 and Vitest 5; Node 24 runs TypeScript directly
- `@wolfchatter/shared`: zod contract for rooms, messages, errors, health and socket events
- `@wolfchatter/worklog`: entry schema, parser, validator and the `worklog:new` / `worklog:check` CLIs
- Agent setup: `CLAUDE.md`, `AGENTS.md`, a format-on-edit hook, a work-log reminder hook and the `worklog` skill
- CI: Biome, typecheck, tests and work-log check on every PR and push to `main`

## Test plan

- [x] `pnpm check` passes locally (66 tests, 11 work-log entries)
- [x] Both hooks verified by piping Claude Code's hook JSON into them
- [ ] CI passes on this pull request

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Expected: `gh` prints the pull request URL.

- [ ] **Step 7: Get CI green**

Wait for the `Lint, typecheck, test, work log` check to finish. If it fails, read the failed log (`gh run view --log-failed`), fix the cause (test-first if it's a code bug), record an `issue` entry in the work log, commit, and push again. Repeat until the check passes.

- [ ] **Step 8: Hand over to the user**

Report the pull request URL, the CI result, and anything the work log recorded as an `issue`. Then **stop**: the user reviews and approves the merge, and the M2 plan is written after M1 is merged.

---

## Milestone checklist

- [ ] `pnpm check` passes on a fresh clone after `pnpm install`.
- [ ] 66 tests pass, and 11 work-log entries are valid.
- [ ] `.claude/settings.json` registers both hooks, and both were verified with piped input.
- [ ] The CI check `Lint, typecheck, test, work log` is green on the pull request.
- [ ] The pull request is open, and the user has been asked to review it.
