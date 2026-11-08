import type { RouteLocationNormalized } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { manifest as m17 } from '@/modules/m17-admin-dashboard'

import { adminLandingFor, devRoutes } from '../router/core-routes'
import { decideAccess } from '../router/guards'

const m17Routes = m17.routes

describe('/admin landing outside the preview hub (G4 #394)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sends Admin Pusat to the Command Center and a school admin to /admin-sekolah (no loop)', () => {
    expect(adminLandingFor('admin')).toBe('/admin/command-center')
    expect(adminLandingFor('school_admin')).toBe('/admin-sekolah')
    expect(adminLandingFor(null)).toBe('/admin/command-center')
  })

  it('has no /admin redirect in a production build with the scope off: /admin is the M17 dashboard', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect(devRoutes().find((r) => r.path === '/admin')).toBeUndefined()
    expect(m17Routes.find((r) => r.path === '/admin')?.name).toBe('m17.admin-dashboard')
  })

  it('keeps the preview hub in dev with the scope off', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    const admin = devRoutes().find((r) => r.path === '/admin')
    expect(admin?.name).toBe('dev.preview-hub-admin')
  })

  describe('role-aware fallback on /admin with the scope off (D106)', () => {
    const adminRoute = () => {
      const r = m17Routes.find((x) => x.path === '/admin')
      return { path: '/admin', meta: { ...r?.meta } } as unknown as RouteLocationNormalized
    }

    it('sends a school admin landed on /admin to /admin-sekolah, not a 403', () => {
      vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
      expect(
        decideAccess(adminRoute(), { isLoggedIn: true, role: 'school_admin', landingPath: '/admin' }),
      ).toEqual({ kind: 'redirect', to: '/admin-sekolah' })
    })

    it('keeps Admin Pusat on the real /admin Dashboard', () => {
      vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
      expect(
        decideAccess(adminRoute(), { isLoggedIn: true, role: 'admin', landingPath: '/admin' }),
      ).toEqual({ kind: 'allow' })
    })
  })
})
