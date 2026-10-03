/* eslint-disable vue/one-component-per-file, vue/require-default-prop -- minimal stub components for host tests */
// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import MissionQuizPage from '../../pages/MissionQuizPage.vue'
import QuestionSetQuizPage from '../../pages/QuestionSetQuizPage.vue'
import RemedialQuizPage from '../../pages/RemedialQuizPage.vue'

const api = vi.hoisted(() => ({ fetchTodayMissions: vi.fn(), fetchRemedialPreview: vi.fn() }))
vi.mock('../../api/practice', () => api)
const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))
const session = vi.hoisted(() => ({ role: { value: 'student' } }))
vi.mock('@/composables', async (orig) => ({
  ...(await orig<typeof import('@/composables')>()),
  useSession: () => ({ role: session.role }),
}))

vi.mock('../../components/quiz/QuizRunner.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'QuizRunner',
      props: {
        start: Object,
        headerTitle: [String, Function],
        backUrl: String,
        hideRetry: Boolean,
        retry: String,
        report: Object,
      },
      setup: () => () => h('div', { 'data-testid': 'runner' }),
    }),
  }
})
vi.mock('../../components/remedial/RemedialPreview.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'RemedialPreview',
      props: { id: Number },
      setup: () => () => h('div', { 'data-testid': 'preview' }),
    }),
  }
})
const RUNNER = { name: 'QuizRunner' }
const PREVIEW = { name: 'RemedialPreview' }

async function mountAt(component: unknown, path: string, url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path, component: component as never }],
  })
  await router.push(url)
  const w = mount(component as never, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  api.fetchTodayMissions.mockReset()
  api.fetchRemedialPreview.mockReset()
  outcome.setRouteOutcome.mockReset()
  session.role.value = 'student'
})

describe('Q4 RemedialQuizPage', () => {
  it('a student runs the quiz (hide-retry, back to S13) and never loads the preview', async () => {
    const w = await mountAt(RemedialQuizPage, '/remedial/:id', '/remedial/7601')
    const r = w.getComponent(RUNNER)
    expect(r.props('start')).toEqual({ mode: 'remedial', remedialTestId: 7601 })
    expect(r.props('backUrl')).toBe('/remedial/saya')
    expect(r.props('hideRetry')).toBe(true)
    expect(w.find('[data-testid=preview]').exists()).toBe(false)
    expect(api.fetchRemedialPreview).not.toHaveBeenCalled()
  })

  it.each(['teacher', 'admin'])('%s gets the preview, not the runner', async (role) => {
    session.role.value = role
    const w = await mountAt(RemedialQuizPage, '/remedial/:id', '/remedial/7601')
    expect(w.getComponent(PREVIEW).props('id')).toBe(7601)
    expect(w.findComponent(RUNNER).exists()).toBe(false)
  })

  it('a malformed id is the 404 page', async () => {
    const w = await mountAt(RemedialQuizPage, '/remedial/:id', '/remedial/abc')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(w.findComponent(RUNNER).exists()).toBe(false)
  })
})

describe('Q5 MissionQuizPage', () => {
  it('passes start, hide-retry and back-url; the title is the mission title', async () => {
    api.fetchTodayMissions.mockResolvedValue({ data: [{ id: 7101, title: 'Misi A' }], meta: {} })
    const w = await mountAt(MissionQuizPage, '/misi-harian/:id', '/misi-harian/7101')
    const r = w.getComponent(RUNNER)
    expect(r.props('start')).toEqual({ mode: 'mission', missionId: 7101 })
    expect(r.props('hideRetry')).toBe(true)
    expect(r.props('backUrl')).toBe('/misi-harian')
    const title = r.props('headerTitle') as (s: unknown) => string
    expect(title({ subject: { name: 'Matematik' } })).toBe('Misi A')
  })

  it('falls back to the subject name when the mission is not in the list', async () => {
    api.fetchTodayMissions.mockResolvedValue({ data: [], meta: {} })
    const w = await mountAt(MissionQuizPage, '/misi-harian/:id', '/misi-harian/7101')
    const title = w.getComponent(RUNNER).props('headerTitle') as (s: unknown) => string
    expect(title({ subject: { name: 'Matematik' } })).toBe('Matematik')
    expect(title({ subject: null })).toBe('')
  })

  it('a malformed id is the 404 page and loads nothing', async () => {
    await mountAt(MissionQuizPage, '/misi-harian/:id', '/misi-harian/0')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(api.fetchTodayMissions).not.toHaveBeenCalled()
  })
})

describe('Q6 QuestionSetQuizPage', () => {
  it('passes start and back-url, and does not hide the retry button', async () => {
    const w = await mountAt(
      QuestionSetQuizPage,
      '/set-soalan-saya/:id/jawab',
      '/set-soalan-saya/7402/jawab',
    )
    const r = w.getComponent(RUNNER)
    expect(r.props('start')).toEqual({ mode: 'question_set', questionSetId: 7402 })
    expect(r.props('backUrl')).toBe('/set-soalan-saya')
    expect(r.props('hideRetry')).toBeFalsy()
    expect(r.props('headerTitle')).toBe('Set Soalan Guru')
  })

  it('a malformed id is the 404 page', async () => {
    const w = await mountAt(
      QuestionSetQuizPage,
      '/set-soalan-saya/:id/jawab',
      '/set-soalan-saya/x/jawab',
    )
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(w.findComponent(RUNNER).exists()).toBe(false)
  })
})
