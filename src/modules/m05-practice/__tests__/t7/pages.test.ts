// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import MissionListPage from '../../pages/MissionListPage.vue'
import RemedialListPage from '../../pages/RemedialListPage.vue'
import SpmTargetsPage from '../../pages/SpmTargetsPage.vue'
import StructuredAnswerPage from '../../pages/StructuredAnswerPage.vue'
import StructuredListPage from '../../pages/StructuredListPage.vue'

const api = vi.hoisted(() => ({
  fetchStructured: vi.fn(),
  fetchStructuredDetail: vi.fn(),
  submitStructuredAttempt: vi.fn(),
  fetchSpmTargets: vi.fn(),
  saveSpmTargets: vi.fn(),
  fetchRemedialTests: vi.fn(),
  fetchTodayMissions: vi.fn(),
}))
vi.mock('../../api/practice', () => api)

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({
    props: { open: Boolean },
    setup: (p) => () => h('div', { 'data-testid': 'report-modal', 'data-open': String(p.open) }),
  }),
}))

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/latihan-berstruktur', component: StructuredListPage },
      { path: '/latihan-berstruktur/:id/jawab', component: StructuredAnswerPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

const card = (over: Record<string, unknown> = {}) => ({
  id: 4454,
  subjectId: 23,
  subjectName: 'Perniagaan',
  kbatLevel: 3,
  estimatedMinutes: 8,
  isTrial: true,
  preview: 'Soalan satu',
  topic: 'Merancang',
  author: 'Guru Pakar',
  school: null,
  subQuestionCount: 2,
  levelName: 'Tingkatan 5',
  parts: 1,
  marks: 10,
  ...over,
})
const listOf = (items: unknown[], meta: Record<string, unknown> = {}) => ({
  data: items,
  meta: {
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    from: 1,
    to: items.length,
    scope: null,
    track: null,
    subjectOptions: [{ id: 23, name: 'Perniagaan' }],
    ...meta,
  },
})

beforeEach(() => {
  window.scrollTo = vi.fn()
  for (const f of Object.values(api)) f.mockReset()
  outcome.setRouteOutcome.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S10 StructuredListPage', () => {
  it('shows cards with the KBAT badge, hides a null school and links "Mula"', async () => {
    api.fetchStructured.mockResolvedValue(listOf([card()]))
    const w = await render(StructuredListPage, '/latihan-berstruktur')
    expect(t(w, 'structured-h1').text()).toBe('Soalan Berstruktur')
    expect(t(w, 'card-kbat').text()).toBe('MOTS 3')
    expect(t(w, 'card-minutes').text()).toBe('8m')
    expect(t(w, 'card-trial').text()).toBe('Trial')
    expect(t(w, 'card-author').text()).toBe('Guru Pakar')
    expect(t(w, 'card-footer').text()).toContain('2 soalan · Tingkatan 5')
    expect(t(w, 'card-start').attributes('href')).toBe('/latihan-berstruktur/4454/jawab')
    expect(w.find('[data-testid=card-parts]').exists()).toBe(false)
    expect(w.findAll('[data-testid=filter-subject] option').map((o) => o.text())).toEqual([
      'Semua Subjek',
      'Perniagaan',
    ])
  })

  it('shows the author school when present', async () => {
    api.fetchStructured.mockResolvedValue(listOf([card({ school: 'SMK Demo' })]))
    const w = await render(StructuredListPage, '/latihan-berstruktur')
    expect(t(w, 'card-author').text()).toBe('Guru Pakar · SMK Demo')
  })

  it('shows the empty state and no pager', async () => {
    api.fetchStructured.mockResolvedValue(listOf([]))
    const w = await render(StructuredListPage, '/latihan-berstruktur?subject_id=99')
    expect(t(w, 'structured-empty').text()).toContain('Tiada soalan berstruktur buat masa ini')
    expect(w.find('[data-testid=structured-pager]').exists()).toBe(false)
  })

  it('passes scope/track to the API, keeps them on "Mula" and shows the Bahasa heading', async () => {
    api.fetchStructured.mockResolvedValue(
      listOf([card({ parts: 3, marks: 40 })], { scope: 'spm', track: 'bahasa', totalItems: 12 }),
    )
    const w = await render(StructuredListPage, '/latihan-berstruktur?scope=spm&track=bahasa')
    expect(api.fetchStructured.mock.calls[0]?.[0]).toMatchObject({ scope: 'spm', track: 'bahasa' })
    expect(t(w, 'structured-h1').text()).toBe('Tracking A Bahasa')
    expect(t(w, 'structured-back').text()).toContain('Kembali ke Tracking A SPM')
    expect(t(w, 'structured-back').attributes('href')).toBe('/spm/ramalan')
    expect(t(w, 'structured-found').text()).toContain('12 set ditemui')
    expect(t(w, 'card-parts').text()).toContain('3 bahagian · 40 markah')
    expect(t(w, 'card-start').attributes('href')).toBe(
      '/latihan-berstruktur/4454/jawab?scope=spm&track=bahasa',
    )
  })

  it('shows the Subjektif SPM heading for scope=spm', async () => {
    api.fetchStructured.mockResolvedValue(listOf([card()], { scope: 'spm' }))
    const w = await render(StructuredListPage, '/latihan-berstruktur?scope=spm')
    expect(t(w, 'structured-h1').text()).toBe('Subjektif SPM')
    expect(t(w, 'structured-back').attributes('href')).toBe('/spm/subjektif')
    expect(w.find('[data-testid=structured-info]').exists()).toBe(false)
  })

  it('submits the filter with both parameters and keeps scope', async () => {
    api.fetchStructured.mockResolvedValue(listOf([card()], { scope: 'spm' }))
    const w = await render(StructuredListPage, '/latihan-berstruktur?scope=spm')
    await t(w, 'filter-kbat').setValue('4')
    await t(w, 'structured-filter').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({
      subject_id: '',
      kbat_level: '4',
      scope: 'spm',
    })
  })
})

const DETAIL = {
  id: 4454,
  subjectId: 23,
  subjectName: 'Perniagaan',
  levelName: 'Tingkatan 5',
  stimulus: '<b>Teks</b> kes',
  stimulusImage: null,
  subQuestions: [
    { id: 1, label: '(a)', text: 'Nyatakan satu.', marks: 2 },
    { id: 2, label: '(b)', text: 'Jelaskan.', marks: 4 },
  ],
  backUrl: '/latihan-berstruktur?subject_id=23&scope=spm',
}

describe('Q3 StructuredAnswerPage', () => {
  it('renders the stimulus as plain text and the sub-questions with marks', async () => {
    api.fetchStructuredDetail.mockResolvedValue(DETAIL)
    const w = await render(StructuredAnswerPage, '/latihan-berstruktur/4454/jawab?scope=spm')
    expect(api.fetchStructuredDetail).toHaveBeenCalledWith(
      4454,
      { scope: 'spm', track: null },
      expect.anything(),
    )
    expect(t(w, 'answer-stimulus').text()).toBe('<b>Teks</b> kes')
    expect(w.find('[data-testid=answer-stimulus] b').exists()).toBe(false)
    expect(w.find('[data-testid=answer-image]').exists()).toBe(false)
    expect(w.findAll('[data-testid=sub-marks]').map((m) => m.text())).toEqual([
      '[2 markah]',
      '[4 markah]',
    ])
    expect(t(w, 'answer-hint').text()).toContain('Jawab semua sub-soalan, kemudian klik Hantar.')
    expect(t(w, 'answer-back').attributes('href')).toBe(DETAIL.backUrl)
  })

  it('does not render an unsafe image', async () => {
    api.fetchStructuredDetail.mockResolvedValue({ ...DETAIL, stimulusImage: 'javascript:alert(1)' })
    const w = await render(StructuredAnswerPage, '/latihan-berstruktur/4454/jawab')
    expect(w.find('[data-testid=answer-image]').exists()).toBe(false)
  })

  it('posts the attempt with scope/track and shows marks and model answers', async () => {
    api.fetchStructuredDetail.mockResolvedValue(DETAIL)
    api.submitStructuredAttempt.mockResolvedValue({
      id: 'a1',
      marks: [
        { subQuestionId: 1, awarded: 1, max: 2 },
        { subQuestionId: 2, awarded: 4, max: 4 },
      ],
      totalAwarded: 5,
      totalMax: 6,
      modelAnswers: [
        { subQuestionId: 1, text: 'Skema A' },
        { subQuestionId: 2, text: 'Skema B' },
      ],
    })
    const w = await render(
      StructuredAnswerPage,
      '/latihan-berstruktur/4454/jawab?scope=spm&track=bahasa',
    )
    await w.findAll('[data-testid=sub-answer]')[0]?.setValue('jawapan')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitStructuredAttempt).toHaveBeenCalledWith(4454, {
      answers: [
        { subQuestionId: 1, text: 'jawapan' },
        { subQuestionId: 2, text: '' },
      ],
      scope: 'spm',
      track: 'bahasa',
    })
    expect(w.findAll('[data-testid=sub-awarded]').map((m) => m.text())).toEqual([
      '1/2 markah',
      '4/4 markah',
    ])
    expect(w.findAll('[data-testid=sub-model]').map((m) => m.text())).toEqual([
      'Skema A',
      'Skema B',
    ])
    expect(t(w, 'answer-total').text()).toBe('Jumlah: 5/6 markah')
  })

  it('lists the 422 field messages', async () => {
    api.fetchStructuredDetail.mockResolvedValue(DETAIL)
    api.submitStructuredAttempt.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { 'answers.0': 'Jawapan tidak sah.' },
      }),
    )
    const w = await render(StructuredAnswerPage, '/latihan-berstruktur/4454/jawab')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'answer-errors').text()).toContain('Jawapan tidak sah.')
  })

  it('shows the 404 page for an unknown or non-numeric id', async () => {
    api.fetchStructuredDetail.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(StructuredAnswerPage, '/latihan-berstruktur/999999/jawab')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    wrapper?.unmount()
    outcome.setRouteOutcome.mockReset()
    await render(StructuredAnswerPage, '/latihan-berstruktur/abc/jawab')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(api.fetchStructuredDetail).toHaveBeenCalledTimes(1)
  })
})

