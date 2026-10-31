// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import StudioGroupEditor from '../../components/studio/StudioGroupEditor.vue'

const api = vi.hoisted(() => ({
  fetchGroup: vi.fn(),
  fetchStudioQuestion: vi.fn(),
  createGroup: vi.fn(),
  createStimulus: vi.fn(),
  updateStimulus: vi.fn(),
  setGroupStimuli: vi.fn(),
  dissolveGroup: vi.fn(),
  addGroupMember: vi.fn(),
  setGroupMembers: vi.fn(),
  searchQuestions: vi.fn(),
  uploadStudioImage: vi.fn(),
}))
vi.mock('../../api/studio', () => api)

const stimulus = { id: '70', kind: 'diagram', label: 'Rajah 1', caption: null, alt: 'Segi tiga', body: null, tableData: null, sourceCitation: null, imageId: 'abcdefghijklmnopqrstuv' }
const detail = (ids = ['11', '12', '13'], warning: string | null = null) => ({ id: '5', label: 'Rajah 1', scope: 'section', stimuli: [stimulus], questionIds: ids, warning })
const question = (id: string, status = 'draft') => ({ id, status, questionText: `Berdasarkan Rajah 1, apakah S${id}?`, numberLabel: id })

let wrapper: VueWrapper | null = null
async function render(groupId: string | null = '5', props: Record<string, unknown> = {}): Promise<VueWrapper> {
  wrapper = mount(StudioGroupEditor, {
    props: { groupId, 'onUpdate:groupId': (v: string | null) => void wrapper?.setProps({ groupId: v }), currentQuestionId: '11', ...props },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="studio-group-${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="studio-group-${id}"]`).exists()
const order = (w: VueWrapper): string[] => w.findAll('[data-testid^="studio-group-member-"][data-testid$="-pos"]').map((e) => e.element.closest('li')?.getAttribute('data-testid')?.replace('studio-group-member-', '') ?? '')

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  api.fetchGroup.mockResolvedValue(detail())
  api.fetchStudioQuestion.mockImplementation((id: string) => Promise.resolve(question(id)))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StudioGroupEditor on the stimulus API (T32, D90)', () => {
  it('shows one stimulus and its members in order, reading each member question', async () => {
    const w = await render()
    expect(api.fetchGroup).toHaveBeenCalledWith('5')
    expect(api.fetchStudioQuestion).toHaveBeenCalledTimes(3)
    expect(w.findAll('[data-testid^="studio-group-stimulus-"]')).toHaveLength(1)
    expect(order(w)).toEqual(['11', '12', '13'])
    expect(t(w, 'save-members').attributes('disabled')).toBeDefined()
  })

  it('reorders, removes and adds locally, then saves ONE atomic ordered list (PUT members)', async () => {
    api.searchQuestions.mockResolvedValue({ data: [{ id: '14', questionText: 'Berdasarkan Rajah 1, apakah S14?' }, { id: '11', questionText: 'sudah ada' }], meta: {} })
    api.setGroupMembers.mockResolvedValue({ data: detail(['13', '11', '14']), status: 'Susunan soalan dalam kumpulan berjaya dikemaskini.' })
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    await t(w, 'member-11-down').trigger('click')
    expect(order(w)).toEqual(['13', '11', '12'])
    await t(w, 'member-12-remove').trigger('click')
    await w.get('[data-testid="studio-group-search"]').setValue('Rajah')
    await flushPromises()
    expect(w.findAll('[data-testid^="studio-group-found-"][data-testid$="-add"]').map((b) => b.attributes('data-testid'))).toEqual(['studio-group-found-14-add'])
    await t(w, 'found-14-add').trigger('click')
    expect(api.setGroupMembers).not.toHaveBeenCalled()
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.setGroupMembers).toHaveBeenCalledTimes(1)
    expect(api.setGroupMembers).toHaveBeenCalledWith('5', ['13', '11', '14'])
  })

  it('warns below two members and discards unsaved changes', async () => {
    const w = await render()
    await t(w, 'member-12-remove').trigger('click')
    await t(w, 'member-13-remove').trigger('click')
    expect(t(w, 'issues').text()).toBe('Kumpulan perlu sekurang-kurangnya 2 soalan.')
    await t(w, 'discard').trigger('click')
    expect(order(w)).toEqual(['11', '12', '13'])
    expect(has(w, 'issues')).toBe(false)
  })

  it('has no client lock: an approved member does not disable the controls (the server 409 decides)', async () => {
    api.fetchStudioQuestion.mockImplementation((id: string) => Promise.resolve(question(id, id === '12' ? 'approved' : 'draft')))
    const w = await render()
    expect(has(w, 'locked')).toBe(false)
    for (const id of ['member-13-up', 'member-13-remove', 'dissolve', 'search', 'add-stimulus']) expect(t(w, id).attributes('disabled')).toBeUndefined()
  })

  it('shows the 409 messages of the served lock in BM and reads the group again', async () => {
    const groupServed = 'Kumpulan ini mempunyai soalan yang sedang dipaparkan kepada murid. Soalan itu tidak boleh dikeluarkan atau disusun semula, dan kumpulan tidak boleh diubah rangsangannya atau dibubarkan. Sunting soalan sebagai draf atau arkibkannya dahulu.'
    api.setGroupMembers.mockRejectedValue(new ApiError({ status: 409, code: 'CONFLICT', message: groupServed }))
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.fetchGroup).toHaveBeenCalledTimes(2)
    expect(t(w, 'problems').text()).toBe(groupServed)
  })

  it('shows memberServed (adding a served question) and stimulusServed (editing its stimulus)', async () => {
    const memberServed = 'Soalan ini sedang dipaparkan kepada murid. Sunting sebagai draf atau arkibkannya dahulu sebelum memasukkannya ke dalam kumpulan.'
    const stimulusServed = 'Rangsangan ini sedang dipaparkan kepada murid melalui soalan yang diterbitkan. Cipta rangsangan baharu dan gunakan pada draf soalan, atau arkibkan soalan itu dahulu.'
    api.setGroupMembers.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: memberServed }))
    api.updateStimulus.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: stimulusServed }))
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(t(w, 'problems').text()).toBe(memberServed)
    await w.get('[data-testid="studio-group-s-70-caption"]').setValue('Sumber lain')
    await t(w, 's-70-save').trigger('click')
    await flushPromises()
    expect(t(w, 'problems').text()).toBe(stimulusServed)
  })

  it('shows the draft-group warning of the server while the group has fewer than two questions (D93)', async () => {
    api.fetchGroup.mockResolvedValue(detail(['11'], 'Kumpulan ini kini hanya mempunyai 1 soalan. Rangsangan bersama lazimnya untuk sekurang-kurangnya 2 soalan.'))
    const w = await render()
    expect(t(w, 'warning').text()).toContain('hanya mempunyai 1 soalan')
    expect(t(w, 'issues').text()).toBe('Kumpulan perlu sekurang-kurangnya 2 soalan.')
  })

  it('edits a stimulus with only the changed keys (PUT /stimuli/:id)', async () => {
    api.updateStimulus.mockResolvedValue({ data: stimulus, status: 'ok' })
    const w = await render()
    await t(w, 's-70-save').trigger('click')
    expect(api.updateStimulus).not.toHaveBeenCalled()
    await w.get('[data-testid="studio-group-s-70-caption"]').setValue('Sumber: buku teks')
    await t(w, 's-70-save').trigger('click')
    await flushPromises()
    expect(api.updateStimulus).toHaveBeenCalledWith('70', { caption: 'Sumber: buku teks' })
  })

  it('adds a second stimulus (POST /stimuli then PUT the group stimulus list) and removes one', async () => {
    api.createStimulus.mockResolvedValue({ data: { ...stimulus, id: '71' }, status: 'ok' })
    api.setGroupStimuli.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render()
    await t(w, 'add-stimulus').trigger('click')
    await t(w, 'adding-save').trigger('click')
    expect(api.createStimulus).not.toHaveBeenCalled()
    expect(t(w, 'problems').text()).toContain('Petikan mesti mempunyai teks.')
    await w.get('[data-testid="studio-group-adding-body"]').setValue('Petikan kedua.')
    await t(w, 'adding-save').trigger('click')
    await flushPromises()
    expect(api.createStimulus).toHaveBeenCalledWith(expect.objectContaining({ kind: 'passage', body: { ms: 'Petikan kedua.' } }))
    expect(api.setGroupStimuli).toHaveBeenCalledWith('5', ['70', '71'])
  })

  it('creates a draft group with this question only (D93): one stimulus, one member, no second question needed', async () => {
    api.createStimulus.mockResolvedValue({ data: stimulus, status: 'ok' })
    api.createGroup.mockResolvedValue({ data: detail(['11'], 'Kumpulan ini kini hanya mempunyai 1 soalan.'), status: 'Kumpulan rangsangan berjaya dicipta.' })
    const w = await render(null)
    expect(t(w, 'create').attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="studio-group-new-body"]').setValue('Petikan tentang pasar tani.')
    await t(w, 'create').trigger('click')
    await flushPromises()
    expect(api.createGroup).toHaveBeenCalledWith({ label: null, stimulusIds: ['70'], questionIds: ['11'] })
    expect(w.emitted('update:groupId')?.[0]).toEqual(['5'])
  })

  it('on a question that is not saved yet nothing is created: the stimulus waits for the save (D93, no orphan group)', async () => {
    const w = await render(null, { currentQuestionId: null })
    await w.get('[data-testid="studio-group-new-body"]').setValue('Petikan tentang pasar tani.')
    await t(w, 'create').trigger('click')
    await flushPromises()
    expect(api.createStimulus).not.toHaveBeenCalled()
    expect(api.createGroup).not.toHaveBeenCalled()
    expect(t(w, 'deferred').text()).toContain('apabila soalan disimpan')
    const pending = w.emitted('update:pending')?.at(-1)?.[0] as { form: { body: string }; memberIds: string[] } | null
    expect(pending?.form.body).toBe('Petikan tentang pasar tani.')
    await t(w, 'undefer').trigger('click')
    await flushPromises()
    expect(w.emitted('update:pending')?.at(-1)?.[0]).toBeNull()
  })
})
