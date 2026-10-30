// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { PracticeSubject, SubjectConfig } from '../../api/types'
import PracticeConfigPage from '../../pages/PracticeConfigPage.vue'
import PracticeListPage from '../../pages/PracticeListPage.vue'
import PracticeQuizPage from '../../pages/PracticeQuizPage.vue'

const api = vi.hoisted(() => ({
  fetchPracticeSubjects: vi.fn(),
  fetchSubjectConfig: vi.fn(),
  startSession: vi.fn(),
  checkAnswer: vi.fn(),
  submitSession: vi.fn(),
}))
vi.mock('../../api/practice', () => api)

const topic = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  api: { get: topic.get },
}))

// The Tingkatan 1-3 hold-back reads the session store, which the `@/api` mock below cannot serve.
vi.mock('@/lib/lower-form', async (orig) => {
  const { ref } = await import('vue')
  return { ...(await orig<typeof import('@/lib/lower-form')>()), useIsLowerForm: () => ref(false) }
})

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({ setup: () => () => h('div') }),
}))

const subject = (over: Partial<PracticeSubject>): PracticeSubject => ({
  id: 1,
  code: 'BM',
  name: 'Bahasa Melayu',
  nameEn: 'Malay Language',
  icon: 'fa-book-open',
  color: '#3B82F6',
  isCore: true,
  approvedCount: 11688,
  bankCount: 11688,
  ...over,
})

const SUBJECTS: PracticeSubject[] = [
  subject({}),
  subject({
    id: 3,
    code: 'MATH',
    name: 'Matematik',
    nameEn: 'Mathematics',
    icon: 'fa-calculator',
    color: '#EF4444',
    approvedCount: 13872,
  }),
  subject({
    id: 9,
    code: 'GEO',
    name: 'Geografi',
    nameEn: 'Geography',
    icon: null,
    color: '#10B981',
    isCore: false,
    approvedCount: 900,
  }),
]

