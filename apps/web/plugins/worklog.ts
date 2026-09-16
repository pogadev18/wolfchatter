import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDevlogEntries,
  isShallowRepository,
  parseAddedCommits,
  type WorklogFile,
} from '@wolfchatter/worklog'
import { marked } from 'marked'
import type { Plugin } from 'vite'

const VIRTUAL_MODULE_ID = 'virtual:worklog'
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`

// Resolved from this file's own location, not process.cwd(), so the plugin works no matter
// where `vite`/`vitest` was invoked from.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const WORKLOG_DIR = join(REPO_ROOT, 'worklog')

function readWorklogFiles(): WorklogFile[] {
  return readdirSync(WORKLOG_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => ({ name, content: readFileSync(join(WORKLOG_DIR, name), 'utf8') }))
}

/**
 * The commit that added each work-log file, keyed by file name. A deployed build may run from a
 * shallow clone, or without git at all, so this degrades to an empty map instead of failing the
 * build — every `commit` then comes back `null`. Entries are never renamed, so `--diff-filter=A`
 * without `--follow` is correct; a rename would silently drop the commit.
 */
function readAddedCommits(): ReadonlyMap<string, string> {
  try {
    // Checked before the log walk below, not after: a shallow clone's boundary commit has no
    // parent, so `git log --diff-filter=A` would otherwise treat it as having added every
    // work-log file and confidently attribute them all to that one commit — wrong, not missing.
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    if (isShallowRepository(shallow)) {
      console.warn(
        '[wolfchatter:worklog] shallow git history for worklog/; every commit will be null',
      )
      return new Map()
    }

    const gitLog = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--format=%H', '--name-only', '--reverse', '--', 'worklog'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    return parseAddedCommits(gitLog)
  } catch {
    console.warn('[wolfchatter:worklog] no git history for worklog/; every commit will be null')
    return new Map()
  }
}

// marked does not sanitise: any raw HTML already in the Markdown source passes straight through.
// That is safe here only because the source is always a file under worklog/ — committed and
// reviewed like the rest of this repository, never user- or request-supplied. The result is
// later dropped into the page unescaped (dangerouslySetInnerHTML), so the day this function's
// input stops being "our own contributors' committed Markdown" is the day it needs a sanitiser
// in front of it.
function renderBody(markdown: string): string {
  return marked.parse(markdown, { async: false })
}

function buildModuleCode(): string {
  // buildDevlogEntries throws on an invalid entry, which must fail the build — unlike the git
  // lookup above, this is never caught.
  const entries = buildDevlogEntries(readWorklogFiles(), readAddedCommits(), renderBody)
  return `export const entries = ${JSON.stringify(entries)}\n`
}

/** Serves `worklog/*.md`, validated and commit-annotated, as the virtual module `virtual:worklog`. */
export function worklogPlugin(): Plugin {
  return {
    name: 'wolfchatter:worklog',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) return buildModuleCode()
    },
    configureServer(server) {
      // worklog/ is outside the project root, so it is not watched by default.
      server.watcher.add(WORKLOG_DIR)
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.startsWith(`${WORKLOG_DIR}/`)) return
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
      if (mod) ctx.server.moduleGraph.invalidateModule(mod)
      ctx.server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}
