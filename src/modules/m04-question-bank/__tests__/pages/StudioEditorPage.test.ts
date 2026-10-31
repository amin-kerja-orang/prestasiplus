// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

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
  lookups.fetchSubjects.mockReset().mockResolvedValue({ data: [{ id: 3, name: 'Matematik' }], meta: {} })
  lookups.fetchEducationLevels.mockReset().mockResolvedValue({ data: [{ id: 7, name: 'Tingkatan 4' }], meta: {} })
  lookups.fetchChapters.mockReset().mockResolvedValue([{ id: 12, name: 'Bentuk piawai', chapterNumber: 1 }])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
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

  it('an approved question is read-only until "Edit sebagai draf"', async () => {
    studio.fetchStudioQuestion.mockResolvedValue({
      id: '700', status: 'published', subjectId: '3', educationLevelId: '7', difficultyLevel: 3, questionText: 'Soalan yang sudah diterbitkan kepada murid.',
      questionImage: null, curriculumChapterId: null, stimulusGroup: null, tag: { unitId: '40', spIds: ['41'], tp: 2 },
      parts: [{ label: 'a', prompt: { ms: 'Pilih.' }, mode: 'short_text', marks: 1, difficultyTp: 2, kbat: 'bukan', key: { kind: 'accepted', values: ['abc'] } }],
    })
    const w = await render('/admin/studio/questions/700/sunting', '700')
    expect(t(w, 'studio-approved-note').text()).toContain('Edit sebagai draf')
    expect(t(w, 'studio-stem').attributes('disabled')).toBeDefined()
    await t(w, 'studio-edit-as-draft').trigger('click')
    expect(t(w, 'studio-stem').attributes('disabled')).toBeUndefined()
  })

  describe('draft recovery and Pratonton', () => {
    const KEY = 'pp:draft:studio:tetamu:baharu'
    const snapshot = (stem: string) =>
      JSON.stringify({
        v: 1,
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
    await t(w, 'studio-group-new-body').setValue('Petikan tentang pasar tani.')
    await t(w, 'studio-group-create').trigger('click')
    await flushPromises()
    expect(studio.createGroup).toHaveBeenCalledWith({ label: null, stimulusIds: ['70'], questionIds: [] })
    await t(w, 'studio-form').trigger('submit')
    await flushPromises()
    expect(studio.createQuestionInGroup.mock.calls[0]?.[0]).toBe('9')
    expect(studio.createStudioQuestion).not.toHaveBeenCalled()
  })
})
