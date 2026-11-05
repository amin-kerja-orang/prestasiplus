// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type { HeadcountDetail, HeadcountRow } from '../../api/headcount-types'
import HeadcountEditPage from '../../pages/HeadcountEditPage.vue'
import HeadcountResultsPage from '../../pages/HeadcountResultsPage.vue'
import HeadcountSettingsPage from '../../pages/HeadcountSettingsPage.vue'
import HeadcountUnjuranPage from '../../pages/HeadcountUnjuranPage.vue'

const api = vi.hoisted(() => ({
  fetchHeadcountDetail: vi.fn(),
  fetchHeadcounts: vi.fn(),
  saveHeadcountAr: vi.fn(),
  saveHeadcountTov: vi.fn(),
  saveHeadcountSettings: vi.fn(),
  saveHeadcountDefaults: vi.fn(),
}))
vi.mock('../../api/headcount', () => api)
const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/composables', () => ({ useToast: () => toast }))

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: object, path: string, route: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, {
    global: { plugins: [router], stubs: { ChartCanvas: { template: '<div />' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
/** The input inside (or behind) a test id of a mark field. */
const input = (w: VueWrapper, id: string) => {
  const host = w.get(`[data-testid=${id}]`).element
  return (host.matches('input') ? host : host.querySelector('input')) as HTMLInputElement
}
const type = async (el: HTMLInputElement, value: string) => {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
const body = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid=${id}]`)
const apiError = (status: number, over: Record<string, unknown> = {}) =>
  new ApiError({ status, code: 'X', message: 'x', ...over })

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of [...Object.values(api), toast.add]) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const cell = (target: number | null, ar: number | null) => ({
  target,
  targetGrade: null,
  ar,
  arGrade: null,
  tone: 'na' as const,
})
const row = (userId: number, over: Partial<HeadcountRow> = {}): HeadcountRow => ({
  userId,
  name: `Murid ${String(userId)}`,
  tov: 40,
  tovGrade: null,
  cells: [cell(53, null), cell(66, null), cell(80, null)],
  etr: 80,
  etrGrade: null,
  dropped: false,
  rs: null,
  rsRecordedAt: null,
  status: 'none',
  statusReason: null,
  entryStatus: 'active',
  projection: null,
  ...over,
})
const detail = (over: Partial<HeadcountDetail['config']> = {}, rows: HeadcountRow[] = [row(1), row(2)]): HeadcountDetail => ({
  config: {
    id: 501,
    subject: 'Matematik',
    className: '5 A',
    levelName: 'Tingkatan 5',
    year: 2026,
    teacherName: 'Guru Demo',
    status: 'active',
    activeOtrs: 3,
    mode: 'manual',
    defaultTov: null,
    defaultEtr: null,
    ...over,
  },
  chips: { onTrack: 0, below: 0, empty: rows.length, total: rows.length, onTrackPct: 0 },
  rows,
  averages: { tov: 40, otrs: [53, 66, 80], ars: [null, null, null], etr: 80 },
})

describe('Key-in AR (HeadcountResultsPage)', () => {
  const path = '/headcount/501/results/1'
  const pattern = '/headcount/:id/results/:n'

  it('an Auto config is the 404 page (AC-GUR-3-5)', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail({ mode: 'auto' }))
    await render(HeadcountResultsPage, path, pattern)
    expect(useRouteOutcome().value).toBe(404)
  })

  it.each([
    [1, null],
    [3, null],
    [0, 404],
    [4, 404],
  ])('results/%s → outcome %s', async (n, outcome) => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    await render(HeadcountResultsPage, `/headcount/501/results/${String(n)}`, pattern)
    expect(useRouteOutcome().value).toBe(outcome)
  })

  it('AR 101 shows "Markah mesti antara 0 dan 100." and saves nothing; 66.5 saves with the toast', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.saveHeadcountAr.mockResolvedValue(detail())
    const w = await render(HeadcountResultsPage, path, pattern)
    expect(w.get('h1').text()).toBe('Key-in AR — OTR1')
    await type(input(w, 'ar-input-1'), '101')
    await t(w, 'save').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Markah mesti antara 0 dan 100.')
    expect(api.saveHeadcountAr).not.toHaveBeenCalled()
    expect(toast.add).not.toHaveBeenCalled()

    await type(input(w, 'ar-input-1'), '66.5')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.saveHeadcountAr).toHaveBeenCalledWith(501, {
      checkpoint: 1,
      marks: [
        { userId: 1, value: 66.5 },
        { userId: 2, value: null },
      ],
    })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'AR OTR1 disimpan.' }))
  })

  it('shows the target of OTR1 and the live status', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    const w = await render(HeadcountResultsPage, path, pattern)
    expect(t(w, 'status-1').text()).toBe('—')
    await type(input(w, 'ar-input-1'), '60')
    expect(t(w, 'status-1').text()).toBe('On Track')
    await type(input(w, 'ar-input-1'), '50')
    expect(t(w, 'status-1').text()).toBe('Below')
    expect(w.text()).toContain('Target OTR1')
    expect(w.text()).toContain('53')
  })

  it('a 404 of the save is the 404 page', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.saveHeadcountAr.mockRejectedValue(apiError(404))
    const w = await render(HeadcountResultsPage, path, pattern)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('Edit TOV/ETR (HeadcountEditPage)', () => {
  const path = '/headcount/501/edit'
  const pattern = '/headcount/:id/edit'

  it('shows the computed OTR targets (TOV 40, ETR 80 → 53 / 66 / 80) and updates them live', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    const w = await render(HeadcountEditPage, path, pattern)
    expect(['otr1-1', 'otr2-1', 'otr3-1'].map((id) => t(w, id).text())).toEqual(['53', '66', '80'])
    await type(input(w, 'etr-1'), '')
    expect(t(w, 'otr1-1').text()).toBe('—')
  })

  it('saves only the changed fields of the changed rows and toasts "TOV/ETR disimpan."', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.saveHeadcountTov.mockResolvedValue(detail())
    const w = await render(HeadcountEditPage, path, pattern)
    await type(input(w, 'tov-2'), '50.5')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.saveHeadcountTov).toHaveBeenCalledWith(501, { rows: [{ userId: 2, tov: 50.5 }] })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'TOV/ETR disimpan.' }))
  })

  it('a mark above 100 and a future record date show their messages and save nothing', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail({}, [row(1, { rs: 70 })]))
    const w = await render(HeadcountEditPage, path, pattern)
    await type(input(w, 'etr-1'), '101')
    await type(input(w, 'date-1'), '2999-01-01')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Markah mesti antara 0 dan 100.')
    expect(w.text()).toContain('Tarikh tidak boleh lebih lewat daripada hari ini.')
    expect(api.saveHeadcountTov).not.toHaveBeenCalled()
  })

  it('shows "Direkodkan: …" for a recorded RS', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(
      detail({}, [row(1, { rs: 70, rsRecordedAt: '2026-04-13' })]),
    )
    const w = await render(HeadcountEditPage, path, pattern)
    expect(t(w, 'recorded-1').text()).toBe('Direkodkan: 13 Apr 2026')
  })
})

describe('Unjuran (HeadcountUnjuranPage)', () => {
  it('lists Nama · TOV · AR terkini · Unjuran · Gred · Trend · Keyakinan from the projection', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(
      detail({}, [
        row(1, {
          cells: [cell(53, null), cell(66, 60), cell(80, null)],
          projection: { value: 80, variant: 'green', trend: 'Meningkat', confidence: 'Sederhana' },
        }),
        row(2),
      ]),
    )
    const w = await render(HeadcountUnjuranPage, '/headcount/501/unjuran', '/headcount/:id/unjuran')
    const head = w.get('[data-testid=unjuran-table]').findAll('th').map((h) => h.text())
    expect(head).toEqual(['Nama', 'TOV', 'AR terkini', 'Unjuran', 'Gred', 'Trend', 'Keyakinan'])
    const first = w.get('[data-testid=unjuran-table]').findAll('tbody tr')[0]?.findAll('td').map((c) => c.text())
    expect(first).toEqual(['Murid 1', '40', '60', '80%', 'A', 'Meningkat', 'Sederhana'])
    const second = w.get('[data-testid=unjuran-table]').findAll('tbody tr')[1]?.findAll('td').map((c) => c.text())
    expect(second?.slice(2)).toEqual(['—', '—', '—', '—', '—'])
  })
})

describe('Tetapan (HeadcountSettingsPage)', () => {
  const path = '/headcount/501/settings'
  const pattern = '/headcount/:id/settings'
  const CONFIRM = 'OTR3 ke atas mempunyai markah. Padam markah tersebut?'

  it('saves Bilangan OTR and toasts "Tetapan disimpan."; the mode is read-only', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.saveHeadcountSettings.mockResolvedValue(detail({ activeOtrs: 3 }))
    const w = await render(HeadcountSettingsPage, path, pattern)
    expect(t(w, 'mode-readonly').text()).toContain('Manual')
    await w.get('[data-testid=settings-form]').trigger('submit')
    await flushPromises()
    expect(api.saveHeadcountSettings).toHaveBeenCalledWith(501, { activeOtrs: 3 })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tetapan disimpan.' }))
  })

  it('CF-05: a 409 opens the dialog; "Batal" keeps 3, "Ya, Padam" repeats the save with confirm', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.saveHeadcountSettings.mockRejectedValueOnce(apiError(409, { code: 'CONFLICT', message: CONFIRM }))
    const w = await render(HeadcountSettingsPage, path, pattern)
    const radios = w.findAll('[role=radio]')
    await radios[0]?.trigger('click') // 2 OTR
    await flushPromises()
    await w.get('[data-testid=settings-form]').trigger('submit')
    await flushPromises()
    expect(document.body.textContent).toContain(CONFIRM)
    expect(body('cf05-cancel')).not.toBeNull()

    body('cf05-cancel')?.click()
    await flushPromises()
    expect(document.body.textContent).not.toContain(CONFIRM)
    expect(w.findAll('[role=radio]')[1]?.attributes('aria-checked')).toBe('true')

    api.saveHeadcountSettings.mockRejectedValueOnce(apiError(409, { code: 'CONFLICT', message: CONFIRM }))
    api.saveHeadcountSettings.mockResolvedValueOnce(detail({ activeOtrs: 2 }))
    await w.findAll('[role=radio]')[0]?.trigger('click')
    await flushPromises()
    await w.get('[data-testid=settings-form]').trigger('submit')
    await flushPromises()
    body('cf05-confirm')?.click()
    await flushPromises()
    expect(api.saveHeadcountSettings).toHaveBeenLastCalledWith(501, { activeOtrs: 2, confirm: true })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tetapan disimpan.' }))
  })

  it('Simpan Sasaran: TOV 40 and RS 80 show Jurang +40, save every config of the subject and year, toast "Sasaran disimpan."', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.fetchHeadcounts.mockResolvedValue([
      { id: 501, subjectName: 'Matematik', year: 2026, teacherName: 'Guru Demo' },
      { id: 502, subjectName: 'Matematik', year: 2026, teacherName: 'Guru Demo' },
      { id: 503, subjectName: 'Sains', year: 2026, teacherName: 'Guru Demo' },
    ])
    api.saveHeadcountDefaults.mockImplementation((id: number) =>
      Promise.resolve(detail({ id, defaultTov: 40, defaultEtr: 80 })),
    )
    const w = await render(HeadcountSettingsPage, path, pattern)
    expect(t(w, 'jurang').text()).toBe('Jurang: —')
    await type(input(w, 'target-tov'), '40')
    await type(input(w, 'target-rs'), '80')
    expect(t(w, 'jurang').text()).toBe('Jurang: +40')
    await w.get('[data-testid=target-form]').trigger('submit')
    await flushPromises()
    expect(api.saveHeadcountDefaults.mock.calls.map((c) => c[0])).toEqual([501, 502])
    expect(api.saveHeadcountDefaults).toHaveBeenCalledWith(501, { defaultTov: 40, defaultEtr: 80 })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sasaran disimpan.' }))
  })

  it('Simpan Sasaran: out of range shows the message; a failure shows "Gagal menyimpan sasaran. Cuba lagi."', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(detail())
    api.fetchHeadcounts.mockResolvedValue([])
    api.saveHeadcountDefaults.mockRejectedValue(apiError(500))
    const w = await render(HeadcountSettingsPage, path, pattern)
    await type(input(w, 'target-tov'), '101')
    await w.get('[data-testid=target-form]').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Markah mesti antara 0 dan 100.')
    expect(api.saveHeadcountDefaults).not.toHaveBeenCalled()
    await type(input(w, 'target-tov'), '40')
    await w.get('[data-testid=target-form]').trigger('submit')
    await flushPromises()
    expect(t(w, 'target-error').text()).toContain('Gagal menyimpan sasaran. Cuba lagi.')
  })
})
