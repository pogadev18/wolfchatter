import type { Page } from '@playwright/test'

export interface Point {
  x: number
  y: number
}

/** A point on the map, as an offset in pixels from the centre of the map's container. */
export async function mapPoint(page: Page, offset: Point = { x: 0, y: 0 }): Promise<Point> {
  const box = await page.locator('.leaflet-container').boundingBox()
  if (!box) throw new Error('The map is not visible')
  return { x: box.x + box.width / 2 + offset.x, y: box.y + box.height / 2 + offset.y }
}

/** A chatroom's pin, by its accessible name, such as "Chatroom 2". */
export function pinNamed(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true })
}

/** Where a pin points: the tip of its icon, 15 px right of and 41 px below the icon's corner. */
export async function pinTip(page: Page, name: string): Promise<Point> {
  const box = await pinNamed(page, name).boundingBox()
  if (!box) throw new Error(`The pin "${name}" is not visible`)
  return { x: box.x + 15, y: box.y + 41 }
}

/** Every chatroom create the page sends, in order, including attempts that fail on the way. */
export function recordRoomCreates(page: Page): unknown[] {
  const bodies: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/rooms') {
      bodies.push(request.postDataJSON())
    }
  })
  return bodies
}
