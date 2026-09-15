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

/** By `date`, then by `id`, comparing code units so the order never depends on the locale. */
function compareEntries(a: WorklogEntry, b: WorklogEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
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

  entries.sort(compareEntries)
  return { entries, errors }
}
