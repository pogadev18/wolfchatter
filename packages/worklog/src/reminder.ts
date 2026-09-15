import { WORKLOG_FILE_NAME } from './parse.ts'

const WORKLOG_DIR = 'worklog/'

/** Changes under these paths never need a work-log entry of their own. */
const EXEMPT_PREFIXES = [WORKLOG_DIR, 'docs/plans/']

/**
 * True when work changed but no work-log entry did. The Stop hook uses this to
 * ask the agent to record what happened before it finishes.
 */
export function needsWorklogReminder(changedPaths: readonly string[]): boolean {
  const addedEntry = changedPaths.some(
    (path) =>
      path.startsWith(WORKLOG_DIR) && WORKLOG_FILE_NAME.test(path.slice(WORKLOG_DIR.length)),
  )
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
