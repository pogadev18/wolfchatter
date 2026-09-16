import { QueryClient } from '@tanstack/react-query'
import { isTemporaryFailure } from './api/client.ts'

/**
 * Requests that never got an answer, or got a 5xx, are retried with the same payload; any other
 * answer is final. Ids are generated before the first attempt, so a retry never duplicates.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 3 && isTemporaryFailure(error),
      },
      mutations: {
        retry: (failureCount, error) => failureCount < 2 && isTemporaryFailure(error),
      },
    },
  })
}
