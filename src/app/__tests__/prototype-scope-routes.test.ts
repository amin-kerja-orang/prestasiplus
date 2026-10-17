import { afterEach, describe, expect, it, vi } from 'vitest'

import { devRoutes } from '../router/core-routes'

afterEach(() => {
  vi.unstubAllEnvs()
})

const paths = (): string[] => devRoutes().map((r) => r.path)

describe('dev routes with the prototype scope on (D43)', () => {
  it('hide the preview hub and every /__dev/* page, but keep /__ds', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    const found = paths()
    expect(found).toContain('/__ds')
    expect(found).not.toContain('/admin')
    expect(found).not.toContain('/dashboard')
    expect(found.filter((p) => p.startsWith('/__dev'))).toEqual([])
  })

  it('are all back when the switch is off', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    const found = paths()
    expect(found).toContain('/__ds')
    expect(found).toContain('/admin')
    expect(found).toContain('/__dev/shell')
    expect(found).toContain('/__dev/tokens')
  })
})
