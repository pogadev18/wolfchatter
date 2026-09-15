import { describe, expect, it } from 'vitest'
import { needsWorklogReminder, parseGitStatus } from './reminder.ts'

describe('needsWorklogReminder', () => {
  it('reminds when work changed without a work-log entry', () => {
    expect(needsWorklogReminder(['packages/shared/src/rooms.ts'])).toBe(true)
  })

  it('stays quiet when an entry was added alongside the work', () => {
    const changed = ['packages/shared/src/rooms.ts', 'worklog/2026-09-15T1432-rooms.md']
    expect(needsWorklogReminder(changed)).toBe(false)
  })

  it('stays quiet when nothing changed or only a plan was ticked off', () => {
    expect(needsWorklogReminder([])).toBe(false)
    expect(needsWorklogReminder(['docs/plans/2026-09-15-m1-foundation.md'])).toBe(false)
  })
})

describe('parseGitStatus', () => {
  it('reads modified, untracked and renamed paths', () => {
    const output = [
      ' M package.json',
      '?? worklog/2026-09-15T1432-new.md',
      'R  src/new-name.ts',
      'src/old-name.ts',
      '',
    ].join('\0')
    expect(parseGitStatus(output)).toEqual([
      'package.json',
      'worklog/2026-09-15T1432-new.md',
      'src/new-name.ts',
    ])
  })

  it('keeps spaces in paths and handles a clean tree', () => {
    expect(parseGitStatus(' M docs/my notes.md\0')).toEqual(['docs/my notes.md'])
    expect(parseGitStatus('')).toEqual([])
  })
})
