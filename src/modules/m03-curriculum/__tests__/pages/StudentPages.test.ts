// @vitest-environment jsdom
import { formStubs } from '@/test-support/form-stubs'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useSessionStore } from '@/stores/session'

import type {
  LearningMap,
  LearningMapTopic,
  TopicCard,
  TopicDetail,
} from '../../api/student-curriculum'
import LearningMapPage from '../../pages/LearningMapPage.vue'
import TopicDetailPage from '../../pages/TopicDetailPage.vue'
import TopicsPage from '../../pages/TopicsPage.vue'

const api = vi.hoisted(() => ({
  fetchTopics: vi.fn(),
  fetchTopic: vi.fn(),
  fetchLearningMap: vi.fn(),
}))
vi.mock('../../api/student-curriculum', () => api)
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: vi.fn(),
}))

let wrapper: VueWrapper | null = null
const STUB = { template: '<div />' }

async function render(component: object, path: string, url: string, props = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/:rest(.*)', component: STUB },
    ],
  })
  await router.push(url)
  wrapper = mount(component, { props, global: { plugins: [router], components: formStubs } })
  await flushPromises()
  return wrapper
}

const card = (id: number, extra: Partial<TopicCard> = {}): TopicCard => ({
  id,
  gradeLevel: 'TINGKATAN_4',
  subject: 'MATEMATIK',
  subjectLabel: 'MATEMATIK',
  name: `Topik ${String(id)}`,
  description: 'Penerangan',
  subtopicCount: 2,
  subtopicsPreview: ['A', 'B'],
  ...extra,
})

const SUBJECTS = [
  { code: 'MATEMATIK', label: 'Matematik', emoji: '🔢', color: '#3B82F6' },
  { code: 'SAINS', label: 'Sains', emoji: '🔬', color: '#F59E0B' },
]

const island = (id: number, state: LearningMapTopic['state']): LearningMapTopic => ({
  id,
  name: `Pulau ${String(id)}`,
  icon: '🔢',
  state,
  progress: state === 'locked' ? 0 : 40,
  sessions: 2,
  questionsAnswered: 7,
  practiceUrl: state === 'locked' ? null : `/practice?topic_id=${String(id)}`,
})

