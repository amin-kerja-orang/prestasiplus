// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import PaperCoverPage from '../pages/PaperCoverPage.vue'
import { setBijakServerForTests } from '../server/client'
import { BijakServer, MemoryStorage } from '../server/store'

const PAPER = 'mat-k1-2025-a'
const USER = 0 // no signed-in user in this test: the page reads id 0
const T0 = 1_800_000_000_000

let wrapper: VueWrapper | undefined
let clock: { t: number }
let server: BijakServer

const body = (selector: string): HTMLElement | null => document.querySelector(selector)
const settle = async (): Promise<void> => {
  await flushPromises()
  await new Promise((r) => setTimeout(r, 80))
  await flushPromises()
}

async function mountCover(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', component: { template: '<div />' } },
      { path: '/spm/bijak/kertas/:paperId', component: PaperCoverPage },
      {
        name: 'm28.bijak.attempt',
        path: '/spm/bijak/percubaan/:attemptId',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push(`/spm/bijak/kertas/${PAPER}`)
  await router.isReady()
  wrapper = mount(
    { template: '<RouterView />' },
    { global: { plugins: [router, createPinia()] }, attachTo: document.body },
  )
  await settle()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  clock = { t: T0 }
  server = new BijakServer({ storage: new MemoryStorage(), now: () => clock.t, latencyMs: 0 })
  setBijakServerForTests(server)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  setBijakServerForTests(null)
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('PaperCoverPage start controls', () => {
  it('with no open sitting the only start control is "Mula", below the mode choice', async () => {
    const w = await mountCover()
    expect(w.find('[data-testid="cover-hero"] [data-ds="hero-cta"]').exists()).toBe(false)
    expect(w.find('[data-testid="resume"]').exists()).toBe(false)
    expect(w.find('[data-testid="restart"]').exists()).toBe(false)
    const start = w.get('[data-testid="cover-start"]')
    const modes = w.get('[data-testid="mode-choice"]')
    // mode choice comes before the start button in the document
    expect(
      modes.element.compareDocumentPosition(start.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // the instructions come before the mode choice
    expect(
      w.get('[data-testid="instructions"]').element.compareDocumentPosition(modes.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('restart dialog defaults to the open sitting mode and passes the chosen mode', async () => {
    await server.startAttempt(USER, PAPER, 'latihan')
    clock.t = T0 + 120_000 // past the 60 s threshold: the resume block shows
    const w = await mountCover()
    expect(w.find('[data-testid="resume-choice"]').exists()).toBe(true)
    expect(w.find('[data-testid="mode-choice"]').exists()).toBe(false)
    expect(w.find('[data-testid="cover-start"]').exists()).toBe(false)
    const start = vi.spyOn(server, 'startAttempt')

    await w.get('[data-testid="restart"]').trigger('click')
    await settle()
    const radios = [...document.querySelectorAll<HTMLElement>('[role="dialog"] [role="radio"]')]
    expect(radios).toHaveLength(2)
    const checked = (): string | undefined =>
      radios.find((r) => r.getAttribute('aria-checked') === 'true')?.closest('label')
        ?.textContent ?? undefined
    expect(checked()).toContain('Mod Latihan')

    radios.find((r) => r.closest('label')?.textContent?.includes('Mod Peperiksaan'))?.click()
    await settle()
    expect(checked()).toContain('Mod Peperiksaan')

    body('[data-testid="confirm-restart"]')?.click()
    await settle()
    expect(start).toHaveBeenCalledWith(USER, PAPER, 'exam', { restart: true })
  })

  it('a fresh open sitting hides the mode choice, hero resumes and Mula Semula still asks the mode', async () => {
    await server.startAttempt(USER, PAPER, 'latihan')
    clock.t = T0 + 20_000 // still fresh: no resume block
    const w = await mountCover()
    expect(w.find('[data-testid="resume-choice"]').exists()).toBe(false)
    expect(w.find('[data-testid="mode-choice"]').exists()).toBe(false)
    expect(w.find('[data-testid="cover-start"]').exists()).toBe(false)
    expect(w.get('[data-testid="cover-hero"]').text()).toContain('Sambung')
    await w.get('[data-testid="restart"]').trigger('click')
    await settle()
    expect(document.querySelectorAll('[role="dialog"] [role="radio"]')).toHaveLength(2)
  })
})
