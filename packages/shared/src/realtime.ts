/** Socket.IO room that receives `message:created` events for one chatroom. */
export function roomChannel(roomId: string): `room:${string}` {
  return `room:${roomId}`
}
