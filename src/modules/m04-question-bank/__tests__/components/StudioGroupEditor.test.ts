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
  removeGroupMember: vi.fn(),
  reorderGroupMembers: vi.fn(),
  searchQuestions: vi.fn(),
  uploadStudioImage: vi.fn(),
}))
vi.mock('../../api/studio', () => api)

const stimulus = { id: '70', kind: 'diagram', label: 'Rajah 1', caption: null, alt: 'Segi tiga', body: null, tableData: null, sourceCitation: null, imageId: 'abcdefghijklmnopqrstuv' }
const detail = (ids = ['11', '12', '13']) => ({ id: '5', label: 'Rajah 1', scope: 'section', stimuli: [stimulus], questionIds: ids })
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

  it('reorders and removes locally, then saves with DELETE then PUT order (no add)', async () => {
    api.removeGroupMember.mockResolvedValue({ data: { group: detail(['11', '13']), warning: null }, status: 'ok' })
    api.reorderGroupMembers.mockResolvedValue({ data: detail(['13', '11']), status: 'Susunan soalan dalam kumpulan berjaya dikemaskini.' })
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    await t(w, 'member-11-down').trigger('click')
    expect(order(w)).toEqual(['13', '11', '12'])
    await t(w, 'member-12-remove').trigger('click')
    expect(api.removeGroupMember).not.toHaveBeenCalled()
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.removeGroupMember).toHaveBeenCalledWith('5', '12')
    expect(api.addGroupMember).not.toHaveBeenCalled()
    expect(api.reorderGroupMembers).toHaveBeenCalledWith('5', ['13', '11'])
  })

  it('adds a found question: POST member, then PUT order with it at the end', async () => {
    api.searchQuestions.mockResolvedValue({ data: [{ id: '14', questionText: 'Berdasarkan Rajah 1, apakah S14?' }, { id: '11', questionText: 'sudah ada' }], meta: {} })
    api.addGroupMember.mockResolvedValue({ data: detail(['11', '12', '13', '14']), status: 'ok' })
    api.reorderGroupMembers.mockResolvedValue({ data: detail(['11', '12', '13', '14']), status: 'ok' })
    const w = await render()
    await w.get('[data-testid="studio-group-search"]').setValue('Rajah')
    await flushPromises()
    expect(w.findAll('[data-testid^="studio-group-found-"][data-testid$="-add"]').map((b) => b.attributes('data-testid'))).toEqual(['studio-group-found-14-add'])
    await t(w, 'found-14-add').trigger('click')
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.addGroupMember).toHaveBeenCalledWith('5', '14')
    expect(api.reorderGroupMembers).toHaveBeenCalledWith('5', ['11', '12', '13', '14'])
  })

  it('warns below two members and discards unsaved changes', async () => {
    const w = await render()
    await t(w, 'member-12-remove').trigger('click')
    await t(w, 'member-13-remove').trigger('click')
    expect(t(w, 'issues').text()).toContain('sekurang-kurangnya 2 soalan')
    await t(w, 'discard').trigger('click')
    expect(order(w)).toEqual(['11', '12', '13'])
    expect(has(w, 'issues')).toBe(false)
  })

  it('is read-only while a member is being served', async () => {
    api.fetchStudioQuestion.mockImplementation((id: string) => Promise.resolve(question(id, id === '12' ? 'approved' : 'draft')))
    const w = await render()
    expect(t(w, 'locked').text()).toContain('sedang diterbitkan')
    for (const id of ['member-13-up', 'member-13-remove', 'dissolve', 'search', 'add-stimulus']) expect(t(w, id).attributes('disabled')).toBeDefined()
  })

  it('shows the server refusal and reads the group again', async () => {
    api.reorderGroupMembers.mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields: { questionIds: 'Susunan mesti menyenaraikan semua soalan kumpulan tepat sekali.' } }))
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.fetchGroup).toHaveBeenCalledTimes(2)
    expect(t(w, 'problems').text()).toContain('tepat sekali')
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

  it('creates a group from a saved question: one stimulus, this question and the picked ones (at least two members)', async () => {
    api.createStimulus.mockResolvedValue({ data: stimulus, status: 'ok' })
    api.createGroup.mockResolvedValue({ data: detail(['11', '12']), status: 'Kumpulan rangsangan berjaya dicipta.' })
    api.searchQuestions.mockResolvedValue({ data: [{ id: '12', questionText: 'Berdasarkan Rajah 1, apakah S12?' }], meta: {} })
    const w = await render(null)
    expect(t(w, 'create').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="studio-group-new-body"]').setValue('Petikan tentang pasar tani.')
    await w.get('[data-testid="studio-group-search"]').setValue('Rajah')
    await flushPromises()
    await t(w, 'found-12-add').trigger('click')
    await t(w, 'create').trigger('click')
    await flushPromises()
    expect(api.createStimulus).toHaveBeenCalledTimes(1)
    expect(api.createGroup).toHaveBeenCalledWith({ label: null, stimulusIds: ['70'], questionIds: ['11', '12'] })
    expect(w.emitted('update:groupId')?.[0]).toEqual(['5'])
  })

  it('asks to save the draft first when the question has no id yet', async () => {
    const w = await render(null, { currentQuestionId: null })
    expect(has(w, 'save-first')).toBe(true)
    expect(has(w, 'create')).toBe(false)
  })
})
