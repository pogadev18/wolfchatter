import { entries } from 'virtual:worklog'
import { useId } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EntryCard } from './entry-card.tsx'
import {
  AGENT_PARAM,
  filterDevlog,
  OUTCOME_PARAM,
  PHASE_PARAM,
  parseDevlogFilters,
  withFilter,
} from './filters.ts'
import { groupByDay } from './group-by-day.ts'

/** `entries` never changes at runtime: `virtual:worklog` is resolved once, at build time. */
const entriesById = new Map(entries.map((entry) => [entry.id, entry]))

/** Day headings in the viewer's locale, like the chat panel (`Intl.DateTimeFormat`). */
const DAY_HEADING = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

/** FR-8: the AI work log at `/devlog`, as a filterable, deep-linkable timeline. */
export function DevlogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseDevlogFilters(searchParams)
  const { visible, options } = filterDevlog(entries, filters)
  const groups = groupByDay(visible)

  // Merges into the current params rather than replacing them, so picking one filter never
  // drops another that was already set (all three live in the URL at once).
  function setFilter(param: string, value: string | undefined) {
    setSearchParams(withFilter(searchParams, param, value), { replace: true })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <Link to="/" className="text-rose-700 text-sm underline">
        ← Back to the map
      </Link>
      <h1 className="mt-4 font-semibold text-2xl text-stone-900">Devlog</h1>
      <p className="mt-1 text-stone-600 text-sm">
        An honest engineering diary kept by the AI agents (and humans) building Wolfchatter.
      </p>

      <fieldset className="mt-6 flex flex-wrap gap-4 border-0 p-0">
        <legend className="sr-only">Filter the timeline</legend>
        <FilterSelect
          label="Phase"
          value={filters.phase}
          options={options.phases}
          onChange={(value) => setFilter(PHASE_PARAM, value)}
        />
        <FilterSelect
          label="Outcome"
          value={filters.outcome}
          options={options.outcomes}
          onChange={(value) => setFilter(OUTCOME_PARAM, value)}
        />
        <FilterSelect
          label="Agent"
          value={filters.agent}
          options={options.agents}
          onChange={(value) => setFilter(AGENT_PARAM, value)}
        />
      </fieldset>

      <p role="status" className="mt-4 text-stone-500 text-sm">
        {visible.length === 0
          ? 'No entries match these filters.'
          : `${visible.length} ${visible.length === 1 ? 'entry' : 'entries'}`}
      </p>

      {groups.map((group) => {
        const [first] = group.entries
        if (!first) throw new Error('groupByDay produced an empty group')
        return (
          <section key={group.key} className="mt-6">
            <h2 className="text-stone-500 text-xs uppercase tracking-wide">
              {DAY_HEADING.format(new Date(first.date))}
            </h2>
            <ol>
              {group.entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} entriesById={entriesById} />
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string | undefined
  /** Built from the entries present, not the schema's full enum — see `filters.ts`. */
  options: readonly string[]
  onChange(value: string | undefined): void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-stone-600 text-xs">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
        className="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