describe('S13 RemedialListPage', () => {
  it('shows the observed empty state', async () => {
    api.fetchRemedialTests.mockResolvedValue({ data: [], meta: {} })
    const w = await render(RemedialListPage, '/remedial/saya')
    expect(t(w, 'remedial-h1').text()).toBe('Ujian Remedial Saya')
    expect(t(w, 'remedial-empty').text()).toBe('🎯Tiada ujian remedial. Bagus — teruskan usaha!')
  })

  it('lists tests; only an active one has "Mula Ujian"', async () => {
    api.fetchRemedialTests.mockResolvedValue({
      data: [
        {
          id: 7601,
          subjectName: 'Matematik',
          totalQuestions: 10,
          status: 'active',
          createdAt: '2026-09-20T09:00:00+08:00',
          teacherName: 'Cikgu Demo',
        },
        {
          id: 7602,
          subjectName: 'Sains',
          totalQuestions: 5,
          status: 'completed',
          createdAt: '2026-09-10T09:00:00+08:00',
          teacherName: 'Cikgu Demo',
        },
      ],
      meta: {},
    })
    const w = await render(RemedialListPage, '/remedial/saya')
    const a = t(w, 'remedial-card-7601')
    expect(a.text()).toContain('10 soalan')
    expect(a.text()).toContain('Daripada: Cikgu Demo')
    expect(a.text()).toContain('20/09/2026')
    expect(a.get('[data-testid=remedial-start]').attributes('href')).toBe('/remedial/7601')
    const b = t(w, 'remedial-card-7602')
    expect(b.text()).toContain('Selesai')
    expect(b.find('[data-testid=remedial-start]').exists()).toBe(false)
  })
})

