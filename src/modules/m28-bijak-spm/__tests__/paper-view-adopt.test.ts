// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { PaperView } from '../../../components/question-display'
import { sectionMeta } from '../../../components/question-display/copy'
import StudentViewDrawer from '../admin/builder/components/StudentViewDrawer.vue'
import QuestionPreview from '../admin/papers/QuestionPreview.vue'
import PaperCoverPage from '../pages/PaperCoverPage.vue'

const server = vi.hoisted(() => ({ getCover: vi.fn(), findInProgress: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, '')
const noFixedWidth = (html: string): boolean => !/\b(?:min-)?w-\[\d+px\]|\bw-(?:96|80|72|64)\b/.test(html)

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('S8-T05 surfaces adopt PaperView', () => {
  it('PaperCoverPage: section lines keep "label · [N markah] · N soalan · instruction (wajib)"', async () => {
    server.getCover.mockResolvedValue({
      id: 'p1', title: 'Set 1', subjectName: 'Matematik', code: '1449/1', kertas: 1, durationMin: 75, marks: 10,
      subject: 'MAT', year: 2025, status: 'baru', instructions: ['Jawab semua.'], reference: [], questionCount: 10,
      sections: [
        { label: 'Bahagian A', marks: 6, questionCount: 4, instruction: 'Jawab semua soalan.', compulsory: true },
        { label: 'Bahagian B', marks: 4, questionCount: 6, instruction: 'Pilih dua.', compulsory: false },
      ],
    })
    server.findInProgress.mockResolvedValue(null)
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spm/bijak/kertas/:paperId', component: PaperCoverPage },
        { path: '/spm/bijak', component: stub },
      ],
    })
    await router.push('/spm/bijak/kertas/p1')
    wrapper = mount({ template: '<RouterView/>' }, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    const root = document.body.querySelector('[data-testid=cover-sections]')!
    const lines = [...root.querySelectorAll('li')].map((p) => norm(p.textContent))
    expect(lines).toEqual([
      norm('Bahagian A · [6 markah] · 4 soalan · Jawab semua soalan. (wajib)'),
      norm('Bahagian B · [4 markah] · 6 soalan · Pilih dua.'),
    ])
    // DOM shape as V3: ul.flex.flex-col.gap-1 > li > strong first, then the text (no wrapper).
    expect(root.tagName).toBe('UL')
    expect(root.classList.contains('flex-col') && root.classList.contains('gap-1')).toBe(true)
    expect([...root.children].map((c) => c.tagName)).toEqual(['LI', 'LI'])
    expect(root.querySelector('li')!.firstElementChild!.tagName).toBe('STRONG')
    expect(root.querySelector('li p, li div')).toBeNull()
    expect(noFixedWidth(root.outerHTML)).toBe(true)
  })

  it('QuestionPreview: header, stem, parts, marks and scheme lines read as before; no scheme when hidden', () => {
    const q = {
      id: 'q1', stem: 'Terangkan fotosintesis.', marks: 3,
      parts: [
        { id: 'a', label: '(a)', prompt: 'Takrif', marks: 0, children: [{ id: 'a1', label: '(i)', prompt: 'Nyatakan', marks: 2 }] },
        { id: 'b', label: '(b)', prompt: 'Jelaskan', marks: 1 },
      ],
      scheme: { a1: { marks: 2, lines: [{ tag: 'K1', text: 'Klorofil', marks: 1 }] }, b: null },
    } as never
    const shown = mount(QuestionPreview, { props: { questions: [q], start: 5 } })
    const t = norm(shown.find('[data-testid="preview-q-q1"]').text())
    expect(t).toBe(norm(
      'Soalan 5 [3 markah] Terangkan fotosintesis. (a) Takrif (i) Nyatakan [2] K1 Klorofil (1) (b) Jelaskan [1] Skema markah belum ada'),
    )
    expect(noFixedWidth(shown.html())).toBe(true)
    const hidden = mount(QuestionPreview, { props: { questions: [q], start: 5, hideScheme: true } })
    expect(norm(hidden.text())).toBe(norm('Soalan 5 [3 markah] Terangkan fotosintesis. (a) Takrif (i) Nyatakan [2] (b) Jelaskan [1]'))
    expect(hidden.find('[data-testid="scheme-a1"]').exists()).toBe(false)
  })

  it('QuestionPreview: MCQ keeps options, correct marker and answer scheme', () => {
    const q = {
      id: 'm1', stem: 'Pilih.', marks: 1,
      mcq: { options: [{ id: 'o1', text: 'Satu' }, { id: 'o2', text: 'Dua' }], correct: 'o2' },
      scheme: { m1: { marks: 1, lines: [{ text: 'B' }] } },
    } as never
    const w = mount(QuestionPreview, { props: { questions: [q] } })
    expect(norm(w.text())).toBe(norm('Soalan 1 [1 markah] Pilih. A. Satu B. Dua B'))
    expect(w.findAll('[data-correct="true"]')).toHaveLength(1)
  })

  it('StudentViewDrawer: question numbers, marks and previews are unchanged', async () => {
    const view = {
      title: 'Set 1', subjectName: 'Matematik', kertas: 1, code: '1449/1', durationMin: 75, marks: 10, instructions: [],
      sections: [{ label: 'Bahagian A', instruction: 'Jawab semua.', units: [{ questions: [{ id: 'x1', number: 1, marks: 2, preview: 'Hitung 2+2' }] }] }],
    } as never
    wrapper = mount(StudentViewDrawer, { props: { view, open: true }, attachTo: document.body })
    await flushPromises()
    const q = document.body.querySelector('[data-testid="student-q-x1"]')!
    expect(norm(q.textContent)).toBe(norm('Soalan 1 [2 markah] Hitung 2+2'))
    expect(noFixedWidth(q.outerHTML)).toBe(true)
  })
})

