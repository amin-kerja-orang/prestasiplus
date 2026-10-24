// @vitest-environment jsdom
/**
 * FB-048 review: Mod Peperiksaan locks the other questions of a full choose-N section.
 *  - QuestionBlock: a locked question disables its inputs, ignores an option click and shows the note.
 *  - AttemptPage: typing ticks the question, the next one locks, unticking lifts the lock.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { computed } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import QuestionBlock from '../components/QuestionBlock.vue'
import { chooseLockedHint } from '../domain/choose-n'
import type { QuestionView } from '../domain/types'
import { setBijakServerForTests } from '../server/client'
import { BijakServer, MemoryStorage } from '../server/store'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { attemptId: (globalThis as { __attempt?: string }).__attempt },
    query: {},
  }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('../lib/use-bijak', () => ({
  useBijakUser: () => computed(() => 7),
  useLearnerTheme: () => undefined,
}))

const stubs = {
  MathField: true,
  UDrawer: true,
  UModal: true,
  DsQuizHeader: true,
  DsFeedbackSheet: true,
}

// jsdom has no Element.scrollTo (AttemptPage scrolls the paper to the top on every move)
Element.prototype.scrollTo = () => undefined

afterEach(() => {
  setBijakServerForTests(null)
  document.body.innerHTML = ''
})

describe('QuestionBlock with a locked question (Mod Peperiksaan)', () => {
  const base = {
    id: 'q',
    number: 4,
    sectionId: 's',
    topic: 't',
    formOrigin: 'T4' as const,
    stem: 'Jelaskan peranan kerjasama antara kaum.',
    marks: 10,
  }
  const choose = {
    chosen: false,
    dimmed: true,
    blocked: true,
    locked: true,
    hint: chooseLockedHint(1),
  }

  it('disables the answer inputs and shows the lock note', () => {
    const q: QuestionView = {
      ...base,
      parts: [
        { id: 'q-a', label: '', prompt: 'Jawapan anda.', marks: 10, answer: { kind: 'essay' } },
      ],
    }
    const w = mount(QuestionBlock, {
      props: { question: q, answers: {}, attemptId: 'a', flagged: false, choose },
      global: { stubs },
    })
    expect(w.get('textarea').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid=choose-hint]').text()).toBe(
      'Anda sudah memilih 1 soalan. Nyahpilih soalan lain untuk menjawab soalan ini.',
    )
    expect(w.get('[data-testid=choose-checkbox]').attributes('disabled')).toBeDefined()
  })

  it('ignores a click on an option of a locked MCQ', async () => {
    const q: QuestionView = {
      ...base,
      mcq: {
        options: [
          { id: 'o1', text: 'Satu' },
          { id: 'o2', text: 'Dua' },
        ],
      },
    }
    const w = mount(QuestionBlock, {
      props: { question: q, answers: {}, attemptId: 'a', flagged: false, choose },
      global: { stubs },
    })
    const opt = w.get('[data-testid=option-o1]')
    expect(opt.attributes('disabled') ?? opt.attributes('aria-disabled')).toBeDefined()
    await opt.trigger('click')
    expect(w.emitted('answer')).toBeUndefined()
  })

  it('an unlocked question still takes answers', async () => {
    const q: QuestionView = { ...base, mcq: { options: [{ id: 'o1', text: 'Satu' }] } }
    const w = mount(QuestionBlock, {
      props: {
        question: q,
        answers: {},
        attemptId: 'a',
        flagged: false,
        choose: { chosen: true, dimmed: false, blocked: true, locked: false },
      },
      global: { stubs },
    })
    await w.get('[data-testid=option-o1]').trigger('click')
    expect(w.emitted('answer')).toHaveLength(1)
  })
})

describe('AttemptPage: auto-tick, lock, untick (Sejarah K2, Bahagian B choose 1 of 2)', () => {
  async function open(mode: 'exam' | 'latihan') {
    const server = new BijakServer({ storage: new MemoryStorage(), latencyMs: 0 })
    setBijakServerForTests(server, new MemoryStorage())
    const { attemptId } = await server.startAttempt(7, 'sej-k2-2025-a', mode)
    ;(globalThis as { __attempt?: string }).__attempt = attemptId
    const { default: AttemptPage } = await import('../pages/AttemptPage.vue')
    const w = mount(AttemptPage, { attachTo: document.body, global: { stubs } })
    await flushPromises()
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid=${id}]`)
    const next = async () => {
      q('next')!.click()
      await flushPromises()
    }
    return { w, q, next, flush: flushPromises }
  }
  const type = async (el: HTMLTextAreaElement, text: string) => {
    el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const tickBox = (q: (id: string) => HTMLElement | null) =>
    q('choose-checkbox') as HTMLButtonElement

  it('Peperiksaan: typing ticks Q3, Q4 locks, unticking Q3 lifts the lock, re-ticking at the cap locks Q3', async () => {
    const { q, next, w } = await open('exam')
    await next()
    await next()
    expect(q('question-heading')!.textContent).toContain('Soalan 3')
    await type(q('short-text-input') as HTMLTextAreaElement, 'Perlembagaan melindungi hak rakyat.')
    expect(tickBox(q).getAttribute('aria-checked')).toBe('true')
    expect(q('choose-counter')!.textContent).toContain('1 / 1')

    await next()
    expect(q('question-heading')!.textContent).toContain('Soalan 4')
    expect((q('short-text-input') as HTMLTextAreaElement).disabled).toBe(true)
    expect(q('choose-hint')!.textContent).toContain('untuk menjawab soalan ini')

    // back to Q3 and untick: Q4 opens, the Q3 answer is kept
    q('prev')!.click()
    await flushPromises()
    tickBox(q).click()
    await flushPromises()
    expect((q('short-text-input') as HTMLTextAreaElement).value).toBe(
      'Perlembagaan melindungi hak rakyat.',
    )
    expect(q('choose-counter')!.textContent).toContain('0 / 1')
    await next()
    expect((q('short-text-input') as HTMLTextAreaElement).disabled).toBe(false)
    expect(q('choose-hint')).toBeNull()

    // typing in Q4 ticks it (cap reached) and locks Q3 again
    await type(q('short-text-input') as HTMLTextAreaElement, 'Kerjasama kaum.')
    expect(tickBox(q).getAttribute('aria-checked')).toBe('true')
    q('prev')!.click()
    await flushPromises()
    expect((q('short-text-input') as HTMLTextAreaElement).disabled).toBe(true)
    w.unmount()
  })

  it('Latihan: nothing is locked and the over-answer note appears', async () => {
    const { q, next, w } = await open('latihan')
    await next()
    await next()
    await type(q('short-text-input') as HTMLTextAreaElement, 'Perlembagaan melindungi hak rakyat.')
    await next()
    expect((q('short-text-input') as HTMLTextAreaElement).disabled).toBe(false)
    expect(q('choose-hint')!.textContent).toContain('untuk menukar pilihan')
    await type(q('short-text-input') as HTMLTextAreaElement, 'Kerjasama kaum.')
    expect(q('choose-overflow')!.textContent).toContain('Hanya 1 soalan')
    w.unmount()
  })
})
