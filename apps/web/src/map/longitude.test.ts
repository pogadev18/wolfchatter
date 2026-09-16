import { describe, expect, it } from 'vitest'
import { nearestWorldCopy, wrapLongitude } from './longitude.ts'

describe('wrapLongitude', () => {
  it.each([23.6236, -180, 180, 0])('keeps %d, which the API already accepts, exactly', (lng) => {
    expect(wrapLongitude(lng)).toBe(lng)
  })

  it.each([
    [723.71, 3.71],
    [-190, 170],
    [540, -180],
    [-900, -180],
  ])('FR-2: wraps %d from another copy of the world to %d', (lng, wrapped) => {
    expect(wrapLongitude(lng)).toBeCloseTo(wrapped, 9)
  })
})

describe('nearestWorldCopy', () => {
  it.each([
    [23.6236, 20, 23.6236],
    [3.71, 723.71, 723.71],
    [-170, 175, 190],
    [170, -175, -190],
  ])('FR-2: draws longitude %d nearest to a map centred on %d at %d', (lng, center, drawn) => {
    expect(nearestWorldCopy(lng, center)).toBeCloseTo(drawn, 9)
  })
})
