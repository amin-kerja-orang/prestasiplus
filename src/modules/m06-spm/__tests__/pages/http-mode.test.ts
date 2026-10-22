// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  DutaRecommendationSchema,
  SpmDatabankSubjectSchema,
  SpmLatihTubiConfigSchema,
  SpmLatihTubiListSchema,
  SpmMockCreatedSchema,
  SpmMockExamViewSchema,
  SpmOverviewSchema,
  SpmSubjektifOverviewSchema,
  SpmTrackingAHubSchema,
  SpmTrackingASubjectResultSchema,
} from '@pp/contract'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component, PropType } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { QuizRunner, type QuizApi, type StartSessionRequest } from '@/modules/m05-practice'

import type {
  DatabankSubject,
  DutaCard,
  LatihTubiConfig,
  LatihTubiList,
  MockExamView,
  MockResult,
  SpmOverview,
  SubjektifOverview,
  TrackingAHub,
  TrackingASubjectResult,
} from '../../api'
import { bahasaHref, subjektifHref } from '../../lib/tracking'
import { LEVEL_OPTIONS, levelOptions, parseLatihTubiQuery, quizHref } from '../../lib/latih-tubi'
import { mockIdPattern, queryId, routeId } from '../../lib/wire-id'
import LatihTubiConfigPage from '../../pages/LatihTubiConfigPage.vue'
import LatihTubiQuizPage from '../../pages/LatihTubiQuizPage.vue'
import MockResultPage from '../../pages/MockResultPage.vue'
import MockRunPage from '../../pages/MockRunPage.vue'

/**
 * AZ-20a: the M06 SPM hub against the real API (BE-41) in http mode. Fixtures are bodies captured
 * from a local API on feature/v2-backend with the PoC seed (trimmed). Mock-mode behaviour is covered
 * by the other M06 tests and stays untouched.
 */

const MOCK_UUID = '6a46860a-d53b-443b-8437-6a0c52570ceb'

const OVERVIEW = {
  stats: { totalQuestions: 483, subjectCount: 25, yearsAvailable: 0, trackingAQuestions: 370 },
  modules: { databank: 483, latihTubi: 483, trackingA: 370, subjektifSets: 3 },
  me: { sessions: 0, avgAccuracy: 0, coins: 0, answered: 0 },
} satisfies SpmOverview

const DATABANK = [
  { code: 'MATH', name: 'Matematik', nameEn: 'Mathematics', icon: 'calculator', color: '#EF4444', databankCount: 49 },
] satisfies DatabankSubject[]

const LATIH_TUBI = {
  teras: [
    { code: 'MATH', name: 'Matematik', nameEn: 'Mathematics', icon: 'calculator', color: '#EF4444', total: 49, targetType: 'spm', targetSize: 40, locked: false },
  ],
  elektif: [
    { code: 'BIO', name: 'Biologi', nameEn: 'Biology', icon: 'leaf', color: '#16A34A', total: 0, targetType: 'spm', targetSize: 40, locked: true },
  ],
} satisfies LatihTubiList

const diff = (a: number, b: number, c: number, d: number, e: number) => ({ '1': a, '2': b, '3': c, '4': d, '5': e })

/** The level ids are the real `education_levels` ids (strings); 104 and 99 are deliberately unordered. */
const CONFIG = {
  code: 'MATH',
  name: 'Matematik',
  icon: 'calculator',
  color: '#EF4444',
  total: 49,
  targetType: null,
  targetSize: null,
  levelCounts: { '104': 25, '99': 24 },
  difficultyStats: diff(12, 12, 12, 12, 1),
  difficultyByLevel: { '99': diff(6, 6, 6, 6, 0), '104': diff(6, 6, 6, 6, 1) },
  countOptions: [5, 10, 20, 30, 40, 50, 60].map((n) => ({ value: n, label: String(n), isTarget: false })),
  defaultCount: 10,
} satisfies LatihTubiConfig

