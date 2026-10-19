import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import guru from '../../routes/guru'
import pelajar from '../../routes/pelajar'

const COMMON = {
  layout: 'user',
  access: 'auth',
  roles: ['school_admin'],
  onForbidden: '403',
  module: 'M27',
}

const byPath = (routes: typeof pelajar, path: string) => routes.find((r) => r.path === path)

describe('S6, S9, S12 routes (FR-M27-38, 40, 44)', () => {
  it.each([
    ['/admin-sekolah/pelajar', 'Senarai Pelajar', undefined],
    ['/admin-sekolah/pelajar/baru', 'Tambah Pelajar', 'Cipta satu akaun pelajar'],
    ['/admin-sekolah/pelajar/:id(\\d+)', 'Edit Pengguna', 'Kemaskini maklumat pengguna'],
  ])('%s is a school_admin user-shell route with the exact titles', (path, title, subtitle) => {
    const route = byPath(pelajar, path)
    expect(route?.meta).toMatchObject({
      ...COMMON,
      title: `${title} - PRESTASIPLUS`,
      header: subtitle ? { title, subtitle } : { title },
    })
  })

  it('registers /pelajar/baru before :id', () => {
    const paths = pelajar.map((r) => r.path)
    expect(paths.indexOf('/admin-sekolah/pelajar/baru')).toBeLessThan(
      paths.indexOf('/admin-sekolah/pelajar/:id(\\d+)'),
    )
  })
})

describe('S7, S10, S11 routes (FR-M27-38, 40, 44)', () => {
  it.each([
    ['/admin-sekolah/guru', 'Senarai Guru', undefined],
    ['/admin-sekolah/guru/baru', 'Cipta Pengguna', 'Daftarkan akaun guru ke sekolah anda'],
    ['/admin-sekolah/guru/:id(\\d+)', 'Edit Pengguna', 'Kemaskini maklumat pengguna'],
  ])('%s is a school_admin user-shell route with the exact titles', (path, title, subtitle) => {
    const route = byPath(guru, path)
    expect(route?.meta).toMatchObject({
      ...COMMON,
      title: `${title} - PRESTASIPLUS`,
      header: subtitle ? { title, subtitle } : { title },
    })
  })

  it('registers /guru/baru before :id', () => {
    const paths = guru.map((r) => r.path)
    expect(paths.indexOf('/admin-sekolah/guru/baru')).toBeLessThan(
      paths.indexOf('/admin-sekolah/guru/:id(\\d+)'),
    )
  })
})

describe('id matching (FR-M27-43)', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [...pelajar, ...guru] })

  it.each([
    ['/admin-sekolah/pelajar/3001', 'm27.pelajar.edit', 3001],
    ['/admin-sekolah/pelajar/baru', 'm27.pelajar.create', undefined],
    ['/admin-sekolah/guru/5', 'm27.guru.edit', 5],
    ['/admin-sekolah/guru/baru', 'm27.guru.create', undefined],
  ])('%s resolves to %s and passes a numeric id', (path, name, id) => {
    const resolved = router.resolve(path)
    expect(resolved.name).toBe(name)
    const record = resolved.matched[0]!
    if (id !== undefined) {
      const props = record.props.default
      expect(typeof props === "function" ? props(resolved as never) : props).toEqual({ id })
    }
  })

  it.each(['/admin-sekolah/pelajar/abc', '/admin-sekolah/guru/5x', '/admin-sekolah/pelajar/1/2'])(
    '%s matches no route (global 404 page)',
    (path) => {
      expect(router.resolve(path).matched).toHaveLength(0)
    },
  )
})
