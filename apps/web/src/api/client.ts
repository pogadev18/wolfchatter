import {
  type ApiErrorResponse,
  apiErrorResponseSchema,
  type CreateMessageInput,
  type CreateRoomInput,
  type Message,
  messageListSchema,
  messageSchema,
  type Room,
  roomListSchema,
  roomSchema,
} from '@wolfchatter/shared'
import type { z } from 'zod'

type ApiErrorBody = ApiErrorResponse['error']

/** The API answered a request with an error status. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: ApiErrorBody['code']

  constructor(status: number, error: ApiErrorBody) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = error.code
  }
}

/**
 * Worth retrying at once: the request never got an answer, the server failed (5xx), or a 2xx
 * body broke the contract, which the schema throws a `ZodError` for. Retrying that last one is
 * safe because the API's writes are idempotent: the same id sent again returns the stored row.
 */
export function isTemporaryFailure(error: unknown): boolean {
  return !(error instanceof ApiRequestError) || error.status >= 500
}

/**
 * Sending the same request again can never succeed, such as a 409 CONFLICT. A 429 is not
 * permanent: the same request succeeds once the rate limit's window has passed.
 */
export function isPermanentFailure(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status < 500 && error.status !== 429
}

/** A sentence for notices: the API's own message, or a failure to reach the server. */
export function describeFailure(error: unknown): string {
  return error instanceof ApiRequestError ? `${error.message}.` : 'The server could not be reached.'
}

export interface ApiClient {
  listRooms(): Promise<Room[]>
  createRoom(input: CreateRoomInput): Promise<Room>
  /** The chatroom's newest page of messages, oldest first. */
  listMessages(roomId: string): Promise<Message[]>
  createMessage(roomId: string, input: CreateMessageInput): Promise<Message>
}

export interface ApiClientOptions {
  fetchFn?: typeof fetch
  /** How long a request waits for an answer before it gives up. Render's free tier can take
   * about 30 seconds to wake from sleep, so a shorter deadline would fail a routine cold start. */
  timeoutMs?: number
}

/** Every request's default deadline (see `ApiClientOptions.timeoutMs`). */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * An `AbortSignal` that fires on its own after `ms`, built on `setTimeout` rather than
 * `AbortSignal.timeout` so a test can drive it with fake timers instead of waiting for real time
 * to pass. `clear()` must run once the request it guards has settled, or the timer leaks.
 */
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${ms}ms`)), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/** Calls the API at `baseUrl` and checks every answer against the shared contract. */
export function createApiClient(baseUrl: string, options: ApiClientOptions = {}): ApiClient {
  const { fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  async function request<Schema extends z.ZodType>(
    schema: Schema,
    path: string,
    body?: unknown,
  ): Promise<z.output<Schema>> {
    const { signal, clear } = timeoutSignal(timeoutMs)
    try {
      const init =
        body === undefined
          ? { signal }
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
              signal,
            }
      const response = await fetchFn(`${baseUrl}${path}`, init)
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new ApiRequestError(response.status, errorFrom(response, payload))
      return schema.parse(payload)
    } finally {
      // A request that settles on its own must not leave its timer running behind it.
      clear()
    }
  }

  return {
    listRooms: () => request(roomListSchema, '/api/rooms'),
    createRoom: (input) => request(roomSchema, '/api/rooms', input),
    listMessages: (roomId) => request(messageListSchema, `/api/rooms/${roomId}/messages`),
    createMessage: (roomId, input) =>
      request(messageSchema, `/api/rooms/${roomId}/messages`, input),
  }
}

/** The API's error, or a generic one when something else answered, such as a proxy's HTML page. */
function errorFrom(response: Response, payload: unknown): ApiErrorBody {
  const parsed = apiErrorResponseSchema.safeParse(payload)
  if (parsed.success) return parsed.data.error
  return { code: 'INTERNAL', message: `The server answered with status ${response.status}` }
}
