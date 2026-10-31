// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useFlashStore } from '@/stores/flash'

import type { QuestionDetail } from '../../api/questions'
import QuestionCreatePage from '../../pages/QuestionCreatePage.vue'
import { IMAGE_PLACEHOLDER } from '../../lib/image-url'
import QuestionEditPage from '../../pages/QuestionEditPage.vue'

const questions = vi.hoisted(() => ({
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  fetchQuestion: vi.fn(),
}))
const lookups = vi.hoisted(() => ({
  fetchSubjects: vi.fn(),
  fetchEducationLevels: vi.fn(),
  fetchDskpBidang: vi.fn(),
  fetchDskpSk: vi.fn(),
  fetchDskpSp: vi.fn(),
  fetchChapters: vi.fn(),
}))
vi.mock('../../api/questions', () => questions)
vi.mock('../../api/lookups', () => lookups)
vi.mock('@/app/router', () => ({ setRouteOutcome: vi.fn() }))

const BIDANG = [
  { id: 515, code: 'T5-SUB4-TEXTBOOK', name: 'Sains T5 - Sokongan' },
  { id: 516, code: null, name: 'Tanpa kod' },
]
const CHAPTERS = [
  { id: 71, name: 'Bumi dan Angkasa', chapterNumber: 1 },
  { id: 72, name: 'Tenaga', chapterNumber: 2 },
  { id: 73, name: 'Tanpa nombor', chapterNumber: null },
]
const SK = [{ id: 2667, code: 'T5S4.B1', description: 'Menguasai konsep' }]
const SP = [
  { id: 6191, code: 'T5S4.B1.1', description: 'Menjawab soalan' },
  { id: 6192, code: 'T5S4.B1.2', description: 'Lain' },
]

function detail(over: Partial<QuestionDetail> = {}): QuestionDetail {
  return {
    id: 564159,
    subjectId: 4,
    educationLevelId: 11,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: 'Apakah maksud satelit buatan? Pilih yang tepat.',
    questionImage: null,
    options: ['A1', 'B1', 'C1', 'D1'],
    optionImages: [null, null, null, null],
    correctAnswer: 2,
    tfAnswer: null,
    correctAnswerText: null,
    altAnswers: [],
    modelAnswer: null,
    explanation: 'Penjelasan',
    aiExplanation: null,
    language: 'en',
    pointsValue: 3,
    status: 'approved',
    isActive: true,
    complianceStatus: 'verified',
    aiVerified: false,
    sourceType: null,
    sourceFile: null,
    sourcePage: null,
    sourceSet: null,
    qualityScore: null,
    needsDiagram: false,
    spmPool: true,
    dskpSpId: 6191,
    curriculumChapterId: null,
    curriculumTopicId: null,
    chapterLabel: null,
    scriptType: 'rumi',
    textDirection: 'ltr',
    pkskDomainId: null,
    pkskTargetLevel: null,
    pkskOptions: null,
    createdAt: '2026-05-18T23:21:00+08:00',
    updatedAt: '2026-05-18T23:21:00+08:00',
    usage: { attempts: 0, correct: 0 },
    subject: { id: 4, name: 'Sains' },
    level: { id: 11, name: 'Tingkatan 5' },
    dskp: {
      bidang: { id: 515, code: 'T5-SUB4-TEXTBOOK', name: 'Sains T5 - Sokongan' },
      sk: { id: 2667, code: 'T5S4.B1', description: 'Menguasai konsep' },
      sp: { id: 6191, code: 'T5S4.B1.1', description: 'Menjawab soalan' },
    },
    createdBy: { id: 1, name: null },
    ...over,
  }
}

let wrapper: VueWrapper | null = null
let router: Router
const stub = { template: '<div />' }