describe('S14 MissionListPage', () => {
  const mission = (over: Record<string, unknown> = {}) => ({
    id: 7103,
    title: 'Misi A',
    typeLabel: 'Latih Tubi SPM',
    subjectName: 'Matematik',
    questionCount: 10,
    coinsPerCorrect: 3,
    resourceTitle: 'Video',
    resourceUrl: 'https://youtu.be/x',
    resourceNote: 'Tonton dahulu',
    status: 'new',
    ...over,
  })

  it('shows the observed empty state', async () => {
    api.fetchTodayMissions.mockResolvedValue({ data: [], meta: {} })
    const w = await render(MissionListPage, '/misi-harian')
    expect(t(w, 'missions-empty').text()).toContain('Tiada misi hari ini')
    expect(t(w, 'missions-empty').text()).toContain('Misi baru akan muncul bila guru anda assign.')
  })

  it('renders cards, a safe external link and the completed state', async () => {
    api.fetchTodayMissions.mockResolvedValue({
      data: [mission(), mission({ id: 7104, status: 'completed', resourceUrl: 'javascript:x' })],
      meta: {},
    })
    const w = await render(MissionListPage, '/misi-harian')
    const a = t(w, 'mission-card-7103')
    expect(a.text()).toContain('3 syiling per jawapan betul')
    expect(a.get('[data-testid=mission-link]').attributes()).toMatchObject({
      href: 'https://youtu.be/x',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(a.get('[data-testid=mission-start]').attributes('href')).toBe('/misi-harian/7103')
    const b = t(w, 'mission-card-7104')
    expect(b.find('[data-testid=mission-link]').exists()).toBe(false)
    expect(b.get('[data-testid=mission-done]').text()).toBe('Selesai ✓')
    expect(b.find('[data-testid=mission-start]').exists()).toBe(false)
  })
})

describe('S15 SpmTargetsPage', () => {
  const rows = [
    {
      id: 1,
      name: 'Bahasa Melayu',
      target: 'A',
      answered: 12,
      accuracyPct: 75,
      band: 'green',
      predictedGrade: 'A-',
    },
    {
      id: 2,
      name: 'Fizik',
      target: null,
      answered: 0,
      accuracyPct: null,
      band: null,
      predictedGrade: null,
    },
  ]

  it('renders rows with status, bar and predicted grade', async () => {
    api.fetchSpmTargets.mockResolvedValue({ subjects: rows })
    const w = await render(SpmTargetsPage, '/target-spm')
    const r1 = t(w, 'target-row-1')
    expect(r1.get('[data-testid=target-status]').text()).toBe('12 soalan · 75%')
    expect(r1.get('[data-testid=target-bar]').attributes('style')).toContain('75%')
    expect(r1.get('[data-testid=target-predicted]').text()).toBe('A-')
    expect((r1.get('select').element as HTMLSelectElement).value).toBe('A')
    const r2 = t(w, 'target-row-2')
    expect(r2.get('[data-testid=target-status]').text()).toBe('Belum mula')
    expect(r2.find('[data-testid=target-bar]').exists()).toBe(false)
    expect(r2.get('[data-testid=target-predicted]').text()).toBe('-')
    expect(r2.findAll('option').map((o) => o.text())).toEqual([
      'Target',
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'C+',
      'C',
      'D',
      'E',
    ])
    expect(w.text()).toContain('70%+ Ketepatan (On Track)')
  })

  it('saves all rows, reloads and shows the success flash', async () => {
    api.fetchSpmTargets.mockResolvedValue({ subjects: rows })
    api.saveSpmTargets.mockResolvedValue({ data: { saved: 2 }, status: 'Target berjaya disimpan.' })
    const w = await render(SpmTargetsPage, '/target-spm')
    await t(w, 'target-row-2').get('select').setValue('B+')
    await t(w, 'targets-form').trigger('submit')
    await flushPromises()
    expect(api.saveSpmTargets).toHaveBeenCalledWith({ 1: 'A', 2: 'B+' })
    expect(api.fetchSpmTargets).toHaveBeenCalledTimes(2)
    expect(t(w, 'targets-success').text()).toContain('Target berjaya disimpan.')
  })

  it('keeps the choices and shows the error flash on failure', async () => {
    api.fetchSpmTargets.mockResolvedValue({ subjects: rows })
    api.saveSpmTargets.mockRejectedValue(new Error('x'))
    const w = await render(SpmTargetsPage, '/target-spm')
    await t(w, 'target-row-2').get('select').setValue('C')
    await t(w, 'targets-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'targets-failure').text()).toContain('Gagal menyimpan target. Sila cuba lagi.')
    expect((t(w, 'target-row-2').get('select').element as HTMLSelectElement).value).toBe('C')
  })
})
