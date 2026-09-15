import { describe, expect, it } from 'vitest'
import { fileStamp, parseWorklogFile } from './parse.ts'

const validContent = `---
title: Stamen tiles moved to Stadia Maps
date: 2026-09-15T09:05:00Z
agent: lead · claude-opus-5
phase: plan
outcome: learning
---

## What happened

The CodePen's tile URL points at tile.stamen.com, which shut down in 2023.
`

describe('fileStamp', () => {
  it('turns an ISO date into the file name prefix', () => {
    expect(fileStamp('2026-09-15T09:05:59Z')).toBe('2026-09-15T0905')
  })
})

describe('parseWorklogFile', () => {
  it('parses a valid entry and derives the id from the file name', () => {
    const result = parseWorklogFile('2026-09-15T0905-stamen-tiles.md', validContent)
    expect(result).toMatchObject({
      ok: true,
      entry: {
        id: '2026-09-15T0905-stamen-tiles',
        title: 'Stamen tiles moved to Stadia Maps',
        outcome: 'learning',
        commits: [],
        related: [],
      },
    })
    expect(result.ok && result.entry.body.startsWith('## What happened')).toBe(true)
  })

  it.each([
    'notes.md',
    '2026-09-15-stamen.md',
    '2026-09-15T0905-Stamen_Tiles.md',
    '2026-09-15T0905-stamen.txt',
  ])('rejects the file name %s', (fileName) => {
    expect(parseWorklogFile(fileName, validContent)).toEqual({
      ok: false,
      errors: ['file name must look like 2026-09-15T1432-short-slug.md'],
    })
  })

  it('rejects content without frontmatter', () => {
    expect(parseWorklogFile('2026-09-15T0905-stamen.md', '# Just a heading')).toEqual({
      ok: false,
      errors: ['missing frontmatter: start the file with a --- block'],
    })
  })

  it('reports invalid YAML', () => {
    const result = parseWorklogFile('2026-09-15T0905-stamen.md', '---\ntitle: [unclosed\n---\nbody')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]).toMatch(/^frontmatter is not valid YAML/)
  })

  it('reports schema errors with their field', () => {
    const content = validContent.replace('outcome: learning', 'outcome: issue')
    expect(parseWorklogFile('2026-09-15T0905-stamen.md', content)).toEqual({
      ok: false,
      errors: ['severity: severity is required for issues and not allowed for other outcomes'],
    })
  })

  it('rejects a date that does not match the file name', () => {
    expect(parseWorklogFile('2026-09-15T1000-stamen.md', validContent)).toEqual({
      ok: false,
      errors: ['date 2026-09-15T09:05:00Z does not match the file name prefix 2026-09-15T1000'],
    })
  })

  it('rejects a body that only has headings', () => {
    const content = validContent.replace(/The CodePen.*\n/, '')
    expect(parseWorklogFile('2026-09-15T0905-stamen.md', content)).toEqual({
      ok: false,
      errors: ['body is empty: describe what happened, what went well or not, and the takeaway'],
    })
  })
})