const MATH: SubjectConfig = {
  subject: SUBJECTS[1] as PracticeSubject,
  total: 6538,
  levels: [
    { id: 1, code: 'D1', name: 'Darjah 1', count: 2734 },
    { id: 2, code: 'D2', name: 'Darjah 2', count: 2129 },
  ],
  difficultyStats: { '1': 1340, '2': 2130, '3': 2511, '4': 557, '5': 0 },
  difficultyByLevel: {
    '1': { '1': 558, '2': 695, '3': 1402, '4': 79, '5': 0 },
    '2': { '1': 278, '2': 635, '3': 780, '4': 436, '5': 0 },
  },
  subjectiveCounts: {},
  trial: { active: false, used: 0, limit: 50, remaining: 50 },
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string, withPricing = true): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice', component: PracticeListPage },
      { path: '/practice/:code', component: PracticeConfigPage },
      { path: '/practice/:code/quiz', component: PracticeQuizPage },
      ...(withPricing ? [{ path: '/pricing', component: { template: '<div />' } }] : []),
      { path: '/:rest(.*)*', name: withPricing ? undefined : 'core.not-found', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  window.scrollTo = vi.fn()
  for (const f of Object.values(api)) f.mockReset()
  topic.get.mockReset()
  outcome.setRouteOutcome.mockReset()
  api.fetchPracticeSubjects.mockResolvedValue({ data: SUBJECTS, meta: {} })
  api.fetchSubjectConfig.mockResolvedValue(MATH)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S2 PracticeListPage', () => {
  it('shows the hero, the chapter banner and one card per subject', async () => {
    const w = await render(PracticeListPage, '/practice')
    expect(t(w, 'practice-title').text()).toBe('Latih Tubi 🎯')
    expect(w.text()).toContain('Pilih subjek dan mula berlatih!')
    const banner = t(w, 'chapter-banner')
    expect(banner.attributes('href')).toBe('/practice/chapter')
    expect(banner.text()).toContain('Mode Baru')
    expect(banner.text()).toContain('Soalan by Chapter')
    expect(banner.text()).toContain(
      'Jawab bab demi bab ikut buku teks dan DSKP. Bab seterusnya terkunci sehingga bab semasa lengkap.',
    )
    const cards = w.findAll('[data-testid^=subject-card-]')
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      '/practice/BM',
      '/practice/MATH',
      '/practice/GEO',
    ])
  })

  it('shows the count with a separator, the core badge, English name and the start button', async () => {
    const w = await render(PracticeListPage, '/practice')
    const math = t(w, 'subject-card-MATH')
    expect(math.get('[data-testid=subject-count]').text()).toBe('13,872 soalan')
    expect(math.get('[data-testid=subject-name]').text()).toBe('Matematik')
    expect(math.text()).toContain('Mathematics')
    expect(math.text()).toContain('Teras')
    expect(t(w, 'subject-card-GEO').find('[data-testid=subject-core]').exists()).toBe(false)
    // D-14 replicated: the button is inside the link with no handler of its own.
    const button = math.get('button[data-testid=subject-start]')
    expect(button.text()).toBe('Mula Latihan')
    expect(button.element.closest('a')).toBe(math.element)
  })

  it('renders an icon for every subject, a book when the subject has none (DV-M05-02)', async () => {
    const w = await render(PracticeListPage, '/practice')
    for (const code of ['BM', 'MATH', 'GEO']) {
      const tile = t(w, `subject-card-${code}`).get('[data-testid=subject-icon]')
      expect(tile.find('svg, span').exists()).toBe(true)
    }
  })

  it('navigates to the subject when a card is clicked', async () => {
    const w = await render(PracticeListPage, '/practice')
    await t(w, 'subject-card-MATH').get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/practice/MATH')
  })

  it('replaces the URL for ?subject= with a known code (FR-M05-33)', async () => {
    await render(PracticeListPage, '/practice?subject=BM')
    expect(router.currentRoute.value.fullPath).toBe('/practice/BM')
  })

  it('keeps the plain list for an unknown subject and ignores ?level= (FR-M05-34)', async () => {
    await render(PracticeListPage, '/practice?subject=XYZ')
    expect(router.currentRoute.value.path).toBe('/practice')
    wrapper?.unmount()
    await render(PracticeListPage, '/practice?level=D3')
    expect(router.currentRoute.value.path).toBe('/practice')
  })

  it('replaces the URL for ?topic_id= through the topic practice code', async () => {
    topic.get.mockResolvedValue({ practiceCode: 'MATH' })
    await render(PracticeListPage, '/practice?topic_id=7')
    expect(router.currentRoute.value.fullPath).toBe('/practice/MATH')
    wrapper?.unmount()
    topic.get.mockRejectedValue(new Error('404'))
    await render(PracticeListPage, '/practice?topic_id=99999')
    expect(router.currentRoute.value.path).toBe('/practice')
  })

  it('shows an error box with a retry when the list fails', async () => {
    api.fetchPracticeSubjects.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render(PracticeListPage, '/practice')
    expect(t(w, 'practice-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w, 'practice-retry').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid^=subject-card-]')).toHaveLength(3)
  })
})

