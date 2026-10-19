import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

import behavior from '../../../routes/behavior'
import chain from '../../../routes/chain'
import interventions from '../../../routes/interventions'
import pelajar from '../../../routes/pelajar'
import results from '../../../routes/results'

const all: RouteRecordRaw[] = [...behavior, ...results, ...chain, ...interventions, ...pelajar]
const byPath = (p: string) => all.find((r) => r.path === p)

describe('M12-T3/T4 route fragments (FR-M12-05, 06, 08, 13, 16)', () => {
  it('mounts every screen on both prefixes in the admin shell, behind a session', () => {
    for (const prefix of ['/admin/kirkpatrick', '/guru/kirkpatrick']) {
      for (const path of [
        'behavior',
        'results',
        'chain',
        'interventions',
        'pelajar/:userId(\\d+)',
      ]) {
        const r = byPath(`${prefix}/${path}`)
        expect(r, `${prefix}/${path}`).toBeDefined()
        expect(r?.meta).toMatchObject({ layout: 'admin', access: 'auth', module: 'M12' })
      }
    }
  })

  it('has the exact tab titles and shell headers', () => {
    const m = (p: string) => byPath(`/admin/kirkpatrick/${p}`)?.meta
    expect(m('behavior')).toMatchObject({
      title: 'Tahap 3: Tingkah Laku — Kirkpatrick',
      header: {
        title: 'Tahap 3: Tingkah Laku',
        subtitle: 'Konsistensi penggunaan, engagement score, dan corak tingkah laku pelajar',
      },
    })
    expect(m('results')).toMatchObject({
      title: 'Tahap 4: Hasil — Kirkpatrick',
      header: {
        title: 'Tahap 4: Hasil',
        subtitle: 'Impak terhadap keputusan peperiksaan dan prestasi akademik',
      },
    })
    expect(m('chain')).toMatchObject({
      title: 'Kirkpatrick Impact Chain',
      header: { title: 'Rantaian Impak' },
    })
    expect(m('chain')?.header).not.toHaveProperty('subtitle')
    expect(m('interventions')).toMatchObject({
      title: 'Intervensi — Kirkpatrick',
      header: {
        title: 'Intervensi Pelajar',
        subtitle: 'Rekod tindakan intervensi berdasarkan amaran Kirkpatrick',
      },
    })
  })

  it('admits only the roles of the mount: admin on /admin, teacher and admin on /guru (others go to their landing page)', () => {
    expect(byPath('/admin/kirkpatrick/behavior')?.meta?.roles).toEqual(['admin'])
    expect(byPath('/guru/kirkpatrick/behavior')?.meta?.roles).toEqual(['teacher', 'admin'])
    for (const r of all.filter((x) => x.path.startsWith('/guru'))) {
      expect(r.meta?.roles).not.toContain('school_admin')
      expect(r.meta?.onForbidden).toBeUndefined()
    }
  })

  it('has no GET route for /interventions/{id} or /interventions/create (DV-M12-11) and no alias for S4-S8', () => {
    expect(all.some((r) => r.path.includes('/interventions/'))).toBe(false)
    expect(all.some((r) => r.path.startsWith('/admin-sekolah'))).toBe(false)
  })

  it('matches only numeric student ids and passes the id and prefix as props', () => {
    const r = byPath('/guru/kirkpatrick/pelajar/:userId(\\d+)')!
    const props = r.props as (route: { params: Record<string, string> }) => Record<string, unknown>
    expect(props({ params: { userId: '4664' } })).toEqual({
      basePath: '/guru/kirkpatrick',
      userId: 4664,
    })
  })

  it('opens the PDF target without a shell', () => {
    expect(byPath('/admin/kirkpatrick/export-pdf')?.meta).toMatchObject({ layout: 'bare' })
  })
})
