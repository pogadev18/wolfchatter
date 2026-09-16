import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { createApiClient } from './api/client.ts'
import { App } from './app.tsx'
import { parseWebEnv } from './env.ts'
import { createQueryClient } from './query-client.ts'
import { ServicesProvider } from './services.tsx'

const env = parseWebEnv(import.meta.env)
const services = { api: createApiClient(env.VITE_API_URL) }
const queryClient = createQueryClient()

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ServicesProvider>
  </StrictMode>,
)
