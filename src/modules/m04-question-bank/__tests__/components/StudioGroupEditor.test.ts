// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StudioGroup } from '../../api/studio'
import StudioGroupEditor from '../../components/studio/StudioGroupEditor.vue'

const api = vi.hoisted(() => ({
  fetchStudioGroup: vi.fn(),
  createStudioGroup: vi.fn(),
  updateStudioGroup: vi.fn(),
  dissolveStudioGroup: vi.fn(),
  addStudioStimulus: vi.fn(),
  patchStudioStimulus: vi.fn(),
  removeStudioStimulus: vi.fn(),
  setStudioGroupMembers: vi.fn(),
  searchQuestions: vi.fn(),
  uploadStudioImage: vi.fn(),
  studioAvailable: () => true,
  STUDIO_UNAVAILABLE: 'x',
}))
vi.mock('../../api/studio', () => api)

function group(over: Partial<StudioGroup> = {}): StudioGroup {
  const members = [
    { id: '11', position: 1, numberLabel: '1', stem: 'Berdasarkan Rajah 1, apakah S1?', status: 'draft' },
    { id: '12', position: 2, numberLabel: '2', stem: 'Berdasarkan Rajah 1, apakah S2?', status: 'draft' },
    { id: '13', position: 3, numberLabel: '3', stem: 'Berdasarkan Rajah 1, apakah S3?', status: 'draft' },
  ]
  return {
    id: '5',
    label: 'Rajah 1',
    stimuli: [{ id: '70', kind: 'diagram', label: 'Rajah 1', caption: null, alt: 'Segi tiga', body: null, table: null, sourceCitation: null, imageId: 'abcdefghijklmnopqrstuv' }],
    members,
    memberCount: members.length,
    complete: true,
    locked: false,
    issues: [],
    ...over,
  }
}

let wrapper: VueWrapper | null = null
async function render(groupId: string | null = '5', props: Record<string, unknown> = {}): Promise<VueWrapper> {
  wrapper = mount(StudioGroupEditor, {
    props: { groupId, 'onUpdate:groupId': (v: string | null) => void wrapper?.setProps({ groupId: v }), ...props },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="studio-group-${id}"]`)
const order = (w: VueWrapper): string[] => w.findAll('[data-testid^="studio-group-member-"][data-testid$="-pos"]').map((e) => e.element.closest('li')?.getAttribute('data-testid')?.replace('studio-group-member-', '') ?? '')

beforeEach(() => {
  for (const f of Object.values(api)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset()
  api.fetchStudioGroup.mockResolvedValue(group())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StudioGroupEditor (D90)', () => {
  it('shows one stimulus and its members in order', async () => {
    const w = await render()
    expect(api.fetchStudioGroup).toHaveBeenCalledWith('5')
    expect(w.findAll('[data-testid^="studio-group-stimulus-"]')).toHaveLength(1)
    expect(order(w)).toEqual(['11', '12', '13'])
    expect(t(w, 'save-members').attributes('disabled')).toBeDefined()
  })

  it('reorders, removes and saves ONE ordered list of member ids', async () => {
    api.setStudioGroupMembers.mockResolvedValue({ data: group({ members: [] }), status: 'Susunan soalan dalam kumpulan dikemaskini.' })
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    expect(order(w)).toEqual(['11', '13', '12'])
    await t(w, 'member-11-down').trigger('click')
    expect(order(w)).toEqual(['13', '11', '12'])
    await t(w, 'member-12-remove').trigger('click')
    expect(order(w)).toEqual(['13', '11'])
    expect(api.setStudioGroupMembers).not.toHaveBeenCalled()
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.setStudioGroupMembers).toHaveBeenCalledTimes(1)
    expect(api.setStudioGroupMembers).toHaveBeenCalledWith('5', ['13', '11'])
    expect(t(w, 'notice').text()).toBe('Susunan soalan dalam kumpulan dikemaskini.')
  })

  it('adds a found question at the end and warns while the group has fewer than two questions', async () => {
    api.searchQuestions.mockResolvedValue({ data: [{ id: '14', questionText: 'Berdasarkan Rajah 1, apakah S4?' }, { id: '11', questionText: 'sudah ada' }], meta: {} })
    const w = await render()
    await t(w, 'member-12-remove').trigger('click')
    await t(w, 'member-13-remove').trigger('click')
    expect(t(w, 'issues').text()).toContain('sekurang-kurangnya 2 soalan')
    await w.get('[data-testid="studio-group-search"]').setValue('Rajah')
    await flushPromises()
    expect(w.findAll('[data-testid^="studio-group-found-"][data-testid$="-add"]').map((b) => b.attributes('data-testid'))).toEqual(['studio-group-found-14-add'])
    await t(w, 'found-14-add').trigger('click')
    expect(order(w)).toEqual(['11', '14'])
    expect(w.find('[data-testid="studio-group-issues"]').exists()).toBe(false)
  })

  it('discards unsaved changes', async () => {
    const w = await render()
    await t(w, 'member-11-remove').trigger('click')
    expect(order(w)).toEqual(['12', '13'])
    await t(w, 'discard').trigger('click')
    expect(order(w)).toEqual(['11', '12', '13'])
  })

  it('is read-only while a member is being served', async () => {
    api.fetchStudioGroup.mockResolvedValue(group({ locked: true }))
    const w = await render()
    expect(t(w, 'locked').text()).toContain('sedang diterbitkan')
    for (const id of ['member-12-up', 'member-12-remove', 'dissolve', 'search']) expect(t(w, id).attributes('disabled')).toBeDefined()
  })

  it('shows the server refusal and keeps the working list', async () => {
    const { ApiError } = await import('@/api')
    api.setStudioGroupMembers.mockRejectedValue(new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan ini sudah berada dalam kumpulan lain. Keluarkan dahulu daripada kumpulan itu.' }))
    const w = await render()
    await t(w, 'member-13-up').trigger('click')
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(t(w, 'problems').text()).toContain('sudah berada dalam kumpulan lain')
    expect(order(w)).toEqual(['11', '13', '12'])
  })

  it('creates the shared stimulus when the question has none', async () => {
    api.createStudioGroup.mockResolvedValue({ data: group({ members: [], memberCount: 0, complete: false }), status: 'Kumpulan rangsangan dicipta.' })
    const w = await render(null)
    expect(w.find('[data-testid="studio-group-none"]').exists()).toBe(true)
    await t(w, 'create').trigger('click')
    expect(api.createStudioGroup).not.toHaveBeenCalled()
    expect(t(w, 'problems').text()).toContain('Rangsangan mesti ada teks, jadual atau gambar.')
    await w.get('[data-testid="studio-group-new-body"]').setValue('Petikan tentang pasar tani.')
    await t(w, 'create').trigger('click')
    await flushPromises()
    expect(api.createStudioGroup).toHaveBeenCalledWith({ label: null, stimuli: [expect.objectContaining({ kind: 'diagram', body: 'Petikan tentang pasar tani.', imageFileId: null })] })
    expect(w.emitted('update:groupId')?.[0]).toEqual(['5'])
  })
})
