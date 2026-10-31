// @vitest-environment jsdom
import type { Component } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { BijakKuizItem } from '@pp/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import PaperQuizPage from '../pages/PaperQuizPage.vue'
import KuizPage from '../pages/KuizPage.vue'
import { BijakError } from '../server/errors'

const server = vi.hoisted(() => ({
  startKuiz: vi.fn(),
  checkKuiz: vi.fn(),
  finishKuiz: vi.fn(),
  getKuizPaperPage: vi.fn(),
  checkKuizPaper: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', () => ({ useLearnerTheme: () => undefined }))

let wrapper: VueWrapper | null = null
const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
const text = (sel: string): string => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal('scrollTo', vi.fn())
  Object.values(server).forEach((f) => f.mockReset())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function mcq(id: string, extra: Partial<BijakKuizItem> = {}): BijakKuizItem {
  return {
    id,
    groupId: null,
    kind: 'mcq',
    stem: `Soalan ${id}?`,
    lead: [],
    path: null,
    prompt: '',
    marks: 1,
    markable: true,
    subjectName: 'Matematik',
    stimuli: [],
    // Shown labels follow the shuffle: id C is shown as "A".
    options: [
      { id: 'C', label: 'A', text: 'Pilihan C', imageToken: null },
      { id: 'A', label: 'B', text: 'Pilihan A', imageToken: null },
    ],
    ...extra,
  }
}

async function mountPage(component: Component, url: string): Promise<VueWrapper> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', component: stub },
      { path: '/simulasi/kuiz', component: stub },
      { path: '/simulasi/:paperId/kuiz', component: stub },
    ],
  })
  await router.push(url)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function pick(id: string): Promise<void> {
  const radio = q(`[data-testid="mcq-option-${id}"] input`) as HTMLInputElement
  radio.checked = true
  radio.dispatchEvent(new Event('change'))
  await flushPromises()
}
async function click(sel: string): Promise<void> {
  q(sel)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

describe('KuizPage (random)', () => {
  const session = {
    sessionId: '11111111-1111-4111-8111-111111111111',
    count: 2,
    items: [mcq('q1'), mcq('q2')],
  }

  it('starts with the count and subject of the URL and shows one question', async () => {
    server.startKuiz.mockResolvedValue(session)
    await mountPage(KuizPage, '/simulasi/kuiz?count=10&subject=MATH')
    expect(server.startKuiz).toHaveBeenCalledWith({ count: 10, subject: 'MATH' })
    expect(text('[data-testid=kuiz-counter]')).toBe('Soalan 1 daripada 2')
    expect(text('[data-testid=kuiz-chip]')).toBe('❓ Soalan 1')
    expect(document.body.textContent).toContain('Soalan q1?')
    expect(q('[data-testid=kuiz-next]')).toBeNull()
  })

  it('falls back to 20 for a count that is not 5/10/20/40 and drops a bad subject', async () => {
    server.startKuiz.mockResolvedValue(session)
    await mountPage(KuizPage, '/simulasi/kuiz?count=7&subject=a%20b')
    expect(server.startKuiz).toHaveBeenCalledWith({ count: 20 })
  })

  it('keeps Semak disabled until an option is picked, then sends the stored letter, not the label', async () => {
    server.startKuiz.mockResolvedValue(session)
    server.checkKuiz.mockResolvedValue({
      correct: false,
      correctOptionId: 'C',
      explanation: 'Sebab $x$.',
    })
    await mountPage(KuizPage, '/simulasi/kuiz')
    expect(q('[data-testid=kuiz-semak]')?.hasAttribute('disabled')).toBe(true)
    await pick('A') // shown as "B"
    await click('[data-testid=kuiz-semak]')
    expect(server.checkKuiz).toHaveBeenCalledWith(session.sessionId, {
      itemId: 'q1',
      optionId: 'A',
    })
    expect(text('[data-testid=kuiz-verdict]')).toContain('😟 Salah')
    expect(text('[data-testid=kuiz-explanation]')).toContain('Sebab')
    expect(q('[data-testid="mcq-option-C"]')?.getAttribute('data-verdict')).toBe('correct')
    expect(q('[data-testid="mcq-option-A"]')?.getAttribute('data-verdict')).toBe('wrong')
    expect(q('[data-testid=kuiz-semak]')).toBeNull()
    expect(text('[data-testid=kuiz-next]')).toBe('Soalan Seterusnya →')
  })

  it('walks to the last question ("Tamat →"), finishes and shows the server score and reward', async () => {
    server.startKuiz.mockResolvedValue(session)
    server.checkKuiz.mockResolvedValue({ correct: true, correctOptionId: 'C', explanation: null })
    server.finishKuiz.mockResolvedValue({
      score: 2,
      total: 2,
      answered: 2,
      gamification: { coinsEarned: 4, streakCount: 1, pointsEarned: 20, totalBalance: 44 },
    })
    await mountPage(KuizPage, '/simulasi/kuiz?count=5')
    await pick('C')
    await click('[data-testid=kuiz-semak]')
    expect(text('[data-testid=kuiz-verdict]')).toContain('🎉 Betul!')
    await click('[data-testid=kuiz-next]')
    expect(text('[data-testid=kuiz-counter]')).toBe('Soalan 2 daripada 2')
    await pick('C')
    await click('[data-testid=kuiz-semak]')
    expect(text('[data-testid=kuiz-next]')).toBe('Tamat →')
    await click('[data-testid=kuiz-next]')
    expect(server.finishKuiz).toHaveBeenCalledWith(session.sessionId, expect.any(Number))
    expect(document.body.textContent).toContain('Kuiz Selesai!')
    expect(text('[data-testid=kuiz-score]')).toContain('2/2')
    expect(text('[data-testid=kuiz-accuracy]')).toContain('100%')
    expect(text('[data-testid=kuiz-rewards]')).toContain('20')
    expect(q('[data-testid=kuiz-retry]')).not.toBeNull()
    expect(document.body.textContent).toContain('Kertas penuh')
  })

  it('"Cuba Lagi" starts a fresh quiz with the chosen count and subject', async () => {
    server.startKuiz.mockResolvedValue(session)
    server.checkKuiz.mockResolvedValue({ correct: true, correctOptionId: 'C', explanation: null })
    server.finishKuiz.mockResolvedValue({
      score: 0,
      total: 2,
      answered: 0,
      gamification: { coinsEarned: 0, streakCount: 1, pointsEarned: 0, totalBalance: 0 },
    })
    await mountPage(KuizPage, '/simulasi/kuiz?count=10&subject=MATH')
    expect(server.startKuiz).toHaveBeenLastCalledWith({ count: 10, subject: 'MATH' })
    for (let i = 0; i < 2; i++) {
      await pick('C')
      await click('[data-testid=kuiz-semak]')
      await click('[data-testid=kuiz-next]')
    }
    expect(q('[data-testid=kuiz-retry]')).not.toBeNull()
    const calls = server.startKuiz.mock.calls.length
    await click('[data-testid=kuiz-retry]')
    expect(server.startKuiz).toHaveBeenCalledTimes(calls + 1)
    expect(server.startKuiz).toHaveBeenLastCalledWith({ count: 10, subject: 'MATH' })
    expect(q('[data-testid=kuiz-counter]')).not.toBeNull()
  })

  it('shows "Belum ada soalan objektif" on NO_QUESTIONS', async () => {
    server.startKuiz.mockRejectedValue(new BijakError('no_questions', 'Belum ada soalan objektif'))
    await mountPage(KuizPage, '/simulasi/kuiz')
    expect(text('[data-testid=kuiz-empty]')).toContain('Belum ada soalan objektif')
    expect(q('[data-testid=kuiz-counter]')).toBeNull()
  })

  it('shows a load error with a retry for any other failure', async () => {
    server.startKuiz.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(session)
    await mountPage(KuizPage, '/simulasi/kuiz')
    expect(document.body.textContent).toContain('Kuiz tidak dapat dimuatkan.')
    await click('[data-testid=kuiz-retry-load]')
    expect(text('[data-testid=kuiz-counter]')).toBe('Soalan 1 daripada 2')
  })

  it('maps check errors: offline keeps the answer and offers Semak again', async () => {
    server.startKuiz.mockResolvedValue(session)
    server.checkKuiz.mockRejectedValue(new BijakError('offline', 'Luar talian'))
    await mountPage(KuizPage, '/simulasi/kuiz')
    await pick('C')
    await click('[data-testid=kuiz-semak]')
    expect(document.body.textContent).toContain('Luar talian. Cuba lagi.')
    expect(q('[data-testid=kuiz-semak]')).not.toBeNull()
    expect(q('[data-testid=kuiz-verdict]')).toBeNull()
  })

  it('maps a 409 "Kuiz ini sudah selesai." from check to its message', async () => {
    server.startKuiz.mockResolvedValue(session)
    server.checkKuiz.mockRejectedValue(new BijakError('bad_request', 'Kuiz ini sudah selesai.'))
    await mountPage(KuizPage, '/simulasi/kuiz')
    await pick('C')
    await click('[data-testid=kuiz-semak]')
    expect(document.body.textContent).toContain('Kuiz ini sudah selesai.')
  })

  it('stays on the last question with an error if finish fails, and can try again', async () => {
    server.startKuiz.mockResolvedValue({ ...session, count: 1, items: [mcq('q1')] })
    server.checkKuiz.mockResolvedValue({ correct: true, correctOptionId: 'C', explanation: null })
    server.finishKuiz.mockRejectedValueOnce(new Error('x')).mockResolvedValue({
      score: 1,
      total: 1,
      answered: 1,
      gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
    })
    await mountPage(KuizPage, '/simulasi/kuiz')
    await pick('C')
    await click('[data-testid=kuiz-semak]')
    await click('[data-testid=kuiz-next]')
    expect(document.body.textContent).toContain('Keputusan tidak dapat disimpan. Cuba lagi.')
    await click('[data-testid=kuiz-next]')
    expect(document.body.textContent).toContain('Kuiz Selesai!')
  })

  it('renders an image stimulus from /api/files/{token} above the question', async () => {
    server.startKuiz.mockResolvedValue({
      ...session,
      count: 1,
      items: [
        mcq('q1', {
          stimuli: [
            {
              kind: 'diagram',
              label: 'Rajah 1',
              body: null,
              imageToken: 'abcDEF0123456789abcdef',
              alt: 'Segi tiga',
            },
          ],
        }),
      ],
    })
    await mountPage(KuizPage, '/simulasi/kuiz')
    const img = q('[data-testid=stimulus] img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/api/files/abcDEF0123456789abcdef')
  })
})

describe('PaperQuizPage', () => {
  const open: BijakKuizItem = {
    ...mcq('q3:a'),
    id: 'q3:a',
    kind: 'open',
    markable: false,
    stem: 'Struktur',
    path: 'a',
    prompt: 'Terangkan.',
    options: [],
  }
  const page1 = {
    paper: { id: 'p1', title: 'Set 1', subjectName: 'Matematik', code: '1449/1' },
    page: 1,
    pageCount: 2,
    section: { id: 's1', label: 'Bahagian A', instruction: 'Jawab semua soalan.' },
    items: [mcq('q1'), mcq('q2')],
    groups: [],
    markableTotal: 3,
  }
  const page2 = {
    ...page1,
    page: 2,
    section: { id: 's2', label: 'Bahagian B', instruction: null },
    items: [mcq('q4'), open],
  }

  it('loads page 1 with the Bahagian label, instruction and the score line', async () => {
    server.getKuizPaperPage.mockResolvedValue(page1)
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    expect(server.getKuizPaperPage).toHaveBeenCalledWith('p1', 1)
    expect(text('[data-testid=paper-quiz-meta]')).toContain('Bahagian A (1/2)')
    expect(text('[data-testid=paper-quiz-instruction]')).toBe('Jawab semua soalan.')
    expect(text('[data-testid=paper-quiz-score]')).toBe('Skor: 0 / 3')
    expect(q('[data-testid=paper-quiz-prev]')?.hasAttribute('disabled')).toBe(true)
  })

  it('counts the score on the client from the check results and keeps it across pages', async () => {
    server.getKuizPaperPage.mockImplementation((_id: string, n: number) =>
      Promise.resolve(n === 1 ? page1 : page2),
    )
    server.checkKuizPaper.mockResolvedValue({
      correct: true,
      correctOptionId: 'C',
      explanation: null,
    })
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    const first = q('[data-testid="kuiz-item-q1"]')!
    const radio = first.querySelector('[data-testid="mcq-option-C"] input') as HTMLInputElement
    radio.checked = true
    radio.dispatchEvent(new Event('change'))
    await flushPromises()
    ;(first.querySelector('[data-testid=kuiz-semak]') as HTMLElement).click()
    await flushPromises()
    expect(server.checkKuizPaper).toHaveBeenCalledWith('p1', { itemId: 'q1', optionId: 'C' })
    expect(text('[data-testid=paper-quiz-score]')).toBe('Skor: 1 / 3')

    await click('[data-testid=paper-quiz-next]')
    expect(server.getKuizPaperPage).toHaveBeenLastCalledWith('p1', 2)
    expect(text('[data-testid=paper-quiz-meta]')).toContain('Bahagian B (2/2)')
    expect(text('[data-testid=paper-quiz-score]')).toBe('Skor: 1 / 3')
    expect(q('[data-testid=paper-quiz-next]')?.hasAttribute('disabled')).toBe(true)

    await click('[data-testid=paper-quiz-prev]')
    expect(server.getKuizPaperPage).toHaveBeenLastCalledWith('p1', 1)
  })

  it('shows an open part as an unsaved textarea with the one-line note and no Semak', async () => {
    server.getKuizPaperPage.mockResolvedValue({ ...page2, page: 2 })
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    const item = q('[data-testid="kuiz-item-q3:a"]')!
    expect(item.querySelector('textarea')).not.toBeNull()
    expect(item.querySelector('[data-testid=kuiz-semak]')).toBeNull()
    expect(item.textContent).toContain(
      'Latihan sendiri — jawapan ini tidak disimpan atau dimarkah.',
    )
    expect(item.textContent).toContain('(a) Terangkan.')
    // Typing sends nothing anywhere.
    const area = item.querySelector('textarea') as HTMLTextAreaElement
    area.value = 'jawapan'
    area.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(server.checkKuizPaper).not.toHaveBeenCalled()
  })

  it('D90: renders a group stimulus once above its members (groups[]), never per member', async () => {
    const stim = { kind: 'passage', label: 'Petikan kumpulan', body: 'Teks kongsi unik.', imageToken: null, alt: null }
    server.getKuizPaperPage.mockResolvedValue({
      ...page1,
      items: [mcq('g1', { groupId: 'G' }), mcq('g2', { groupId: 'G' }), mcq('q9')],
      groups: [{ id: 'G', stimuli: [stim] }],
    })
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    // narrow viewport: one chip opens the shared stimulus; it is not repeated per member
    expect(document.querySelectorAll('[data-testid="stimulus-chip"]').length).toBe(1)
    expect(document.body.textContent.split('Teks kongsi unik.').length - 1).toBeLessThanOrEqual(1)
    expect(document.querySelectorAll('[data-testid="stimulus-group"]').length).toBe(1)
    for (const id of ['g1', 'g2', 'q9']) expect(q(`[data-testid="kuiz-item-${id}"]`)).not.toBeNull()
  })

  it('shows "Kertas ini tiada soalan" for an empty paper', async () => {
    server.getKuizPaperPage.mockResolvedValue({
      ...page1,
      pageCount: 0,
      section: null,
      items: [],
      groups: [],
      markableTotal: 0,
    })
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    expect(text('[data-testid=paper-quiz-empty]')).toContain('Kertas ini tiada soalan')
  })

  it('maps 404 to the not-found state and other failures to a retryable error', async () => {
    server.getKuizPaperPage.mockRejectedValue(new BijakError('not_found', 'Kertas tidak ditemui'))
    await mountPage(PaperQuizPage, '/simulasi/zzz/kuiz')
    expect(q('[data-testid=paper-quiz-missing]')).not.toBeNull()
    wrapper?.unmount()
    document.body.innerHTML = ''
    server.getKuizPaperPage.mockRejectedValue(new Error('boom'))
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    expect(document.body.textContent).toContain('Kertas tidak dapat dimuatkan.')
  })

  it('shows the verdict error of a failed check without losing the pick', async () => {
    server.getKuizPaperPage.mockResolvedValue(page1)
    server.checkKuizPaper.mockRejectedValue(new BijakError('bad_request', 'Jawapan tidak sah.'))
    await mountPage(PaperQuizPage, '/simulasi/p1/kuiz')
    const first = q('[data-testid="kuiz-item-q1"]')!
    const radio = first.querySelector('[data-testid="mcq-option-A"] input') as HTMLInputElement
    radio.checked = true
    radio.dispatchEvent(new Event('change'))
    await flushPromises()
    ;(first.querySelector('[data-testid=kuiz-semak]') as HTMLElement).click()
    await flushPromises()
    expect(first.textContent).toContain('Jawapan tidak sah.')
    expect(text('[data-testid=paper-quiz-score]')).toBe('Skor: 0 / 3')
  })
})
