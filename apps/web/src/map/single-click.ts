/** How long a click waits for a second one before it counts as a single click. */
export const DOUBLE_CLICK_WINDOW_MS = 300

export interface SingleClickDetector<T> {
  /**
   * Records a click. `clickCount` is the browser's `detail`: 2 or more means the click belongs
   * to a double- or triple-click, which cancels any click still waiting.
   */
  click(value: T, clickCount: number): void
  /** Forgets a click that is still waiting, for example when a double-click is detected. */
  cancel(): void
}

/**
 * Leaflet fires `click` for both clicks of a double-click before its `dblclick`. The detector
 * reports a click only once the double-click window has passed without another click.
 */
export function createSingleClickDetector<T>(
  onSingleClick: (value: T) => void,
  windowMs = DOUBLE_CLICK_WINDOW_MS,
): SingleClickDetector<T> {
  let waiting: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    clearTimeout(waiting)
    waiting = undefined
  }

  return {
    click(value, clickCount) {
      cancel()
      if (clickCount > 1) return
      waiting = setTimeout(() => {
        waiting = undefined
        onSingleClick(value)
      }, windowMs)
    },
    cancel,
  }
}
