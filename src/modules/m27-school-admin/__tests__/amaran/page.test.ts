// @vitest-environment jsdom
/**
 * M27 S4 "Amaran Awal — Sekolah" component tests (SRS M27 Part B v1.8 FR-M27-44, 74…80; AC-M27-21.x, 22.x)
 * against a mocked client: route, header, pills, tiles, distribution, buttons, subject card, risk list,
 * empty and error states, and the session school id.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'
import { useSessionStore } from '@/stores/session'

import type { PupilRiskView, SchoolRiskData } from '../../api/amaran'
import AmaranSekolahPage from '../../pages/AmaranSekolahPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchSchoolRisk: vi.fn(), downloadSchoolRiskCsv: vi.fn() }))
vi.mock('../../api/amaran', async (importActual) => ({
  ...(await importActual<typeof import('../../api/amaran')>()),
  fetchSchoolRisk: api.fetchSchoolRisk,
  downloadSchoolRiskCsv: api.downloadSchoolRiskCsv,
}))
const saveBlob = vi.hoisted(() => vi.fn())
vi.mock('@/lib/save-blob', () => ({ saveBlob }))

const SCHOOL_ID = 900001

function pupil(rank: number, over: Partial<PupilRiskView> = {}): PupilRiskView {
  return {
    rank,
    userId: 100 + rank,
    name: `Murid Contoh ${String(rank)}`,
    classLabel: 'Tingkatan 4 4 Contoh',
    score: 80 - rank,
    status: 'high',
    accuracyText: 'Purata ketepatan: 64%',
    engagementText: 'Terakhir aktif: 2026-02-27',
    masteryText: 'Purata tahap: L1',
    ...over,
  }
}

function data(over: Partial<SchoolRiskData> = {}): SchoolRiskData {
  return {
    school: { id: SCHOOL_ID, name: 'SMK Demo' },
    levelFilter: null,
    levelSuffix: '',
    tally: { green: 5, yellow: 3, red: 2, total: 10, pct: { green: 50, yellow: 30, red: 20 } },
    weakness: [
      { subjectId: 1, subjectName: 'Matematik', weak: 6, total: 184, pct: 3 },
      { subjectId: 2, subjectName: 'Kimia', weak: 5, total: 10, pct: 50 },
    ],
    pupils: [
      pupil(1),
      pupil(2, { status: 'watch', accuracyText: 'Tiada data', classLabel: '-' }),
      pupil(3, { status: 'on_track' }),
    ],
    ...over,
  }
}

function signIn(schoolId: number | null = SCHOOL_ID) {
  useSessionStore().auth = {
    token: 't',
    remember: false,
    expiresAt: '2030-01-01T00:00:00+08:00',
    user: { role: 'school_admin', schoolId, school: { name: 'SMK Demo' } },
  } as never
}

const apiError = (status: number, code: string, message: string) =>
  new ApiError({ status, code, message, method: 'GET', url: '/api/amaran/schools/900001' })

let router: Router

async function mountPage(value: SchoolRiskData | ApiError, url = '/amaran/sekolah') {
  if (value instanceof ApiError) api.fetchSchoolRisk.mockRejectedValue(value)
  else api.fetchSchoolRisk.mockResolvedValue(value)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(AmaranSekolahPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchSchoolRisk.mockReset()
  api.downloadSchoolRiskCsv.mockReset()
  saveBlob.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
  signIn()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('route and header (FR-M27-74, 44)', () => {
  it('declares S4 in the user shell for school_admin only, with the tab title of the SRS', () => {
    const s4 = routes.find((r) => r.path === '/amaran/sekolah')
    expect(s4?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Amaran Awal — Sekolah | PRESTASIPLUS',
      header: { title: 'Amaran Awal — Sekolah' },
    })
    expect(s4?.path).not.toContain(':')
  })

  it('shows the school name as sub-line and has no breadcrumb (DV-M27-22)', async () => {
    const w = await mountPage(data())
    expect(usePageMeta().state.header).toEqual({
      title: 'Amaran Awal — Sekolah',
      subtitle: 'SMK Demo',
    })
    expect(w.find('nav[data-testid="am-breadcrumb"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Papan Pemuka Sekolah')
  })

  it('appends the level suffix to the sub-line with a level', async () => {
    await mountPage(data({ levelFilter: 'T4', levelSuffix: ' — Tingkatan 4' }), '/amaran/sekolah?tingkatan=T4')
    expect(usePageMeta().state.header?.subtitle).toBe('SMK Demo — Tingkatan 4')
  })
})

describe('data call (FR-M27-80)', () => {
  it('calls M18 #21 with the SESSION school id and no level', async () => {
    await mountPage(data())
    expect(api.fetchSchoolRisk).toHaveBeenCalledTimes(1)
    expect(api.fetchSchoolRisk.mock.calls[0]?.[0]).toBe(SCHOOL_ID)
    expect(api.fetchSchoolRisk.mock.calls[0]?.[1]).toMatchObject({ tingkatan: null })
  })

  it('passes ?tingkatan=T5 and ignores any other value', async () => {
    await mountPage(data(), '/amaran/sekolah?tingkatan=T5')
    expect(api.fetchSchoolRisk.mock.calls[0]?.[1]).toMatchObject({ tingkatan: 'T5' })
    api.fetchSchoolRisk.mockClear()
    await mountPage(data(), '/amaran/sekolah?tingkatan=T3&school_id=8080')
    expect(api.fetchSchoolRisk.mock.calls[0]?.[0]).toBe(SCHOOL_ID)
    expect(api.fetchSchoolRisk.mock.calls[0]?.[1]).toMatchObject({ tingkatan: null })
  })
})

describe('pills (FR-M27-75)', () => {
  it('shows the three pills, links on the alias, and activates the current level', async () => {
    const w = await mountPage(data())
    expect(texts(w, 'am-pills').join('')).toContain('Semua Tingkatan')
    const hrefs = ['all', 'T4', 'T5'].map((k) => w.get(`[data-testid="am-pill-${k}"]`).attributes('href'))
    expect(hrefs).toEqual(['/amaran/sekolah', '/amaran/sekolah?tingkatan=T4', '/amaran/sekolah?tingkatan=T5'])
    expect(w.findAll('[data-testid^="am-pill-"]').map((e) => e.text())).toEqual([
      'Semua Tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(w.get('[data-testid="am-pill-all"]').attributes('data-active')).toBe('true')
  })

  it('activates "Tingkatan 4" for ?tingkatan=T4', async () => {
    const w = await mountPage(data(), '/amaran/sekolah?tingkatan=T4')
    expect(w.get('[data-testid="am-pill-T4"]').attributes('data-active')).toBe('true')
    expect(w.get('[data-testid="am-pill-all"]').attributes('data-active')).toBe('false')
  })
})

describe('tiles and distribution (FR-M27-75; AC-M27-21.2)', () => {
  it('shows the four tiles in order with the tally values', async () => {
    const w = await mountPage(data())
    expect(texts(w, 'am-tile-label')).toEqual([
      'Jumlah Pelajar',
      'Atas Landasan',
      'Perlu Perhatian',
      'Berisiko Tinggi',
    ])
    expect(texts(w, 'am-tile-value')).toEqual(['10', '5', '3', '2'])
  })

  it('shows the card, the chart with integer percents and the legend', async () => {
    const w = await mountPage(data())
    expect(text(w, 'am-distribution')).toContain('Taburan Risiko Seluruh Sekolah')
    const chart = text(w, 'am-bar')
    expect(chart).toContain('Hijau (50%)')
    expect(chart).toContain('Kuning (30%)')
    expect(chart).toContain('Merah (20%)')
    expect(texts(w, 'am-legend').join(' ')).toContain('Hijau: 5')
    expect(text(w, 'am-legend-yellow')).toBe('Kuning: 3')
    expect(text(w, 'am-legend-red')).toBe('Merah: 2')
  })

  it('keeps a zero level in the legend', async () => {
    const w = await mountPage(
      data({ tally: { green: 4, yellow: 0, red: 0, total: 4, pct: { green: 100, yellow: 0, red: 0 } } }),
    )
    expect(text(w, 'am-bar')).toContain('Hijau (100%)')
    expect(text(w, 'am-legend-yellow')).toBe('Kuning: 0')
  })
})

describe('buttons (FR-M27-77; AC-M27-22.1)', () => {
  it('renders the three buttons in order with labels, icons and hrefs', async () => {
    const w = await mountPage(data())
    const btns = w.findAll('[data-testid="am-actions"] > *')
    expect(btns.map((b) => b.text())).toEqual([
      'Keberkesanan Intervensi',
      'Ringkasan Eksekutif',
      'Muat Turun CSV',
    ])
    expect(btns.map((b) => b.attributes('data-icon'))).toEqual([
      'fa-chart-pie',
      'fa-file-alt',
      'fa-download',
    ])
    expect(btns.map((b) => b.attributes('href'))).toEqual([
      '/amaran/keberkesanan',
      `/amaran/ringkasan-eksekutif?scope=school&school_id=${String(SCHOOL_ID)}`,
      `/amaran/export/school/${String(SCHOOL_ID)}`,
    ])
  })

  it('downloads the CSV through M18 #30 with the session school and the server file name', async () => {
    const blob = new Blob(['x'])
    api.downloadSchoolRiskCsv.mockResolvedValue({ blob, filename: 'amaran-sekolah-900001-20260925.csv' })
    const w = await mountPage(data())
    await w.get('[data-testid="am-btn-csv"]').trigger('click')
    await flushPromises()
    expect(api.downloadSchoolRiskCsv).toHaveBeenCalledWith(SCHOOL_ID)
    expect(saveBlob).toHaveBeenCalledWith(blob, 'amaran-sekolah-900001-20260925.csv')
  })
})

describe('subject card and risk list (FR-M27-76; AC-M27-21.3)', () => {
  it('shows the subject rows "{w}/{m} pelajar lemah ({p}%)"', async () => {
    const w = await mountPage(data())
    expect(text(w, 'am-subjects')).toContain('Analisis Risiko Mengikut Subjek')
    expect(texts(w, 'am-subject-name')).toEqual(['Matematik', 'Kimia'])
    expect(texts(w, 'am-subject-weak')).toEqual([
      '6/184 pelajar lemah (3%)',
      '5/10 pelajar lemah (50%)',
    ])
  })

  it('omits the subject card without weakness rows', async () => {
    const w = await mountPage(data({ weakness: [] }))
    expect(has(w, 'am-subjects')).toBe(false)
  })

  it('shows the card heading, sub-line, the eight columns and the rows in the given order', async () => {
    const w = await mountPage(data())
    expect(text(w, 'am-pupils')).toContain('Senarai Pelajar Berisiko')
    expect(text(w, 'am-pupils')).toContain('Disusun mengikut skor risiko tertinggi')
    expect(w.findAll('[data-testid="am-table"] th').map((e) => e.text())).toEqual([
      '#',
      'Pelajar',
      'Tingkatan / Kelas',
      'Skor',
      'Status',
      'Ketepatan',
      'Penglibatan',
      'Penguasaan',
    ])
    expect(texts(w, 'am-rank')).toEqual(['1', '2', '3'])
    expect(texts(w, 'am-status')).toEqual(['Berisiko Tinggi', 'Perlu Perhatian', 'Atas Landasan'])
    expect(texts(w, 'am-class')).toEqual(['Tingkatan 4 4 Contoh', '-', 'Tingkatan 4 4 Contoh'])
    expect(texts(w, 'am-accuracy')[1]).toBe('Tiada data')
    expect(texts(w, 'am-score')).toEqual(['79', '78', '77'])
  })

  it('scrolls the table inside its card, not the page', async () => {
    const w = await mountPage(data())
    expect(w.find('.overflow-x-auto').exists()).toBe(true)
  })
})

describe('empty school (FR-M27-79; AC-M27-22.4)', () => {
  it('shows zeros, a bar without segments, no subject card and no rows, without an error', async () => {
    const w = await mountPage(
      data({
        tally: { green: 0, yellow: 0, red: 0, total: 0, pct: { green: 0, yellow: 0, red: 0 } },
        weakness: [],
        pupils: [],
      }),
    )
    expect(texts(w, 'am-tile-value')).toEqual(['0', '0', '0', '0'])
    expect(w.findAll('[data-testid^="am-seg-"]')).toHaveLength(0)
    expect(has(w, 'am-subjects')).toBe(false)
    expect(has(w, 'am-pupil-row')).toBe(false)
    expect(has(w, 'am-error')).toBe(false)
    expect(has(w, 'am-table')).toBe(true)
  })
})

describe('states', () => {
  it('renders the global 403 in place for a 403 from M18', async () => {
    const w = await mountPage(apiError(403, 'FORBIDDEN', 'Akses ditolak.'))
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'am-error')).toBe(false)
  })

  it('renders the 403 in place for a school admin without a school and calls nothing', async () => {
    signIn(null)
    await mountPage(data())
    expect(useRouteOutcome().value).toBe(403)
    expect(api.fetchSchoolRisk).not.toHaveBeenCalled()
  })

  it('shows the server message for another failure', async () => {
    const w = await mountPage(apiError(500, 'SERVER_ERROR', 'Ralat pelayan'))
    expect(text(w, 'am-error')).toContain('Ralat pelayan')
    expect(useRouteOutcome().value).toBeNull()
  })

  it('shows the spinner while loading', async () => {
    api.fetchSchoolRisk.mockReturnValue(new Promise(() => undefined))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/amaran/sekolah')
    const w = mount(AmaranSekolahPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'am-loading')).toBe(true)
  })
})
