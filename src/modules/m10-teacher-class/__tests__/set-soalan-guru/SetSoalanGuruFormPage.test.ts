// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { GuruSetBankUnit, QuestionSet } from '../../api/guru'
import type { GuruClass } from '../../api/types'
import SetSoalanGuruFormPage from '../../pages/SetSoalanGuruFormPage.vue'

/**
 * R1-GUR-8b Screen B (form): AC-GUR-8b-1 (Simpan Draf), 8b-6 (checkbox targets), 8b-8 (no class),
 * 8b-9 (group ticks as one row), 8b-11 (101 questions), 8b-12 (locked set) and the bank picker.
 */

const api = vi.hoisted(() => ({
  fetchGuruSet: vi.fn(),
  fetchGuruSetBank: vi.fn(),
  createGuruSet: vi.fn(),
  updateGuruSet: vi.fn(),
  fetchGuruClasses: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)
const lookups = vi.hoisted(() => ({ fetchLevelOptions: vi.fn() }))
vi.mock('../../components/soalan/data', () => lookups)

const unit = (id: string, extra: Partial<GuruSetBankUnit> = {}): GuruSetBankUnit => ({
  kind: 'question',
  id,
  questionIds: [id],
  preview: `Soalan ${id}`,
  subject: 'Sains',
  level: 'Tingkatan 4',
  difficulty: 2,
  stimulus: null,
  ...extra,
})
const bank = (units: GuruSetBankUnit[], nextCursor: string | null = null) => ({ units, nextCursor })
const klass = (id: number, name: string): GuruClass =>
  ({ id: String(id) as unknown as number, name, isActive: true }) as GuruClass
const storedSet = (extra: Partial<QuestionSet> = {}): QuestionSet => ({
  id: '5',
  title: 'Ujian 1',
  status: 'published',
  subjectId: '4',
  educationLevelId: '11',
  questionIds: ['q1', 'q2'],
  classroomIds: ['1'],
  locked: false,
  createdAt: '2026-10-01T09:00:00+08:00',
  updatedAt: '2026-10-02T09:00:00+08:00',
  ...extra,
})

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(path: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/set-soalan', component: { template: '<div />' } },
      { path: '/guru/set-soalan/cipta', component: SetSoalanGuruFormPage },
      { path: '/guru/set-soalan/:id', component: SetSoalanGuruFormPage },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(SetSoalanGuruFormPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const check = async (w: VueWrapper, index: number, on = true): Promise<void> => {
  const boxes = w.findAll('[data-testid="set-bank-check"]')
  await boxes[index]?.trigger('click')
  void on
  await flushPromises()
}
async function fillInfo(w: VueWrapper): Promise<void> {
  await w.get('[data-testid="set-title"]').setValue('Ujian 1')
  await w.get('[data-testid="set-subject"]').setValue('4')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  subjects.fetchSubjectOptions.mockResolvedValue([
    { id: 1, name: 'Bahasa Melayu' },
    { id: 4, name: 'Sains' },
  ])
  lookups.fetchLevelOptions.mockResolvedValue([
    { id: 10, name: 'Tahun 6' },
    { id: 11, name: 'Tingkatan 1' },
    { id: 12, name: 'Tingkatan 2' },
  ])
  api.fetchGuruClasses.mockResolvedValue({
    data: [klass(1, '5 Bestari'), klass(2, '5 Cekap')],
    meta: {},
  })
  api.fetchGuruSetBank.mockResolvedValue(bank([unit('q1'), unit('q2'), unit('q3')]))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('R1-GUR-8b form: layout and filters', () => {
  it('shows the cards, the field labels, Tingkatan 1-5 only and the three action buttons', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    const text = w.text()
    for (const t of [
      'Tapis Bank Soalan',
      'Maklumat Set',
      'Bina set daripada bank soalan dan terbitkan kepada kelas anda',
      'Tajuk Set',
      'Tingkatan (pilihan)',
      'Pilih Soalan Dari Bank',
      'Pilih kelas yang akan melihat set ini.',
      '0 dipilih',
    ])
      expect(text).toContain(t)
    expect(w.findAll('[data-testid="set-subject"] option').map((o) => o.text())[0]).toBe(
      '-- Pilih subjek --',
    )
    expect(w.findAll('[data-testid="set-level"] option').map((o) => o.text())).toEqual([
      '— Tiada —',
      'Tingkatan 1',
      'Tingkatan 2',
    ])
    expect(w.findAll('[data-testid="set-filter-subject"] option')[0]?.text()).toBe('Semua subjek')
    expect(w.findAll('[data-testid="set-filter-level"] option')[0]?.text()).toBe('Semua tingkatan')
    expect(w.get('[data-testid="set-search"]').attributes('placeholder')).toBe('Cari teks soalan...')
    expect(w.get('[data-testid="set-apply"]').text()).toBe('Tapis')
    expect(w.get('[data-testid="set-cancel"]').text()).toBe('Batal')
    expect(w.get('[data-testid="set-save-draft"]').text()).toBe('Simpan Draf')
    expect(w.get('[data-testid="set-publish"]').text()).toBe('Terbitkan')
    expect(w.findAll('[data-testid="set-class"]').map((c) => c.text())).toEqual([
      '5 Bestari',
      '5 Cekap',
    ])
  })

  it('lists bank rows with the preview and "{subjek} · {tahap} · ⭐{kesukaran}"; checkboxes are 44 px', async () => {
    api.fetchGuruSetBank.mockResolvedValue(bank([unit('q1', { difficulty: 5 })]))
    const w = await mountAt('/guru/set-soalan/cipta')
    expect(api.fetchGuruSetBank).toHaveBeenCalledWith({}, expect.anything())
    expect(w.get('[data-testid="set-bank-preview"]').text()).toContain('Soalan q1')
    expect(w.get('[data-testid="set-bank-meta"]').text()).toBe('Sains · Tingkatan 4 · ⭐5')
    // The checkbox root carries the 44 px box (its hit area grows with the label-less control).
    expect(w.find('[data-testid="set-bank-row"] .min-h-11.min-w-11').exists()).toBe(true)
  })

  it('cuts a long preview at 120 characters plus "..."', async () => {
    api.fetchGuruSetBank.mockResolvedValue(bank([unit('q1', { preview: 'a'.repeat(300) })]))
    const w = await mountAt('/guru/set-soalan/cipta')
    expect(w.get('[data-testid="set-bank-preview"]').text()).toBe(`${'a'.repeat(120)}...`)
  })

  it('shows "Tiada soalan sepadan. Laraskan penapis di atas." for an empty page', async () => {
    api.fetchGuruSetBank.mockResolvedValue(bank([]))
    const w = await mountAt('/guru/set-soalan/cipta')
    expect(w.get('[data-testid="set-bank-empty"]').text()).toContain(
      'Tiada soalan sepadan. Laraskan penapis di atas.',
    )
  })

  it('"Tapis" reloads at page 1 with the chosen filters; a 1-character search is refused locally', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    await w.get('[data-testid="set-filter-subject"]').setValue('4')
    await w.get('[data-testid="set-filter-level"]').setValue('12')
    await w.get('[data-testid="set-search"]').setValue('a')
    api.fetchGuruSetBank.mockClear()
    await w.get('[data-testid="set-apply"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Taip sekurang-kurangnya 2 aksara.')
    expect(api.fetchGuruSetBank).not.toHaveBeenCalled()

    await w.get('[data-testid="set-search"]').setValue('sel')
    await w.get('[data-testid="set-apply"]').trigger('click')
    await flushPromises()
    expect(api.fetchGuruSetBank).toHaveBeenCalledWith(
      { subjectId: '4', levelId: '12', q: 'sel' },
      expect.anything(),
    )
  })

  it('the filters follow the set Subjek and Tingkatan once chosen', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    api.fetchGuruSetBank.mockClear()
    await w.get('[data-testid="set-subject"]').setValue('4')
    await flushPromises()
    expect((w.get('[data-testid="set-filter-subject"]').element as HTMLSelectElement).value).toBe('4')
    expect(api.fetchGuruSetBank).toHaveBeenCalledWith({ subjectId: '4' }, expect.anything())
  })
})

describe('R1-GUR-8b form: the picker', () => {
  it('counts "{n} dipilih" as questions are ticked and unticked', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    await check(w, 0)
    await check(w, 2)
    expect(w.get('[data-testid="set-counter"]').text()).toBe('2 dipilih')
    await check(w, 0)
    expect(w.get('[data-testid="set-counter"]').text()).toBe('1 dipilih')
  })

  it('AC-GUR-8b-9: a stimulus group is ONE row whose checkbox ticks and unticks all its questions', async () => {
    api.fetchGuruSetBank.mockResolvedValue(
      bank([
        unit('g1', {
          kind: 'group',
          questionIds: ['a', 'b', 'c'],
          preview: 'Rajah menunjukkan sel',
          stimulus: {
            id: 's1',
            kind: 'image',
            label: 'Rajah 1',
            caption: null,
            body: null,
            alt: 'Sel',
            sourceCitation: null,
            tableData: null,
            imageId: 'abcdefghijklmnopqrstuv',
          },
        }),
        unit('q9'),
      ]),
    )
    api.createGuruSet.mockResolvedValue(storedSet())
    const w = await mountAt('/guru/set-soalan/cipta')
    expect(w.findAll('[data-testid="set-bank-row"]')).toHaveLength(2)
    expect(w.get('[data-testid="set-bank-group"]').text()).toContain('3 soalan')
    expect(w.get('[data-testid="set-bank-row"] img').attributes('src')).toBe(
      '/api/files/abcdefghijklmnopqrstuv',
    )
    await check(w, 0)
    expect(w.get('[data-testid="set-counter"]').text()).toBe('3 dipilih')
    await fillInfo(w)
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(api.createGuruSet).toHaveBeenCalledWith(
      expect.objectContaining({ questionIds: ['a', 'b', 'c'] }),
    )
    await check(w, 0)
    expect(w.get('[data-testid="set-counter"]').text()).toBe('0 dipilih')
  })

  it('loads 50 more by cursor when the sentinel scrolls into view (IntersectionObserver)', async () => {
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => undefined
    const observed: unknown[] = []
    class FakeObserver {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        notify = cb
      }
      observe(el: unknown): void {
        observed.push(el)
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    api.fetchGuruSetBank
      .mockResolvedValueOnce(bank([unit('q1')], 'cur-2'))
      .mockResolvedValueOnce(bank([unit('q2')], null))
    const w = await mountAt('/guru/set-soalan/cipta')
    expect(w.findAll('[data-testid="set-bank-row"]')).toHaveLength(1)
    expect(observed.length).toBeGreaterThan(0)
    notify([{ isIntersecting: true }])
    await flushPromises()
    expect(api.fetchGuruSetBank).toHaveBeenLastCalledWith({ cursor: 'cur-2' }, expect.anything())
    expect(w.findAll('[data-testid="set-bank-row"]')).toHaveLength(2)
    expect(w.find('[data-testid="set-bank-more"]').exists()).toBe(false)
  })

  it('without IntersectionObserver a "Muat Lagi" button loads the next batch', async () => {
    api.fetchGuruSetBank
      .mockResolvedValueOnce(bank([unit('q1')], 'cur-2'))
      .mockResolvedValueOnce(bank([unit('q2')], null))
    const w = await mountAt('/guru/set-soalan/cipta')
    await w.get('[data-testid="set-bank-load-more"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="set-bank-row"]')).toHaveLength(2)
  })
})

describe('R1-GUR-8b form: save and publish', () => {
  it('AC-GUR-8b-1: "Simpan Draf" saves the title, subject, questions and no class; toast "Draf disimpan."', async () => {
    api.createGuruSet.mockResolvedValue(storedSet({ status: 'draft' }))
    const w = await mountAt('/guru/set-soalan/cipta')
    await fillInfo(w)
    await check(w, 0)
    await check(w, 1)
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(api.createGuruSet).toHaveBeenCalledWith({
      title: 'Ujian 1',
      subjectId: '4',
      educationLevelId: null,
      questionIds: ['q1', 'q2'],
      classroomIds: [],
      status: 'draft',
    })
    expect(router.currentRoute.value.path).toBe('/guru/set-soalan')
    expect(useFlashStore().pending?.message).toBe('Draf disimpan.')
  })

  it('"Terbitkan" sends the ticked classes and the status; toast "Set diterbitkan."', async () => {
    api.createGuruSet.mockResolvedValue(storedSet())
    const w = await mountAt('/guru/set-soalan/cipta')
    await fillInfo(w)
    await w.get('[data-testid="set-level"]').setValue('11')
    await check(w, 0)
    await w.get('[data-testid="set-class-1"]').trigger('click')
    await w.get('[data-testid="set-class-2"]').trigger('click')
    await w.get('[data-testid="set-publish"]').trigger('click')
    await flushPromises()
    expect(api.createGuruSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        educationLevelId: '11',
        classroomIds: ['1', '2'],
      }),
    )
    expect(useFlashStore().pending?.message).toBe('Set diterbitkan.')
  })

  it('AC-GUR-8b-8: "Terbitkan" with no class shows the BM message and saves nothing', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    await fillInfo(w)
    await check(w, 0)
    await w.get('[data-testid="set-publish"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Pilih sekurang-kurangnya satu kelas sebelum menerbitkan.')
    expect(api.createGuruSet).not.toHaveBeenCalled()
  })

  it('shows the BM messages for an empty title, no subject and no question', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Sila isi tajuk set.')
    expect(text).toContain('Sila pilih subjek.')
    expect(text).toContain('Pilih sekurang-kurangnya satu soalan.')
    expect(api.createGuruSet).not.toHaveBeenCalled()
  })

  it('a title over 150 characters shows "Tajuk set tidak boleh melebihi 150 aksara."', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    await fillInfo(w)
    await w.get('[data-testid="set-title"]').setValue('T'.repeat(151))
    await check(w, 0)
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Tajuk set tidak boleh melebihi 150 aksara.')
    expect(api.createGuruSet).not.toHaveBeenCalled()
  })

  it('AC-GUR-8b-11: 101 chosen questions show "Satu set boleh mengandungi paling banyak 100 soalan." and save nothing', async () => {
    const many = Array.from({ length: 101 }, (_, i) => unit(`q${String(i)}`))
    api.fetchGuruSetBank.mockResolvedValue(bank(many))
    const w = await mountAt('/guru/set-soalan/cipta')
    await fillInfo(w)
    for (const box of w.findAll('[data-testid="set-bank-check"]')) await box.trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="set-counter"]').text()).toBe('101 dipilih')
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Satu set boleh mengandungi paling banyak 100 soalan.')
    expect(api.createGuruSet).not.toHaveBeenCalled()
  })

  it('shows a server 422 per field and the group-split message under the picker', async () => {
    api.createGuruSet.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { questionIds: 'Soalan dalam kumpulan rangsangan mesti dipilih bersama.' },
      }),
    )
    const w = await mountAt('/guru/set-soalan/cipta')
    await fillInfo(w)
    await check(w, 0)
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="set-bank-error"]').text()).toBe(
      'Soalan dalam kumpulan rangsangan mesti dipilih bersama.',
    )
    expect(router.currentRoute.value.path).toBe('/guru/set-soalan/cipta')
  })

  it('"Batal" goes back to the list without saving', async () => {
    const w = await mountAt('/guru/set-soalan/cipta')
    expect(w.get('[data-testid="set-cancel"]').attributes('href')).toBe('/guru/set-soalan')
    expect(api.createGuruSet).not.toHaveBeenCalled()
  })
})

