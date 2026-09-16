// Run directly: node apps/api/src/deploy/wait-for-health.ts --url <health url> --commit <sha>
import { parseArgs } from 'node:util'
import { healthResponseSchema } from '@wolfchatter/shared'
import { z } from 'zod'

// A free-tier Render build plus boot is minutes, not seconds.
export const DEFAULT_TIMEOUT_MS = 10 * 60_000
export const DEFAULT_POLL_INTERVAL_MS = 10_000

export interface WaitForHealthOptions {
  url: string
  expectedCommit: string
  timeoutMs?: number
  pollIntervalMs?: number
}

/** Everything the poll loop reads from outside, injected so no test has to wait on real time. */
export interface WaitForHealthDependencies {
  fetch: (url: string) => Promise<Response>
  now: () => number
  sleep: (ms: number) => Promise<void>
}

/**
 * Polls `options.url` until its health response reports `options.expectedCommit`, or the
 * timeout expires. The deploy hook's 200 only means Render *accepted* the request to build —
 * this is the only evidence a deploy actually landed.
 *
 * Every response body is validated with `healthResponseSchema` before its `commit` field is
 * trusted: a proxy's HTML error page, a dropped connection, or a mid-deploy 503 must all be
 * treated the same way — keep polling — rather than crash the wait.
 *
 * The HTTP status code itself is never inspected. A response can be a well-formed 503
 * (`db: "down"`) and still report the right commit — the code is live even if the database
 * check inside it is failing — and that counts as success.
 */
export async function waitForHealth(
  options: WaitForHealthOptions,
  deps: WaitForHealthDependencies,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const deadline = deps.now() + timeoutMs
  // `undefined` means no schema-valid health response has been seen yet at all, distinct from a
  // response whose own `commit` field was `null` (no RENDER_GIT_COMMIT set) — the timeout
  // message below needs to tell those two situations apart.
  let lastSeenCommit: string | null | undefined

  while (true) {
    const commit = await pollOnce(deps.fetch, options.url)
    if (commit !== undefined) lastSeenCommit = commit
    if (commit === options.expectedCommit) return

    if (deps.now() >= deadline) {
      const seen = lastSeenCommit === undefined ? 'no valid response' : `commit ${lastSeenCommit}`
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${options.url} to report commit ` +
          `${options.expectedCommit} (last saw ${seen})`,
      )
    }
    await deps.sleep(pollIntervalMs)
  }
}

/**
 * One health-check attempt. Returns the reported commit, or `undefined` for anything that is not
 * a schema-valid health response — a network failure, a proxy's HTML error page and a malformed
 * body all collapse to the same "try again" signal, so the caller does not need to tell them apart.
 */
async function pollOnce(
  fetchImpl: (url: string) => Promise<Response>,
  url: string,
): Promise<string | null | undefined> {
  let response: Response
  try {
    response = await fetchImpl(url)
  } catch {
    return undefined
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return undefined
  }

  const result = healthResponseSchema.safeParse(body)
  return result.success ? result.data.commit : undefined
}

// --- CLI entry point ---
// This runs unattended in the deploy workflow, so its error text is all anyone will have: the
// zod message names exactly which flag was missing or malformed.

const USAGE = `Usage: node apps/api/src/deploy/wait-for-health.ts --url <health url> --commit <sha>
  [--timeout-ms <ms>] [--poll-interval-ms <ms>]`

const cliArgsSchema = z.object({
  url: z.url({ error: '--url must be a URL' }),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/, { error: '--commit must be a git SHA' }),
  timeoutMs: z.coerce.number().int().positive().optional(),
  pollIntervalMs: z.coerce.number().int().positive().optional(),
})

// `import.meta.main` (true only for the file node was invoked with) keeps this block from
// running when the test file imports `waitForHealth` above.
if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: {
        url: { type: 'string' },
        commit: { type: 'string' },
        'timeout-ms': { type: 'string' },
        'poll-interval-ms': { type: 'string' },
      },
    })
    const args = cliArgsSchema.parse({
      url: values.url,
      commit: values.commit,
      timeoutMs: values['timeout-ms'],
      pollIntervalMs: values['poll-interval-ms'],
    })

    console.log(`Waiting for ${args.url} to report commit ${args.commit}...`)
    await waitForHealth(
      {
        url: args.url,
        expectedCommit: args.commit,
        timeoutMs: args.timeoutMs,
        pollIntervalMs: args.pollIntervalMs,
      },
      { fetch, now: Date.now, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
    )
    console.log(`✔ ${args.url} is serving commit ${args.commit}`)
  } catch (error) {
    console.error(error instanceof z.ZodError ? z.prettifyError(error) : String(error))
    console.error(`\n${USAGE}`)
    process.exitCode = 1
  }
}
