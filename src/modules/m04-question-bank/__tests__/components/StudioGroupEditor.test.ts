// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import StudioGroupEditor from '../../components/studio/StudioGroupEditor.vue'

const api = vi.hoisted(() => ({
  fetchGroup: vi.fn(),
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  createStimulus: vi.fn(),
  updateStimulus: vi.fn(),
  setGroupStimuli: vi.fn(),
  dissolveGroup: vi.fn(),
  addGroupMember: vi.fn(),
  setGroupMembers: vi.fn(),
  searchQuestions: vi.fn(),
  uploadStudioImage: vi.fn(),
  submitGroupForReview: vi.fn(),
  publishGroup: vi.fn(),
  editGroupAsDraft: vi.fn(),
  discardGroupDraft: vi.fn(),
  retireGroup: vi.fn(),
  moveGroupMember: vi.fn(),
}))
vi.mock('../../api/studio', () => api)
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/ds', async (load) => ({ ...(await load<typeof import('@/ds')>()), useConfirm: () => confirmMock }))
const lookups = vi.hoisted(() => ({
  fetchSubjects: vi.fn(() => Promise.resolve({ data: [{ id: 3, name: 'Matematik' }], meta: {} })),
  fetchEducationLevels: vi.fn(() => Promise.resolve({ data: [{ id: 7, name: 'Tingkatan 4' }], meta: {} })),
}))
vi.mock('../../api/lookups', () => lookups)

const stimulus = { id: '70', kind: 'diagram', label: 'Rajah 1', caption: null, alt: 'Segi tiga', body: null, tableData: null, sourceCitation: null, imageId: 'abcdefghijklmnopqrstuv' }
const member = (id: string, status = 'draft') => ({ id, numberLabel: id, stem: `Berdasarkan Rajah 1, apakah S${id}?`, status, servable: status === 'approved' })
const detail = (ids = ['11', '12', '13'], warning: string | null = null) => ({ id: '5', label: 'Rajah 1', scope: 'section', stimuli: [stimulus], questionIds: ids, members: ids.map((i) => member(i)), warning })
const groupRow = (id: string, label: string | null, memberCount = 2) => ({ id, label, scope: 'section', stimuli: [{ id: '70', kind: 'diagram', label: 'Rajah 1', imageId: null }], memberCount, members: [member('21')], status: 'draft', warning: null })
const page = (rows: unknown[], totalItems = rows.length) => ({ data: rows, meta: { page: 1, pageSize: 10, totalItems } })

