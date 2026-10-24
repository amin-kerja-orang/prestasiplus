// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import QuestionForm from '../../components/soalan/QuestionForm.vue'
import { makeRouter } from './fixtures'
import { pickFiles } from './pick-file'

const guru = vi.hoisted(() => ({
  fetchChapters: vi.fn(),
  fetchTopics: vi.fn(),
  fetchBidang: vi.fn(),
  fetchSk: vi.fn(),
  fetchSp: vi.fn(),
  createChapter: vi.fn(),
  createTopic: vi.fn(),
  createBidang: vi.fn(),
  createSk: vi.fn(),
  createSp: vi.fn(),
  fetchRajahGallery: vi.fn(() => Promise.resolve({ folders: [] })),
}))
vi.mock('../../api/guru', () => guru)
vi.mock('../../components/soalan/data', () => ({
  fetchLevelOptions: vi.fn(() => Promise.resolve([{ id: 11, name: 'Tingkatan 5' }])),
  fetchSubjectOptions: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: 'Bahasa Melayu' },
      { id: 10, name: 'Kimia' },
    ]),
  ),
}))

const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)

async function mountForm(props: Record<string, unknown> = {}): Promise<VueWrapper> {
  const router = makeRouter()
  await router.push('/guru/soalan/cipta')
  const w = mount(QuestionForm, {
    props: { saving: false, general: [], fields: {}, ...props },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return w
}

async function pickLevelAndSubject(w: VueWrapper): Promise<void> {
  await t(w, 'q-level').setValue('11')
  await t(w, 'q-subject').setValue('1')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  guru.fetchChapters.mockResolvedValue([
    { id: 7, chapterNumber: 2, name: 'Dua' },
    { id: 6, chapterNumber: 1, name: 'Satu' },
  ])
  guru.fetchTopics.mockResolvedValue([{ id: 70, topicNumber: '1.1', name: 'Topik satu' }])
  guru.fetchBidang.mockResolvedValue([{ id: 1, code: '1.0', name: 'Bunyi' }])
  guru.fetchSk.mockResolvedValue([{ id: 11, code: '1.1', description: 'SK satu' }])
  guru.fetchSp.mockResolvedValue([{ id: 111, code: '1.1.1', description: 'SP satu' }])
})
afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('S22 form fields', () => {
  it('renders the live selects, options and defaults', async () => {
    const w = await mountForm()
    expect(t(w, 'q-level').attributes('required')).toBeDefined()
    expect(
      t(w, 'q-subject')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Pilih Subjek --', 'Bahasa Melayu', 'Kimia'])
    expect(
      t(w, 'q-type')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      'Aneka Pilihan (MCQ)',
      'Betul / Salah',
      'Jawapan Pendek',
      'Isi Tempat Kosong',
      'Esei',
    ])
    expect(
      t(w, 'q-difficulty')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Pilih Tahap --', 'Mudah', 'Sederhana', 'Sukar'])
    expect(
      t(w, 'q-script')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Rumi (Latin)', 'Arab', 'Jawi', 'Campuran (Rumi + Arab/Jawi)'])
    expect(t(w, 'q-text').attributes('maxlength')).toBe('2000')
    expect(w.findAll('[data-testid="q-correct"] [role="radio"]')[0]!.attributes('aria-checked')).toBe('true')
    expect(t(w, 'q-option-0').attributes('placeholder')).toBe('Pilihan A')
    expect(t(w, 'q-option-3').attributes('maxlength')).toBe('500')
  })

  it('shows only the answer block of the chosen type', async () => {
    const w = await mountForm()
    expect(t(w, 'mcq-card').exists()).toBe(true)
    await t(w, 'q-type').setValue('true_false')
    expect(t(w, 'mcq-card').exists()).toBe(false)
    expect(t(w, 'tf-card').text()).toContain('Pilih jawapan yang betul untuk pernyataan ini.')
    await t(w, 'q-type').setValue('short_answer')
    expect(t(w, 'short-card').text()).toContain('Pelajar akan dipadankan secara automatik.')
    await t(w, 'q-type').setValue('fill_blank')
    expect(t(w, 'short-card').text()).toContain('Gunakan ___ dalam soalan')
    await t(w, 'q-type').setValue('essay')
    expect(t(w, 'essay-card').text()).toContain('Jawapan Contoh (Model Answer)')
  })

  it('loads Bab, Topik and the DSKP chain from the chosen level and subject', async () => {
    const w = await mountForm()
    expect(t(w, 'q-chapter-add').attributes('disabled')).toBeDefined()
    await pickLevelAndSubject(w)
    expect(guru.fetchChapters).toHaveBeenCalledWith({ subjectId: 1, educationLevelId: 11 })
    expect(
      t(w, 'q-chapter-select')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Pilih Bab --', 'Bab 1: Satu', 'Bab 2: Dua'])
    await t(w, 'q-chapter-select').setValue('6')
    await flushPromises()
    expect(t(w, 'q-topic-select').findAll('option')[1]!.text()).toBe('Topik satu')

    expect(t(w, 'q-sk-select').attributes('disabled')).toBeDefined()
    await t(w, 'q-bidang-select').setValue('1')
    await flushPromises()
    expect(t(w, 'q-sk-select').attributes('disabled')).toBeUndefined()
    await t(w, 'q-sk-select').setValue('11')
    await flushPromises()
    expect(t(w, 'q-sp-select').findAll('option')[1]!.text()).toBe('1.1.1 — SP satu')
  })

  it('clears chapter and topic when the subject changes', async () => {
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-chapter-select').setValue('6')
    await flushPromises()
    await t(w, 'q-subject').setValue('10')
    await flushPromises()
    expect((t(w, 'q-chapter-select').element as HTMLSelectElement).value).toBe('')
  })
})

describe('S22 inline add', () => {
  it('adds a chapter, selects it and loads its topics', async () => {
    guru.createChapter.mockResolvedValue({ id: 99, chapterNumber: 10, name: 'Bab Ujian' })
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-chapter-add').trigger('click')
    await t(w, 'q-chapter-field-number').setValue('10')
    await t(w, 'q-chapter-field-name').setValue('Bab Ujian')
    await t(w, 'q-chapter-save').trigger('click')
    await flushPromises()
    expect(guru.createChapter).toHaveBeenCalledWith({
      subjectId: 1,
      educationLevelId: 11,
      name: 'Bab Ujian',
      chapterNumber: 10,
    })
    expect((t(w, 'q-chapter-select').element as HTMLSelectElement).value).toBe('99')
    expect(t(w, 'q-chapter-select').findAll('option').at(-1)!.text()).toBe('Bab 10: Bab Ujian')
  })

  it('does nothing when the number or name is missing', async () => {
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-chapter-add').trigger('click')
    await t(w, 'q-chapter-field-name').setValue('Tanpa nombor')
    await t(w, 'q-chapter-save').trigger('click')
    expect(guru.createChapter).not.toHaveBeenCalled()
  })

  it('saves the Bidang panel on Enter without submitting the question form (UAT G-49)', async () => {
    guru.createBidang.mockResolvedValue({ id: 55, code: 'B9', name: 'Bidang Baru' })
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-bidang-add').trigger('click')
    await t(w, 'q-bidang-field-code').setValue('B9')
    await t(w, 'q-bidang-field-name').setValue('Bidang Baru')
    await t(w, 'q-bidang-field-name').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(guru.createBidang).toHaveBeenCalledWith({
      subjectId: 1,
      educationLevelId: 11,
      code: 'B9',
      name: 'Bidang Baru',
    })
    expect((t(w, 'q-bidang-select').element as HTMLSelectElement).value).toBe('55')
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('keeps the typed values when the panel is cancelled and ignores a refused add', async () => {
    guru.createSp.mockResolvedValue({ error: 'SP sudah wujud.' })
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-bidang-select').setValue('1')
    await flushPromises()
    await t(w, 'q-sk-select').setValue('11')
    await flushPromises()
    await t(w, 'q-sp-add').trigger('click')
    await t(w, 'q-sp-field-code').setValue('2.2.2')
    await t(w, 'q-sp-cancel').trigger('click')
    expect((t(w, 'q-sp-field-code').element as HTMLInputElement).value).toBe('2.2.2')
    await t(w, 'q-sp-field-description').setValue('Baharu')
    await t(w, 'q-sp-save').trigger('click')
    await flushPromises()
    expect(guru.createSp).toHaveBeenCalledWith({ skId: 11, code: '2.2.2', description: 'Baharu' })
    expect((t(w, 'q-sp-select').element as HTMLSelectElement).value).toBe('')
  })
})

describe('S22 Arabic text, keyboard and gallery', () => {
  it('makes the textarea right to left for Arab and shows the preview', async () => {
    const w = await mountForm()
    expect(t(w, 'q-preview').exists()).toBe(false)
    await t(w, 'q-script').setValue('arab')
    expect(t(w, 'q-text').attributes('dir')).toBe('rtl')
    expect(t(w, 'q-text').attributes('placeholder')).toBe('اكتب السؤال هنا...')
    expect(t(w, 'q-preview-text').text()).toBe('(Tiada teks lagi)')
    await t(w, 'q-text').setValue('نص')
    expect(t(w, 'q-preview-text').text()).toBe('نص')
  })

  it('keeps Campuran left to right but still previews', async () => {
    const w = await mountForm()
    await t(w, 'q-script').setValue('mixed')
    expect(t(w, 'q-text').attributes('dir')).toBeUndefined()
    expect(t(w, 'q-preview').exists()).toBe(true)
  })

  it('opens the keyboard, inserts a key at the caret and switches to Jawi', async () => {
    const w = await mountForm()
    await t(w, 'vkb-toggle').trigger('click')
    expect(document.querySelector('[data-testid="vkb-panel"]')).not.toBeNull()
    expect(t(w, 'q-text').attributes('dir')).toBe('rtl')
    expect(document.querySelector('[data-testid="vkb-caption"]')?.textContent?.trim()).toBe(
      'Papan Kekunci Arab',
    )
    const key = [...document.querySelectorAll('[data-testid="vkb-key"]')].find(
      (k) => k.textContent?.trim() === 'ب',
    ) as HTMLElement
    key.click()
    await flushPromises()
    expect((t(w, 'q-text').element as HTMLTextAreaElement).value).toBe('ب')
    expect(document.querySelectorAll('[data-testid="vkb-harakat"]')).toHaveLength(9)
    ;(document.querySelector('[data-testid="vkb-mode-jawi"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-testid="vkb-caption"]')?.textContent?.trim()).toBe(
      'Papan Kekunci Jawi',
    )
    expect(document.body.textContent).toContain('ڤ')
    ;(document.querySelector('[data-testid="vkb-backspace"]') as HTMLElement).click()
    await flushPromises()
    expect((t(w, 'q-text').element as HTMLTextAreaElement).value).toBe('')
    ;(document.querySelector('[data-testid="vkb-close"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-testid="vkb-panel"]')).toBeNull()
  })

  it('shows the live empty texts in the Galeri Rajah modal', async () => {
    const w = await mountForm()
    await t(w, 'galeri-open').trigger('click')
    await flushPromises()
    const body = document.body.textContent ?? ''
    expect(body).toContain('Galeri Rajah')
    expect(body).toContain('Tiada galeri rajah tersedia')
    expect(body).toContain('Sila muat naik imej secara manual menggunakan butang "Muat Naik"')
    ;(document.querySelector('[data-testid="galeri-cancel"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-testid="galeri-empty"]')).toBeNull()
  })
})

describe('S22 submit', () => {
  it('emits the body, the images and shows the server messages', async () => {
    const w = await mountForm({
      general: ['Sila pilih tahap kesukaran.'],
      fields: { difficultyLevel: 'Sila pilih tahap kesukaran.' },
    })
    expect(t(w, 'form-errors').text()).toContain('Sila pilih tahap kesukaran.')
    await pickLevelAndSubject(w)
    await t(w, 'q-difficulty').setValue('medium')
    await t(w, 'q-text').setValue('Soalan baharu?')
    for (const i of [0, 1, 2, 3]) await t(w, `q-option-${String(i)}`).setValue(`P${String(i)}`)
    await w.findAll('[data-testid="q-correct"] [role="radio"]')[3]!.trigger('click')
    await w.find('form').trigger('submit')
    const [body, image, optionImages] = w.emitted('submit')![0] as [
      Record<string, unknown>,
      File | null,
      (File | null)[],
    ]
    expect(body).toMatchObject({
      educationLevelId: 11,
      subjectId: 1,
      questionType: 'mcq',
      difficultyLevel: 'medium',
      questionText: 'Soalan baharu?',
      options: ['P0', 'P1', 'P2', 'P3'],
      correctAnswer: 3,
    })
    expect(image).toBeNull()
    expect(optionImages).toEqual([null, null, null, null])
  })

  it('has Batal to the list and the submit label of the live footer', async () => {
    const w = await mountForm()
    expect(t(w, 'form-cancel').attributes('href')).toBe('/guru/soalan')
    expect(t(w, 'form-submit').text()).toBe('Hantar untuk Semakan')
  })

  it('takes a chosen question image into the model and drops it again', async () => {
    const w = await mountForm()
    const upload = () =>
      w.findAllComponents({ name: 'FileUpload' }).find((c) => { const el = t(w, 'q-image-input').element; return c.element === el || c.element.contains(el) || el.contains(c.element) })!
    await pickFiles(w, 'q-image-input', [new File(['x'], 'rajah.png', { type: 'image/png' })])
    expect((upload().props('modelValue') as File).name).toBe('rajah.png')
    await pickFiles(w, 'q-image-input', [])
    expect(upload().props('modelValue')).toBeNull()
  })
})
