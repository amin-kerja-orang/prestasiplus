// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import USelect from '@nuxt/ui/components/Select.vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type {
  HeadcountDashboard,
  HeadcountDetail,
  HeadcountSection,
  HeadcountSummary,
} from '../../api/headcount-types'
import HeadcountCreatePage from '../../pages/HeadcountCreatePage.vue'
import HeadcountDashboardPage from '../../pages/HeadcountDashboardPage.vue'
import HeadcountListPage from '../../pages/HeadcountListPage.vue'
import HeadcountStudentPage from '../../pages/HeadcountStudentPage.vue'
import HeadcountSummaryPage from '../../pages/HeadcountSummaryPage.vue'
import HeadcountTablePage from '../../pages/HeadcountTablePage.vue'

const api = vi.hoisted(() => ({
  fetchHeadcounts: vi.fn(),
  fetchHeadcountDashboard: vi.fn(),
  fetchHeadcountFormOptions: vi.fn(),
  createHeadcount: vi.fn(),
  autoSetupHeadcounts: vi.fn(),
  fetchHeadcountStudent: vi.fn(),
  fetchHeadcountSummary: vi.fn(),
  fetchHeadcountDetail: vi.fn(),
  resetHeadcount: vi.fn(),
  deleteHeadcount: vi.fn(),
  dropHeadcountStudents: vi.fn(),
  downloadHeadcountCsv: vi.fn(),
}))
vi.mock('../../api/headcount', () => api)

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: object, path: string, route = path.replace(/\?.*/, '')) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, {
    global: {
      plugins: [router],
      stubs: { ChartCanvas: { template: '<div data-testid="chart" />' } },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
/** The big number of a stat tile. */
const num = (w: VueWrapper, id: string) => t(w, id).find('.tabular').text()
/** The table row that holds the element with this test id. */
const tr = (w: VueWrapper, id: string) =>
  new DOMWrapper(t(w, id).element.closest('tr') ?? t(w, id).element)
/** The Nuxt UI select with this test id. */
const select = (w: VueWrapper, id: string) => {
  const found = w
    .findAllComponents(USelect)
    .find((c) => c.element.matches(`[data-testid=${id}]`) || c.find(`[data-testid=${id}]`).exists())
  if (!found) throw new Error(`no select ${id}`)
  return found
}
/** A prop of the Nuxt UI select with this test id. */
const prop = (w: VueWrapper, id: string, key: string): unknown =>
  (select(w, id).props() as Record<string, unknown>)[key]
/** The checkbox button of a Nuxt UI checkbox (or of the wrapper that holds it). */
const box = (el: Element | null | undefined) =>
  el?.matches('[role=checkbox]') ? el : (el?.querySelector('[role=checkbox]') ?? null)
/** Teleported modal content lives in `document.body`. */
const body = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid=${id}]`)
const apiError = (status: number, over: Record<string, unknown> = {}) =>
  new ApiError({ status, code: 'X', message: 'x', ...over })

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const ITEM = {
  id: 501,
  className: '5 A',
  subjectName: 'Kimia',
  levelName: 'Tingkatan 5',
  year: 2026,
  mode: 'auto',
  activeOtrs: 3,
  students: 8,
}

describe('S12 HeadcountListPage', () => {
  it('shows the hero and the empty state with "Buat Sekarang"', async () => {
    api.fetchHeadcounts.mockResolvedValue([])
    const w = await render(HeadcountListPage, '/headcount')
    expect(t(w, 'headcount-hero').text()).toContain('Tracking prestasi murid — TOV, OTR, AR & RS')
    expect(t(w, 'hero-dashboard').attributes('href')).toBe('/headcount/dashboard')
    expect(t(w, 'hero-create').attributes('href')).toBe('/headcount/create')
    expect(t(w, 'headcount-empty').text()).toContain('Belum ada headcount.')
    expect(t(w, 'headcount-create-now').attributes('href')).toBe('/headcount/create')
  })

  it('lists one card per config linking to S23', async () => {
    api.fetchHeadcounts.mockResolvedValue([
      ITEM,
      { ...ITEM, id: 502, mode: 'manual', activeOtrs: 2 },
    ])
    const w = await render(HeadcountListPage, '/headcount')
    expect(w.find('[data-testid=headcount-empty]').exists()).toBe(false)
    expect(t(w, 'headcount-card-501').attributes('href')).toBe('/headcount/501')
    expect(tr(w, 'headcount-card-501').text()).toContain('Auto')
    expect(tr(w, 'headcount-card-502').text()).toContain('Manual')
    expect(tr(w, 'headcount-card-502').text()).toContain('2 OTR')
    expect(tr(w, 'headcount-card-501').text()).toContain('8 murid')
  })

  it('Auto-Setup: the submit is disabled until a level is ticked, shows the count and posts the ticks', async () => {
    api.fetchHeadcounts.mockResolvedValue([])
    api.autoSetupHeadcounts.mockResolvedValue({ created: 1 })
    const w = await render(HeadcountListPage, '/headcount')
    expect(body('auto-setup-modal')).toBeNull()
    await t(w, 'hero-auto-setup').trigger('click')
    await flushPromises()
    const submit = body('auto-setup-submit') as HTMLButtonElement
    expect(
      document.body.querySelectorAll('[data-testid=auto-setup-modal] [role=checkbox]'),
    ).toHaveLength(11)
    expect(submit.disabled).toBe(true)
    expect(submit.textContent?.trim()).toBe('Auto-Setup')

    const tick = async (id: string) => {
      ;(body(id) as HTMLElement).click()
      await flushPromises()
    }
    await tick('level-D5')
    await tick('level-T2')
    expect(submit.disabled).toBe(false)
    expect(submit.textContent?.replace(/\s+/g, ' ').trim()).toBe('Auto-Setup (2)')
    expect(box(body('level-D5'))?.getAttribute('aria-checked')).toBe('true')
    expect(box(body('level-T2'))?.getAttribute('aria-checked')).toBe('true')

    submit.click()
    await flushPromises()
    expect(api.autoSetupHeadcounts.mock.calls[0]?.[0]).toEqual({ levels: [5, 'T2'] })
    expect(body('auto-setup-modal')).toBeNull()
    expect(api.fetchHeadcounts).toHaveBeenCalledTimes(2)
  })

  it('Auto-Setup failures show the BM load error, a headcount BM 409/422 message as is (SWE-12)', async () => {
    api.fetchHeadcounts.mockResolvedValue([])
    const w = await render(HeadcountListPage, '/headcount')
    await t(w, 'hero-auto-setup').trigger('click')
    await flushPromises()
    ;(body('level-D5') as HTMLElement).click()
    await flushPromises()
    const alertText = () => body('auto-setup-modal')?.textContent ?? ''
    const submitWith = async (error: ApiError) => {
      api.autoSetupHeadcounts.mockRejectedValueOnce(error)
      ;(body('auto-setup-submit') as HTMLButtonElement).click()
      await flushPromises()
    }
    const bm = 'Maaf, berlaku ralat. Sila cuba semula.'
    await submitWith(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }))
    expect(alertText()).toContain(bm)
    expect(alertText()).not.toContain('Server Error')
    await submitWith(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }))
    expect(alertText()).toContain(bm)
    expect(alertText()).not.toContain('Failed to fetch')
    await submitWith(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'This action is unauthorized.' }))
    expect(alertText()).toContain(bm)
    await submitWith(new ApiError({ status: 409, code: 'CONFLICT', message: 'Conflict.' }))
    expect(alertText()).toContain(bm)
    await submitWith(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Headcount sudah wujud untuk tahun ini.' }),
    )
    expect(alertText()).toContain('Headcount sudah wujud untuk tahun ini.')
    await submitWith(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Pilih sekurang-kurangnya satu tahap.' }),
    )
    expect(alertText()).toContain('Pilih sekurang-kurangnya satu tahap.')
  })

  it('"Batal" only hides the modal; reopening clears the ticks', async () => {
    api.fetchHeadcounts.mockResolvedValue([])
    const w = await render(HeadcountListPage, '/headcount')
    await t(w, 'hero-auto-setup').trigger('click')
    await flushPromises()
    ;(body('level-T1') as HTMLElement).click()
    await flushPromises()
    body('auto-setup-cancel')?.click()
    await flushPromises()
    expect(body('auto-setup-modal')).toBeNull()
    expect(api.autoSetupHeadcounts).not.toHaveBeenCalled()
    await t(w, 'hero-auto-setup').trigger('click')
    await flushPromises()
    expect((body('auto-setup-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(
      document.body.querySelectorAll('[data-testid=auto-setup-modal] [aria-checked=true]'),
    ).toHaveLength(0)
  })

  it('a 403 is the 403 page; any other failure the load-error box', async () => {
    api.fetchHeadcounts.mockRejectedValue(apiError(403))
    await render(HeadcountListPage, '/headcount')
    expect(useRouteOutcome().value).toBe(403)
    wrapper?.unmount()
    setRouteOutcome(null)
    api.fetchHeadcounts.mockRejectedValue(apiError(500))
    const w = await render(HeadcountListPage, '/headcount')
    expect(t(w, 'page-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
  })
})

describe('S13 HeadcountDashboardPage', () => {
  const cfg = (id: number, level: number, name: string, on: number, off: number, no: number) => ({
    id,
    level,
    levelName: name,
    className: '5 A',
    subjectName: 'Kimia',
    year: 2026,
    onTrack: on,
    offTrack: off,
    noData: no,
    totalStudents: on + off + no,
    chart: { labels: ['OTR1'], target: [60], actual: [null] },
  })
  const DASH: HeadcountDashboard = {
    configs: [cfg(1, 11, 'Tingkatan 5', 2, 1, 5), cfg(2, 10, 'Tingkatan 4', 1, 2, 3)],
  }

  it('shows the four cards, the overall bar and one chart per config', async () => {
    api.fetchHeadcountDashboard.mockResolvedValue(DASH)
    const w = await render(HeadcountDashboardPage, '/headcount/dashboard')
    expect(num(w, 'stat-configs')).toBe('2')
    expect(num(w, 'stat-students')).toBe('14')
    expect(num(w, 'stat-on')).toBe('3')
    expect(num(w, 'stat-off')).toBe('3')
    expect(t(w, 'overall-pct').text()).toBe('50%')
    expect(t(w, 'legend').text()).toContain('Tiada Data: 8')
    expect(w.findAll('[data-testid^=chart-card-]')).toHaveLength(2)
    expect(t(w, 'filter-all').text()).toBe('Semua (2)')
    // The level buttons are sorted by level id.
    const levels = w.findAll('[data-testid^=filter-level-]').map((b) => b.text())
    expect(levels).toEqual(['Tingkatan 4', 'Tingkatan 5'])
  })

  it('the level filter narrows the cards and the charts', async () => {
    api.fetchHeadcountDashboard.mockResolvedValue(DASH)
    const w = await render(HeadcountDashboardPage, '/headcount/dashboard')
    await t(w, 'filter-level-10').trigger('click')
    expect(num(w, 'stat-configs')).toBe('1')
    expect(num(w, 'stat-students')).toBe('6')
    expect(num(w, 'stat-on')).toBe('1')
    expect(t(w, 'filter-level-10').attributes('aria-pressed')).toBe('true')
    expect(w.findAll('[data-testid^=chart-card-]')).toHaveLength(1)
    await t(w, 'filter-all').trigger('click')
    expect(w.findAll('[data-testid^=chart-card-]')).toHaveLength(2)
  })

  it('no config: "Belum ada headcount." and no overall card', async () => {
    api.fetchHeadcountDashboard.mockResolvedValue({ configs: [] })
    const w = await render(HeadcountDashboardPage, '/headcount/dashboard')
    expect(t(w, 'dashboard-empty').text()).toContain('Belum ada headcount.')
    expect(t(w, 'filter-all').text()).toBe('Semua (0)')
    expect(w.find('[data-testid=overall-card]').exists()).toBe(false)
  })
})

describe('S14 HeadcountCreatePage', () => {
  const OPTIONS = {
    classes: [{ id: 9, name: '5 A' }],
    subjects: [
      { id: 3, name: 'Kimia', code: 'KIM' },
      { id: 4, name: 'Sejarah', code: 'SEJ' },
    ],
    levels: [
      { id: 10, name: 'Tingkatan 4' },
      { id: 11, name: 'Tingkatan 5' },
    ],
    defaultYear: 2026,
  }

  async function fill(w: VueWrapper) {
    select(w, 'field-classroom').vm.$emit('update:modelValue', '9')
    select(w, 'field-subject').vm.$emit('update:modelValue', '3')
    select(w, 'field-level').vm.$emit('update:modelValue', '11')
    await flushPromises()
  }
  const radio = (w: VueWrapper, group: string, value: string) =>
    w.get(`[data-testid=${group}] [role=radio][value="${value}"]`)

  it('renders the fields with the live defaults and no novalidate', async () => {
    api.fetchHeadcountFormOptions.mockResolvedValue(OPTIONS)
    const w = await render(HeadcountCreatePage, '/headcount/create')
    expect(t(w, 'create-form').attributes('novalidate')).toBeUndefined()
    expect((w.get('#academic_year').element as HTMLInputElement).value).toBe('2026')
    expect(w.get('#academic_year').attributes('min')).toBe('2020')
    expect(w.get('#academic_year').attributes('max')).toBe('2100')
    expect((prop(w, 'field-subject', 'items') as { label: string }[]).map((o) => o.label)).toEqual([
      'Kimia (KIM)',
      'Sejarah (SEJ)',
    ])
    expect(prop(w, 'field-subject', 'placeholder')).toBe('— Pilih subjek —')
    for (const id of ['field-classroom', 'field-subject', 'field-level'])
      expect(prop(w, id, 'required')).toBe(true)
    expect(radio(w, 'field-otr', '3').attributes('aria-checked')).toBe('true')
    expect(w.findAll('[data-testid=field-otr] [role=radio]')).toHaveLength(4)
    expect(radio(w, 'field-mode', 'auto').attributes('aria-checked')).toBe('true')
    await radio(w, 'field-mode', 'manual').trigger('click')
    expect(radio(w, 'field-mode', 'manual').attributes('aria-checked')).toBe('true')
    expect(radio(w, 'field-mode', 'auto').attributes('aria-checked')).toBe('false')
  })

  it('a valid submit posts numbers and goes to /headcount on 201', async () => {
    api.fetchHeadcountFormOptions.mockResolvedValue(OPTIONS)
    api.createHeadcount.mockResolvedValue({ id: 700 })
    const w = await render(HeadcountCreatePage, '/headcount/create')
    await fill(w)
    await radio(w, 'field-otr', '4').trigger('click')
    await t(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(api.createHeadcount.mock.calls[0]?.[0]).toEqual({
      classroomId: 9,
      subjectId: 3,
      educationLevelId: 11,
      academicYear: 2026,
      activeOtrs: 4,
      mode: 'auto',
    })
    expect(router.currentRoute.value.path).toBe('/headcount')
  })

  it('a 409 shows the returned copy above the form and keeps the values', async () => {
    api.fetchHeadcountFormOptions.mockResolvedValue(OPTIONS)
    api.createHeadcount.mockRejectedValue(
      apiError(409, {
        code: 'CONFLICT',
        message: 'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
      }),
    )
    const w = await render(HeadcountCreatePage, '/headcount/create')
    await fill(w)
    await t(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-error').text()).toContain(
      'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
    )
    expect(router.currentRoute.value.path).toBe('/headcount/create')
    expect(prop(w, 'field-subject', 'modelValue')).toBe('3')
  })

  it('a 422 lists the field messages', async () => {
    api.fetchHeadcountFormOptions.mockResolvedValue(OPTIONS)
    api.createHeadcount.mockRejectedValue(
      apiError(422, { code: 'VALIDATION_ERROR', fields: { classroomId: 'Kelas tidak sah.' } }),
    )
    const w = await render(HeadcountCreatePage, '/headcount/create')
    await fill(w)
    await t(w, 'create-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-error').text()).toContain('Kelas tidak sah.')
  })
})

describe('S15 HeadcountStudentPage', () => {
  const SECTION: HeadcountSection = {
    configId: 213,
    subject: 'Sejarah',
    school: 'SMK DEMO',
    levelName: 'Tingkatan 4',
    className: '4 Simulasi',
    year: 2026,
    status: 'below',
    tov: 67,
    etr: 56,
    rs: { value: 56.4, recordedAt: '2026-04-13' },
    projection: { value: 56, variant: 'amber', trend: 'Menurun', confidence: 'Rendah' },
    rows: [
      { checkpoint: 1, target: 72, targetGrade: 'A-', ar: null, arGrade: null, tone: 'noAr' },
      { checkpoint: 2, target: 77, targetGrade: 'A-', ar: 60, arGrade: 'B', tone: 'below' },
      { checkpoint: 3, target: 82, targetGrade: 'A', ar: 85, arGrade: 'A', tone: 'on' },
      { checkpoint: 4, target: null, targetGrade: null, ar: 50, arGrade: 'C', tone: 'noTarget' },
    ],
    prediction: { etr: 56, rs: 56.4, diff: 0.4, verdict: 'Ramalan Tepat' },
    chart: {
      labels: ['TOV', 'OTR1', 'OTR2', 'OTR3', 'OTR4', 'ETR', 'RS'],
      target: [67, 72, 77, 82, null, 56, null],
      actual: [67, null, 60, 85, 50, null, null],
      projection: [null, null, null, null, 50, 56, null],
      rs: 56.4,
    },
  }

  it('shows the header, the chips, the tinted rows, the RS row and the prediction box', async () => {
    api.fetchHeadcountStudent.mockResolvedValue({
      student: { id: 3201, name: 'Murid Simulasi 01', school: 'SMK DEMO' },
      sections: [SECTION],
    })
    const w = await render(
      HeadcountStudentPage,
      '/headcount/student/3201',
      '/headcount/student/:id',
    )
    expect(api.fetchHeadcountStudent.mock.calls[0]?.[0]).toBe(3201)
    expect(t(w, 'student-name').text()).toBe('Murid Simulasi 01')
    expect(t(w, 'student-subtitle').text().replace(/\s+/g, ' ')).toBe(
      'Headcount — Prestasi Individu · SMK DEMO',
    )
    const s = t(w, 'section-213')
    expect(s.get('[data-testid=status-pill]').text()).toBe('Below Target')
    expect(s.get('[data-testid=rs-badge]').text()).toBe('RS: 56.4% (C+)')
    expect(s.get('[data-testid=chip-tov]').text()).toBe('TOV: 67.0% (B+)')
    expect(s.get('[data-testid=chip-etr]').text()).toBe('ETR: 56.0% (C+)')
    expect(s.get('[data-testid=chip-projection]').text()).toBe('Unjuran: 56% (C+)')
    expect(s.get('[data-testid=chip-projection]').attributes('data-variant')).toBe('amber')
    expect(s.get('[data-testid=chip-trend]').text()).toBe('Menurun')
    expect(s.get('[data-testid=chip-confidence]').text()).toBe('Keyakinan: Rendah')
    // Row tones (FR-M08-96).
    const srow = (id: string) =>
      new DOMWrapper(s.get(`[data-testid=${id}]`).element.closest('tr'))
    expect(srow('row-otr-1').text()).toContain('—')
    expect(s.get('[data-testid=row-otr-1]').attributes('data-tone')).toBe('noAr')
    expect(s.get('[data-testid=row-otr-2]').attributes('data-tone')).toBe('below')
    expect(srow('row-otr-2').find('.text-error').text()).toBe('60.0')
    expect(s.get('[data-testid=row-otr-3]').attributes('data-tone')).toBe('on')
    expect(srow('row-otr-3').find('.text-success').text()).toBe('85.0')
    expect(srow('row-otr-4').text()).toContain('50')
    expect(srow('row-rs').text()).toContain('Direkod: 13 Apr 2026')
    expect(s.get('[data-testid=selisih]').text()).toBe('Selisih: +0.4 markah')
    expect(s.get('[data-testid=verdict]').text()).toBe('Ramalan Tepat')
  })

  it('an unknown pupil is the 404 page and a forbidden one the 403 page', async () => {
    api.fetchHeadcountStudent.mockRejectedValue(apiError(404))
    await render(HeadcountStudentPage, '/headcount/student/9', '/headcount/student/:id')
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    setRouteOutcome(null)
    api.fetchHeadcountStudent.mockRejectedValue(apiError(403))
    await render(HeadcountStudentPage, '/headcount/student/9', '/headcount/student/:id')
    expect(useRouteOutcome().value).toBe(403)
  })
})

describe('S22 HeadcountSummaryPage', () => {
  const SUMMARY: HeadcountSummary = {
    config: {
      id: 213,
      subject: 'Sejarah',
      className: '4 Simulasi',
      levelName: 'Tingkatan 4',
      year: 2026,
      activeOtrs: 3,
    },
    students: 15,
    avgTov: 62.1,
    avgEtr: 71.9,
    otrs: [
      { n: 1, above: 0, onTrack: 0, below: 0, na: 15 },
      { n: 2, above: 0, onTrack: 0, below: 0, na: 15 },
      { n: 3, above: 5, onTrack: 2, below: 8, na: 0 },
    ],
  }

  it('shows the cards, the per-OTR counts and only the non-zero bar segments', async () => {
    api.fetchHeadcountSummary.mockResolvedValue(SUMMARY)
    const w = await render(HeadcountSummaryPage, '/headcount/213/summary', '/headcount/:id/summary')
    expect(t(w, 'summary-subtitle').text().replace(/\s+/g, ' ')).toBe(
      'Sejarah · 4 Simulasi · Tingkatan 4 · 2026',
    )
    expect(num(w, 'card-students')).toBe('15')
    expect(num(w, 'card-tov')).toBe('62.1')
    expect(num(w, 'card-etr')).toBe('71.9')
    expect(num(w, 'card-otrs')).toBe('3')
    expect(t(w, 'otr-3').text()).toContain('Above: 5')
    expect(t(w, 'otr-3').text()).toContain('On Track: 2')
    expect(t(w, 'otr-3').text()).toContain('Below: 8')
    expect(t(w, 'otr-1').text()).toContain('N/A: 15')
    expect(t(w, 'full-table').attributes('href')).toBe('/headcount/213')
    expect(t(w, 'export-csv').attributes('href')).toBe('/headcount/213/export')
  })

  it('an average without a value is "—"', async () => {
    api.fetchHeadcountSummary.mockResolvedValue({ ...SUMMARY, avgEtr: null })
    const w = await render(HeadcountSummaryPage, '/headcount/213/summary', '/headcount/:id/summary')
    expect(num(w, 'card-etr')).toBe('—')
  })

  it('"Export CSV" downloads the file without leaving the page', async () => {
    api.fetchHeadcountSummary.mockResolvedValue(SUMMARY)
    api.downloadHeadcountCsv.mockResolvedValue({ blob: new Blob(['x']), filename: 'h.csv' })
    const create = vi.fn(() => 'blob:x')
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()
    const w = await render(HeadcountSummaryPage, '/headcount/213/summary', '/headcount/:id/summary')
    await t(w, 'export-csv').trigger('click')
    await flushPromises()
    expect(api.downloadHeadcountCsv.mock.calls[0]?.[0]).toBe(213)
    expect(create).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/headcount/213/summary')
  })
})

describe('S23 HeadcountTablePage', () => {
  const cell = (
    target: number | null,
    ar: number | null,
    tone: 'above' | 'on' | 'below' | 'na',
  ) => ({
    target,
    targetGrade: target === null ? null : ('B' as const),
    ar,
    arGrade: ar === null ? null : ('B' as const),
    tone,
  })
  const DETAIL: HeadcountDetail = {
    config: {
      id: 501,
      subject: 'Kimia',
      className: '5 A',
      levelName: 'Tingkatan 5',
      year: 2026,
      teacherName: 'Guru Demo',
      status: 'active',
      activeOtrs: 2,
    },
    chips: { onTrack: 1, below: 1, empty: 1, total: 3 },
    rows: [
      {
        userId: 1,
        name: 'Murid A',
        tov: 60,
        tovGrade: 'B',
        cells: [cell(62, 65, 'above'), cell(66, null, 'na')],
        etr: 75,
        etrGrade: 'A-',
        dropped: false,
      },
      {
        userId: 2,
        name: 'Murid B',
        tov: 55,
        tovGrade: 'C+',
        cells: [cell(60, 50, 'below'), cell(65, null, 'na')],
        etr: null,
        etrGrade: null,
        dropped: false,
      },
      {
        userId: 3,
        name: 'Murid C',
        tov: null,
        tovGrade: null,
        cells: [cell(null, null, 'na'), cell(null, null, 'na')],
        etr: null,
        etrGrade: null,
        dropped: true,
      },
    ],
    averages: { tov: 57.5, otrs: [61, 65.5], ars: [57.5, null], etr: 75 },
  }

  it('shows the header, the chips with percentages, the table tones and the average row', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    expect(api.fetchHeadcountDetail.mock.calls[0]?.[1]).toMatchObject({ sort: 'ranking' })
    expect(w.get('h1').text()).toBe('Kimia')
    expect(t(w, 'status-pill').text()).toBe('Active')
    expect(t(w, 'table-subtitle').text().replace(/\s+/g, ' ')).toBe(
      '5 A · Tingkatan 5 · 2026 · Guru: Guru Demo',
    )
    expect(t(w, 'chip-on').text()).toBe('On Track: 1 (33%)')
    expect(t(w, 'chip-below').text()).toBe('Below: 1 (33%)')
    expect(t(w, 'chip-empty').text()).toBe('Belum Diisi: 1')
    expect(t(w, 'chip-total').text()).toBe('Jumlah: 3')
    expect(t(w, 'ar-1-1').classes()).toContain('text-success')
    expect(t(w, 'ar-1-1').attributes('data-tone')).toBe('above')
    expect(t(w, 'ar-2-1').classes()).toContain('text-error')
    expect(t(w, 'ar-2-1').attributes('data-tone')).toBe('below')
    expect(t(w, 'row-3').attributes('data-dropped')).toBe('true')
    expect(tr(w, 'average-row').text()).toContain('Purata Kelas')
    expect(tr(w, 'average-row').text()).toContain('57.5')
    expect(t(w, 'sort-ranking').attributes('aria-current')).toBe('true')
    expect(t(w, 'action-edit').attributes('href')).toBe('/headcount/501/edit')
  })

  it('an unknown sort value is the ranking order; ?sort=name asks for A-Z', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    const w = await render(HeadcountTablePage, '/headcount/501?sort=zzz', '/headcount/:id')
    expect(api.fetchHeadcountDetail.mock.calls[0]?.[1]).toMatchObject({ sort: 'ranking' })
    expect(t(w, 'sort-ranking').attributes('aria-current')).toBe('true')
    wrapper?.unmount()
    api.fetchHeadcountDetail.mockClear()
    const w2 = await render(HeadcountTablePage, '/headcount/501?sort=name', '/headcount/:id')
    expect(api.fetchHeadcountDetail.mock.calls[0]?.[1]).toMatchObject({ sort: 'name' })
    expect(t(w2, 'sort-name').attributes('aria-current')).toBe('true')
  })

  it('the selection bar appears with the count; "Gugurkan" posts the ids and reloads', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    api.dropHeadcountStudents.mockResolvedValue({ updated: 2 })
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    expect(w.find('[data-testid=selection-bar]').exists()).toBe(false)
    await w.get('[data-testid=select-1]').trigger('click')
    await w.get('[data-testid=select-2]').trigger('click')
    expect(t(w, 'selection-count').text()).toBe('2')
    await t(w, 'drop-students').trigger('click')
    await flushPromises()
    expect(api.dropHeadcountStudents).toHaveBeenCalledWith(501, {
      action: 'drop',
      studentIds: [1, 2],
    })
    expect(api.fetchHeadcountDetail).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid=selection-bar]').exists()).toBe(false)
  })

  it('"Batal" clears the selection; select-all ticks every row', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    await w.get('[data-testid=select-all]').trigger('click')
    expect(t(w, 'selection-count').text()).toBe('3')
    await t(w, 'selection-cancel').trigger('click')
    expect(w.find('[data-testid=selection-bar]').exists()).toBe(false)
  })

  it('"Reset Data" opens the modal; "Batal" closes it without a call; "Ya, Reset" resets and reloads', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    api.resetHeadcount.mockResolvedValue({ reset: true })
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    await t(w, 'action-reset').trigger('click')
    await flushPromises()
    expect(body('reset-modal')?.textContent).toContain('Semua markah murid akan dikosongkan')
    expect(document.body.textContent).toContain('Reset Semua Data?')
    body('reset-cancel')?.click()
    await flushPromises()
    expect(body('reset-modal')).toBeNull()
    expect(api.resetHeadcount).not.toHaveBeenCalled()
    await t(w, 'action-reset').trigger('click')
    await flushPromises()
    body('reset-confirm')?.click()
    await flushPromises()
    expect(api.resetHeadcount).toHaveBeenCalledWith(501)
    expect(api.fetchHeadcountDetail).toHaveBeenCalledTimes(2)
  })

  it('"Padam" names the config; "Ya, Padam" deletes and goes to /headcount', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    api.deleteHeadcount.mockResolvedValue({ deleted: true })
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    await t(w, 'action-delete').trigger('click')
    await flushPromises()
    expect(body('delete-modal')?.textContent).toContain(
      'Anda pasti mahu padam headcount Kimia (5 A, 2026)?',
    )
    body('delete-confirm')?.click()
    await flushPromises()
    expect(api.deleteHeadcount).toHaveBeenCalledWith(501)
    expect(router.currentRoute.value.path).toBe('/headcount')
  })

  it('the "Key-in AR" dropdown lists one link per active OTR', async () => {
    api.fetchHeadcountDetail.mockResolvedValue(DETAIL)
    const w = await render(HeadcountTablePage, '/headcount/501', '/headcount/:id')
    expect(w.find('[data-testid=key-in-menu]').exists()).toBe(false)
    await t(w, 'action-key-in').trigger('click')
    const links = w.findAll('[data-testid=key-in-menu] a')
    expect(links.map((a) => a.text())).toEqual(['OTR1', 'OTR2'])
    expect(links[1]?.attributes('href')).toBe('/headcount/501/results/2')
  })

  it('an unknown config is the 404 page, a forbidden one the 403 page', async () => {
    api.fetchHeadcountDetail.mockRejectedValue(apiError(404))
    await render(HeadcountTablePage, '/headcount/9', '/headcount/:id')
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    setRouteOutcome(null)
    api.fetchHeadcountDetail.mockRejectedValue(apiError(403))
    await render(HeadcountTablePage, '/headcount/9', '/headcount/:id')
    expect(useRouteOutcome().value).toBe(403)
  })
})
