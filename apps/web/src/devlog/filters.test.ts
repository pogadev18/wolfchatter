import type { DevlogEntry } from '@wolfchatter/worklog'
import { describe, expect, it } from 'vitest'
import { agentRole, filterDevlog, parseDevlogFilters, withFilter } from './filters.ts'

/** A minimal, valid `DevlogEntry`; every field but `id` has a sensible default to override. */
function entry(overrides: Partial<DevlogEntry> & Pick<DevlogEntry, 'id'>): DevlogEntry {
  return {
    title: overrides.id,
    date: '2026-01-01T12:00:00Z',
    agent: 'implementer · claude-sonnet-5',
    phase: 'web',
    outcome: 'win',
    commits: [],
    related: [],
    body: 'Body',
    commit: null,
    html: '<p>Body</p>',
    ...overrides,
  }
}

describe('filterDevlog', () => {
  const entries = [
    entry({ id: 'a', phase: 'web', outcome: 'win', agent: 'lead · claude-opus-5' }),
    entry({
      id: 'b',
      phase: 'api',
      outcome: 'issue',
      severity: 'high',
      agent: 'implementer · claude-sonnet-5',
    }),
    entry({
      id: 'c',
      phase: 'web',
      outcome: 'issue',
      severity: 'low',
      agent: 'implementer · claude-sonnet-5',
    }),
  ]

  it('shows every entry when nothing is filtered', () => {
    expect(filterDevlog(entries, {}).visible).toEqual(entries)
  })

  it('FR-8: filters by phase', () => {
    const { visible } = filterDevlog(entries, { phase: 'web' })
    expect(visible.map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('FR-8: filters by outcome', () => {
    const { visible } = filterDevlog(entries, { outcome: 'issue' })
    expect(visible.map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('FR-8: filters by phase and outcome together', () => {
    const { visible } = filterDevlog(entries, { phase: 'web', outcome: 'issue' })
    expect(visible.map((e) => e.id)).toEqual(['c'])
  })

  it('FR-8: filters by agent role', () => {
    const { visible } = filterDevlog(entries, { agent: 'lead' })
    expect(visible.map((e) => e.id)).toEqual(['a'])
  })

  it('FR-8: a filter that matches nothing shows no entries, not the unfiltered list', () => {
    const { visible } = filterDevlog(entries, { phase: 'deploy' })
    expect(visible).toEqual([])
  })

  it('FR-8: builds options from the entries present, in the schema’s own order', () => {
    const { options } = filterDevlog(entries, {})
    // Schema order is plan, setup, api, web, ...; 'api' sorts before 'web' there even though
    // 'web' appears first among these entries.
    expect(options.phases).toEqual(['api', 'web'])
    expect(options.outcomes).toEqual(['win', 'issue'])
    expect(options.agents).toEqual(['lead', 'implementer'])
  })

  it('keeps every present option even once a filter narrows what is visible', () => {
    const { options } = filterDevlog(entries, { phase: 'web' })
    expect(options.phases).toEqual(['api', 'web'])
  })
})

describe('parseDevlogFilters', () => {
  it('reads phase, outcome and agent from the URL', () => {
    const params = new URLSearchParams('phase=api&outcome=issue&agent=implementer')
    expect(parseDevlogFilters(params)).toEqual({
      phase: 'api',
      outcome: 'issue',
      agent: 'implementer',
    })
  })

  it('FR-8: ignores a value that is not a real phase, outcome or agent role', () => {
    const params = new URLSearchParams('phase=bogus&outcome=&agent=robot')
    expect(parseDevlogFilters(params)).toEqual({
      phase: undefined,
      outcome: undefined,
      agent: undefined,
    })
  })

  it('leaves a filter unset when its param is missing', () => {
    expect(parseDevlogFilters(new URLSearchParams(''))).toEqual({
      phase: undefined,
      outcome: undefined,
      agent: undefined,
    })
  })
})

describe('agentRole', () => {
  it('reads the role before the middle dot', () => {
    expect(agentRole('implementer · claude-sonnet-5')).toBe('implementer')
  })

  it('is undefined for a role the schema does not know', () => {
    expect(agentRole('robot · claude-opus-5')).toBeUndefined()
  })
})

describe('withFilter', () => {
  it('sets a param without touching the others', () => {
    const current = new URLSearchParams('phase=api&outcome=issue')
    expect(withFilter(current, 'outcome', 'win').toString()).toBe('phase=api&outcome=win')
  })

  it('removes a param when the value is undefined, keeping the others', () => {
    const current = new URLSearchParams('phase=api&outcome=issue')
    expect(withFilter(current, 'outcome', undefined).toString()).toBe('phase=api')
  })
})
