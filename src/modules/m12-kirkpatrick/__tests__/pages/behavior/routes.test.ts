import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

import behavior from '../../../routes/behavior'
import chain from '../../../routes/chain'
import interventions from '../../../routes/interventions'
import learning from '../../../routes/learning'
import overview from '../../../routes/overview'
import pelajar from '../../../routes/pelajar'
import reaction from '../../../routes/reaction'
import results from '../../../routes/results'

const all: RouteRecordRaw[] = [
  ...overview,
  ...reaction,
  ...learning,
  ...behavior,
  ...results,
  ...chain,
  ...interventions,
  ...pelajar,
]
const byPath = (p: string) => all.find((r) => r.path === p)

describe('M12-T3/T4 route fragments (FR-M12-05, 06, 08, 13, 16)', () => {
  const SCREENS = [
    'reaction',
    'learning',
    'behavior',
    'results',
    'chain',
    'interventions',
    'pelajar/:userId(\\d+)',
  ]
  const LAYOUT = {
    '/admin/kirkpatrick': 'admin',
    '/guru/kirkpatrick': 'user',
    '/admin-sekolah/kirkpatrick': 'user',
  } as const

  it('mounts every screen on the three prefixes: admin shell for /admin, user shell for /guru and /admin-sekolah, behind a session', () => {
    for (const [prefix, layout] of Object.entries(LAYOUT)) {
      for (const path of SCREENS) {
        const r = byPath(`${prefix}/${path}`)
        expect(r, `${prefix}/${path}`).toBeDefined()
        expect(r?.meta).toMatchObject({ layout, access: 'auth', module: 'M12' })
      }
      expect(byPath(prefix)?.meta, prefix).toMatchObject({ layout, access: 'auth', module: 'M12' })
    }
  })

  it('FR-AS-11-1: the seven school-admin screens, the pupil detail and the PDF exist for school_admin only (AC-AS-11-1)', () => {
    const prefix = '/admin-sekolah/kirkpatrick'
    const paths = [
      '',
      '/reaction',
      '/learning',
      '/behavior',
      '/results',
      '/chain',
      '/interventions',
      '/pelajar/:userId(\\d+)',
      '/export-pdf',
    ]
    for (const path of paths) {
      const r = byPath(`${prefix}${path}`)
      expect(r, `${prefix}${path}`).toBeDefined()
      expect(r?.meta?.roles, path).toEqual(['school_admin'])
      expect(r?.meta?.layout, path).toBe(path === '/export-pdf' ? 'bare' : 'user')
    }
  })

  it('FR-GUR-11-1: /guru/kirkpatrick is in the user shell, /admin/kirkpatrick keeps the admin shell', () => {
    expect(byPath('/guru/kirkpatrick')?.meta?.layout).toBe('user')
    expect(byPath('/admin/kirkpatrick')?.meta?.layout).toBe('admin')
  })

  it('the overview props: detail links on for every mount, locked school only for the school admin, no comparison panel for the Guru (AC-GUR-11-2)', () => {
    const props = (p: string) =>
      (byPath(p)?.props as (r: unknown) => Record<string, unknown>)({ params: {}, query: {} })
    expect(props('/admin/kirkpatrick')).toEqual({
      basePath: '/admin/kirkpatrick',
      detailLinks: true,
      showComparison: true,
    })
    expect(props('/guru/kirkpatrick')).toMatchObject({ detailLinks: true, showComparison: false })
    expect(props('/admin-sekolah/kirkpatrick')).toEqual({
      basePath: '/admin-sekolah/kirkpatrick',
      detailLinks: true,
      scopeForced: true,
    })
  })

  it('forces the school on the school-admin Tahap 3 page only', () => {
    const props = (p: string) =>
      (byPath(p)?.props as (r: unknown) => Record<string, unknown>)({ params: {} })
    expect(props('/admin-sekolah/kirkpatrick/behavior')).toMatchObject({ scopeForced: true })
    expect(props('/admin/kirkpatrick/behavior')).toMatchObject({ scopeForced: false })
    expect(props('/guru/kirkpatrick/behavior')).toMatchObject({ scopeForced: false })
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

  it('admits only the roles of the mount: admin on /admin, teacher and admin on /guru, school_admin on /admin-sekolah (others go to their landing page)', () => {
    expect(byPath('/admin/kirkpatrick/behavior')?.meta?.roles).toEqual(['admin'])
    expect(byPath('/guru/kirkpatrick/behavior')?.meta?.roles).toEqual(['teacher', 'admin'])
    for (const r of all.filter((x) => !x.path.startsWith('/admin-sekolah'))) {
      expect(r.meta?.roles).not.toContain('school_admin')
      expect(r.meta?.onForbidden).toBeUndefined()
    }
  })

  it('has no GET route for /interventions/{id} or /interventions/create (DV-M12-11)', () => {
    expect(all.some((r) => r.path.includes('/interventions/'))).toBe(false)
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
    expect(byPath('/admin-sekolah/kirkpatrick/export-pdf')?.meta).toMatchObject({ layout: 'bare' })
  })
})
