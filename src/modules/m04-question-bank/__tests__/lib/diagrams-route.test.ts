import { describe, expect, it } from 'vitest'

import routes from '../../routes/diagrams'

describe('M04 diagram audit route (S6-T18)', () => {
  it('is open to admin, teacher and school_admin on the admin layout', () => {
    const r = routes.find((x) => x.path === '/admin/soalan-gambar')
    expect(r?.meta?.roles).toEqual(['admin', 'teacher', 'school_admin'])
    expect(r?.meta?.layout).toBe('admin')
  })
})
