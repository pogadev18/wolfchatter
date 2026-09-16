import { createRoomInputSchema } from '@wolfchatter/shared'
import { expect, openAnotherBrowser, test } from './fixtures.ts'
import { mapPoint, pinNamed, pinTip, recordRoomCreates } from './map.ts'

const CLUJ = { lat: 46.7712, lng: 23.6236 }
const ROME = { lat: 41.9028, lng: 12.4964 }

/** Longer than the double-click window and the first retry's delay, so late requests are seen. */
const SETTLE_MS = 1_500

test('FR-2: a single click adds a pin and opens its chatroom', async ({ page }) => {
  await page.goto('/')
  const click = await mapPoint(page, { x: -200, y: 100 })

  await page.mouse.click(click.x, click.y)

  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(pinNamed(page, 'Chatroom 1')).toHaveClass(/room-pin--selected/)
  await expect(page).toHaveURL(/\/\?room=[0-9a-f-]{36}$/)
  const tip = await pinTip(page, 'Chatroom 1')
  expect(Math.abs(tip.x - click.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(tip.y - click.y)).toBeLessThanOrEqual(2)
})

test('FR-2: shows the pin before the server has answered', async ({ page }) => {
  const { promise: answer, resolve: letAnswer } = Promise.withResolvers<void>()
  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() === 'POST') await answer
    await route.continue()
  })
  await page.goto('/')
  const click = await mapPoint(page)

  await page.mouse.click(click.x, click.y)

  await expect(pinNamed(page, 'Creating chatroom…')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Creating chatroom…' })).toBeVisible()
  letAnswer()
  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(pinNamed(page, 'Creating chatroom…')).toHaveCount(0)
})

test('FR-2: a double-click zooms in without creating a chatroom', async ({ page }) => {
  const creates = recordRoomCreates(page)
  await page.goto('/')
  const point = await mapPoint(page)

  await page.mouse.dblclick(point.x, point.y)

  await expect(page.locator('img.leaflet-tile[src*="/stamen_watercolor/6/"]').first()).toBeVisible()
  await page.waitForTimeout(SETTLE_MS)
  expect(creates).toEqual([])
  await expect(page.locator('.room-pin')).toHaveCount(0)
})

test('FR-2: dragging the map never creates a chatroom', async ({ page }) => {
  const creates = recordRoomCreates(page)
  await page.goto('/')
  const start = await mapPoint(page)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 150, start.y + 80, { steps: 10 })
  await page.mouse.up()

  await page.waitForTimeout(SETTLE_MS)
  expect(creates).toEqual([])
  await expect(page.locator('.room-pin')).toHaveCount(0)
})

test('FR-2: a click on another copy of the world creates the chatroom where it was clicked', async ({
  page,
}) => {
  const creates = recordRoomCreates(page)
  await page.goto('/')
  const center = await mapPoint(page)
  // Each drag pans 1,100 px, about 48 degrees east; twelve cross the date line twice. Pausing
  // before releasing the mouse leaves Leaflet no speed to carry on panning with.
  for (let drag = 0; drag < 12; drag++) {
    await page.mouse.move(center.x + 550, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x - 550, center.y, { steps: 5 })
    await page.waitForTimeout(100)
    await page.mouse.up()
  }

  await page.mouse.click(center.x, center.y)

  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  expect(creates).toHaveLength(1)
  const { lng } = createRoomInputSchema.parse(creates[0])
  expect(lng).toBeGreaterThanOrEqual(-180)
  expect(lng).toBeLessThanOrEqual(180)
  const tip = await pinTip(page, 'Chatroom 1')
  expect(Math.abs(tip.x - center.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(tip.y - center.y)).toBeLessThanOrEqual(2)
})

test('FR-2: a create the API rejects removes its pin, explains why and is never retried', async ({
  page,
}) => {
  const creates = recordRoomCreates(page)
  await page.route('**/api/rooms', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'CONFLICT',
              message: 'This chatroom id is already used by another chatroom',
            },
          },
        })
      : route.continue(),
  )
  await page.goto('/')
  const click = await mapPoint(page)

  await page.mouse.click(click.x, click.y)

  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel.getByRole('alert')).toHaveText(
    "Couldn't create the chatroom. This chatroom id is already used by another chatroom.",
  )
  await expect(panel).toContainText('Click on the map to start a chat')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.room-pin')).toHaveCount(0)
  await page.waitForTimeout(SETTLE_MS)
  expect(creates).toHaveLength(1)
})

