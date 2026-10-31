// @vitest-environment jsdom
// R1-F08: the Set Builder page against a stub BuilderApi (placements, review gating, D90 units).
import type { BijakBuilderReview } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SetBuilderPage from '../admin/builder/pages/SetBuilderPage.vue'
import type { BuilderApi } from '../admin/builder/server/api'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import type { AdminPaper, PaperEditorData } from '../domain/admin-types'

function paper(over: Partial<AdminPaper> = {}): AdminPaper {
  return {
    id: 'p1',
    title: 'Set Ujian',
    subject: 'MAT',
    kertas: 2,
    year: 2026,
    code: '1449/2',
    durationMin: 150,
    instructions: [],
    status: 'draf',
    createdAt: 1,
    updatedAt: 1,
    sections: [
      { id: 's1', label: 'Bahagian A', markBudget: 10, questionCount: 3, rule: { type: 'all' }, questionIds: ['q1', 'g1', 'g2'] },
    ],
    ...over,
  }
}

function editor(p: AdminPaper = paper()): PaperEditorData {
  const q = (id: string, groupId?: string) => ({
    id,
    ...(groupId ? { groupId } : {}),
    preview: `Soalan ${id}`,
    marks: 2,
    kind: 'objektif' as const,
    topic: 'Topik',
    status: 'terbit' as const,
    kertas: 2,
    subject: 'MAT',
  })
  return {
    paper: p,
    blueprint: null,
    questions: [q('q1'), q('g1', 'grp'), q('g2', 'grp')],
    groups: [{ id: 'grp', stimulus: { id: 'grp', label: 'Rajah 1', kind: 'text', text: 'Petikan' } as never, questionIds: ['g1', 'g2'] }],
  }
}

const okReview: BijakBuilderReview = {
  paperId: 'p1', status: 'draf', ok: true, blockers: [], notes: [], blueprintNeedsReview: false,
  visibleToStudents: false, totalMarks: 6, totalBudget: 10, rows: [],
}

function stub(over: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const ed = editor()
  const m: Record<string, ReturnType<typeof vi.fn>> = {
    getEditor: vi.fn().mockResolvedValue(ed),
    review: vi.fn().mockResolvedValue(okReview),
    pool: vi.fn().mockResolvedValue({ units: [], total: 0, totalPages: 1 }),
    units: vi.fn().mockResolvedValue([]),
    reorder: vi.fn().mockImplementation(() => Promise.resolve(ed)),
    removePlacement: vi.fn().mockResolvedValue({ editor: ed, changed: [] }),
    addPlacement: vi.fn().mockResolvedValue({ editor: ed, changed: [] }),
    updateHeader: vi.fn().mockResolvedValue(ed),
    publish: vi.fn().mockResolvedValue({ ok: true, errors: [] }),
    withdraw: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue('p2'),
    studentView: vi.fn(),
    ...over,
  }
  return { m, api: m as unknown as BuilderApi }
}

let wrapper: VueWrapper | null = null

async function render(api: BuilderApi): Promise<VueWrapper> {
  setBuilderServerForTests(api)
  const stubC = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/studio/sets', component: stubC },
      { path: '/admin/studio/sets/:paper/builder', component: SetBuilderPage },
      { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: stubC },
      { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stubC },
    ],
  })
  await router.push('/admin/studio/sets/p1/builder')
  wrapper = mount(SetBuilderPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  setBuilderServerForTests(null)
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('SetBuilderPage', () => {
  it('shows a stimulus group once, as one unit with all its members and no group marks', async () => {
    const w = await render(stub().api)
    const groups = w.findAll('[data-testid^="unit-group-"]')
    expect(groups).toHaveLength(1)
    expect(groups[0]!.findAll('[data-testid="set-stimulus"]')).toHaveLength(1)
    expect(groups[0]!.text()).toContain('Soalan g1')
    expect(groups[0]!.text()).toContain('Soalan g2')
    // One remove / up / down control per unit (keyed by the first member), none per member.
    expect(w.find('[data-testid="remove-g1"]').exists()).toBe(true)
    expect(w.find('[data-testid="remove-g2"]').exists()).toBe(false)
  })

  it('Naik on a group sends one id per unit; Buang removes by the first member', async () => {
    const { m, api } = stub()
    const w = await render(api)
    await w.get('[data-testid="up-g1"]').trigger('click')
    await flushPromises()
    expect(m.reorder).toHaveBeenCalledWith('p1', 's1', ['g1', 'q1'])
    await w.get('[data-testid="remove-g1"]').trigger('click')
    await flushPromises()
    expect(m.removePlacement).toHaveBeenCalledWith('p1', 'g1')
  })

  it('disables Terbitkan and shows the reason while the review lists blockers', async () => {
    const { m, api } = stub({ review: vi.fn().mockResolvedValue({ ...okReview, ok: false, blockers: ['Bahagian A: kurang 1 soalan', 'Jumlah markah tidak sepadan'] }) })
    const w = await render(api)
    expect(w.get('[data-testid="builder-publish"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="builder-publish-reason"]').text()).toContain('2 masalah')
    expect(w.get('[data-testid="review-blockers"]').text()).toContain('Bahagian A: kurang 1 soalan')
    await w.get('[data-testid="builder-publish"]').trigger('click')
    expect(m.publish).not.toHaveBeenCalled()
  })

  it('Terbitkan is one click when the review is clean', async () => {
    const { m, api } = stub()
    const w = await render(api)
    const btn = w.get('[data-testid="builder-publish"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await flushPromises()
    expect(m.publish).toHaveBeenCalledWith('p1')
  })

  it('a published set is locked: no bank, no Terbitkan, Tarik balik and Salin set present', async () => {
    const ed = editor(paper({ status: 'terbit' }))
    const { m, api } = stub({ getEditor: vi.fn().mockResolvedValue(ed) })
    const w = await render(api)
    expect(w.find('[data-testid="builder-bank"]').exists()).toBe(false)
    expect(w.find('[data-testid="builder-publish"]').exists()).toBe(false)
    expect(w.find('[data-testid="remove-g1"]').exists()).toBe(false)
    expect(w.find('[data-testid="builder-withdraw"]').exists()).toBe(true)
    await w.get('[data-testid="builder-copy"]').trigger('click')
    await flushPromises()
    expect(m.copy).toHaveBeenCalledWith('p1')
  })

  it('adds a pool unit by its first member id and disables placed or ineligible units', async () => {
    const pool = {
      units: [
        { questionIds: ['n1'], questions: [{ id: 'n1', preview: 'Baru', marks: 2, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 2, subject: 'MAT' }], marks: 2, eligible: true, reasons: [], placed: false },
        { questionIds: ['n2'], questions: [{ id: 'n2', preview: 'Tiada skema', marks: 2, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 2, subject: 'MAT' }], marks: 2, eligible: false, reasons: ['tiada skema'], placed: false },
      ],
      total: 2,
      totalPages: 1,
    }
    const { m, api } = stub({ pool: vi.fn().mockResolvedValue(pool) })
    const w = await render(api)
    expect(w.get('[data-testid="pool-add-n2"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="pool-reasons"]').text()).toContain('tiada skema')
    await w.get('[data-testid="pool-add-n1"]').trigger('click')
    await flushPromises()
    expect(m.addPlacement).toHaveBeenCalledWith('p1', 's1', 'n1')
  })
})
