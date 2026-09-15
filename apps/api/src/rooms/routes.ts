import { createRoomInputSchema } from '@wolfchatter/shared'
import type { FastifyPluginAsync } from 'fastify'
import { RATE_LIMITS } from '../http/limits.ts'
import type { ZodTypeProvider } from '../http/validation.ts'
import type { RoomsService } from './service.ts'

export interface RoomRoutesOptions {
  rooms: RoomsService
}

/** `GET /api/rooms` and `POST /api/rooms`. */
export const roomRoutes: FastifyPluginAsync<RoomRoutesOptions> = async (app, { rooms }) => {
  const routes = app.withTypeProvider<ZodTypeProvider>()

  routes.get('/rooms', () => rooms.list())

  routes.post(
    '/rooms',
    { schema: { body: createRoomInputSchema }, config: { rateLimit: RATE_LIMITS.createRoom } },
    async (request, reply) => reply.code(201).send(await rooms.create(request.body)),
  )
}
