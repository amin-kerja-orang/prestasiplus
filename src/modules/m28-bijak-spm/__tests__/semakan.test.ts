// @vitest-environment jsdom
// R1-F11 Semakan: self-mark stepper, band picker, keyword suggestion, past sittings, and the result
// page wiring (totals refresh from the self-mark response, credited rewards stay).
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import KeywordSuggestion from '../components/KeywordSuggestion.vue'
import PastSittingsLink from '../components/PastSittingsLink.vue'
import SelfMarkControl from '../components/SelfMarkControl.vue'
import { bandMidpoint, bandOptions, clampMark, type ReviewPart } from '../domain/semakan'
import ResultPage from '../pages/ResultPage.vue'
import { BijakError } from '../server/errors'
import { BijakServer, MemoryStorage } from '../server/store'

const server = vi.hoisted(() => ({
  getResult: vi.fn(),
  selfMark: vi.fn(),
  retryAttempt: vi.fn(),
  generatePaper: vi.fn(),
  pastSittings: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
const text = (sel: string): string => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
let wrapper: VueWrapper | null = null

function part(over: Partial<ReviewPart> = {}): ReviewPart {
  return {
    partId: 'p1',
    label: '(a)',
    prompt: 'Terangkan.',
    marks: 4,
    awarded: 0,
    status: 'belum_dimarkah',
    confidence: 'low',
    points: [],
    answer: { text: 'jawapan' },
    scheme: { marks: 4 },
    selfMarkable: true,
    ...over,
  }
}

const RUBRIC = {
  criteria: ['Isi'],
  bands: [
    { name: '1', range: [0, 1], descriptor: 'Lemah' },
    { name: '2', range: [2, 3], descriptor: 'Sederhana' },
    { name: '3', range: [4, 4], descriptor: 'Baik' },
  ],
} as const

beforeEach(() => {
  setActivePinia(createPinia())
  for (const f of Object.values(server)) f.mockReset()
  server.pastSittings.mockResolvedValue({ lastSubmittedAttemptId: null, sittings: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('semakan helpers', () => {
  it('clampMark keeps whole marks inside the range', () => {
    expect(clampMark(9, 4)).toBe(4)
    expect(clampMark(-3, 4)).toBe(0)
    expect(clampMark(2.6, 4)).toBe(3)
    expect(clampMark(Number.NaN, 4)).toBe(0)
    expect(clampMark(0, 4, 2)).toBe(2)
  })

  it('bandOptions clamps to the part marks and bandMidpoint floors', () => {
    const p = part({
      marks: 3,
      scheme: {
        marks: 3,
        rubric: { criteria: ['Isi'], bands: [{ name: '2', range: [2, 6], descriptor: 'x' }] },
      },
    })
    const [b] = bandOptions(p)
    expect(b).toMatchObject({ name: '2', from: 2, to: 3 })
    expect(bandMidpoint(b!)).toBe(2)
  })
})

describe('R1-06.2: the band midpoint rounds down (V2 midpointFor)', () => {
  it.each([
    [0, 1, 0],
    [1, 2, 1],
    [6, 8, 7],
    [5, 8, 6],
    [4, 4, 4],
    [9, 10, 9],
  ])('band %i-%i presets the stepper to %i', (from, to, mid) => {
    expect(bandMidpoint({ name: 'b', from, to, descriptor: '' })).toBe(mid)
  })
})

describe('SelfMarkControl: stepper', () => {
  function mountControl(p: ReviewPart, save = vi.fn().mockResolvedValue(undefined)) {
    wrapper = mount(SelfMarkControl, { props: { part: p, save }, attachTo: document.body })
    return save
  }

  it('shows Belum dimarkah and starts at 0', () => {
    mountControl(part())
    expect(text('[data-testid="selfmark-state"]')).toBe('Belum dimarkah')
    expect(text('[data-testid="selfmark-value"]')).toBe('0 / 4')
    expect(document.body.textContent).toContain('Markah kendiri:')
  })

  it('presets to the suggestion and shows it as unconfirmed', () => {
    mountControl(part({ awarded: 3, autoSuggested: true }))
    expect(text('[data-testid="selfmark-value"]')).toBe('3 / 4')
    expect(text('[data-testid="selfmark-state"]')).toContain('belum disahkan')
  })

  it('clamps at 0 and at the part marks', async () => {
    mountControl(part({ awarded: 3 }))
    const inc = q('[data-testid="selfmark-inc"]') as HTMLButtonElement
    const dec = q('[data-testid="selfmark-dec"]') as HTMLButtonElement
    inc.click()
    await flushPromises()
    expect(text('[data-testid="selfmark-value"]')).toBe('4 / 4')
    expect(inc.disabled).toBe(true)
    for (let i = 0; i < 6; i++) {
      dec.click()
      await flushPromises()
    }
    expect(text('[data-testid="selfmark-value"]')).toBe('0 / 4')
    expect(dec.disabled).toBe(true)
  })

  it('saves the draft mark; a confirmed self-mark shows as saved', async () => {
    const save = mountControl(part({ awarded: 1 }))
    ;(q('[data-testid="selfmark-inc"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(text('[data-testid="selfmark-state"]')).toBe('Belum disahkan')
    ;(q('[data-testid="selfmark-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(save).toHaveBeenCalledWith({ partId: 'p1', mark: 2 })
    await wrapper!.setProps({ part: part({ awarded: 2, status: 'separa', selfMarked: true }) })
    expect(text('[data-testid="selfmark-state"]')).toBe('Markah kendiri disimpan')
    expect(text('[data-testid="selfmark-value"]')).toBe('2 / 4')
  })

  it('shows the server refusal verbatim and keeps the draft', async () => {
    const save = vi
      .fn()
      .mockRejectedValue(
        new BijakError(
          'bad_request',
          'Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.',
        ),
      )
    mountControl(part({ awarded: 1 }), save)
    ;(q('[data-testid="selfmark-inc"]') as HTMLButtonElement).click()
    await flushPromises()
    ;(q('[data-testid="selfmark-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(text('[data-testid="selfmark-error"]')).toContain('ditanda automatik')
    expect(text('[data-testid="selfmark-value"]')).toBe('2 / 4')
  })

  it('falls back to a plain BM message for an error without text', async () => {
    mountControl(part(), vi.fn().mockRejectedValue('x'))
    ;(q('[data-testid="selfmark-inc"]') as HTMLButtonElement).click()
    await flushPromises()
    ;(q('[data-testid="selfmark-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(text('[data-testid="selfmark-error"]')).toBe('Markah tidak dapat disimpan. Cuba lagi.')
  })
})

describe('SelfMarkControl: band picker', () => {
  const rubric = () => part({ scheme: { marks: 4, rubric: RUBRIC as never } })

  it('lists every band and presets the midpoint and narrows the range on pick', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    wrapper = mount(SelfMarkControl, { props: { part: rubric(), save }, attachTo: document.body })
    const radios = document.body.querySelectorAll<HTMLElement>('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(text('[data-testid="selfmark-bands"]')).toContain('Band 2 (2-3)')
    radios[1]!.click()
    await flushPromises()
    expect(text('[data-testid="selfmark-value"]')).toBe('2 / 4')
    const inc = q('[data-testid="selfmark-inc"]') as HTMLButtonElement
    const dec = q('[data-testid="selfmark-dec"]') as HTMLButtonElement
    inc.click()
    await flushPromises()
    expect(text('[data-testid="selfmark-value"]')).toBe('3 / 4')
    expect(inc.disabled).toBe(true)
    dec.click()
    dec.click()
    await flushPromises()
    expect(text('[data-testid="selfmark-value"]')).toBe('2 / 4')
    expect(dec.disabled).toBe(true)
    ;(q('[data-testid="selfmark-save"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(save).toHaveBeenCalledWith({ partId: 'p1', mark: 2, band: '2' })
  })

  it('shows the band label after a middle dot when the band has one', () => {
    const p = part({
      scheme: {
        marks: 4,
        rubric: {
          criteria: ['Isi'],
          bands: [{ name: '2', range: [2, 3], descriptor: 'Sederhana', label: 'Memuaskan' }],
        } as never,
      },
    })
    wrapper = mount(SelfMarkControl, { props: { part: p, save: vi.fn() }, attachTo: document.body })
    expect(text('[data-testid="selfmark-bands"]')).toContain('Band 2 · Memuaskan (2-3)')
  })

  it('pre-selects the saved band of a self-marked part', () => {
    wrapper = mount(SelfMarkControl, {
      props: {
        part: part({
          scheme: { marks: 4, rubric: RUBRIC as never },
          awarded: 3,
          band: '2',
          selfMarked: true,
          status: 'separa',
        }),
        save: vi.fn(),
      },
      attachTo: document.body,
    })
    const radios = [...document.body.querySelectorAll<HTMLElement>('[role="radio"]')]
    const checked = radios.map(
      (r) =>
        r.getAttribute('aria-checked') === 'true' || r.getAttribute('data-state') === 'checked',
    )
    expect(checked).toEqual([false, true, false])
    expect(text('[data-testid="selfmark-state"]')).toBe('Markah kendiri disimpan')
  })

  it('a plain points part has no band picker', () => {
    wrapper = mount(SelfMarkControl, {
      props: { part: part(), save: vi.fn() },
      attachTo: document.body,
    })
    expect(q('[data-testid="selfmark-bands"]')).toBeNull()
  })
})

describe('KeywordSuggestion', () => {
  it('writes the V2 line and ticks the matched points', () => {
    wrapper = mount(KeywordSuggestion, {
      props: {
        max: 4,
        suggestion: {
          suggestedMark: 3,
          matched: 2,
          total: 3,
          points: [
            { id: 'k1', label: 'Fotosintesis', marks: 1, matched: true },
            { id: 'k2', label: 'Klorofil', marks: 2, matched: true },
            { id: 'k3', label: 'Stoma', marks: 1, matched: false },
          ],
        },
      },
      attachTo: document.body,
    })
    expect(text('[data-testid="suggestion-line"]')).toBe(
      'Cadangan automatik (kata kunci): 3 / 4 — 2/3 isi dikesan. Sila semak & laraskan.',
    )
    expect(q('[data-testid="suggestion-point-k1"]')?.getAttribute('data-matched')).toBe('true')
    expect(q('[data-testid="suggestion-point-k3"]')?.getAttribute('data-matched')).toBe('false')
  })
})

describe('PastSittingsLink', () => {
  async function render(props: { paperId: string; exclude?: string }) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/r/:attemptId', name: 'm28.bijak.result', component: { template: '<i/>' } },
      ],
    })
    await router.push('/r/x')
    wrapper = mount(PastSittingsLink, {
      props,
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await flushPromises()
  }
  const sitting = (attemptId: string) => ({
    attemptId,
    mode: 'exam',
    status: 'submitted',
    startedAt: 1,
    submittedAt: 2,
    score: 3,
    max: 10,
    provisional: false,
  })

  it('is hidden when there is no closed sitting', async () => {
    await render({ paperId: 'p1' })
    expect(server.pastSittings).toHaveBeenCalledWith(7, 'p1')
    expect(q('[data-testid="past-sittings"]')).toBeNull()
  })

  it('is hidden when the request fails', async () => {
    server.pastSittings.mockRejectedValue(new Error('x'))
    await render({ paperId: 'p1' })
    expect(q('[data-testid="past-sittings"]')).toBeNull()
  })

  it('links to the newest sitting', async () => {
    server.pastSittings.mockResolvedValue({
      lastSubmittedAttemptId: 'a9',
      sittings: [sitting('a9'), sitting('a8')],
    })
    await render({ paperId: 'p1' })
    expect(q('[data-testid="past-sittings"]')?.getAttribute('href')).toBe('/r/a9')
    expect(text('[data-testid="past-sittings"]')).toBe('Lihat semakan lepas')
  })

  it('on a result page skips the sitting on screen', async () => {
    server.pastSittings.mockResolvedValue({
      lastSubmittedAttemptId: 'a9',
      sittings: [sitting('a9'), sitting('a8')],
    })
    await render({ paperId: 'p1', exclude: 'a9' })
    expect(q('[data-testid="past-sittings"]')?.getAttribute('href')).toBe('/r/a8')
  })

  it('is hidden when the only sitting is the one on screen', async () => {
    server.pastSittings.mockResolvedValue({
      lastSubmittedAttemptId: 'a9',
      sittings: [sitting('a9')],
    })
    await render({ paperId: 'p1', exclude: 'a9' })
    expect(q('[data-testid="past-sittings"]')).toBeNull()
  })
})

describe('ResultPage Semakan', () => {
  function resultOf(part1: ReviewPart, score: number, over: Record<string, unknown> = {}) {
    return {
      score,
      max: 4,
      percent: (score / 4) * 100,
      points: 40,
      coins: 8,
      provisional: part1.status === 'belum_dimarkah',
      pendingReview: part1.status === 'belum_dimarkah' ? 1 : 0,
      sections: [
        { sectionId: 's1', label: 'Bahagian A', marks: 4, awarded: score, counted: ['q1'] },
      ],
      questions: [
        {
          questionId: 'q1',
          number: 1,
          sectionId: 's1',
          marks: 4,
          awarded: score,
          counted: true,
          attempted: true,
          parts: [part1],
        },
      ],
      ...over,
    }
  }
  const view = (result: unknown) => ({
    attempt: {
      id: 'a1',
      paperId: 'p1',
      paperKind: 'pilihan',
      subject: 'SN',
      kertas: 2,
      title: 'Kertas 2',
      status: 'submitted',
    },
    paper: { questions: [{ id: 'q1', number: 1, topic: 'T', stem: 'Soalan' }], sections: [] },
    result,
  })

  async function render() {
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/r/:attemptId', name: 'm28.bijak.result', component: ResultPage },
        { path: '/spm/bijak', name: 'm28.bijak', component: stub },
        { path: '/spm/bijak/sejarah', component: stub },
        { path: '/spm/bijak/percubaan/:attemptId', name: 'm28.bijak.attempt', component: stub },
      ],
    })
    await router.push('/r/a1')
    wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router] }, attachTo: document.body },
    )
    await flushPromises()
  }

  it('renders the suggestion and stepper for a suggested part, and refreshes totals after saving', async () => {
    const before = part({
      awarded: 2,
      autoSuggested: true,
      suggestion: {
        suggestedMark: 2,
        matched: 1,
        total: 2,
        points: [
          { id: 'k1', label: 'A', marks: 2, matched: true },
          { id: 'k2', label: 'B', marks: 2, matched: false },
        ],
      },
    })
    server.getResult.mockResolvedValue(view(resultOf(before, 2)))
    const after = part({ awarded: 4, status: 'betul', selfMarked: true })
    server.selfMark.mockResolvedValue({
      partId: 'p1',
      awarded: 4,
      max: 4,
      status: 'betul',
      attemptScore: 4,
      attemptMax: 4,
      provisional: false,
      pendingReview: 0,
      // The recomputed coins exceed what was credited: the line must keep showing the credited ones.
      result: resultOf(after, 4, { coins: 99, points: 990 }),
    })
    await render()
    expect(text('[data-testid="suggestion-line"]')).toContain('2 / 4')
    expect(text('[data-testid="provisional"]')).toContain('1 bahagian belum dimarkah')
    expect(text('[data-testid="section-score"]')).toBe('2 / 4')

    ;(q('[data-testid="selfmark-inc"]') as HTMLButtonElement).click()
    ;(q('[data-testid="selfmark-inc"]') as HTMLButtonElement).click()
    await flushPromises()
    ;(q('[data-testid="selfmark-save"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(server.selfMark).toHaveBeenCalledWith(7, 'a1', { partId: 'p1', mark: 4 })
    expect(text('[data-testid="section-score"]')).toBe('4 / 4')
    expect(q('[data-testid="provisional"]')).toBeNull()
    expect(text('[data-testid="selfmark-state"]')).toBe('Markah kendiri disimpan')
    expect(text('[data-testid="win-screen"]')).toContain('+8')
    expect(text('[data-testid="win-screen"]')).not.toContain('+99')
  })

  it('shows no stepper for an automatically marked part', async () => {
    server.getResult.mockResolvedValue(
      view(resultOf(part({ selfMarkable: undefined, status: 'betul', awarded: 4 }), 4)),
    )
    await render()
    expect(q('[data-testid="selfmark-p1"]')).toBeNull()
  })

  it('shows the Lihat semakan lepas link when another sitting exists', async () => {
    server.getResult.mockResolvedValue(view(resultOf(part({ status: 'betul', awarded: 4 }), 4)))
    server.pastSittings.mockResolvedValue({
      lastSubmittedAttemptId: 'a0',
      sittings: [
        {
          attemptId: 'a0',
          mode: 'exam',
          status: 'submitted',
          startedAt: 1,
          submittedAt: 2,
          score: 1,
          max: 4,
          provisional: false,
        },
      ],
    })
    await render()
    expect(q('[data-testid="past-sittings"]')?.getAttribute('href')).toBe('/r/a0')
  })
})

describe('ResultPage leave guard and mock retry', () => {
  it('warns before leaving with an unsaved stepper change, and not after saving', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const unsaved = part({ awarded: 1 })
    server.getResult.mockResolvedValue({
      attempt: {
        id: 'a1',
        paperId: 'p1',
        paperKind: 'pilihan',
        subject: 'SN',
        kertas: 2,
        title: 'K',
        status: 'submitted',
      },
      paper: { questions: [{ id: 'q1', number: 1, topic: 'T', stem: 'S' }], sections: [] },
      result: {
        score: 1,
        max: 4,
        percent: 25,
        points: 0,
        coins: 0,
        provisional: true,
        pendingReview: 1,
        sections: [],
        questions: [
          {
            questionId: 'q1',
            number: 1,
            sectionId: 's1',
            marks: 4,
            awarded: 1,
            counted: true,
            attempted: true,
            parts: [unsaved],
          },
        ],
      },
    })
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/r/:attemptId', name: 'm28.bijak.result', component: ResultPage },
        { path: '/spm/bijak', name: 'm28.bijak', component: stub },
        { path: '/spm/bijak/sejarah', component: stub },
        { path: '/away', component: stub },
      ],
    })
    await router.push('/r/a1')
    wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [router] }, attachTo: document.body },
    )
    await flushPromises()

    await router.push('/away') // nothing changed: no prompt
    expect(confirm).not.toHaveBeenCalled()
    await router.push('/r/a1')
    await flushPromises()
    ;(q('[data-testid="selfmark-inc"]') as HTMLButtonElement).click()
    await flushPromises()

    confirm.mockReturnValueOnce(false)
    await router.push('/away')
    expect(confirm).toHaveBeenCalledWith(
      'Anda ada markah kendiri yang belum disimpan. Tinggalkan halaman ini?',
    )
    expect(router.currentRoute.value.path).toBe('/r/a1')

    confirm.mockReturnValueOnce(true)
    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/away')
    confirm.mockRestore()
  })

  it('mock retry makes a new sitting and leaves other open sittings untouched', async () => {
    const server2 = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const first = await server2.startAttempt(7, 'mat-k1-2025-a', 'exam')
    await server2.submit(7, first.attemptId, { changes: [], idempotencyKey: 'k1' })
    const open = await server2.startAttempt(7, 'mat-k1-2025-a', 'exam')
    const out = await server2.retryAttempt(7, first.attemptId)
    expect(out.attemptId).not.toBe(open.attemptId)
    expect((await server2.getAttemptView(7, open.attemptId)).attempt.status).toBe('in_progress')
    expect((await server2.getAttemptView(7, out.attemptId)).attempt.status).toBe('in_progress')
  })
})
