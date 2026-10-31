import { afterEach, describe, expect, it, vi } from 'vitest'

import { adminMenuFor, flatItems } from '@/shells/nav/admin-nav'
import { ALESA_NAV_IDS, navFor, USER_NAV } from '@/shells/nav/user-nav'
import type { Role } from '@/stores/session-types'

import { isAlesaAiOn, isKeluargaAngkatOn, whenAlesaAi, whenKeluargaAngkat } from '../features'

/** `VITE_ALESA_AI` (TRACKER D73): every ALESA / Cikgu Alesa AI surface is hidden unless `on`. */
afterEach(() => {
  vi.unstubAllEnvs()
})

const ROLES: readonly Role[] = ['student', 'teacher', 'school_admin', 'admin']
const labelsOf = (role: Role) => navFor(role, 'sidebar').map((e) => e.id)

describe('isAlesaAiOn / whenAlesaAi', () => {
  it('is off by default and for any value but "on"', () => {
    expect(isAlesaAiOn()).toBe(false)
    vi.stubEnv('VITE_ALESA_AI', 'off')
    expect(isAlesaAiOn()).toBe(false)
    vi.stubEnv('VITE_ALESA_AI', 'on')
    expect(isAlesaAiOn()).toBe(true)
  })

  it('keeps the routes only when on', () => {
    expect(whenAlesaAi([1, 2])).toEqual([])
    vi.stubEnv('VITE_ALESA_AI', 'on')
    expect(whenAlesaAi([1, 2])).toEqual([1, 2])
  })
})

describe('menus', () => {
  it('drop every ALESA entry (and their headings) while the flag is off', () => {
    for (const role of ROLES) {
      const ids = labelsOf(role)
      for (const id of ALESA_NAV_IDS) expect(ids, `${role} ${id}`).not.toContain(id)
    }
    expect(flatItems(adminMenuFor('admin')).map((i) => i.id)).not.toContain('spm-walkthrough')
    expect(flatItems(adminMenuFor('admin')).map((i) => i.label)).not.toContain('Cikgu Alesa')
  })

  it('show them again when on', () => {
    vi.stubEnv('VITE_ALESA_AI', 'on')
    expect(labelsOf('teacher')).toEqual(
      expect.arrayContaining(['rph-cikgu-alesa', 'semak-karangan', 'pbd-cikgu-alesa']),
    )
    expect(labelsOf('student')).toContain('cikgu-alesa-chat')
    expect(flatItems(adminMenuFor('admin')).map((i) => i.id)).toContain('spm-walkthrough')
    expect(USER_NAV.some((e) => ALESA_NAV_IDS.has(e.id))).toBe(true)
  })
})

describe('routes', () => {
  it('M13 and the SPM Walkthrough register no route while off, and the full table when on', async () => {
    vi.resetModules()
    const off = await import('@/modules/m13-cikgu-alesa')
    expect(off.manifest.routes).toEqual([])
    const offM06 = (await import('@/modules/m06-spm')).manifest.routes
    expect(offM06.map((r) => r.path)).not.toContain('/pusat-ai/spm')

    vi.stubEnv('VITE_ALESA_AI', 'on')
    vi.resetModules()
    const on = await import('@/modules/m13-cikgu-alesa')
    expect(on.manifest.routes.map((r) => r.path)).toEqual(
      expect.arrayContaining(['/cikgu', '/cikgu/rph', '/cikgu/essay', '/cikgu/pbd']),
    )
    const onM06 = (await import('@/modules/m06-spm')).manifest.routes
    expect(onM06.map((r) => r.path)).toContain('/pusat-ai/spm')
  })
})

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
