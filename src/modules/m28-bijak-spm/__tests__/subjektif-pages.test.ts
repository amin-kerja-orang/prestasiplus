// @vitest-environment jsdom
/**
 * S3-T06 pupil pages: the list (AC-MUR-13-20, AC-MUR-13-23), the sitting (latihan, no countdown, 46 section 2.8 dialog)
 * and the Semakan (AC-MUR-13-21: no scheme before the press, Sembunyi, self-mark keeps the scheme).
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SubjektifAttemptPage from '../pages/SubjektifAttemptPage.vue'
import SubjektifSemakanPage from '../pages/SubjektifSemakanPage.vue'

const server = vi.hoisted(() => ({
  subjects: () => [{ code: 'SEJ', name: 'Sejarah' }],
  serverNow: () => Date.now(),
  listPapers: vi.fn(),
  startAttempt: vi.fn(),
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  submit: vi.fn(),
  getResult: vi.fn(),
  selfMark: vi.fn(),
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
const text = (sel: string): string => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
let wrapper: VueWrapper | null = null
const stub = { template: '<i/>' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/kertas-subjektif', name: 'm28.kertas-subjektif', component: SubjektifAttemptPage },
      {
        path: '/kertas-subjektif/:paperId',
        name: 'm28.kertas-subjektif.paper',
        component: SubjektifAttemptPage,
      },
      {
        path: '/kertas-subjektif/:paperId/semakan/:attemptId',
        name: 'm28.kertas-subjektif.semakan',
        component: SubjektifSemakanPage,
      },
      { path: '/spm/bijak', component: stub },
    ],
  })
}
async function render(path: string) {
  const router = makeRouter()
  await router.push(path)
  wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return router
}

beforeEach(() => {
  window.localStorage.clear()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  for (const fn of [
    server.listPapers,
    server.startAttempt,
    server.getAttemptView,
    server.saveAnswers,
    server.submit,
    server.getResult,
    server.selfMark,
  ])
    fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

/* ------------------------------------------------------------------------------- the list */
const row = (id: string, subject: string, subjectName: string, kertas: number, examBoard: string) => ({
  id,
  title: `Percubaan ${id}`,
  subject,
  subjectName,
  kertas,
  year: 2025,
  code: 'X',
  durationMin: 0,
  questionCount: 3,
  marks: 20,
  kind: 'pilihan',
  status: 'belum',
  surface: 'subjektif',
  examBoard,
})

describe('screen 1: /kertas-subjektif', () => {
  it('AC-MUR-13-23: empty shows the exact copy and asks for the subjektif surface', async () => {
    server.listPapers.mockResolvedValue([])
    await render('/kertas-subjektif')
    expect(server.listPapers).toHaveBeenCalledWith(7, 'subjektif')
    expect(document.body.textContent).toContain(
      'Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi.',
    )
    expect(q('[data-testid=paper-count]')).toBeNull()
  })

  it('shows the title and sub-line, the count, and groups by subject (bigger group first), Kertas then negeri', async () => {
    server.listPapers.mockResolvedValue([
      row('b1', 'SN', 'Sains', 3, 'johor'),
      row('a2', 'SEJ', 'Sejarah', 3, 'selangor'),
      row('a1', 'SEJ', 'Sejarah', 2, 'selangor'),
      row('a3', 'SEJ', 'Sejarah', 3, 'kedah'),
    ])
    await render('/kertas-subjektif')
    expect(document.body.textContent).toContain('Kertas Subjektif')
    expect(document.body.textContent).toContain(
      'Kertas 2, 3 & 4 percubaan negeri — baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri',
    )
    expect(text('[data-testid=paper-count]')).toBe('4 kertas')
    const groups = [...document.body.querySelectorAll('[data-testid^=group-]')]
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual(['group-SEJ', 'group-SN'])
    const ids = [...groups[0]!.querySelectorAll('[data-testid^=paper-]')]
      .map((e) => e.getAttribute('data-testid'))
      .filter((t) => /^paper-[a-z]\d$/.test(t ?? ''))
    expect(ids).toEqual(['paper-a1', 'paper-a3', 'paper-a2'])
  })
})

/* ----------------------------------------------------------------------------- the sitting */
function sittingView() {
  return {
    attempt: {
      id: 'a1',
      title: 'Percubaan Selangor',
      subject: 'SEJ',
      kertas: 2,
      mode: 'latihan',
      status: 'in_progress',
      startedAt: Date.now() - 65_000,
      deadline: null,
      answers: {},
      flags: [],
      picks: {},
      position: 0,
    },
    sections: [
      {
        id: 's1',
        label: 'Bahagian A',
        effectiveMarks: 4,
        rule: { type: 'all' },
        questionIds: ['q1'],
      },
    ],
    groups: [],
    checks: [],
    questions: [
      {
        id: 'q1',
        number: 1,
        sectionId: 's1',
        stem: 'Terangkan satu sebab.',
        marks: 4,
        parts: [{ id: 'q1a', label: '(a)', marks: 4, prompt: 'Terangkan.', input: { kind: 'text' } }],
      },
    ],
  }
}

