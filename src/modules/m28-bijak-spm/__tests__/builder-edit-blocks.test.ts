// @vitest-environment jsdom
// R1-F09: metadata title sync, Sunting bahagian / petikan, override offer.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import PaperEditBlocks from '../admin/builder/components/PaperEditBlocks.vue'
import PaperMetaForm from '../admin/builder/components/PaperMetaForm.vue'
import PaperQuestionOps from '../admin/builder/components/PaperQuestionOps.vue'
import PublishOverride from '../admin/builder/components/PublishOverride.vue'
import { normalizeBlockers, overrideOffered } from '../admin/builder/domain/blockers'
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
  it('renames a Bahagian and a group, and the editor shows it', async () => {
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

describe('Tambah / Padam soalan', () => {
  it('lists pool units, adds by first member id, deletes after confirm and shows the section fill', async () => {
    const api = new MockBuilderServer()
    const s = (await api.builderSubjects())[0]!
    const id = await api.create({ subject: s.code, kertas: s.kertas[0]!, title: 'T' })
    const ed = await api.getEditor(id)
    const sec = ed.paper.sections[0]!
    const w = mount(PaperQuestionOps, {
      props: { editor: ed, loadPool: (sid: string, q: string) => api.pool(id, sid, { q }) },
    })
    await w.get('[data-testid="ops-add-0"]').trigger('click')
    await flushPromises()
    const add = w.find('[data-testid^="ops-pick-add-"]')
    expect(add.exists()).toBe(true)
    await add.trigger('click')
    expect(w.emitted('add')![0]![0]).toBe(sec.id)
    // read-only: no add / delete controls
    const ro = mount(PaperQuestionOps, { props: { editor: ed, readonly: true, loadPool: () => Promise.reject(new Error('x')) } })
    expect(ro.find('[data-testid="ops-add-0"]').exists()).toBe(false)
  })
  it('the mock refuses a placement on a published paper with the server line', async () => {
    const api = new MockBuilderServer()
    const s = (await api.builderSubjects())[0]!
    const id = await api.create({ subject: s.code, kertas: s.kertas[0]!, title: 'T' })
    const ed = await api.getEditor(id)
    ed.paper.status = 'terbit'
    await expect(api.addPlacement(id, ed.paper.sections[0]!.id, 'q')).rejects.toThrow()
  })
})
