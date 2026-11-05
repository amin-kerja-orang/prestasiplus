// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import { COPY } from '../../components/soalan/lib'
import SumbangSoalanPage from '../../pages/SumbangSoalanPage.vue'
import { listMeta, makeRouter, question, summary } from './fixtures'
import { pickFiles } from './pick-file'

const guru = vi.hoisted(() => ({
  fetchContributions: vi.fn(),
  fetchContributedQuestions: vi.fn(),
  deleteContributedQuestion: vi.fn(),
  importQuestions: vi.fn(),
  downloadQuestionTemplate: vi.fn(),
}))
vi.mock('../../api/guru', () => guru)
const sessionMock = vi.hoisted((): { role: string | null } => ({ role: 'teacher' }))
vi.mock('@/stores/session', () => ({ useSessionStore: () => sessionMock }))
const saveBlob = vi.hoisted(() => vi.fn())
vi.mock('@/lib/save-blob', () => ({ saveBlob }))

let router: Router

async function mountPage(path = '/guru/soalan'): Promise<VueWrapper> {
  await router.push(path)
  await router.isReady()
  const w = mount(SumbangSoalanPage, { global: { plugins: [router] } })
  await flushPromises()
  return w
}
const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const all = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  sessionMock.role = 'teacher'
  router = makeRouter()
  guru.fetchContributions.mockResolvedValue(summary())
  guru.fetchContributedQuestions.mockResolvedValue({
    data: [
      question(),
      question({
        id: 522426,
        questionText: 'Kedua?',
        status: 'pending',
        editable: true,
        dskpTagged: false,
      }),
    ],
    meta: listMeta(45),
  })
})
afterEach(() => vi.clearAllMocks())

