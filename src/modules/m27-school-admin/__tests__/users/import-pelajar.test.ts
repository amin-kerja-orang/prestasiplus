// @vitest-environment jsdom
/**
 * R1-AS-51 Import Pelajar page (S6-T09, API-AS-06) against a mocked client: file pick, the 10-row preview, the result sentence,
 * the error copies, the level select, "Tukar" and "Muat Turun Ralat". All names and e-mails are fictitious.
 */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { DsFileField } from '@/ds'

import type { PupilImportResult } from '../../api/school-admin'
import ImportPelajarPage from '../../pages/ImportPelajarPage.vue'
import { mountAt } from './helpers'

const api = vi.hoisted(() => ({ importSchoolPupils: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  ...api,
}))
const saved = vi.hoisted(() => ({ saveBlob: vi.fn() }))
vi.mock('@/lib/save-blob', () => saved)

const refusal = (status: number, code: string, message: string) => new ApiError({ status, code, message })

const csvOf = (n: number): string =>
  ['nama,email,kelas', ...Array.from({ length: n }, (_v, i) => `Murid ${String(i + 1)},murid${String(i + 1)}@demo.test,`)].join('\n')
const fileOf = (text: string, name = 'pelajar.csv'): File => new File([text], name, { type: 'text/csv' })

const previewOf = (rows: number, over: Partial<PupilImportResult> = {}): PupilImportResult => ({
  dryRun: true,
  rows,
  created: 0,
  skipped: 0,
  errors: [],
  preview: Array.from({ length: Math.min(10, rows) }, (_v, i) => ({ row: i + 2, name: `Murid ${String(i + 1)}`, email: `murid${String(i + 1)}@demo.test`, className: null })),
  ...over,
})

async function mountPage() {
  const mounted = await mountAt(ImportPelajarPage, '/admin-sekolah/pelajar/import')
  const pick = async (file: File): Promise<void> => {
    mounted.wrapper.findComponent(DsFileField).vm.$emit('update:modelValue', file)
    await flushPromises()
  }
  return { ...mounted, pick }
}

