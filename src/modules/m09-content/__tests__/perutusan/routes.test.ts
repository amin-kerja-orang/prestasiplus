import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import routes from '../../routes/perutusan'

const router = createRouter({ history: createMemoryHistory(), routes })
const nameOf = (path: string): string | undefined => {
  const r = router.resolve(path)
  return r.matched.length > 0 ? String(r.name) : undefined
}

describe('M09 perutusan routes (S5-T09)', () => {
  it('declares tulis and saya before the numeric id route', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '/perutusan',
      '/perutusan/tulis',
      '/perutusan/saya',
      '/perutusan/:id(\\d+)',
    ])
  })

  it('does not match tulis or saya as an id', () => {
    expect(nameOf('/perutusan/tulis')).toBe('perutusan-compose')
    expect(nameOf('/perutusan/saya')).toBe('perutusan-mine')
  })

  it('the id route is numeric only and passes a number prop', () => {
    expect(nameOf('/perutusan/42')).toBe('perutusan-detail')
    expect(nameOf('/perutusan/abc')).toBeUndefined()
    expect(nameOf('/perutusan/4x')).toBeUndefined()
    const detail = routes[3]
    const props = detail?.props as (r: { params: { id: string } }) => { id: number }
    expect(props({ params: { id: '42' } })).toEqual({ id: 42 })
  })

  it('has roles: readers teacher, school_admin, admin; writers school_admin, admin', () => {
    const roles = Object.fromEntries(routes.map((r) => [String(r.name), r.meta?.roles]))
    expect(roles['perutusan-list']).toEqual(['teacher', 'school_admin', 'admin'])
    expect(roles['perutusan-detail']).toEqual(['teacher', 'school_admin', 'admin'])
    expect(roles['perutusan-compose']).toEqual(['school_admin', 'admin'])
    expect(roles['perutusan-mine']).toEqual(['school_admin', 'admin'])
  })

  it('uses the user layout, auth access and module M09 with the list header', () => {
    for (const r of routes) {
      expect(r.meta).toMatchObject({ layout: 'user', access: 'auth', module: 'M09', v2: true })
    }
    expect(routes[0]?.meta?.header).toEqual({
      title: 'Perutusan Rasmi',
      subtitle: 'Maklumat & berita dari pihak pengurusan',
    })
  })
})