describe('screen 2: the sitting', () => {
  beforeEach(() => {
    server.startAttempt.mockResolvedValue({ attemptId: 'a1' })
    server.getAttemptView.mockResolvedValue(sittingView())
    server.saveAnswers.mockResolvedValue({ savedAt: Date.now() })
    server.submit.mockResolvedValue({ attemptId: 'a1', late: 0 })
    server.getResult.mockRejectedValue(Object.assign(new Error('x'), { code: 'not_submitted' }))
  })

  it('starts a latihan attempt, shows the heading and marks, counts up and has no countdown', async () => {
    await render('/kertas-subjektif/p1')
    expect(server.startAttempt).toHaveBeenCalledWith(7, 'p1', 'latihan')
    expect(text('[data-testid=paper-heading]')).toBe('Sejarah — Kertas 2')
    expect(text('[data-testid=paper-marks]')).toBe('4 markah')
    expect(text('[data-testid=clock]')).toContain('Masa berlalu')
    expect(text('[data-testid=clock]')).toContain('01:0')
    expect(document.body.textContent).not.toContain('Masa berbaki')
    expect(text('[data-testid=submit]')).toBe('Hantar & Semak')
  })

  it('a refused paper (draft id, 404) shows the not-found state and starts nothing else', async () => {
    server.startAttempt.mockRejectedValue(Object.assign(new Error('x'), { code: 'not_found' }))
    await render('/kertas-subjektif/draf')
    expect(q('[data-testid=paper-not-found]')).not.toBeNull()
    expect(server.getAttemptView).not.toHaveBeenCalled()
  })

  it('46 section 2.8: all blank asks with the Kertas Subjektif copy, then submits and opens the Semakan', async () => {
    server.getResult.mockResolvedValue(semakanView())
    const router = await render('/kertas-subjektif/p1')
    ;(q('[data-testid=submit]') as HTMLElement).click()
    await flushPromises()
    expect(document.body.textContent).toContain('Hantar & Semak sekarang?')
    expect(document.body.textContent).toContain(
      'Anda belum menaip sebarang jawapan. Teruskan jika anda menjawab di atas kertas.',
    )
    expect(server.submit).not.toHaveBeenCalled()
    ;(q('[data-testid=confirm-submit]') as HTMLElement).click()
    await flushPromises()
    expect(server.submit).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('m28.kertas-subjektif.semakan')
    expect(router.currentRoute.value.params).toMatchObject({ paperId: 'p1', attemptId: 'a1' })
  })

  it('"Kembali" closes the dialog without sending', async () => {
    await render('/kertas-subjektif/p1')
    ;(q('[data-testid=submit]') as HTMLElement).click()
    await flushPromises()
    ;(q('[data-testid=confirm-back]') as HTMLElement).click()
    await flushPromises()
    expect(server.submit).not.toHaveBeenCalled()
  })
})

/** The stepper saves 500 ms after the last change. */
const settle = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 650))
  await flushPromises()
}

/* ------------------------------------------------------------------------------ Semakan */
const SCHEME_TEXT = 'Rujukan skema rahsia'
function semakanView(withScheme = false) {
  const scheme = withScheme
    ? { marks: 4, explanation: SCHEME_TEXT }
    : { marks: 4 }
  return {
    attempt: { id: 'a1', paperId: 'p1', paperKind: 'subjektif', subject: 'SEJ', kertas: 2, status: 'submitted', title: 'T' },
    paper: {
      attempt: {},
      sections: [],
      groups: [],
      checks: [],
      questions: [{ id: 'q1', number: 1, sectionId: 's1', stem: 'Terangkan satu sebab.', marks: 4 }],
    },
    result: {
      score: 1,
      max: 4,
      percent: 25,
      points: 0,
      coins: 0,
      provisional: true,
      pendingReview: 1,
      sections: [{ sectionId: 's1', label: 'Bahagian A', marks: 4, awarded: 1, counted: ['q1'] }],
      questions: [
        {
          questionId: 'q1',
          number: 1,
          sectionId: 's1',
          marks: 4,
          awarded: 1,
          counted: true,
          attempted: true,
          parts: [
            {
              partId: 'q1a',
              label: '(a)',
              prompt: 'Terangkan.',
              marks: 4,
              awarded: 1,
              status: 'belum_dimarkah',
              confidence: 'low',
              points: [],
              answer: { text: 'Jawapan saya' },
              scheme,
              selfMarkable: true,
            },
          ],
        },
      ],
    },
  }
}

