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

  it('orders entries that share a date by id, comparing code units', () => {
    // A collation that ignores punctuation, such as Thai, would put "rename" before "re-run".
    const date = '2026-09-15T10:00:00Z'
    const report = validateWorklog([
      entryFile('2026-09-15T1000-rename-the-table.md', { date }),
      entryFile('2026-09-15T1000-re-run-the-migration.md', { date }),
    ])
    expect(report.entries.map((entry) => entry.id)).toEqual([
      '2026-09-15T1000-re-run-the-migration',
      '2026-09-15T1000-rename-the-table',
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
