import { describe, expect, it } from 'vitest'
import { loadUsername, saveUsername } from './username.ts'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

const refusingStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('SecurityError: storage is disabled')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('username storage', () => {
  it('FR-5: remembers the user name on this device', () => {
    const storage = memoryStorage()

    saveUsername(storage, 'ana')

    expect(loadUsername(storage)).toBe('ana')
  })

  it('starts empty when nothing was saved', () => {
    expect(loadUsername(memoryStorage())).toBe('')
  })

  it('carries on without storage when the browser refuses it', () => {
    expect(() => saveUsername(refusingStorage, 'ana')).not.toThrow()
    expect(loadUsername(refusingStorage)).toBe('')
    expect(loadUsername(undefined)).toBe('')
  })
})
