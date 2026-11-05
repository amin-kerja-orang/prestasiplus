// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import StudioEditorPage from '../../pages/StudioEditorPage.vue'

const studio = vi.hoisted(() => ({
  studioAvailable: vi.fn(() => true),
  STUDIO_UNAVAILABLE: 'Studio hanya tersedia apabila sistem disambungkan ke pelayan sebenar.',
  fetchStudioDskp: vi.fn(),
  fetchStudioQuestion: vi.fn(),
  createStudioQuestion: vi.fn(),
  updateStudioQuestion: vi.fn(),
  createQuestionInGroup: vi.fn(),
  fetchGroup: vi.fn(),
  listGroups: vi.fn(),
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
  editAsDraft: vi.fn(),
  EditAsDraftRefused: class EditAsDraftRefused extends Error {
    lines: string[] = []
  },
  fetchServability: vi.fn(),
  fetchGateCheck: vi.fn(),
  moveQuestionStatus: vi.fn(),
}))
const lookups = vi.hoisted(() => ({ fetchSubjects: vi.fn(), fetchEducationLevels: vi.fn(), fetchChapters: vi.fn() }))
vi.mock('../../api/studio', () => studio)
vi.mock('../../api/lookups', () => lookups)
vi.mock('@/app/router', () => ({ setRouteOutcome: vi.fn() }))

const DSKP = { units: [{ id: '40', code: '1.0', title: 'Bentuk piawai', sps: [{ id: '41', code: '1.1.1', title: 'Nombor besar', skCode: '1.1' }, { id: '42', code: '1.1.2', title: 'Kuasa', skCode: '1.1' }] }] }
const GROUP = {
  id: '9',
  label: 'Rajah 1',
  scope: 'section',
  stimuli: [{ id: '70', kind: 'diagram', label: 'Rajah 1', caption: null, alt: 'Segi tiga', body: { ms: 'Penerangan' }, tableData: null, sourceCitation: null, imageId: null }],
  questionIds: ['501', '502'],
  members: [
    { id: '501', numberLabel: '1', stem: 'S501 berdasarkan Rajah 1', status: 'draft', servable: false },
    { id: '502', numberLabel: '2', stem: 'S502 berdasarkan Rajah 1', status: 'draft', servable: false },
  ],
}
const serve = (main: { id: string; [k: string]: unknown }) =>
  studio.fetchStudioQuestion.mockImplementation((id: string) => Promise.resolve(id === main.id ? main : member(id)))
const member = (id: string) => ({ id, status: 'draft', questionText: `S${id} berdasarkan Rajah 1`, numberLabel: id === '501' ? '1' : '2' })

let wrapper: VueWrapper | null = null
let router: Router

async function render(url: string, id?: string): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions', component: stub },
      { path: '/admin/studio/questions/create', component: StudioEditorPage },
      { path: '/admin/studio/questions/:id/sunting', component: StudioEditorPage, props: true },
    ],
  })
  await router.push(url)
  wrapper = mount(StudioEditorPage, { props: id === undefined ? {} : { id }, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  for (const f of Object.values(studio)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset()
  studio.studioAvailable.mockReturnValue(true)
  studio.fetchStudioDskp.mockResolvedValue(DSKP)
  studio.fetchStudioQuestion.mockImplementation((id: string) => Promise.resolve(member(id)))
  studio.fetchGroup.mockResolvedValue(GROUP)
  studio.listGroups.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0 } })
  studio.fetchServability.mockResolvedValue({ questionId: '700', versionNo: 1, servedCount: 0, total: 6, activities: [] })
  lookups.fetchSubjects.mockReset().mockResolvedValue({ data: [{ id: 3, name: 'Matematik' }], meta: {} })
  lookups.fetchEducationLevels.mockReset().mockResolvedValue({ data: [{ id: 7, name: 'Tingkatan 4' }], meta: {} })
  lookups.fetchChapters.mockReset().mockResolvedValue([{ id: 12, name: 'Bentuk piawai', chapterNumber: 1 }])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

