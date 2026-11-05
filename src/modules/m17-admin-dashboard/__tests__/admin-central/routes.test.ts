import { describe, expect, it } from 'vitest'

import routes from '../../routes'

const find = (path: string) => routes.find((r) => r.path === path)

describe('M17 Admin Pusat central routes (S6-T11)', () => {
  it.each([
    ['/admin', 'm17.admin-dashboard', 'Dashboard - Admin Panel'],
    ['/admin/analytics', 'm17.admin-analytics', 'Analitik & Statistik - Admin Panel'],
    ['/admin/laporan', 'm17.admin-laporan', 'Laporan - Admin Panel'],
  ])('registers %s for the admin only in the admin layout', (path, name, title) => {
    const r = find(path)
    expect(r?.name).toBe(name)
    expect(r?.meta).toMatchObject({ layout: 'admin', access: 'auth', roles: ['admin'], title })
    expect(typeof r?.component).toBe('function')
  })
})
