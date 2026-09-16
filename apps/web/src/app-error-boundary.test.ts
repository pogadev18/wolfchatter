import { describe, expect, it } from 'vitest'
import { AppErrorBoundary, boundaryMessage } from './app-error-boundary.tsx'

// Rendering the boundary needs jsdom and a component-testing library, which this repository
// deliberately does not have (UI behaviour is covered by Playwright instead). What is genuinely
// testable without a DOM is the static lifecycle method and the pure message helper below.
describe('AppErrorBoundary.getDerivedStateFromError', () => {
  it('turns a thrown Error into crashed state carrying that error', () => {
    const error = new Error('boom')

    expect(AppErrorBoundary.getDerivedStateFromError(error)).toEqual({ kind: 'error', error })
  })

  it('carries whatever was thrown, even when it is not an Error', () => {
    expect(AppErrorBoundary.getDerivedStateFromError('a string was thrown')).toEqual({
      kind: 'error',
      error: 'a string was thrown',
    })
  })
})

describe('boundaryMessage', () => {
  it.each([
    ['an Error with a technical message', new Error('Cannot read properties of undefined')],
    ['a string', 'boom'],
    ['no error value at all', undefined],
    ['a plain object', { code: 'WEIRD' }],
  ])('says the same honest thing regardless of %s', (_case, error) => {
    expect(boundaryMessage(error)).toBe(
      "Something went wrong and this page can't recover from it. Reloading usually fixes it.",
    )
  })
})
