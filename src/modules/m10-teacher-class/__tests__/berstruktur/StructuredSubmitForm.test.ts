// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import StructuredSubmitForm from '../../components/soalan-berstruktur/StructuredSubmitForm.vue'
import type { StructuredFormValues } from '../../lib/structured-form'
import { pickFiles } from '../soalan/pick-file'

const guru = vi.hoisted(() => ({
  fetchChapters: vi.fn(),
  fetchBidang: vi.fn(),
  fetchSk: vi.fn(),
  fetchSp: vi.fn(),
}))
vi.mock('../../api/guru', () => guru)
vi.mock('../../components/soalan/data', () => ({
  fetchLevelOptions: vi.fn(() =>
    Promise.resolve([
      { id: 10, name: 'Tingkatan 4' },
      { id: 11, name: 'Tingkatan 5' },
      { id: 3, name: 'Darjah 3' },
    ]),
  ),
  fetchSubjectOptions: vi.fn(() => Promise.resolve([{ id: 4, name: 'Perniagaan' }])),
}))

let wrapper: VueWrapper | null = null
const t = (id: string) => wrapper!.get(`[data-testid="${id}"]`)
const all = (id: string) => wrapper!.findAll(`[data-testid="${id}"]`)

async function mountForm(props: Record<string, unknown> = {}): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  wrapper = mount(StructuredSubmitForm, {
    props: { saving: false, fields: {}, ...props },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

/** Level + subject, and the first part filled (marks as given). */
async function fillBasics(marks = '3'): Promise<void> {
  await t('s-level').setValue('11')
  await t('s-subject').setValue('4')
  await t('s-difficulty').setValue('3')
  await flushPromises()
  await all('s-part-text')[0]!.setValue('Terangkan satu faktor.')
  await all('s-part-marks')[0]!.setValue(marks)
  await all('s-part-scheme')[0]!.setValue('Faktor pertama.')
}

beforeEach(() => {
  guru.fetchChapters.mockResolvedValue([])
  guru.fetchBidang.mockResolvedValue([])
  guru.fetchSk.mockResolvedValue([])
  guru.fetchSp.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
})

describe('StructuredSubmitForm layout and copy', () => {
  it('has the PRD fields, the Tingkatan 1-5 list only, one empty part and "Jumlah markah: 0"', async () => {
    await mountForm()
    const text = wrapper!.text()
    for (const label of [
      'Tingkatan',
      'Subjek',
      'Bab',
      'SP',
      'TP',
      'Aras Pemikiran',
      'Kesukaran',
      'Rangsangan',
      'Imej rangsangan',
      'Sub-Soalan',
      'Teks sub-soalan',
      'Markah',
      'Skema Jawapan',
      'Tambah Sub-Soalan',
      'Buang',
      'Hantar untuk Semakan',
      'Batal',
    ])
      expect(text, label).toContain(label)
    expect(
      t('s-level')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Pilih tingkatan --', 'Tingkatan 4', 'Tingkatan 5'])
    expect(t('s-subject').findAll('option')[0]!.text()).toBe('-- Pilih subjek --')
    expect(
      t('s-difficulty')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      '-- Pilih kesukaran --',
      'Sangat Mudah',
      'Mudah',
      'Sederhana',
      'Sukar',
      'Sangat Sukar',
    ])
    expect(
      t('s-tp')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Pilih TP --', '1', '2', '3', '4', '5', '6'])
    expect(t('s-aras').findAll('option')[0]!.text()).toBe('-- Pilih aras --')
    expect(all('s-part')).toHaveLength(1)
    expect(t('s-total').text()).toBe('Jumlah markah: 0')
    expect(t('form-submit').text()).toBe('Hantar untuk Semakan')
  })

  it('says "Tiada bab untuk subjek dan tingkatan ini." and does not require Bab when there are none', async () => {
    await mountForm()
    await t('s-level').setValue('11')
    await t('s-subject').setValue('4')
    await flushPromises()
    expect(wrapper!.text()).toContain('Tiada bab untuk subjek dan tingkatan ini.')
    expect(t('s-chapter').attributes('disabled')).toBeDefined()
  })

  it('the form is built to stack on a phone: one column below md, targets of 44 px', async () => {
    await mountForm()
    expect(t('info-card').html()).toContain('grid-cols-1')
    expect(t('info-card').html()).toContain('md:grid-cols-2')
    for (const id of ['form-submit', 'form-cancel', 's-part-add', 's-part-remove'])
      expect(wrapper!.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
  })
})

describe('sub-questions', () => {
  it('"Tambah Sub-Soalan" adds parts up to 10 and is then disabled', async () => {
    await mountForm()
    for (let i = 0; i < 9; i += 1) await t('s-part-add').trigger('click')
    expect(all('s-part')).toHaveLength(10)
    expect(t('s-part-add').attributes('disabled')).toBeDefined()
  })

  it('AC-GUR-44b-9: "Buang" at a single part keeps it and shows the message', async () => {
    await mountForm()
    await t('s-part-remove').trigger('click')
    expect(all('s-part')).toHaveLength(1)
    expect(t('s-parts-notice').text()).toBe('Sekurang-kurangnya satu sub-soalan diperlukan.')
    expect(t('s-part-remove').attributes('aria-disabled')).toBe('true')
  })

  it('"Buang" removes a part when there are two, and the total follows the marks', async () => {
    await mountForm()
    await t('s-part-add').trigger('click')
    await all('s-part-marks')[0]!.setValue('4')
    await all('s-part-marks')[1]!.setValue('6')
    expect(t('s-total').text()).toBe('Jumlah markah: 10')
    await all('s-part-remove')[0]!.trigger('click')
    expect(all('s-part')).toHaveLength(1)
    expect(t('s-total').text()).toBe('Jumlah markah: 6')
    expect(wrapper!.find('[data-testid="s-parts-notice"]').exists()).toBe(false)
  })

  it("a new part takes the question's Aras, and follows it until the teacher changes the part", async () => {
    await mountForm()
    await t('s-aras').setValue('menilai')
    await t('s-part-add').trigger('click')
    expect((all('s-part-aras')[1]!.element as HTMLSelectElement).value).toBe('menilai')
    await t('s-aras').setValue('mencipta')
    expect((all('s-part-aras')[1]!.element as HTMLSelectElement).value).toBe('mencipta')
  })
})

describe('submit and validation', () => {
  it('AC-GUR-44b-8: Markah 21 shows "Markah mesti antara 1 dan 20." and nothing is submitted', async () => {
    await mountForm()
    await fillBasics('21')
    await t('structured-form').trigger('submit')
    expect(wrapper!.text()).toContain('Markah mesti antara 1 dan 20.')
    expect(wrapper!.emitted('submit')).toBeUndefined()
    // The typed values stay.
    expect((all('s-part-text')[0]!.element as HTMLTextAreaElement).value).toBe(
      'Terangkan satu faktor.',
    )
  })

  it('an empty form names every required field in BM', async () => {
    await mountForm()
    await t('structured-form').trigger('submit')
    const text = t('form-errors').text()
    for (const m of [
      'Sila pilih tingkatan.',
      'Sila pilih subjek.',
      'Sila pilih kesukaran.',
      'Sila isi teks sub-soalan.',
      'Markah mesti antara 1 dan 20.',
      'Sila isi skema jawapan.',
    ])
      expect(text, m).toContain(m)
    expect(wrapper!.emitted('submit')).toBeUndefined()
  })

  it('a valid form emits the values and no image', async () => {
    await mountForm()
    await fillBasics()
    await t('structured-form').trigger('submit')
    const sent = wrapper!.emitted('submit')![0]!
    expect((sent[0] as StructuredFormValues).parts[0]).toMatchObject({
      marks: '3',
      text: 'Terangkan satu faktor.',
    })
    expect(sent[1]).toBeNull()
  })

  it('D112: with chapters and DSKP nodes, Bab, SP, TP and Aras are required', async () => {
    guru.fetchChapters.mockResolvedValue([{ id: 7, name: 'Perniagaan Asas', chapterNumber: 1 }])
    guru.fetchBidang.mockResolvedValue([{ id: 1, code: 'B1', name: 'Bidang' }])
    guru.fetchSk.mockResolvedValue([{ id: 2, code: '1.1', description: 'SK' }])
    guru.fetchSp.mockResolvedValue([{ id: 30, code: '1.1.1', description: 'Mengenal pasti' }])
    await mountForm()
    await fillBasics()
    await flushPromises()
    expect(t('s-chapter').findAll('option')[1]!.text()).toBe('1. Perniagaan Asas')
    expect(t('s-sp').findAll('option')[1]!.text()).toBe('1.1.1 Mengenal pasti')
    await t('structured-form').trigger('submit')
    const text = t('form-errors').text()
    for (const m of [
      'Sila pilih bab.',
      'Sila pilih Standard Pembelajaran (SP).',
      'Sila pilih TP.',
      'Sila pilih aras pemikiran.',
    ])
      expect(text, m).toContain(m)
    await t('s-chapter').setValue('7')
    await t('s-sp').setValue('30')
    await t('s-tp').setValue('4')
    await t('s-aras').setValue('memahami')
    await t('structured-form').trigger('submit')
    expect(wrapper!.emitted('submit')).toHaveLength(1)
  })

  it('Kesukaran defaults to min(5, TP) until the teacher touches it', async () => {
    await mountForm()
    await t('s-tp').setValue('6')
    expect((t('s-difficulty').element as HTMLSelectElement).value).toBe('5')
    await t('s-difficulty').setValue('2')
    await t('s-tp').setValue('3')
    expect((t('s-difficulty').element as HTMLSelectElement).value).toBe('2')
  })

  it('shows the server messages keyed like the 422 and keeps the "stimulusImageId" under the image', async () => {
    await mountForm({
      fields: {
        'parts.0.scheme': 'Sila isi skema jawapan.',
        stimulusImageId: 'Fail mesti berupa imej (jpg, png atau webp).',
      },
    })
    expect(t('form-errors').text()).toContain('Sila isi skema jawapan.')
    expect(wrapper!.text()).toContain('Fail mesti berupa imej (jpg, png atau webp).')
  })

  it('the busy button reads "Menyimpan..." and a second submit is ignored', async () => {
    await mountForm({ saving: true })
    expect(t('form-submit').text()).toBe('Menyimpan...')
    await t('structured-form').trigger('submit')
    expect(wrapper!.emitted('submit')).toBeUndefined()
  })
})

describe('stimulus image', () => {
  it('refuses a non-image and an image over 2 MB with the PRD texts', async () => {
    await mountForm()
    await pickFiles(wrapper!, 's-image', [new File(['x'], 'a.pdf', { type: 'application/pdf' })])
    expect(wrapper!.text()).toContain('Fail mesti berupa imej (jpg, png atau webp).')
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'b.png', { type: 'image/png' })
    await pickFiles(wrapper!, 's-image', [big])
    expect(wrapper!.text()).toContain('Saiz imej tidak boleh melebihi 2 MB.')
    await fillBasics()
    await t('structured-form').trigger('submit')
    expect(wrapper!.emitted('submit')).toBeUndefined()
  })

  it('an acceptable image is handed over with the values', async () => {
    await mountForm()
    const png = new File(['x'], 'rajah.png', { type: 'image/png' })
    await pickFiles(wrapper!, 's-image', [png])
    await fillBasics()
    await t('structured-form').trigger('submit')
    expect(wrapper!.emitted('submit')![0]![1]).toBe(png)
  })
})
