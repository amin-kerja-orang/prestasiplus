// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import AttemptPage from '../pages/AttemptPage.vue'

const server = vi.hoisted(() => ({
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  submit: vi.fn(),
  serverNow: () => Date.now(),
}))
vi.mock('../server/client', () => ({
  bijakServer: () => server,
  browserStorage: () => window.localStorage,
}))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
const text = (sel: string): string => q(sel)?.textContent?.trim() ?? ''
let wrapper: VueWrapper | null = null
let replaced: string[] = []

/** A stubbed `matchMedia` for the page's `(width < 640px)` query; `setWidth` fires the change event. */
function stubMedia(width: number): (w: number) => void {
  const listeners = new Set<() => void>()
  let current = width
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return /width < 640px/.test(query) ? current < 640 : false
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }))
  return (w: number) => {
    current = w
    listeners.forEach((fn) => fn())
  }
}

beforeEach(() => {
  server.getAttemptView.mockReset()
  server.submit.mockReset()
  server.saveAnswers.mockReset()
  server.saveAnswers.mockResolvedValue({ closed: false })
  window.localStorage.clear()
  window.sessionStorage.clear()
  replaced = []
  // jsdom has no element scrolling: keep the offset so scroll position can be asserted.
  Element.prototype.scrollTo = function (this: Element, arg?: unknown): void {
    this.scrollTop = (arg as { top?: number } | undefined)?.top ?? 0
  }
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function render(): Promise<VueWrapper> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
      { path: '/a/:attemptId', name: 'm28.bijak.attempt', component: stub },
    ],
  })
  const orig = router.replace.bind(router)
  router.replace = (to: never) => {
    replaced.push(String((to as { name?: string }).name))
    return orig(to)
  }
  await router.push('/a/a1')
  wrapper = mount(AttemptPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function view(mode: 'exam' | 'latihan', over: { deadline?: number | null; answers?: object } = {}) {
  return {
    attempt: {
      id: 'a1',
      title: 'Kertas Contoh',
      mode,
      status: 'in_progress',
      startedAt: Date.now() - 60_000,
      deadline: over.deadline ?? null,
      answers: Object.fromEntries(
        Object.entries(over.answers ?? {}).map(([id, answer]) => [
          id,
          { answer, rev: 1, savedAt: Date.now() },
        ]),
      ),
      flags: [],
      picks: {},
      position: 0,
    },
    sections: [
      {
        id: 's1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        questionIds: ['q1', 'q2', 'q3', 'q4'],
        marks: 4,
        effectiveMarks: 4,
      },
    ],
    groups: [],
    checks: [],
    questions: [1, 2, 3, 4].map((n) => ({
      id: `q${n}`,
      number: n,
      sectionId: 's1',
      topic: 'T',
      formOrigin: 'T4',
      stem: `Soalan nombor ${n}?`,
      marks: 1,
      mcq: {
        options: [
          { id: 'a', text: 'Pilihan A' },
          { id: 'b', text: 'Pilihan B' },
        ],
      },
    })),
  }
}

async function openMap(): Promise<void> {
  q('[data-testid=open-map]')!.click()
  await flushPromises()
  await nextTick()
}

describe('FR-X6-9 / FR-MUR-QP-11: Hantar reachable on a phone in both modes', () => {
  describe.each([
    ['320x568', 320],
    ['375x667', 375],
  ])('%s', (_label, width) => {
    it('exam: the map sheet shows "Hantar" and opens the dialog', async () => {
      stubMedia(width)
      server.getAttemptView.mockResolvedValue(view('exam'))
      await render()
      await openMap()
      const btn = q('[data-testid=submit-from-map]')
      expect(btn?.textContent?.trim()).toBe('Hantar')
      btn!.click()
      await flushPromises()
      expect(text('[role=dialog][data-state=open] [data-testid=confirm-submit]')).toBe('Hantar')
    })

    it('latihan: the map sheet shows "Selesai" before the last question and opens the same dialog', async () => {
      stubMedia(width)
      server.getAttemptView.mockResolvedValue(view('latihan'))
      await render()
      expect(q('[data-testid=submit]')).toBeNull() // footer "Selesai" only on the last question
      await openMap()
      const btn = q('[data-testid=submit-from-map]')
      expect(btn?.textContent?.trim()).toBe('Selesai')
      btn!.click()
      await flushPromises()
      expect(document.body.textContent).toContain('Selesai latihan?')
      expect(text('[data-testid=confirm-submit]')).toBe('Selesai')
    })
  })
})

describe('FR-X6-10 / FR-MUR-QP-12: rotation keeps the place', () => {
  it('FR-X6-10: switching phone <-> lg keeps the question, the scroll position and the answer', async () => {
    const setWidth = stubMedia(375)
    server.getAttemptView.mockResolvedValue(view('exam'))
    await render()
    q('[data-testid=next]')!.click()
    await flushPromises()
    q('[data-testid=next]')!.click()
    await flushPromises()
    expect(text('[data-testid=position]')).toBe('Soalan 3 / 4')
    const scroll = q('[data-testid=attempt-scroll]')!
    scroll.scrollTop = 240
    const stem = text('[data-testid=attempt-scroll]')
    setWidth(667) // landscape
    await flushPromises()
    setWidth(1280)
    await flushPromises()
    setWidth(375)
    await flushPromises()
    expect(text('[data-testid=position]')).toBe('Soalan 3 / 4')
    expect(text('[data-testid=attempt-scroll]')).toBe(stem)
    expect(q('[data-testid=attempt-scroll]')).toBe(scroll)
    expect(scroll.scrollTop).toBe(240)
  })

  it('FR-X6-10: position is stored under pp.qd.pos.{attemptId} and a reload returns to it', async () => {
    stubMedia(375)
    server.getAttemptView.mockResolvedValue(view('exam'))
    await render()
    q('[data-testid=next]')!.click()
    await flushPromises()
    expect(JSON.parse(window.sessionStorage.getItem('pp.qd.pos.a1')!)).toEqual({
      questionIndex: 1,
      scrollTop: 0,
    })
    wrapper!.unmount()
    document.body.innerHTML = ''
    await render()
    expect(text('[data-testid=position]')).toBe('Soalan 2 / 4')
  })
})

describe('FR-PA-14 / AC-PA-21: timer', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })
  })

  async function tick(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms)
    await flushPromises()
  }

  it('AC-PA-21: the 5-minute warning shows once, at every width, without moving the question', async () => {
    for (const width of [320, 375, 768, 1280]) {
      const setWidth = stubMedia(width)
      server.getAttemptView.mockResolvedValue(view('exam', { deadline: Date.now() + 302_000 }))
      await render()
      q('[data-testid=next]')!.click()
      await flushPromises()
      expect(q('[data-testid=time-warning]')).toBeNull()
      await tick(3000)
      const banners = document.body.querySelectorAll('[data-testid=time-warning]')
      expect(banners).toHaveLength(1)
      expect(banners[0]!.textContent?.trim()).toBe('Amaran: masa berbaki kurang 5 minit.')
      await tick(5000)
      setWidth(width < 640 ? 1280 : 375)
      await flushPromises()
      expect(document.body.querySelectorAll('[data-testid=time-warning]')).toHaveLength(1)
      expect(text('[data-testid=position]')).toBe('Soalan 2 / 4')
      // The warning sits in the shell's banner bar, outside the scrolling question.
      expect(q('[data-testid=time-warning]')!.closest('[data-testid=attempt-scroll]')).toBeNull()
      wrapper!.unmount()
      wrapper = null
      document.body.innerHTML = ''
      window.sessionStorage.clear()
      window.localStorage.clear()
    }
  })

  it('AC-PA-21: at 0 the sitting submits with auto:true', async () => {
    stubMedia(375)
    server.submit.mockResolvedValue({ closed: true })
    server.getAttemptView.mockResolvedValue(view('exam', { deadline: Date.now() + 2_000 }))
    await render()
    await tick(3000)
    expect(server.submit).toHaveBeenCalledTimes(1)
    expect(server.submit.mock.calls[0]![2]).toMatchObject({ auto: true })
    expect(replaced).toContain('m28.bijak.result')
  })

  it('AC-PA-21: offline at 0 locks the inputs, shows the banner and submits on reconnect', async () => {
    stubMedia(375)
    server.submit.mockRejectedValueOnce(new Error('offline'))
    server.getAttemptView.mockResolvedValue(view('exam', { deadline: Date.now() + 2_000 }))
    await render()
    await tick(3000)
    expect(text('[data-testid=time-up-offline]')).toBe(
      'Masa tamat. Jawapan akan dihantar apabila sambungan pulih.',
    )
    // Inputs are locked: picking an option no longer answers the question.
    expect(q('[data-testid=nav-1]')?.getAttribute('data-state')).toBe('none')
    q('[data-testid=option-a]')!.click()
    await flushPromises()
    expect(q('[data-testid=nav-1]')?.getAttribute('data-state')).toBe('none')
    expect(replaced).not.toContain('m28.bijak.result')
    server.submit.mockResolvedValue({ closed: true })
    window.dispatchEvent(new Event('online'))
    await tick(10)
    expect(server.submit).toHaveBeenCalledTimes(2)
    expect(server.submit.mock.calls[1]![2]).toMatchObject({ auto: true })
    expect(replaced).toContain('m28.bijak.result')
  })
})

