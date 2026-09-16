import { createRoomInputSchema } from '@wolfchatter/shared'
import { sendMessage } from './chat.ts'
import { expect, openAnotherBrowser, test } from './fixtures.ts'
import { mapPoint, pinNamed, pinTip, recordRoomCreates } from './map.ts'

const CLUJ = { lat: 46.7712, lng: 23.6236 }
const ROME = { lat: 41.9028, lng: 12.4964 }

/** Longer than the double-click window and the first retry's delay, so late requests are seen. */
const SETTLE_MS = 1_500

/**
 * Long enough for Socket.IO's reconnection back-off (up to 5 seconds between tries) plus three
 * query retries a second, two and four seconds apart.
 */
const STALE_BANNER_TIMEOUT_MS = 20_000

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
  // The server has nowhere to store a message until the chatroom exists.
  const submit = page.getByRole('button', { name: 'Submit' })
  await expect(submit).toBeDisabled()
  letAnswer()
  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(pinNamed(page, 'Creating chatroom…')).toHaveCount(0)
  await expect(submit).toBeEnabled()
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
    "Couldn't create the chatroom. This chatroom id is already used by another chatroom. Retry",
  )
  await expect(panel).toContainText('Click on the map to start a chat')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.room-pin')).toHaveCount(0)
  await page.waitForTimeout(SETTLE_MS)
  expect(creates).toHaveLength(1)
})

test('FR-2: Retry on a failed create tries again with the same id and position', async ({
  page,
}) => {
  const creates = recordRoomCreates(page)
  let fail = true
  await page.route('**/api/rooms', (route) =>
    route.request().method() === 'POST' && fail
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
  await expect(panel.getByRole('alert')).toContainText("Couldn't create the chatroom.")
  fail = false

  await panel.getByRole('alert').getByRole('button', { name: 'Retry' }).click()

  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(page).toHaveURL(/\/\?room=[0-9a-f-]{36}$/)
  await expect(panel.getByRole('alert')).toHaveCount(0)
  expect(creates).toHaveLength(2)
  expect(creates[1]).toEqual(creates[0])
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

test('FR-4: selecting and deselecting a chatroom keeps every other query parameter', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  await page.goto('/?utm_source=test')

  await pinNamed(page, 'Chatroom 1').click()

  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(page).toHaveURL(`/?utm_source=test&room=${room.id}`)

  // A create failure deselects through the same updater as a manual deselect (`withRoomDeselected`).
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
  const click = await mapPoint(page, { x: -200, y: 100 })
  await page.mouse.click(click.x, click.y)

  await expect(page.getByRole('complementary', { name: 'Chat' }).getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL('/?utm_source=test')
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
  // A sighted user sees the map's banner appear; a screen-reader user needs to be told too.
  await expect(page.locator('main').getByRole('status')).toHaveText(
    'The chatrooms could not be loaded',
  )
})

test('FR-4: says the chatroom list may be out of date when a refresh fails, not that it is missing', async ({
  page,
  database,
}) => {
  await database.createRoom(CLUJ)
  let attempts = 0
  await page.route('**/api/rooms', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    attempts += 1
    // The first GET is the page's own initial load, which must succeed so there is a list on
    // screen already; every one after simulates a background refresh going wrong.
    return attempts === 1
      ? route.continue()
      : route.fulfill({
          status: 503,
          json: { error: { code: 'INTERNAL', message: 'The chatrooms are not available' } },
        })
  })
  await page.goto('/')
  // Wait for the first, successful load to land before forcing another: realtime-sync.ts also
  // refetches on the very first connect, and racing that against the initial mount fetch would
  // make it unpredictable whether a second, separate request happens at all.
  await expect(pinNamed(page, 'Chatroom 1')).toBeVisible()

  // Forces the socket to reconnect, which refetches the chatroom list (realtime-sync.ts); this
  // time the mock above fails it, simulating a background refresh going wrong after a real success.
  await page.context().setOffline(true)
  await page.context().setOffline(false)

  await expect(page.locator('main').getByRole('status')).toHaveText(
    'The chatroom list may be out of date',
    { timeout: STALE_BANNER_TIMEOUT_MS },
  )
  // The pin the first, successful load fetched is still real: this failure did not remove it.
  await expect(pinNamed(page, 'Chatroom 1')).toBeVisible()
})

test('FR-2, FR-4: going back to a chatroom clears the notice a failed create left behind', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
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
  await page.route('**/api/rooms/*/messages', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'CONFLICT',
              message: 'This message id is already used by another message',
            },
          },
        })
      : route.continue(),
  )
  await page.goto(`/?room=${room.id}`)
  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()

  const click = await mapPoint(page, { x: -200, y: 100 })
  await page.mouse.click(click.x, click.y)
  await expect(panel.getByRole('alert')).toHaveText(
    "Couldn't create the chatroom. This chatroom id is already used by another chatroom. Retry",
  )
  await expect(page).toHaveURL(/\/$/)

  await page.goBack()

  await expect(panel.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(panel.getByRole('alert')).toHaveCount(0)
  // The strict singular locator: a second live region here would fail the assertion, not pass it.
  await sendMessage(page, 'ana', 'hello')
  await expect(panel.getByRole('alert')).toHaveText(
    'Your message was not sent. This message id is already used by another message.',
  )
})

test('FR-2: a create-failure notice does not linger once another chatroom has been opened', async ({
  page,
  database,
}) => {
  const rome = await database.createRoom(ROME)
  const { promise: answer, resolve: letAnswer } = Promise.withResolvers<void>()
  await page.route('**/api/rooms', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    // Held until the other chatroom is opened, so the rejection arrives after the user moved on.
    await answer
    return route.fulfill({
      status: 409,
      json: {
        error: {
          code: 'CONFLICT',
          message: 'This chatroom id is already used by another chatroom',
        },
      },
    })
  })
  await page.goto('/')
  const click = await mapPoint(page, { x: -200, y: 100 })
  await page.mouse.click(click.x, click.y)
  await expect(page.getByRole('heading', { name: 'Creating chatroom…' })).toBeVisible()
  const panel = page.getByRole('complementary', { name: 'Chat' })

  await pinNamed(page, 'Chatroom 1').click()
  await expect(panel.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(page).toHaveURL(`/?room=${rome.id}`)

  letAnswer()
  await page.waitForTimeout(SETTLE_MS)

  await expect(panel.getByRole('alert')).toHaveCount(0)
  await expect(panel.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
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
