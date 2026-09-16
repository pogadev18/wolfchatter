/** How close to the bottom still counts as "at the bottom": enough to absorb layout rounding. */
const BOTTOM_THRESHOLD_PX = 4

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

/**
 * Whether a scrolling list positioned like this is close enough to the bottom that a new item
 * arriving should still pull it down to the new bottom. A reader who has scrolled up to read
 * history is, by the same measure, far from it, and keeps their place instead (M3 review).
 */
export function shouldStickToBottom({
  scrollTop,
  scrollHeight,
  clientHeight,
}: ScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD_PX
}
