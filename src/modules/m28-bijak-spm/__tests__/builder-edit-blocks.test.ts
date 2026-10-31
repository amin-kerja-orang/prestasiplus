// @vitest-environment jsdom
// R1-F09: metadata title sync, Sunting bahagian / petikan, override offer.
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import PaperEditBlocks from '../admin/builder/components/PaperEditBlocks.vue'
import PaperMetaForm from '../admin/builder/components/PaperMetaForm.vue'
import PaperReferenceEditor from '../admin/builder/components/PaperReferenceEditor.vue'
import PaperQuestionOps from '../admin/builder/components/PaperQuestionOps.vue'
import { builderCopy as t } from '../admin/builder/domain/copy'
import { hasStimulus, validTitle } from '../admin/builder/domain/stimulus'
import { usePaperActions } from '../admin/builder/lib/use-paper-actions'
import type { BuilderApi, SectionPool } from '../admin/builder/server/api'
import PublishOverride from '../admin/builder/components/PublishOverride.vue'
import { blockersOf, normalizeBlockers, overrideOffered } from '../admin/builder/domain/blockers'
import { MockBuilderServer } from '../admin/builder/server/memory'
import type { AdminPaper } from '../domain/admin-types'

const paper = { id: 'p', title: 'Set A', subject: 'MAT', kertas: 2, year: 2026, code: '1449/2', durationMin: 150, instructions: [], status: 'draf' } as unknown as AdminPaper

describe('PaperMetaForm title', () => {
  it('shares the title with the header and emits it trimmed', async () => {
    const w = mount(PaperMetaForm, { props: { paper, title: 'Set A', 'onUpdate:title': (v: string) => w.setProps({ title: v }) } })
    await w.get('[data-testid="meta-title"]').setValue('  Set B  ')
    expect(w.props('title')).toBe('  Set B  ')
    await w.get('form').trigger('submit')
    expect(w.emitted('save')![0]![0]).toMatchObject({ title: 'Set B' })
  })
  it('blocks an empty or over-long title', async () => {
    const w = mount(PaperMetaForm, { props: { paper, title: '' } })
    expect(w.get('[data-testid="meta-save"]').attributes('disabled')).toBeDefined()
    await w.setProps({ title: 'x'.repeat(201) })
    expect(w.get('[data-testid="meta-save"]').attributes('disabled')).toBeDefined()
    await w.setProps({ title: 'ok' })
    expect(w.get('[data-testid="meta-save"]').attributes('disabled')).toBeUndefined()
  })
})