async function render(kind: 'create' | 'edit', id = 564159): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions', component: stub },
      { path: '/admin/questions/:id', component: stub },
      { path: '/page', component: kind === 'create' ? QuestionCreatePage : QuestionEditPage },
    ],
  })
  await router.push('/page')
  wrapper = mount(kind === 'create' ? QuestionCreatePage : QuestionEditPage, {
    props: kind === 'edit' ? { id } : {},
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
/** A `URadioGroup` item: Reka radios carry no test id; the group has the id, the item its value. */
const radio = (w: VueWrapper, group: string, value: string) =>
  w.get(`[id="${group}"] [role="radio"][value="${value}"]`)
const checked = (w: VueWrapper, group: string, value: string) =>
  radio(w, group, value).attributes('aria-checked')
const value = (w: VueWrapper, id: string) =>
  (t(w, id).element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of [...Object.values(questions), ...Object.values(lookups)]) fn.mockReset()
  vi.mocked(setRouteOutcome).mockReset()
  lookups.fetchSubjects.mockResolvedValue({ data: [{ id: 4, name: 'Sains' }] })
  lookups.fetchEducationLevels.mockResolvedValue({ data: [{ id: 11, name: 'Tingkatan 5' }] })
  lookups.fetchDskpBidang.mockResolvedValue(BIDANG)
  lookups.fetchDskpSk.mockResolvedValue(SK)
  lookups.fetchDskpSp.mockResolvedValue(SP)
  lookups.fetchChapters.mockResolvedValue(CHAPTERS)
  questions.fetchQuestion.mockResolvedValue(detail())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('QuestionCreatePage (M04 S2)', () => {
  it('renders the header, the native required fields and the live defaults', async () => {
    const w = await render('create')
    expect(w.text()).toContain('Isi maklumat di bawah untuk menambah soalan baharu')
    for (const id of ['q-subject', 'q-level', 'q-text'])
      expect(t(w, id).attributes('required')).toBeDefined()
    expect(w.findAll('[data-testid=q-subject] option').map((o) => o.text())).toEqual([
      'Pilih Subjek',
      'Sains',
    ])
    expect(radio(w, 'q-difficulty', '1').attributes('role')).toBe('radio')
    expect(checked(w, 'q-difficulty', '3')).toBe('false')
    expect(value(w, 'q-type')).toBe('mcq')
    expect(checked(w, 'q-correct-0', '0')).toBe('true')
    expect(t(w, 'q-option-0').attributes('required')).toBeDefined()
    expect(value(w, 'q-points')).toBe('1')
    expect(value(w, 'q-language')).toBe('bm')
    expect(t(w, 'form-submit').text()).toBe('Simpan Soalan')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/questions')
    expect(w.find('[data-testid=question-form]').attributes('novalidate')).toBeUndefined()
  })

  it('switching the type shows its card, drops the MCQ requirement and keeps hidden values', async () => {
    const w = await render('create')
    await t(w, 'q-option-0').setValue('Tersimpan')
    await t(w, 'q-type').setValue('short_answer')
    expect((t(w, 'mcq-card').element as HTMLElement).style.display).toBe('none')
    expect((t(w, 'short-card').element as HTMLElement).style.display).not.toBe('none')
    expect(t(w, 'short-card').text()).toContain('Jawapan Pendek')
    expect(t(w, 'q-answer-text').attributes('required')).toBeUndefined()
    expect(t(w, 'q-option-0').attributes('required')).toBeUndefined()
    await t(w, 'q-type').setValue('fill_blank')
    expect(t(w, 'short-card').text()).toContain('Jawapan Isi Tempat Kosong')
    await t(w, 'q-type').setValue('mcq')
    expect(value(w, 'q-option-0')).toBe('Tersimpan')
  })

  it('cascades Bidang, SK and SP and shows "DSKP tagged" for an SP', async () => {
    const w = await render('create')
    expect(t(w, 'dskp-sk').attributes('disabled')).toBeDefined()
    expect(lookups.fetchDskpBidang).not.toHaveBeenCalled()
    await t(w, 'q-subject').setValue('4')
    expect(lookups.fetchDskpBidang).not.toHaveBeenCalled()
    await t(w, 'q-level').setValue('11')
    await flushPromises()
    expect(lookups.fetchDskpBidang).toHaveBeenCalledWith({
      subjectId: '4',
      educationLevelId: '11',
    })
    expect(w.findAll('[data-testid=dskp-bidang] option').map((o) => o.text())).toEqual([
      '-- Pilih Bidang --',
      'T5-SUB4-TEXTBOOK - Sains T5 - Sokongan',
      'Tanpa kod',
    ])
    await t(w, 'dskp-bidang').setValue('515')
    await flushPromises()
    expect(t(w, 'dskp-sk').attributes('disabled')).toBeUndefined()
    await t(w, 'dskp-sk').setValue('2667')
    await flushPromises()
    expect(t(w, 'dskp-sp').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-testid=dskp-tagged]').exists()).toBe(false)
    await t(w, 'dskp-sp').setValue('6192')
    expect(t(w, 'dskp-tagged').text()).toBe('DSKP tagged')
    expect(w.find('[data-testid=dskp-remove]').exists()).toBe(false)
  })

  it('Bab is optional: disabled until Subjek and Tahap are set, then loads their chapters with a "—" choice', async () => {
    const w = await render('create')
    expect(t(w, 'q-chapter').attributes('disabled')).toBeDefined()
    expect(lookups.fetchChapters).not.toHaveBeenCalled()
    await t(w, 'q-subject').setValue('4')
    await t(w, 'q-level').setValue('11')
    await flushPromises()
    expect(lookups.fetchChapters).toHaveBeenLastCalledWith({ subjectId: '4', educationLevelId: '11' })
    expect(t(w, 'q-chapter').attributes('disabled')).toBeUndefined()
    expect(w.findAll('[data-testid=q-chapter] option').map((o) => o.text())).toEqual([
      '—',
      'Bab 1: Bumi dan Angkasa',
      'Bab 2: Tenaga',
      'Tanpa nombor',
    ])
    expect(value(w, 'q-chapter')).toBe('')
  })

  it('choosing a Bab posts curriculumChapterId; changing Tahap clears the choice', async () => {
    questions.createQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    lookups.fetchEducationLevels.mockResolvedValue({
      data: [
        { id: 11, name: 'Tingkatan 5' },
        { id: 10, name: 'Tingkatan 4' },
      ],
    })
    const w = await render('create')
    await t(w, 'q-subject').setValue('4')
    await t(w, 'q-level').setValue('11')
    await flushPromises()
    await t(w, 'q-chapter').setValue('72')
    expect(value(w, 'q-chapter')).toBe('72')
    await t(w, 'q-level').setValue('10')
    await flushPromises()
    expect(value(w, 'q-chapter')).toBe('')
    expect(lookups.fetchChapters).toHaveBeenLastCalledWith({ subjectId: '4', educationLevelId: '10' })
    await t(w, 'q-chapter').setValue('71')
    await radio(w, 'q-difficulty', '3').trigger('click')
    await t(w, 'q-text').setValue('Apakah ibu negara Malaysia?')
    for (const [i, text] of ['A', 'B', 'C', 'D'].entries())
      await t(w, `q-option-${i}`).setValue(text)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(questions.createQuestion.mock.calls[0]?.[0]).toMatchObject({ curriculumChapterId: '71' })
  })

  it('without a Bab the create body has no curriculumChapterId', async () => {
    questions.createQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await render('create')
    await t(w, 'q-subject').setValue('4')
    await t(w, 'q-level').setValue('11')
    await radio(w, 'q-difficulty', '3').trigger('click')
    await t(w, 'q-text').setValue('Apakah ibu negara Malaysia?')
    for (const [i, text] of ['A', 'B', 'C', 'D'].entries())
      await t(w, `q-option-${i}`).setValue(text)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(questions.createQuestion.mock.calls[0]?.[0]).not.toHaveProperty('curriculumChapterId')
  })

  it('shows the server message of a mismatched Bab under the field', async () => {
    questions.createQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { curriculumChapterId: 'Bab tidak sepadan dengan subjek dan tahap.' },
      }),
    )
    const w = await render('create')
    await t(w, 'q-subject').setValue('4')
    await t(w, 'q-level').setValue('11')
    await radio(w, 'q-difficulty', '3').trigger('click')
    await t(w, 'q-text').setValue('Apakah ibu negara Malaysia?')
    for (const [i, text] of ['A', 'B', 'C', 'D'].entries())
      await t(w, `q-option-${i}`).setValue(text)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Bab tidak sepadan dengan subjek dan tahap.')
  })

  it('clearing Subjek only empties Bidang; SK, SP and the tag stay (AUD-M04-02)', async () => {
    const w = await render('create')
    await t(w, 'q-subject').setValue('4')
    await t(w, 'q-level').setValue('11')
    await flushPromises()
    await t(w, 'dskp-bidang').setValue('515')
    await flushPromises()
    await t(w, 'dskp-sk').setValue('2667')
    await flushPromises()
    await t(w, 'dskp-sp').setValue('6192')
    await t(w, 'q-subject').setValue('')
    await flushPromises()
    expect(w.findAll('[data-testid=dskp-bidang] option')).toHaveLength(1)
    expect(value(w, 'dskp-bidang')).toBe('')
    expect(t(w, 'dskp-sk').attributes('disabled')).toBeUndefined()
    expect(value(w, 'dskp-sp')).toBe('6192')
    expect(w.find('[data-testid=dskp-tagged]').exists()).toBe(true)
    // Setting both again resets the three.
    await t(w, 'q-subject').setValue('4')
    await flushPromises()
    expect(value(w, 'dskp-sp')).toBe('')
    expect(w.find('[data-testid=dskp-tagged]').exists()).toBe(false)
  })

  it('posts the form and opens the list with the API flash', async () => {
    questions.createQuestion.mockResolvedValue({ data: {}, status: 'Soalan berjaya ditambah.' })
    const w = await render('create')
    await t(w, 'q-subject').setValue('4')
    await t(w, 'q-level').setValue('11')
    await radio(w, 'q-difficulty', '3').trigger('click')
    await t(w, 'q-text').setValue('Apakah ibu negara Malaysia?')
    for (const [i, text] of ['A', 'B', 'C', 'D'].entries())
      await t(w, `q-option-${i}`).setValue(text)
    await radio(w, 'q-correct-1', '1').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(questions.createQuestion).toHaveBeenCalledTimes(1)
    const body = questions.createQuestion.mock.calls[0]?.[0] as Record<string, unknown>
    expect(body).toMatchObject({
      subjectId: '4',
      educationLevelId: '11',
      difficultyLevel: '3',
      questionType: 'mcq',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: '1',
      language: 'bm',
      pointsValue: '1',
      dskpSpId: '',
    })
    expect(router.currentRoute.value.path).toBe('/admin/questions')
    expect(useFlashStore().pending?.message).toBe('Soalan berjaya ditambah.')
  })

  it('shows server messages under their fields and keeps the input', async () => {
    questions.createQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: {
          questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
          correctAnswerText: 'Sila masukkan jawapan betul.',
        },
      }),
    )
    const w = await render('create')
    await t(w, 'q-type').setValue('short_answer')
    await radio(w, 'q-difficulty', '3').trigger('click')
    await t(w, 'q-text').setValue('Pendek')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/page')
    const errors = w.findAll('[data-testid="field-error"]').map((e) => e.text())
    expect(errors).toEqual([
      'Teks soalan mesti sekurang-kurangnya 10 aksara.',
      'Sila masukkan jawapan betul.',
    ])
    expect(value(w, 'q-text')).toBe('Pendek')
    expect(t(w, 'q-text').attributes('aria-invalid')).toBe('true')
  })

  it('a failed load shows the red box with "Cuba Semula" that retries', async () => {
    lookups.fetchSubjects.mockRejectedValueOnce(new Error('x'))
    const w = await render('create')
    expect(t(w, 'question-form-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w, 'question-form-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=question-form]').exists()).toBe(true)
  })

  it('the keyboard toggle opens the panel, sets rtl and the Jawi font, and inserts text', async () => {
    const w = await render('create')
    const textarea = t(w, 'q-text').element as HTMLTextAreaElement
    expect(textarea.getAttribute('dir')).toBeNull()
    await t(w, 'vkb-toggle').trigger('click')
    expect(textarea.getAttribute('dir')).toBe('rtl')
    expect(textarea.closest('.font-jawi')).not.toBeNull()
    const panel = document.body.querySelector('[data-testid=vkb-panel]')
    expect(panel?.textContent).toContain('Papan Kekunci Arab')
    const key = document.body.querySelector('[data-testid=vkb-key]') as HTMLElement
    key.click()
    await flushPromises()
    expect(textarea.value).toBe('ض')
    ;(document.body.querySelector('[data-testid=vkb-backspace]') as HTMLElement).click()
    await flushPromises()
    expect(textarea.value).toBe('')
    ;(document.body.querySelector('[data-testid=vkb-mode-jawi]') as HTMLElement).click()
    await flushPromises()
    expect(document.body.querySelector('[data-testid=vkb-caption]')?.textContent?.trim()).toBe(
      'Papan Kekunci Jawi',
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.body.querySelector('[data-testid=vkb-panel]')).toBeNull()
    expect(textarea.getAttribute('dir')).toBe('rtl')
  })

  it('shows a preview for a chosen image, and the prompt again after removing it', async () => {
    const w = await render('create')
    const input = t(w, 'q-image-input')
    const file = new File([new Uint8Array([1, 2, 3])], 'rajah.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(w.find('[data-testid=q-image-preview]').exists()).toBe(true))
    expect(t(w, 'q-image').text()).not.toContain('Klik untuk muat naik gambar')
    await t(w, 'q-image-remove').trigger('click')
    expect(w.find('[data-testid=q-image-preview]').exists()).toBe(false)
    expect(t(w, 'q-image').text()).toContain('Klik untuk muat naik gambar')
  })
})

