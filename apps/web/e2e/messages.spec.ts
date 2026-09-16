import {
  messageInput,
  messageWith,
  recordMessageSends,
  sendMessage,
  usernameInput,
} from './chat.ts'
import { expect, openAnotherBrowser, test } from './fixtures.ts'
import { mapPoint, pinNamed } from './map.ts'

const CLUJ = { lat: 46.7712, lng: 23.6236 }

/** Longer than the first retry's delay, so a retry that should not happen would be seen. */
const SETTLE_MS = 1_500

test('FR-5: sends a message with Enter and shows its author, text and time', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  await page.goto(`/?room=${room.id}`)

  await sendMessage(page, 'ana', 'hello there')

  const message = messageWith(page, 'hello there')
  await expect(message).toContainText('ana:')
  const time = message.locator('time')
  await expect(time).toHaveAttribute('datetime', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  const createdAt = await time.getAttribute('datetime')
  const expected = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(createdAt ?? ''))
  await expect(time).toHaveText(expected)
  await expect(messageInput(page)).toHaveValue('')
})

test('FR-5: labels its inputs, shows the mockup placeholders and sends with Submit', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  await page.goto(`/?room=${room.id}`)

  await expect(usernameInput(page)).toHaveAttribute('placeholder', 'write your user name here')
  await expect(messageInput(page)).toHaveAttribute('placeholder', 'write message here')
  await usernameInput(page).fill('ana')
  await messageInput(page).fill('sent with the button')
  await page.getByRole('button', { name: 'Submit' }).click()

  await expect(messageWith(page, 'sent with the button').locator('time')).toBeVisible()
})

test('FR-5: explains a missing user name or message and sends nothing', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  const sends = recordMessageSends(page)
  await page.goto(`/?room=${room.id}`)
  const problem = page.getByRole('complementary', { name: 'Chat' }).getByRole('alert')

  await sendMessage(page, '', 'hello')
  await expect(problem).toHaveText('Enter a user name')

  await sendMessage(page, 'ana', '   ')
  await expect(problem).toHaveText('Write a message')

  await sendMessage(page, 'ana', 'b'.repeat(1001))
  await expect(problem).toHaveText('Messages are limited to 1000 characters')

  expect(sends).toEqual([])
})

test('FR-5: remembers the user name on this device', async ({ page, database }) => {
  const room = await database.createRoom(CLUJ)
  await page.goto(`/?room=${room.id}`)

  await usernameInput(page).fill('ana')
  await page.reload()

  await expect(usernameInput(page)).toHaveValue('ana')
})

test('FR-5: a failed send stays visible, and Retry sends the same message again', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  const sends = recordMessageSends(page)
  let networkDown = true
  await page.route('**/api/rooms/*/messages', (route) =>
    route.request().method() === 'POST' && networkDown
      ? route.abort('connectionreset')
      : route.continue(),
  )
  await page.goto(`/?room=${room.id}`)

  await sendMessage(page, 'ana', 'hello')

  const message = messageWith(page, 'hello')
  // Two automatic retries come first, a second and then two seconds apart.
  await expect(message).toContainText('Not sent', { timeout: 10_000 })
  networkDown = false
  await message.getByRole('button', { name: 'Retry' }).click()

  await expect(message.locator('time')).toBeVisible()
  await expect(message).not.toContainText('Not sent')
  expect(sends).toHaveLength(4)
  expect(new Set(sends.map((body) => JSON.stringify(body))).size).toBe(1)
})

test('FR-5: a message the API rejects is removed with the reason, and never retried', async ({
  page,
  database,
}) => {
  const room = await database.createRoom(CLUJ)
  const sends = recordMessageSends(page)
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

  await sendMessage(page, 'ana', 'hello')

  await expect(page.getByRole('complementary', { name: 'Chat' }).getByRole('alert')).toHaveText(
    'Your message was not sent. This message id is already used by another message.',
  )
  await expect(messageWith(page, 'hello')).toHaveCount(0)
  await page.waitForTimeout(SETTLE_MS)
  expect(sends).toHaveLength(1)
})

test('FR-6: messages survive a reload and a new session', async ({ page, database, browser }) => {
  const room = await database.createRoom(CLUJ)
  await page.goto(`/?room=${room.id}`)
  await sendMessage(page, 'ana', 'still here')
  await expect(messageWith(page, 'still here').locator('time')).toBeVisible()

  await page.reload()
  await expect(messageWith(page, 'still here')).toBeVisible()

  const otherSession = await openAnotherBrowser(browser)
  await otherSession.goto(`/?room=${room.id}`)
  await expect(messageWith(otherSession, 'still here')).toBeVisible()
  await otherSession.context().close()
})

test('FR-2, FR-4: opening a chatroom puts the cursor in the message input', async ({
  page,
  database,
}) => {
  await database.createRoom(CLUJ)
  await page.goto('/')

  await pinNamed(page, 'Chatroom 1').click()
  await expect(page.getByRole('heading', { name: 'Chatroom 1' })).toBeVisible()
  await expect(messageInput(page)).toBeFocused()

  const elsewhere = await mapPoint(page, { x: -250, y: 120 })
  await page.mouse.click(elsewhere.x, elsewhere.y)
  await expect(page.getByRole('heading', { name: 'Chatroom 2' })).toBeVisible()
  await expect(messageInput(page)).toBeFocused()
})

test('shows message text as plain text, never as HTML', async ({ page, database }) => {
  const room = await database.createRoom(CLUJ)
  await page.goto(`/?room=${room.id}`)

  await sendMessage(page, 'ana', '<b>bold</b><img src=x onerror="document.title=1">')

  const message = messageWith(page, '<b>bold</b>')
  await expect(message.locator('time')).toBeVisible()
  await expect(message.locator('b, img')).toHaveCount(0)
})
