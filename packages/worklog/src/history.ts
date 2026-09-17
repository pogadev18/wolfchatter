const SHA_LINE = /^[0-9a-f]{40}$/
const WORKLOG_DIR = 'worklog/'

/**
 * Parses the output of `git log --diff-filter=A --format=%H --name-only --reverse -- worklog`
 * into a map from work-log file name (no directory) to the SHA of the commit that added it.
 *
 * The input is blocks of a 40-character SHA, a blank line, then the paths that commit added.
 * `--reverse` puts the oldest commit first, so when a path appears twice (deleted and re-added),
 * the first occurrence — the commit that introduced the entry — wins.
 */
export function parseAddedCommits(gitLog: string): Map<string, string> {
  const commits = new Map<string, string>()
  const lines = gitLog.split('\n')

  let index = 0
  while (index < lines.length) {
    const sha = lines[index]
    index++
    if (sha === undefined || !SHA_LINE.test(sha)) continue

    while (index < lines.length) {
      const line = lines[index]
      if (line === undefined || SHA_LINE.test(line)) break
      index++
      if (line.startsWith(WORKLOG_DIR) && line.endsWith('.md')) {
        const name = line.slice(WORKLOG_DIR.length)
        if (!commits.has(name)) commits.set(name, sha)
      }
    }
  }

  return commits
}

/**
 * Parses `git rev-parse --is-shallow-repository`'s stdout (`"true"` or `"false"`, plus a
 * trailing newline). A shallow clone's boundary commit has no parent, so `git log
 * --diff-filter=A` treats it as having added every file its tree can see — usually every
 * work-log file that exists — and attributes them all to that one commit. That is confidently
 * wrong, not merely missing: the caller must check this *before* trusting a `git log` walk, and
 * attribute nothing at all when it is true.
 */
export function isShallowRepository(output: string): boolean {
  return output.trim() === 'true'
}
