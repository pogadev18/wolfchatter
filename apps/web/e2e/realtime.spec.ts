import { connectionStatus, messageWith, sendMessage } from './chat.ts'
import { expect, openAnotherBrowser, test } from './fixtures.ts'
import { mapPoint, pinNamed } from './map.ts'

const CLUJ = { lat: 46.7712, lng: 23.6236 }
const ROME = { lat: 41.9028, lng: 12.4964 }

/** Long enough for Socket.IO's reconnection back-off, which waits up to 5 seconds between tries. */
const RECONNECT_TIMEOUT_MS = 15_000

test('FR-7: a pin created in one browser appears in another, which keeps its own chatroom open', async ({
  page,
  browser,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  const other = await openAnotherBrowser(browser)
  await other.goto(`/?room=${room.id}`)
  await expect(connectionStatus(other)).toHaveText('Connected')
  await page.goto('/')

  const first = await mapPoint(page, { x: -200, y: 100 })
  await page.mouse.click(first.x, first.y)
  await expect(pinNamed(other, 'Chatroom 2')).toBeVisible()
  // The other browser has fetched the list by now, so the next pin can only arrive as a push.
  const second = await mapPoint(page, { x: -300, y: 150 })
  await page.mouse.click(second.x, second.y)

  await expect(pinNamed(other, 'Chatroom 3')).toBeVisible()
  await expect(other.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(other).toHaveURL(`/?room=${room.id}`)
  await other.context().close()
})

test('FR-7: a message reaches everyone viewing its chatroom, and is announced to them', async ({
  page,
  browser,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  const other = await openAnotherBrowser(browser)
  await other.goto(`/?room=${room.id}`)
  await page.goto(`/?room=${room.id}`)

  await sendMessage(page, 'ana', 'first message')
  await expect(messageWith(other, 'first message')).toBeVisible()
  // The other browser has joined by now, so the next message can only arrive as a push.
  await sendMessage(page, 'ana', 'hello from ana')

  await expect(messageWith(other, 'hello from ana')).toContainText('ana:')
  await expect(other.locator('[aria-live="polite"]')).toHaveText('ana: hello from ana')
  await expect(page.locator('[aria-live="polite"]')).toHaveText('')
  await other.context().close()
})

test('FR-7: after a dropped connection, recovers what it missed and receives live messages again', async ({
  page,
  browser,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  const other = await openAnotherBrowser(browser)
  await other.goto(`/?room=${room.id}`)
  await page.goto(`/?room=${room.id}`)
  await sendMessage(page, 'ana', 'before the drop')
  await expect(messageWith(other, 'before the drop')).toBeVisible()

  await other.context().setOffline(true)
  await expect(connectionStatus(other)).toHaveText('Reconnecting…')
  await sendMessage(page, 'ana', 'while you were away')
  await expect(messageWith(page, 'while you were away').locator('time')).toBeVisible()
  await database.createRoom(ROME)
  await other.context().setOffline(false)

  await expect(connectionStatus(other)).toHaveText('Connected', { timeout: RECONNECT_TIMEOUT_MS })
  await expect(messageWith(other, 'while you were away')).toBeVisible()
  await expect(pinNamed(other, 'Chatroom 2')).toBeVisible()
  // Recovered by a refetch; this one only arrives if the chatroom was joined again.
  await sendMessage(page, 'ana', 'after the drop')
  await expect(messageWith(other, 'after the drop')).toBeVisible()
  await other.context().close()
})

test('shows "Waking up the server…" while the first connection takes long, then "Connected"', async ({
  page,
}) => {
  const { promise: awake, resolve: wakeUp } = Promise.withResolvers<void>()
  // Hold the WebSocket handshake, as a sleeping server does.
  await page.routeWebSocket(/\/socket\.io\//, async (socket) => {
    await awake
    socket.connectToServer()
  })
  await page.goto('/')
  const status = connectionStatus(page)

  await expect(status).toHaveText('Connecting…')
  await expect(status).toHaveText('Waking up the server…')
  wakeUp()
  await expect(status).toHaveText('Connected')
})

test('sends messages while the socket cannot connect', async ({ page, database }) => {
  const room = await database.createRoom(CLUJ)
  // Never connect the WebSocket: REST alone must carry the message.
  await page.routeWebSocket(/\/socket\.io\//, () => {})
  await page.goto(`/?room=${room.id}`)

  await sendMessage(page, 'ana', 'no socket needed')

  await expect(messageWith(page, 'no socket needed').locator('time')).toBeVisible()
  await expect(connectionStatus(page)).not.toHaveText('Connected')
})