beforeEach(() => {
  api.importSchoolPupils.mockReset()
  saved.saveBlob.mockReset()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Import Pelajar page', () => {
  it('shows the V2 form copy and no school picker, password or DELIMa field', async () => {
    const { wrapper: w } = await mountPage()
    const t = w.text()
    expect(t).toContain('Borang Import Pelajar')
    expect(t).toContain('Muat Turun CSV Pelajar')
    expect(t).toContain('Tutorial')
    expect(t).toContain('Tingkatan')
    expect(t).toContain('Digunakan jika baris tidak menyatakan kelas.')
    expect(t).toContain('Senarai Pelajar')
    expect(t).toContain('Klik untuk pilih fail atau seret & lepas di sini')
    expect(t).toContain('.csv atau .txt · maksimum 2 MB · lajur: nama, email, kelas')
    expect(t).toContain('Import mencipta akaun pelajar baharu sahaja')
    expect(t).not.toMatch(/kata laluan|DELIMa|Sekolah\b.*pilih|Paste/i)
    expect(w.get('[data-testid="pi-tutorial"]').attributes('href')).toBe('/panduan?peranan=admin-sekolah')
    const options = w.findAll('[data-testid="pi-level"] option').map((o) => o.text())
    expect(options).toEqual(['— Pilihan —', 'Tingkatan 1', 'Tingkatan 2', 'Tingkatan 3', 'Tingkatan 4', 'Tingkatan 5'])
    expect(w.get('[data-testid="pi-footer"]').text()).toContain('Import Pelajar')
  })

  it('previews the first 10 rows of a chosen file with the "Ini contoh sahaja" note and "Tukar"', async () => {
    api.importSchoolPupils.mockResolvedValue(previewOf(12))
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf(csvOf(12)))
    expect(api.importSchoolPupils).toHaveBeenCalledTimes(1)
    expect(api.importSchoolPupils.mock.calls[0]?.[0]).toMatchObject({ level: '', dryRun: true })
    expect(w.get('[data-testid="pi-preview-title"]').text()).toBe('Pratonton · semua 12 baris')
    const shown = w.get('[data-testid="pi-preview"]').text()
    expect(shown).toContain('Murid 10')
    expect(shown).not.toContain('Murid 11')
    expect(w.get('[data-testid="pi-preview-note"]').text()).toBe('Ini contoh sahaja. 2 baris lagi tidak dipaparkan — kesemua 12 pelajar akan diimport.')
    await w.get('[data-testid="pi-change"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="pi-preview"]').exists()).toBe(false)
    expect(w.find('[data-testid="pi-file"]').exists()).toBe(true)
  })

  it('re-previews with the Tingkatan and sends it with the import', async () => {
    api.importSchoolPupils.mockResolvedValueOnce(previewOf(2)).mockResolvedValueOnce(previewOf(2)).mockResolvedValueOnce({ dryRun: false, rows: 2, created: 2, skipped: 0, errors: [] })
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf(csvOf(2)))
    await w.get('[data-testid="pi-level"]').setValue('T4')
    await flushPromises()
    expect(api.importSchoolPupils.mock.calls[1]?.[0]).toMatchObject({ level: 'T4', dryRun: true })
    expect(w.find('[data-testid="pi-preview-note"]').exists()).toBe(false)
    await w.get('[data-testid="pi-form"]').trigger('submit')
    await flushPromises()
    expect(api.importSchoolPupils.mock.calls[2]?.[0]).toMatchObject({ level: 'T4', dryRun: false })
  })

  it('shows the result sentence, the pending note, the failed rows with their names and the error download', async () => {
    api.importSchoolPupils.mockResolvedValueOnce(previewOf(3)).mockResolvedValueOnce({
      dryRun: false,
      rows: 3,
      created: 2,
      skipped: 0,
      errors: [{ row: 3, message: 'Format e-mel tidak sah.' }],
    })
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf('nama,email,kelas\nMurid Satu,satu@demo.test,\nMurid Rosak,tak-sah,\nMurid Tiga,tiga@demo.test,\n'))
    await w.get('[data-testid="pi-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="pi-result-text"]').text()).toBe('2 pelajar berjaya diimport, 1 baris gagal.')
    expect(w.get('[data-testid="pi-result-pending"]').text()).toBe('Pelajar yang diimport menunggu kelulusan Admin Pusat.')
    const failedText = w.get('[data-testid="pi-result-table"]').text()
    expect(failedText).toContain('Murid Rosak')
    expect(failedText).toContain('Format e-mel tidak sah.')
    expect(failedText).not.toContain('Murid Satu')
    expect(w.text()).not.toMatch(/kata laluan/i)
    await w.get('[data-testid="pi-download-errors"]').trigger('click')
    expect(saved.saveBlob).toHaveBeenCalledTimes(1)
    const [blob] = saved.saveBlob.mock.calls[0] as [Blob, string]
    expect(saved.saveBlob.mock.calls[0]?.[1]).toMatch(/^ralat-import-pelajar-\d{8}\.csv$/)
    // Blob.text() drops a leading byte-order mark, so it is checked on the bytes.
    expect(await blob.text()).toBe('Baris,Sebab,nama,email,kelas\n3,Format e-mel tidak sah.,Murid Rosak,tak-sah,\n')
    expect(new Uint8Array(await blob.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
    expect(w.find('[data-testid="pi-preview"]').exists()).toBe(false)
  })

  it('counts a skipped duplicate e-mail as a failed row in the sentence', async () => {
    api.importSchoolPupils.mockResolvedValueOnce(previewOf(2)).mockResolvedValueOnce({
      dryRun: false,
      rows: 2,
      created: 1,
      skipped: 1,
      errors: [{ row: 2, message: 'E-mel sudah wujud (dilangkau).' }],
    })
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf(csvOf(2)))
    await w.get('[data-testid="pi-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="pi-result-text"]').text()).toBe('1 pelajar berjaya diimport, 1 baris gagal.')
    expect(w.get('[data-testid="pi-result-table"]').text()).toContain('E-mel sudah wujud (dilangkau).')
  })

  it.each([
    [409, 'QUOTA_FULL', 'Kuota penuh! Sila tingkatkan kuota dahulu.'],
    [409, 'NO_SUBSCRIPTION', 'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.'],
    [413, 'PAYLOAD_TOO_LARGE', 'Fail atau data terlalu besar. Saiz maksimum ialah 2 MB.'],
  ])('shows the server refusal %i %s above the form and keeps the file', async (status, code, message) => {
    api.importSchoolPupils.mockRejectedValue(refusal(status, code, message))
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf(csvOf(2)))
    expect(w.get('[data-testid="pi-alert"]').text()).toBe(message)
    expect(w.find('[data-testid="pi-chosen"]').exists()).toBe(true)
    api.importSchoolPupils.mockClear()
    await w.get('[data-testid="pi-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="pi-alert"]').text()).toBe(message)
    expect(w.find('[data-testid="pi-result"]').exists()).toBe(false)
  })

  it('refuses a wrong file type without calling the API', async () => {
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf('x', 'pelajar.xlsx'))
    expect(w.get('[data-testid="pi-alert"]').text()).toBe('Jenis fail tidak disokong. Format dibenarkan: CSV, TXT.')
    expect(api.importSchoolPupils).not.toHaveBeenCalled()
  })

  it('refuses 1001 data rows with "Fail melebihi 1000 baris." and does not call the API', async () => {
    const { wrapper: w, pick } = await mountPage()
    await pick(fileOf(csvOf(1001)))
    expect(w.get('[data-testid="pi-alert"]').text()).toBe('Fail melebihi 1000 baris.')
    expect(api.importSchoolPupils).not.toHaveBeenCalled()
    await w.get('[data-testid="pi-form"]').trigger('submit')
    await flushPromises()
    expect(api.importSchoolPupils).not.toHaveBeenCalled()
    expect(w.get('[data-testid="pi-alert"]').text()).toBe('Fail melebihi 1000 baris.')
  })

  it('asks for a file when none is chosen', async () => {
    const { wrapper: w } = await mountPage()
    await w.get('[data-testid="pi-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="pi-alert"]').text()).toBe('Sila pilih fail.')
    expect(api.importSchoolPupils).not.toHaveBeenCalled()
  })

  it('downloads the template with the header and the fictitious row', async () => {
    const { wrapper: w } = await mountPage()
    await w.get('[data-testid="pi-template"]').trigger('click')
    const [blob, name] = saved.saveBlob.mock.calls[0] as [Blob, string]
    expect(name).toBe('templat-pelajar.csv')
    expect(await blob.text()).toBe('nama,email,kelas\nMurid Contoh,murid.contoh@example.org,5 Bestari\n')
  })
})
