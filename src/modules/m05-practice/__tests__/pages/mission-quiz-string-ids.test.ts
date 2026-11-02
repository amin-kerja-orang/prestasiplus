// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { createHttpTransport, installTransport } from '@/api'

import MissionQuizPage from '../../pages/MissionQuizPage.vue'

/**
 * Q5 in http mode: the real client, transport and `QuizRunner`. `GET /api/missions/today` sends the
 * mission id as a string (`id: "3"`), while the route gives a number.
 */

const MISSION = {
  id: '3',
  title: 'Misi Contoh Hari Ini',
  typeLabel: 'Latih Tubi SPM',
  subjectName: 'Matematik',
  questionCount: 5,
  coinsPerCorrect: 1,
  resourceTitle: null,
  resourceUrl: null,
  resourceNote: null,
  status: 'new',
}

const SESSION = {
  sessionId: '00000000-0000-4000-8000-000000000003',
  mode: 'mission',
  subject: { code: 'MATH', name: 'Matematik', color: '#EF4444' },
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

let sent: { method: string; url: string; body: unknown }[] = []
let wrapper: VueWrapper | undefined

async function render(id: string): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }, { path: '/misi-harian/:id', component: MissionQuizPage }],
  })
  await router.push(`/misi-harian/${id}`)
  wrapper = mount(MissionQuizPage, {
    global: { plugins: [router, createPinia()], stubs: { teleport: true } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  sent = []
  vi.stubEnv('VITE_API_MODE', 'http')
  window.scrollTo = vi.fn() as never
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        const method = init?.method ?? 'GET'
        const raw = init?.body as string | undefined
        sent.push({ method, url, body: raw ? JSON.parse(raw) : null })
        const json =
          method === 'GET'
            ? { data: [MISSION], meta: { page: 1, pageSize: 1, totalItems: 1, totalPages: 1, from: 1, to: 1 } }
            : { data: SESSION }
        return Promise.resolve(
          new Response(JSON.stringify(json), {
            status: method === 'GET' ? 200 : 201,
            headers: { 'content-type': 'application/json' },
          }),
        )
      },
    }),
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllEnvs()
})

describe('Q5 MissionQuizPage with string ids from the API', () => {
  it('titles the quiz with the mission whose id is a string, not the subject name', async () => {
    const w = await render('3')
    expect(w.get('[data-testid=quiz-title]').text()).toBe('Misi Contoh Hari Ini')
  })

  it('POST /practice/sessions carries missionId as a string', async () => {
    await render('3')
    const start = sent.find((s) => s.method === 'POST')
    expect(start?.body).toEqual({ mode: 'mission', missionId: '3' })
  })

  it('falls back to the subject name when today has no such mission', async () => {
    const w = await render('4')
    expect(w.get('[data-testid=quiz-title]').text()).toBe('Matematik')
  })
})
