import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

/**
 * Unlike every other spec here, `/devlog` has no per-test fixture: its content is `virtual:worklog`,
 * baked in at build time from this repository's own real `worklog/*.md` files, which only ever
 * grow. So these tests assert relative, structural properties (ordering, "narrows", "at least one
 * of X exists") rather than pinning exact counts or content, and stay valid as the log grows.
 */

/** Long enough for a real connection attempt to show up, the way it does on `/`; none is expected. */
const NO_SOCKET_WAIT_MS = 1_000

/**
 * `/devlog` is lazy-loaded (main.tsx), so its content mounts one chunk fetch after `goto`
 * resolves. Waiting for the first entry — rather than reading straight off the DOM — is what
 * makes the one-shot `.count()` calls below safe instead of an occasional race.
 */
async function openDevlog(page: Page, path = '/devlog') {
  await page.goto(path)
  await expect(page.getByRole('listitem').first()).toBeVisible()
}

test('FR-8: lists entries newest first', async ({ page }) => {
  await openDevlog(page)

  const stamps = await page
    .locator('time')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime')))
  expect(stamps.length).toBeGreaterThan(0)
  const parsed = stamps.map((stamp) => new Date(stamp ?? '').getTime())
  expect(parsed).toEqual([...parsed].sort((a, b) => b - a))
})

test('FR-8: choosing an outcome narrows the list and updates the URL', async ({ page }) => {
  await openDevlog(page)
  const before = await page.getByRole('listitem').count()

  await page.getByLabel('Outcome').selectOption('issue')

  await expect(page).toHaveURL(/[?&]outcome=issue(&|$)/)
  const after = await page.getByRole('listitem').count()
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThan(before)
})

test('FR-8: loading a filtered URL directly applies that filter', async ({ page }) => {
  await openDevlog(page, '/devlog?outcome=issue')

  await expect(page.getByLabel('Outcome')).toHaveValue('issue')
  const filtered = await page.getByRole('listitem').count()
  expect(filtered).toBeGreaterThan(0)

  await openDevlog(page)
  const total = await page.getByRole('listitem').count()
  expect(filtered).toBeLessThan(total)
})

test('FR-8: an unknown filter value in the URL is ignored rather than emptying the page', async ({
  page,
}) => {
  await page.goto('/devlog?phase=bogus&outcome=issue')

  // The malformed phase is dropped; the real outcome filter still applies.
  await expect(page.getByLabel('Phase')).toHaveValue('')
  await expect(page.getByLabel('Outcome')).toHaveValue('issue')
  await expect(page.getByRole('listitem').first()).toBeVisible()
})

test('FR-8: at least one entry shows a link to its commit', async ({ page }) => {
  await page.goto('/devlog')

  // This is what makes ci.yml's `fetch-depth: 0` on the e2e job a real check: with the default
  // shallow clone, every entry's `commit` comes back null and no such link would ever render.
  const commitLink = page.getByRole('link', { name: /^View commit [0-9a-f]{7}$/ }).first()
  await expect(commitLink).toBeVisible()
  const href = await commitLink.getAttribute('href')
  expect(href).toMatch(/^https:\/\/github\.com\/pogadev18\/wolfchatter\/commit\/[0-9a-f]{7,40}$/)
})

test('FR-8: a related link moves the reader to that entry', async ({ page }) => {
  await page.goto('/devlog')

  // Fragment links (`#<entry-id>`) only ever come from a `related` reference — nothing else on
  // the page links that way — so this exercises a real one without depending on which entry it is.
  const relatedLink = page.locator('a[href^="#"]').first()
  await expect(relatedLink).toBeVisible()
  const href = await relatedLink.getAttribute('href')
  if (!href) throw new Error('The related link has no href')
  const target = page.locator(`[id="${href.slice(1)}"]`)
  await expect(target).toHaveCount(1)

  await relatedLink.click()

  await page.waitForURL((url) => url.hash === href)
  await expect(target).toBeInViewport()
})

test('FR-8: opens no WebSocket', async ({ page }) => {
  const sockets: string[] = []
  page.on('websocket', (socket) => sockets.push(socket.url()))

  await page.goto('/devlog')
  await expect(page.getByRole('heading', { name: 'Devlog', level: 1 })).toBeVisible()
  await page.waitForTimeout(NO_SOCKET_WAIT_MS)

  expect(sockets).toEqual([])
})
