// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { MockExamView, MockListItem, MockResult } from '../../api/types'
import MockExamPage from '../../pages/MockExamPage.vue'
import MockResultPage from '../../pages/MockResultPage.vue'
import MockRunPage from '../../pages/MockRunPage.vue'
import WalkthroughPage from '../../pages/WalkthroughPage.vue'

const api = vi.hoisted(() => ({
  fetchMocks: vi.fn(),
  createMock: vi.fn(),
  fetchMock: vi.fn(),
  submitMock: vi.fn(),
  fetchMockResult: vi.fn(),
  solveWalkthrough: vi.fn(),
  fetchDutaRecommendation: vi.fn(),
}))
vi.mock('../../api', () => api)

const dialogs = vi.hoisted(() => ({ alertNative: vi.fn() }))
vi.mock('@/composables/native-dialogs', () => dialogs)

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router', async (orig) => ({
  ...(await orig<typeof import('@/app/router')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

const DUTA = {
  slug: 'maestro-matematik',
  name: 'Cikgu Ujian',
  initials: 'CU',
  tier: 'bintang' as const,
  tagline: 'Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.',
  subject: 'Matematik',
  state: 'Johor',
  rating: 4.92,
  active: true,
}

const LIST: MockListItem[] = [
  {
    id: 317,
    subject: 'Sejarah',
    paperNumber: 1,
    status: 'in_progress',
    createdAt: '2026-07-25T10:00:00+08:00',
    score: null,
    maxScore: 30,
    percent: null,
    grade: null,
  },
  {
    id: 16,
    subject: 'Bahasa Melayu',
    paperNumber: 1,
    status: 'submitted',
    createdAt: '2026-05-25T10:00:00+08:00',
    score: 0,
    maxScore: 30,
    percent: 0,
    grade: 'G',
  },
]

const VIEW: MockExamView = {
  id: 400,
  subject: 'Matematik',
  paperNumber: 1,
  status: 'in_progress',
  createdAt: '2026-09-25T10:00:00+08:00',
  items: [
    { no: 1, text: 'Soalan satu?', options: ['a', 'b', 'c', 'd'], maxMarks: 1 },
    { no: 2, text: 'Soalan dua?', options: ['e', 'f', 'g', 'h'], maxMarks: 1 },
  ],
}

const RESULT: MockResult = {
  id: 16,
  subject: 'Bahasa Melayu',
  paperNumber: 1,
  score: 1,
  maxScore: 2,
  percent: 50,
  grade: 'C',
  heroClass: 'mid',
  weakTopics: [{ topic: 'Sastra', wrongCount: 1 }],
  items: [
    {
      no: 1,
      questionId: 1,
      text: 'S1',
      modelAnswer: 'A',
      studentAnswer: 'A',
      marks: 1,
      maxMarks: 1,
      feedback: null,
      topic: 'Tatabahasa',
    },
    {
      no: 2,
      questionId: 2,
      text: 'S2',
      modelAnswer: 'B',
      studentAnswer: null,
      marks: 0,
      maxMarks: 1,
      feedback: 'Jawapan betul: B',
      topic: 'Sastra',
    },
  ],
}

let router: Router
let wrapper: VueWrapper | null = null

async function render(component: unknown, url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm-mock', component: MockExamPage },
      { path: '/spm-mock/:id(\\d+)', component: MockRunPage },
      { path: '/spm-mock/:id(\\d+)/result', component: MockResultPage },
      { path: '/pusat-ai/spm', component: WalkthroughPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  for (const f of [...Object.values(api), dialogs.alertNative, outcome.setRouteOutcome])
    f.mockReset()
  api.fetchDutaRecommendation.mockResolvedValue(DUTA)
  api.fetchMocks.mockResolvedValue(LIST)
  api.fetchMock.mockResolvedValue(VIEW)
  api.fetchMockResult.mockResolvedValue(RESULT)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S11 MockExamPage', () => {
  it('renders the hero, warning, form and the list with chips and links', async () => {
    const w = await render(MockExamPage, '/spm-mock')
    expect(t(w, 'mock-title').text()).toContain('📝 Peperiksaan Percubaan SPM')
    expect(t(w, 'mock-warning').text()).toContain('Persediaan sebelum mula:')
    expect(t(w, 'mock-subject').attributes('required')).toBeDefined()
    expect(w.findAll('[data-testid=mock-subject] option')).toHaveLength(11)
    expect((t(w, 'mock-paper').element as HTMLSelectElement).value).toBe('1')
    expect(t(w, 'mock-generate').text()).toBe('🎯 Jana Percubaan SPM')
    expect(t(w, 'duta-name').text()).toBe('Cikgu Ujian')
    const pending = t(w, 'mock-row-317')
    expect(pending.get('[data-testid=mock-row-grade]').text()).toBe('Belum')
    expect(pending.text()).toContain('Belum dihantar')
    expect(pending.get('a').attributes('href')).toBe('/spm-mock/317')
    expect(pending.get('a').text()).toBe('Sambung →')
    const done = t(w, 'mock-row-16')
    expect(done.text()).toContain('Score: 0/30 (0.00%)')
    expect(done.get('[data-testid=mock-row-grade]').text()).toBe('G')
    expect(done.get('a').attributes('href')).toBe('/spm-mock/16/result')
  })

  it('creates a mock and goes to Q4', async () => {
    api.createMock.mockResolvedValue({ id: 400 })
    const w = await render(MockExamPage, '/spm-mock')
    await t(w, 'mock-subject').setValue('Matematik')
    await t(w, 'mock-paper').setValue('2')
    await t(w, 'mock-form').trigger('submit')
    await flushPromises()
    expect(api.createMock).toHaveBeenCalledWith({ subject: 'Matematik', paperNumber: 2 })
    expect(router.currentRoute.value.fullPath).toBe('/spm-mock/400')
  })

  it('shows a server field error and stays', async () => {
    api.createMock.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { subject: 'Sila pilih subjek.' },
      }),
    )
    const w = await render(MockExamPage, '/spm-mock')
    await t(w, 'mock-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'mock-form-error').text()).toContain('Sila pilih subjek.')
    expect(router.currentRoute.value.path).toBe('/spm-mock')
  })

  it('shows an empty history and an error with retry', async () => {
    api.fetchMocks.mockResolvedValueOnce([])
    const w = await render(MockExamPage, '/spm-mock')
    expect(t(w, 'mock-history').text()).toContain('📚 Percubaan Sebelum Ini')
    expect(w.findAll('[data-testid^=mock-row-]')).toHaveLength(0)
    wrapper?.unmount()
    api.fetchMocks.mockRejectedValueOnce(new Error('x'))
    const w2 = await render(MockExamPage, '/spm-mock')
    expect(t(w2, 'mock-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w2, 'mock-retry').trigger('click')
    await flushPromises()
    expect(w2.findAll('[data-testid^=mock-row-]').length).toBeGreaterThan(0)
  })

  it('hides the Duta block when the read fails', async () => {
    api.fetchDutaRecommendation.mockRejectedValue(new Error('x'))
    const w = await render(MockExamPage, '/spm-mock')
    expect(w.find('[data-testid=duta-block]').exists()).toBe(false)
  })
})

describe('Q4 MockRunPage (provisional)', () => {
  it('renders title, timer without a pause control, inputs and Hantar', async () => {
    const w = await render(MockRunPage, '/spm-mock/400')
    expect(t(w, 'run-title').text()).toBe('Matematik · Paper 1')
    expect(t(w, 'mock-timer').text()).toMatch(/^\d+(:\d{2}){1,2}$/)
    expect(w.text()).not.toMatch(/pause|jeda/i)
    expect(w.findAll('[data-testid=run-option]')).toHaveLength(8)
    expect(t(w, 'run-submit').text()).toBe('Hantar')
  })

  it('submits the chosen answers and goes to S12', async () => {
    api.submitMock.mockResolvedValue(RESULT)
    const w = await render(MockRunPage, '/spm-mock/400')
    await w.findAll('[data-testid=run-option]')[1]!.setValue(true)
    await t(w, 'run-form').trigger('submit')
    await flushPromises()
    expect(api.submitMock).toHaveBeenCalledWith(400, [
      { no: 1, answer: 'B' },
      { no: 2, answer: '' },
    ])
    expect(router.currentRoute.value.fullPath).toBe('/spm-mock/400/result')
  })

  it('uses textareas for Paper 2 items', async () => {
    api.fetchMock.mockResolvedValue({
      ...VIEW,
      paperNumber: 2,
      items: [{ no: 1, text: 'Huraikan', maxMarks: 10 }],
    })
    const w = await render(MockRunPage, '/spm-mock/400')
    expect(w.findAll('[data-testid=run-answer]')).toHaveLength(1)
  })

  it('redirects a submitted mock to S12 and raises 404 for an unknown mock', async () => {
    api.fetchMock.mockResolvedValue({ ...VIEW, status: 'submitted' })
    await render(MockRunPage, '/spm-mock/400')
    expect(router.currentRoute.value.fullPath).toBe('/spm-mock/400/result')
    wrapper?.unmount()
    api.fetchMock.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await render(MockRunPage, '/spm-mock/999')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })

  it('keeps the page and shows an error when submit fails', async () => {
    api.submitMock.mockRejectedValue(new Error('x'))
    const w = await render(MockRunPage, '/spm-mock/400')
    await t(w, 'run-form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-testid=run-submit-error]').exists()).toBe(true)
    expect(router.currentRoute.value.path).toBe('/spm-mock/400')
  })
})

