import type { Page } from '@playwright/test'

/** The chat panel: `<aside aria-label="Chat">`, reachable as a `complementary` region by that name. */
export function chatPanel(page: Page) {
  return page.getByRole('complementary', { name: 'Chat' })
}

/**
 * The panel's connection-status line: "Connecting…", "Waking up the server…", "Connected" or
 * "Reconnecting…". Scoped to the panel because the map has its own `role="status"` line for a
 * chatroom list that failed to load.
 */
export function connectionStatus(page: Page) {
  return chatPanel(page).getByRole('status')
}

/** The message input. Labels match loosely by default, and "Messages" also labels the list. */
export function messageInput(page: Page) {
  return page.getByLabel('Message', { exact: true })
}

export function usernameInput(page: Page) {
  return page.getByLabel('User name', { exact: true })
}

/** Types a user name and a message, and sends them with Enter. */
export async function sendMessage(page: Page, author: string, body: string) {
  await usernameInput(page).fill(author)
  await messageInput(page).fill(body)
  await messageInput(page).press('Enter')
}

/** A message in the open chatroom, found by its text. */
export function messageWith(page: Page, text: string) {
  return page
    .getByRole('list', { name: 'Messages' })
    .getByRole('listitem')
    .filter({ hasText: text })
}

/** Every message send the page makes, in order, including attempts that fail on the way. */
export function recordMessageSends(page: Page): unknown[] {
  const bodies: unknown[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (request.method() === 'POST' && /^\/api\/rooms\/[^/]+\/messages$/.test(pathname)) {
      bodies.push(request.postDataJSON())
    }
  })
  return bodies
}
