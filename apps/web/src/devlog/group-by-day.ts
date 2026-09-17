import type { DevlogEntry } from '@wolfchatter/worklog'

export interface DevlogDayGroup {
  /** A per-viewer-time-zone day key, unique per group and stable within it; not for display. */
  key: string
  entries: DevlogEntry[]
}

// `en-CA` alone renders as plain YYYY-MM-DD regardless of the viewer's own locale, which is all
// that is asked of it here: a comparison key. No `timeZone` is set, so — like the rest of the
// app's date handling — the day boundary itself follows the viewer's local time zone.
const DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Groups entries by the viewer's local calendar day, keeping the incoming order both across and
 * within groups — the devlog always passes entries newest first, and this must not re-sort them.
 */
export function groupByDay(entries: readonly DevlogEntry[]): DevlogDayGroup[] {
  const groups: DevlogDayGroup[] = []
  for (const entry of entries) {
    const key = DAY_KEY.format(new Date(entry.date))
    const last = groups.at(-1)
    if (last?.key === key) last.entries.push(entry)
    else groups.push({ key, entries: [entry] })
  }
  return groups
}
