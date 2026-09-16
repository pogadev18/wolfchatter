import { describe, expect, it } from 'vitest'
import { buildDevlogEntries } from './devlog.ts'
import type { WorklogFile } from './validate.ts'

function entryFile(name: string, fields: Record<string, string> = {}): WorklogFile {
  const frontmatter = Object.entries({
    title: 'An entry title',
    date: '2026-09-15T09:00:00Z',
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

const identity = (markdown: string) => markdown

describe('buildDevlogEntries', () => {
  it('returns entries newest first', () => {
    const files = [
      entryFile('2026-09-15T0900-earlier.md', { date: '2026-09-15T09:00:00Z' }),
      entryFile('2026-09-15T1000-later.md', { date: '2026-09-15T10:00:00Z' }),
    ]

    const entries = buildDevlogEntries(files, new Map(), identity)

    expect(entries.map((entry) => entry.id)).toEqual([
      '2026-09-15T1000-later',
      '2026-09-15T0900-earlier',
    ])
  })

  it('throws with the file name when an entry is invalid', () => {
    const files = [entryFile('oops.md')]

    expect(() => buildDevlogEntries(files, new Map(), identity)).toThrow(/oops\.md/)
  })

  it('sets commit to null when the file has no entry in the commit map', () => {
    const files = [entryFile('2026-09-15T0900-earlier.md')]

    const entries = buildDevlogEntries(files, new Map(), identity)

    expect(entries[0]?.commit).toBeNull()
  })

  it('sets commit to the SHA the commit map has for that file', () => {
    const files = [entryFile('2026-09-15T0900-earlier.md')]
    const commits = new Map([['2026-09-15T0900-earlier.md', 'a'.repeat(40)]])

    const entries = buildDevlogEntries(files, commits, identity)

    expect(entries[0]?.commit).toBe('a'.repeat(40))
  })

  it('sets html to whatever the injected renderer returns', () => {
    const files = [entryFile('2026-09-15T0900-earlier.md')]

    const entries = buildDevlogEntries(files, new Map(), () => '<p>rendered</p>')

    expect(entries[0]?.html).toBe('<p>rendered</p>')
  })
})
