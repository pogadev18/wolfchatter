import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadEnvExample } from './postgres.ts'

// A key no real environment or checked-in .env.example uses, so this test cannot collide with
// them, followed either way by cleanup so nothing leaks into another test file.
const KEY = 'WOLFCHATTER_ENV_RESOLUTION_PROBE'
const dirs: string[] = []

afterEach(() => {
  delete process.env[KEY]
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A throwaway directory with a `.env` and a `.env.example` that disagree on KEY. */
function fixtureDir(envValue: string, exampleValue: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'wolfchatter-env-'))
  dirs.push(dir)
  writeFileSync(join(dir, '.env'), `${KEY}=${envValue}\n`)
  writeFileSync(join(dir, '.env.example'), `${KEY}=${exampleValue}\n`)
  return dir
}

describe('loadEnvExample', () => {
  it('reads .env.example, never the developer-local .env', () => {
    const dir = fixtureDir('from-dotenv', 'from-example')

    loadEnvExample(dir)

    expect(process.env[KEY]).toBe('from-example')
  })

  it('leaves a variable the real environment already set untouched', () => {
    process.env[KEY] = 'from-real-environment'
    const dir = fixtureDir('from-dotenv', 'from-example')

    loadEnvExample(dir)

    expect(process.env[KEY]).toBe('from-real-environment')
  })

  it('does nothing when neither file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wolfchatter-env-'))
    dirs.push(dir)

    expect(() => loadEnvExample(dir)).not.toThrow()
    expect(process.env[KEY]).toBeUndefined()
  })
})