describe('S8-T05 PaperView options', () => {
  const part = (id: string, children?: unknown[]) => ({ id, label: id, prompt: 'p', marks: 1, children })
  const sec = (id: string) => ({
    id,
    label: 'Bahagian',
    questions: [{ id: `${id}-q`, number: 1, marks: 3, stem: 'Stem', parts: [part('a', [part('a1', [part('a2')])])] }],
  })

  it('indent per depth: sm = w-3 (12px), md = w-6 (24px)', () => {
    for (const [step, cls] of [['sm', 'w-3'], ['md', 'w-6'], [undefined, 'w-3']] as const) {
      const w = mount(PaperView, { props: { sections: [sec('s')] as never, indentStep: step } })
      const count = (id: string) => w.find(`[data-testid="paper-part-${id}"]`).findAll('[data-testid="paper-indent"]')
      expect(count('a')).toHaveLength(0)
      expect(count('a1')).toHaveLength(1)
      expect(count('a2')).toHaveLength(2)
      expect(count('a2').every((e) => e.classes().includes(cls))).toBe(true)
    }
  })

  it('sectionHead=false renders no section line; true renders it', () => {
    const off = mount(PaperView, { props: { sections: [sec('s')] as never, sectionHead: false } })
    expect(off.find('[data-testid="paper-section-line"]').exists()).toBe(false)
    expect(off.text()).not.toContain('Bahagian')
    const on = mount(PaperView, { props: { sections: [sec('s')] as never } })
    expect(on.find('[data-testid="paper-section-line"]').exists()).toBe(true)
  })

  it('sections with a repeated or missing id still all render (keyed by index)', () => {
    const w = mount(PaperView, { props: { sections: [sec('x'), sec('x'), sec(undefined as never)] as never } })
    expect(w.findAll('[data-testid="paper-section-line"]')).toHaveLength(3)
  })

  it('sectionMeta with an empty instruction', () => {
    expect(sectionMeta(5, 2, '', false)).toBe(' · [5 markah] · 2 soalan')
    expect(sectionMeta(5, 2, '', true)).toBe(' · [5 markah] · 2 soalan · (wajib)')
    expect(sectionMeta(undefined, 1, undefined, false)).toBe(' · 1 soalan')
    expect(sectionMeta(5, 2, 'Pilih.', true)).toBe(' · [5 markah] · 2 soalan · Pilih. (wajib)')
  })
})
