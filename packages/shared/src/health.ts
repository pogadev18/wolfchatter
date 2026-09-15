import { z } from 'zod'

/** `GET /api/health`. `commit` lets the deploy workflow confirm which version is live. */
export const healthResponseSchema = z.object({
  ok: z.boolean(),
  db: z.enum(['up', 'down']),
  commit: z.string().nullable(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
