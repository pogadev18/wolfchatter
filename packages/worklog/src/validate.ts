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
