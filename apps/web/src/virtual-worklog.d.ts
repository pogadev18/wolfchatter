// Type-only import: nothing from `packages/worklog` itself reaches the browser bundle, only the
// shape of the data the `worklog` Vite plugin (apps/web/plugins/worklog.ts) serialises at build
// time.
import type { DevlogEntry } from '@wolfchatter/worklog'

declare module 'virtual:worklog' {
  export const entries: DevlogEntry[]
}
