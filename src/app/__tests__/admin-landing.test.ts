import { afterEach, describe, expect, it, vi } from 'vitest'

import { adminLandingFor, devRoutes } from '../router/core-routes'

describe('/admin landing outside the preview hub (G4 #394)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sends Admin Pusat to the Command Center and a school admin to /admin-sekolah (no loop)', () => {
    expect(adminLandingFor('admin')).toBe('/admin/command-center')
    expect(adminLandingFor('school_admin')).toBe('/admin-sekolah')
    expect(adminLandingFor(null)).toBe('/admin/command-center')
  })

  it('registers the /admin redirect in a production build with the scope off', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    const admin = devRoutes().find((r) => r.path === '/admin')
    expect(admin).toBeDefined()
    expect(typeof admin?.redirect).toBe('function')
  })

  it('keeps the preview hub in dev with the scope off', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    const admin = devRoutes().find((r) => r.path === '/admin')
    expect(admin?.name).toBe('dev.preview-hub-admin')
  })
})