describe('Q4 submit 409', () => {
  it('replaces to the result page when the mock was already submitted', async () => {
    api.submitMock.mockRejectedValue(
      new ApiError({ status: 409, code: 'ALREADY_SUBMITTED', message: 'x' }),
    )
    const w = await render(MockRunPage, '/spm-mock/400')
    await t(w, 'run-form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-testid=run-submit-error]').exists()).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/spm-mock/400/result')
  })
})

describe('S12 MockResultPage', () => {
  it('renders hero, weak topics, tip, review and actions', async () => {
    const w = await render(MockResultPage, '/spm-mock/16/result')
    expect(t(w, 'result-title').text()).toBe('Bahasa Melayu · Paper 1')
    expect(t(w, 'result-grade').text()).toBe('C')
    expect(t(w, 'result-percent').text()).toBe('50.00%')
    expect(t(w, 'result-score').text()).toBe('1 / 2 markah')
    expect(t(w, 'result-hero').attributes('data-hero')).toBe('mid')
    expect(t(w, 'weak-count').text()).toBe('1 soalan tersilap')
    expect(t(w, 'result-tip').get('a').attributes('href')).toBe('/pusat-nota-ringkas')
    expect(t(w, 'review-item-1').attributes('data-correct')).toBe('true')
    expect(t(w, 'review-item-1').get('[data-testid=review-header]').text()).toBe(
      '✓ Soalan 1 · 1/1 markah',
    )
    const wrong = t(w, 'review-item-2')
    expect(wrong.attributes('data-correct')).toBe('false')
    expect(wrong.text()).toContain('(tiada jawapan)')
    expect(wrong.text()).toContain('Jawapan betul: B')
    expect(t(w, 'duta-title').text()).toBe('🎓 Cikgu Pakar Bahasa Melayu')
    expect(api.fetchDutaRecommendation).toHaveBeenCalledWith(
      { subject: 'Bahasa Melayu' },
      expect.anything(),
    )
    const hrefs = w.findAll('[data-testid=result-actions] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(['/spm-mock', '/pusat-nota-ringkas'])
  })

  it('hides weak topics when nothing is wrong', async () => {
    api.fetchMockResult.mockResolvedValue({
      ...RESULT,
      weakTopics: [],
      heroClass: 'good',
      grade: 'A+',
    })
    const w = await render(MockResultPage, '/spm-mock/16/result')
    expect(w.find('[data-testid=result-weak]').exists()).toBe(false)
    expect(t(w, 'result-hero').attributes('data-hero')).toBe('good')
  })

  it('404 for unknown, back to Q4 when not submitted', async () => {
    api.fetchMockResult.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(MockResultPage, '/spm-mock/99999/result')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    wrapper?.unmount()
    api.fetchMockResult.mockRejectedValue(
      new ApiError({ status: 409, code: 'NOT_SUBMITTED', message: 'x' }),
    )
    await render(MockResultPage, '/spm-mock/317/result')
    expect(router.currentRoute.value.fullPath).toBe('/spm-mock/317')
  })
})

describe('S13 WalkthroughPage', () => {
  it('renders the form as specified', async () => {
    const w = await render(WalkthroughPage, '/pusat-ai/spm')
    expect(w.text()).toContain('📝 Panduan Langkah SPM')
    expect(w.findAll('[data-testid=walk-subject] option')).toHaveLength(16)
    expect(t(w, 'walk-subject').attributes('required')).toBeDefined()
    expect(t(w, 'walk-year').attributes('maxlength')).toBe('8')
    expect(t(w, 'walk-year').attributes('placeholder')).toBe('Cth: 2023')
    expect(t(w, 'walk-submit').text()).toBe('Beri Panduan Langkah')
    expect(w.find('[data-testid=walk-result]').exists()).toBe(false)
    expect(t(w, 'duta-title').text()).toBe('🎓 Cikgu Maestro SPM')
  })

  it('shows the busy label, then the walkthrough as text and restores the button', async () => {
    let resolve!: (v: unknown) => void
    api.solveWalkthrough.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = await render(WalkthroughPage, '/pusat-ai/spm')
    await t(w, 'walk-subject').setValue('Matematik')
    await t(w, 'walk-question').setValue('Cari x')
    await t(w, 'walk-form').trigger('submit')
    expect(t(w, 'walk-submit').text()).toBe('AI sedang fikir... (mungkin 15-30s)')
    expect(t(w, 'walk-submit').attributes('disabled')).toBeDefined()
    const sent = api.solveWalkthrough.mock.calls[0]![0] as FormData
    expect(sent.get('subject')).toBe('Matematik')
    expect(sent.get('question_text')).toBe('Cari x')
    expect(sent.has('image')).toBe(false)
    resolve({ ok: true, walkthrough: 'Soalan: <b>x</b>\n\nLangkah 1' })
    await flushPromises()
    expect(t(w, 'walk-body').text()).toBe('Soalan: <b>x</b>\n\nLangkah 1')
    expect(t(w, 'walk-body').find('b').exists()).toBe(false)
    expect(t(w, 'walk-result').text()).toContain('✨ Panduan Langkah Cikgu Alesa')
    expect(t(w, 'walk-submit').text()).toBe('Beri Panduan Langkah')
  })

  it('alerts the error, "Ralat" without one, and "Ralat: " on a network error', async () => {
    const w = await render(WalkthroughPage, '/pusat-ai/spm')
    await t(w, 'walk-subject').setValue('Sejarah')
    api.solveWalkthrough.mockResolvedValueOnce({ ok: false, error: 'X' })
    await t(w, 'walk-form').trigger('submit')
    await flushPromises()
    api.solveWalkthrough.mockResolvedValueOnce({ ok: false })
    await t(w, 'walk-form').trigger('submit')
    await flushPromises()
    api.solveWalkthrough.mockRejectedValueOnce(new Error('putus'))
    await t(w, 'walk-form').trigger('submit')
    await flushPromises()
    expect(dialogs.alertNative.mock.calls.map((c) => c[0])).toEqual(['X', 'Ralat', 'Ralat: putus'])
    expect(t(w, 'walk-submit').text()).toBe('Beri Panduan Langkah')
    expect(w.find('[data-testid=walk-result]').exists()).toBe(false)
  })

  it('labels the chosen image "📎 {file}"', async () => {
    const w = await render(WalkthroughPage, '/pusat-ai/spm')
    const input = t(w, 'walk-image').element as HTMLInputElement
    const file = new File(['x'], 'soalan.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await t(w, 'walk-image').trigger('change')
    expect(t(w, 'walk-image-label').text()).toBe('📎 soalan.png')
  })
})
