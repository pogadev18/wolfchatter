import { z } from 'zod'

const API_URL_ERROR = 'VITE_API_URL must be an origin like https://api.example.com, with no path'

/**
 * Build-time variables the web app reads. Vite only exposes names that start with `VITE_`, and
 * `vite.config.ts` checks them before the dev server starts or a build begins.
 */
export const webEnvSchema = z.object({
  /** The API's origin. Requests go to `<origin>/api/…` and sockets to `<origin>/socket.io`. */
  VITE_API_URL: z.string({ error: API_URL_ERROR }).refine(isHttpOrigin, { error: API_URL_ERROR }),
})
export type WebEnv = z.infer<typeof webEnvSchema>

function isHttpOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value
}

/** Parses the environment, or throws an error that lists every invalid variable. */
export function parseWebEnv(source: Record<string, unknown>): WebEnv {
  const result = webEnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
