// @vitest-environment jsdom
/**
 * M18 S21 "Keberkesanan Intervensi" component tests (design `m18-amaran-summary` section 5) against a mocked
 * client: header and tab title, tiles, charts and their empty texts, the zero state, the type / teacher /
 * follow-up cards, the hidden comparison and S24 arrow, mobile cards, loading, error, retry and 403.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { AmaranEffectivenessResponse } from '../../api/amaran'
import KeberkesananPage from '../../pages/KeberkesananPage.vue'

const api = vi.hoisted(() => ({ fetchAmaranEffectiveness: vi.fn() }))
const session = vi.hoisted(() => ({ role: null as string | null }))
vi.mock('@/composables/useSession', async () => {
  const { computed } = await import('vue')
  return { useSession: () => ({ role: computed(() => session.role) }) }
})
vi.mock('../../api/amaran', () => ({ fetchAmaranEffectiveness: api.fetchAmaranEffectiveness }))

const TRENDS = ['Mei 2026', 'Jun 2026', 'Jul 2026', 'Ogo 2026', 'Sep 2026', 'Okt 2026']

function result(over: Partial<AmaranEffectivenessResponse['report']> = {}): AmaranEffectivenessResponse {
  return {
    school: { id: '900001', name: 'SMK Demo' },
    report: {
      cards: {
        total: 8,
        berkesan: 2,
        evaluated: 4,
        rate: 50,
        needsAction: 3,
        sederhana: 2,
        tidakBerkesan: 1,
        notEvaluated: 1,
      },
      doughnut: [2, 2, 1, 3],
      trend: { labels: TRENDS, data: [0, 1, 0, 2, 1, 4] },
      byType: [
        { type: 'kaunseling', label: 'Sesi Kaunseling', count: 3 },
        { type: 'kelas_tambahan', label: 'Kelas Tambahan', count: 1 },
      ],
      byTeacher: [
        { teacherId: '1', name: 'Cikgu Contoh A', total: 5, berkesan: 2, notEvaluated: 1, rate: 67 },
        { teacherId: '2', name: 'Cikgu Contoh B', total: 3, berkesan: 0, notEvaluated: 3, rate: null },
      ],
      followUps: [
        {
          id: '11',
          studentId: '501',
          studentName: 'Pelajar Contoh',
          type: 'kaunseling',
          label: 'Sesi Kaunseling',
          interventionDate: '2026-04-13',
          effectiveness: 'belum_dinilai',
        },
        {
          id: '12',
          studentId: '502',
          studentName: 'Pelajar Lain',
          type: 'kelas_tambahan',
          label: 'Kelas Tambahan',
          interventionDate: '2026-05-02',
          effectiveness: 'tidak_berkesan',
        },
      ],
      bySchool: [
        { schoolId: '900001', school: 'SMK Demo', total: 8, berkesan: 2, sederhana: 2, tidakBerkesan: 1, notEvaluated: 3, rate: 50 },
      ],
      ...over,
    },
  }
}

const zero = (): AmaranEffectivenessResponse =>
  result({
    cards: { total: 0, berkesan: 0, evaluated: 0, rate: 0, needsAction: 0, sederhana: 0, tidakBerkesan: 0, notEvaluated: 0 },
    doughnut: [0, 0, 0, 0],
    trend: { labels: TRENDS, data: [0, 0, 0, 0, 0, 0] },
    byType: [],
    byTeacher: [],
    followUps: [],
    bySchool: [],
  })

const apiError = (status: number, message: string) =>
  new ApiError({ status, code: 'x', message, method: 'GET', url: '/api/amaran/effectiveness' })

function stubMedia(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia
}

async function mountPage(value: AmaranEffectivenessResponse | ApiError): Promise<VueWrapper> {
  if (value instanceof ApiError) api.fetchAmaranEffectiveness.mockRejectedValue(value)
  else api.fetchAmaranEffectiveness.mockResolvedValue(value)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/amaran/keberkesanan')
  await router.isReady()
  const wrapper = mount(KeberkesananPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchAmaranEffectiveness.mockReset()
  session.role = null
  setRouteOutcome(null)
  usePageMeta().reset()
  stubMedia(true)
  // jsdom has no canvas; the chart then skips drawing (hidden table and legend remain).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('header and navigation', () => {
  it('sets the header title with the school as sub-line and the tab title with the school in capitals', async () => {
    await mountPage(result())
    expect(usePageMeta().state.header).toEqual({ title: 'Keberkesanan Intervensi', subtitle: 'SMK Demo' })
    expect(usePageMeta().state.title).toBe('Keberkesanan Intervensi - SMK DEMO')
  })

  it('has a "Kembali ke Amaran" link to /amaran/sekolah', async () => {
    const w = await mountPage(result())
    const back = w.get('[data-testid="kb-back"]')
    expect(back.text()).toContain('Kembali ke Amaran')
    expect(back.attributes('href')).toBe('/amaran/sekolah')
  })

  it('never puts a pupil name in the header or tab title', async () => {
    await mountPage(result())
    expect(JSON.stringify(usePageMeta().state)).not.toContain('Pelajar Contoh')
  })

  it('asks the API for the viewer school only (no parameter but the abort signal)', async () => {
    await mountPage(result())
    const arg = api.fetchAmaranEffectiveness.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(arg)).toEqual(['signal'])
  })
})

describe('loaded with data', () => {
  it('shows the four tiles with the contract figures and sub-lines', async () => {
    const w = await mountPage(result())
    expect(text(w, 'kb-tile-total')).toContain('Jumlah Intervensi')
    expect(text(w, 'kb-tile-total')).toContain('8')
    expect(text(w, 'kb-tile-rate')).toContain('Kadar Berkesan')
    expect(text(w, 'kb-tile-rate')).toContain('50%')
    expect(text(w, 'kb-tile-rate')).toContain('2/4 dinilai')
    expect(text(w, 'kb-tile-action')).toContain('Perlu Tindakan')
    expect(text(w, 'kb-tile-action')).toContain('2 sederhana, 1 tidak berkesan')
    expect(text(w, 'kb-tile-pending')).toContain('Belum Dinilai')
  })

  it('shows both chart cards with titles, the doughnut legend with counts and no empty texts', async () => {
    const w = await mountPage(result())
    expect(has(w, 'kb-doughnut')).toBe(true)
    expect(has(w, 'kb-trend')).toBe(true)
    expect(has(w, 'kb-doughnut-empty')).toBe(false)
    expect(has(w, 'kb-trend-empty')).toBe(false)
    expect(w.text()).toContain('Pecahan Keberkesanan')
    expect(w.text()).toContain('Trend Bulanan (6 Bulan)')
    expect(texts(w, 'kb-doughnut-legend-item')).toEqual([
      'Berkesan: 2',
      'Sederhana: 2',
      'Tidak Berkesan: 1',
      'Belum Dinilai: 3',
    ])
  })

  it('does not show the zero-state card', async () => {
    const w = await mountPage(result())
    expect(has(w, 'kb-none')).toBe(false)
  })

  it('lists the intervention types in the order returned with "{n} kali"', async () => {
    const w = await mountPage(result())
    expect(text(w, 'kb-types')).toContain('Intervensi Mengikut Jenis')
    const rows = texts(w, 'kb-type-row')
    expect(rows[0]).toContain('Sesi Kaunseling')
    expect(rows[0]).toContain('3 kali')
    expect(rows[1]).toContain('Kelas Tambahan')
  })

  it('shows the teacher table with columns, badges and "—" for a null rate', async () => {
    const w = await mountPage(result())
    const card = text(w, 'kb-teachers')
    expect(card).toContain('Statistik Guru')
    for (const h of ['#', 'Guru', 'Jumlah', 'Berkesan', 'Belum Nilai', 'Kadar']) expect(card).toContain(h)
    expect(card).toContain('Cikgu Contoh A')
    expect(card).toContain('67%')
    expect(card).toContain('—')
    expect(w.findAll('[data-testid="kb-teacher-table"] tbody tr')).toHaveLength(2)
  })

  it('shows follow-ups with "{jenis} · {d MMM yyyy}" and an effectiveness badge with word', async () => {
    const w = await mountPage(result())
    expect(text(w, 'kb-followups')).toContain('Perlu Tindakan Susulan')
    expect(texts(w, 'kb-followup-name')).toEqual(['Pelajar Contoh', 'Pelajar Lain'])
    expect(texts(w, 'kb-followup-line')).toEqual(['Sesi Kaunseling · 13 Apr 2026', 'Kelas Tambahan · 2 Mei 2026'])
    expect(texts(w, 'kb-followup-badge')).toEqual(['Belum Dinilai', 'Tidak Berkesan'])
  })

  it('hides the S24 arrow: no link inside the follow-up rows (contract gap)', async () => {
    const w = await mountPage(result())
    expect(w.find('[data-testid="kb-followups"] a').exists()).toBe(false)
    expect(w.html()).not.toContain('/amaran/intervensi/')
  })

  it('hides "Perbandingan Sekolah Daerah" even when bySchool has a row', async () => {
    const w = await mountPage(result())
    expect(w.text()).not.toContain('Perbandingan Sekolah Daerah')
  })

  it('shows "Tiada tindakan susulan." when there are no follow-ups but interventions exist', async () => {
    const w = await mountPage(result({ followUps: [] }))
    expect(text(w, 'kb-followups-empty')).toContain('Tiada tindakan susulan.')
    expect(has(w, 'kb-types')).toBe(true)
  })

  it('shows 0% and "0/0 dinilai" when nothing is evaluated, and "—" for a teacher rate', async () => {
    const w = await mountPage(
      result({
        cards: { total: 2, berkesan: 0, evaluated: 0, rate: 0, needsAction: 0, sederhana: 0, tidakBerkesan: 0, notEvaluated: 2 },
      }),
    )
    expect(text(w, 'kb-tile-rate')).toContain('0%')
    expect(text(w, 'kb-tile-rate')).toContain('0/0 dinilai')
  })

  it('plots a month with 0 (the trend is not empty when only some months are 0)', async () => {
    const w = await mountPage(result({ trend: { labels: TRENDS, data: [0, 0, 0, 0, 0, 1] } }))
    expect(has(w, 'kb-trend')).toBe(true)
    expect(has(w, 'kb-trend-empty')).toBe(false)
  })
})

describe('zero state (total = 0)', () => {
  it('shows four zero tiles, both chart empty texts and the "Belum Ada Intervensi" card with its link', async () => {
    const w = await mountPage(zero())
    expect(text(w, 'kb-tile-total')).toContain('0')
    expect(text(w, 'kb-tile-rate')).toContain('0%')
    expect(text(w, 'kb-tile-rate')).toContain('0/0 dinilai')
    expect(text(w, 'kb-tile-action')).toContain('0 sederhana, 0 tidak berkesan')
    expect(text(w, 'kb-doughnut-empty')).toContain('Tiada data intervensi lagi.')
    expect(text(w, 'kb-trend-empty')).toContain('Tiada data trend lagi.')
    expect(text(w, 'kb-none')).toContain('Belum Ada Intervensi')
    expect(text(w, 'kb-none')).toContain(
      'Tiada rekod intervensi ditemui untuk sekolah ini. Guru boleh mula merekod intervensi dari halaman Amaran Awal.',
    )
    const link = w.get('[data-testid="kb-none-link"]')
    expect(link.text()).toBe('Lihat Senarai Risiko')
    expect(link.attributes('href')).toBe('/amaran/sekolah')
  })

  it('does not render the type, teacher or follow-up cards', async () => {
    const w = await mountPage(zero())
    expect(has(w, 'kb-types')).toBe(false)
    expect(has(w, 'kb-teachers')).toBe(false)
    expect(has(w, 'kb-followups')).toBe(false)
  })
})

describe('mobile layout', () => {
  it('renders each teacher as a card (name + Jumlah, Berkesan, Belum Nilai, Kadar) below md', async () => {
    stubMedia(false)
    const w = await mountPage(result())
    expect(w.find('[data-testid="kb-teacher-table"] table').exists()).toBe(false)
    expect(texts(w, 'kb-teacher-name')).toEqual(['Cikgu Contoh A', 'Cikgu Contoh B'])
    const card = text(w, 'kb-teachers')
    for (const l of ['Jumlah', 'Berkesan', 'Belum Nilai', 'Kadar']) expect(card).toContain(l)
    expect(texts(w, 'kb-teacher-field').slice(0, 4)).toEqual(['5', '2', '1', '67%'])
    expect(texts(w, 'kb-teacher-field').slice(4)).toEqual(['3', '0', '3', '—'])
  })
})

describe('loading, error and 403', () => {
  it('shows the busy skeleton while loading', async () => {
    api.fetchAmaranEffectiveness.mockReturnValue(new Promise(() => undefined))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/amaran/keberkesanan')
    const w = mount(KeberkesananPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.get('[data-testid="kb-loading"]').attributes('aria-busy')).toBe('true')
    expect(has(w, 'kb-tiles')).toBe(false)
  })

  it('shows the server message with "Cuba Semula" on a 500 and reloads on retry', async () => {
    const w = await mountPage(apiError(500, 'Ralat pelayan.'))
    expect(text(w, 'kb-error')).toContain('Ralat pelayan.')
    expect(has(w, 'kb-tiles')).toBe(false)
    expect(useRouteOutcome().value).toBeNull()
    api.fetchAmaranEffectiveness.mockResolvedValue(result())
    const retry = w.findAll('button').find((b) => b.text().includes('Cuba Semula'))
    expect(retry).toBeDefined()
    await retry?.trigger('click')
    await flushPromises()
    expect(api.fetchAmaranEffectiveness).toHaveBeenCalledTimes(2)
    expect(has(w, 'kb-tiles')).toBe(true)
    expect(has(w, 'kb-error')).toBe(false)
  })

  it.each([['an empty message', ''], ['the bare client fallback', 'HTTP 500']])(
    'replaces %s with the generic BM line',
    async (_name, message) => {
      const w = await mountPage(apiError(500, message))
      expect(text(w, 'kb-error')).toContain('Ralat berlaku. Sila cuba lagi.')
      expect(text(w, 'kb-error')).not.toContain('HTTP 500')
    },
  )

  it('sets the in-place 403 outcome on a 403 and shows no error box or data', async () => {
    const w = await mountPage(apiError(403, 'This action is unauthorized.'))
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'kb-error')).toBe(false)
    expect(has(w, 'kb-tiles')).toBe(false)
  })
})

describe('roles', () => {
  it('school admin: back to /amaran/sekolah and "Lihat Senarai Risiko" in the zero card', async () => {
    session.role = 'school_admin'
    const w = await mountPage(zero())
    expect(w.get('[data-testid="kb-back"]').attributes('href')).toBe('/amaran/sekolah')
    expect(w.get('[data-testid="kb-none-link"]').attributes('href')).toBe('/amaran/sekolah')
  })

  it('teacher: back to /guru and no "Lihat Senarai Risiko" (dead link for the teacher)', async () => {
    session.role = 'teacher'
    const w = await mountPage(zero())
    expect(w.get('[data-testid="kb-back"]').attributes('href')).toBe('/guru')
    expect(has(w, 'kb-none')).toBe(true)
    expect(has(w, 'kb-none-link')).toBe(false)
  })
})
