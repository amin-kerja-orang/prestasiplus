// @vitest-environment jsdom
// REQ-A-012 (AC-20.3): "Untuk Kegunaan Pemeriksa" only when cover.examinerGrid === true.
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { examinerGridRows } from '../lib/examiner-grid'
import PaperCoverPage from '../pages/PaperCoverPage.vue'
import { BijakServer, MemoryStorage } from '../server/store'
import type { PaperCover } from '../domain/types'

const h = vi.hoisted((): { cover: unknown } => ({ cover: undefined }))
vi.mock('../server/client', () => ({
  bijakServer: () => ({
    getCover: () => Promise.resolve(h.cover),
    listAttempts: () => Promise.resolve([]),
    findOpenAttempt: () => Promise.resolve(null),
  }),
}))

const USER = 5

describe('mock derives examinerGrid', () => {
  const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
  it('false for an all-objective paper', async () => {
    expect((await server.getCover(USER, 'mat-k1-2025-a')).examinerGrid).toBe(false)
  })
  it('true when a placed question has a points or rubric scheme', async () => {
    expect((await server.getCover(USER, 'mat-k2-2025-a')).examinerGrid).toBe(true)
  })
})

describe('PaperCoverPage grid', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const base = {
    id: 'p', title: 'T', code: '1449/2', subjectName: 'Matematik', kertas: 2, durationMin: 150, marks: 100, questionCount: 10,
    instructions: ['Jawab semua.'], reference: [],
    sections: [{ label: 'Bahagian A', marks: 40, instruction: 'Jawab semua soalan.', questionCount: 5, compulsory: false }],
  }
  async function render(cover: Partial<PaperCover>) {
    h.cover = { ...base, ...cover }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/spm/bijak/kertas/:id', component: PaperCoverPage }, { path: '/:p(.*)', component: { template: '<i/>' } }] })
    await router.push('/spm/bijak/kertas/p')
    const w = mount(PaperCoverPage, { global: { plugins: [router] } })
    await flushPromises()
    return w
  }
  it('shows the grid only when examinerGrid is exactly true', async () => {
    const on = await render({ examinerGrid: true })
    expect(on.get('[data-testid="examiner-grid"]').text()).toContain('Untuk Kegunaan Pemeriksa')
    expect(on.get('[data-testid="examiner-grid"]').text()).toContain('Bahagian A')
    for (const v of [false, undefined]) {
      const off = await render({ examinerGrid: v })
      expect(off.find('[data-testid="examiner-grid"]').exists()).toBe(false)
      expect(off.text()).not.toContain('Untuk Kegunaan Pemeriksa')
    }
  })
})

describe('examiner grid rows (V2 headers, Jumlah row) on all four mock papers', () => {
  const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
  const IDS = ['mat-k1-2025-a', 'mat-k2-2025-a', 'sn-k2-2025-a', 'sej-k2-2025-a']

  it('Soalan is the cumulative question-number range, Jumlah carries cover.marks', async () => {
    for (const id of IDS) {
      const cover = await server.getCover(USER, id)
      const rows = examinerGridRows(cover)
      expect(rows.at(-1), id).toMatchObject({ bhg: 'Jumlah', penuh: cover.marks, diperoleh: '' })
      expect(rows).toHaveLength(cover.sections.length + 1)
      let next = 1
      cover.sections.forEach((sec, i) => {
        const to = next + sec.questionCount - 1
        expect(rows[i]!.soalan, `${id} ${sec.label}`).toBe(sec.questionCount === 1 ? String(next) : `${String(next)}–${String(to)}`)
        expect(rows[i]!.penuh).toBe(sec.marks)
        next = to + 1
      })
      expect(rows.at(-1)!.soalan).toBe(cover.questionCount === 1 ? '1' : `1–${String(next - 1)}`)
    }
  })

  it('the page prints the V2 headers and the Jumlah row only for a paper with an examiner grid', async () => {
    for (const id of IDS) {
      const cover = await server.getCover(USER, id)
      h.cover = cover
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/spm/bijak/kertas/:id', component: PaperCoverPage }, { path: '/:p(.*)', component: { template: '<i/>' } }] })
      await router.push(`/spm/bijak/kertas/${id}`)
      const w = mount(PaperCoverPage, { global: { plugins: [router] } })
      await flushPromises()
      const grid = w.find('[data-testid="examiner-grid"]')
      expect(grid.exists(), id).toBe(cover.examinerGrid === true)
      if (grid.exists()) {
        const t = grid.text()
        for (const head of ['Bhg', 'Soalan', 'Penuh', 'Diperoleh', 'Jumlah']) expect(t, `${id} ${head}`).toContain(head)
        expect(t).not.toContain('Markah penuh')
      }
    }
  })
})
