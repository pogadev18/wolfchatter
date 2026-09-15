import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from '../test/database.ts'
import { connectClient } from '../test/sockets.ts'

const SERVER = fileURLToPath(new URL('./server.ts', import.meta.url))

let database: TestDatabase
const children: ChildProcess[] = []

beforeAll(async () => {
  database = await createTestDatabase()
  return () => database.drop()
})

afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL')
})

interface RunningServer {
  child: ChildProcess
  url: string
  logs: string[]
}

/** Starts `src/server.ts` on a free port and resolves once it is listening. */
function startServer(): Promise<RunningServer> {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, DATABASE_URL: database.url, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  children.push(child)
  const logs: string[] = []
  return new Promise((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`server exited early with code ${code}`)))
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      logs.push(...chunk.split('\n').filter(Boolean))
      const url = logs
        .map((line) => /Server listening at (http:\/\/[^"]+)/.exec(line)?.[1])
        .find(Boolean)
      if (url) resolve({ child, url, logs })
    })
  })
}

describe('server', () => {
  it('serves the API and shuts down gracefully on SIGTERM', async () => {
    const { child, url, logs } = await startServer()
    expect((await fetch(`${url}/api/health`)).status).toBe(200)
    const client = await connectClient(url)
    const disconnected = new Promise<string>((resolve) => client.once('disconnect', resolve))

    child.kill('SIGTERM')
    const [code] = await once(child, 'exit')

    expect(code).toBe(0)
    expect(await disconnected).toBe('io server disconnect')
    expect(logs.join('\n')).toContain('Server closed')
  })
})
