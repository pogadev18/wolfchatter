import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { buildEntry } from '../create.ts'
import {
  WORKLOG_AGENT_ROLES,
  WORKLOG_OUTCOMES,
  WORKLOG_PHASES,
  WORKLOG_SEVERITIES,
} from '../schema.ts'

const USAGE = `Usage: pnpm worklog:new --title "…" --phase <${WORKLOG_PHASES.join('|')}>
  --outcome <${WORKLOG_OUTCOMES.join('|')}> --agent "<role> · <model id>"
  [--severity <${WORKLOG_SEVERITIES.join('|')}>] [--task M1-T2] [--dir worklog]
Roles: ${WORKLOG_AGENT_ROLES.join(', ')}. Example: --agent "implementer · claude-sonnet-5"`

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
      agent: { type: 'string' },
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
