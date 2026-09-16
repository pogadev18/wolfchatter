import type { DevlogEntry } from '@wolfchatter/worklog'
import { describe, expect, it } from 'vitest'
import { groupByDay } from './group-by-day.ts'

function entry(id: string, date: string): DevlogEntry {
  return {
    id,
    title: id,
    date,
    agent: 'implementer · claude-sonnet-5',
    phase: 'web',
    outcome: 'win',
    commits: [],
    related: [],
    body: 'Body',
    commit: null,
    html: '<p>Body</p>',
  }
}

describe('groupByDay', () => {
  it('returns nothing for no entries', () => {
    expect(groupByDay([])).toEqual([])
  })

  it('puts entries a few minutes apart in one group', () => {
    // Both at noon UTC: whatever the viewer's time zone, a shift of a fixed offset moves them by
    // the same amount, so they land on the same local calendar day for any real-world offset.
    const first = entry('a', '2026-01-10T12:00:00Z')
    const second = entry('b', '2026-01-10T12:05:00Z')

    const groups = groupByDay([first, second])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.entries).toEqual([first, second])
  })

  it('FR-8: starts a new group for a day 24 hours apart from the last', () => {
    // 24 hours apart at the same UTC clock time always crosses a local midnight, whatever the
    // viewer's time zone (even with a DST shift), so this is never flaky.
    const dayOne = entry('a', '2026-01-10T12:00:00Z')
    const dayTwo = entry('b', '2026-01-11T12:00:00Z')

    const groups = groupByDay([dayOne, dayTwo])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.entries).toEqual([dayOne])
    expect(groups[1]?.entries).toEqual([dayTwo])
  })

  it('preserves the incoming order, both across and within groups', () => {
    // The devlog always passes entries newest first; grouping must not re-sort them.
    const newest = entry('c', '2026-01-11T09:00:00Z')
    const middle = entry('b', '2026-01-10T15:00:00Z')
    const oldest = entry('a', '2026-01-10T08:00:00Z')

    const groups = groupByDay([newest, middle, oldest])

    expect(groups.map((group) => group.entries.map((e) => e.id))).toEqual([['c'], ['b', 'a']])
  })

  it('gives each group a key that is stable for entries on the same day and unique otherwise', () => {
    const [group1, group2] = groupByDay([
      entry('a', '2026-01-10T12:00:00Z'),
      entry('b', '2026-01-11T12:00:00Z'),
    ])

    expect(group1?.key).not.toBe(group2?.key)
  })
})
