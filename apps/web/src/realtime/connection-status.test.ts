import { afterEach, describe, expect, it, vi } from 'vitest'
import { startSocketServer, type TestSocketServer } from '../../test/socket-server.ts'
import { connectionStatusText, createConnectionStatusStore } from './connection-status.ts'
import { type AppSocket, createSocket } from './socket.ts'

describe('createConnectionStatusStore', () => {
  let server: TestSocketServer | undefined
  let socket: AppSocket | undefined

  afterEach(async () => {
    socket?.disconnect()
    await server?.close()
  })

  it('FR-7: reports connecting, connected, and reconnecting after the connection drops', async () => {
    server = await startSocketServer()
    socket = createSocket(server.url, { reconnectionDelay: 50, reconnectionDelayMax: 50 })
    const store = createConnectionStatusStore(socket)
    const seen: string[] = [store.getSnapshot()]
    store.subscribe(() => seen.push(store.getSnapshot()))

    socket.connect()
    await vi.waitFor(() => expect(seen).toEqual(['connecting', 'connected']))
    server.dropConnections()

    await vi.waitFor(() =>
      expect(seen).toEqual(['connecting', 'connected', 'reconnecting', 'connected']),
    )
  })
})

describe('connectionStatusText', () => {
  it.each([
    ['connecting', false, 'Connecting…'],
    ['connecting', true, 'Waking up the server…'],
    ['connected', true, 'Connected'],
    ['reconnecting', true, 'Reconnecting…'],
  ] as const)('shows %s (slow: %s) as "%s"', (status, slow, text) => {
    expect(connectionStatusText(status, slow)).toBe(text)
  })
})
