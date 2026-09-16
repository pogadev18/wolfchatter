import type { WorklogEntry } from './schema.ts'
import { validateWorklog, type WorklogFile } from './validate.ts'

export interface DevlogEntry extends WorklogEntry {
  /** The commit that added the entry's file, or null when history does not reach it. */
  commit: string | null
  /**
   * The entry's Markdown body, rendered to HTML at build time for direct, unescaped insertion
   * into the page. That is safe only because of where the Markdown comes from: a file under this
   * repository's own `worklog/`, committed and code-reviewed like any other source file, never
   * written by a user or taken from a request — the opposite of the chat messages the PRD
   * requires to render as plain text. The day this type is reused for content someone other than
   * this project's own contributors can write, that argument stops holding and the HTML needs
   * sanitising before it can be trusted again.
   */
  html: string
}

/**
 * Validates every work-log file, then attaches the commit that added it and its rendered body.
 * Throws when any file is invalid — a broken entry must fail the build, exactly as
 * `pnpm worklog:check` fails CI.
 */
export function buildDevlogEntries(
  files: readonly WorklogFile[],
  commits: ReadonlyMap<string, string>,
  renderBody: (markdown: string) => string,
): DevlogEntry[] {
  const { entries, errors } = validateWorklog(files)
  if (errors.length > 0) {
    throw new Error(`Invalid work-log entries:\n${errors.join('\n')}`)
  }

  // validateWorklog sorts oldest first; the devlog reads newest first.
  return entries.reverse().map((entry) => ({
    ...entry,
    commit: commits.get(`${entry.id}.md`) ?? null,
    html: renderBody(entry.body),
  }))
}
