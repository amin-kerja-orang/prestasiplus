// @vitest-environment jsdom
/**
 * M27 S3 component tests (SRS M27 Part B FR-M27-44, 66…73; AC-M27-13.1, 13.4, 19.1…19.5, 20.1…20.3) against a
 * mocked client: header, breadcrumb, range rule, tabs (no "Sekolah"), the four overview cards (no "Skor Purata",
 * no "Struktur"), lists, the Guru and Murid tabs with their pills and searches, and the 403 and error states.
 * Figures from the owners are covered by the handler test and the E2E.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { ActivityPupilRow, SchoolActivityReport } from '../../api/school-admin'
import { duration, lastLogin, matches, normaliseRange } from '../../components/activity/activity-format'
import LaporanAktivitiPage from '../../pages/LaporanAktivitiPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchSchoolActivityReport: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  fetchSchoolActivityReport: api.fetchSchoolActivityReport,
}))
const session = vi.hoisted(() => ({ name: 'SMK Contoh Ujian' }))
vi.mock('@/composables/useSession', async () => {
  const { computed } = await import('vue')
  return {
    useSession: () => ({
      user: computed(() => (session.name ? { school: { name: session.name } } : null)),
    }),
  }
})

const ChartStub = { props: ['type', 'data', 'options'], template: '<div data-testid="chart-stub" />' }

const pupil = (id: number, over: Partial<ActivityPupilRow> = {}): ActivityPupilRow => ({
  userId: id,
  name: `Murid ${String(id)}`,
  className: '4 Contoh',
  sessions: 3,
  accuracy: 66.66,
  seconds: 3725,
  coins: 1200,
  lastLoginAt: null,
  ...over,
})

function report(over: Partial<SchoolActivityReport> = {}): SchoolActivityReport {
  const aktif = [pupil(1), pupil(2, { name: 'Aini Contoh', className: null, sessions: 0 })]
  const loginSahaja = [pupil(3, { sessions: 0, seconds: 0, accuracy: 0 })]
  const belumLogin = [pupil(4, { sessions: 0, seconds: 0, accuracy: 0 })]
  return {
    range: 30,
    schoolId: 900001,
    generatedAt: '2026-09-25T15:40:00+08:00',
    overview: {
      pupils: 1234,
      pupilsLogged: 700,
      teachers: 9,
      teachersLogged: 6,
      practised: 600,
      activity: 1517,
    },
    trend: [
      { label: '24/08', value: 3 },
      { label: '25/08', value: 5 },
    ],
    breakdown: { quiz: 1000, structured: 400, battle: 4, game: 24 },
    topPupils: [
      { userId: 1, name: 'Murid 1', activities: 877 },
      { userId: 2, name: 'Aini Contoh', activities: 38 },
    ],
    teachersNeverLogged: [{ userId: 11, name: 'Guru Satu', email: 'guru1@demo.test' }],
    teachers: [
      {
        userId: 11,
        name: 'Guru Satu',
        email: 'guru1@demo.test',
        loggedIn: false,
        mcq: 0,
        structured: 0,
        coins: 0,
        hasHeadcount: false,
        lastLoginAt: null,
      },
      {
        userId: 12,
        name: 'Cikgu Dua',
        email: 'dua@demo.test',
        loggedIn: true,
        mcq: 12,
        structured: 3,
        coins: 1500,
        hasHeadcount: true,
        lastLoginAt: '2026-09-25T10:40:00+08:00',
      },
    ],
    pupils: { semua: [...aktif, ...loginSahaja, ...belumLogin], aktif, loginSahaja, belumLogin },
    tiles: {
      teachers: { total: 9, logged: 6, questions: 321, coins: 98765 },
      pupils: { total: 1234, practised: 600, sessions: 1500, accuracy: 68.24 },
    },
    ...over,
  }
}

const EMPTY: SchoolActivityReport = report({
  overview: { pupils: 0, pupilsLogged: 0, teachers: 0, teachersLogged: 0, practised: 0, activity: 0 },
  trend: [{ label: '25/09', value: 0 }],
  breakdown: { quiz: 0, structured: 0, battle: 0, game: 0 },
  topPupils: [],
  teachersNeverLogged: [],
  teachers: [],
  pupils: { semua: [], aktif: [], loginSahaja: [], belumLogin: [] },
  tiles: {
    teachers: { total: 0, logged: 0, questions: 0, coins: 0 },
    pupils: { total: 0, practised: 0, sessions: 0, accuracy: 0 },
  },
})

let router: Router

async function mountPage(data: SchoolActivityReport | ApiError, url = '/x'): Promise<VueWrapper> {
  if (data instanceof ApiError) api.fetchSchoolActivityReport.mockRejectedValue(data)
  else api.fetchSchoolActivityReport.mockResolvedValue(data)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(LaporanAktivitiPage, {
    global: { plugins: [router], stubs: { ChartCanvas: ChartStub } },
  })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  api.fetchSchoolActivityReport.mockReset()
  session.name = 'SMK Contoh Ujian'
  setRouteOutcome(null)
  usePageMeta().reset()
})

describe('route and helpers', () => {
  it('declares S3 in the user shell for school_admin only with the 403 outcome', () => {
    const s3 = routes.find((r) => r.path === '/admin-sekolah/laporan-aktiviti')
    expect(s3?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Laporan Aktiviti - PRESTASIPLUS',
      header: { title: 'Laporan Aktiviti' },
    })
  })

  it.each([
    ['7', 7],
    ['30', 30],
    ['90', 90],
    ['5', 30],
    ['abc', 30],
    ['', 30],
    [undefined, 30],
    [['90', '7'], 90],
  ])('maps range %j to %i (FR-M27-66)', (raw, expected) => {
    expect(normaliseRange(raw)).toBe(expected)
  })

  it('formats the duration as "{h}j {m}m" and a missing login as "Belum login"', () => {
    expect(duration(3725)).toBe('1j 2m')
    expect(duration(0)).toBe('0j 0m')
    expect(lastLogin(null)).toBe('Belum login')
  })

  it('matches case-insensitively over several fields and passes an empty query', () => {
    expect(matches('', 'x')).toBe(true)
    expect(matches('AINI', 'Aini Contoh', null)).toBe(true)
    expect(matches('zzz', 'Aini', null)).toBe(false)
  })
})

describe('header, breadcrumb, pills, tabs (FR-M27-44, 66, 67; AC 13.1, 13.4, 19.1)', () => {
  it('sets the shell header with the session school as the sub-line', async () => {
    await mountPage(report())
    expect(usePageMeta().state.header).toEqual({
      title: 'Laporan Aktiviti',
      subtitle: 'SMK Contoh Ujian',
    })
  })

  it('renders "← Dashboard Sekolah" as a link and the bold title as text', async () => {
    const w = await mountPage(report())
    const back = w.get('[data-testid="la-crumb-back"]')
    expect(back.text()).toBe('← Dashboard Sekolah')
    expect(back.attributes('href')).toBe('/admin-sekolah')
    const cur = w.get('[data-testid="la-crumb-current"]')
    expect(cur.text()).toBe('Laporan Aktiviti')
    expect(cur.element.tagName).not.toBe('A')
    expect(cur.classes()).toContain('text-highlighted')
  })

  it('shows "Tempoh:" and the pills "7 Hari", "30 Hari", "3 Bulan" as links, 30 active by default', async () => {
    const w = await mountPage(report())
    expect(text(w, 'la-pills')).toContain('Tempoh:')
    const pills = w.findAll('[data-testid^="la-pill-"]')
    expect(pills.map((p) => p.text())).toEqual(['7 Hari', '30 Hari', '3 Bulan'])
    expect(pills.map((p) => p.attributes('href'))).toEqual([
      '/admin-sekolah/laporan-aktiviti?range=7',
      '/admin-sekolah/laporan-aktiviti?range=30',
      '/admin-sekolah/laporan-aktiviti?range=90',
    ])
    expect(pills.map((p) => p.attributes('data-active'))).toEqual(['false', 'true', 'false'])
    expect(api.fetchSchoolActivityReport).toHaveBeenCalledWith(expect.objectContaining({ range: 30 }))
  })

  it('asks for range 90 and activates "3 Bulan" for ?range=90; ?range=5 gives 30', async () => {
    const w = await mountPage(report({ range: 90 }), '/x?range=90')
    expect(w.get('[data-testid="la-pill-90"]').attributes('data-active')).toBe('true')
    expect(api.fetchSchoolActivityReport).toHaveBeenCalledWith(expect.objectContaining({ range: 90 }))
    const w2 = await mountPage(report(), '/x?range=5')
    expect(w2.get('[data-testid="la-pill-30"]').attributes('data-active')).toBe('true')
  })

  it('shows the tabs "Overview", "Guru (n)", "Murid (n)" and no "Sekolah" tab', async () => {
    const w = await mountPage(report())
    expect(texts(w, 'la-tab-overview')).toEqual(['Overview'])
    expect(text(w, 'la-tab-guru')).toBe('Guru (9)')
    expect(text(w, 'la-tab-murid')).toBe('Murid (1,234)')
    expect(w.findAll('[data-testid="la-tabs"] button')).toHaveLength(3)
    expect(w.text()).not.toContain('Sekolah (')
    expect(w.get('[data-testid="la-tab-overview"]').attributes('data-active')).toBe('true')
  })

  it('switches tabs client-side with no new request and returns to Overview on a range change', async () => {
    const w = await mountPage(report())
    await w.get('[data-testid="la-tab-guru"]').trigger('click')
    expect(has(w, 'la-guru')).toBe(true)
    expect(has(w, 'la-overview')).toBe(false)
    await w.get('[data-testid="la-tab-murid"]').trigger('click')
    expect(has(w, 'la-murid')).toBe(true)
    expect(api.fetchSchoolActivityReport).toHaveBeenCalledTimes(1)
    api.fetchSchoolActivityReport.mockResolvedValue(report({ range: 7 }))
    await router.push('/x?range=7')
    await flushPromises()
    expect(api.fetchSchoolActivityReport).toHaveBeenCalledTimes(2)
    expect(has(w, 'la-overview')).toBe(true)
  })
})

describe('Overview (FR-M27-68…70; AC 19.2…19.4)', () => {
  it('renders exactly the four cards with percent, value, denominator and sub-lines', async () => {
    const w = await mountPage(report())
    expect(texts(w, 'la-card-label')).toEqual([
      'Murid Pernah Login',
      'Cikgu Pernah Login',
      'Murid Buat Latihan',
      'Jumlah Aktiviti',
    ])
    expect(texts(w, 'la-card-pct')).toEqual(['57%', '67%', '49%'])
    expect(texts(w, 'la-card-value')).toEqual(['700', '6', '600', '1,517'])
    expect(texts(w, 'la-card-of')).toEqual(['/ 1,234', '/ 9', '/ 1,234'])
    expect(texts(w, 'la-card-note')).toEqual([
      '534 belum pernah login',
      '3 belum pernah login',
      '30 hari lepas',
    ])
  })

  it('has no "Skor Purata", no "Struktur" chip and no "platform" wording', async () => {
    const w = await mountPage(report())
    const t = w.text()
    expect(t).not.toContain('Skor Purata')
    expect(t).not.toContain('Struktur')
    expect(t).not.toMatch(/keseluruhan platform|seluruh platform/)
  })

  it('shows 0% (never NaN or 100%) with no pupils or teachers', async () => {
    const w = await mountPage(EMPTY)
    expect(texts(w, 'la-card-pct')).toEqual(['0%', '0%', '0%'])
    expect(texts(w, 'la-card-note')).toEqual([
      '0 belum pernah login',
      '0 belum pernah login',
      '30 hari lepas',
    ])
  })

  it('draws the trend with the M17 chart options', async () => {
    const w = await mountPage(report())
    expect(text(w, 'la-trend-title')).toBe('Trend Aktiviti')
    // the trend is drawn by DsChart; its data table carries the labels and the values
    const chart = text(w, 'la-trend-chart')
    expect(chart).toContain('24/08')
    expect(chart).toContain('25/08')
  })

  it('lists the breakdown, the top pupils with rank and the never-logged teachers', async () => {
    const w = await mountPage(report())
    expect(texts(w, 'la-breakdown-label')).toEqual([
      'Kuiz Objektif',
      'Soalan Berstruktur',
      'Battle Arena',
      'Permainan',
    ])
    expect(texts(w, 'la-breakdown-value')).toEqual(['1,000', '400', '4', '24'])
    expect(text(w, 'la-top')).toContain('Pelajar Paling Aktif')
    expect(texts(w, 'la-top-rank')).toEqual(['1', '2'])
    expect(texts(w, 'la-top-name')).toEqual(['Murid 1', 'Aini Contoh'])
    expect(texts(w, 'la-top-count')).toEqual(['877', '38'])
    expect(text(w, 'la-never')).toContain('Cikgu Belum Login')
    expect(texts(w, 'la-never-name')).toEqual(['Guru Satu'])
    expect(texts(w, 'la-never-email')).toEqual(['guru1@demo.test'])
  })

  it('keeps the headings and no rows for an empty school', async () => {
    const w = await mountPage(EMPTY)
    expect(has(w, 'la-top')).toBe(true)
    expect(has(w, 'la-never')).toBe(true)
    expect(w.findAll('[data-testid="la-top-row"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="la-never-row"]')).toHaveLength(0)
    expect(texts(w, 'la-breakdown-value')).toEqual(['0', '0', '0', '0'])
  })
})

describe('Guru tab (FR-M27-71; AC 20.1)', () => {
  async function guru(data = report()) {
    const w = await mountPage(data)
    await w.get('[data-testid="la-tab-guru"]').trigger('click')
    return w
  }

  it('shows heading, pills with counts, search, tiles and the column heads without a school column', async () => {
    const w = await guru()
    expect(text(w, 'la-guru-title')).toBe('Senarai Guru (9)')
    expect(w.findAll('[data-testid^="la-guru-pill-"]').map((p) => p.text())).toEqual([
      'Semua',
      'Pernah Login (6)',
      'Belum Login (3)',
    ])
    expect(w.get('[data-testid="la-guru-search"]').attributes('placeholder')).toBe('Cari guru...')
    expect(texts(w, 'la-tile-label')).toEqual([
      'Jumlah Guru',
      'Pernah Login',
      'Jumlah Soalan',
      'Jumlah Syiling',
    ])
    expect(texts(w, 'la-tile-value')).toEqual(['9', '6', '321', '98,765'])
    expect(w.findAll('[data-testid="la-guru-table"] th').map((e) => e.text())).toEqual([
      '#',
      'Nama',
      'Login',
      'MCQ',
      'Struktur',
      'Syiling',
      'Headcount',
      'Login Terakhir',
    ])
    expect(w.find('select').exists()).toBe(false)
  })

  it('shows name with e-mail, Ya/Belum, MCQ, Struktur, Syiling, headcount mark and login text', async () => {
    const w = await guru()
    expect(texts(w, 'la-guru-name')).toEqual(['Guru Satu', 'Cikgu Dua'])
    expect(texts(w, 'la-guru-email')).toEqual(['guru1@demo.test', 'dua@demo.test'])
    expect(texts(w, 'la-guru-login')).toEqual(['Belum', 'Ya'])
    expect(texts(w, 'la-guru-mcq')).toEqual(['0', '12'])
    expect(texts(w, 'la-guru-struktur')).toEqual(['0', '3'])
    expect(texts(w, 'la-guru-syiling')).toEqual(['0', '1,500'])
    const heads = w.findAll('[data-testid="la-guru-headcount"]')
    expect(heads[0]?.find('svg').exists()).toBe(false)
    expect(heads[1]?.find('svg').exists()).toBe(true)
    expect(texts(w, 'la-guru-last')[0]).toBe('Belum login')
    expect(texts(w, 'la-guru-last')[1]).toMatch(/yang lepas$/)
  })

  it('filters by the pills and by the search, and shows no rows for no match', async () => {
    const w = await guru()
    await w.get('[data-testid="la-guru-pill-pernah"]').trigger('click')
    expect(texts(w, 'la-guru-name')).toEqual(['Cikgu Dua'])
    await w.get('[data-testid="la-guru-pill-belum"]').trigger('click')
    expect(texts(w, 'la-guru-name')).toEqual(['Guru Satu'])
    await w.get('[data-testid="la-guru-pill-semua"]').trigger('click')
    await w.get('[data-testid="la-guru-search"]').setValue('DUA@')
    expect(texts(w, 'la-guru-name')).toEqual(['Cikgu Dua'])
    await w.get('[data-testid="la-guru-search"]').setValue('tiada-padanan')
    expect(w.findAll('[data-testid="la-guru-row"]')).toHaveLength(0)
    expect(has(w, 'la-guru-table')).toBe(true)
  })
})

describe('Murid tab (FR-M27-72; AC 20.2, 20.3)', () => {
  async function murid(data = report()) {
    const w = await mountPage(data)
    await w.get('[data-testid="la-tab-murid"]').trigger('click')
    return w
  }

  it('shows heading, pills, search, tiles and the column heads without a school column', async () => {
    const w = await murid()
    expect(text(w, 'la-murid-title')).toBe('Senarai Murid (1,234) — Top 200')
    expect(w.findAll('[data-testid^="la-murid-pill-"]').map((p) => p.text())).toEqual([
      'Semua',
      'Aktif',
      'Login Sahaja',
      'Belum Login',
    ])
    expect(w.get('[data-testid="la-murid-search"]').attributes('placeholder')).toBe('Cari murid...')
    expect(texts(w, 'la-tile-label')).toEqual([
      'Jumlah Murid',
      'Pernah Latihan',
      'Jumlah Sesi',
      'Purata Ketepatan',
    ])
    expect(texts(w, 'la-tile-value')).toEqual(['1,234', '600', '1,500', '68.2%'])
    expect(w.findAll('[data-testid="la-murid-table"] th').map((e) => e.text())).toEqual([
      '#',
      'Nama',
      'Kelas',
      'Sesi',
      'Ketepatan',
      'Masa',
      'Syiling',
      'Login Terakhir',
    ])
    expect(w.find('select').exists()).toBe(false)
  })

  it('formats the row cells: dash class, one-decimal accuracy, "{h}j {m}m", coins, login text', async () => {
    const w = await murid()
    expect(texts(w, 'la-murid-name')[0]).toBe('Murid 1')
    expect(texts(w, 'la-murid-kelas')[0]).toBe('4 Contoh')
    expect(texts(w, 'la-murid-sesi')[0]).toBe('3')
    expect(texts(w, 'la-murid-ketepatan')[0]).toBe('66.7%')
    expect(texts(w, 'la-murid-masa')[0]).toBe('1j 2m')
    expect(texts(w, 'la-murid-syiling')[0]).toBe('1,200')
    expect(texts(w, 'la-murid-last')[0]).toBe('Belum login')
    expect(texts(w, 'la-murid-kelas')[1]).toBe('-')
  })

  it('lists each pill\'s own pupils and filters by name', async () => {
    const w = await murid()
    expect(texts(w, 'la-murid-name')).toHaveLength(4)
    await w.get('[data-testid="la-murid-pill-aktif"]').trigger('click')
    expect(texts(w, 'la-murid-name')).toEqual(['Murid 1', 'Aini Contoh'])
    await w.get('[data-testid="la-murid-pill-login-sahaja"]').trigger('click')
    expect(texts(w, 'la-murid-name')).toEqual(['Murid 3'])
    await w.get('[data-testid="la-murid-pill-belum-login"]').trigger('click')
    expect(texts(w, 'la-murid-name')).toEqual(['Murid 4'])
    await w.get('[data-testid="la-murid-pill-semua"]').trigger('click')
    await w.get('[data-testid="la-murid-search"]').setValue('aini')
    expect(texts(w, 'la-murid-name')).toEqual(['Aini Contoh'])
    await w.get('[data-testid="la-murid-search"]').setValue('tiada-padanan')
    expect(texts(w, 'la-murid-name')).toHaveLength(0)
  })

  it('shows the dash for the accuracy tile when there is no session', async () => {
    const w = await murid(EMPTY)
    expect(texts(w, 'la-tile-value')).toEqual(['0', '0', '0', '—'])
    expect(text(w, 'la-murid-title')).toBe('Senarai Murid (0) — Top 200')
  })
})

describe('states (FR-M27-48)', () => {
  it('shows the spinner only while loading', async () => {
    api.fetchSchoolActivityReport.mockReturnValue(new Promise(() => undefined))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/')
    const w = mount(LaporanAktivitiPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'la-loading')).toBe(true)
    expect(has(w, 'la-tabs')).toBe(false)
    expect(w.text()).toBe('')
  })

  it('renders the global 403 outcome in place for a 403', async () => {
    const w = await mountPage(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Akses ditolak.',
        method: 'GET',
        url: '/api/admin-sekolah/laporan-aktiviti',
      }),
    )
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'la-error')).toBe(false)
    expect(has(w, 'la-tabs')).toBe(false)
  })

  it('shows the server message for another failure and no figures', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Ralat pelayan.',
        method: 'GET',
        url: '/api/admin-sekolah/laporan-aktiviti',
      }),
    )
    expect(useRouteOutcome().value).toBeNull()
    expect(text(w, 'la-error')).toContain('Ralat pelayan.')
    expect(has(w, 'la-tabs')).toBe(false)
  })
})
