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
    .replace(/\p{M}/gu, '')
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
