// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import QuestionForm from '../../components/soalan/QuestionForm.vue'
import { makeRouter } from './fixtures'

const guru = vi.hoisted(() => ({
  fetchChapters: vi.fn(),
  fetchBidang: vi.fn(),
  fetchSk: vi.fn(),
  fetchSp: vi.fn(),
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
  guru.fetchBidang.mockResolvedValue([{ id: 1, code: '1.0', name: 'Bunyi' }])
  guru.fetchSk.mockResolvedValue([{ id: 11, code: '1.1', description: 'SK satu' }])
  guru.fetchSp.mockResolvedValue([{ id: 111, code: '1.1.1', description: 'SP satu' }])
})
afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

const opts = (w: VueWrapper, id: string) =>
  t(w, id)
    .findAll('option')
    .map((o) => o.text())

/** Fills every field of the form except the ones named in `skip`. */
async function fillAll(w: VueWrapper, skip: string[] = []): Promise<void> {
  await pickLevelAndSubject(w)
  if (!skip.includes('chapter')) await t(w, 'q-chapter').setValue('6')
  if (!skip.includes('sp')) await t(w, 'q-sp').setValue('111')
  if (!skip.includes('tp')) await t(w, 'q-tp').setValue('4')
  if (!skip.includes('aras')) await t(w, 'q-aras').setValue('menilai')
  await t(w, 'q-text').setValue('Soalan baharu?')
  for (const i of [0, 1, 2, 3]) await t(w, `q-option-${String(i)}`).setValue(`P${String(i)}`)
  await w.findAll('[data-testid="q-correct"] [role="radio"]')[3]!.trigger('click')
}

describe('S22 form fields (44-F1)', () => {
  it('renders the PRD selects, options and defaults', async () => {
    const w = await mountForm()
    expect(w.text()).toContain('Tingkatan *')
    expect(w.text()).toContain('Subjek *')
    expect(opts(w, 'q-level')).toEqual(['-- Pilih tingkatan --', 'Tingkatan 5'])
    expect(opts(w, 'q-subject')).toEqual(['-- Pilih subjek --', 'Bahasa Melayu', 'Kimia'])
    expect(opts(w, 'q-tp')).toEqual(['-- Pilih TP --', '1', '2', '3', '4', '5', '6'])
    expect(opts(w, 'q-aras')[0]).toBe('-- Pilih aras --')
    expect(opts(w, 'q-aras')).toContain('Mengaplikasi')
    expect(opts(w, 'q-script')).toEqual([
      'Rumi (Latin)',
      'Arab',
      'Jawi',
      'Campuran (Rumi + Arab/Jawi)',
    ])
    expect(t(w, 'q-text').attributes('maxlength')).toBe('2000')
    expect(t(w, 'q-option-0').attributes('placeholder')).toBe('Pilihan A')
    expect(t(w, 'q-option-3').attributes('maxlength')).toBe('500')
  })

  it('FR-GUR-44-9: Kesukaran offers five star options and a placeholder', async () => {
    const w = await mountForm()
    expect(opts(w, 'q-difficulty')).toEqual([
      '-- Pilih kesukaran --',
      '⭐ — Sangat mudah',
      '⭐⭐ — Mudah',
      '⭐⭐⭐ — Sederhana',
      '⭐⭐⭐⭐ — Sukar',
      '⭐⭐⭐⭐⭐ — Sangat sukar',
    ])
  })

  it('FR-GUR-44-9: MCQ only, no type select, no true/false, short or essay block, no Topik', async () => {
    const w = await mountForm()
    expect(t(w, 'q-type').exists()).toBe(false)
    expect(t(w, 'mcq-card').exists()).toBe(true)
    for (const id of ['tf-card', 'short-card', 'essay-card', 'q-topic', 'q-bidang', 'q-sk']) {
      expect(t(w, id).exists()).toBe(false)
    }
    expect(w.text()).not.toContain('Jenis Soalan')
    expect(w.text()).not.toContain('Topik')
  })

  it('44-F1: no correct answer is preselected on create', async () => {
    const w = await mountForm()
    for (const r of w.findAll('[data-testid="q-correct"] [role="radio"]')) {
      expect(r.attributes('aria-checked')).toBe('false')
    }
  })

  it('44-F1: Bab label "{nombor}. {nama}" in order; SP label "{kod} {nama}"; both load from the pair', async () => {
    const w = await mountForm()
    expect(t(w, 'q-chapter').attributes('disabled')).toBeDefined()
    await pickLevelAndSubject(w)
    expect(guru.fetchChapters).toHaveBeenCalledWith({ subjectId: 1, educationLevelId: 11 })
    expect(guru.fetchBidang).toHaveBeenCalledWith({ subjectId: 1, educationLevelId: 11 }, {})
    expect(opts(w, 'q-chapter')).toEqual(['-- Pilih bab --', '1. Satu', '2. Dua'])
    expect(opts(w, 'q-sp')).toEqual(['-- Pilih SP --', '1.1.1 SP satu'])
    expect(w.text()).toContain('Bab *')
    expect(w.text()).toContain('SP *')
    expect(w.text()).toContain('TP *')
    expect(w.text()).toContain('Aras Pemikiran *')
  })

  it('AC-GUR-44-10: with no chapters and no DSKP nodes the fields say so and are not required', async () => {
    guru.fetchChapters.mockResolvedValue([])
    guru.fetchBidang.mockResolvedValue([])
    const w = await mountForm()
    await pickLevelAndSubject(w)
    expect(opts(w, 'q-chapter')).toEqual(['Tiada bab untuk subjek dan tingkatan ini.'])
    expect(opts(w, 'q-sp')).toEqual(['Tiada SP untuk subjek dan tingkatan ini.'])
    expect(w.text()).not.toContain('Bab *')
    await t(w, 'q-difficulty').setValue('3')
    await t(w, 'q-text').setValue('Soalan?')
    for (const i of [0, 1, 2, 3]) await t(w, `q-option-${String(i)}`).setValue(`P${String(i)}`)
    await w.findAll('[data-testid="q-correct"] [role="radio"]')[0]!.trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()
    const [body] = w.emitted('submit')![0] as [Record<string, unknown>]
    expect(body.chapterId).toBeUndefined()
    expect(body.spIds).toBeUndefined()
    expect(body.tp).toBeUndefined()
  })

  it('clears Bab and SP when the subject changes', async () => {
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-chapter').setValue('6')
    await t(w, 'q-sp').setValue('111')
    await t(w, 'q-subject').setValue('10')
    await flushPromises()
    expect((t(w, 'q-chapter').element as HTMLSelectElement).value).toBe('')
    expect((t(w, 'q-sp').element as HTMLSelectElement).value).toBe('')
  })

  it('44-F1: Kesukaran defaults to min(5, TP) until it is touched', async () => {
    const w = await mountForm()
    await pickLevelAndSubject(w)
    await t(w, 'q-tp').setValue('6')
    expect((t(w, 'q-difficulty').element as HTMLSelectElement).value).toBe('5')
    await t(w, 'q-tp').setValue('2')
    expect((t(w, 'q-difficulty').element as HTMLSelectElement).value).toBe('2')
    await t(w, 'q-difficulty').setValue('4')
    await t(w, 'q-tp').setValue('1')
    expect((t(w, 'q-difficulty').element as HTMLSelectElement).value).toBe('4')
  })
})

describe('S22 failed Bab / SP lookups', () => {
  it('a failed lookup shows the module load-error with retry, never "Tiada ...", and keeps the fields required', async () => {
    guru.fetchChapters.mockRejectedValue(new Error('x'))
    guru.fetchBidang.mockRejectedValue(new Error('x'))
    const w = await mountForm()
    await pickLevelAndSubject(w)
    expect(t(w, 'dskp-lookup-error').text()).toContain('Gagal memuatkan data. Sila cuba lagi.')
    expect(t(w, 'dskp-lookup-error').text()).toContain('Cuba Semula')
    expect(w.text()).not.toContain('Tiada bab untuk subjek dan tingkatan ini.')
    expect(w.text()).not.toContain('Tiada SP untuk subjek dan tingkatan ini.')
    expect(w.text()).toContain('Bab *')
    expect(w.text()).toContain('SP *')
    await t(w, 'q-difficulty').setValue('3')
    await t(w, 'q-text').setValue('Soalan?')
    for (const i of [0, 1, 2, 3]) await t(w, `q-option-${String(i)}`).setValue(`P${String(i)}`)
    await w.findAll('[data-testid="q-correct"] [role="radio"]')[0]!.trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Sila pilih bab.')
  })

  it('Cuba Semula loads the lists again and the error goes away', async () => {
    guru.fetchChapters.mockRejectedValueOnce(new Error('x'))
    const w = await mountForm()
    await pickLevelAndSubject(w)
    expect(t(w, 'dskp-lookup-error').exists()).toBe(true)
    await w.get('[data-testid="dskp-lookup-error"] button').trigger('click')
    await flushPromises()
    expect(t(w, 'dskp-lookup-error').exists()).toBe(false)
    expect(opts(w, 'q-chapter')).toEqual(['-- Pilih bab --', '1. Satu', '2. Dua'])
  })
})

describe('S22 validation (FR-GUR-44-11; AC-GUR-44-10, AC-GUR-44-12)', () => {
  it('an empty form shows every BM text, a banner, and sends nothing', async () => {
    const w = await mountForm()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.emitted('submit')).toBeUndefined()
    const text = w.text()
    for (const m of [
      'Sila pilih tingkatan.',
      'Sila pilih subjek.',
      'Sila pilih kesukaran.',
      'Sila isi soalan.',
      'Sila isi pilihan A.',
      'Sila tanda satu jawapan yang betul.',
    ]) {
      expect(text).toContain(m)
    }
    expect(t(w, 'form-banner').text()).toBe('6 medan perlu dibetulkan.')
  })

  it('AC-GUR-44-12: every field except Bab filled shows "Sila pilih bab." and nothing is created', async () => {
    const w = await mountForm()
    await fillAll(w, ['chapter'])
    await t(w, 'q-difficulty').setValue('3')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Sila pilih bab.')
    expect(w.text()).not.toContain('Sila pilih Standard Pembelajaran (SP).')
  })

  it('AC-GUR-44-10: SP, TP and Aras left empty show their exact texts', async () => {
    const w = await mountForm()
    await fillAll(w, ['sp', 'tp', 'aras'])
    await t(w, 'q-difficulty').setValue('3')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Sila pilih Standard Pembelajaran (SP).')
    expect(w.text()).toContain('Sila pilih TP.')
    expect(w.text()).toContain('Sila pilih aras pemikiran.')
  })

  it('uses no native validation (the BM text shows, not a browser tooltip)', async () => {
    const w = await mountForm()
    expect(t(w, 'question-form').attributes('novalidate')).toBeDefined()
    expect(t(w, 'q-level').attributes('required')).toBeUndefined()
    expect(t(w, 'q-text').attributes('required')).toBeUndefined()
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
})

describe('S22 submit', () => {
  it('emits the MCQ body with the DSKP fields and an int difficultyLevel; shows server messages', async () => {
    const w = await mountForm({
      general: ['Sila pilih bab.'],
      fields: { chapterId: 'Sila pilih bab.' },
    })
    expect(t(w, 'form-errors').text()).toContain('Sila pilih bab.')
    await fillAll(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    const [body] = w.emitted('submit')![0] as [Record<string, unknown>]
    expect(body).toMatchObject({
      educationLevelId: 11,
      subjectId: 1,
      questionType: 'mcq',
      difficultyLevel: 4,
      chapterId: 6,
      spIds: [111],
      tp: 4,
      cognitiveLevel: 'menilai',
      questionText: 'Soalan baharu?',
      options: ['P0', 'P1', 'P2', 'P3'],
      correctAnswer: 3,
    })
    expect(body).not.toHaveProperty('questionImage')
    expect(w.find('[data-testid="q-image"]').exists()).toBe(false)
  })

  it('has Batal to the list and the submit label of the live footer', async () => {
    const w = await mountForm()
    expect(t(w, 'form-cancel').attributes('href')).toBe('/guru/soalan')
    expect(t(w, 'form-submit').text()).toBe('Hantar untuk Semakan')
  })
})
