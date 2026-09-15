import { describe, expect, it } from 'vitest'
import { buildEntry, slugify } from './create.ts'
import { parseWorklogFile } from './parse.ts'

const now = new Date('2026-09-15T14:32:47.123Z')
const agent = 'implementer · claude-opus-5'

describe('slugify', () => {
  it('keeps lowercase letters and digits joined by dashes', () => {
    expect(slugify('Socket event arrived before the HTTP response!')).toBe(
      'socket-event-arrived-before-the-http-response',
    )
  })

  it('strips accents', () => {
    expect(slugify('Întâlnire cu echipa')).toBe('intalnire-cu-echipa')
  })

  it('stops at 60 characters without a trailing dash', () => {
    const slug = slugify(`${'word '.repeat(20)}end`)
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('buildEntry', () => {
  it('names the file after the UTC minute and the title', () => {
    const { fileName } = buildEntry({
      title: 'Scaffolded the workspace',
      phase: 'setup',
      outcome: 'win',
      task: 'M1-T1',
      agent,
      now,
    })
    expect(fileName).toBe('2026-09-15T1432-scaffolded-the-workspace.md')
  })

  it('writes frontmatter that parses once the body is filled in', () => {
    const { fileName, content } = buildEntry({
      title: 'Rate limiter: ignored proxy IPs',
      phase: 'api',
      outcome: 'issue',
      severity: 'medium',
      agent,
      now,
    })
    const filled = content.replace(
      '## What happened\n',
      '## What happened\n\nAll clients shared one rate-limit bucket.\n',
    )
    expect(parseWorklogFile(fileName, filled)).toMatchObject({
      ok: true,
      entry: {
        title: 'Rate limiter: ignored proxy IPs',
        date: '2026-09-15T14:32:47Z',
        severity: 'medium',
        commits: [],
        related: [],
      },
    })
  })

  it('leaves the body empty so the check forces a real description', () => {
    const { fileName, content } = buildEntry({
      title: 'Empty entry',
      phase: 'docs',
      outcome: 'learning',
      agent,
      now,
    })
    expect(parseWorklogFile(fileName, content).ok).toBe(false)
  })

  it('rejects options that would create an invalid entry', () => {
    expect(() =>
      buildEntry({ title: 'Broken', phase: 'api', outcome: 'issue', agent, now }),
    ).toThrow()
    expect(() => buildEntry({ title: '!!!', phase: 'api', outcome: 'win', agent, now })).toThrow(
      'title must contain letters or digits',
    )
  })
})
