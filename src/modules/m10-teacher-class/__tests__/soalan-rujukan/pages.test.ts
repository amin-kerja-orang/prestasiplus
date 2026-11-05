// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import SoalanRujukanCreatePage from '../../pages/SoalanRujukanCreatePage.vue'
import SoalanRujukanEditPage from '../../pages/SoalanRujukanEditPage.vue'
import SoalanRujukanListPage from '../../pages/SoalanRujukanListPage.vue'
import { LEVELS, listMeta, makeRouter, personal } from './fixtures'

const pq = vi.hoisted(() => ({
  fetchPersonalQuestions: vi.fn(),
  fetchPersonalQuestion: vi.fn(),
  createPersonalQuestion: vi.fn(),
  updatePersonalQuestion: vi.fn(),
  deletePersonalQuestion: vi.fn(),
}))
vi.mock('../../api/personal-questions', () => pq)
const guru = vi.hoisted(() => ({
  fetchChapters: vi.fn(() => Promise.resolve([])),
  fetchBidang: vi.fn(() => Promise.resolve([])),
  fetchSk: vi.fn(() => Promise.resolve([])),
  fetchSp: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../api/guru', () => guru)
vi.mock('../../components/soalan/data', () => ({
  fetchLevelOptions: vi.fn(() =>
    Promise.resolve([7, 8, 9, 10, 11].map((id) => ({ id, name: `Tingkatan ${String(id - 6)}` }))),
  ),
  fetchSubjectOptions: vi.fn(() =>
    Promise.resolve([
      { id: 3, name: 'Matematik' },
      { id: 10, name: 'Kimia' },
    ]),
  ),
}))
const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', () => outcome)

let router: Router
const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const all = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  router = makeRouter()
})
afterEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------------------------
async function mountCreate(): Promise<VueWrapper> {
  await router.push('/guru/soalan-guru/cipta')
  const w = mount(SoalanRujukanCreatePage, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

async function fill(w: VueWrapper, over: { url?: string; text?: string } = {}): Promise<void> {
  await t(w, 'r-subject').setValue('3')
  await t(w, 'r-level').setValue('10')
  await t(w, 'r-difficulty').setValue('3')
  await t(w, 'r-text').setValue(over.text ?? 'Soalan baharu?')
  for (const i of [0, 1, 2, 3]) await t(w, `r-option-${String(i)}`).setValue(`P${String(i)}`)
  await w.findAll('[data-testid="r-correct"] [role="radio"]')[1]!.trigger('click')
  if (over.url !== undefined) await t(w, 'r-url').setValue(over.url)
  await flushPromises()
}

describe('Cipta form', () => {
  it('shows the PRD labels, help texts, placeholders and buttons', async () => {
    const w = await mountCreate()
    const text = w.text()
    for (const s of [
      'Kembali ke Soalan & Rujukan',
      'Soalan MCQ Peribadi',
      'Soalan ini hanya kelihatan kepada pelajar anda melalui Misi Harian.',
      'Subjek *',
      'Tahap *',
      'Kesukaran *',
      'Teks Soalan *',
      'Pautan Rujukan (pilihan)',
      'Video YouTube, Anyflip, PDF atau apa-apa link rujukan.',
      'Pilihan Jawapan * (pilih jawapan betul)',
      'Butang radio menandakan jawapan yang betul.',
      'Batal',
      'Simpan Soalan',
    ]) {
      expect(text, s).toContain(s)
    }
    expect(t(w, 'r-subject').text()).toContain('-- Pilih subjek --')
    expect(t(w, 'r-difficulty').text()).toContain('-- Pilih kesukaran --')
    expect(
      all(w, 'r-difficulty')[0]!
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      '-- Pilih kesukaran --',
      '⭐ — Sangat mudah',
      '⭐⭐ — Mudah',
      '⭐⭐⭐ — Sederhana',
      '⭐⭐⭐⭐ — Sukar',
      '⭐⭐⭐⭐⭐ — Sangat sukar',
    ])
  })

  it('AC-GUR-44a-5: Tahap lists "-- Pilih tahap --" and Tingkatan 1 to 5, no Darjah and no "-- Semua tahap --"', async () => {
    const w = await mountCreate()
    expect(
      t(w, 'r-level')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      '-- Pilih tahap --',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
  })

  it('AC-GUR-44a-6 (R): four option rows, one per row, and the targets are 44 px', async () => {
    const w = await mountCreate()
    expect(w.findAll('[data-testid^="r-option-row-"]')).toHaveLength(4)
    expect(t(w, 'form-submit').classes()).toContain('min-h-11')
    expect(t(w, 'form-cancel').classes()).toContain('min-h-11')
    // The radios are card-variant items (padded, whole card clickable), p-3.5 around a 20 px line is 48 px.
    expect(t(w, 'r-correct').html()).toContain('p-3.5')
  })

  it('FR-GUR-44a-6: ONE radiogroup with four radios A to D (arrow keys and group semantics)', async () => {
    const w = await mountCreate()
    expect(w.findAll('[role="radiogroup"]')).toHaveLength(1)
    const radios = w.findAll('[role="radiogroup"] [role="radio"]')
    expect(radios).toHaveLength(4)
    const group = w.find('[role="radiogroup"]').text()
    for (const letter of ['A', 'B', 'C', 'D']) expect(group).toContain(letter)
  })

  it('AC-GUR-44a-1: saves with B correct and the link, goes to the list with "Soalan disimpan."', async () => {
    pq.createPersonalQuestion.mockResolvedValue(personal({ id: 9000001 }))
    const w = await mountCreate()
    await fill(w, { url: 'https://example.org/rujukan' })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(pq.createPersonalQuestion).toHaveBeenCalledTimes(1)
    expect(pq.createPersonalQuestion.mock.calls[0]![0]).toEqual({
      subjectId: 3,
      educationLevelId: 10,
      difficulty: 3,
      text: 'Soalan baharu?',
      options: [{ text: 'P0' }, { text: 'P1' }, { text: 'P2' }, { text: 'P3' }],
      correctIndex: 1,
      referenceUrl: 'https://example.org/rujukan',
    })
    expect(router.currentRoute.value.path).toBe('/guru/soalan-guru')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Soalan disimpan.' })
  })

  it('AC-GUR-44a-2: Teks Soalan empty shows a BM message and nothing is saved', async () => {
    const w = await mountCreate()
    await fill(w, { text: ' ' })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Sila isi teks soalan.')
    expect(pq.createPersonalQuestion).not.toHaveBeenCalled()
  })

  it('an empty form names every required field', async () => {
    const w = await mountCreate()
    await w.find('form').trigger('submit')
    await flushPromises()
    for (const s of [
      'Sila pilih subjek.',
      'Sila pilih tingkatan.',
      'Sila pilih kesukaran.',
      'Sila isi teks soalan.',
      'Sila isi pilihan A.',
      'Sila tanda satu jawapan yang betul.',
    ]) {
      expect(w.text(), s).toContain(s)
    }
    expect(pq.createPersonalQuestion).not.toHaveBeenCalled()
  })

  it('AC-GUR-44a-3: a javascript: link is rejected with a BM message and nothing is saved', async () => {
    const w = await mountCreate()
    await fill(w, { url: 'javascript:alert(1)' })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Pautan mesti bermula dengan http:// atau https://.')
    expect(pq.createPersonalQuestion).not.toHaveBeenCalled()
  })

  it('AC-GUR-44a-8: ftp://contoh shows the exact message and nothing is saved', async () => {
    const w = await mountCreate()
    await fill(w, { url: 'ftp://contoh' })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'r-url').exists()).toBe(true)
    expect(w.text()).toContain('Pautan mesti bermula dengan http:// atau https://.')
    expect(pq.createPersonalQuestion).not.toHaveBeenCalled()
  })

  it('AC-GUR-44a-7: SP empty where DSKP nodes exist names SP; where none exist it is not required', async () => {
    const w = await mountCreate()
    await fill(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(pq.createPersonalQuestion).toHaveBeenCalledTimes(1)

    guru.fetchChapters.mockResolvedValueOnce([
      { id: 7, name: 'Fungsi', chapterNumber: 1, subjectId: 3, educationLevelId: 10 },
    ] as never)
    guru.fetchBidang.mockResolvedValueOnce([{ id: 1 }] as never)
    guru.fetchSk.mockResolvedValueOnce([{ id: 2 }] as never)
    guru.fetchSp.mockResolvedValueOnce([{ id: 3, code: '1.1.1', description: 'Fungsi' }] as never)
    pq.createPersonalQuestion.mockClear()
    const w2 = await mountCreate()
    await fill(w2)
    await w2.find('form').trigger('submit')
    await flushPromises()
    expect(w2.text()).toContain('Sila pilih Standard Pembelajaran (SP).')
    expect(w2.text()).toContain('Sila pilih bab.')
    expect(pq.createPersonalQuestion).not.toHaveBeenCalled()
  })

  it('Kesukaran defaults to min(5, TP) once a TP is chosen, until the teacher touches it', async () => {
    const w = await mountCreate()
    await t(w, 'r-tp').setValue('6')
    expect((t(w, 'r-difficulty').element as HTMLSelectElement).value).toBe('5')
    await t(w, 'r-difficulty').setValue('2')
    await t(w, 'r-tp').setValue('4')
    expect((t(w, 'r-difficulty').element as HTMLSelectElement).value).toBe('2')
  })

  it('a 422 shows the server field texts and keeps the typed values', async () => {
    pq.createPersonalQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { referenceUrl: 'Pautan mesti bermula dengan http:// atau https://.' },
      }),
    )
    const w = await mountCreate()
    await fill(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain(
      'Pautan mesti bermula dengan http:// atau https://.',
    )
    expect((t(w, 'r-text').element as HTMLTextAreaElement).value).toBe('Soalan baharu?')
    expect(router.currentRoute.value.path).toBe('/guru/soalan-guru/cipta')
  })

  it('the submit button says "Menyimpan..." while saving', async () => {
    let release: (v: unknown) => void = () => undefined
    pq.createPersonalQuestion.mockReturnValue(new Promise((r) => (release = r)))
    const w = await mountCreate()
    await fill(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-submit').text()).toBe('Menyimpan...')
    release(personal())
    await flushPromises()
  })
})

// ---------------------------------------------------------------------------------------------
async function mountList(path = '/guru/soalan-guru'): Promise<VueWrapper> {
  await router.push(path)
  await router.isReady()
  const w = mount(SoalanRujukanListPage, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

describe('List', () => {
  beforeEach(() => {
    pq.fetchPersonalQuestions.mockResolvedValue({
      data: [
        personal(),
        personal({
          id: 7802,
          text: 'a'.repeat(130),
          referenceUrl: null,
          difficulty: 5,
          subjectName: 'Kimia',
          educationLevelId: 11,
        }),
      ],
      meta: listMeta(45),
    })
  })

  it('FR-GUR-44a-1: renders the columns Teks (120), Subjek, Tahap, Kesukaran (stars), Rujukan, Edit and Padam', async () => {
    const w = await mountList()
    const cards = all(w, 'rujukan-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Apakah nilai bagi 2x + 3 apabila x = 4?')
    expect(cards[0]!.find('[data-testid="def-subject"]').text()).toContain('Matematik')
    expect(cards[0]!.find('[data-testid="def-level"]').text()).toContain('Tingkatan 4')
    expect(all(w, 'rujukan-difficulty')[0]!.text()).toBe('⭐⭐⭐')
    expect(all(w, 'rujukan-difficulty')[1]!.text()).toBe('⭐⭐⭐⭐⭐')
    expect(all(w, 'rujukan-text')[1]!.text()).toBe(`${'a'.repeat(120)}…`)
    const link = cards[0]!.find('[data-testid="rujukan-link"]')
    expect(link.attributes('href')).toBe('https://example.org/rujukan/ungkapan-algebra')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(cards[1]!.find('[data-testid="rujukan-link"]').exists()).toBe(false)
    expect(cards[0]!.find('[data-testid="rujukan-edit"]').attributes('href')).toBe(
      '/guru/soalan-guru/7801/sunting',
    )
    expect(cards[0]!.find('[data-testid="rujukan-delete"]').text()).toBe('Padam')
    expect(t(w, 'rujukan-add').text()).toBe('Tambah Soalan')
    expect(t(w, 'rujukan-add').attributes('href')).toBe('/guru/soalan-guru/cipta')
  })

  it('defence in depth: a stored non-http reference URL is not rendered as a link', async () => {
    pq.fetchPersonalQuestions.mockResolvedValue({
      data: [personal({ referenceUrl: 'javascript:alert(1)' })],
      meta: listMeta(1),
    })
    const w = await mountList()
    expect(all(w, 'rujukan-card')).toHaveLength(1)
    expect(t(w, 'rujukan-link').exists()).toBe(false)
    expect(w.html()).not.toContain('javascript:')
  })

  it('shows the empty state "Belum ada soalan peribadi." with "Tambah Soalan"', async () => {
    pq.fetchPersonalQuestions.mockResolvedValue({ data: [], meta: listMeta(0) })
    const w = await mountList()
    expect(t(w, 'rujukan-empty').text()).toContain('Belum ada soalan peribadi.')
    expect(t(w, 'rujukan-add-empty').text()).toBe('Tambah Soalan')
  })

  it('AC-GUR-44a-5: the Tahap filter lists "-- Semua tahap --" (default) then Tingkatan 1 to 5', async () => {
    const w = await mountList()
    const sel = t(w, 'rujukan-filter')
    expect(sel.findAll('option').map((o) => o.text())).toEqual([
      '-- Semua tahap --',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect((sel.element as HTMLSelectElement).value).toBe('')
    expect(w.text()).toContain('Tahap')
  })

  it('choosing a Tahap queries educationLevelId and resets the page', async () => {
    const w = await mountList('/guru/soalan-guru?page=2')
    await t(w, 'rujukan-filter').setValue('10')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ educationLevelId: '10' })
    expect(pq.fetchPersonalQuestions).toHaveBeenLastCalledWith(
      { page: 1, educationLevelId: 10 },
      expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
    )
  })

  it('20 per page: requests ?page= and shows the pager', async () => {
    const w = await mountList('/guru/soalan-guru?page=2')
    expect(pq.fetchPersonalQuestions).toHaveBeenCalledWith(
      { page: 2 },
      expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
    )
    expect(t(w, 'rujukan-pager-text').text()).toBe('Menunjukkan 21-22 daripada 45 hasil')
  })

  it('keeps the question when the delete confirm is cancelled, deletes and reloads when accepted', async () => {
    const w = await mountList()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await all(w, 'rujukan-delete')[1]!.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith('Padam soalan #7802? Tindakan ini tidak boleh dibatalkan.')
    expect(pq.deletePersonalQuestion).not.toHaveBeenCalled()

    confirm.mockReturnValueOnce(true)
    pq.deletePersonalQuestion.mockResolvedValue({ deleted: 1 })
    await all(w, 'rujukan-delete')[1]!.trigger('click')
    await flushPromises()
    expect(pq.deletePersonalQuestion).toHaveBeenCalledWith(7802)
    expect(pq.fetchPersonalQuestions).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current?.type).toBe('success')
    confirm.mockRestore()
  })

  it('AC-GUR-44a-9: a 409 shows "Soalan sedang digunakan dalam misi." and the question stays', async () => {
    const w = await mountList()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    pq.deletePersonalQuestion.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Soalan sedang digunakan dalam misi.',
      }),
    )
    await all(w, 'rujukan-delete')[0]!.trigger('click')
    await flushPromises()
    expect(t(w, 'rujukan-delete-error').text()).toContain('Soalan sedang digunakan dalam misi.')
    expect(all(w, 'rujukan-card')).toHaveLength(2)
    expect(pq.fetchPersonalQuestions).toHaveBeenCalledTimes(1)
  })

  it('shows a retry box when the list fails', async () => {
    pq.fetchPersonalQuestions.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
    )
    const w = await mountList()
    expect(t(w, 'rujukan-error').exists()).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
async function mountEdit(id = 7801): Promise<VueWrapper> {
  await router.push(`/guru/soalan-guru/${String(id)}/sunting`)
  const w = mount(SoalanRujukanEditPage, { props: { id }, global: { plugins: [router] } })
  await flushPromises()
  return w
}

describe('Sunting', () => {
  it('preloads the saved question and PUTs the full body, then returns to the list', async () => {
    pq.fetchPersonalQuestion.mockResolvedValue(personal())
    pq.updatePersonalQuestion.mockResolvedValue(personal())
    const w = await mountEdit()
    expect(pq.fetchPersonalQuestion).toHaveBeenCalledWith(7801, expect.anything())
    expect((t(w, 'r-subject').element as HTMLSelectElement).value).toBe('3')
    expect((t(w, 'r-level').element as HTMLSelectElement).value).toBe('10')
    expect((t(w, 'r-text').element as HTMLTextAreaElement).value).toContain('2x + 3')
    expect((t(w, 'r-url').element as HTMLInputElement).value).toBe(
      'https://example.org/rujukan/ungkapan-algebra',
    )
    expect(t(w, 'form-submit').text()).toBe('Simpan Soalan')
    await t(w, 'r-text').setValue('Teks baharu?')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(pq.updatePersonalQuestion).toHaveBeenCalledWith(
      7801,
      expect.objectContaining({
        text: 'Teks baharu?',
        correctIndex: 3,
        referenceUrl: 'https://example.org/rujukan/ungkapan-algebra',
      }),
    )
    expect(router.currentRoute.value.path).toBe('/guru/soalan-guru')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Soalan disimpan.' })
  })

  it("FR-GUR-44a-1: another teacher's id is the standard 404 (no form shown)", async () => {
    pq.fetchPersonalQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not Found.' }),
    )
    const w = await mountEdit(7899)
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(t(w, 'rujukan-form').exists()).toBe(false)
    expect(t(w, 'edit-error').exists()).toBe(false)
  })

  it('a failed load shows the retry box', async () => {
    pq.fetchPersonalQuestion.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
    )
    const w = await mountEdit()
    expect(t(w, 'edit-error').exists()).toBe(true)
    expect(LEVELS).toHaveLength(5)
  })
})
