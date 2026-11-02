// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BANK, PAPERS } from '../data/registry'
import type { PaperCover } from '../domain/types'
import PaperCoverPage from '../pages/PaperCoverPage.vue'
import { BijakServer, MemoryStorage } from '../server/store'

const server = vi.hoisted(() => ({
  getCover: vi.fn(),
  findInProgress: vi.fn(),
  startAttempt: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

function cover(examinerGrid: boolean): PaperCover {
  return {
    id: 'p1',
    title: 'Kertas Contoh',
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 2,
    code: 'MAT-2',
    year: 2025,
    durationMin: 90,
    questionCount: 3,
    marks: 40,
    kind: 'pilihan',
    status: 'belum',
    instructions: ['Jawab semua soalan.'],
    reference: [],
    examinerGrid,
    sections: [
      {
        label: 'Bahagian A',
        marks: 25,
        instruction: 'Jawab semua soalan.',
        questionCount: 2,
        compulsory: false,
      },
      {
        label: 'Bahagian B',
        marks: 15,
        instruction: 'Jawab semua soalan.',
        questionCount: 1,
        compulsory: false,
      },
    ],
  }
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

async function render(c: PaperCover): Promise<VueWrapper> {
  server.getCover.mockResolvedValue(c)
  server.findInProgress.mockResolvedValue(null)
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/simulasi/:paperId', name: 'cover', component: stub }],
  })
  await router.push('/simulasi/p1')
  wrapper = mount(PaperCoverPage, {
    global: {
      plugins: [router],
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('cover examiner grid (AC-20.3)', () => {
  it('renders "Untuk Kegunaan Pemeriksa" with its columns and Jumlah row when examinerGrid is true', async () => {
    const w = await render(cover(true))
    const grid = w.find('[data-testid="examiner-grid"]')
    expect(grid.exists()).toBe(true)
    expect(grid.text()).toContain('Untuk Kegunaan Pemeriksa')
    expect(grid.findAll('thead th').map((t) => t.text())).toEqual([
      'Bhg',
      'Soalan',
      'Penuh',
      'Diperoleh',
    ])
    const cell = (tr: { findAll: (s: string) => { text: () => string }[] }): string[] =>
      tr.findAll('td').map((c) => c.text().replace(/\u00a0/g, ''))
    expect(grid.findAll('tbody tr').map((r) => cell(r))).toEqual([
      ['Bahagian A', '2', '25', ''],
      ['Bahagian B', '1', '15', ''],
      ['Jumlah', '', '40', ''],
    ])
    // Own scroll container, so the page never scrolls sideways.
    expect(grid.find('.overflow-x-auto').exists()).toBe(true)
  })

  it('renders nothing when examinerGrid is false', async () => {
    const w = await render(cover(false))
    expect(w.find('[data-testid="examiner-grid"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Untuk Kegunaan Pemeriksa')
  })
})

describe('mock store derives examinerGrid like the API (points or rubric scheme)', () => {
  const store = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
  const kinds = (qid: string): string[] => {
    const q = BANK.questions.get(qid)!
    const ids = q.mcq ? [q.id] : leafIds(q.parts ?? [])
    return ids.map((id) => BANK.schemes.get(id)?.kind ?? 'none')
  }
  const leafIds = (parts: { id: string; parts?: unknown[] }[]): string[] =>
    parts.flatMap((p) => (p.parts?.length ? leafIds(p.parts as never) : [p.id]))

  it('is a boolean on every seeded paper and equals "some placed question has a points/rubric scheme"', async () => {
    let seenTrue = 0
    let seenFalse = 0
    for (const p of PAPERS) {
      const c = await store.getCover(7, p.id)
      expect(typeof c.examinerGrid).toBe('boolean')
      const expected = p.sections.some((s) =>
        s.questionIds.some((qid) => kinds(qid).some((k) => k === 'points' || k === 'rubric')),
      )
      expect(c.examinerGrid, p.id).toBe(expected)
      if (expected) seenTrue++
      else seenFalse++
    }
    expect(seenTrue + seenFalse).toBe(PAPERS.length)
  })

  it('is false for a paper whose questions are all option/mapping/accepted', async () => {
    const auto = PAPERS.find((p) =>
      p.sections.every((s) =>
        s.questionIds.every((qid) => kinds(qid).every((k) => k !== 'points' && k !== 'rubric')),
      ),
    )
    expect(auto, 'a seeded all-automatic paper').toBeDefined()
    expect((await store.getCover(7, auto!.id)).examinerGrid).toBe(false)
  })

  it('is true for a paper with a points or rubric question', async () => {
    const manual = PAPERS.find((p) =>
      p.sections.some((s) =>
        s.questionIds.some((qid) => kinds(qid).some((k) => k === 'points' || k === 'rubric')),
      ),
    )
    expect(manual, 'a seeded paper with a person-marked part').toBeDefined()
    expect((await store.getCover(7, manual!.id)).examinerGrid).toBe(true)
  })
})
