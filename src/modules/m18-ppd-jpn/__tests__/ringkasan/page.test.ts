// @vitest-environment jsdom
/**
 * M18 S23 "Ringkasan Eksekutif" page tests (design `docs/design/m18-amaran-summary.md` section 4) against a
 * mocked client: routes, states (loading, error, 403, 404, empty, data), tile figures, the subject card,
 * `generatedAt` in Malaysia time, the print button and that the URL params are never sent.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { AmaranSummaryResponse } from '../../api/amaran'
import { formatGenerated } from '../../components/ringkasan/ringkasan-format'
import RingkasanEksekutifPage from '../../pages/RingkasanEksekutifPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchAmaranSummary: vi.fn() }))
const session = vi.hoisted(() => ({ role: null as string | null }))
vi.mock('@/composables/useSession', async () => {
  const { computed } = await import('vue')
  return { useSession: () => ({ role: computed(() => session.role) }) }
})
vi.mock('../../api/amaran', async (importActual) => ({
  ...(await importActual<typeof import('../../api/amaran')>()),
  fetchAmaranSummary: api.fetchAmaranSummary,
}))

// 2026-10-21 02:05:00 UTC = 10:05 in Malaysia.
const GENERATED_AT = Date.UTC(2026, 9, 21, 2, 5, 0)

function summary(over: Partial<AmaranSummaryResponse> = {}): AmaranSummaryResponse {
  return {
    scope: 'school',
    title: 'SMK Contoh A',
    subtitle: 'Daerah Contoh, Negeri Contoh',
    pupilsLine: '59 pelajar',
    generatedAt: GENERATED_AT,
    tally: { green: 12, yellow: 18, red: 29, total: 59, pct: { green: 20, yellow: 31, red: 49 } },
    kombo: { active: 14, pupils: 59, avg: 6.4, max: 13, today: 0 },
    weakness: [
      { subjectId: '1', subjectName: 'Bahasa Melayu', weak: 1, total: 1, pct: 100 },
      { subjectId: '2', subjectName: 'Matematik', weak: 6, total: 184, pct: 3 },
    ],
    ...over,
  }
}

const apiError = (status: number, code: string, message: string) =>
  new ApiError({ status, code, message, method: 'GET', url: '/api/amaran/summary' })

async function mountPage(value: AmaranSummaryResponse | ApiError | 'pending', url = '/amaran/ringkasan-eksekutif') {
  if (value === 'pending') api.fetchAmaranSummary.mockReturnValue(new Promise(() => undefined))
  else if (value instanceof ApiError) api.fetchAmaranSummary.mockRejectedValue(value)
  else api.fetchAmaranSummary.mockResolvedValue(value)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(RingkasanEksekutifPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchAmaranSummary.mockReset()
  session.role = null
  setRouteOutcome(null)
  usePageMeta().reset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('routes', () => {
  it('declares S23 (school_admin, teacher, admin) and S21 (school_admin, teacher) in the user shell, in-place 403', () => {
    for (const [path, name, title, roles] of [
      ['/amaran/ringkasan-eksekutif', 'm18.amaran-ringkasan', 'Ringkasan Eksekutif', ['school_admin', 'teacher', 'admin']],
      ['/amaran/keberkesanan', 'm18.amaran-keberkesanan', 'Keberkesanan Intervensi', ['school_admin', 'teacher']],
    ] as const) {
      const r = routes.find((x) => x.path === path)
      expect(r?.name).toBe(name)
      expect(r?.meta).toMatchObject({
        layout: 'user',
        access: 'auth',
        roles,
        onForbidden: '403',
        header: { title },
      })
    }
  })
})

describe('data state', () => {
  it('shows the head with title, subtitle, pupils line and the MYT generated time', async () => {
    const w = await mountPage(summary())
    expect(text(w, 'rk-title')).toBe('SMK Contoh A')
    expect(text(w, 'rk-subtitle')).toBe('Daerah Contoh, Negeri Contoh')
    expect(text(w, 'rk-pupils')).toBe('59 pelajar')
    expect(text(w, 'rk-generated')).toBe('Dijana: 21 Oktober 2026, 10:05')
    expect(text(w, 'rk-footer')).toContain(
      'Laporan ini dijana secara automatik oleh PRESTASIPLUS · 21 Oktober 2026, 10:05',
    )
    expect(text(w, 'rk-footer')).toContain('Untuk maklumat lanjut, hubungi pentadbir sistem.')
  })

  it('renders no subtitle line when the server sends an empty subtitle', async () => {
    const w = await mountPage(summary({ subtitle: '' }))
    expect(has(w, 'rk-subtitle')).toBe(false)
    expect(text(w, 'rk-pupils')).toBe('59 pelajar')
  })

  it('sets the shell sub-line and the tab title of the SRS', async () => {
    await mountPage(summary())
    const meta = usePageMeta().state
    expect(meta.header).toMatchObject({ title: 'Ringkasan Eksekutif', subtitle: 'SMK Contoh A' })
    expect(meta.title).toBe('Ringkasan Eksekutif — SMK Contoh A | PRESTASIPLUS')
  })

  it('shows the four tiles as returned (percent and pupil count, no recalculation)', async () => {
    const w = await mountPage(summary())
    expect(text(w, 'rk-tile-total')).toContain('Jumlah Pelajar')
    expect(text(w, 'rk-tile-total')).toContain('59')
    expect(text(w, 'rk-tile-green')).toContain('On Track (Hijau)')
    expect(text(w, 'rk-tile-green')).toContain('20%')
    expect(text(w, 'rk-tile-green')).toContain('12 pelajar')
    expect(text(w, 'rk-tile-yellow')).toContain('31%')
    expect(text(w, 'rk-tile-yellow')).toContain('18 pelajar')
    expect(text(w, 'rk-tile-red')).toContain('49%')
    expect(text(w, 'rk-tile-red')).toContain('29 pelajar')
  })

  it('shows the distribution chart labels and the legend', async () => {
    const w = await mountPage(summary())
    expect(text(w, 'rk-distribution')).toContain('Taburan Risiko')
    expect(text(w, 'rk-bar')).toContain('Hijau (20%)')
    expect(text(w, 'rk-bar')).toContain('Kuning (31%)')
    expect(text(w, 'rk-bar')).toContain('Merah (49%)')
    expect(text(w, 'rk-legend-green')).toBe('Hijau: 12')
    expect(text(w, 'rk-legend-red')).toBe('Merah: 29')
  })

  it('shows the four kombo figures with one decimal for the mean', async () => {
    const w = await mountPage(summary({ kombo: { active: 14, pupils: 59, avg: 6, max: 13, today: 0 } }))
    expect(text(w, 'rk-kombo')).toContain('Penglibatan Latih Tubi (Kombo)')
    expect(text(w, 'rk-kombo-avg')).toBe('6.0')
    expect(text(w, 'rk-kombo-max')).toBe('13')
    expect(text(w, 'rk-kombo-active')).toBe('14')
    expect(text(w, 'rk-kombo-today')).toBe('0')
  })

  it('shows the subject rows "{w}/{m} lemah ({p}%)"', async () => {
    const w = await mountPage(summary())
    expect(text(w, 'rk-subjects')).toContain('Analisis Risiko Mengikut Subjek')
    expect(texts(w, 'rk-subject-name')).toEqual(['Bahasa Melayu', 'Matematik'])
    expect(texts(w, 'rk-subject-weak')).toEqual(['1/1 lemah (100%)', '6/184 lemah (3%)'])
  })

  it('hides the subject card without weakness rows and ignores schools[] (no district comparison)', async () => {
    const none = await mountPage(summary({ weakness: [] }))
    expect(has(none, 'rk-subjects')).toBe(false)
    const absent = await mountPage(
      summary({
        weakness: undefined,
        schools: [{ schoolId: '1', school: 'SMK Lain', pupils: 5, avgScore: 50, green: 1, yellow: 2, red: 2 }],
      }),
    )
    expect(has(absent, 'rk-subjects')).toBe(false)
    expect(absent.text()).not.toContain('SMK Lain')
    expect(absent.text()).not.toContain('Perbandingan Sekolah')
  })

  it('hides the pupils line when null and the generated lines when generatedAt is invalid', async () => {
    const w = await mountPage(summary({ pupilsLine: null, generatedAt: Number.NaN }))
    expect(has(w, 'rk-pupils')).toBe(false)
    expect(has(w, 'rk-generated')).toBe(false)
    expect(text(w, 'rk-footer')).not.toContain('·')
  })

  it('never sends the URL params to the API (own school only)', async () => {
    await mountPage(summary(), '/amaran/ringkasan-eksekutif?scope=school&school_id=999')
    expect(api.fetchAmaranSummary).toHaveBeenCalledTimes(1)
    const arg = api.fetchAmaranSummary.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(arg)).toEqual(['signal'])
  })
})

describe('generatedAt in Malaysia time', () => {
  it('converts epoch milliseconds with +08:00 across midnight', () => {
    expect(formatGenerated(Date.UTC(2026, 9, 20, 16, 30, 0))).toBe('21 Oktober 2026, 00:30')
    expect(formatGenerated(Date.UTC(2026, 0, 5, 15, 59, 0))).toBe('5 Januari 2026, 23:59')
  })

  it('returns null for an invalid value', () => {
    expect(formatGenerated(Number.NaN)).toBeNull()
    expect(formatGenerated(-1)).toBeNull()
    expect(formatGenerated('2026-10-21')).toBeNull()
  })
})

describe('empty state (no pupils)', () => {
  it('shows zero tiles, the empty distribution and keeps print available', async () => {
    const w = await mountPage(
      summary({
        pupilsLine: '0 pelajar',
        tally: { green: 0, yellow: 0, red: 0, total: 0, pct: { green: 0, yellow: 0, red: 0 } },
        kombo: { active: 0, pupils: 0, avg: 0, max: 0, today: 0 },
        weakness: [],
      }),
    )
    expect(text(w, 'rk-tile-total')).toContain('0')
    expect(text(w, 'rk-tile-green')).toContain('0%')
    expect(text(w, 'rk-empty')).toContain('Tiada data pelajar lagi.')
    expect(has(w, 'rk-bar')).toBe(false)
    expect(text(w, 'rk-kombo-avg')).toBe('0.0')
    expect(has(w, 'rk-subjects')).toBe(false)
    expect(w.get('[data-testid="rk-print"]').attributes('disabled')).toBeUndefined()
  })
})

describe('loading state', () => {
  it('shows the skeleton with aria-busy and a disabled print button', async () => {
    const w = await mountPage('pending')
    expect(w.get('[data-testid="rk-loading"]').attributes('aria-busy')).toBe('true')
    expect(w.get('[data-testid="rk-print"]').attributes('disabled')).toBeDefined()
    expect(has(w, 'rk-sheet')).toBe(false)
  })
})

describe('error states', () => {
  it('shows the server message with a retry that fetches again; the toolbar is hidden', async () => {
    const w = await mountPage(apiError(500, 'SERVER_ERROR', 'Ralat pelayan.'))
    expect(text(w, 'rk-error')).toContain('Ralat pelayan.')
    expect(has(w, 'rk-toolbar')).toBe(false)
    api.fetchAmaranSummary.mockResolvedValue(summary())
    const retry = w.get('[data-testid="rk-error"] button')
    await retry.trigger('click')
    await flushPromises()
    expect(api.fetchAmaranSummary).toHaveBeenCalledTimes(2)
    expect(has(w, 'rk-sheet')).toBe(true)
  })

  it('falls back to the generic text for a bare HTTP message', async () => {
    const w = await mountPage(apiError(500, 'SERVER_ERROR', 'HTTP 500'))
    expect(text(w, 'rk-error')).toContain('Ralat berlaku. Sila cuba lagi.')
  })

  it('renders the global 403 in place for a 403', async () => {
    const w = await mountPage(apiError(403, 'FORBIDDEN', 'This action is unauthorized.'))
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'rk-error')).toBe(false)
    expect(has(w, 'rk-sheet')).toBe(false)
  })

  it('renders the global 404 in place for a 404', async () => {
    await mountPage(apiError(404, 'NOT_FOUND', 'Not Found.'))
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('toolbar and print', () => {
  it('links back to S4 and prints the sheet with window.print', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const w = await mountPage(summary())
    expect(w.get('[data-testid="rk-back"]').attributes('href')).toBe('/amaran/sekolah')
    expect(w.get('[data-testid="rk-back"]').text()).toContain('Kembali')
    expect(w.get('[data-testid="rk-toolbar"]').classes()).toContain('print:hidden')
    const btn = w.get('[data-testid="rk-print"]')
    expect(btn.text()).toContain('Cetak / PDF')
    await btn.trigger('click')
    expect(print).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('roles', () => {
  const schoolRows = [
    { schoolId: '7', school: 'SMK Contoh B', pupils: 17, avgScore: 97.6, green: 0, yellow: 0, red: 17 },
    { schoolId: '1', school: 'SMK Contoh A', pupils: 16, avgScore: 97.5, green: 1, yellow: 2, red: 13 },
  ]

  it('school admin: URL query is ignored (only the signal is sent); back to S4', async () => {
    session.role = 'school_admin'
    const w = await mountPage(summary(), '/amaran/ringkasan-eksekutif?scope=state&state=Perak')
    expect(Object.keys(api.fetchAmaranSummary.mock.calls[0]?.[0] as object)).toEqual(['signal'])
    expect(w.get('[data-testid="rk-back"]').attributes('href')).toBe('/amaran/sekolah')
  })

  it('teacher: no query sent; back to /guru', async () => {
    session.role = 'teacher'
    const w = await mountPage(summary(), '/amaran/ringkasan-eksekutif?scope=district&district=X&state=Y')
    expect(Object.keys(api.fetchAmaranSummary.mock.calls[0]?.[0] as object)).toEqual(['signal'])
    expect(w.get('[data-testid="rk-back"]').attributes('href')).toBe('/guru')
  })

  it('admin: scope, district, state and school_id / schoolId are passed; back to /admin', async () => {
    session.role = 'admin'
    const w = await mountPage(
      summary({ scope: 'district', schools: schoolRows }),
      '/amaran/ringkasan-eksekutif?scope=district&district=PPD%20X&state=Perak&other=1',
    )
    const { signal, ...rest } = api.fetchAmaranSummary.mock.calls[0]?.[0] as Record<string, unknown>
    expect(signal).toBeDefined()
    expect(rest).toEqual({ scope: 'district', district: 'PPD X', state: 'Perak' })
    expect(w.get('[data-testid="rk-back"]').attributes('href')).toBe('/admin')

    await mountPage(summary(), '/amaran/ringkasan-eksekutif?scope=school&school_id=8880')
    expect(api.fetchAmaranSummary.mock.calls[1]?.[0]).toMatchObject({ scope: 'school', schoolId: '8880' })
    await mountPage(summary(), '/amaran/ringkasan-eksekutif?scope=school&schoolId=7780')
    expect(api.fetchAmaranSummary.mock.calls[2]?.[0]).toMatchObject({ scope: 'school', schoolId: '7780' })
    await mountPage(summary(), '/amaran/ringkasan-eksekutif')
    expect(Object.keys(api.fetchAmaranSummary.mock.calls[3]?.[0] as object)).toEqual(['signal'])
  })

  it('admin district / state: "Pecahan Mengikut Sekolah" in returned order instead of the subject card; pupils line hidden when null', async () => {
    session.role = 'admin'
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia
    const w = await mountPage(
      summary({ scope: 'state', title: 'Negeri Perak', pupilsLine: null, schools: schoolRows }),
      '/amaran/ringkasan-eksekutif?scope=state&state=Perak',
    )
    expect(text(w, 'rk-schools')).toContain('Pecahan Mengikut Sekolah')
    expect(has(w, 'rk-subjects')).toBe(false)
    expect(has(w, 'rk-pupils')).toBe(false)
    const head = w.findAll('[data-testid="rk-schools"] th').map((e) => e.text())
    expect(head).toEqual(['#', 'Sekolah', 'Pelajar', 'Hijau', 'Kuning', 'Merah', 'Prt. Skor'])
    const rows = w.findAll('[data-testid="rk-schools"] tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
    expect(rows).toEqual([
      ['1', 'SMK Contoh B', '17', '0', '0', '17', '97.6'],
      ['2', 'SMK Contoh A', '16', '1', '2', '13', '97.5'],
    ])
  })

  it('admin: 403 and 404 render the global pages in place, 422 the load error with the server message', async () => {
    session.role = 'admin'
    await mountPage(apiError(403, 'FORBIDDEN', 'x'))
    expect(useRouteOutcome().value).toBe(403)
    setRouteOutcome(null)
    const w = await mountPage(apiError(422, 'VALIDATION_ERROR', 'The state is required.'), '/amaran/ringkasan-eksekutif?scope=state')
    expect(text(w, 'rk-error')).toContain('The state is required.')
    expect(useRouteOutcome().value).toBeNull()
  })
})
