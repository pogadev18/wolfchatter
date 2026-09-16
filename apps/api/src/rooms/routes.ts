import { createRoomInputSchema } from '@wolfchatter/shared'
import type { FastifyPluginAsync } from 'fastify'
import type { RateLimit } from '../http/limits.ts'
import type { ZodTypeProvider } from '../http/validation.ts'
import type { RoomsService } from './service.ts'

export interface RoomRoutesOptions {
  rooms: RoomsService
  /** How many chatrooms one client may create per window. */
  rateLimit: RateLimit
}

/** `GET /api/rooms` and `POST /api/rooms`. */
export const roomRoutes: FastifyPluginAsync<RoomRoutesOptions> = async (
  app,
  { rooms, rateLimit },
) => {
  const routes = app.withTypeProvider<ZodTypeProvider>()

  routes.get('/rooms', () => rooms.list())

  routes.post(
    '/rooms',
    { schema: { body: createRoomInputSchema }, config: { rateLimit } },
    async (request, reply) => reply.code(201).send(await rooms.create(request.body)),
  )
}
