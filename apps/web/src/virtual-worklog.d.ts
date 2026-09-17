// Type-only here: this declaration only names the shape of the data the `worklog` Vite plugin
// (apps/web/plugins/worklog.ts) serialises at build time. That is no longer true of the package
// as a whole, though — apps/web/src/devlog/filters.ts imports its phase/outcome/agent-role enums
// as real runtime values, so `@wolfchatter/worklog` is a real (not dev-only) dependency of
// apps/web, and its `sideEffects: false` is what keeps that import from also dragging `yaml` (a
// transitive dependency of an unrelated module in the same package) into the browser bundle.
import type { DevlogEntry } from '@wolfchatter/worklog'

declare module 'virtual:worklog' {
  export const entries: DevlogEntry[]
}
