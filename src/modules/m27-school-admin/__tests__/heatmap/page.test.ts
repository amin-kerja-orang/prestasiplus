// @vitest-environment jsdom
/**
 * M27 S2 "DSKP Heatmap" component tests (SRS M27 Part B v1.8 FR-M27-44, 58…64; AC-M27-17.1…17.4, 18.1, 18.2)
 * against a mocked client: exact BM copy, tile colours and `title`, legend, filters, empty and error states.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { SchoolDskpHeatmap } from '../../api/school-admin'
import { tileTitle } from '../../components/heatmap/dskp-status'
import DskpHeatmapPage from '../../pages/DskpHeatmapPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchSchoolDskpHeatmap: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  fetchSchoolDskpHeatmap: api.fetchSchoolDskpHeatmap,
}))

const sp = (id: number, code: string, answered: number, correct: number) => {
  const pct = answered > 0 ? Math.floor((100 * correct) / answered + 0.5) : null
  const status = pct === null ? 'belum' : pct >= 75 ? 'mahir' : pct >= 50 ? 'sederhana' : 'lemah'
  return { id, code, title: `Murid boleh ${code}`, answered, correct, pct, status } as const
}

function heatmap(over: Partial<SchoolDskpHeatmap> = {}): SchoolDskpHeatmap {
  return {
    school: { id: 1, name: 'SMK Contoh Ujian' },
    subjects: [
      { id: 7, name: 'Fizik' },
      { id: 9, name: 'Kimia' },
    ],
    subject: { id: 9, name: 'Kimia' },
    level: { code: 't5', name: 'Tingkatan 5' },
    caption: 'KSSM Kimia Tingkatan 5',
    bidang: [
      {
        id: 1,
        code: '1.0',
        name: 'Kadar Tindak Balas',
        sp: [
          sp(1, '1.1.1', 20, 18),
          sp(2, '1.1.2', 10, 6),
          sp(3, '1.1.3', 10, 2),
          sp(4, '1.1.4', 0, 0),
        ],
      },
      { id: 2, code: null, name: 'Bidang Tanpa Kod', sp: [sp(5, '2.1.1', 4, 3)] },
    ],
    ...over,
  }
}

let router: Router

async function mountPage(
  data: SchoolDskpHeatmap | ApiError,
  url = '/admin-sekolah/dskp-heatmap',
): Promise<VueWrapper> {
  if (data instanceof ApiError) api.fetchSchoolDskpHeatmap.mockRejectedValue(data)
  else api.fetchSchoolDskpHeatmap.mockResolvedValue(data)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(DskpHeatmapPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  api.fetchSchoolDskpHeatmap.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
})

describe('route (FR-M27-38, 40, 44)', () => {
  it('declares S2 in the user shell for school_admin only with the 403 outcome and the tab title', () => {
    const s2 = routes.find((r) => r.path === '/admin-sekolah/dskp-heatmap')
    expect(s2?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'DSKP Heatmap - PRESTASIPLUS',
      header: { title: 'DSKP Heatmap' },
    })
  })
})

describe('header, breadcrumb and card (FR-M27-44, 58)', () => {
  it('sets the sub-line to the school name', async () => {
    await mountPage(heatmap())
    expect(usePageMeta().state.header).toEqual({
      title: 'DSKP Heatmap',
      subtitle: 'SMK Contoh Ujian',
    })
  })

  it('shows the breadcrumb link, a separator and the bold title as text', async () => {
    const w = await mountPage(heatmap())
    const back = w.get('[data-testid="dh-crumb-back"]')
    expect(back.text()).toBe('← Dashboard Sekolah')
    expect(back.attributes('href')).toBe('/admin-sekolah')
    const current = w.get('[data-testid="dh-crumb-current"]')
    expect(current.text()).toBe('DSKP Heatmap')
    expect(current.element.tagName).not.toBe('A')
    expect(current.classes()).toContain('font-bold')
  })

  it('shows the card heading and the caption', async () => {
    const w = await mountPage(heatmap())
    expect(text(w, 'dh-heading')).toBe('Peta DSKP — Standard Pembelajaran')
    expect(text(w, 'dh-caption')).toBe('KSSM Kimia Tingkatan 5')
  })
})

describe('filters (FR-M27-59; AC-M27-18.1)', () => {
  it('lists the subjects of the level only, with no "all" option, and selects the shown one', async () => {
    const w = await mountPage(heatmap(), '/admin-sekolah/dskp-heatmap?tingkatan=T5')
    const select = w.get('[data-testid="dh-subject"]')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Fizik', 'Kimia'])
    expect((select.element as HTMLSelectElement).value).toBe('9')
    expect(w.get('label[for="dh-subject"]').text()).toBe('Subjek')
  })

  it('shows the pills "Tingkatan 4" and "Tingkatan 5" with the data level active', async () => {
    const w = await mountPage(heatmap())
    expect(text(w, 'dh-level-t4')).toBe('Tingkatan 4')
    expect(text(w, 'dh-level-t5')).toBe('Tingkatan 5')
    expect(w.get('[data-testid="dh-level-t5"]').attributes('data-active')).toBe('true')
    expect(w.get('[data-testid="dh-level-t4"]').attributes('data-active')).toBe('false')
  })

  it('pill links keep the subject and set the level', async () => {
    const w = await mountPage(heatmap(), '/admin-sekolah/dskp-heatmap?subjectId=9&tingkatan=T5')
    expect(w.get('[data-testid="dh-level-t4"]').attributes('href')).toBe(
      '/admin-sekolah/dskp-heatmap?subjectId=9&tingkatan=T4',
    )
  })

  it('reloads with ?subjectId=…&tingkatan=… when the select changes', async () => {
    const w = await mountPage(heatmap())
    await w.get('[data-testid="dh-subject"]').setValue('7')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subjectId: '7', tingkatan: 'T5' })
    expect(api.fetchSchoolDskpHeatmap).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: 7, tingkatan: 'T5' }),
    )
  })

  it('passes the query to the client on load', async () => {
    await mountPage(heatmap(), '/admin-sekolah/dskp-heatmap?subjectId=9&tingkatan=T5')
    expect(api.fetchSchoolDskpHeatmap).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 9, tingkatan: 'T5' }),
    )
  })
})

describe('tiles (FR-M27-60…63; AC-M27-17.2…17.4)', () => {
  it('groups tiles under "{code} {name}" headings in the given order', async () => {
    const w = await mountPage(heatmap())
    expect(w.findAll('[data-testid="dh-bidang-title"]').map((e) => e.text())).toEqual([
      '1.0 Kadar Tindak Balas',
      'Bidang Tanpa Kod',
    ])
    expect(w.findAll('[data-testid="dh-tile-code"]').map((e) => e.text())).toEqual([
      '1.1.1',
      '1.1.2',
      '1.1.3',
      '1.1.4',
      '2.1.1',
    ])
  })

  it('colours by status on the shown integer and shows no value for "Belum cuba"', async () => {
    const w = await mountPage(heatmap())
    const tiles = w.findAll('[data-testid="dh-tile"]')
    expect(tiles.map((t) => t.attributes('data-status'))).toEqual([
      'mahir',
      'sederhana',
      'lemah',
      'belum',
      'mahir',
    ])
    expect(tiles[0]?.classes()).toContain('bg-green-100')
    expect(tiles[1]?.classes()).toContain('bg-yellow-100')
    expect(tiles[2]?.classes()).toContain('bg-red-100')
    expect(tiles[3]?.classes()).toContain('bg-slate-100')
    expect(tiles.map((t) => t.find('[data-testid="dh-tile-pct"]').exists())).toEqual([
      true,
      true,
      true,
      false,
      true,
    ])
    expect(tiles[0]?.get('[data-testid="dh-tile-pct"]').text()).toBe('90%')
  })

  it('has the title "{code}: {title} — {status}" plus the counts when answered; tiles are not links', async () => {
    const w = await mountPage(heatmap())
    const tiles = w.findAll('[data-testid="dh-tile"]')
    expect(tiles[0]?.attributes('title')).toBe(
      '1.1.1: Murid boleh 1.1.1 — Mahir · 20 cuba · 90% betul',
    )
    expect(tiles[3]?.attributes('title')).toBe('1.1.4: Murid boleh 1.1.4 — Belum cuba')
    expect(w.find('[data-testid="dh-tiles"] a').exists()).toBe(false)
  })

  it('judges the status on the shown integer (74.5 shows 75 and is "Mahir")', () => {
    expect(tileTitle(sp(9, '9.9.9', 200, 149))).toContain('— Mahir')
    expect(tileTitle(sp(9, '9.9.9', 200, 148))).toContain('— Sederhana')
  })

  it('shows the legend in order', async () => {
    const w = await mountPage(heatmap())
    expect(w.findAll('[data-testid="dh-legend"] > span').map((e) => e.text())).toEqual([
      'Mahir (75%+)',
      'Sederhana (50-74%)',
      'Lemah (<50%)',
      'Belum Cuba',
    ])
  })
})

describe('empty states (FR-M27-64; AC-M27-18.2, 18.3)', () => {
  const EMPTY = 'Tiada Standard Pembelajaran untuk subjek dan tingkatan ini.'

  it('shows the text and no tiles or caption when no subject has an SP at the level', async () => {
    const w = await mountPage(heatmap({ subjects: [], subject: null, caption: null, bidang: [] }))
    expect(text(w, 'dh-empty')).toBe(EMPTY)
    expect(has(w, 'dh-tile')).toBe(false)
    expect(has(w, 'dh-caption')).toBe(false)
    expect(w.get('[data-testid="dh-subject"]').findAll('option')).toHaveLength(1)
  })

  it('shows the text for a subjectId that is not a subject of the level', async () => {
    const w = await mountPage(heatmap(), '/admin-sekolah/dskp-heatmap?subjectId=999&tingkatan=T5')
    expect(text(w, 'dh-empty')).toBe(EMPTY)
    expect(has(w, 'dh-tile')).toBe(false)
  })

  it('shows every tile "Belum cuba" without a percentage and without an error for a school with no records', async () => {
    const base = heatmap()
    const w = await mountPage({
      ...base,
      bidang: base.bidang.map((b) => ({ ...b, sp: b.sp.map((s) => sp(s.id, s.code, 0, 0)) })),
    })
    const tiles = w.findAll('[data-testid="dh-tile"]')
    expect(tiles).toHaveLength(5)
    expect(tiles.every((t) => t.attributes('data-status') === 'belum')).toBe(true)
    expect(has(w, 'dh-tile-pct')).toBe(false)
    expect(has(w, 'dh-error')).toBe(false)
    expect(has(w, 'dh-empty')).toBe(false)
  })
})

describe('states (FR-M27-48)', () => {
  it('shows the spinner only while loading', async () => {
    api.fetchSchoolDskpHeatmap.mockReturnValue(new Promise(() => undefined))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/')
    const w = mount(DskpHeatmapPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'dh-loading')).toBe(true)
    expect(has(w, 'dh-card')).toBe(false)
  })

  it('renders the global 403 outcome in place for a 403', async () => {
    const w = await mountPage(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Akses ditolak.',
        method: 'GET',
        url: '/api/admin-sekolah/dskp-heatmap',
      }),
    )
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'dh-error')).toBe(false)
    expect(has(w, 'dh-card')).toBe(false)
  })

  it('shows the server message for another failure and no school data', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Ralat pelayan.',
        method: 'GET',
        url: '/api/admin-sekolah/dskp-heatmap',
      }),
    )
    expect(useRouteOutcome().value).toBeNull()
    expect(text(w, 'dh-error')).toContain('Ralat pelayan.')
    expect(has(w, 'dh-card')).toBe(false)
  })
})
