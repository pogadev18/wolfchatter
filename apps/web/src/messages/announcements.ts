import type { Message } from '@wolfchatter/shared'

/**
 * The newest message to announce to screen readers: one that was not in the chat before and that
 * this user did not send, since they know what they wrote.
 */
export function newestArrival(
  before: ReadonlySet<string>,
  messages: readonly Message[],
  ownIds: ReadonlySet<string>,
): Message | undefined {
  return messages.findLast(({ id }) => !before.has(id) && !ownIds.has(id))
}
