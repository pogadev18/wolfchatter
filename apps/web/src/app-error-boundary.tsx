import { Component, type ErrorInfo, type ReactNode } from 'react'

type BoundaryState = { kind: 'ok' } | { kind: 'error'; error: unknown }

interface AppErrorBoundaryProps {
  children: ReactNode
}

/**
 * The last line of defence for a render that throws: without this, any error below it blanks the
 * whole page with nothing on screen and no way out. React only supports this through a class
 * component — there is no hook for getDerivedStateFromError/componentDidCatch.
 *
 * Reload is a genuine fix here, not a platitude: every piece of this app's own state (the selected
 * chatroom, the devlog's filters) lives in the URL, so a full reload puts the user back where they
 * were instead of just papering over a page that is still broken.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, BoundaryState> {
  override state: BoundaryState = { kind: 'ok' }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { kind: 'error', error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // No error-reporting service is wired up yet, so this is the only trace of the crash anywhere.
    console.error('AppErrorBoundary caught a render error:', error, info.componentStack)
  }

  override render() {
    if (this.state.kind === 'ok') return this.props.children
    return (
      <div
        role="alert"
        className="flex h-dvh flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <p className="text-stone-700">{boundaryMessage(this.state.error)}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border-2 border-stone-800 px-3 py-1 font-semibold"
        >
          Reload
        </button>
      </div>
    )
  }
}

/**
 * The fallback's one sentence. Deliberately the same regardless of what was thrown: a render
 * crash could be anything from a failed lazy-loaded chunk to a bug in this code, and this is the
 * last screen a user sees when everything else has failed — guessing at a cause here would be
 * lying to them with a straight face.
 */
export function boundaryMessage(_error: unknown): string {
  return "Something went wrong and this page can't recover from it. Reloading usually fixes it."
}
