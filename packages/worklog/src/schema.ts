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