test('FR-2: a create that fails on the way is retried with the same id and position', async ({
  page,
}) => {
  const creates = recordRoomCreates(page)
  let attempts = 0
  await page.route('**/api/rooms', (route) => {
    if (route.request().method() === 'POST' && ++attempts === 1)
      return route.abort('connectionreset')
    return route.continue()
  })
  await page.goto('/')
  const click = await mapPoint(page)

  await page.mouse.click(click.x, click.y)

  await expect.poll(() => creates.length).toBe(2)
  expect(creates[1]).toEqual(creates[0])
  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
})

test('FR-4: clicking a pin opens its chatroom and highlights it, without creating one', async ({
  page,
  database,
}) => {
  await database.createRoom(CLUJ)
  const rome = await database.createRoom(ROME)
  const creates = recordRoomCreates(page)
  await page.goto('/')

  await pinNamed(page, 'Chatroom 2').click()

  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel.getByRole('heading', { name: 'Chatroom 2' })).toBeVisible()
  await expect(page).toHaveURL(`/?room=${rome.id}`)
  await expect(pinNamed(page, 'Chatroom 2')).toHaveClass(/room-pin--selected/)
  await expect(pinNamed(page, 'Chatroom 1')).not.toHaveClass(/room-pin--selected/)

  await pinNamed(page, 'Chatroom 1').click()

  await expect(panel.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(pinNamed(page, 'Chatroom 1')).toHaveClass(/room-pin--selected/)
  await page.waitForTimeout(SETTLE_MS)
  expect(creates).toEqual([])
  await expect(page.locator('.room-pin')).toHaveCount(2)
})

test('FR-4: the URL keeps the selection, in canonical form, across a reload', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)

  await page.goto(`/?room=${room.id.toUpperCase()}`)

  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(page).toHaveURL(`/?room=${room.id}`)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(pinNamed(page, 'Chatroom 1')).toHaveClass(/room-pin--selected/)
})

test('FR-4: an unknown or malformed chatroom id shows "Chatroom not found"', async ({ page }) => {
  const panel = page.getByRole('complementary', { name: 'Chat' })

  await page.goto(`/?room=${crypto.randomUUID()}`)
  await expect(panel.getByText('Chatroom not found')).toBeVisible()

  await page.goto('/?room=lobby')
  await expect(panel.getByText('Chatroom not found')).toBeVisible()
})

test('FR-4: says so when the chatroom list cannot be loaded, instead of loading for ever', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  await page.route('**/api/rooms', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'INTERNAL', message: 'The chatrooms are not available' } },
        })
      : route.continue(),
  )

  await page.goto(`/?room=${room.id}`)

  const unavailable = page.getByText('The chatrooms could not be loaded')
  // Three retries, a second, two and four seconds apart, come first.
  await expect(unavailable.first()).toBeVisible({ timeout: 15_000 })
  // The panel says it, and so does the map, which would otherwise just look empty.
  await expect(unavailable).toHaveCount(2)
  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel.getByText('The chatrooms could not be loaded')).toBeVisible()
  await expect(panel).not.toContainText('Loading chatroom…')
})

test('FR-6: chatrooms survive a reload and a new session', async ({ page, browser }) => {
  await page.goto('/')
  const click = await mapPoint(page)
  await page.mouse.click(click.x, click.y)
  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()

  await page.reload()
  await expect(pinNamed(page, 'Chatroom 1')).toBeVisible()

  const otherSession = await openAnotherBrowser(browser)
  await otherSession.goto('/')
  await expect(pinNamed(otherSession, 'Chatroom 1')).toBeVisible()
  await otherSession.context().close()
})
