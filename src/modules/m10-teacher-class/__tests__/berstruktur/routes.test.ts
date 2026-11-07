import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import routes from '../../routes/soalan'

const router = createRouter({ history: createMemoryHistory(), routes })
const at = (path: string) => router.resolve(path)

describe('/guru/soalan-berstruktur routes (R1-GUR-44b)', () => {
  it('registers the form, the edit form and the detail for a question or an own submission', () => {
    expect(at('/guru/soalan-berstruktur/cipta').name).toBe('m10.soalan.berstruktur.cipta')
    expect(at('/guru/soalan-berstruktur/g12/edit').name).toBe('m10.soalan.berstruktur.edit')
    expect(at('/guru/soalan-berstruktur/g12').name).toBe('m10.soalan.berstruktur.detail')
    expect(at('/guru/soalan-berstruktur/4001').name).toBe('m10.soalan.berstruktur.detail')
  })

  it('does not route an approved question to the edit form, nor "cipta" to the detail', () => {
    expect(at('/guru/soalan-berstruktur/4001/edit').matched).toHaveLength(0)
    expect(at('/guru/soalan-berstruktur/cipta').name).not.toBe('m10.soalan.berstruktur.detail')
  })

  it('teacher and admin, user layout; the detail receives a question id as a number and an own g{n} id as a string', () => {
    for (const p of ['/guru/soalan-berstruktur/cipta', '/guru/soalan-berstruktur/g3/edit']) {
      const meta = at(p).meta
      expect(meta.roles).toEqual(['teacher', 'admin'])
      expect(meta.layout).toBe('user')
    }
    const rec = routes.find((r) => r.name === 'm10.soalan.berstruktur.detail')!
    const props = rec.props as (r: unknown) => Record<string, unknown>
    expect(props({ params: { id: 'g3' } })).toEqual({ id: 'g3', portal: 'guru' })
    expect(props({ params: { id: '4001' } })).toEqual({ id: 4001, portal: 'guru' })
  })

  it('the M04 links (list, create button, edit action) land on the real route records (the paths of the M04 link helpers)', () => {
    expect(at('/guru/soalan-berstruktur').name).toBe('m10.soalan.berstruktur')
    expect(at('/guru/soalan-berstruktur/cipta').name).toBe('m10.soalan.berstruktur.cipta')
    const edit = at('/guru/soalan-berstruktur/g12/edit')
    expect(edit.name).toBe('m10.soalan.berstruktur.edit')
    expect(edit.params.id).toBe('g12')
    const rec = routes.find((r) => r.name === 'm10.soalan.berstruktur.edit')!
    expect((rec.props as (r: unknown) => unknown)(edit)).toEqual({ id: 'g12' })
  })
})
