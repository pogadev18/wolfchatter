import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  MAX_ATTEMPT_MS,
  type WaitForHealthDependencies,
  waitForHealth,
} from './wait-for-health.ts'

const HEALTH_URL = 'https://wolfchatter-api.onrender.com/api/health'
const EXPECTED_COMMIT = 'abc1234'

function healthResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** A request to a server that accepts the connection and never answers, not even to an abort. */
function neverAnswers(): Promise<Response> {
  return new Promise(() => {})
}

/**
 * A clock and a sleep that advance together, so a test drives time instead of waiting on it.
 *
 * Time only passes once nothing else can run: a sleep settles on the event loop's next turn, after
 * every promise already due has run. A request that answers at once therefore always cancels its
 * attempt's timer before the timer fires, and a request that never answers lets it fire — the same
 * order real time would give them. A cancelled sleep rejects without advancing the clock, as
 * `timers/promises` does.
 */
function fakeClock(): Pick<WaitForHealthDependencies, 'now' | 'sleep'> {
  let currentMs = 0
  return {
    now: () => currentMs,
    sleep: (ms: number, signal?: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        setImmediate(() => {
          if (signal?.aborted) {
            reject(signal.reason)
            return
          }
          currentMs += ms
          resolve()
        })
      }),
  }
}

describe('waitForHealth', () => {
  it('defaults to a 10-minute timeout, a 10-second poll interval and a 60-second attempt', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10 * 60_000)
    expect(DEFAULT_POLL_INTERVAL_MS).toBe(10_000)
    expect(MAX_ATTEMPT_MS).toBe(60_000)
  })

  it('resolves once the health response reports the expected commit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await expect(
      waitForHealth(
        { url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT },
        { fetch, ...fakeClock() },
      ),
    ).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledExactlyOnceWith(HEALTH_URL, {
      signal: expect.any(AbortSignal),
    })
  })

  it('keeps polling while a different commit — the old instance — is still serving', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: 'old-sha' }))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: 'old-sha' }))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await waitForHealth(
      { url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
      { fetch, ...fakeClock() },
    )

    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps polling through a 503 while the database is down', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(healthResponse({ ok: false, db: 'down', commit: 'old-sha' }, 503))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await waitForHealth(
      { url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
      { fetch, ...fakeClock() },
    )

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps polling a 503 that already reports the expected commit, then resolves once ok', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        healthResponse({ ok: false, db: 'down', commit: EXPECTED_COMMIT }, 503),
      )
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await waitForHealth(
      { url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
      { fetch, ...fakeClock() },
    )

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps polling when the body fails schema validation, such as a proxy error page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await waitForHealth(
      { url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
      { fetch, ...fakeClock() },
    )

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps polling when fetch rejects, such as a restarting instance refusing connections', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await waitForHealth(
      { url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
      { fetch, ...fakeClock() },
    )

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('rejects naming both the expected and the last-seen commit once the timeout expires', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(healthResponse({ ok: true, db: 'up', commit: 'stale-sha' }))

    let error: unknown
    try {
      await waitForHealth(
        {
          url: HEALTH_URL,
          expectedCommit: EXPECTED_COMMIT,
          timeoutMs: 5_000,
          pollIntervalMs: 1_000,
        },
        { fetch, ...fakeClock() },
      )
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(EXPECTED_COMMIT)
    expect((error as Error).message).toContain('stale-sha')
  })

  it('rejects at its deadline even while a request never answers', async () => {
    const fetch = vi.fn(neverAnswers)
    const clock = fakeClock()

    await expect(
      waitForHealth(
        {
          url: HEALTH_URL,
          expectedCommit: EXPECTED_COMMIT,
          timeoutMs: 5_000,
          pollIntervalMs: 1_000,
        },
        { fetch, ...clock },
      ),
    ).rejects.toThrow(
      `Timed out after 5000ms waiting for ${HEALTH_URL} to report commit ${EXPECTED_COMMIT} ` +
        '(last saw no valid response)',
    )
    // The attempt was given only the time left before the deadline, not the 60-second cap.
    expect(clock.now()).toBe(5_000)
  })

  it('abandons and cancels an attempt that outlasts the cap, then polls again', async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(neverAnswers)
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))
    const clock = fakeClock()

    await waitForHealth({ url: HEALTH_URL, expectedCommit: EXPECTED_COMMIT }, { fetch, ...clock })

    expect(fetch).toHaveBeenCalledTimes(2)
    // A timed-out attempt is just another failed poll: one poll interval later, the next one ran.
    expect(clock.now()).toBe(MAX_ATTEMPT_MS + DEFAULT_POLL_INTERVAL_MS)
    // The abandoned request is aborted, not left open behind the poller.
    const [, firstInit] = fetch.mock.calls[0] ?? []
    expect(firstInit.signal.aborted).toBe(true)
  })

  it('cuts the wait between polls short at the deadline rather than polling once more after it', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(healthResponse({ ok: true, db: 'up', commit: 'stale-sha' }))
    const clock = fakeClock()

    await expect(
      waitForHealth(
        {
          url: HEALTH_URL,
          expectedCommit: EXPECTED_COMMIT,
          timeoutMs: 2_500,
          pollIntervalMs: 1_000,
        },
        { fetch, ...clock },
      ),
    ).rejects.toThrow('Timed out after 2500ms')

    // Polls at 0, 1000 and 2000ms; the last wait stops at 2500ms instead of running to 3000ms.
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(clock.now()).toBe(2_500)
  })
})