describe('FR-PA-15 / AC-PA-22: Hantar dialog', () => {
  async function openDialog(answers: object): Promise<void> {
    stubMedia(1280)
    server.getAttemptView.mockResolvedValue(view('exam', { answers }))
    await render()
    q('[data-testid=submit-early]')!.click()
    await flushPromises()
    await nextTick()
  }

  it('AC-PA-22: 3 blank questions read "Anda belum menjawab 3 soalan." then "Hantar jawapan anda sekarang?"', async () => {
    await openDialog({ q1: { choice: 'a' } })
    const dialog = q('[role=dialog]')!
    const t = dialog.textContent ?? ''
    expect(t).toContain('Anda belum menjawab 3 soalan.')
    expect(t).toContain('Hantar jawapan anda sekarang?')
    expect(t.indexOf('Anda belum menjawab 3 soalan.')).toBeLessThan(
      t.indexOf('Hantar jawapan anda sekarang?'),
    )
    expect(text('[data-testid=confirm-back]')).toBe('Batal')
    expect(text('[data-testid=confirm-submit]')).toBe('Hantar')
  })

  it('AC-PA-22: with no blank only "Hantar jawapan anda sekarang?" shows', async () => {
    const all = Object.fromEntries([1, 2, 3, 4].map((n) => [`q${n}`, { choice: 'a' }]))
    await openDialog(all)
    const t = q('[role=dialog]')!.textContent ?? ''
    expect(t).toContain('Hantar jawapan anda sekarang?')
    expect(t).not.toContain('Anda belum menjawab')
  })

  it('AC-PA-22: focus starts on the safe button', async () => {
    await openDialog({})
    await vi.waitFor(() => expect(document.activeElement).toBe(q('[data-testid=confirm-back]')))
  })

  it('AC-PA-22: Esc chooses the safe button (dialog closes, nothing is submitted)', async () => {
    await openDialog({})
    const dialog = q('[role=dialog]')!
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await nextTick()
    expect(q('[role=dialog][data-state=open]')).toBeNull()
    expect(server.submit).not.toHaveBeenCalled()
  })
})
