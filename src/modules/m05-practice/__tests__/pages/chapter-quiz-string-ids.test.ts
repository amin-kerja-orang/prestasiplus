// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { createHttpTransport, installTransport } from '@/api'

import ChapterQuizPage from '../../pages/ChapterQuizPage.vue'
import ChapterSubjectPage from '../../pages/ChapterSubjectPage.vue'

/**
 * Soalan by Chapter in http mode: the real client, transport and `QuizRunner`, with bodies shaped as
 * the API returns them (`PracticeReadChapterCard.id`, `levels[].id` and `levelId` are `IdSchema`:
 * strings; the mock uses numbers). Only `fetch` is stubbed, so the assertions are on the wire.
 */

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

const card = (id: string, number: number, name: string) => ({
  id,
  number,
  name,
  total: 12,
  answered: 0,
  correct: 0,
  scorePct: 0,
  remaining: 12,
  state: 'open',
  complete: false,
})

const SUBJECT = { code: 'MATH', name: 'Matematik', color: '#EF4444' }
const LEVELS = [
  { id: '4', name: 'Tingkatan 4', count: 40 },
  { id: '5', name: 'Tingkatan 5', count: 20 },
]
const LEVEL_4 = { subject: SUBJECT, levels: LEVELS, levelId: '4', chapters: [card('7', 1, 'Fungsi')] }
const LEVEL_5 = { subject: SUBJECT, levels: LEVELS, levelId: '5', chapters: [card('9', 1, 'Matriks')] }

const SESSION = {
  sessionId: '00000000-0000-4000-8000-000000000001',
  mode: 'chapter',
  subject: SUBJECT,
  chapter: { id: '7', number: 1, name: 'Fungsi' },
  questions: [
    {
      id: '901',
      questionText: 'Soalan satu',
      textDirection: 'ltr',
      scriptType: 'rumi',
      wrongTimes: 0,
      hasDskp: false,
      contributor: null,
      options: [
        { id: 0, label: 'A', text: 'x' },
        { id: 1, label: 'B', text: 'y' },
      ],
    },
  ],
}

interface Sent {
  method: string
  url: string
  body: unknown
}
let sent: Sent[] = []

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

function answer(url: string, method: string): Response {
  if (method === 'GET') return json(url.includes('levelId=5') ? LEVEL_5 : LEVEL_4)
  if (url.endsWith('/check-answer')) {
    return json({ isCorrect: true, correctOptionId: 0, feedback: '', explanation: null })
  }
  if (url.endsWith('/submit')) {
    return json({
      results: {
        score: 1,
        total: 1,
        gamification: { coinsEarned: 1, streakCount: 1, pointsEarned: 10, totalBalance: 1 },
      },
    })
  }
  return json(SESSION, 201)
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/chapter', component: { template: '<div />' } },
      { path: '/practice/chapter/:code', component: ChapterSubjectPage },
      { path: '/practice/chapter/:code/:chapterId(\\d+)/quiz', component: ChapterQuizPage },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, {
    global: { plugins: [router, createPinia()], stubs: { teleport: true } },
  })
  await flushPromises()
  return wrapper
}

const starts = () => sent.filter((s) => s.method === 'POST' && s.url.endsWith('/practice/sessions'))

beforeEach(() => {
  sent = []
  outcome.setRouteOutcome.mockReset()
  vi.stubEnv('VITE_API_MODE', 'http')
  window.scrollTo = vi.fn() as never
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        const method = init?.method ?? 'GET'
        const raw = init?.body as string | undefined
        sent.push({ method, url, body: raw ? JSON.parse(raw) : null })
        return Promise.resolve(answer(url, method))
      },
    }),
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
})

describe('Q2 ChapterQuizPage with string ids from the API', () => {
  it('opens the quiz of a chapter whose id is a string, not the 404 page', async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/7/quiz?count=5')
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
    expect(w.get('[data-testid=quiz-title]').text()).toBe('Bab 1: Fungsi')
    expect(w.find('[data-testid=quiz-question]').exists()).toBe(true)
  })

  it('POST /practice/sessions carries chapterId as a string', async () => {
    await render(ChapterQuizPage, '/practice/chapter/MATH/7/quiz?count=5')
    expect(starts().map((s) => s.body)).toEqual([{ mode: 'chapter', chapterId: '7', count: 5 }])
  })

  it('finds a chapter of another level, sending that level id back as it came', async () => {
    await render(ChapterQuizPage, '/practice/chapter/MATH/9/quiz?count=5')
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
    expect(sent.filter((s) => s.method === 'GET').map((s) => s.url)).toEqual([
      '/api/practice/chapter-subjects/MATH',
      '/api/practice/chapter-subjects/MATH?levelId=5',
    ])
    expect(starts().map((s) => s.body)).toEqual([{ mode: 'chapter', chapterId: '9', count: 5 }])
  })

  it('still answers the 404 page for a chapter the subject does not have', async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/99/quiz?count=5')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(starts()).toEqual([])
    expect(w.find('[data-testid=quiz-question]').exists()).toBe(false)
  })

  it('runs to the results and links back to the list of the chapter level', async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/7/quiz?count=5')
    await w.get('[data-testid=option-A]').trigger('click')
    await w.get('[data-testid=btn-check]').trigger('click')
    await flushPromises()
    await w.get('[data-testid=btn-next]').trigger('click')
    await flushPromises()
    const check = sent.find((s) => s.url.endsWith('/check-answer'))
    expect(check?.body).toEqual({ questionId: '901', selectedOptionId: 0 })
    const submit = sent.find((s) => s.url.endsWith('/submit'))
    expect((submit?.body as { answers: unknown }).answers).toEqual([
      { questionId: '901', selectedOptionId: 0 },
    ])
    expect(w.findAll('a').map((a) => a.attributes('href'))).toContain(
      '/practice/chapter/MATH?level=4',
    )
  })
})

describe('S5 ChapterSubjectPage with string ids from the API', () => {
  it('links each count of a card to the quiz of that chapter', async () => {
    const w = await render(ChapterSubjectPage, '/practice/chapter/MATH')
    expect(w.get('[data-testid=chapter-count-7-5]').attributes('href')).toBe(
      '/practice/chapter/MATH/7/quiz?count=5',
    )
  })

  it('changes level when the select gives a string id', async () => {
    const w = await render(ChapterSubjectPage, '/practice/chapter/MATH')
    w.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', '5')
    await flushPromises()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/practice/chapter/MATH?level=5')
    expect(sent.at(-1)?.url).toBe('/api/practice/chapter-subjects/MATH?levelId=5')
    expect(w.find('[data-testid=chapter-card-9]').exists()).toBe(true)
  })
})
