import { afterEach, describe, expect, it, vi } from 'vitest'

import { navFor } from '@/shells/nav/user-nav'
import type { Role } from '@/stores/session-types'

import { isKeluargaAngkatOn, whenKeluargaAngkat } from '../features'

afterEach(() => {
  vi.unstubAllEnvs()
})

const ROLES: readonly Role[] = ['student', 'teacher', 'school_admin', 'admin']
const labelsOf = (role: Role) => navFor(role, 'sidebar').map((e) => e.id)

/** `VITE_KELUARGA_ANGKAT` (TRACKER D74): Mohon Keluarga Angkat (M21 S6) is hidden unless `on`. */
describe('isKeluargaAngkatOn / whenKeluargaAngkat', () => {
  it('is off by default and for any value but "on"', () => {
    expect(isKeluargaAngkatOn()).toBe(false)
    vi.stubEnv('VITE_KELUARGA_ANGKAT', 'off')
    expect(isKeluargaAngkatOn()).toBe(false)
    vi.stubEnv('VITE_KELUARGA_ANGKAT', 'on')
    expect(isKeluargaAngkatOn()).toBe(true)
  })

  it('keeps the routes only when on', () => {
    expect(whenKeluargaAngkat([1, 2])).toEqual([])
    vi.stubEnv('VITE_KELUARGA_ANGKAT', 'on')
    expect(whenKeluargaAngkat([1, 2])).toEqual([1, 2])
  })

  it('the menu drops the item and the Killer Features heading once it is empty while off', () => {
    for (const role of ROLES) {
      const ids = labelsOf(role)
      expect(ids, role).not.toContain('mohon-keluarga-angkat')
    }
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    expect(navFor('student', 'sidebar').map((e) => e.id)).not.toContain('sec-killer')
    expect(navFor('student', 'drawer').map((e) => e.id)).not.toContain('mohon-keluarga-angkat')
  })

  it('the menu shows the item again when on', () => {
    vi.stubEnv('VITE_KELUARGA_ANGKAT', 'on')
    expect(labelsOf('student')).toContain('mohon-keluarga-angkat')
  })

  it('registers no route while off, and the S6 route when on', async () => {
    vi.resetModules()
    const off = (await import('@/modules/m21-sponsorship')).manifest.routes
    expect(off.map((r) => r.path)).not.toContain('/mohon-keluarga-angkat')
    vi.stubEnv('VITE_KELUARGA_ANGKAT', 'on')
    vi.resetModules()
    const on = (await import('@/modules/m21-sponsorship')).manifest.routes
    expect(on.map((r) => r.path)).toContain('/mohon-keluarga-angkat')
  })
})