describe('S3 PracticeConfigPage', () => {
  it('opens with "Semua Tahap", Semua, 10 and a ready start link (FR-M05-39…47)', async () => {
    const w = await render(PracticeConfigPage, '/practice/MATH')
    expect(api.fetchSubjectConfig).toHaveBeenCalledWith('MATH', expect.anything())
    expect(t(w, 'config-name').text()).toBe('Matematik')
    expect(t(w, 'config-total').text()).toContain('6,538')
    expect(t(w, 'config-total').text()).toContain('soalan tersedia')
    expect(t(w, 'config-back').attributes('href')).toBe('/practice')
    expect(t(w, 'config-back').text()).toBe('Kembali ke Senarai Subjek')
    expect(t(w, 'level-all').attributes('data-selected')).toBe('true')
    expect(t(w, 'difficulty-all').attributes('data-selected')).toBe('true')
    expect(t(w, 'count-10').attributes('data-selected')).toBe('true')
    expect(t(w, 'summary-level').text()).toBe('Semua Tahap')
    expect(t(w, 'summary-difficulty').text()).toBe('Semua Tahap')
    expect(t(w, 'summary-count').text()).toBe('10')
    expect(t(w, 'summary-available').text()).toBe('6,538')
    expect(t(w, 'config-start').attributes('href')).toBe('/practice/MATH/quiz?count=10')
    expect(t(w, 'config-ready').text()).toContain('Bersedia untuk bermula!')
    expect(w.find('[data-testid=config-insufficient]').exists()).toBe(false)
    expect(w.find('[data-testid=config-trial]').exists()).toBe(false)
    expect(w.find('[data-testid=config-subjective]').exists()).toBe(false)
    expect(t(w, 'config-tips').findAll('li')).toHaveLength(4)
    expect(w.findAll('[data-testid=config-levels] button').map((b) => b.text())).toEqual([
      expect.stringContaining('Semua Tahap'),
      expect.stringContaining('Darjah 1'),
      expect.stringContaining('Darjah 2'),
    ])
  })

  it('updates the summary and the href as the options change', async () => {
    const w = await render(PracticeConfigPage, '/practice/MATH')
    await t(w, 'level-2').trigger('click')
    expect(t(w, 'level-2').attributes('data-selected')).toBe('true')
    expect(t(w, 'summary-level').text()).toBe('Darjah 2')
    expect(t(w, 'summary-available').text()).toBe('2,129')
    // Difficulty counts are now those of Darjah 2.
    expect(t(w, 'difficulty-3').get('[data-testid=difficulty-count]').text()).toBe('780')
    expect(t(w, 'difficulty-all').get('[data-testid=difficulty-count]').text()).toBe('2,129')
    await t(w, 'difficulty-3').trigger('click')
    await t(w, 'count-20').trigger('click')
    expect(t(w, 'summary-difficulty').text()).toBe('Sederhana')
    expect(t(w, 'summary-count').text()).toBe('20')
    expect(t(w, 'summary-available').text()).toBe('780')
    expect(t(w, 'config-start').attributes('href')).toBe(
      '/practice/MATH/quiz?level=2&difficulty=3&count=20',
    )
  })

  it('uses the subject-wide difficulty count without a level', async () => {
    const w = await render(PracticeConfigPage, '/practice/MATH')
    await t(w, 'difficulty-3').trigger('click')
    expect(t(w, 'summary-available').text()).toBe('2,511')
  })

  it('warns and disables the start button when too few questions are available (FR-M05-45)', async () => {
    const w = await render(PracticeConfigPage, '/practice/MATH')
    await t(w, 'difficulty-5').trigger('click')
    expect(t(w, 'summary-available').text()).toBe('0')
    expect(t(w, 'config-insufficient').text()).toContain('Soalan Tidak Mencukupi')
    expect(t(w, 'config-insufficient').text()).toContain(
      'Kurangkan bilangan soalan atau tukar tetapan penapisan.',
    )
    expect(w.find('[data-testid=config-ready]').exists()).toBe(false)
    const start = t(w, 'config-start')
    expect(start.attributes('data-startable')).toBe('false')
    expect(start.attributes('aria-disabled')).toBe('true')
    await start.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/practice/MATH')
  })

  it('starts Q1 with the chosen parameters when the link is clicked', async () => {
    const w = await render(PracticeConfigPage, '/practice/MATH')
    await t(w, 'level-1').trigger('click')
    await t(w, 'config-start').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/practice/MATH/quiz?level=1&count=10')
  })

  it('shows the trial notice for a user in the free trial', async () => {
    api.fetchSubjectConfig.mockResolvedValue({
      ...MATH,
      trial: { active: true, used: 50, limit: 50, remaining: 0 },
    })
    const w = await render(PracticeConfigPage, '/practice/MATH')
    const notice = t(w, 'config-trial')
    expect(notice.text()).toContain('Baki percubaan percuma: 0 soalan lagi.')
    const link = notice.get('a')
    expect(link.text()).toBe('Langgan untuk akses tanpa had')
    expect(link.attributes('href')).toBe('/pricing')
  })

  it('hides the subscribe link while /pricing is not routed (D9 dead link)', async () => {
    api.fetchSubjectConfig.mockResolvedValue({
      ...MATH,
      trial: { active: true, used: 50, limit: 50, remaining: 0 },
    })
    const w = await render(PracticeConfigPage, '/practice/MATH', false)
    const notice = t(w, 'config-trial')
    expect(notice.text()).toContain('Baki percubaan percuma: 0 soalan lagi.')
    expect(notice.find('a').exists()).toBe(false)
  })

  it('shows the subjective link only for a selected level with a count (FR-M05-49)', async () => {
    api.fetchSubjectConfig.mockResolvedValue({ ...MATH, subjectiveCounts: { '1': 4 } })
    const w = await render(PracticeConfigPage, '/practice/MATH')
    expect(w.find('[data-testid=config-subjective]').exists()).toBe(false)
    await t(w, 'level-1').trigger('click')
    const link = t(w, 'config-subjective')
    expect(link.text()).toContain('Latihan Subjektif (4 soalan)')
    expect(link.attributes('href')).toBe('/practice/MATH/subjektif')
    await t(w, 'level-2').trigger('click')
    expect(w.find('[data-testid=config-subjective]').exists()).toBe(false)
  })

  it('shows the global 404 page for an unknown code (FR-M05-48)', async () => {
    api.fetchSubjectConfig.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(PracticeConfigPage, '/practice/XYZ')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })

  it('offers no level buttons for a subject with none (BR-11)', async () => {
    api.fetchSubjectConfig.mockResolvedValue({ ...MATH, total: 0, levels: [] })
    const w = await render(PracticeConfigPage, '/practice/ADDMATH')
    expect(w.findAll('[data-testid=config-levels] button')).toHaveLength(1)
    expect(t(w, 'summary-available').text()).toBe('0')
    expect(t(w, 'config-start').attributes('data-startable')).toBe('false')
  })
})