describe('PublishOverride', () => {
  it('is offered only when every blocker is a blueprint line, and needs a 5+ char reason', async () => {
    const no = mount(PublishOverride, { props: { blockers: ['Soalan q1 tidak layak: x', 'Bahagian A: Kurang 1 soalan'] } })
    expect(no.find('[data-testid="publish-override"]').exists()).toBe(false)
    const w = mount(PublishOverride, { props: { blockers: ['Soalan q1 tidak layak: x'] } })
    await w.get('[data-testid="override-tick"]').trigger('click')
    await nextTick()
    expect(w.get('[data-testid="override-publish"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="override-reason"]').setValue('sebab jelas')
    await w.get('[data-testid="override-publish"]').trigger('click')
    expect(w.emitted('override')![0]).toEqual(['sebab jelas'])
  })
})

describe('Sunting bahagian / petikan (mock)', () => {
  it('renames a Bahagian and the editor form shows it', async () => {
    const api = new MockBuilderServer()
    const s = (await api.builderSubjects())[0]!
    const id = await api.create({ subject: s.code, kertas: s.kertas[0]!, title: 'T' })
    const ed = await api.getEditor(id)
    const sec = ed.paper.sections[0]!
    const after = await api.updateSection(id, sec.id, { label: 'Bahagian Baru', instruction: 'Arahan x', compulsory: true })
    const got = after.paper.sections.find((x) => x.id === sec.id)!
    expect(got).toMatchObject({ label: 'Bahagian Baru', instruction: 'Arahan x', compulsory: true })
    await expect(api.updateSection(id, sec.id, { label: '  ' })).rejects.toThrow()
    const w = mount(PaperEditBlocks, { props: { editor: after } })
    expect(w.get('[data-testid="section-label-0"]').element).toHaveProperty('value', 'Bahagian Baru')
    await w.get('[data-testid="edit-section-0"]').trigger('submit')
    expect(w.emitted('section')![0]).toEqual([sec.id, { label: 'Bahagian Baru', instruction: 'Arahan x', compulsory: true }])
  })
})

describe('override offer: both blocker shapes', () => {
  const line = 'Soalan q1 tidak layak: x'
  it('reads the A3 flags when present', () => {
    const info = normalizeBlockers([{ message: 'Bahagian A: Kurang 1', overridable: false }, { message: line, overridable: true }])
    expect(overrideOffered(info)).toBe(false)
    expect(overrideOffered(normalizeBlockers([{ message: 'cuma teks', overridable: true }]))).toBe(true)
    // canOverride wins over per-blocker flags and over the text.
    expect(overrideOffered(normalizeBlockers([line]), false)).toBe(false)
    expect(overrideOffered(normalizeBlockers(['Bahagian A: Kurang 1']), true)).toBe(true)
  })
  it('falls back to the text heuristic for plain strings', () => {
    expect(overrideOffered(normalizeBlockers([line]))).toBe(true)
    expect(overrideOffered(normalizeBlockers([line, 'Bahagian A: Kurang 1 soalan']))).toBe(false)
    expect(overrideOffered([])).toBe(false)
  })
  it('the component honours `available` over the text', () => {
    const w = mount(PublishOverride, { props: { blockers: ['Bahagian A: Kurang 1'], available: true } })
    expect(w.find('[data-testid="publish-override"]').exists()).toBe(true)
    const n = mount(PublishOverride, { props: { blockers: [line], available: false } })
    expect(n.find('[data-testid="publish-override"]').exists()).toBe(false)
  })
})

type PoolUnit = SectionPool['units'][number]

describe('Tambah / Padam soalan (local model, UX-50)', () => {
  const unit = (id: string, extra: object = {}): PoolUnit => ({
    questionIds: [id],
    questions: [{ id, preview: `P ${id}`, marks: 1, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 2, subject: 'MAT' }],
    marks: 1, eligible: true, reasons: [], placed: false, ...extra,
  }) as unknown as PoolUnit
  const sections = [{ id: 's1', label: 'Bahagian A', questionCount: 3 }]
  const known = (): undefined => undefined

  it('renders from the local ids: a unit removed locally is gone and cannot be removed twice', async () => {
    const w = mount(PaperQuestionOps, {
      props: { sections, ids: { s1: ['a', 'b'] }, known, loadPool: () => Promise.resolve({ units: [], total: 0, totalPages: 1 }) },
    })
    expect(w.findAll('[data-testid^="ops-unit-"]')).toHaveLength(2)
    await w.setProps({ ids: { s1: ['b'] } })
    expect(w.find('[data-testid="ops-unit-a"]').exists()).toBe(false)
    expect(w.find('[data-testid="ops-delete-a"]').exists()).toBe(false)
  })

  it('adds a pool unit (whole group) and disables units already placed locally', async () => {
    const group = unit('g1', { groupId: 'grp', questionIds: ['g1', 'g2'], questions: [...unit('g1').questions, ...unit('g2').questions] })
    const w = mount(PaperQuestionOps, {
      props: { sections, ids: { s1: ['a'] }, known, loadPool: () => Promise.resolve({ units: [unit('a'), group], total: 2, totalPages: 1 }) },
    })
    await w.get('[data-testid="ops-add-0"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="ops-pick-add-a"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="ops-pick-add-g1"]').trigger('click')
    const [sid, u] = w.emitted('add')![0]! as [string, { questionIds: string[] }]
    expect(sid).toBe('s1')
    expect(u.questionIds).toEqual(['g1', 'g2'])
  })

  it('search is debounced, a stale answer is dropped, Muat lagi pages on', async () => {
    vi.useFakeTimers()
    const calls: [string, number][] = []
    const resolvers: ((r: { units: PoolUnit[]; total: number; totalPages: number }) => void)[] = []
    const loadPool = (_s: string, q: string, page: number) => {
      calls.push([q, page])
      return new Promise<{ units: PoolUnit[]; total: number; totalPages: number }>((r) => resolvers.push(r))
    }
    const w = mount(PaperQuestionOps, { props: { sections, ids: { s1: [] }, known, loadPool } })
    await w.get('[data-testid="ops-add-0"]').trigger('click')
    expect(calls).toEqual([['', 1]])
    resolvers[0]!({ units: [unit('x1')], total: 40, totalPages: 2 })
    await flushPromises()
    expect(w.find('[data-testid="ops-more"]').exists()).toBe(true)
    // typing twice quickly sends ONE request
    await w.get('[data-testid="ops-search"]').setValue('a')
    await w.get('[data-testid="ops-search"]').setValue('ab')
    vi.advanceTimersByTime(300)
    expect(calls.filter(([q]) => q).map(([q]) => q)).toEqual(['ab'])
    // an older request resolving after a newer one is ignored
    await w.get('[data-testid="ops-search"]').setValue('abc')
    vi.advanceTimersByTime(300)
    expect(calls.map(([q]) => q)).toEqual(['', 'ab', 'abc'])
    resolvers[2]!({ units: [unit('new')], total: 1, totalPages: 1 })
    await flushPromises()
    resolvers[1]!({ units: [unit('stale')], total: 1, totalPages: 1 })
    await flushPromises()
    expect(w.find('[data-testid="ops-pick-new"]').exists()).toBe(true)
    expect(w.find('[data-testid="ops-pick-stale"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('read-only: no add or delete controls', () => {
    const w = mount(PaperQuestionOps, { props: { sections, ids: { s1: ['a'] }, known, readonly: true, loadPool: () => Promise.reject(new Error('x')) } })
    expect(w.find('[data-testid="ops-add-0"]').exists()).toBe(false)
    expect(w.find('[data-testid="ops-delete-a"]').exists()).toBe(false)
  })
})

describe('Empty-group placeholder (T07) and title rules', () => {
  it('a stimulus without label, text or image is not shown', () => {
    expect(hasStimulus({ label: '' })).toBe(false)
    expect(hasStimulus({ label: ' ', text: '' })).toBe(false)
    expect(hasStimulus({ label: 'Rajah 1' })).toBe(true)
    expect(hasStimulus({ label: '', text: 'Petikan' })).toBe(true)
    expect(hasStimulus({ label: '', image: { id: 'x' } })).toBe(true)
    expect(hasStimulus(undefined)).toBe(false)
  })
  it('the group badge has no blank label', () => {
    expect(t.groupBadge('', 3)).toBe('Kumpulan rangsangan · 3 soalan bergerak bersama')
    expect(t.groupBadge('Rajah 1', 2)).toContain('Rajah 1')
  })
  it('PaperEditBlocks skips the blank group', async () => {
    const api = new MockBuilderServer()
    const s = (await api.builderSubjects())[0]!
    const id = await api.create({ subject: s.code, kertas: s.kertas[0]!, title: 'T' })
    const ed = await api.getEditor(id)
    const sec = ed.paper.sections[0]!
    sec.questionIds = ['q1']
    const editor = {
      ...ed,
      groups: [{ id: 'g', stimulus: { id: 'g', kind: 'passage', label: '', alt: '' } as never, questionIds: ['q1'] }],
    }
    const w = mount(PaperEditBlocks, { props: { editor } })
    expect(w.find('[data-testid="edit-passages"]').exists()).toBe(false)
  })
  it('title rule: 1..200 after trim', () => {
    expect(validTitle('  ')).toBe(false)
    expect(validTitle('a')).toBe(true)
    expect(validTitle('x'.repeat(200))).toBe(true)
    expect(validTitle('x'.repeat(201))).toBe(false)
  })
})

describe('blockersOf: blockerDetails first, string list as fallback (REQ-C-002)', () => {
  it('prefers blockerDetails and keeps the flags', () => {
    const info = blockersOf({
      blockers: ['a', 'b'],
      blockerDetails: [
        { code: 'COUNT_TOO_FEW', message: 'a', overridable: false },
        { code: 'BLUEPRINT_NOT_VERIFIED', message: 'b', overridable: true },
      ],
    })
    expect(info).toEqual([
      { message: 'a', overridable: false },
      { message: 'b', overridable: true },
    ])
    expect(overrideOffered(info, false)).toBe(false)
    expect(overrideOffered(blockersOf({ blockers: ['x'], blockerDetails: [{ code: 'INELIGIBLE', message: 'x', overridable: true }] }), true)).toBe(true)
  })
  it('falls back to the plain lines (no flags) when blockerDetails is absent', () => {
    const info = blockersOf({ blockers: ['Soalan q1 tidak layak: x'] })
    expect(info).toEqual([{ message: 'Soalan q1 tidak layak: x', overridable: undefined }])
    expect(overrideOffered(info)).toBe(true)
    expect(overrideOffered(blockersOf({ blockers: ['Bahagian A: Kurang 1'] }))).toBe(false)
  })
})

describe('Override path in the mock and with unsaved edits', () => {
  const lines = ['Kontrak Simulasi MAT Kertas 1 belum Disahkan']
  async function paperWith(api: MockBuilderServer) {
    const s = (await api.builderSubjects())[0]!
    return api.create({ subject: s.code, kertas: s.kertas[0]!, title: 'T' })
  }
  it('review emits overridable lines + canOverride; publish refuses without override and honours it', async () => {
    const api = new MockBuilderServer(() => lines)
    const id = await paperWith(api)
    const rv = await api.review(id)
    expect(rv.blockers).toContain(lines[0])
    expect(rv.blockerDetails?.some((b) => b.overridable && b.code === 'BLUEPRINT_NOT_VERIFIED')).toBe(true)
    expect(rv.blockerDetails?.every((b) => typeof b.message === 'string')).toBe(true)
    // structural blockers (an empty draft) make it non-overridable
    expect(rv.canOverride).toBe(false)
    expect(await api.publish(id)).toMatchObject({ ok: false, errors: lines })
    await expect(api.publish(id, { override: true, reason: 'x' })).rejects.toThrow()
  })
  it('the offer follows canOverride; saving first can remove it', () => {
    const info = normalizeBlockers([{ message: lines[0]!, overridable: true }])
    expect(overrideOffered(info, true)).toBe(true)
    expect(overrideOffered(info, false)).toBe(false)
  })
})

describe('usePaperActions: override saves first', () => {
  const review = (canOverride: boolean) => ({
    paperId: 'p', status: 'draf', ok: false, notes: [], blueprintNeedsReview: false, visibleToStudents: false,
    totalMarks: 0, totalBudget: 0, rows: [], canOverride,
    blockers: ['Kontrak Simulasi belum Disahkan'],
    blockerDetails: [{ code: 'BLUEPRINT_NOT_VERIFIED', message: 'Kontrak Simulasi belum Disahkan', overridable: true }],
  })
  async function run(saved: boolean, canAfterSave: boolean) {
    const order: string[] = []
    const api = {
      review: vi.fn().mockImplementation(() => {
        order.push('review')
        return Promise.resolve(review(order.includes('save') ? canAfterSave : true))
      }),
      publish: vi.fn().mockImplementation(() => {
        order.push('publish')
        return Promise.resolve({ ok: true, errors: [], overridden: ['x'] })
      }),
    } as unknown as BuilderApi
    let actions!: ReturnType<typeof usePaperActions>
    const Comp = defineComponent({
      setup() {
        actions = usePaperActions({
          api,
          id: ref('p'),
          title: () => 'T',
          ensureSaved: () => {
            order.push('save')
            return Promise.resolve(saved)
          },
          onChanged: () => {},
        })
        return () => h('i')
      },
    })
    setActivePinia(createPinia())
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }] })
    mount(Comp, { global: { plugins: [router] } })
    await actions.loadReview()
    order.length = 0
    const ok = await actions.publish({ override: true, reason: 'sebab jelas' })
    return { ok, order, api }
  }
  it('saves, reloads the review, then publishes with the override', async () => {
    const { ok, order } = await run(true, true)
    expect(order).toEqual(['save', 'review', 'publish', 'review'])
    expect(ok).toBe(true)
  })
  it('does not publish when saving fails', async () => {
    const { ok, order } = await run(false, true)
    expect(order).toEqual(['save'])
    expect(ok).toBe(false)
  })
  it('does not publish when the offer is gone after saving', async () => {
    const { ok, order } = await run(true, false)
    expect(order).toEqual(['save', 'review'])
    expect(ok).toBe(false)
  })
})

