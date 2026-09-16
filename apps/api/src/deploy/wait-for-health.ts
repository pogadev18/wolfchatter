// Run directly: node apps/api/src/deploy/wait-for-health.ts --url <health url> --commit <sha>
import { setTimeout as delay } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { healthResponseSchema } from '@wolfchatter/shared'
import { z } from 'zod'

// A free-tier Render build plus boot is minutes, not seconds.
export const DEFAULT_TIMEOUT_MS = 10 * 60_000
export const DEFAULT_POLL_INTERVAL_MS = 10_000

/**
 * The longest one attempt may go unanswered before it is abandoned and counted as a failed poll.
 * Long enough for a single attempt to span a free instance waking from sleep (33 seconds measured
 * against this API, "about a minute" by Render's own estimate), so the poll that wakes a sleeping
 * API is not abandoned just before it would have answered. Short enough that a connection which
 * will never answer costs a tenth of the default deadline rather than all of it.
 */
export const MAX_ATTEMPT_MS = 60_000

export interface WaitForHealthOptions {
  url: string
  expectedCommit: string
  timeoutMs?: number
  pollIntervalMs?: number
}

/** Everything the poll loop reads from outside, injected so no test has to wait on real time. */
export interface WaitForHealthDependencies {
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>
  now: () => number
  /** Resolves after `ms`; once `signal` aborts, rejects instead and stops the timer. */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>
}

/**
 * Polls `options.url` until its health response reports both `ok: true` and
 * `options.expectedCommit`, or the timeout expires. The deploy hook's 200 only means Render
 * *accepted* the request to build — this is the only evidence a deploy actually landed and can
 * serve traffic.
 *
 * Every response body is validated with `healthResponseSchema` before its fields are trusted: a
 * proxy's HTML error page, a dropped connection, or a mid-deploy 503 must all be treated the same
 * way — keep polling — rather than crash the wait.
 *
 * `ok` is required alongside the commit match, not just the commit: `apps/api/src/health.ts`
 * reports the deployed commit regardless of database state, so a matching commit alone does not
 * mean the API can actually serve a request. A 503 with the right commit is still a deploy that
 * cannot serve — the correct response is to keep polling, same as a mismatch, not to call it
 * done. If the database outage is transient, polling recovers on its own well inside the
 * timeout; if it isn't, the timeout surfaces that honestly instead of a false success.
 *
 * The deadline bounds every step, not just the check between polls. Node's `fetch` waits up to 300
 * seconds for response headers by default, so a server that accepts the connection and never
 * answers would otherwise hold a single attempt far past the deadline, and the deploy job would end
 * in GitHub's generic job timeout instead of the error below, which names both commits. So each
 * attempt gets only the time left before the deadline (at most `MAX_ATTEMPT_MS`), and the wait
 * between polls stops at the deadline too.
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

  while (deps.now() < deadline) {
    const attemptMs = Math.min(deadline - deps.now(), MAX_ATTEMPT_MS)
    const seen = await pollWithin(deps, options.url, attemptMs)
    if (seen !== undefined) lastSeenCommit = seen.commit
    if (seen?.ok && seen.commit === options.expectedCommit) return

    const remainingMs = deadline - deps.now()
    if (remainingMs > 0) await deps.sleep(Math.min(pollIntervalMs, remainingMs))
  }

  const description =
    lastSeenCommit === undefined ? 'no valid response' : `commit ${lastSeenCommit}`
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${options.url} to report commit ` +
      `${options.expectedCommit} (last saw ${description})`,
  )
}

/** What one health-check attempt found, once its body has passed schema validation. */
interface HealthSighting {
  ok: boolean
  commit: string | null
}

/**
 * One attempt, abandoned once `attemptMs` passes without an answer, which then counts as a failed
 * poll like any other. Aborting the request's signal cancels it, a slow body included, rather than
 * leaving it open behind the poller; racing the attempt against its timer is what guarantees the
 * poller moves on even if a request somehow ignores that signal.
 */
async function pollWithin(
  deps: WaitForHealthDependencies,
  url: string,
  attemptMs: number,
): Promise<HealthSighting | undefined> {
  const request = new AbortController()
  const timer = new AbortController()
  const expired = deps.sleep(attemptMs, timer.signal).then(
    () => {
      request.abort(new Error(`No answer from ${url} within ${attemptMs}ms`))
      return undefined
    },
    // The timer was cancelled because the attempt settled first.
    () => undefined,
  )
  try {
    return await Promise.race([pollOnce(deps.fetch, url, request.signal), expired])
  } finally {
    // Stops the timer, so a finished run does not keep the process alive until it fires.
    timer.abort()
  }
}

/**
 * One health-check request. Returns the reported `ok` and `commit`, or `undefined` for anything
 * that is not a schema-valid health response — a network failure, an aborted request, a proxy's
 * HTML error page and a malformed body all collapse to the same "try again" signal, so the caller
 * does not need to tell them apart.
 */
async function pollOnce(
  fetchImpl: WaitForHealthDependencies['fetch'],
  url: string,
  signal: AbortSignal,
): Promise<HealthSighting | undefined> {
  let response: Response
  try {
    response = await fetchImpl(url, { signal })
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
  return result.success ? { ok: result.data.ok, commit: result.data.commit } : undefined
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
      { fetch, now: Date.now, sleep: (ms, signal) => delay(ms, undefined, { signal }) },
    )
    console.log(`✔ ${args.url} is serving commit ${args.commit}`)
  } catch (error) {
    console.error(error instanceof z.ZodError ? z.prettifyError(error) : String(error))
    console.error(`\n${USAGE}`)
    process.exitCode = 1
  }
}