describe('Q1 PracticeQuizPage', () => {
  const sessionBody = {
    sessionId: 's9',
    mode: 'random',
    subject: { code: 'MATH', name: 'Matematik', color: '#EF4444' },
    questions: [
      {
        id: 1,
        questionText: '1 + 1 = ?',
        textDirection: 'ltr',
        scriptType: 'rumi',
        wrongTimes: 0,
        hasDskp: false,
        contributor: null,
        options: [
          { id: 0, label: 'A', text: '2' },
          { id: 1, label: 'B', text: '3' },
        ],
      },
    ],
  }

  it('starts a random session with the query parameters and shows the subject title', async () => {
    api.startSession.mockResolvedValue(sessionBody)
    const w = await render(PracticeQuizPage, '/practice/MATH/quiz?level=2&difficulty=3&count=15')
    expect(api.startSession).toHaveBeenCalledWith({
      mode: 'random',
      subjectCode: 'MATH',
      levelId: 2,
      difficulty: 3,
      count: 15,
    })
    expect(t(w, 'quiz-title').text()).toBe('Matematik')
    expect(t(w, 'quiz-progress-text').text()).toBe('Soalan 1 daripada 1')
    // No revision chips on Q1 (FR-M05-52).
    expect(w.find('[data-testid=chip-revision]').exists()).toBe(false)
  })

  it('sends only the count when level and difficulty are absent', async () => {
    api.startSession.mockResolvedValue(sessionBody)
    await render(PracticeQuizPage, '/practice/MATH/quiz?count=10')
    expect(api.startSession).toHaveBeenCalledWith({
      mode: 'random',
      subjectCode: 'MATH',
      count: 10,
    })
  })

  it('goes to /pricing when the trial is exhausted (FR-M05-51)', async () => {
    api.startSession.mockRejectedValue(
      new ApiError({
        status: 402,
        code: 'TRIAL_EXHAUSTED',
        message: 'Baki percubaan percuma anda telah habis.',
      }),
    )
    await render(PracticeQuizPage, '/practice/MATH/quiz?count=10')
    expect(router.currentRoute.value.fullPath).toBe('/pricing')
  })

  it('shows the 404 page for an unknown code', async () => {
    api.startSession.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(PracticeQuizPage, '/practice/XYZ/quiz?count=10')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })

  it('"Kembali" returns to S3 of the subject', async () => {
    api.startSession.mockResolvedValue(sessionBody)
    api.checkAnswer.mockResolvedValue({
      isCorrect: true,
      correctOptionId: 0,
      feedback: '',
      explanation: null,
    })
    api.submitSession.mockResolvedValue({
      results: {
        score: 1,
        total: 1,
        gamification: { coinsEarned: 1, streakCount: 1, pointsEarned: 10, totalBalance: 1 },
      },
    })
    const w = await render(PracticeQuizPage, '/practice/MATH/quiz?count=5')
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    await t(w, 'btn-next').trigger('click')
    await flushPromises()
    expect(t(w, 'result-title').text()).toBe('Keputusan Latihan')
    expect(t(w, 'result-back').attributes('href')).toBe('/practice/MATH')
  })
})