describe('screen 3: Semakan', () => {
  beforeEach(() => {
    server.getResult.mockImplementation((_u: number, _id: string, withScheme?: boolean) =>
      Promise.resolve(semakanView(!!withScheme)),
    )
    server.selfMark.mockImplementation(
      (_u: number, _id: string, body: { mark: number }, withScheme?: boolean) => {
        const v = semakanView(!!withScheme)
        v.result.questions[0]!.parts[0]!.awarded = body.mark
        return Promise.resolve({
          partId: 'q1a',
          awarded: body.mark,
          max: 4,
          status: 'separa',
          attemptScore: body.mark,
          attemptMax: 4,
          provisional: false,
          pendingReview: 0,
          result: { ...v.result, score: body.mark, provisional: false, pendingReview: 0 },
        })
      },
    )
  })

  it('shows the total and the provisional banner and holds no scheme text before the press (AC-MUR-13-21)', async () => {
    await render('/kertas-subjektif/p1/semakan/a1')
    expect(text('[data-testid=total]')).toBe('1 / 4')
    expect(text('[data-testid=provisional]')).toContain('Markah sementara - 1 bahagian belum dimarkah.')
    expect(text('[data-testid=scheme-toggle]')).toBe('Tunjuk Skema Pemarkahan')
    expect(document.body.textContent).not.toContain('Skema Pemarkahan ·')
    expect(document.body.textContent).not.toContain(SCHEME_TEXT)
    expect(server.getResult).toHaveBeenCalledTimes(1)
    expect(server.getResult.mock.calls[0]![2]).toBeFalsy()
  })

  it('fetches the scheme only at the press; Sembunyi hides it again', async () => {
    await render('/kertas-subjektif/p1/semakan/a1')
    ;(q('[data-testid=scheme-toggle]') as HTMLElement).click()
    await flushPromises()
    expect(server.getResult).toHaveBeenCalledTimes(2)
    expect(server.getResult).toHaveBeenLastCalledWith(7, 'a1', true)
    expect(document.body.textContent).toContain(SCHEME_TEXT)
    expect(text('[data-testid=scheme-toggle]')).toBe('Sembunyi')
    ;(q('[data-testid=scheme-toggle]') as HTMLElement).click()
    await flushPromises()
    expect(document.body.textContent).not.toContain(SCHEME_TEXT)
    expect(text('[data-testid=scheme-toggle]')).toBe('Tunjuk Skema Pemarkahan')
  })

  it('a load failure shows the BM line and keeps the scheme hidden', async () => {
    await render('/kertas-subjektif/p1/semakan/a1')
    server.getResult.mockRejectedValueOnce(new Error('boom'))
    ;(q('[data-testid=scheme-toggle]') as HTMLElement).click()
    await flushPromises()
    expect(text('[data-testid=scheme-error]')).toBe('Skema pemarkahan tidak tersedia untuk kertas ini.')
    expect(text('[data-testid=scheme-toggle]')).toBe('Tunjuk Skema Pemarkahan')
  })

  it('self-mark: without the scheme it does not ask for it; after the press it passes withScheme', async () => {
    await render('/kertas-subjektif/p1/semakan/a1')
    expect(document.body.textContent).toContain('Markah kendiri:')
    expect(document.body.textContent).not.toContain('Markah dinilai sendiri')
    ;(q('[data-testid=selfmark-inc]') as HTMLElement).click()
    await flushPromises()
    await settle()
    expect(server.selfMark).toHaveBeenLastCalledWith(7, 'a1', { partId: 'q1a', mark: 2 }, false)
    expect(text('[data-testid=total]')).toBe('2 / 4')
    expect(document.body.textContent).not.toContain('Markah sementara')

    ;(q('[data-testid=scheme-toggle]') as HTMLElement).click()
    await flushPromises()
    ;(q('[data-testid=selfmark-inc]') as HTMLElement).click()
    await flushPromises()
    await settle()
    expect(server.selfMark).toHaveBeenLastCalledWith(7, 'a1', { partId: 'q1a', mark: 2 }, true)
    expect(document.body.textContent).toContain(SCHEME_TEXT)
  })

  it('a self-mark made while the scheme is shown still counts after Sembunyi (total and banner)', async () => {
    await render('/kertas-subjektif/p1/semakan/a1')
    ;(q('[data-testid=scheme-toggle]') as HTMLElement).click()
    await flushPromises()
    ;(q('[data-testid=selfmark-inc]') as HTMLElement).click()
    await settle()
    expect(text('[data-testid=total]')).toBe('2 / 4')
    ;(q('[data-testid=scheme-toggle]') as HTMLElement).click()
    await flushPromises()
    expect(text('[data-testid=total]')).toBe('2 / 4')
    expect(document.body.textContent).not.toContain('Markah sementara')
    expect(document.body.textContent).not.toContain(SCHEME_TEXT)
  })

  it('a paper id that does not match the attempt shows the not-found state', async () => {
    await render('/kertas-subjektif/other/semakan/a1')
    expect(q('[data-testid=paper-not-found]')).not.toBeNull()
  })

  it('before Hantar & Semak the button is disabled with its title and nothing is fetched with the scheme', async () => {
    server.getResult.mockReset()
    server.getResult.mockRejectedValue(Object.assign(new Error('x'), { code: 'not_submitted' }))
    await render('/kertas-subjektif/p1/semakan/a1')
    const btn = q('[data-testid=scheme-toggle]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('title')).toBe('Hantar & Semak dahulu untuk melihat skema.')
    btn.click()
    await flushPromises()
    expect(server.getResult).toHaveBeenCalledTimes(1)
  })
})
