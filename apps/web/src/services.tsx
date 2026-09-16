import { createContext, type ReactNode, use } from 'react'
import type { ApiClient } from './api/client.ts'
import type { ConnectionStatusStore } from './realtime/connection-status.ts'
import type { AppSocket } from './realtime/socket.ts'

/** What the app talks to, created once in main.tsx. */
export interface Services {
  api: ApiClient
  socket: AppSocket
  connectionStatus: ConnectionStatusStore
}

const ServicesContext = createContext<Services | null>(null)

interface ServicesProviderProps {
  services: Services
  children: ReactNode
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  return <ServicesContext value={services}>{children}</ServicesContext>
}

export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices() needs a <ServicesProvider> above it')
  return services
}
