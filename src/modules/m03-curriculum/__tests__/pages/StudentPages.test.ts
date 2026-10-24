// @vitest-environment jsdom
import { formStubs } from '@/test-support/form-stubs'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'

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
    routes: [{ path, component }, { path: '/:rest(.*)', component: STUB }],
  })
  await router.push(url)
  wrapper = mount(component, { props, global: { plugins: [router], components: formStubs } })
  await flushPromises()
  return wrapper
}

const card = (id: number, extra: Partial<TopicCard> = {}): TopicCard => ({
  id,
  gradeLevel: 'DARJAH_1',
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
  grade: 'DARJAH_4',
  gradeOptions: ['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4'],
  subjects: SUBJECTS,
  stats: { done: 1, total: topics.length, progress: 26 },
  topics,
  ...extra,
})

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  vi.mocked(setRouteOutcome).mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TopicsPage (S12)', () => {
  it('renders chips, cards and the +n lagi line; chips keep the other filter', async () => {
    api.fetchTopics.mockResolvedValue({
      data: [card(1, { subtopicCount: 5, subtopicsPreview: ['A', 'B', 'C'] }), card(2, { description: null })],
    })
    const w = await render(TopicsPage, '/topics', '/topics?subject=SAINS&grade_level=DARJAH_1')
    expect(api.fetchTopics.mock.calls[0]?.[0]).toMatchObject({ gradeLevel: 'DARJAH_1', subject: 'SAINS' })
    expect(w.findAll('[data-testid=grade-chip]')).toHaveLength(7)
    expect(w.findAll('[data-testid=subject-chip]')).toHaveLength(8)
    const grades = w.findAll('[data-testid=grade-chip]')
    expect(grades[1]?.attributes('data-active')).toBe('true')
    expect(grades[0]?.attributes('href')).toBe('/topics?subject=SAINS')
    expect(grades[2]?.attributes('href')).toBe('/topics?grade_level=DARJAH_2&subject=SAINS')
    const subjects = w.findAll('[data-testid=subject-chip]')
    expect(subjects[0]?.attributes('data-active')).toBe('false')
    expect(subjects[4]?.attributes('data-active')).toBe('true')
    expect(subjects[2]?.text()).toBe('BAHASA MELAYU')
    expect(subjects[2]?.attributes('href')).toBe('/topics?grade_level=DARJAH_1&subject=BAHASA_MELAYU')
    const cards = w.findAll('[data-testid=topic-card]')
    expect(cards[0]?.attributes('href')).toBe('/topics/1')
    expect(cards[0]?.text()).toContain('5 Subtopik')
    expect(cards[0]?.get('[data-testid=topic-more]').text()).toBe('+2 lagi...')
    expect(cards[1]?.find('[data-testid=topic-description]').exists()).toBe(false)
    expect(cards[1]?.find('[data-testid=topic-more]').exists()).toBe(false)
  })

  it('marks "Semua" chips active without filters and none for non-canonical values', async () => {
    api.fetchTopics.mockResolvedValue({ data: [] })
    const w = await render(TopicsPage, '/topics', '/topics?grade_level=darjah_1')
    expect(w.findAll('[data-testid=grade-chip]').every((c) => c.attributes('data-active') === 'false')).toBe(true)
    expect(w.findAll('[data-testid=subject-chip]')[0]?.attributes('data-active')).toBe('true')
    expect(w.get('[data-testid=topics-empty]').text()).toContain('Tiada topik tersedia buat masa ini.')
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
      'Tahap 1',
      'Tahap 2',
      'Tahap 3',
    ])
    expect(cards[0]?.get('[data-testid=subtopic-bar] [role=progressbar]').attributes('aria-valuenow')).toBe('15')
    expect(cards[0]?.get('[data-testid=subtopic-practice]').attributes('href')).toBe('/practice/MATH')
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
      map([island(1, 'mastered'), island(7, 'started'), island(8, 'unlocked'), island(9, 'locked')]),
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
    expect(pills[0]?.attributes('href')).toBe('/peta-belajar?subject=MATEMATIK&grade=DARJAH_4')
    expect(pills[0]?.attributes('data-active')).toBe('true')
    expect(pills[1]?.attributes('data-active')).toBe('false')
    const chips = w.findAll('[data-testid=map-grade-chip]')
    expect(chips.map((c) => c.text())).toEqual(['Darjah 1', 'Darjah 2', 'Darjah 3', 'Darjah 4'])
    expect(chips[3]?.attributes('data-active')).toBe('true')
    expect(chips[0]?.attributes('href')).toBe('/peta-belajar?subject=MATEMATIK&grade=DARJAH_1')
    const nodes = w.findAll('[data-testid=map-node]')
    expect(nodes.map((n) => n.attributes('data-state'))).toEqual(['mastered', 'started', 'unlocked', 'locked'])
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
    const w = await render(LearningMapPage, '/peta-belajar', '/peta-belajar?subject=ZZZ&grade=DARJAH_1')
    expect(api.fetchLearningMap.mock.calls[0]?.[0]).toMatchObject({ subject: 'ZZZ', grade: 'DARJAH_1' })
    expect(w.get('[data-testid=map-empty]').text()).toContain('Tiada Topik Dijumpai')
    expect(w.get('[data-testid=map-done]').text()).toBe('0/0')
    expect(w.get('[data-testid=map-subtitle]').text()).toContain('Terokai perjalanan Zzz —')
    expect(w.findAll('[data-testid=map-subject-pill]').every((p) => p.attributes('data-active') === 'false')).toBe(true)
    expect(w.find('[data-testid=map-container]').exists()).toBe(false)
  })
})
