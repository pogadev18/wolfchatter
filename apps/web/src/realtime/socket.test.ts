import { afterEach, expect, it } from 'vitest'
import { startSocketServer, type TestSocketServer } from '../../test/socket-server.ts'
import { type AppSocket, createSocket } from './socket.ts'

let server: TestSocketServer | undefined
let socket: AppSocket | undefined

afterEach(async () => {
  socket?.disconnect()
  await server?.close()
})

it('FR-7: connects over WebSockets, the only transport the API accepts', async () => {
  server = await startSocketServer()
  socket = createSocket(server.url, { reconnection: false })

  const outcome = new Promise<string>((resolve) => {
    socket?.once('connect', () => resolve('connected'))
    socket?.once('connect_error', (error) => resolve(`failed: ${error.message}`))
  })
  socket.connect()

  expect(await outcome).toBe('connected')
})