describe('R1-GUR-8b form: edit and the lock', () => {
  it('loads the set into the form, ticks the saved classes and saves with PUT', async () => {
    api.fetchGuruSet.mockResolvedValue(storedSet())
    api.updateGuruSet.mockResolvedValue(storedSet())
    const w = await mountAt('/guru/set-soalan/5')
    expect(api.fetchGuruSet).toHaveBeenCalledWith('5', expect.anything())
    expect((w.get('[data-testid="set-title"]').element as HTMLInputElement).value).toBe('Ujian 1')
    expect((w.get('[data-testid="set-subject"]').element as HTMLSelectElement).value).toBe('4')
    expect((w.get('[data-testid="set-level"]').element as HTMLSelectElement).value).toBe('11')
    expect(w.get('[data-testid="set-counter"]').text()).toBe('2 dipilih')
    // The bank opens with the set's Subjek and Tingkatan.
    expect(api.fetchGuruSetBank).toHaveBeenCalledWith(
      { subjectId: '4', levelId: '11' },
      expect.anything(),
    )
    await w.get('[data-testid="set-title"]').setValue('Ujian 2')
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(api.updateGuruSet).toHaveBeenCalledWith('5', {
      title: 'Ujian 2',
      subjectId: '4',
      educationLevelId: '11',
      questionIds: ['q1', 'q2'],
      classroomIds: ['1'],
      status: 'draft',
    })
    expect(api.createGuruSet).not.toHaveBeenCalled()
  })

  it('AC-GUR-8b-12: a locked set disables the picker and shows the message; the title still saves', async () => {
    api.fetchGuruSet.mockResolvedValue(storedSet({ locked: true }))
    api.updateGuruSet.mockResolvedValue(storedSet({ locked: true }))
    const w = await mountAt('/guru/set-soalan/5')
    expect(w.get('[data-testid="set-locked"]').text()).toContain(
      'Soalan tidak boleh diubah kerana pelajar telah menjawab set ini.',
    )
    for (const box of w.findAll('[data-testid="set-bank-check"]'))
      expect(box.attributes('disabled') ?? box.attributes('data-disabled')).toBeDefined()
    await w.get('[data-testid="set-title"]').setValue('Ujian 1 (baharu)')
    await w.get('[data-testid="set-publish"]').trigger('click')
    await flushPromises()
    // The stored question list is sent unchanged.
    expect(api.updateGuruSet).toHaveBeenCalledWith(
      '5',
      expect.objectContaining({ title: 'Ujian 1 (baharu)', questionIds: ['q1', 'q2'], status: 'published' }),
    )
  })

  it('AC-GUR-8b-12: a 409 on save locks the picker and shows the message', async () => {
    api.fetchGuruSet.mockResolvedValue(storedSet())
    api.updateGuruSet.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Soalan tidak boleh diubah kerana pelajar telah menjawab set ini.',
      }),
    )
    const w = await mountAt('/guru/set-soalan/5')
    await w.get('[data-testid="set-save-draft"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="set-failure"]').text()).toContain(
      'Soalan tidak boleh diubah kerana pelajar telah menjawab set ini.',
    )
    expect(w.find('[data-testid="set-locked"]').exists()).toBe(true)
  })

  it('shows an error box with a retry when the set cannot be loaded', async () => {
    api.fetchGuruSet.mockRejectedValueOnce(new Error('boom'))
    const w = await mountAt('/guru/set-soalan/5')
    expect(w.get('[data-testid="set-load-error"]').text()).toContain('Gagal memuatkan set soalan.')
  })
})