let wrapper: VueWrapper | null = null
async function render(groupId: string | null = '5', props: Record<string, unknown> = {}): Promise<VueWrapper> {
  wrapper = mount(StudioGroupEditor, {
    props: { groupId, 'onUpdate:groupId': (v: string | null) => void wrapper?.setProps({ groupId: v }), currentQuestionId: '11', ...props },
    attachTo: document.body,
    global: { plugins: [createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })] },
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
  api.listGroups.mockResolvedValue(page([]))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StudioGroupEditor on the stimulus API (T32, D90)', () => {
  it('shows one stimulus and its members in order, from the group read (no per-question reads)', async () => {
    const w = await render()
    expect(api.fetchGroup).toHaveBeenCalledWith('5')
    expect(order(w)).toEqual(['11', '12', '13'])
    expect(w.get('[data-testid="studio-group-member-12"]').text()).toContain('apakah S12?')
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
    await new Promise((r) => setTimeout(r, 350)) // the search waits 300 ms after the last key (REQ-B-061)
    await flushPromises()
    expect(w.findAll('[data-testid^="studio-group-found-"][data-testid$="-add"]').map((b) => b.attributes('data-testid'))).toEqual(['studio-group-found-14-add'])
    await t(w, 'found-14-add').trigger('click')
    expect(api.setGroupMembers).not.toHaveBeenCalled()
    await t(w, 'save-members').trigger('click')
    await flushPromises()
    expect(api.setGroupMembers).toHaveBeenCalledTimes(1)
    expect(api.setGroupMembers).toHaveBeenCalledWith('5', ['13', '11', '14'])
  })

  it('warns with no member and discards unsaved changes', async () => {
    const w = await render()
    await t(w, 'member-11-remove').trigger('click')
    await t(w, 'member-12-remove').trigger('click')
    await t(w, 'member-13-remove').trigger('click')
    expect(t(w, 'issues').text()).toBe('Kumpulan belum mempunyai soalan.')
    await t(w, 'discard').trigger('click')
    expect(order(w)).toEqual(['11', '12', '13'])
    expect(has(w, 'issues')).toBe(false)
  })

  it('has no client lock: an approved member does not disable the controls (the server 409 decides)', async () => {
    api.fetchGroup.mockResolvedValue({ ...detail(), members: ['11', '12', '13'].map((i) => member(i, i === '12' ? 'approved' : 'draft')) })
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

  it('shows the server warning, and no member issue for a group of 1 (D93, AC-QA-07)', async () => {
    api.fetchGroup.mockResolvedValue(detail(['11'], 'Kumpulan ini kini hanya mempunyai 1 soalan. Rangsangan bersama lazimnya untuk sekurang-kurangnya 2 soalan.'))
    const w = await render()
    expect(t(w, 'warning').text()).toContain('hanya mempunyai 1 soalan')
    expect(w.find('[data-testid="studio-group-issues"]').exists()).toBe(false)
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
    await w.get('[data-testid="studio-group-adding-label"]').setValue('Petikan 2')
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
    await w.get('[data-testid="studio-group-new-label"]').setValue('Petikan 1')
    await w.get('[data-testid="studio-group-new-body"]').setValue('Petikan tentang pasar tani.')
    await t(w, 'create').trigger('click')
    await flushPromises()
    expect(api.createGroup).toHaveBeenCalledWith({ label: 'Petikan 1', stimulusIds: ['70'], questionIds: ['11'] })
    expect(w.emitted('update:groupId')?.[0]).toEqual(['5'])
  })

  it('on a question that is not saved yet nothing is created: the stimulus waits for the save (D93, no orphan group)', async () => {
    const w = await render(null, { currentQuestionId: null })
    await w.get('[data-testid="studio-group-new-label"]').setValue('Petikan 1')
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

  it('browses the existing groups (T49) instead of asking for an id, searches them and joins one', async () => {
    api.listGroups.mockResolvedValue(page([groupRow('8', 'Rajah litar'), groupRow('9', null)], 12))
    api.addGroupMember.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render(null)
    expect(api.listGroups).toHaveBeenCalledWith({ q: null, subjectId: null, page: 1, pageSize: 10 })
    expect(has(w, 'attach-id')).toBe(false)
    expect(t(w, 'group-8').text()).toContain('Rajah litar')
    expect(t(w, 'group-9').text()).toContain('Rajah 1')
    vi.useFakeTimers()
    await w.get('[data-testid="studio-group-group-search"]').setValue('litar')
    await vi.advanceTimersByTimeAsync(350)
    vi.useRealTimers()
    await flushPromises()
    expect(api.listGroups).toHaveBeenLastCalledWith({ q: 'litar', subjectId: null, page: 1, pageSize: 10 })
    await t(w, 'groups-next').trigger('click')
    await flushPromises()
    expect(api.listGroups).toHaveBeenLastCalledWith({ q: 'litar', subjectId: null, page: 2, pageSize: 10 })
    await t(w, 'group-8-join').trigger('click')
    await flushPromises()
    expect(api.addGroupMember).toHaveBeenCalledWith('8', '11')
    expect(w.emitted('update:groupId')?.[0]).toEqual(['5'])
  })

  it('browses only the groups of the question subject, reloads when it changes, and caps the search text', async () => {
    const w = await render(null, { subjectId: '3' })
    expect(api.listGroups).toHaveBeenLastCalledWith({ q: null, subjectId: '3', page: 1, pageSize: 10 })
    expect(w.get('[data-testid="studio-group-group-search"]').attributes('maxlength')).toBe('100')
    await w.setProps({ subjectId: '4' })
    await flushPromises()
    expect(api.listGroups).toHaveBeenLastCalledWith({ q: null, subjectId: '4', page: 1, pageSize: 10 })
  })

  it('on an unsaved question joining a group only sets the group id, and an empty browse says so', async () => {
    api.listGroups.mockResolvedValueOnce(page([])).mockResolvedValue(page([groupRow('8', 'Rajah litar')]))
    const w = await render(null, { currentQuestionId: null })
    expect(t(w, 'groups-empty').text()).toBe('Tiada kumpulan dijumpai.')
    vi.useFakeTimers()
    await w.get('[data-testid="studio-group-group-search"]').setValue('lit')
    await vi.advanceTimersByTimeAsync(350)
    vi.useRealTimers()
    await flushPromises()
    // A plain click: the unsaved question has no id yet, so joining only sets the group id.
    ;(t(w, 'group-8-join').element as HTMLElement).click()
    await flushPromises()
    expect(api.addGroupMember).not.toHaveBeenCalled()
    expect(w.emitted('update:groupId')?.[0]).toEqual(['8'])
  })
})

describe('StudioGroupEditor question search and the read limit (REQ-B-061)', () => {
  const type = async (w: VueWrapper, text: string): Promise<void> => {
    await w.get('[data-testid="studio-group-search"]').setValue(text)
  }

  it('reads once per pause of 300 ms, not per keystroke, and keeps the answer of a term', async () => {
    api.searchQuestions.mockResolvedValue({ data: [{ id: '14', questionText: 'Rajah' }], meta: {} })
    const w = await render()
    vi.useFakeTimers()
    for (const text of ['Ra', 'Raj', 'Raja', 'Rajah']) {
      await type(w, text)
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(api.searchQuestions).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(api.searchQuestions).toHaveBeenCalledTimes(1)
    expect(api.searchQuestions).toHaveBeenCalledWith('Rajah')
    // Back to a term already answered: no second read.
    await type(w, 'Raja')
    await type(w, 'Rajah')
    await vi.advanceTimersByTimeAsync(350)
    expect(api.searchQuestions).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('drops a late answer of an older term', async () => {
    let first: (v: unknown) => void = () => {}
    api.searchQuestions
      .mockImplementationOnce(() => new Promise((r) => { first = r }))
      .mockResolvedValueOnce({ data: [{ id: '15', questionText: 'baru' }], meta: {} })
    const w = await render()
    vi.useFakeTimers()
    await type(w, 'lama')
    await vi.advanceTimersByTimeAsync(350)
    await type(w, 'baru')
    await vi.advanceTimersByTimeAsync(350)
    first({ data: [{ id: '14', questionText: 'lama' }], meta: {} })
    await vi.advanceTimersByTimeAsync(0)
    vi.useRealTimers()
    await flushPromises()
    expect(has(w, 'found-15-add')).toBe(true)
    expect(has(w, 'found-14-add')).toBe(false)
  })

  it('shows the 429 message, not the generic load error, and does not keep the failed term', async () => {
    api.searchQuestions
      .mockRejectedValueOnce(new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Cuba lagi sebentar.' }))
      .mockResolvedValueOnce({ data: [], meta: {} })
    const w = await render()
    vi.useFakeTimers()
    await type(w, 'Rajah')
    await vi.advanceTimersByTimeAsync(350)
    vi.useRealTimers()
    await flushPromises()
    expect(w.text()).toContain('Terlalu banyak permintaan. Cuba lagi sebentar.')
    expect(w.text()).not.toContain('Tidak dapat memuatkan')
    vi.useFakeTimers()
    await type(w, 'Rajah ')
    await type(w, 'Rajah')
    await vi.advanceTimersByTimeAsync(350)
    vi.useRealTimers()
    expect(api.searchQuestions).toHaveBeenCalledTimes(2)
  })

  describe('group actions (FR-QA-04..06, 50)', () => {
    const scoped = (over: Record<string, unknown> = {}) => ({ ...detail(), subjectId: '3', educationLevelId: '7', kertas: '1', draftOfGroupId: null, ...over })
    const withMembers = (...statuses: ['draft' | 'review' | 'approved', boolean][]) =>
      statuses.map(([status, servable], i) => ({ ...member(String(11 + i), status), servable }))
    const act = (props: Record<string, unknown> = {}) => render('5', { actions: true, ...props })

    it('shows the scope read-only, and no action bar in the wizard', async () => {
      api.fetchGroup.mockResolvedValue(scoped())
      const w = await act()
      expect(t(w, 'scope').text()).toBe('Subjek: Matematik · Tingkatan: Tingkatan 4 · Kertas: 1')
      w.unmount()
      const inWizard = await render('5')
      expect(has(inWizard, 'actions')).toBe(false)
    })

    it('all Draf: submit is offered, publish is disabled; submit moves the group and reads it again (AC-QA-50)', async () => {
      api.fetchGroup.mockResolvedValue(scoped({ members: withMembers(['draft', false], ['draft', false]) }))
      api.submitGroupForReview.mockResolvedValue({ data: { affected: 2, failed: [] }, status: 'ok' })
      const w = await act()
      expect(t(w, 'publish').attributes('disabled')).toBeDefined()
      expect(t(w, 'publish').attributes('title')).toBe('Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu.')
      await t(w, 'submit').trigger('click')
      await flushPromises()
      expect(api.submitGroupForReview).toHaveBeenCalledWith('5')
      expect(t(w, 'notice').text()).toBe('Kumpulan dihantar untuk semakan.')
    })

    it('publish names each member the gate refused', async () => {
      api.fetchGroup.mockResolvedValue(scoped({ members: withMembers(['review', false]) }))
      api.publishGroup.mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', details: { gate: [{ questionId: '11', message: 'Soalan 1: Sila pilih Bab.' }] } }))
      const w = await act()
      await t(w, 'publish').trigger('click')
      await flushPromises()
      expect(t(w, 'problems').text()).toContain('Soalan 1: Sila pilih Bab.')
    })

    it('a served group shows the banner; Sunting kumpulan opens the copy; the copy offers Buang draf', async () => {
      api.fetchGroup.mockResolvedValue(scoped({ members: withMembers(['approved', true]) }))
      api.editGroupAsDraft.mockResolvedValue({ data: { id: '9' }, status: 'Draf kumpulan #9 dicipta.' })
      const opened: string[] = []
      const w = await act({ onOpen: (id: string) => opened.push(id) })
      expect(t(w, 'served-banner').text()).toContain('Tekan `Sunting kumpulan`')
      await t(w, 'copy').trigger('click')
      await flushPromises()
      expect(opened).toEqual(['9'])
      w.unmount()
      api.fetchGroup.mockResolvedValue(scoped({ id: '9', draftOfGroupId: '5', members: withMembers(['draft', false]) }))
      api.discardGroupDraft.mockResolvedValue(undefined)
      const opened2: string[] = []
      const c = await act({ onOpen: (id: string) => opened2.push(id) })
      expect(has(c, 'served-banner')).toBe(false)
      await t(c, 'discard-copy').trigger('click')
      await flushPromises()
      expect(api.discardGroupDraft).toHaveBeenCalledWith('5')
      expect(opened2).toEqual(['5'])
    })

    it('Arkibkan asks first and names the affected papers (AC-QA-05)', async () => {
      api.fetchGroup.mockResolvedValue(scoped())
      api.retireGroup.mockResolvedValue({ archived: 3, affectedPapers: [{ id: '1', title: 'Kertas A' }] })
      confirmMock.mockResolvedValueOnce(false)
      const w = await act()
      await t(w, 'retire').trigger('click')
      await flushPromises()
      expect(api.retireGroup).not.toHaveBeenCalled()
      await t(w, 'retire').trigger('click')
      await flushPromises()
      expect(t(w, 'notice').text()).toBe('3 soalan diarkibkan. Kertas Terbit terjejas: Kertas A.')
    })

    it('removing a member that names a figure asks with the figure (FR-ADM-QE2.7)', async () => {
      api.fetchGroup.mockResolvedValue(scoped())
      const w = await act()
      await t(w, 'member-11-remove').trigger('click')
      await flushPromises()
      expect(confirmMock).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Keluarkan soalan daripada kumpulan?', message: 'Soalan ini menyebut Rajah 1. Tanpa kumpulan ia tidak akan dipaparkan kepada murid.' }))
      expect(order(w)).toEqual(['12', '13'])
    })

    it('Bubarkan asks first', async () => {
      api.fetchGroup.mockResolvedValue(scoped())
      confirmMock.mockResolvedValueOnce(false)
      const w = await act()
      await t(w, 'dissolve').trigger('click')
      await flushPromises()
      expect(confirmMock).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Bubarkan kumpulan ini?', message: 'Soalan ahli kekal, tanpa rangsangan bersama.' }))
      expect(api.dissolveGroup).not.toHaveBeenCalled()
    })

    it('Pindah picks a group of the same Subjek and moves in one call; a refusal shows the server text (AC-QA-06)', async () => {
      api.fetchGroup.mockResolvedValue(scoped())
      api.listGroups.mockResolvedValue(page([groupRow('5', 'Sendiri'), groupRow('8', 'Rajah 2')]))
      api.moveGroupMember.mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Soalan dalam satu kumpulan mesti sama subjek.' }))
      const w = await act()
      await t(w, 'member-11-move').trigger('click')
      await flushPromises()
      expect(api.listGroups).toHaveBeenLastCalledWith(expect.objectContaining({ subjectId: '3' }))
      expect(document.querySelector('[data-testid="studio-move-to-5"]')).toBeNull()
      ;(document.querySelector('[data-testid="studio-move-to-8"]') as HTMLElement).click()
      await flushPromises()
      expect(api.moveGroupMember).toHaveBeenCalledWith('5', '11', '8')
      expect(t(w, 'problems').text()).toContain('Soalan dalam satu kumpulan mesti sama subjek.')
    })

    it('the move picker searches and pages through the groups (PRD45 6.3)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      api.fetchGroup.mockResolvedValue(scoped())
      api.listGroups.mockResolvedValue(page([groupRow('8', 'Rajah 2')], 25))
      const w = await act()
      await t(w, 'member-11-move').trigger('click')
      await flushPromises()
      const input = document.querySelector('[data-testid="studio-move-search"]') as HTMLInputElement
      input.value = 'Rajah'
      input.dispatchEvent(new Event('input'))
      vi.advanceTimersByTime(300)
      vi.useRealTimers()
      await flushPromises()
      expect(api.listGroups).toHaveBeenLastCalledWith({ q: 'Rajah', subjectId: '3', page: 1, pageSize: 10 })
      ;(document.querySelector('[data-testid="studio-move-next"]') as HTMLElement).click()
      await flushPromises()
      expect(api.listGroups).toHaveBeenLastCalledWith({ q: 'Rajah', subjectId: '3', page: 2, pageSize: 10 })
    })
  })
})