describe('Bahan rujukan editor (R4)', () => {
  const upload = (f: File): Promise<string> => Promise.resolve(`tok-${f.name}`)
  it('adds a panel, a line and an image, reorders, and saves the whole list', async () => {
    const w = mount(PaperReferenceEditor, { props: { panels: [{ title: 'Rumus', items: ['a'] }], upload } })
    await w.get('[data-testid="ref-add-panel"]').trigger('click')
    await w.get('[data-testid="ref-title-1"]').setValue('Jadual')
    await w.get('[data-testid="ref-add-line-1"]').trigger('click')
    await w.get('[data-testid="ref-line-1-0"]').setValue(' $x^2$ ')
    const file = new File(['x'], 'rajah.png', { type: 'image/png' })
    const input = w.get('[data-testid="ref-file-1"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(w.find('[data-testid="ref-image-1"]').exists()).toBe(true)
    await w.get('[data-testid="ref-up-1"]').trigger('click')
    await w.get('[data-testid="reference-editor"]').trigger('submit')
    expect(w.emitted('save')![0]![0]).toEqual([
      { title: 'Jadual', items: ['$x^2$'], imageFileId: 'tok-rajah.png' },
      { title: 'Rumus', items: ['a'] },
    ])
  })
  it('needs a title per panel and is inert when read-only', () => {
    const w = mount(PaperReferenceEditor, { props: { panels: [{ title: '', items: [] }], upload } })
    expect(w.get('[data-testid="ref-save"]').attributes('disabled')).toBeDefined()
    const ro = mount(PaperReferenceEditor, { props: { panels: [{ title: 'R', items: [] }], readonly: true, upload } })
    expect(ro.find('[data-testid="ref-save"]').exists()).toBe(false)
  })
  it('shows an upload failure and keeps the panel without an image', async () => {
    const w = mount(PaperReferenceEditor, { props: { panels: [{ title: 'R', items: [] }], upload: () => Promise.reject(new Error('Gambar terlalu besar')) } })
    const input = w.get('[data-testid="ref-file-0"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.png')], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(w.get('[data-testid="ref-upload-error"]').text()).toBe('Gambar terlalu besar')
    expect(w.find('[data-testid="ref-image-0"]').exists()).toBe(false)
  })
  it('the mock stores the reference list and refuses it on a published paper', async () => {
    const api = new MockBuilderServer()
    const s = (await api.builderSubjects())[0]!
    const id = await api.create({ subject: s.code, kertas: s.kertas[0]!, title: 'T' })
    const ed = await api.updateReference(id, [{ title: 'Rumus', items: ['a'] }])
    expect((ed.paper as unknown as { reference: unknown[] }).reference).toHaveLength(1)
    await expect(api.updateReference(id, [{ title: ' ', items: [] }])).rejects.toThrow()
  })
})