const HUB = {
  objectiveLane: { subjects: 1, sets: 1, questions: 49 },
  bahasaLane: { subjects: 2, sets: 0 },
  readiness: null,
  bahasa: [
    { subjectId: '1', code: 'BM', name: 'Bahasa Melayu', nameEn: 'Malay Language', icon: 'book-open', color: '#3B82F6', sets: 0 },
    { subjectId: '2', code: 'BI', name: 'Bahasa Inggeris', nameEn: 'English Language', icon: 'globe', color: '#8B5CF6', sets: 0 },
  ],
  openSubjects: [
    {
      subjectId: '3', code: 'MATH', name: 'Matematik', nameEn: 'Mathematics', icon: 'calculator', color: '#EF4444',
      readyQuestions: 40, bankBesarSets: 1, bersihSets: 0, targetType: 'spm', targetSize: 40, bankSource: 49, startableSets: 1,
    },
  ],
} satisfies TrackingAHub

const TRACKING_SUBJECT = {
  code: 'MATH', name: 'Matematik', icon: 'calculator', color: '#EF4444', targetType: 'spm', targetSize: 40,
  summary: { bersih: 0, bankBesar: 1, readyQuestions: 40, belumCukup: 0 },
  sets: [{ setNo: 1, status: 'bank_besar', readyCount: 40, bankSource: 49, dskpTagged: 49, dskpTotal: 49 }],
} satisfies TrackingASubjectResult

const REDIRECT = { redirect: '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa' } satisfies TrackingASubjectResult

const SUBJEKTIF = {
  stats: { setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 },
  subjects: [{ subjectId: '3', name: 'Matematik', nameEn: 'Mathematics', group: 'teras', icon: 'calculator', color: '#EF4444', sets: 2 }],
} satisfies SubjektifOverview

const MOCK_VIEW = {
  id: MOCK_UUID,
  subject: 'Matematik',
  paperNumber: 1,
  status: 'in_progress',
  createdAt: '2026-10-21T22:35:22.368+08:00',
  items: [{ no: 1, text: 'Soalan contoh satu.', options: ['15', '11', '18', '10'], maxMarks: 1 }],
} satisfies MockExamView

const DUTA = {
  slug: 'cikgu-contoh-matematik', name: 'Cikgu Contoh Matematik', initials: 'CM', tier: 'bintang',
  tagline: 'Pakar Matematik SPM.', subject: 'Matematik', state: 'Johor', rating: 4.9, active: true,
} satisfies DutaCard

const MOCK_RESULT = {
  id: MOCK_UUID,
  subject: 'Matematik',
  paperNumber: 1,
  score: 1,
  maxScore: 1,
  percent: 100,
  grade: 'A+',
  heroClass: 'good',
  weakTopics: [],
  items: [
    {
      no: 1, questionId: '162', text: 'Soalan contoh satu.', options: ['15', '11', '18', '10'], modelAnswer: 'A',
      studentAnswer: 'A', marks: 1, maxMarks: 1, feedback: 'Tahniah, jawapan anda betul.', topic: 'Ubahan',
    },
  ],
} satisfies MockResult

// ---------------------------------------------------------------------------------------------

const spm = vi.hoisted(() => ({
  fetchLatihTubiConfig: vi.fn(),
  fetchSpmLevels: vi.fn(),
  fetchMock: vi.fn(),
  submitMock: vi.fn(),
  fetchMockResult: vi.fn(),
  fetchDutaRecommendation: vi.fn(),
}))
vi.mock('../../api/spm', () => spm)

/** Stub runner: records its props and starts through `api.start` like the real one. */
vi.mock('@/modules/m05-practice', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const { defineComponent, h } = await import('vue')
  return {
    ...real,
    QuizRunner: defineComponent({
      props: {
        start: { type: Object as PropType<StartSessionRequest>, default: null },
        api: { type: Object as PropType<QuizApi>, default: undefined },
        backUrl: { type: String, default: '' },
      },
      setup() {
        return () => h('div', { 'data-testid': 'runner' })
      },
    }),
  }
})
const Runner = QuizRunner as unknown as Component

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: Component, url: string, path: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubEnv('VITE_API_MODE', 'http')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
  for (const fn of Object.values(spm)) fn.mockReset()
})

