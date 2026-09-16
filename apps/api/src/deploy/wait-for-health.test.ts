import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  type WaitForHealthDependencies,
  waitForHealth,
} from './wait-for-health.ts'

const URL = 'https://wolfchatter-api.onrender.com/api/health'
const EXPECTED_COMMIT = 'abc1234'

function healthResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** A clock and a sleep that advance together, so a test drives time instead of waiting on it. */
function fakeClock(): Pick<WaitForHealthDependencies, 'now' | 'sleep'> {
  let currentMs = 0
  return {
    now: () => currentMs,
    sleep: async (ms) => {
      currentMs += ms
    },
  }
}

describe('waitForHealth', () => {
  it('defaults to a 10-minute timeout and a 10-second poll interval', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10 * 60_000)
    expect(DEFAULT_POLL_INTERVAL_MS).toBe(10_000)
  })

  it('resolves once the health response reports the expected commit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await expect(
      waitForHealth({ url: URL, expectedCommit: EXPECTED_COMMIT }, { fetch, ...fakeClock() }),
    ).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledExactlyOnceWith(URL)
  })

  it('keeps polling while a different commit — the old instance — is still serving', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: 'old-sha' }))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: 'old-sha' }))
      .mockResolvedValueOnce(healthResponse({ ok: true, db: 'up', commit: EXPECTED_COMMIT }))

    await waitForHealth(
      { url: URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
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
      { url: URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
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
      { url: URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
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
      { url: URL, expectedCommit: EXPECTED_COMMIT, pollIntervalMs: 1_000 },
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
        { url: URL, expectedCommit: EXPECTED_COMMIT, timeoutMs: 5_000, pollIntervalMs: 1_000 },
        { fetch, ...fakeClock() },
      )
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(EXPECTED_COMMIT)
    expect((error as Error).message).toContain('stale-sha')
  })
})
