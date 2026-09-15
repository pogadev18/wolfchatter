import type { ApiErrorCode, ApiErrorResponse } from '@wolfchatter/shared'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { BODY_LIMIT_BYTES } from './limits.ts'

/** An error whose status, code and message are safe to show to clients. */
export class ApiError extends Error {
  readonly statusCode: number
  readonly code: ApiErrorCode

  constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

/** The status and message of a 4xx error thrown by Fastify or a plugin, such as invalid JSON. */
function clientErrorOf(error: unknown): { statusCode: number; message: string } | undefined {
  if (!(error instanceof Error) || !('statusCode' in error)) return undefined
  const statusCode = Number(error.statusCode)
  return statusCode >= 400 && statusCode < 500 ? { statusCode, message: error.message } : undefined
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: ApiErrorResponse['error'],
): FastifyReply {
  return reply.code(statusCode).send({ error } satisfies ApiErrorResponse)
}

/** Answers every failure, including Fastify's own, in the shared error shape. */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    sendError(reply, 404, {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    }),
  )

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return sendError(reply, error.statusCode, { code: error.code, message: error.message })
    }
    if (error instanceof z.ZodError) {
      const context = 'validationContext' in error ? String(error.validationContext) : 'request'
      const details = error.issues.map((issue) => ({
        path: [context, ...issue.path].join('.'),
        message: issue.message,
      }))
      return sendError(reply, 400, {
        code: 'VALIDATION_FAILED',
        message: details[0]?.message ?? `Invalid ${context}`,
        details,
      })
    }
    const clientError = clientErrorOf(error)
    if (clientError?.statusCode === 413) {
      return sendError(reply, 413, {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request bodies are limited to ${BODY_LIMIT_BYTES / 1024} KB`,
      })
    }
    if (clientError) {
      return sendError(reply, clientError.statusCode, {
        code: 'VALIDATION_FAILED',
        message: clientError.message,
      })
    }
    request.log.error({ err: error }, 'Unhandled error')
    return sendError(reply, 500, { code: 'INTERNAL', message: 'Something went wrong' })
  })
}