describe('S21 Sumbang Soalan', () => {
  it('renders the stats, tiers, next target and the subject chips', async () => {
    const w = await mountPage()
    expect(t(w, 'stat-total').text()).toContain('120')
    expect(t(w, 'stat-pending').text()).toContain('⏳ Menunggu')
    expect(all(w, 'tier')).toHaveLength(3)
    expect(all(w, 'tier').map((x) => x.attributes('data-reached'))).toEqual([
      'true',
      'true',
      'false',
    ])
    expect(t(w, 'next-tier').text()).toBe('Sasaran seterusnya: Penyumbang Dedikasi — 500 soalan')
    expect(all(w, 'breakdown-chip').map((x) => x.text())).toEqual([
      'Matematik — 3,287',
      'Lain — 763',
    ])
  })

  it('hides the next target when every tier is reached', async () => {
    guru.fetchContributions.mockResolvedValue(summary({ nextTier: null }))
    const w = await mountPage()
    expect(t(w, 'next-tier').exists()).toBe(false)
  })

  it('shows the static AI card without any action and the Audio KBAT links', async () => {
    const w = await mountPage()
    const ai = t(w, 'ai-card')
    expect(ai.text()).toContain('AI Auto-Generate Soalan')
    expect(ai.find('a, button, form').exists()).toBe(false)
    expect(t(w, 'audio-template-xlsx').attributes('href')).toBe('/api/guru/audio-kbat/template')
    expect(t(w, 'audio-template-word').attributes('href')).toBe(
      '/api/guru/audio-kbat/template-word',
    )
  })

  it('does not link a teacher to the missing /guru/audio-kbat* screens (DV-M10-36)', async () => {
    sessionMock.role = 'teacher'
    const w = await mountPage()
    expect(t(w, 'audio-create').exists()).toBe(false)
    expect(t(w, 'audio-list').exists()).toBe(false)
    expect(w.html()).not.toContain('href="/guru/audio-kbat')
  })

  it('sends the admin to the M09 admin Audio KBAT screens', async () => {
    sessionMock.role = 'admin'
    const w = await mountPage()
    expect(t(w, 'audio-create').attributes('href')).toBe('/admin/audio-kbat/create')
    expect(t(w, 'audio-list').attributes('href')).toBe('/admin/audio-kbat')
  })

  it('lists the cards, toggles one open and links Edit', async () => {
    const w = await mountPage()
    const cards = all(w, 'question-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.find('[data-testid="chip-status"]').text()).toBe('Diluluskan')
    expect(cards[1]!.find('[data-testid="chip-status"]').text()).toBe('Menunggu Semakan')
    expect(cards[0]!.find('[data-testid="question-date"]').text()).toBe('02 May 2026')
    expect(cards[1]!.find('[data-testid="chip-dskp"]').exists()).toBe(false)
    expect(cards[0]!.find('[data-testid="question-body"]').exists()).toBe(false)
    await cards[0]!.find('[data-testid="question-toggle"]').trigger('click')
    const body = cards[0]!.find('[data-testid="question-body"]')
    expect(body.exists()).toBe(true)
    const options = body.findAll('[data-testid="question-option"]')
    expect(options.map((o) => o.attributes('data-correct'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ])
    expect(options[0]!.text()).toBe('A. Satu')
    expect(body.find('[data-testid="question-id"]').text()).toBe('522425')
    // Edit and Padam only while the item is pending (FR-GUR-44-10).
    expect(body.find('[data-testid="question-edit"]').exists()).toBe(false)
    expect(body.find('[data-testid="question-delete"]').exists()).toBe(false)
    await cards[1]!.find('[data-testid="question-toggle"]').trigger('click')
    expect(cards[1]!.find('[data-testid="question-edit"]').attributes('href')).toBe(
      '/guru/soalan/522426/edit',
    )
  })

  it('FR-GUR-44-10: Ditolak has its own tone and "Sebab: {reason}"; no Edit or Padam', async () => {
    guru.fetchContributedQuestions.mockResolvedValue({
      data: [
        question({ id: 7, status: 'rejected', rejectionReason: 'Gambar tidak jelas.' }),
        question({ id: 8, status: 'rejected', rejectionReason: 'Ulang.', editable: true }),
      ],
      meta: listMeta(2),
    })
    const w = await mountPage()
    // A rejected item can be editable: Edit follows the server's `editable`.
    const second = all(w, 'question-card')[1]!
    await second.find('[data-testid="question-toggle"]').trigger('click')
    expect(second.find('[data-testid="question-edit"]').exists()).toBe(true)
    const card = all(w, 'question-card')[0]!
    expect(card.find('[data-testid="chip-status"]').text()).toBe('Ditolak')
    expect(card.find('[data-testid="chip-status"]').attributes('data-status')).toBe('rejected')
    expect(card.find('[data-testid="question-reason"]').text()).toBe('Sebab: Gambar tidak jelas.')
    await card.find('[data-testid="question-toggle"]').trigger('click')
    expect(card.find('[data-testid="question-edit"]').exists()).toBe(false)
    expect(card.find('[data-testid="question-delete"]').exists()).toBe(false)
  })

  it('shows the difficulty as stars on the card', async () => {
    const w = await mountPage()
    expect(all(w, 'chip-difficulty')[0]!.text()).toBe('⭐⭐⭐⭐')
  })

  it('keeps the card when the delete confirm is cancelled and deletes when accepted', async () => {
    const w = await mountPage()
    await all(w, 'question-toggle')[1]!.trigger('click')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await t(w, 'question-delete').trigger('click')
    expect(confirm).toHaveBeenCalledWith(
      'Padam soalan #522426? Tindakan ini tidak boleh dibatalkan.',
    )
    expect(guru.deleteContributedQuestion).not.toHaveBeenCalled()

    confirm.mockReturnValueOnce(true)
    guru.deleteContributedQuestion.mockResolvedValue({ removed: 1 })
    await t(w, 'question-delete').trigger('click')
    await flushPromises()
    expect(guru.deleteContributedQuestion).toHaveBeenCalledWith(522426)
    expect(guru.fetchContributions).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current?.type).toBe('success')
    confirm.mockRestore()
  })

  it('shows a refused delete without reloading', async () => {
    const w = await mountPage()
    await all(w, 'question-toggle')[1]!.trigger('click')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    guru.deleteContributedQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' }),
    )
    await t(w, 'question-delete').trigger('click')
    await flushPromises()
    expect(t(w, 'soalan-delete-error').text()).toContain('Rekod tidak dijumpai.')
  })

  it('shows the save-failed text when a delete fails with a 500 or a lost connection (SWE-09)', async () => {
    for (const error of [
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not Found.' }),
    ]) {
      const w = await mountPage()
      await all(w, 'question-toggle')[1]!.trigger('click')
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      guru.deleteContributedQuestion.mockRejectedValueOnce(error)
      await t(w, 'question-delete').trigger('click')
      await flushPromises()
      expect(t(w, 'soalan-delete-error').text()).toContain(COPY.saveFailed)
      expect(t(w, 'soalan-delete-error').text()).not.toMatch(
        /Server Error|Failed to fetch|Not Found/,
      )
      w.unmount()
    }
  })

  it('requests the page from ?page= and renders the pager', async () => {
    const w = await mountPage('/guru/soalan?page=2')
    expect(guru.fetchContributedQuestions).toHaveBeenCalledWith(
      { page: 2 },
      expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
    )
    expect(t(w, 'soalan-pager-text').text()).toBe('Menunjukkan 21-22 daripada 45 hasil')
  })

  it('shows the retry box when the stats fail to load @provisional UNVERIFIED COPY', async () => {
    guru.fetchContributions.mockRejectedValue(new Error('x'))
    const w = await mountPage()
    expect(t(w, 'soalan-error').text()).toContain('Gagal memuatkan data')
    guru.fetchContributions.mockResolvedValue(summary())
    await w.get('[data-testid="soalan-error"] button').trigger('click')
    await flushPromises()
    expect(t(w, 'contribution-summary').exists()).toBe(true)
  })
})

