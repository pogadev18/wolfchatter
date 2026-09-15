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