describe('QuestionEditPage (M04 S4)', () => {
  it('pre-fills the form, has no type select or keyboard, and preloads the DSKP chain', async () => {
    const w = await render('edit')
    expect(questions.fetchQuestion).toHaveBeenCalledWith(564159, expect.anything())
    expect(w.text()).toContain('Kemaskini maklumat soalan #564159')
    expect(w.find('[data-testid=q-type]').exists()).toBe(false)
    expect(w.find('[data-testid=vkb-toggle]').exists()).toBe(false)
    expect(value(w, 'q-subject')).toBe('4')
    expect(value(w, 'q-level')).toBe('11')
    expect(checked(w, 'q-difficulty', '3')).toBe('true')
    expect(value(w, 'q-text')).toContain('satelit buatan')
    expect(value(w, 'q-option-2')).toBe('C1')
    expect(checked(w, 'q-correct-2', '2')).toBe('true')
    expect(value(w, 'q-language')).toBe('en')
    expect(value(w, 'q-points')).toBe('3')
    expect(value(w, 'dskp-bidang')).toBe('515')
    expect(value(w, 'dskp-sk')).toBe('2667')
    expect(value(w, 'dskp-sp')).toBe('6191')
    expect(t(w, 'dskp-tagged').text()).toBe('DSKP tagged')
    expect(t(w, 'form-submit').text()).toBe('Kemaskini Soalan')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/questions/564159')
  })

  it('"Buang tag DSKP" resets the three selects and saving posts an empty dskpSpId', async () => {
    questions.updateQuestion.mockResolvedValue({ data: {}, status: 'Soalan berjaya dikemaskini.' })
    const w = await render('edit')
    await t(w, 'dskp-remove').trigger('click')
    expect(value(w, 'dskp-bidang')).toBe('')
    expect(t(w, 'dskp-sk').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid=dskp-tagged]').exists()).toBe(false)
    expect(w.find('[data-testid=dskp-remove]').exists()).toBe(false)
    await w.get('form').trigger('submit')
    await flushPromises()
    const [id, body] = questions.updateQuestion.mock.calls[0] as [number, Record<string, unknown>]
    expect(id).toBe(564159)
    expect(body.dskpSpId).toBe('')
    expect(body).not.toHaveProperty('questionType')
    expect(router.currentRoute.value.path).toBe('/admin/questions/564159')
    expect(useFlashStore().pending?.message).toBe('Soalan berjaya dikemaskini.')
  })

  it('pre-fills the saved Bab, keeps it on save, and "—" posts an empty id to clear it', async () => {
    questions.updateQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    questions.fetchQuestion.mockResolvedValue(
      detail({ curriculumChapterId: 72, chapterLabel: 'Tenaga' }),
    )
    const w = await render('edit')
    expect(lookups.fetchChapters).toHaveBeenCalledWith({ subjectId: '4', educationLevelId: '11' })
    expect(value(w, 'q-chapter')).toBe('72')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((questions.updateQuestion.mock.calls[0]?.[1] as Record<string, unknown>).curriculumChapterId).toBe('72')
    await t(w, 'q-chapter').setValue('')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((questions.updateQuestion.mock.calls[1]?.[1] as Record<string, unknown>).curriculumChapterId).toBe('')
  })

  it('keeps a saved Bab that is not in the list (for example inactive) under its saved label', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({ curriculumChapterId: 99, chapterLabel: 'Bab lama' }),
    )
    const w = await render('edit')
    expect(value(w, 'q-chapter')).toBe('99')
    expect(w.findAll('[data-testid=q-chapter] option').map((o) => o.text())).toContain('Bab lama')
  })

  it('a failed chapter lookup shows the load error and leaves the saved Bab alone', async () => {
    lookups.fetchChapters.mockRejectedValue(new Error('x'))
    questions.fetchQuestion.mockResolvedValue(detail({ curriculumChapterId: 72, chapterLabel: 'Tenaga' }))
    const w = await render('edit')
    expect(w.text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    expect(value(w, 'q-chapter')).toBe('72')
  })

  it('saving untouched keeps the saved SP (DV-M04-15)', async () => {
    questions.updateQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await render('edit')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((questions.updateQuestion.mock.calls[0]?.[1] as Record<string, unknown>).dskpSpId).toBe(
      '6191',
    )
  })

  it.each([
    ['Bidang', 'fetchDskpBidang'],
    ['SK', 'fetchDskpSk'],
    ['SP', 'fetchDskpSp'],
  ] as const)(
    'a failed %s lookup keeps the saved SP, shows "Cuba Semula" and saving posts it (T4-1)',
    async (_name, fn) => {
      questions.updateQuestion.mockResolvedValue({ data: {}, status: 'ok' })
      lookups[fn].mockRejectedValueOnce(new Error('x'))
      const w = await render('edit')
      expect(t(w, 'dskp-load-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
      expect(t(w, 'dskp-tagged').text()).toBe('DSKP tagged')
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(
        (questions.updateQuestion.mock.calls[0]?.[1] as Record<string, unknown>).dskpSpId,
      ).toBe('6191')
    },
  )

  it('"Cuba Semula" reloads the saved chain and the error goes away', async () => {
    lookups.fetchDskpBidang.mockRejectedValueOnce(new Error('x'))
    const w = await render('edit')
    expect(value(w, 'dskp-bidang')).toBe('')
    await t(w, 'dskp-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=dskp-load-error]').exists()).toBe(false)
    expect(value(w, 'dskp-bidang')).toBe('515')
    expect(value(w, 'dskp-sp')).toBe('6191')
  })

  it('clears a saved id that is missing from its new parent list', async () => {
    lookups.fetchDskpSp.mockResolvedValue([{ id: 7000, code: 'X', description: 'Lain' }])
    const w = await render('edit')
    expect(value(w, 'dskp-sk')).toBe('2667')
    expect(value(w, 'dskp-sp')).toBe('')
    expect(w.find('[data-testid=dskp-tagged]').exists()).toBe(false)
  })

  it("shows another type's card pre-filled and no MCQ requirement", async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({
        questionType: 'short_answer',
        options: null,
        correctAnswer: null,
        correctAnswerText: 'Bumi',
        altAnswers: ['Planet Bumi', 'Earth'],
        dskp: null,
      }),
    )
    const w = await render('edit')
    expect((t(w, 'short-card').element as HTMLElement).style.display).not.toBe('none')
    expect((t(w, 'mcq-card').element as HTMLElement).style.display).toBe('none')
    expect(value(w, 'q-answer-text')).toBe('Bumi')
    expect(value(w, 'q-alt')).toBe('Planet Bumi, Earth')
    expect(t(w, 'q-option-0').attributes('required')).toBeUndefined()
    expect(w.find('[data-testid=dskp-remove]').exists()).toBe(false)
  })

  it('a saved image shows as the preview; removing it posts removeQuestionImage', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({
        questionImage: 'blob:mock/question/a.png',
        optionImages: [null, 'blob:mock/question/b.png', null, null],
      }),
    )
    questions.updateQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await render('edit')
    expect(w.find('[data-testid=q-image-preview]').exists()).toBe(true)
    // A saved blob:mock image shows the grey placeholder, not a hidden or broken image.
    const preview = w.find('[data-testid=q-image-preview]').element as HTMLImageElement
    expect(preview.tagName).toBe('IMG')
    expect(preview.getAttribute('src')).toBe(IMAGE_PLACEHOLDER)
    await t(w, 'q-image-remove').trigger('click')
    await t(w, 'q-option-image-1-remove').trigger('click')
    expect(t(w, 'q-image').text()).toContain('Klik untuk muat naik gambar')
    await w.get('form').trigger('submit')
    await flushPromises()
    const body = questions.updateQuestion.mock.calls[0]?.[1] as Record<string, unknown>
    expect(body.removeQuestionImage).toBe(true)
    expect(body.removeOptionImage).toEqual([false, true, false, false])
  })

  it('an unknown id is the standard 404 page', async () => {
    questions.fetchQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    const w = await render('edit', 99999999)
    expect(setRouteOutcome).toHaveBeenCalledWith(404)
    expect(w.find('[data-testid=question-form-error]').exists()).toBe(false)
  })

  it('another load failure shows the red box with "Cuba Semula"', async () => {
    questions.fetchQuestion.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render('edit')
    expect(t(w, 'question-form-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w, 'question-form-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=question-form]').exists()).toBe(true)
  })
})
