import {
  createMessageInputSchema,
  listMessagesQuerySchema,
  roomIdSchema,
} from '@wolfchatter/shared'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { RateLimit } from '../http/limits.ts'
import type { ZodTypeProvider } from '../http/validation.ts'
import type { MessagesService } from './service.ts'

export interface MessageRoutesOptions {
  messages: MessagesService
  /** How many messages one client may send per window, across chatrooms. */
  rateLimit: RateLimit
}

const roomParamsSchema = z.object({ id: roomIdSchema })

/** `GET /api/rooms/:id/messages` and `POST /api/rooms/:id/messages`. */
export const messageRoutes: FastifyPluginAsync<MessageRoutesOptions> = async (
  app,
  { messages, rateLimit },
) => {
  const routes = app.withTypeProvider<ZodTypeProvider>()

  routes.get(
    '/rooms/:id/messages',
    { schema: { params: roomParamsSchema, querystring: listMessagesQuerySchema } },
    (request) => messages.list(request.params.id, request.query),
  )

  routes.post(
    '/rooms/:id/messages',
    {
      schema: { params: roomParamsSchema, body: createMessageInputSchema },
      config: { rateLimit },
    },
    async (request, reply) =>
      reply.code(201).send(await messages.create(request.params.id, request.body)),
  )
}