describe('S21 empty lists', () => {
  it('44-F2: the empty state, its hint and "Tambah Soalan Pertama"; no pager', async () => {
    guru.fetchContributedQuestions.mockResolvedValue({ data: [], meta: listMeta(0) })
    const w = await mountPage()
    expect(t(w, 'soalan-empty-title').text()).toBe('Belum ada soalan dihantar')
    expect(t(w, 'soalan-empty-hint').text()).toBe('Klik "Tambah Soalan" untuk mula menyumbang!')
    expect(t(w, 'soalan-add-first').text()).toBe('Tambah Soalan Pertama')
    expect(t(w, 'soalan-add-first').attributes('href')).toBe('/guru/soalan/cipta')
    expect(all(w, 'question-card')).toHaveLength(0)
    expect(w.text()).not.toContain('Menunjukkan')
  })

  it('a page beyond the last shows no cards and no empty text, only the pager line', async () => {
    guru.fetchContributedQuestions.mockResolvedValue({ data: [], meta: listMeta(45, 9) })
    const w = await mountPage('/guru/soalan?page=9')
    expect(all(w, 'question-card')).toHaveLength(0)
    expect(t(w, 'soalan-empty').exists()).toBe(false)
    expect(t(w, 'soalan-pager-text').text()).toBe('Menunjukkan 0-0 daripada 45 hasil')
  })
})

