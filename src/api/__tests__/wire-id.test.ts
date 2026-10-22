import { afterEach, describe, expect, it, vi } from 'vitest'

import { wireId, wireIdOpt } from '../wire-id'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('wireId (DEMO-FIX-1)', () => {
  it('sends a string id in http mode', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    expect(wireId(3)).toBe('3')
    expect(wireId('42')).toBe('42')
  })

  it('keeps the value in mock mode', () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(wireId(3)).toBe(3)
    expect(wireId('42')).toBe('42')
  })

  it('wireIdOpt keeps null and undefined in both modes', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    expect(wireIdOpt(null)).toBeNull()
    expect(wireIdOpt(undefined)).toBeUndefined()
    expect(wireIdOpt(7)).toBe('7')
    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(wireIdOpt(7)).toBe(7)
  })
})
