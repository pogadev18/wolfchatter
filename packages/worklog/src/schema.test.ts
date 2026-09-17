import { describe, expect, it } from 'vitest'
import { worklogFrontmatterSchema } from './schema.ts'

const base = {
  title: 'Scaffolded the workspace',
  date: '2026-09-15T14:32:00Z',
  agent: 'implementer · claude-opus-5',
  phase: 'setup',
  outcome: 'win',
}

describe('worklogFrontmatterSchema', () => {
  it('accepts a minimal entry and defaults the link lists', () => {
    expect(worklogFrontmatterSchema.parse(base)).toEqual({ ...base, commits: [], related: [] })
  })

  it('requires a severity for issues', () => {
    const result = worklogFrontmatterSchema.safeParse({ ...base, outcome: 'issue' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['severity'])
  })

  it('accepts an issue with a severity', () => {
    const issue = { ...base, outcome: 'issue', severity: 'high' }
    expect(worklogFrontmatterSchema.safeParse(issue).success).toBe(true)
  })

  it('rejects a severity on other outcomes', () => {
    expect(worklogFrontmatterSchema.safeParse({ ...base, severity: 'low' }).success).toBe(false)
  })

  it('accepts a date with whole seconds', () => {
    const result = worklogFrontmatterSchema.safeParse({ ...base, date: '2026-09-16T04:17:00Z' })
    expect(result.success).toBe(true)
  })

  it.each([
    ['an unknown phase', { phase: 'coding' }],
    ['an unknown outcome', { outcome: 'meh' }],
    ['a malformed task id', { task: 'task 3' }],
    ['a malformed commit', { commits: ['not-a-sha'] }],
    ['a date without a timezone', { date: '2026-09-15T14:32:00' }],
    ['a date with fractional seconds', { date: '2026-09-16T04:17:00.500Z' }],
    ['an unknown field', { mood: 'great' }],
    ['an agent without a role', { agent: 'claude-opus-5' }],
    ['an unknown agent role', { agent: 'robot · claude-opus-5' }],
  ])('rejects %s', (_case, override) => {
    expect(worklogFrontmatterSchema.safeParse({ ...base, ...override }).success).toBe(false)
  })
})