const map = (topics: LearningMapTopic[], extra: Partial<LearningMap> = {}): LearningMap => ({
  subject: 'MATEMATIK',
  subjectLabel: 'Matematik',
  grade: 'TINGKATAN_4',
  gradeOptions: ['TINGKATAN_4', 'TINGKATAN_5'],
  subjects: SUBJECTS,
  stats: { done: 1, total: topics.length, progress: 26 },
  topics,
  ...extra,
})

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  vi.mocked(setRouteOutcome).mockReset()
})
/** A logged-in student of the given form (`UserMe.grade`: 10 = Tingkatan 4, 11 = Tingkatan 5). */
function loginStudent(grade: number | null) {
  useSessionStore().setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id: 2, role: 'student', grade, landingPath: '/dashboard' } as never,
  })
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TopicsPage (S12)', () => {
  it('renders Tingkatan chips, cards and the +n lagi line; chips keep the other filter', async () => {
    api.fetchTopics.mockResolvedValue({
      data: [
        card(1, { subtopicCount: 5, subtopicsPreview: ['A', 'B', 'C'] }),
        card(2, { description: null }),
      ],
    })
    const w = await render(TopicsPage, '/topics', '/topics?subject=SAINS&grade_level=TINGKATAN_5')
    expect(api.fetchTopics.mock.calls[0]?.[0]).toMatchObject({
      gradeLevel: 'TINGKATAN_5',
      subject: 'SAINS',
    })
    const grades = w.findAll('[data-testid=grade-chip]')
    expect(grades.map((c) => c.text())).toEqual(['Semua Tingkatan', 'Tingkatan 4', 'Tingkatan 5'])
    expect(w.text()).not.toContain('Darjah')
    expect(w.get('[data-testid=grade-chips]').attributes('aria-label')).toBe('Tingkatan')
    expect(w.findAll('[data-testid=subject-chip]')).toHaveLength(8)
    expect(grades.map((c) => c.attributes('data-active'))).toEqual(['false', 'false', 'true'])
    expect(grades[0]?.attributes('href')).toBe('/topics?grade_level=SEMUA&subject=SAINS')
    expect(grades[1]?.attributes('href')).toBe('/topics?grade_level=TINGKATAN_4&subject=SAINS')
    const subjects = w.findAll('[data-testid=subject-chip]')
    expect(subjects[0]?.attributes('data-active')).toBe('false')
    expect(subjects[4]?.attributes('data-active')).toBe('true')
    expect(subjects[2]?.text()).toBe('BAHASA MELAYU')
    expect(subjects[2]?.attributes('href')).toBe(
      '/topics?grade_level=TINGKATAN_5&subject=BAHASA_MELAYU',
    )
    const cards = w.findAll('[data-testid=topic-card]')
    expect(cards[0]?.attributes('href')).toBe('/topics/1')
    expect(cards[0]?.text()).toContain('5 Subtopik')
    expect(cards[0]?.get('[data-testid=topic-more]').text()).toBe('+2 lagi...')
    expect(cards[1]?.find('[data-testid=topic-description]').exists()).toBe(false)
    expect(cards[1]?.find('[data-testid=topic-more]').exists()).toBe(false)
  })

  it('opens on Tingkatan 4 without a grade in the URL (guest or form other than 4/5)', async () => {
    api.fetchTopics.mockResolvedValue({ data: [] })
    const w = await render(TopicsPage, '/topics', '/topics')
    expect(api.fetchTopics.mock.calls[0]?.[0]).toMatchObject({
      gradeLevel: 'TINGKATAN_4',
      subject: null,
    })
    expect(w.findAll('[data-testid=grade-chip]').map((c) => c.attributes('data-active'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(w.findAll('[data-testid=subject-chip]')[0]?.attributes('data-active')).toBe('true')
    expect(w.get('[data-testid=topics-empty]').text()).toContain(
      'Tiada topik tersedia buat masa ini.',
    )
  })

  it('opens on the student form: Tingkatan 5 for grade 11, Tingkatan 4 for grade 10 or a Darjah grade', async () => {
    api.fetchTopics.mockResolvedValue({ data: [] })
    for (const [grade, expected] of [
      [11, 'TINGKATAN_5'],
      [10, 'TINGKATAN_4'],
      [4, 'TINGKATAN_4'],
      [null, 'TINGKATAN_4'],
    ] as const) {
      api.fetchTopics.mockClear()
      loginStudent(grade)
      await render(TopicsPage, '/topics', '/topics')
      expect(api.fetchTopics.mock.calls[0]?.[0], String(grade)).toMatchObject({
        gradeLevel: expected,
      })
      wrapper?.unmount()
      wrapper = null
    }
  })

  it('"Semua Tingkatan" asks for all grades (no grade filter) and is the active chip', async () => {
    api.fetchTopics.mockResolvedValue({ data: [] })
    loginStudent(11)
    const w = await render(TopicsPage, '/topics', '/topics?grade_level=SEMUA')
    expect(api.fetchTopics.mock.calls[0]?.[0]).toMatchObject({ gradeLevel: null })
    expect(w.findAll('[data-testid=grade-chip]').map((c) => c.attributes('data-active'))).toEqual([
      'true',
      'false',
      'false',
    ])
  })

  it('never requests a Darjah or other out-of-scope grade from an old link: falls back to the form', async () => {
    api.fetchTopics.mockResolvedValue({ data: [] })
    for (const raw of ['DARJAH_1', 'darjah_1', 'TINGKATAN_1', 'xyz']) {
      api.fetchTopics.mockClear()
      await render(TopicsPage, '/topics', `/topics?grade_level=${raw}`)
      expect(api.fetchTopics.mock.calls[0]?.[0], raw).toMatchObject({ gradeLevel: 'TINGKATAN_4' })
      wrapper?.unmount()
      wrapper = null
    }
  })

  it('accepts a lower-case Tingkatan code in the URL', async () => {
    api.fetchTopics.mockResolvedValue({ data: [] })
    await render(TopicsPage, '/topics', '/topics?grade_level=tingkatan_5')
    expect(api.fetchTopics.mock.calls[0]?.[0]).toMatchObject({ gradeLevel: 'TINGKATAN_5' })
  })

  it('shows the placeholder error box when the request fails', async () => {
    api.fetchTopics.mockRejectedValue(new Error('x'))
    const w = await render(TopicsPage, '/topics', '/topics')
    expect(w.text()).toContain('Ralat memuatkan data. Sila cuba semula.')
  })
})

describe('TopicDetailPage (S13)', () => {
  const detail = (extra: Partial<TopicDetail> = {}): TopicDetail => ({
    id: 7,
    gradeLevel: 'DARJAH_1',
    subject: 'MATEMATIK',
    subjectLabel: 'MATEMATIK',
    practiceCode: 'MATH',
    name: 'Nombor Bulat',
    description: 'Huraian',
    icon: null,
    sequence: 2,
    subtopics: [
      { id: 1, name: 'Membilang', description: null, progress: 15 },
      { id: 2, name: 'Menulis', description: 'Desc', progress: 15 },
    ],
    progress: { questionsAnswered: 7, progress: 15 },
    ...extra,
  })

  it('renders hero, stats, subtopic cards and the practice links', async () => {
    api.fetchTopic.mockResolvedValue(detail())
    const w = await render(TopicDetailPage, '/topics/:id', '/topics/7', { id: 7 })
    expect(w.get('[data-testid=topic-back]').attributes('href')).toBe('/topics')
    expect(w.get('[data-testid=topic-hero]').text()).toContain('Nombor Bulat')
    expect(w.get('[data-testid=stat-subtopik]').text()).toBe('2')
    expect(w.get('[data-testid=stat-dijawab]').text()).toBe('7')
    expect(w.get('[data-testid=stat-kemajuan]').text()).toBe('15%')
    const cards = w.findAll('[data-testid=subtopic-card]')
    expect(cards).toHaveLength(2)
    expect(cards[1]?.get('[data-testid=subtopic-number]').text()).toBe('2')
    expect(cards[0]?.findAll('[data-testid=subtopic-badge]').map((b) => b.text())).toEqual([
      'Level 1',
      'Level 2',
      'Level 3',
    ])
    expect(
      cards[0]?.get('[data-testid=subtopic-bar] [role=progressbar]').attributes('aria-valuenow'),
    ).toBe('15')
    expect(cards[0]?.get('[data-testid=subtopic-practice]').attributes('href')).toBe(
      '/practice/MATH',
    )
    expect(cards[0]?.find('[data-testid=subtopic-description]').exists()).toBe(false)
  })

  it('omits the hero description when null', async () => {
    api.fetchTopic.mockResolvedValue(detail({ description: null }))
    const w = await render(TopicDetailPage, '/topics/:id', '/topics/7', { id: 7 })
    expect(w.find('[data-testid=topic-hero-description]').exists()).toBe(false)
  })

  it('raises the in-place 404 for an unknown topic', async () => {
    api.fetchTopic.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    const w = await render(TopicDetailPage, '/topics/:id', '/topics/99999', { id: 99999 })
    expect(setRouteOutcome).toHaveBeenCalledWith(404)
    expect(w.find('[data-testid=topic-hero]').exists()).toBe(false)
  })
})

describe('LearningMapPage (S14)', () => {
  it('renders hero, selectors and islands by state', async () => {
    api.fetchLearningMap.mockResolvedValue(
      map([
        island(1, 'mastered'),
        island(7, 'started'),
        island(8, 'unlocked'),
        island(9, 'locked'),
      ]),
    )
    const w = await render(LearningMapPage, '/peta-belajar', '/peta-belajar')
    expect(w.get('[data-testid=map-subtitle]').text()).toBe(
      'Terokai perjalanan Matematik — takluki setiap pulau! 🏝️',
    )
    expect(w.get('[data-testid=map-done]').text()).toBe('1/4')
    expect(w.get('[data-testid=map-progress]').text()).toBe('26%')
    expect(w.get('[data-testid=map-bar] [role=progressbar]').attributes('aria-valuenow')).toBe('26')
    const pills = w.findAll('[data-testid=map-subject-pill]')
    expect(pills[0]?.text()).toBe('🔢 Matematik')
    expect(pills[0]?.attributes('href')).toBe('/peta-belajar?subject=MATEMATIK&grade=TINGKATAN_4')
    expect(pills[0]?.attributes('data-active')).toBe('true')
    expect(pills[1]?.attributes('data-active')).toBe('false')
    const chips = w.findAll('[data-testid=map-grade-chip]')
    expect(chips.map((c) => c.text())).toEqual(['Tingkatan 4', 'Tingkatan 5'])
    expect(chips.map((c) => c.attributes('data-active'))).toEqual(['true', 'false'])
    expect(chips[1]?.attributes('href')).toBe('/peta-belajar?subject=MATEMATIK&grade=TINGKATAN_5')
    expect(w.get('[data-testid=map-grade-chips]').attributes('aria-label')).toBe('Tingkatan')
    expect(w.text()).not.toContain('Darjah')
    expect(api.fetchLearningMap.mock.calls[0]?.[0]).toMatchObject({
      subject: null,
      grade: 'TINGKATAN_4',
    })
    const nodes = w.findAll('[data-testid=map-node]')
    expect(nodes.map((n) => n.attributes('data-state'))).toEqual([
      'mastered',
      'started',
      'unlocked',
      'locked',
    ])
    const labels = w.findAll('[data-testid=island-label]').map((l) => l.text())
    expect(labels).toEqual(['⭐ DIKUASAI', '📘 SEDANG BELAJAR', '🎯 BUKA', '🔒 TERKUNCI'])
    const islands = w.findAll('[data-testid=island]')
    expect(islands[0]?.attributes('href')).toBe('/practice?topic_id=1')
    expect(islands[3]?.element.tagName).toBe('DIV')
    expect(islands[3]?.attributes('href')).toBeUndefined()
    expect(islands[3]?.text()).toContain('Selesaikan topik sebelumnya dulu')
    expect(islands[2]?.text()).toContain('2 sesi · 7 soalan dijawab')
  })

  it('shows the empty card and 0/0 for a map without topics', async () => {
    api.fetchLearningMap.mockResolvedValue(
      map([], { subject: 'ZZZ', subjectLabel: 'Zzz', stats: { done: 0, total: 0, progress: 0 } }),
    )
    const w = await render(
      LearningMapPage,
      '/peta-belajar',
      '/peta-belajar?subject=ZZZ&grade=TINGKATAN_5',
    )
    expect(api.fetchLearningMap.mock.calls[0]?.[0]).toMatchObject({
      subject: 'ZZZ',
      grade: 'TINGKATAN_5',
    })
    expect(w.get('[data-testid=map-empty]').text()).toContain('Tiada Topik Dijumpai')
    expect(w.get('[data-testid=map-empty]').text()).toContain('tingkatan yang lain')
    expect(w.get('[data-testid=map-done]').text()).toBe('0/0')
    expect(w.get('[data-testid=map-subtitle]').text()).toContain('Terokai perjalanan Zzz —')
    expect(
      w
        .findAll('[data-testid=map-subject-pill]')
        .every((p) => p.attributes('data-active') === 'false'),
    ).toBe(true)
    expect(w.find('[data-testid=map-container]').exists()).toBe(false)
  })

  it('asks for the student form by default: Tingkatan 5 for grade 11, else Tingkatan 4', async () => {
    api.fetchLearningMap.mockResolvedValue(map([island(1, 'unlocked')]))
    for (const [grade, expected] of [
      [11, 'TINGKATAN_5'],
      [10, 'TINGKATAN_4'],
      [3, 'TINGKATAN_4'],
    ] as const) {
      api.fetchLearningMap.mockClear()
      loginStudent(grade)
      await render(LearningMapPage, '/peta-belajar', '/peta-belajar')
      expect(api.fetchLearningMap.mock.calls[0]?.[0], String(grade)).toMatchObject({
        grade: expected,
      })
      wrapper?.unmount()
      wrapper = null
    }
  })

  it('opens on the pupil own level (a T5 pupil on Tingkatan 5, no recognised form on Tingkatan 4) with that tab marked', async () => {
    for (const [grade, expected, active] of [
      [11, 'TINGKATAN_5', ['false', 'true']],
      [10, 'TINGKATAN_4', ['true', 'false']],
      [null, 'TINGKATAN_4', ['true', 'false']],
    ] as const) {
      api.fetchLearningMap.mockResolvedValue(map([island(1, 'unlocked')], { grade: expected }))
      loginStudent(grade)
      const w = await render(LearningMapPage, '/peta-belajar', '/peta-belajar')
      expect(api.fetchLearningMap.mock.calls.at(-1)?.[0], String(grade)).toMatchObject({
        grade: expected,
      })
      const chips = w.findAll('[data-testid=map-grade-chip]')
      expect(
        chips.map((c) => c.attributes('data-active')),
        String(grade),
      ).toEqual(active)
      wrapper?.unmount()
      wrapper = null
    }
  })

  it('a Tingkatan 1 pupil gets the lower-form notice, never the empty topic card (D54)', async () => {
    api.fetchLearningMap.mockClear()
    loginStudent(7)
    const w = await render(LearningMapPage, '/peta-belajar', '/peta-belajar')
    expect(w.find('[data-testid=lower-form-empty]').exists()).toBe(true)
    expect(w.find('[data-testid=map-empty]').exists()).toBe(false)
  })

  it('never leaves the tabs unselected: an unrecognised served grade falls back to the requested tab', async () => {
    api.fetchLearningMap.mockResolvedValue(map([], { grade: 'T5' }))
    loginStudent(11)
    const w = await render(LearningMapPage, '/peta-belajar', '/peta-belajar')
    const chips = w.findAll('[data-testid=map-grade-chip]')
    expect(chips.map((c) => c.attributes('data-active'))).toEqual(['false', 'true'])
  })

  it('an old Darjah link asks for the student form, never a Darjah', async () => {
    api.fetchLearningMap.mockResolvedValue(map([island(1, 'unlocked')]))
    loginStudent(11)
    await render(LearningMapPage, '/peta-belajar', '/peta-belajar?subject=SAINS&grade=DARJAH_2')
    expect(api.fetchLearningMap.mock.calls[0]?.[0]).toMatchObject({
      subject: 'SAINS',
      grade: 'TINGKATAN_5',
    })
  })
})