describe('S21 import card', () => {
  it('downloads the template and toggles the form with the live attributes', async () => {
    guru.downloadQuestionTemplate.mockResolvedValue({
      blob: new Blob(['x']),
      filename: 'templat-soalan.csv',
    })
    const w = await mountPage()
    expect(t(w, 'import-form').exists()).toBe(false)
    await t(w, 'import-template').trigger('click')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'templat-soalan.csv')

    await t(w, 'import-toggle').trigger('click')
    const file = t(w, 'import-file')
    expect(file.attributes('accept')).toBe('.csv')
    expect(t(w, 'import-guide').text()).toContain(
      'Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport',
    )
    expect(t(w, 'import-guide').text()).toMatch(/bab, SP, TP, aras/)
  })

  it('the template falls back to templat-soalan.csv when the response has no file name', async () => {
    guru.downloadQuestionTemplate.mockResolvedValue({ blob: new Blob(['x']) })
    const w = await mountPage()
    await t(w, 'import-template').trigger('click')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'templat-soalan.csv')
  })

  it('AC-GUR-44-13: a 3-row file reports "2 soalan diimport, 1 baris gagal." with a Baris / Sebab table and the error file', async () => {
    guru.importQuestions.mockResolvedValue({
      imported: 2,
      errors: [{ row: 3, message: 'Jawapan mesti A, B, C atau D.' }],
    })
    const w = await mountPage()
    await t(w, 'import-toggle').trigger('click')
    const text = 'subjek,jawapan\nA,A\nB,Z\nC,B\n'
    const csv = new File([text], 'soalan.csv', { type: 'text/csv' })
    await pickFiles(w, 'import-file', [csv])
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(guru.importQuestions).toHaveBeenCalledWith(csv)
    expect(t(w, 'import-result-summary').text()).toBe('2 soalan diimport, 1 baris gagal.')
    expect(
      t(w, 'import-failures')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['Baris', 'Sebab'])
    expect(t(w, 'import-failure').text()).toBe('3Jawapan mesti A, B, C atau D.')
    expect(guru.fetchContributions).toHaveBeenCalledTimes(2)

    await t(w, 'import-errors-download').trigger('click')
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [blob, name] = saveBlob.mock.calls[0] as unknown as [Blob, string]
    expect(name).toMatch(/^ralat-import-\d{8}\.csv$/)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('AC-GUR-44-13: 501 data rows show "Fail melebihi 500 baris." and nothing is sent', async () => {
    const w = await mountPage()
    await t(w, 'import-toggle').trigger('click')
    const rows = Array.from({ length: 501 }, () => 'a,b').join('\n')
    await pickFiles(w, 'import-file', [new File([`h1,h2\n${rows}\n`], 'besar.csv')])
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Fail melebihi 500 baris.')
    expect(guru.importQuestions).not.toHaveBeenCalled()
  })

  it('44-F3: an .xlsx is refused with the CSV format text; none chosen asks for a file', async () => {
    const w = await mountPage()
    await t(w, 'import-toggle').trigger('click')
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Sila pilih fail.')
    await pickFiles(w, 'import-file', [new File(['x'], 'a.xlsx')])
    expect(w.text()).toContain('Jenis fail tidak disokong. Format dibenarkan: CSV.')
    expect(guru.importQuestions).not.toHaveBeenCalled()
  })

  it('shows the server message of a refused file', async () => {
    guru.importQuestions.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { csvFile: 'Sila pilih fail CSV.' },
      }),
    )
    const w = await mountPage()
    await t(w, 'import-toggle').trigger('click')
    await pickFiles(w, 'import-file', [new File(['a'], 'a.csv')])
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'import-errors').text()).toContain('Sila pilih fail CSV.')
  })
})

describe('S21 Hantar Kertas', () => {
  it('shows the live texts, options and limits', async () => {
    const w = await mountPage()
    const card = t(w, 'paper-card')
    expect(card.text()).toContain('Hantar Kertas Soalan kepada Admin')
    expect(card.text()).toContain('Maksimum 5 fail, saiz maksimum 20MB setiap fail')
    expect(t(w, 'paper-subject').attributes('maxlength')).toBe('100')
    expect(t(w, 'paper-oleh').attributes('maxlength')).toBe('150')
    expect(t(w, 'paper-catatan').attributes('maxlength')).toBe('1000')
    expect(t(w, 'paper-tahun').attributes('min')).toBe('2000')
    expect(t(w, 'paper-files').attributes('accept')).toBe('.pdf,.docx,.xlsx')
    expect(
      t(w, 'paper-jenis')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      '-- Pilih Jenis --',
      'Soalan Umum',
      'Trial Paper',
      'Soalan DSKP',
      'Buku Teks',
      'Buku Latihan',
      'Soalan Peperiksaan',
      'Lain-lain',
    ])
  })

  it('lists the chosen files with kind and size', async () => {
    const w = await mountPage()
    const pdf = new File([new Uint8Array(1024 * 1024)], 'kertas.pdf')
    const docx = new File(['x'], 'skema.docx')
    await pickFiles(w, 'paper-files', [pdf, docx], true)
    const rows = all(w, 'paper-file')
    expect(rows.map((r) => r.attributes('data-kind'))).toEqual(['pdf', 'word'])
    expect(rows[0]!.text()).toMatch(/kertas\.pdf\s*1\.00 MB/)
  })
})

