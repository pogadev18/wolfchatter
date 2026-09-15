// PostToolUse hook: format each file Claude edits with Biome so agent output always
// matches `pnpm lint`. It never blocks an edit; anything Biome can't fix fails in CI.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const hookInputSchema = z.object({
  cwd: z.string(),
  tool_input: z.object({ file_path: z.string() }),
})

const input = hookInputSchema.safeParse(JSON.parse(readFileSync(0, 'utf8')))
if (input.success) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.data.cwd
  const biome = join(projectDir, 'node_modules', '.bin', 'biome')
  spawnSync(
    biome,
    ['check', '--write', '--no-errors-on-unmatched', input.data.tool_input.file_path],
    {
      cwd: projectDir,
      stdio: 'ignore',
    },
  )
}
