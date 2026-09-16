import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const CLUJ = { lat: 46.7712, lng: 23.6236 }

/** Where a point falls in the Web Mercator world at a zoom level, in pixels, as Leaflet places it. */
function worldPixel({ lat, lng }: { lat: number; lng: number }, zoom: number) {
  const size = 256 * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`${selector} is not visible`)
  return box
}

test('FR-1: shows watercolor tiles centred on Cluj at zoom 5', async ({ page }) => {
  const zoom = 5
  const cluj = worldPixel(CLUJ, zoom)
  const column = Math.floor(cluj.x / 256)
  const row = Math.floor(cluj.y / 256)
  const tileUrl = `https://tiles.stadiamaps.com/tiles/stamen_watercolor/${zoom}/${column}/${row}.jpg`

  await page.goto('/')

  await expect(page.locator(`img.leaflet-tile[src="${tileUrl}"]`)).toBeVisible()
  const tile = await boxOf(page, `img.leaflet-tile[src="${tileUrl}"]`)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport')
  // Cluj sits at the centre of the viewport, give or take Leaflet's pixel rounding.
  expect(Math.abs(tile.x + (cluj.x - column * 256) - viewport.width / 2)).toBeLessThanOrEqual(1)
  expect(Math.abs(tile.y + (cluj.y - row * 256) - viewport.height / 2)).toBeLessThanOrEqual(1)
})

test('FR-1: puts the zoom controls top-left and the attribution bottom-right', async ({ page }) => {
  await page.goto('/')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport')

  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible()
  const zoomControls = await boxOf(page, '.leaflet-control-zoom')
  expect(zoomControls.x).toBeLessThan(20)
  expect(zoomControls.y).toBeLessThan(20)

  const attribution = page.locator('.leaflet-control-attribution')
  await expect(attribution).toContainText('Stadia Maps')
  await expect(attribution).toContainText('Stamen Design')
  const box = await boxOf(page, '.leaflet-control-attribution')
  expect(box.x + box.width).toBeCloseTo(viewport.width, 0)
  expect(box.y + box.height).toBeCloseTo(viewport.height, 0)
})

test('FR-1: falls back to OpenStreetMap tiles when watercolor tiles fail', async ({ page }) => {
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.fulfill({ status: 401 }))

  await page.goto('/')

  await expect(
    page.locator('img.leaflet-tile[src^="https://tile.openstreetmap.org/5/"]').first(),
  ).toBeVisible()
  const attribution = page.locator('.leaflet-control-attribution')
  await expect(attribution).toContainText('OpenStreetMap contributors')
  await expect(attribution).not.toContainText('Stadia Maps')
})

test('FR-3: with no chatroom selected, the panel says how to start a chat', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel.getByText('Click on the map to start a chat')).toBeVisible()
  // Tiles ignore the pointer, so make them hit-testable: a trial click then fails if a tile covers the panel.
  await page.addStyleTag({ content: '.leaflet-tile { pointer-events: auto !important; }' })
  await panel.click({ trial: true, timeout: 5_000 })
})

test('FR-3: shows the panel top-right, and as a bottom sheet below 640 px', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('complementary', { name: 'Chat' })
  await expect(panel).toBeVisible()

  const desktop = await boxOf(page, 'aside')
  expect(desktop.x + desktop.width).toBe(1280 - 16)
  expect(desktop.y).toBe(16)

  await page.setViewportSize({ width: 375, height: 812 })

  await expect(async () => {
    const sheet = await boxOf(page, 'aside')
    expect(sheet).toMatchObject({ x: 0, width: 375 })
    expect(sheet.y + sheet.height).toBe(812)
    // The map ends where the sheet begins, so its attribution stays visible.
    const attribution = await boxOf(page, '.leaflet-control-attribution')
    expect(attribution.y + attribution.height).toBeLessThanOrEqual(sheet.y)
  }).toPass({ timeout: 5_000 })
})

test('keeps the map centred when the chat sheet grows below 640 px', async ({ page, database }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await database.createRoom({ lat: 46.7712, lng: 23.6236 })
  await page.goto('/')
  const pin = page.getByRole('button', { name: 'Chatroom 1', exact: true })

  await pin.click()
  await expect(page.getByLabel('Message', { exact: true })).toBeVisible()

  // The pin marks the centre the map opened on; it moves up with the centre of the smaller map.
  await expect(async () => {
    const map = await boxOf(page, '.leaflet-container')
    const tip = await pin.boundingBox()
    if (!tip) throw new Error('The pin is not visible')
    expect(Math.abs(tip.y + 41 - (map.y + map.height / 2))).toBeLessThanOrEqual(2)
  }).toPass({ timeout: 5_000 })
})
