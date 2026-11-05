// @vitest-environment jsdom
// R1-F08: the Set Builder page against a stub BuilderApi (placements, review gating, D90 units).
import type { BijakBuilderReview } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SetBuilderPage from '../admin/builder/pages/SetBuilderPage.vue'
import { BuilderError, type BuilderApi } from '../admin/builder/server/api'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import { useFlashStore } from '@/stores/flash'
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
  paperId: 'p1', status: 'draf', ok: true, blockers: [], blockerDetails: [], canOverride: false, notes: [], blueprintNeedsReview: false,
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
    const { m, api } = stub({ review: vi.fn().mockResolvedValue({ ...okReview, ok: false, blockers: ['Bahagian A: kurang 1 soalan', 'Jumlah markah tidak sepadan'], blockerDetails: [{ code: 'COUNT_TOO_FEW', message: 'Bahagian A: kurang 1 soalan', overridable: false }, { code: 'MARKS_MISMATCH', message: 'Jumlah markah tidak sepadan', overridable: false }] }) })
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

  it('V2 parity: pinned chip with its tooltip, live-banner "Salin untuk sunting", "Tarik balik ke draf"', async () => {
    const ed = editor(paper({ status: 'terbit' }))
    ed.questions[0]!.pinned = true
    const { m, api } = stub({ getEditor: vi.fn().mockResolvedValue(ed) })
    const w = await render(api)
    expect(w.findAll('[data-testid="chip-pinned"]')).toHaveLength(1)
    expect(w.get('[data-testid="chip-pinned"]').text()).toContain('Disematkan')
    expect(w.get('[data-testid="chip-pinned"]').attributes('title')).toBe('Versi soalan ini dibekukan untuk kertas ini.')
    expect(w.get('[data-testid="builder-withdraw"]').text()).toContain('Tarik balik ke draf')
    expect(w.get('[data-testid="builder-view-student"]').attributes('href')).toBe('/spm/bijak')
    await w.get('[data-testid="builder-copy-for-edit"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="builder-copy-for-edit"]').text()).toContain('Salin untuk sunting')
    expect(m.copy).toHaveBeenCalledWith('p1')
  })

  it('V2 parity: bank search label and the 150-row cap sentence', async () => {
    const mk = (i: number) => ({
      questionIds: [`b${i}`],
      questions: [{ id: `b${i}`, preview: `B${i}`, marks: 1, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 2, subject: 'MAT' }],
      marks: 1, eligible: true, reasons: [], placed: false,
    })
    const units = Array.from({ length: 150 }, (_, i) => mk(i))
    const { api } = stub({ pool: vi.fn().mockResolvedValue({ units, total: 400, totalPages: 8 }) })
    const w = await render(api)
    expect(w.get('[data-testid="bank-search"]').attributes('placeholder')).toBe('Cari soalan…')
    expect(w.get('[data-testid="bank-cap"]').text()).toBe('Menunjukkan 150 teratas — tapis lagi untuk menyempitkan.')
    expect(w.find('[data-testid="bank-more"]').exists()).toBe(false)
    expect(w.get('[data-testid="bank-count"]').text()).toBe('400 soalan (dipaparkan 150 pertama)')
  })

  describe('S3-T02: what came from Pembina Kertas', () => {
    it('the per-Bahagian chips, budget-check and Jumlah markah follow the rule (FR-QA-41: a group is one unit)', async () => {
      const ed = editor(paper({ sections: [{ id: 's1', label: 'Bahagian A', markBudget: 4, questionCount: 3, rule: { type: 'choose', n: 1 }, questionIds: ['q1', 'g1', 'g2'] }] }))
      const w = await render(stub({ getEditor: vi.fn().mockResolvedValue(ed) }).api)
      expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Soalan 3 / 3')
      // Pilih 1 of the units: q1 (2 marks) and the group (2 + 2): the largest unit counts.
      expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Markah 4 / 4')
      expect(w.get('[data-testid="builder-total"]').text()).toContain('4 markah')
      expect(w.get('[data-testid="budget-check"]').text()).toContain('Sepadan dengan blueprint')
    })

    it('budget-check lists what does not match', async () => {
      const w = await render(stub().api)
      expect(w.get('[data-testid="budget-check"]').text()).toContain('Belum sepadan dengan blueprint (1 perkara)')
      expect(w.get('[data-testid="budget-issues"]').text()).toContain('Bahagian A: Markah 6 tidak sama dengan bajet 10')
    })

    it('the rule control writes the rule through updateSection; N is checked first', async () => {
      const ed = editor()
      const updateSection = vi.fn().mockImplementation((_id: string, _sid: string, patch: { rule: never }) => Promise.resolve(editor(paper({ sections: [{ ...ed.paper.sections[0]!, rule: patch.rule }] }))))
      const w = await render(stub({ updateSection }).api)
      const select = w.get('[data-testid="rule-type-0"]')
      await select.setValue('choose')
      await flushPromises()
      expect(updateSection).toHaveBeenCalledWith('p1', 's1', { rule: { type: 'choose', n: 1 } })
      const input = w.get('[data-testid="rule-n-0"]')
      updateSection.mockClear()
      // Two units in the full Bahagian: q1 and the group.
      await input.setValue('3')
      await input.trigger('blur')
      await flushPromises()
      expect(updateSection).not.toHaveBeenCalled()
      expect(w.get('[data-testid="builder-rule-0"]').text()).toContain('Nombor N tidak sah.')
      await input.setValue('2')
      await input.trigger('blur')
      await flushPromises()
      expect(updateSection).toHaveBeenCalledWith('p1', 's1', { rule: { type: 'choose', n: 2 } })
    })

    it('a refused rule (Wajib dijawab) shows the server line and the control goes back', async () => {
      const refused = new BuilderError('invalid', 'Bahagian wajib dijawab tidak boleh digabungkan dengan Pilih N.')
      const w = await render(stub({ updateSection: vi.fn().mockRejectedValue(refused) }).api)
      await w.get('[data-testid="rule-type-0"]').setValue('choose')
      await flushPromises()
      expect((w.get('[data-testid="rule-type-0"]').element as HTMLSelectElement).value).toBe('all')
      expect(w.find('[data-testid="rule-n-0"]').exists()).toBe(false)
    })

    it('Tulis soalan baharu per Bahagian keeps the subject, kertas and paper', async () => {
      const w = await render(stub().api)
      const href = w.get('[data-testid="write-0"]').attributes('href')!
      expect(href).toContain('/admin/spm/soalan/manual')
      expect(href).toContain('subject=MAT')
      expect(href).toContain('kertas=2')
      expect(href).toContain('paper=p1')
    })

    it('chip Tidak disajikan with the reason as its tooltip', async () => {
      const ed = editor()
      Object.assign(ed.questions[0]!, { servable: false, notServedReason: 'Soalan ini diarkibkan.' })
      const w = await render(stub({ getEditor: vi.fn().mockResolvedValue(ed) }).api)
      const chips = w.findAll('[data-testid="chip-not-served"]')
      expect(chips).toHaveLength(1)
      expect(chips[0]!.text()).toContain('Tidak disajikan')
      expect(chips[0]!.attributes('title')).toBe('Soalan ini diarkibkan.')
    })

    it('Terbitkan off carries the title "Betulkan {n} masalah dahulu" (AC-ADM-Q15.1)', async () => {
      const w = await render(stub({ review: vi.fn().mockResolvedValue({ ...okReview, ok: false, blockers: ['a', 'b'], blockerDetails: ['a', 'b'].map((message) => ({ code: 'COUNT_TOO_FEW', message, overridable: false })) }) }).api)
      expect(w.get('[data-testid="builder-publish"]').attributes('title')).toBe('Betulkan 2 masalah dahulu')
    })

    it('a refused Terbitkan says "Set ini tidak lulus pengesahan."; offline says the network line', async () => {
      const show = vi.spyOn(useFlashStore(), 'show')
      const publish = vi.fn().mockResolvedValue({ ok: false, errors: ['x'], blockerDetails: [], canOverride: false })
      const w = await render(stub({ publish }).api)
      await w.get('[data-testid="builder-publish"]').trigger('click')
      await flushPromises()
      expect(show).toHaveBeenCalledWith({ type: 'error', message: 'Set ini tidak lulus pengesahan.' })
      publish.mockRejectedValue(new BuilderError('offline', 'Luar talian'))
      await w.get('[data-testid="builder-publish"]').trigger('click')
      await flushPromises()
      expect(show).toHaveBeenCalledWith({ type: 'error', message: 'Ralat rangkaian semasa menerbitkan.' })
    })

    it('Tahun and Negeri stay hidden while their column holds no data, and filter once it does', async () => {
      const none = await render(stub({ pool: vi.fn().mockResolvedValue({ units: [], total: 0, totalPages: 1, filters: { years: [], negeri: [] } }) }).api)
      expect(none.find('[data-testid="bank-tahun"]').exists()).toBe(false)
      expect(none.find('[data-testid="bank-negeri"]').exists()).toBe(false)
      none.unmount()
      const pool = vi.fn().mockResolvedValue({ units: [], total: 0, totalPages: 1, filters: { years: [2025, 2024], negeri: ['Johor', 'MRSM'] } })
      const w = await render(stub({ pool }).api)
      await w.get('[data-testid="bank-tahun"]').setValue('2024')
      await flushPromises()
      expect(pool.mock.calls.at(-1)![2]).toMatchObject({ tahun: 2024 })
      await w.get('[data-testid="bank-negeri-toggle"]').trigger('click')
      expect(w.get('[data-testid="bank-negeri-toggle"]').text()).toContain('2 pilihan')
      await w.get('[data-testid="bank-negeri-MRSM"]').trigger('click')
      await flushPromises()
      expect(pool.mock.calls.at(-1)![2]).toMatchObject({ tahun: 2024, negeri: ['MRSM'] })
      expect(w.get('[data-testid="bank-negeri-toggle"]').text()).toContain('1 pilihan')
    })

    it('Sunting bahagian and Sunting petikan are here now, and save at once', async () => {
      const ed = editor()
      const updateSection = vi.fn().mockResolvedValue(ed)
      const updateGroupLabel = vi.fn().mockResolvedValue(ed)
      const w = await render(stub({ updateSection, updateGroupLabel }).api)
      await w.get('[data-testid="section-label-0"]').setValue('Bahagian Z')
      await w.get('[data-testid="edit-section-0"]').trigger('submit')
      await flushPromises()
      expect(updateSection).toHaveBeenCalledWith('p1', 's1', expect.objectContaining({ label: 'Bahagian Z' }))
      await w.get('[data-testid="passage-title-grp"]').setValue('Rajah Baharu')
      await w.get('[data-testid="edit-passage-grp"]').trigger('submit')
      await flushPromises()
      expect(updateGroupLabel).toHaveBeenCalledWith('p1', 'grp', 'Rajah Baharu')
    })

    it('the contract panel names the Kontrak', async () => {
      const w = await render(stub().api)
      expect(w.get('[data-testid="builder-contract"]').text()).toContain('Kontrak Simulasi')
      expect(w.get('[data-testid="builder-contract"]').text()).toContain('Tiada kontrak untuk subjek/kertas ini.')
    })
  })
})