const SAVED = {
  id: '501',
  status: 'draft',
  numberLabel: '1',
  subjectId: '3',
  educationLevelId: '7',
  difficultyLevel: 3,
  questionText: 'S1 berdasarkan Rajah 1, apakah ini?',
  questionImage: null,
  kertas: '1',
  curriculumChapterId: '12',
  stimulusGroup: null,
  tag: { unitId: '40', spIds: ['41'], tp: 2 },
  parts: [{ label: 'a', prompt: { ms: 'Pilih.' }, mode: 'mcq', marks: 1, difficultyTp: 2, cognitiveLevel: 'memahami', options: [{ label: 'A', body: { ms: 'x' } }, { label: 'B', body: { ms: 'y' } }, { label: 'C', body: { ms: 'z' } }], key: { kind: 'option', correct: 'A' } }],
}

describe('wizard order and completeness (FR-QA-16, FR-ADM-QE4.1)', () => {
  it('the tabs read 1 Tag, 2 Kertas, 3 Rangsangan, 4 Sub-bahagian and Tag comes first (AC-ADM-QE2.4)', async () => {
    const w = await render('/admin/studio/questions/create')
    const sections = w.findAll('section').map((x) => x.attributes('id'))
    expect(sections).toEqual(['studio-section-tag', 'studio-section-kertas', 'studio-section-rangsangan', 'studio-section-sub'])
    for (const label of ['1 Tag', '2 Kertas', '3 Rangsangan', '4 Sub-bahagian']) expect(w.text()).toContain(label)
    const tag = t(w, 'studio-subject').element.closest('section')
    expect(tag?.getAttribute('id')).toBe('studio-section-tag')
    expect(t(w, 'studio-unit').element.closest('section')?.getAttribute('id')).toBe('studio-section-tag')
  })

  it('names each gap and the link focuses its field; the count follows the panel (AC-ADM-QE4.1)', async () => {
    const w = await render('/admin/studio/questions/create')
    const rows = w.findAll('[data-testid="studio-completeness-row"]')
    expect(rows.map((r) => r.text())).toContain('Sila pilih subjek.')
    expect(t(w, 'studio-save-gaps').text()).toContain(`${String(rows.length)} belum lengkap`)
    const subject = t(w, 'studio-subject').element as HTMLElement
    subject.scrollIntoView = vi.fn()
    await rows.find((r) => r.text() === 'Sila pilih subjek.')!.trigger('click')
    expect(subject.closest('[data-ds="form-field"]')?.contains(document.activeElement)).toBe(true)
  })

  it('adds the API-Q-05 issues once, with their exact text and a link to the field', async () => {
    serve({ ...SAVED, curriculumChapterId: null })
    studio.fetchGateCheck.mockResolvedValue({ issues: [{ path: 'chapterId', code: 'NO_CHAPTER', message: 'Sila pilih Bab.', step: 4 }] })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    expect(studio.fetchGateCheck).toHaveBeenCalledWith('501')
    const rows = w.findAll('[data-testid="studio-completeness-row"]').map((r) => r.text())
    expect(rows).toEqual(['Sila pilih Bab.'])
    expect(t(w, 'studio-save-gaps').text()).toContain('1 belum lengkap')
  })

  it('never says complete when the gate read failed: it says the check could not load', async () => {
    serve({ ...SAVED })
    studio.fetchGateCheck.mockRejectedValue(new Error('network'))
    const w = await render('/admin/studio/questions/501/sunting', '501')
    expect(t(w, 'studio-completeness-failed').text()).toContain('tidak dapat dimuatkan')
    expect(has(w, 'studio-completeness-empty')).toBe(false)
  })

  it('never says complete when the chapter or DSKP read failed', async () => {
    serve({ ...SAVED })
    studio.fetchGateCheck.mockResolvedValue({ issues: [] })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    const panel = () => has(w, 'studio-completeness-failed')
    expect(panel()).toBe(false)
    w.getComponent({ name: 'ChapterSelect' }).vm.$emit('failed', true)
    await flushPromises()
    expect(panel()).toBe(true)
    expect(has(w, 'studio-completeness-empty')).toBe(false)
    w.getComponent({ name: 'ChapterSelect' }).vm.$emit('failed', false)
    w.getComponent({ name: 'StudioDskpFields' }).vm.$emit('failed', true)
    await flushPromises()
    expect(panel()).toBe(true)
  })

  it('opens the preview on `?pratonton=1` (S2-T03 alias)', async () => {
    serve({ ...SAVED })
    studio.fetchGateCheck.mockResolvedValue({ issues: [] })
    const w = await render('/admin/studio/questions/501/sunting?pratonton=1', '501')
    expect(w.getComponent({ name: 'StudioPreview' }).props('open')).toBe(true)
  })

  it('on create with ?kumpulan= the group is read-only, linked, and prefills Subjek, Tingkatan and Kertas', async () => {
    studio.fetchGroup.mockResolvedValue({ id: '9', label: null, scope: 'section', stimuli: [], questionIds: [], members: [], subjectId: '3', educationLevelId: '7', kertas: '2' })
    const w = await render('/admin/studio/questions/create?kumpulan=9')
    expect(w.getComponent({ name: 'StudioGroupEditor' }).props('disabled')).toBe(true)
    expect(t(w, 'studio-open-group').attributes('href')).toBe('/admin/studio/groups/9')
    expect((t(w, 'studio-level').element as HTMLSelectElement).value).toBe('7')
    expect((t(w, 'studio-kertas').element as HTMLSelectElement).value).toBe('2')
  })

  it('saves Penjelasan and sends the English one only when the question has it (PO decision 3)', async () => {
    serve({ ...SAVED, explanation: 'Sebab A.', explanationEn: null })
    studio.updateStudioQuestion.mockResolvedValue({ data: { id: '501', status: 'draft' }, status: 'ok' })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    expect((t(w, 'studio-explanation').element as HTMLTextAreaElement).value).toBe('Sebab A.')
    expect(has(w, 'studio-explanation-en')).toBe(false)
    await t(w, 'studio-explanation').setValue('Sebab B.')
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    const body = studio.updateStudioQuestion.mock.calls[0]?.[1] as Record<string, unknown>
    expect(body.explanation).toBe('Sebab B.')
    expect('explanationEn' in body).toBe(false)
  })

  it('keeps the English explanation of a bilingual question editable', async () => {
    serve({ ...SAVED, explanation: 'Sebab A.', explanationEn: 'Reason A.' })
    studio.updateStudioQuestion.mockResolvedValue({ data: { id: '501', status: 'draft' }, status: 'ok' })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    await t(w, 'studio-explanation-en').setValue('Reason B.')
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect((studio.updateStudioQuestion.mock.calls[0]?.[1] as Record<string, unknown>).explanationEn).toBe('Reason B.')
  })

  it('asks Jenis tulisan only for the listed subjects; not Rumi shows the keyboard (PO decision 4)', async () => {
    lookups.fetchSubjects.mockResolvedValue({ data: [{ id: 3, name: 'Matematik' }, { id: 8, name: 'Bahasa Arab' }], meta: {} })
    serve({ ...SAVED, subjectId: '8', scriptType: 'mixed' })
    studio.updateStudioQuestion.mockResolvedValue({ data: { id: '501', status: 'draft' }, status: 'ok' })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    expect((t(w, 'studio-script').element as HTMLSelectElement).value).toBe('mixed')
    expect(has(w, 'studio-keyboard-toggle')).toBe(true)
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect((studio.updateStudioQuestion.mock.calls[0]?.[1] as Record<string, unknown>).scriptType).toBe('mixed')
  })

  it('a subject outside the list has no Jenis tulisan, and the save leaves the script alone', async () => {
    serve({ ...SAVED })
    studio.updateStudioQuestion.mockResolvedValue({ data: { id: '501', status: 'draft' }, status: 'ok' })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    expect(has(w, 'studio-script')).toBe(false)
    expect(has(w, 'studio-keyboard-toggle')).toBe(false)
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect('scriptType' in (studio.updateStudioQuestion.mock.calls[0]?.[1] as Record<string, unknown>)).toBe(false)
  })

  it('after the first save on Cipta the same page reads the stored question and its gate', async () => {
    studio.createStudioQuestion.mockResolvedValue({ data: { id: '501', status: 'draft' }, status: 'ok' })
    serve({ ...SAVED, curriculumChapterId: null })
    studio.fetchGateCheck.mockResolvedValue({ issues: [{ path: 'chapterId', code: 'NO_CHAPTER', message: 'Sila pilih Bab.', step: 4 }] })
    const w = await render('/admin/studio/questions/create')
    expect(studio.fetchGateCheck).not.toHaveBeenCalled()
    await w.setProps({ id: '501' })
    await flushPromises()
    expect(studio.fetchGateCheck).toHaveBeenCalledWith('501')
    expect(w.findAll('[data-testid="studio-completeness-row"]').map((r) => r.text())).toEqual(['Sila pilih Bab.'])
  })

  it('shows the all-complete text when nothing is missing', async () => {
    const rowsOf = await import('../../components/studio/StudioCompletenessPanel.vue')
    const w = mount(rowsOf.default, { props: { rows: [] }, global: { stubs: { UButton: true } } })
    expect(w.get('[data-testid="studio-completeness-empty"]').text()).toBe('Semua medan wajib telah lengkap.')
    w.unmount()
  })

  it('arriving from the old form shows the notice once and removes the query (FR-ADM-Q04.7)', async () => {
    await render('/admin/studio/questions/create?dari=borang-lama')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/admin/studio/questions/create')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini.' })
  })

  it('/admin/questions/create redirects to the wizard; the Studio /edit alias goes to /sunting', async () => {
    const form = (await import('../../routes/questions-form')).default
    const studioRoutes = (await import('../../routes/studio')).default
    const r = createRouter({ history: createMemoryHistory(), routes: [...form, ...studioRoutes].map((x) => ({ ...x, ...('redirect' in x ? {} : { component: { template: '<div />' } }) }) as never) })
    await r.push('/admin/questions/create')
    expect(r.currentRoute.value.fullPath).toBe('/admin/studio/questions/create?dari=borang-lama')
    await r.push('/admin/studio/questions/7/edit')
    expect(r.currentRoute.value.fullPath).toBe('/admin/studio/questions/7/sunting')
  })
})

