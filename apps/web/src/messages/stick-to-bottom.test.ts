import { describe, expect, it } from 'vitest'
import { shouldStickToBottom } from './stick-to-bottom.ts'

describe('shouldStickToBottom', () => {
  it('sticks when the list is scrolled exactly to the bottom', () => {
    expect(shouldStickToBottom({ scrollTop: 200, scrollHeight: 300, clientHeight: 100 })).toBe(true)
  })

  it('sticks within a small rounding threshold of the bottom', () => {
    expect(shouldStickToBottom({ scrollTop: 197, scrollHeight: 300, clientHeight: 100 })).toBe(true)
  })

  it('FR-5: does not stick once a reader has scrolled away from the bottom to read history', () => {
    expect(shouldStickToBottom({ scrollTop: 50, scrollHeight: 300, clientHeight: 100 })).toBe(false)
  })

  it('sticks when the content does not overflow the container at all', () => {
    expect(shouldStickToBottom({ scrollTop: 0, scrollHeight: 80, clientHeight: 100 })).toBe(true)
  })
})
