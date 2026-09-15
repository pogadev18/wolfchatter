import { describe, expect, it } from 'vitest'
import { roomChannel } from './realtime.ts'

describe('roomChannel', () => {
  it('prefixes the room id so room channels never collide with socket ids', () => {
    expect(roomChannel('3f1c2d9e-8a7b-4c6d-9e0f-1a2b3c4d5e6f')).toBe(
      'room:3f1c2d9e-8a7b-4c6d-9e0f-1a2b3c4d5e6f',
    )
  })
})