describe('BE-41 wire shapes', () => {
  it('the captured real-API bodies parse with the contract schemas', () => {
    expect(SpmOverviewSchema.parse(OVERVIEW)).toEqual(OVERVIEW)
    for (const row of DATABANK) expect(SpmDatabankSubjectSchema.parse(row)).toEqual(row)
    expect(SpmLatihTubiListSchema.parse(LATIH_TUBI)).toEqual(LATIH_TUBI)
    expect(SpmLatihTubiConfigSchema.parse(CONFIG)).toEqual(CONFIG)
    expect(SpmTrackingAHubSchema.parse(HUB)).toEqual(HUB)
    expect(SpmTrackingASubjectResultSchema.parse(TRACKING_SUBJECT)).toEqual(TRACKING_SUBJECT)
    expect(SpmTrackingASubjectResultSchema.parse(REDIRECT)).toEqual(REDIRECT)
    expect(SpmSubjektifOverviewSchema.parse(SUBJEKTIF)).toEqual(SUBJEKTIF)
    expect(SpmMockCreatedSchema.parse({ id: MOCK_UUID })).toEqual({ id: MOCK_UUID })
    expect(SpmMockExamViewSchema.parse(MOCK_VIEW)).toEqual(MOCK_VIEW)
    expect(DutaRecommendationSchema.parse(DUTA)).toEqual(DUTA)
  })

  it('string subject ids build the same structured-track links as the mock ids', () => {
    expect(bahasaHref(HUB.bahasa[0]!.subjectId)).toBe(REDIRECT.redirect)
    expect(subjektifHref(SUBJEKTIF.subjects[0]!.subjectId)).toBe(
      '/latihan-berstruktur?subject_id=3&scope=spm',
    )
  })
})

describe('wire ids', () => {
  it('http mode keeps ids as strings; mock mode keeps numbers', () => {
    expect(routeId(MOCK_UUID)).toBe(MOCK_UUID)
    expect(routeId(['42'])).toBe('42')
    expect(routeId(undefined)).toBe('')
    expect(queryId('570024')).toBe('570024')
    expect(queryId('12345678901234')).toBe('12345678901234')
    expect(queryId('x1')).toBeNull()
    expect(new RegExp(`^${mockIdPattern()}$`).test(MOCK_UUID)).toBe(true)

    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(routeId('42')).toBe(42)
    expect(queryId('570024')).toBe(570024)
    expect(queryId('12345678901234')).toBeNull()
    expect(new RegExp(`^${mockIdPattern()}$`).test(MOCK_UUID)).toBe(false)
    expect(new RegExp(`^${mockIdPattern()}$`).test('7')).toBe(true)
  })
})

const LEVELS = { data: [{ id: '104', grade: 11 }, { id: '99', grade: 10 }, { id: '7', grade: 1 }] }
const counts = (keys: string[]) => ({ levelCounts: Object.fromEntries(keys.map((k) => [k, 5])) })

