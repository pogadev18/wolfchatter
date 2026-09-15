import type { FastifySchemaCompiler, FastifyTypeProvider } from 'fastify'
import type { z } from 'zod'

/** Types `request.body`, `request.params` and `request.query` from a route's zod schemas. */
export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodType ? z.output<this['schema']> : unknown
  serializer: this['schema'] extends z.ZodType ? z.input<this['schema']> : unknown
}

/** Validates request parts with zod and hands the handler the parsed (trimmed, coerced) value. */
export const zodValidatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data)
    return result.success ? { value: result.data } : { error: result.error }
  }
