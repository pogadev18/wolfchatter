import { describe, expect, it } from 'vitest'
import { isShallowRepository, parseAddedCommits } from './history.ts'

const SHA_1 = '1111111111111111111111111111111111111111'
const SHA_2 = '2222222222222222222222222222222222222222'
const SHA_3 = '3333333333333333333333333333333333333333'

/** One block of `git log --name-only` output: a SHA, a blank line, then the paths it added. */
function commitBlock(sha: string, paths: readonly string[]): string {
  return [sha, '', ...paths].join('\n')
}

describe('parseAddedCommits', () => {
  it('maps each file to the commit that added it', () => {
    // Real `git log` output ends with a trailing newline after the last path.
    const gitLog = `${[
      commitBlock(SHA_1, ['worklog/2026-09-15T0905-first.md', 'worklog/2026-09-15T0915-second.md']),
      commitBlock(SHA_2, ['worklog/2026-09-15T1000-third.md']),
    ].join('\n')}\n`

    expect(parseAddedCommits(gitLog)).toEqual(
      new Map([
        ['2026-09-15T0905-first.md', SHA_1],
        ['2026-09-15T0915-second.md', SHA_1],
        ['2026-09-15T1000-third.md', SHA_2],
      ]),
    )
  })

  it('keeps the earliest commit when a file is added, deleted and re-added', () => {
    // --reverse puts the oldest commit first; the log has no delete events to look at.
    const gitLog = [
      commitBlock(SHA_1, ['worklog/2026-09-15T0905-flaky.md']),
      commitBlock(SHA_2, ['worklog/2026-09-15T1000-unrelated.md']),
      commitBlock(SHA_3, ['worklog/2026-09-15T0905-flaky.md']),
    ].join('\n')

    expect(parseAddedCommits(gitLog).get('2026-09-15T0905-flaky.md')).toBe(SHA_1)
  })

  it('returns an empty map for empty input, as a shallow clone with no add events would', () => {
    expect(parseAddedCommits('')).toEqual(new Map())
  })

  it('ignores paths outside worklog/ and paths that are not markdown', () => {
    const gitLog = commitBlock(SHA_1, [
      'worklog/2026-09-15T0905-real-entry.md',
      'docs/plans/2026-09-16-m4-golive.md',
      'worklog/README.txt',
    ])

    expect(parseAddedCommits(gitLog)).toEqual(new Map([['2026-09-15T0905-real-entry.md', SHA_1]]))
  })
})

describe('isShallowRepository', () => {
  it('FR-8: is true for `git rev-parse --is-shallow-repository`’s shallow output', () => {
    expect(isShallowRepository('true\n')).toBe(true)
  })

  it('is false for its full-history output', () => {
    expect(isShallowRepository('false\n')).toBe(false)
  })

  it('tolerates output with no trailing newline', () => {
    expect(isShallowRepository('true')).toBe(true)
  })
})