const TOOLS = [
  '/guru/soalan-guru',
  '/guru/soalan-berstruktur',
  '/admin/soalan-gambar',
  '/guru/databank',
  '/guru/set-soalan',
  '/guru/kertas-peperiksaan',
]

describe('Alat Soalan (FR-GUR-44-8, AC-GUR-44-9, D-T06-1)', () => {
  it('shows six tiles in the V2 order with the titles and captions when every target is registered', async () => {
    router = makeRouter(TOOLS)
    const w = await mountPage()
    const tiles = all(w, 'alat-tile')
    expect(tiles.map((x) => x.find('.text-label').text())).toEqual([
      'Soalan & Rujukan',
      'Soalan Berstruktur',
      'Soalan Gambar Rajah',
      'Databank Soalan',
      'Set Soalan',
      'Kertas Peperiksaan',
    ])
    expect(tiles.map((x) => x.find('.text-caption').text())).toEqual([
      'Soalan peribadi + rujukan',
      'Soalan subjektif & esei',
      'Soalan perlu gambar rajah',
      'Layari bank soalan SPM',
      'Cipta set soalan kustom',
      'Muat naik & kongsi kertas',
    ])
    expect(tiles.map((x) => x.attributes('href'))).toEqual(TOOLS)
    expect(t(w, 'alat-soalan').text()).toContain('Alat Soalan')
  })

  it('places the block after the info paragraph and before the badges', async () => {
    router = makeRouter(TOOLS)
    const w = await mountPage()
    const html = w.html()
    expect(html.indexOf('contribution-info')).toBeLessThan(html.indexOf('alat-soalan'))
    expect(html.indexOf('alat-soalan')).toBeLessThan(html.indexOf('tiers-card'))
  })

  it('a tile shows only when its route exists: unregistered targets are hidden, never dead links', async () => {
    router = makeRouter(['/guru/set-soalan', '/guru/databank'])
    const w = await mountPage()
    expect(all(w, 'alat-tile').map((x) => x.attributes('href'))).toEqual([
      '/guru/databank',
      '/guru/set-soalan',
    ])
    for (const tile of all(w, 'alat-tile')) {
      expect(router.resolve(tile.attributes('href')!).matched.length).toBeGreaterThan(0)
    }
  })

  it('renders no block at all when no target is registered', async () => {
    router = makeRouter()
    const w = await mountPage()
    expect(t(w, 'alat-soalan').exists()).toBe(false)
    expect(w.text()).not.toContain('Alat Soalan')
  })

  it('a registered route the role may not open is hidden (Soalan Gambar Rajah is admin-only)', async () => {
    router = makeRouter(TOOLS, { '/admin/soalan-gambar': { roles: ['admin'] } })
    const teacher = await mountPage()
    expect(all(teacher, 'alat-tile').map((x) => x.attributes('href'))).not.toContain(
      '/admin/soalan-gambar',
    )
    expect(all(teacher, 'alat-tile')).toHaveLength(5)
    teacher.unmount()
    sessionMock.role = 'admin'
    const admin = await mountPage()
    expect(all(admin, 'alat-tile')).toHaveLength(6)
  })
})
