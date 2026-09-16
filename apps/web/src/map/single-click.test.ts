import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSingleClickDetector, DOUBLE_CLICK_WINDOW_MS } from './single-click.ts'

describe('createSingleClickDetector', () => {
  const onSingleClick = vi.fn<(position: string) => void>()

  beforeEach(() => {
    vi.useFakeTimers()
    onSingleClick.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FR-2: reports a click once the double-click window has passed', () => {
    const detector = createSingleClickDetector(onSingleClick)

    detector.click('here', 1)
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS - 1)
    expect(onSingleClick).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onSingleClick).toHaveBeenCalledExactlyOnceWith('here')
  })

  it('FR-2: ignores both clicks of a double-click, as Leaflet reports them', () => {
    const detector = createSingleClickDetector(onSingleClick)

    detector.click('here', 1)
    vi.advanceTimersByTime(120)
    detector.click('here', 2)
    detector.cancel() // Leaflet's dblclick
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS * 10)

    expect(onSingleClick).not.toHaveBeenCalled()
  })

  it('FR-2: ignores the third click of a triple-click', () => {
    const detector = createSingleClickDetector(onSingleClick)

    detector.click('here', 1)
    detector.click('here', 2)
    detector.click('here', 3)
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS * 10)

    expect(onSingleClick).not.toHaveBeenCalled()
  })

  it('reports only the last of two single clicks inside the window', () => {
    const detector = createSingleClickDetector(onSingleClick)

    detector.click('first', 1)
    vi.advanceTimersByTime(100)
    detector.click('second', 1)
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS)

    expect(onSingleClick).toHaveBeenCalledExactlyOnceWith('second')
  })

  it('reports clicks further apart than the window separately', () => {
    const detector = createSingleClickDetector(onSingleClick)

    detector.click('first', 1)
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS)
    detector.click('second', 1)
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS)

    expect(onSingleClick.mock.calls).toEqual([['first'], ['second']])
  })
})
