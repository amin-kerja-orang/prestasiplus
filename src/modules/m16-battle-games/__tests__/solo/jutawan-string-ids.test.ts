// @vitest-environment jsdom
/**
 * Jutawan start with the real client and transport: `GamesJutawanStartRequest.subject` is an `IdSchema`
 * string on the real API (a number is 422 "Subjek tidak sah."), and the mock parses a number.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { createHttpTransport, installTransport } from '@/api'

import JutawanMainPage from '../../pages/JutawanMainPage.vue'

const START = {
  sessionId: '00000000-0000-4000-8000-000000000002',
  index: 1,
  lifelines: 3,
  question: {
    id: '901',
    text: 'Soalan satu',
    options: [
      { id: 0, label: 'A', text: 'x' },
      { id: 1, label: 'B', text: 'y' },
    ],
  },
}

let sent: { url: string; body: unknown }[] = []
let wrapper: VueWrapper | undefined

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/permainan/jutawan/main?subject=3&darjah=10')
  wrapper = mount(JutawanMainPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  sent = []
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        sent.push({ url, body: JSON.parse((init?.body as string | undefined) ?? 'null') })
        const body = (sent.at(-1)?.body ?? {}) as { subject?: unknown }
        // As the API: a subject that is not a string is refused.
        const refused = url.endsWith('/start') && typeof body.subject !== 'string'
        const isMock = import.meta.env.VITE_API_MODE !== 'http'
        const res =
          refused && !isMock
            ? { status: 422, json: { error: { code: 'VALIDATION_ERROR', message: 'Subjek tidak sah.' } } }
            : url.endsWith('/start')
              ? { status: 200, json: { data: START } }
              : { status: 200, json: { data: { correct: true, level: 1, next: START.question } } }
        return Promise.resolve(
          new Response(JSON.stringify(res.json), {
            status: res.status,
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

describe('JutawanMainPage start', () => {
  it('http mode: sends subject as a string and the game opens', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const w = await render()
    expect(sent[0]).toEqual({
      url: '/api/games/jutawan/start',
      body: { subject: '3', darjah: 10 },
    })
    expect(w.text()).not.toContain('Subjek tidak sah.')
    expect(w.find('[data-testid="jutawan-question"]').exists()).toBe(true)
  })

  it('http mode: the answer sends the question id as it came', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const w = await render()
    await w.get('[data-testid="jutawan-option"]').trigger('click')
    await flushPromises()
    expect(sent.at(-1)?.body).toEqual({ questionId: '901', optionId: 0 })
  })

  it('mock mode: subject stays a number', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await render()
    expect(sent[0]?.body).toEqual({ subject: 3, darjah: 10 })
  })
})
