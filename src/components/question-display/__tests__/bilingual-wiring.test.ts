// @vitest-environment jsdom
// S8-T03 part 5 wiring: LanguageToggle + BilingualText in QuestionBlock (AC-PA-04), the bank in the
// stimulus panel (FR-PA-10), and the drawing template through PartNode.
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'
import type { QuestionView } from '@pp/exam-core/types'

import { reloadQuestionLang } from '../lib/question-lang'
import PartNode from '../PartNode.vue'
import QuestionBlock from '../QuestionBlock.vue'

const global = { components: formStubs }
beforeEach(() => {
  localStorage.clear()
  reloadQuestionLang()
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

const q = (over: Record<string, unknown> = {}): QuestionView =>
  ({
    id: 'q1',
    number: 1,
    sectionId: 's',
    topic: 'Bab 1',
    formOrigin: 'T4',
    stem: 'Soalan BM',
    marks: 2,
    mcq: {
      options: [
        { id: 'A', text: 'Pilihan BM', textEn: 'Option EN' },
        { id: 'B', text: 'Dua' },
      ],
    },
    ...over,
  }) as QuestionView
const mountQ = (question: QuestionView) =>
  mount(QuestionBlock, {
    props: { question, answers: {}, attemptId: 'a1', flagged: false },
    global,
  })

describe('AC-PA-04 through QuestionBlock', () => {
  it('bilingual: toggle shown, both blocks by default; BM hides English; English hides BM', async () => {
    const w = mountQ(q({ stemEn: 'English stem' }))
    expect(w.find('[data-testid=language-toggle]').exists()).toBe(true)
    expect(w.find('[data-testid=question-stem]').text()).toContain('Soalan BM')
    expect(w.find('[data-testid=question-stem]').text()).toContain('English stem')
    await w.find('[data-testid=lang-ms]').trigger('click')
    expect(w.find('[data-testid=question-stem]').text()).toBe('Soalan BM')
    expect(w.find('[data-testid=option-A]').text()).not.toContain('Option EN')
    await w.find('[data-testid=lang-en]').trigger('click')
    expect(w.find('[data-testid=question-stem]').text()).toBe('English stem')
    expect(w.find('[data-testid=option-A]').text()).toContain('Option EN')
    expect(w.find('[data-testid=option-A]').text()).not.toContain('Pilihan BM')
    expect(w.find('[data-testid=option-B]').text()).toContain('Dua')
    expect(localStorage.getItem('pp.qd.lang')).toBe('en')
  })
  it('the choice survives a remount', async () => {
    const a = mountQ(q({ stemEn: 'English stem' }))
    await a.find('[data-testid=lang-en]').trigger('click')
    a.unmount()
    reloadQuestionLang()
    const b = mountQ(q({ stemEn: 'English stem' }))
    expect(b.find('[data-testid=question-stem]').text()).toBe('English stem')
  })
  it('an option-only twin also makes the question bilingual; a part prompt twin too', () => {
    expect(mountQ(q()).find('[data-testid=language-toggle]').exists()).toBe(true)
    const parts = [
      {
        id: 'p1',
        label: '(a)',
        prompt: 'Bahagian',
        promptEn: 'Part',
        marks: 1,
        answer: { kind: 'short_text' },
      },
    ]
    const w = mountQ(q({ mcq: undefined, parts }))
    expect(w.find('[data-testid=language-toggle]').exists()).toBe(true)
    expect(w.find('[data-testid=part-p1]').text()).toContain('Part')
  })
  it('monolingual: no toggle and the stem is plain', () => {
    const w = mountQ(q({ mcq: { options: [{ id: 'A', text: 'Satu' }] } }))
    expect(w.find('[data-testid=language-toggle]').exists()).toBe(false)
    expect(w.find('[data-testid=question-stem]').text()).toBe('Soalan BM')
  })
})

describe('FR-PA-10 bank in the stimulus panel', () => {
  it('the question own-stimulus panel shows the bank once', () => {
    const w = mountQ(
      q({
        mcq: undefined,
        stimuli: [{ id: 's1', kind: 'passage', label: 'Petikan', text: 'Teks' }],
        optionBank: [
          { id: 'A', text: 'Satu' },
          { id: 'B', text: 'Dua' },
        ],
        parts: [
          { id: 'p1', label: '(a)', prompt: 'x', marks: 1, answer: { kind: 'match_letter' } },
        ],
      }),
    )
    expect(w.findAll('[data-testid=matching-bank]')).toHaveLength(1)
    expect(w.find('[data-testid=own-stimuli] [data-testid=matching-bank]').exists()).toBe(true)
    expect(w.find('[data-testid=match-bank]').exists()).toBe(true)
  })
})

describe('PartNode drawing template', () => {
  const mk = (answerTemplate: unknown) =>
    mount(PartNode, {
      props: {
        part: {
          id: 'p1',
          label: '(a)',
          prompt: 'Lukis',
          marks: 3,
          answer: { kind: 'drawing', answerTemplate },
        } as never,
        answers: {},
        attemptId: 'a1',
      },
      global,
    })
  it('a grid template reaches the pad as is', () => {
    const w = mk({ grid: { xMin: 0, xMax: 4, yMin: 0, yMax: 4, step: 1, scale: '1 cm = 1 unit' } })
    expect(w.find('[data-testid=pad-template-grid]').exists()).toBe(true)
  })
  it('an {imageId} template becomes /api/files/<id>', () => {
    const w = mk({ imageId: 'abcdefghijklmnopqrstuv' })
    expect(w.html()).toContain('/api/files/abcdefghijklmnopqrstuv')
  })
})