describe('StudioEditorPage (R1-F03b)', () => {
  it('says so when the app is not connected to the real API', async () => {
    studio.studioAvailable.mockReturnValue(false)
    const w = await render('/admin/studio/questions/create')
    expect(t(w, 'studio-unavailable').text()).toContain('pelayan sebenar')
    expect(has(w, 'studio-form')).toBe(false)
  })

  it('creates a draft with number, per-leaf TP and cognitive level, the DSKP unit and SP and the kertas; the group is not sent', async () => {
    studio.createStudioQuestion.mockResolvedValue({ data: { id: '77', status: 'draft' }, status: 'Soalan berjaya ditambah.' })
    const w = await render('/admin/studio/questions/create')
    expect(t(w, 'studio-save-gaps').text()).toContain('belum lengkap')
    const before = Number(/(\d+) belum lengkap/.exec(t(w, 'studio-save-gaps').text())?.[1])

    await t(w, 'studio-subject').setValue('3')
    await t(w, 'studio-level').setValue('7')
    await t(w, 'studio-kertas').setValue('1')
    await t(w, 'studio-number').setValue('1')
    await t(w, 'studio-stem').setValue('Berdasarkan Rajah 1, apakah jenis segi tiga itu?')
    await flushPromises()
    await t(w, 'studio-unit').setValue('40')
    await t(w, 'studio-sp-41').trigger('click')
    await t(w, 'studio-sp-42').trigger('click')
    await t(w, 'studio-leaf-0-prompt').setValue('Pilih jawapan yang betul.')
    for (const l of ['A', 'B', 'C', 'D']) await t(w, `studio-leaf-0-text-${l}`).setValue(`Jenis ${l}`)
    await t(w, 'studio-leaf-0-correct').setValue('B')
    await t(w, 'studio-leaf-0-tp').setValue('3')
    await t(w, 'studio-leaf-0-cognitive').setValue('menganalisis')
    expect(has(w, 'studio-leaf-0-kbat')).toBe(true)
    expect(t(w, 'studio-question-tp').text()).toContain('TP soalan: 3')
    expect(Number(/(\d+) belum lengkap/.exec(w.find('[data-testid="studio-save-gaps"]').exists() ? t(w, 'studio-save-gaps').text() : '0 belum lengkap')?.[1])).toBeLessThan(before)

    // Langkah 2 offers the group at once (D93: a draft group may have 0 members)
    expect(has(w, 'studio-group-create')).toBe(true)
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()

    expect(studio.createStudioQuestion).toHaveBeenCalledTimes(1)
    const body = studio.createStudioQuestion.mock.calls[0]?.[0] as Record<string, unknown>
    expect(body).toMatchObject({
      subjectId: '3',
      educationLevelId: '7',
      kertas: '1',
      curriculumChapterId: null,
      numberLabel: '1',
      tag: { unitId: '40', spIds: ['41', '42'], tp: 3 },
    })
    expect('stimulusGroupId' in body).toBe(false)
    expect((body.parts as Array<Record<string, unknown>>)[0]).toMatchObject({ label: 'a', mode: 'mcq', difficultyTp: 3, cognitiveLevel: 'menganalisis', kbat: 'menganalisis', key: { kind: 'option', correct: 'B' } })
    expect(router.currentRoute.value.fullPath).toBe('/admin/studio/questions/77/sunting')
  })

  it('REQ-A-031: saving a new draft queues the flash "Soalan draf disimpan..." for the edit page', async () => {
    studio.createStudioQuestion.mockResolvedValue({ data: { id: '78', status: 'draft' }, status: 'Soalan berjaya ditambah.' })
    const w = await render('/admin/studio/questions/create')
    await t(w, 'studio-subject').setValue('3')
    await t(w, 'studio-level').setValue('7')
    await t(w, 'studio-kertas').setValue('1')
    await t(w, 'studio-number').setValue('1')
    await t(w, 'studio-stem').setValue('Berdasarkan Rajah 1, apakah jenis segi tiga itu?')
    await flushPromises()
    expect(useFlashStore().pending).toBeNull()

    await t(w, 'studio-form').trigger('submit')
    await flushPromises()

    expect(studio.createStudioQuestion).toHaveBeenCalledTimes(1)
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Soalan draf disimpan. Terbitkan melalui semakan apabila sedia.' })
    expect(router.currentRoute.value.fullPath).toBe('/admin/studio/questions/78/sunting')
  })

  it('opens a saved question, shows its group read through the stimulus API, and saves without sending the group', async () => {
    serve({
      id: '501',
      status: 'draft',
      numberLabel: '1',
      subjectId: '3',
      educationLevelId: '7',
      difficultyLevel: 3,
      questionText: 'S1 berdasarkan Rajah 1, apakah ini?',
      questionImage: null,
      kertas: '1',
      curriculumChapterId: '12',
      stimulusGroup: { id: '9' },
      tag: { unitId: '40', spIds: ['41'], tp: 2 },
      parts: [{ label: 'a', prompt: { ms: 'Pilih.' }, mode: 'mcq', marks: 1, difficultyTp: 2, cognitiveLevel: 'memahami', kbat: 'bukan', options: [{ label: 'A', body: { ms: 'x' } }, { label: 'B', body: { ms: 'y' } }, { label: 'C', body: { ms: 'z' } }], key: { kind: 'option', correct: 'A' } }],
    })
    studio.updateStudioQuestion.mockResolvedValue({ data: { id: '501', status: 'draft' }, status: 'Soalan berjaya dikemaskini.' })
    const w = await render('/admin/studio/questions/501/sunting', '501')
    expect(studio.fetchStudioQuestion).toHaveBeenCalledWith('501')
    expect(studio.fetchGroup).toHaveBeenCalledWith('9')
    expect(w.findAll('[data-testid^="studio-group-member-"][data-testid$="-pos"]')).toHaveLength(2)
    expect(has(w, 'studio-save-gaps')).toBe(false) // every field and every DSKP tag is filled
    expect(t(w, 'studio-save-marks').text()).toBe('1 markah')
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect(studio.updateStudioQuestion).toHaveBeenCalledTimes(1)
    const [id, body] = studio.updateStudioQuestion.mock.calls[0] as [string, Record<string, unknown>]
    expect(id).toBe('501')
    expect('stimulusGroupId' in body).toBe(false)
    expect(body).toMatchObject({ curriculumChapterId: '12', tag: { unitId: '40', spIds: ['41'], tp: 2 } })
  })

  it('shows the server problems with a count and keeps the form', async () => {
    studio.createStudioQuestion.mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields: { educationLevelId: 'Sila pilih tahap pendidikan.', questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.' } }))
    const w = await render('/admin/studio/questions/create')
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'studio-problems').text()).toContain('Ada masalah — 2 ralat.')
    expect(t(w, 'studio-problems').text()).toContain('Sila pilih tahap pendidikan.')
    expect(router.currentRoute.value.fullPath).toBe('/admin/studio/questions/create')
  })

  it('does not let an essay question be saved from here (nothing is dropped silently)', async () => {
    studio.fetchStudioQuestion.mockResolvedValue({
      id: '600', status: 'draft', subjectId: '3', educationLevelId: '7', difficultyLevel: 3, questionText: 'Terangkan proses fotosintesis dengan lengkap.',
      questionImage: null, curriculumChapterId: null, stimulusGroup: null, tag: { unitId: null, spIds: [], tp: null },
      parts: [{ label: 'a', prompt: { ms: 'Terangkan.' }, mode: 'essay', marks: 10, key: { kind: 'rubric' } }],
    })
    const w = await render('/admin/studio/questions/600/sunting', '600')
    expect(t(w, 'studio-unsupported').text()).toContain('(a)')
    expect(t(w, 'studio-save-bar').find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('an approved question is read-only until "Edit sebagai draf" writes the draft at once', async () => {
    const approved = {
      id: '700', status: 'approved', subjectId: '3', educationLevelId: '7', difficultyLevel: 3, questionText: 'Soalan yang sudah diterbitkan kepada murid.',
      questionImage: null, curriculumChapterId: null, stimulusGroup: null, tag: { unitId: '40', spIds: ['41'], tp: 2 },
      parts: [{ label: 'a', prompt: { ms: 'Pilih.' }, mode: 'short_text', marks: 1, difficultyTp: 2, kbat: 'bukan', key: { kind: 'accepted', values: ['abc'] } }],
    }
    studio.fetchStudioQuestion.mockResolvedValue(approved)
    studio.editAsDraft.mockImplementation(() => {
      studio.fetchStudioQuestion.mockResolvedValue({ ...approved, status: 'draft' })
      return Promise.resolve('700')
    })
    const w = await render('/admin/studio/questions/700/sunting', '700')
    expect(t(w, 'studio-status-badge').text()).toBe('Diterbitkan')
    expect(t(w, 'studio-status-text').text()).toBe('Soalan ini boleh dijawab oleh pelajar.')
    expect(t(w, 'studio-approved-note').text()).toContain('Edit sebagai draf')
    expect(t(w, 'studio-stem').attributes('disabled')).toBeDefined()
    await t(w, 'studio-action-edit-as-draft').trigger('click')
    await flushPromises()
    expect(studio.editAsDraft).toHaveBeenCalledWith('700')
    expect(t(w, 'studio-status-badge').text()).toBe('Draf')
    expect(t(w, 'studio-stem').attributes('disabled')).toBeUndefined()
  })

  describe('draft recovery and Pratonton', () => {
    const KEY = 'pp:draft:studio:tetamu:baharu'
    const snapshot = (stem: string) =>
      JSON.stringify({
        v: 2,
        savedAt: '2026-10-31T10:00:00Z',
        draft: {
          subjectId: '3', educationLevelId: '7', kertas: '', numberLabel: '1', stem, stemImageToken: null, chapterId: '', difficulty: 3, unitId: null, spIds: [], groupId: null,
          leaves: [{ label: 'a', mode: 'short_text', prompt: 'Jawab.', marks: 1, tp: null, cognitive: null, options: [], correct: '', accepted: 'abc', numeric: { value: '', tolerance: '', unit: '' } }],
        },
      })
    beforeEach(() => window.localStorage.clear())

    it('offers the unsaved work and restores it (Pulihkan)', async () => {
      window.localStorage.setItem(KEY, snapshot('Soalan yang belum disimpan tadi.'))
      const w = await render('/admin/studio/questions/create')
      expect(t(w, 'studio-recovery').text()).toContain('Terdapat kerja yang belum disimpan daripada sesi sebelum ini.')
      await t(w, 'studio-recovery-restore').trigger('click')
      expect((t(w, 'studio-stem').element as HTMLTextAreaElement).value).toBe('Soalan yang belum disimpan tadi.')
      expect(has(w, 'studio-recovery')).toBe(false)
    })

    it('drops it (Buang) and forgets it', async () => {
      window.localStorage.setItem(KEY, snapshot('Soalan lama yang tidak diperlukan.'))
      const w = await render('/admin/studio/questions/create')
      await t(w, 'studio-recovery-discard').trigger('click')
      expect(has(w, 'studio-recovery')).toBe(false)
      expect(window.localStorage.getItem(KEY)).toBeNull()
      expect((t(w, 'studio-stem').element as HTMLTextAreaElement).value).toBe('')
    })

    it('offers nothing for a damaged snapshot, and keeps typed work for next time', async () => {
      window.localStorage.setItem(KEY, '{rosak')
      vi.useFakeTimers()
      try {
        const w = await render('/admin/studio/questions/create')
        expect(has(w, 'studio-recovery')).toBe(false)
        await t(w, 'studio-stem').setValue('Kerja yang baru ditaip dan belum disimpan.')
        await vi.advanceTimersByTimeAsync(700)
        expect(window.localStorage.getItem(KEY)).toContain('Kerja yang baru ditaip')
      } finally {
        vi.useRealTimers()
      }
    })

    it('a successful save forgets the snapshot', async () => {
      studio.createStudioQuestion.mockResolvedValue({ data: { id: '77', status: 'draft' }, status: 'ok' })
      window.localStorage.setItem(KEY, snapshot('Soalan yang akan disimpan sekarang.'))
      const w = await render('/admin/studio/questions/create')
      await t(w, 'studio-recovery-restore').trigger('click')
      await t(w, 'studio-form').trigger('submit')
      await flushPromises()
      expect(window.localStorage.getItem(KEY)).toBeNull()
    })

    it('Pratonton shows the shared stimulus once with the members of the group', async () => {
      serve({
        id: '501', status: 'draft', subjectId: '3', educationLevelId: '7', difficultyLevel: 3, questionText: 'S1 berdasarkan Rajah 1, apakah ini?',
        questionImage: null, curriculumChapterId: null, stimulusGroup: { id: '9' }, tag: { unitId: '40', spIds: ['41'], tp: 2 },
        parts: [{ label: 'a', prompt: { ms: 'Pilih.' }, mode: 'short_text', marks: 1, difficultyTp: 2, kbat: 'bukan', key: { kind: 'accepted', values: ['x'] } }],
      })
      const w = await render('/admin/studio/questions/501/sunting', '501')
      await t(w, 'studio-preview-open').trigger('click')
      await flushPromises()
      const body = document.body
      // the shared stimulus is ONE group around both members, not one per member
      expect(body.querySelectorAll('[data-testid="stimulus-group"]')).toHaveLength(1)
      const questions = body.querySelector('[data-testid="stimulus-questions"]')
      expect(questions?.querySelectorAll('[data-testid^="studio-preview-q-"]')).toHaveLength(2)
      expect(body.querySelector('[data-testid="studio-preview-q-501"]')?.textContent).toContain('S1 berdasarkan Rajah 1')
      expect(body.querySelector('[data-testid="studio-preview-q-502"]')?.textContent).toContain('S502 berdasarkan Rajah 1')
    })
  })

  it('creates a question straight into a group with ?kumpulan= (POST /stimulus-groups/:id/questions)', async () => {
    studio.createQuestionInGroup.mockResolvedValue({ data: { id: '88', status: 'draft' }, status: 'Soalan berjaya ditambah ke dalam kumpulan.' })
    const w = await render('/admin/studio/questions/create?kumpulan=9')
    expect(studio.fetchGroup).toHaveBeenCalledWith('9')
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect(studio.createQuestionInGroup).toHaveBeenCalledTimes(1)
    expect(studio.createQuestionInGroup.mock.calls[0]?.[0]).toBe('9')
    expect(studio.createStudioQuestion).not.toHaveBeenCalled()
    expect('stimulusGroupId' in (studio.createQuestionInGroup.mock.calls[0]?.[1] as Record<string, unknown>)).toBe(false)
  })

  it('asks for the number of the question and, on an SPM level, for the kertas', async () => {
    const w = await render('/admin/studio/questions/create')
    expect(has(w, 'studio-number')).toBe(true)
    await t(w, 'studio-level').setValue('7')
    await flushPromises()
    const gaps = Number(/(\d+) belum lengkap/.exec(t(w, 'studio-save-gaps').text())?.[1])
    await t(w, 'studio-kertas').setValue('2')
    expect(Number(/(\d+) belum lengkap/.exec(t(w, 'studio-save-gaps').text())?.[1])).toBe(gaps - 1)
  })

  it('D93: a group made on the create page takes the question when it is saved (0 members first)', async () => {
    studio.createStimulus.mockResolvedValue({ data: GROUP.stimuli[0], status: 'ok' })
    studio.createGroup.mockResolvedValue({ data: { ...GROUP, questionIds: [], warning: 'Kumpulan ini kini kosong.' }, status: 'ok' })
    studio.createQuestionInGroup.mockResolvedValue({ data: { id: '99', status: 'draft' }, status: 'ok' })
    const w = await render('/admin/studio/questions/create')
    await t(w, 'studio-group-new-label').setValue('Petikan 1')
    await t(w, 'studio-group-new-body').setValue('Petikan tentang pasar tani.')
    await t(w, 'studio-group-create').trigger('click')
    await flushPromises()
    // Nothing is created before the save: leaving the page leaves no orphan stimulus or group.
    expect(studio.createStimulus).not.toHaveBeenCalled()
    expect(studio.createGroup).not.toHaveBeenCalled()
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect(studio.createStimulus).toHaveBeenCalledTimes(1)
    expect(studio.createGroup).toHaveBeenCalledWith({ label: 'Petikan 1', stimulusIds: ['70'], questionIds: [] })
    expect(studio.createQuestionInGroup.mock.calls[0]?.[0]).toBe('9')
    expect(studio.createStudioQuestion).not.toHaveBeenCalled()
  })
})
