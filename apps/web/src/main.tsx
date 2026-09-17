import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { createApiClient } from './api/client.ts'
import { App } from './app.tsx'
import { AppErrorBoundary } from './app-error-boundary.tsx'
import { parseWebEnv } from './env.ts'
import { createQueryClient } from './query-client.ts'
import { createConnectionStatusStore } from './realtime/connection-status.ts'
import { createSocket } from './realtime/socket.ts'
import { ServicesProvider } from './services.tsx'

const env = parseWebEnv(import.meta.env)
const socket = createSocket(env.VITE_API_URL)
const services = {
  api: createApiClient(env.VITE_API_URL),
  socket,
  connectionStatus: createConnectionStatusStore(socket),
}
const queryClient = createQueryClient()

// Lazy: virtual:worklog's rendered HTML only grows, and every visitor of '/' — the map, this
// app's actual product — would otherwise pay to download it, whether they ever open /devlog or not.
const DevlogPage = lazy(() =>
  import('./devlog/devlog-page.tsx').then((module) => ({ default: module.DevlogPage })),
)

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

createRoot(root).render(
  <StrictMode>
    {/*
      Outside every provider, not just around <Routes>: a reload restarts all of it regardless of
      where the throw happened, so there is no cost to covering ServicesProvider and
      QueryClientProvider too, and a real gain — without this, a throw in either of them (never
      seen, but not provably impossible) would blank the page above where the boundary could
      catch it, which is the exact bug this component exists to close. It also sits above the
      Suspense that guards the lazy /devlog chunk: Suspense only catches a *pending* import, not a
      failed one, so a chunk that fails to load throws past it like any other render error.
    */}
    <AppErrorBoundary>
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {/*
              useRealtime() lives inside App alone, and createSocket connects only when it is
              called (socket.ts uses autoConnect: false) — so /devlog, which never renders App,
              never opens a WebSocket. Verified in apps/web/e2e/devlog.spec.ts.
            */}
            <Routes>
              <Route path="/" element={<App />} />
              <Route
                path="/devlog"
                element={
                  <Suspense fallback={<p className="p-8 text-center text-stone-500">Loading…</p>}>
                    <DevlogPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </ServicesProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