describe('S4/Q2 level ids', () => {
  it('labels a level from its grade, whatever the key order or count', () => {
    expect(levelOptions(counts(['104', '99']), LEVELS.data)).toEqual([
      { key: '99', label: 'Tingkatan 4' },
      { key: '104', label: 'Tingkatan 5' },
    ])
    expect(levelOptions(counts(['104']), LEVELS.data)).toEqual([{ key: '104', label: 'Tingkatan 5' }])
    expect(levelOptions(counts(['99']), LEVELS.data)).toEqual([{ key: '99', label: 'Tingkatan 4' }])
    expect(levelOptions(counts(['7']), LEVELS.data)).toEqual([])
  })

  it('without the level lookup: two keys by id order, any other count has no options', () => {
    expect(levelOptions(counts([]))).toEqual([])
    expect(levelOptions(counts(['104']))).toEqual([])
    expect(levelOptions(counts(['104', '99']))).toEqual([
      { key: '99', label: 'Tingkatan 4' },
      { key: '104', label: 'Tingkatan 5' },
    ])
    expect(levelOptions(counts(['1', '2', '3']))).toEqual([])
  })

  it('S4 shows the load-error state, not an empty row, when the levels cannot be labelled', async () => {
    spm.fetchSpmLevels.mockResolvedValue({ data: [] })
    spm.fetchLatihTubiConfig.mockResolvedValue({ ...CONFIG, levelCounts: { '104': 25 } })
    const w = await render(LatihTubiConfigPage, '/spm/latih-tubi/MATH', '/spm/latih-tubi/:code')
    expect(w.find('[data-testid=config-levels]').exists()).toBe(false)
    expect(w.find('[data-testid=config-levels-error]').exists()).toBe(true)
  })

  it('S4 labels a single T5 key as Tingkatan 5', async () => {
    spm.fetchSpmLevels.mockResolvedValue(LEVELS)
    spm.fetchLatihTubiConfig.mockResolvedValue({ ...CONFIG, levelCounts: { '104': 25 } })
    const w = await render(LatihTubiConfigPage, '/spm/latih-tubi/MATH', '/spm/latih-tubi/:code')
    expect(w.get('[data-testid=config-levels]').findAll('button').map((b) => b.text())).toEqual([
      'Tingkatan 525 soalan',
    ])
  })

  it('the Tingkatan buttons come from the levelCounts keys in id order (http)', () => {
    expect(levelOptions(CONFIG)).toEqual([
      { key: '99', label: 'Tingkatan 4' },
      { key: '104', label: 'Tingkatan 5' },
    ])
    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(levelOptions(CONFIG)).toBe(LEVEL_OPTIONS)
  })

  it('the Q2 query keeps level and question ids as strings (http)', () => {
    expect(parseLatihTubiQuery({ count: '40', level: '104', difficulty: '4' })).toEqual({
      count: 40,
      levelId: '104',
      difficulty: 4,
      questionId: null,
    })
    expect(parseLatihTubiQuery({ question_id: '162', count: '1' })).toMatchObject({
      questionId: '162',
      count: 1,
    })
    expect(quizHref('MATH', 20, '104', 3)).toBe('/spm/latih-tubi/MATH/quiz?count=20&level=104&difficulty=3')
  })

  it('S4 renders the level buttons and counts from the real level ids', async () => {
    spm.fetchSpmLevels.mockResolvedValue(LEVELS)
    spm.fetchLatihTubiConfig.mockResolvedValue(CONFIG)
    const w = await render(LatihTubiConfigPage, '/spm/latih-tubi/MATH', '/spm/latih-tubi/:code')
    const levels = w.get('[data-testid=config-levels]').findAll('button')
    expect(levels.map((b) => b.text())).toEqual(['Tingkatan 424 soalan', 'Tingkatan 525 soalan'])
    await w.get('[data-testid=level-104]').trigger('click')
    await w.get('[data-testid=difficulty-5]').trigger('click')
    expect(w.get('[data-testid=difficulty-5] [data-testid=difficulty-count]').text()).toBe('1 soalan')
    expect(w.get('[data-testid=config-start]').attributes('href')).toBe(
      '/spm/latih-tubi/MATH/quiz?count=10&level=104&difficulty=5',
    )
  })

  it('Q2 sends levelId and targetQuestionId as strings to M05 (contract IdSchema)', async () => {
    const w = await render(
      LatihTubiQuizPage,
      '/spm/latih-tubi/MATH/quiz?count=10&level=104&difficulty=5',
      '/spm/latih-tubi/:code/quiz',
    )
    const props = (w.getComponent(Runner) as unknown as { props(k: string): unknown }).props('start')
    expect(props).toEqual({ mode: 'latih_tubi', subjectCode: 'MATH', count: 10, levelId: '104', difficulty: 5 })

    wrapper?.unmount()
    const w2 = await render(
      LatihTubiQuizPage,
      '/spm/latih-tubi/MATH/quiz?question_id=162&count=1',
      '/spm/latih-tubi/:code/quiz',
    )
    expect((w2.getComponent(Runner) as unknown as { props(k: string): unknown }).props('start')).toEqual({
      mode: 'latih_tubi',
      subjectCode: 'MATH',
      count: 1,
      targetQuestionId: '162',
    })
  })
})

describe('mock exam uuid ids', () => {
  it('Q4 loads and submits the mock by its uuid', async () => {
    spm.fetchMock.mockResolvedValue(MOCK_VIEW)
    spm.submitMock.mockResolvedValue(MOCK_RESULT)
    const w = await render(MockRunPage, `/spm-mock/${MOCK_UUID}`, `/spm-mock/:id(${mockIdPattern()})`)
    expect(spm.fetchMock).toHaveBeenCalledWith(MOCK_UUID, expect.anything())
    expect(w.find('[data-testid=run-page]').exists()).toBe(true)
  })

  it('S12 loads the result by its uuid', async () => {
    spm.fetchMockResult.mockResolvedValue(MOCK_RESULT)
    spm.fetchDutaRecommendation.mockResolvedValue(null)
    await render(MockResultPage, `/spm-mock/${MOCK_UUID}/result`, `/spm-mock/:id(${mockIdPattern()})/result`)
    expect(spm.fetchMockResult).toHaveBeenCalledWith(MOCK_UUID, expect.anything())
  })
})
