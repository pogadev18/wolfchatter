import {
  type DevlogEntry,
  WORKLOG_AGENT_ROLES,
  WORKLOG_OUTCOMES,
  WORKLOG_PHASES,
  type WorklogAgentRole,
  type WorklogOutcome,
  type WorklogPhase,
} from '@wolfchatter/worklog'

export const PHASE_PARAM = 'phase'
export const OUTCOME_PARAM = 'outcome'
export const AGENT_PARAM = 'agent'

/** The devlog's three filter dimensions. Unset means "don't filter on this". */
export interface DevlogFilters {
  phase?: WorklogPhase
  outcome?: WorklogOutcome
  agent?: WorklogAgentRole
}

/** What to offer in each filter's dropdown, derived from the entries actually present. */
export interface DevlogFilterOptions {
  phases: WorklogPhase[]
  outcomes: WorklogOutcome[]
  agents: WorklogAgentRole[]
}

export interface FilteredDevlog {
  visible: DevlogEntry[]
  options: DevlogFilterOptions
}

/** The role an entry's `agent` field names, e.g. `'implementer'` from `'implementer · claude-sonnet-5'`. */
export function agentRole(agent: string): WorklogAgentRole | undefined {
  // `split` on any string, including '', always returns at least one element, but
  // `noUncheckedIndexedAccess` cannot know that; '' falls through to `oneOf` and never matches.
  const [role = ''] = agent.split(' · ')
  return oneOf(role, WORKLOG_AGENT_ROLES)
}

/**
 * Reads the devlog's filters from the URL. A value that is not a real phase, outcome or agent
 * role (missing, empty, or unknown) comes back `undefined` rather than throwing or emptying the
 * page — the caller then shows the unfiltered view for that dimension.
 */
export function parseDevlogFilters(searchParams: URLSearchParams): DevlogFilters {
  return {
    phase: oneOf(searchParams.get(PHASE_PARAM), WORKLOG_PHASES),
    outcome: oneOf(searchParams.get(OUTCOME_PARAM), WORKLOG_OUTCOMES),
    agent: oneOf(searchParams.get(AGENT_PARAM), WORKLOG_AGENT_ROLES),
  }
}

/**
 * The entries `filters` selects, and the options every filter dropdown should offer. Options
 * come from `entries` alone — never from `filters` — so choosing one filter never removes another
 * dimension's other choices, and are ordered as the schema declares them, not by first occurrence.
 */
export function filterDevlog(
  entries: readonly DevlogEntry[],
  filters: DevlogFilters,
): FilteredDevlog {
  return {
    visible: entries.filter((entry) => matches(entry, filters)),
    options: {
      phases: presentValues(
        entries.map((entry) => entry.phase),
        WORKLOG_PHASES,
      ),
      outcomes: presentValues(
        entries.map((entry) => entry.outcome),
        WORKLOG_OUTCOMES,
      ),
      agents: presentValues(
        entries.map((entry) => agentRole(entry.agent)).filter(isDefined),
        WORKLOG_AGENT_ROLES,
      ),
    },
  }
}

/** `current` with `key` set to `value`, or removed when `value` is undefined; every other param is untouched. */
export function withFilter(
  current: URLSearchParams,
  key: string,
  value: string | undefined,
): URLSearchParams {
  const next = new URLSearchParams(current)
  if (value === undefined) next.delete(key)
  else next.set(key, value)
  return next
}

function matches(entry: DevlogEntry, filters: DevlogFilters): boolean {
  if (filters.phase !== undefined && entry.phase !== filters.phase) return false
  if (filters.outcome !== undefined && entry.outcome !== filters.outcome) return false
  if (filters.agent !== undefined && agentRole(entry.agent) !== filters.agent) return false
  return true
}

/** The values from `order` that occur at least once in `values`, in `order`'s own sequence. */
function presentValues<T>(values: readonly T[], order: readonly T[]): T[] {
  const present = new Set(values)
  return order.filter((value) => present.has(value))
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((option) => option === value)
}
