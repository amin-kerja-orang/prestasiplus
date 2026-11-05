// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setUnauthorizedRedirect, useSessionStore } from '@/stores/session'

import AttemptPage from '../pages/AttemptPage.vue'

/** R1-MUR-13 field table: B-051 and the choose-N refusal; 46 section 2.6: ERR-NET-01, ERR-NET-03, ERR-AUTH-01. */
const server = vi.hoisted(() => ({
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  submit: vi.fn(),
  serverNow: () => Date.now(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server, browserStorage: () => window.localStorage }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
let wrapper: VueWrapper | null = null

const MCQ = { mcq: { options: [{ id: 'a', text: 'Pilihan A' }, { id: 'b', text: 'Pilihan B' }] } }
const view = (mode: 'exam' | 'latihan', choose = false) => ({
  attempt: {
    id: 'a1', paperId: 'p1', title: 'Set', code: '1449/1', mode, status: 'in_progress', startedAt: Date.now(),
    deadline: mode === 'exam' ? Date.now() + 3_600_000 : null, answers: {}, flags: [], picks: choose ? { s1: ['q2'] } : {}, position: 0, checked: [],
  },
  sections: [{ id: 's1', label: 'A', rule: choose ? { type: 'choose', n: 1 } : { type: 'all' }, questionIds: ['q1', 'q2'], marks: 2, effectiveMarks: 1 }],
  groups: [],
  checks: [],
  questions: ['q1', 'q2'].map((id, i) => ({ id, number: i + 1, sectionId: 's1', topic: 'T', formOrigin: 'T4', stem: 'Soalan?', marks: 1, ...MCQ })),
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  server.saveAnswers.mockReset()
  server.saveAnswers.mockResolvedValue({ closed: false })
  window.localStorage.clear()
  window.sessionStorage.clear()
  Element.prototype.scrollTo = () => undefined
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setUnauthorizedRedirect(null)
})

async function render(): Promise<void> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
      { path: '/a/:attemptId', name: 'm28.bijak.attempt', component: stub },
    ],
  })
  await router.push('/a/a1')
  wrapper = mount(AttemptPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

async function openExit(): Promise<void> {
  ;[...document.body.querySelectorAll<HTMLElement>('button')].find((b) => b.getAttribute('aria-label') === 'Keluar daripada percubaan')!.click()
  await flushPromises()
}

describe('dialog B-051', () => {
  it('exam: the exact title, body and buttons', async () => {
    server.getAttemptView.mockResolvedValue(view('exam'))
    await render()
    await openExit()
    const dialog = q('[role=dialog][data-state=open]')!
    expect(dialog.textContent).toContain('Keluar daripada percubaan?')
    expect(dialog.textContent).toContain('Jawapan anda disimpan dan masa terus berjalan.')
    expect(q('[data-testid=exit-stay]')?.textContent?.trim()).toBe('Kekal')
    expect(q('[data-testid=confirm-exit]')?.textContent?.trim()).toBe('Keluar')
  })

  it('latihan: the shorter body', async () => {
    server.getAttemptView.mockResolvedValue(view('latihan'))
    await render()
    await openExit()
    const dialog = q('[role=dialog][data-state=open]')!
    expect(dialog.textContent).toContain('Jawapan anda disimpan.')
    expect(dialog.textContent).not.toContain('masa terus berjalan')
  })
})

describe('choose-N refusal', () => {
  it('a full section says the exact line on a question not picked', async () => {
    server.getAttemptView.mockResolvedValue(view('exam', true))
    await render()
    expect(q('[data-testid=choose-hint]')?.textContent?.trim()).toBe('Anda hanya boleh memilih 1 soalan dalam bahagian ini.')
  })
})

describe('offline banner (ERR-NET-01, ERR-NET-03)', () => {
  it('shows the exact text while offline, turns to the recovery text for 3 s when the save goes through', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    server.getAttemptView.mockResolvedValue(view('exam'))
    await render()
    expect(q('[data-testid=offline-banner]')).toBeNull()
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(q('[data-testid=offline-banner]')?.textContent?.trim()).toBe('Anda luar talian. Jawapan disimpan pada peranti ini dan akan dihantar apabila sambungan pulih.')
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(10)
    await flushPromises()
    expect(q('[data-testid=offline-banner]')).toBeNull()
    expect(q('[data-testid=reconnected-banner]')?.textContent?.trim()).toBe('Sambungan pulih. Jawapan telah disimpan.')
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(q('[data-testid=reconnected-banner]')).toBeNull()
  })
})

describe('offline banner, a save already done', () => {
  it('ends on "online" also when the save status was already "disimpan"', async () => {
    server.getAttemptView.mockResolvedValue(view('exam'))
    await render()
    q('[data-testid=option-a]')!.click()
    await flushPromises()
    window.dispatchEvent(new Event('online')) // flush now: the status settles on "disimpan" with the connection up
    await flushPromises()
    expect(q('[data-testid=save-status]')?.textContent).toContain('disimpan')
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(q('[data-testid=offline-banner]')).not.toBeNull()
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(q('[data-testid=offline-banner]')).toBeNull()
    expect(q('[data-testid=reconnected-banner]')).not.toBeNull()
  })
})

describe('offline banner, a flush while still offline', () => {
  it('a hidden tab that moves the status to saved does not say the connection is back', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    try {
      server.getAttemptView.mockResolvedValue(view('exam'))
      await render()
      window.dispatchEvent(new Event('offline'))
      await flushPromises()
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(q('[data-testid=reconnected-banner]')).toBeNull()
      expect(q('[data-testid=offline-banner]')).not.toBeNull()
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState
      delete (navigator as unknown as Record<string, unknown>).onLine
    }
  })
})

describe('session expiry (ERR-AUTH-01)', () => {
  const expire = async (): Promise<void> => {
    const store = useSessionStore()
    await store.handleUnauthorized()
    await flushPromises()
  }

  it('timed: a dialog with the exact text; no redirect until the pupil confirms', async () => {
    const redirect = vi.fn()
    setUnauthorizedRedirect(redirect)
    server.getAttemptView.mockResolvedValue(view('exam'))
    await render()
    await expire()
    expect(redirect).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Sesi anda telah tamat. Jawapan anda disimpan pada peranti ini. Log masuk semula untuk meneruskan.')
    q('[data-testid=session-login]')!.click()
    await flushPromises()
    expect(redirect).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith('/a/a1') // 46:364: the pupil returns to this sitting after login
  })

  it('Mod Latihan takes the normal redirect, and after the page leaves the policy is back to normal', async () => {
    const redirect = vi.fn()
    setUnauthorizedRedirect(redirect)
    server.getAttemptView.mockResolvedValue(view('latihan'))
    await render()
    await expire()
    expect(redirect).toHaveBeenCalledOnce()
    expect(q('[data-testid=session-login]')).toBeNull()
    wrapper?.unmount()
    wrapper = null
    await expire()
    expect(redirect).toHaveBeenCalledTimes(2)
  })
})

