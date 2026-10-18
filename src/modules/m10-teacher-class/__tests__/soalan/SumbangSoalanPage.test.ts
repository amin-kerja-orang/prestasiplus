// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

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
  router = makeRouter()
  guru.fetchContributions.mockResolvedValue(summary())
  guru.fetchContributedQuestions.mockResolvedValue({
    data: [
      question(),
      question({
        id: 522426,
        questionText: 'Kedua?',
        status: 'pending_review',
        statusLabel: 'Menunggu Semakan',
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
    expect(t(w, 'audio-create').attributes('href')).toBe('/guru/audio-kbat/create')
    expect(t(w, 'audio-list').attributes('href')).toBe('/guru/audio-kbat')
  })

  it('lists the cards, toggles one open and links Edit', async () => {
    const w = await mountPage()
    const cards = all(w, 'question-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.find('[data-testid="chip-status"]').text()).toBe('Diluluskan')
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
    expect(body.find('[data-testid="question-edit"]').attributes('href')).toBe(
      '/guru/soalan/522425/edit',
    )
  })

  it('keeps the card when the delete confirm is cancelled and deletes when accepted', async () => {
    const w = await mountPage()
    await all(w, 'question-toggle')[0]!.trigger('click')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await t(w, 'question-delete').trigger('click')
    expect(confirm).toHaveBeenCalledWith(
      'Padam soalan #522425? Tindakan ini tidak boleh dibatalkan.',
    )
    expect(guru.deleteContributedQuestion).not.toHaveBeenCalled()

    confirm.mockReturnValueOnce(true)
    guru.deleteContributedQuestion.mockResolvedValue({ removed: 1 })
    await t(w, 'question-delete').trigger('click')
    await flushPromises()
    expect(guru.deleteContributedQuestion).toHaveBeenCalledWith(522425)
    expect(guru.fetchContributions).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current?.type).toBe('success')
    confirm.mockRestore()
  })

  it('shows a refused delete without reloading', async () => {
    const w = await mountPage()
    await all(w, 'question-toggle')[0]!.trigger('click')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    guru.deleteContributedQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' }),
    )
    await t(w, 'question-delete').trigger('click')
    await flushPromises()
    expect(t(w, 'soalan-delete-error').text()).toContain('Rekod tidak dijumpai.')
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
  it('shows the empty text and no pager when the teacher has no question @provisional UNVERIFIED COPY', async () => {
    guru.fetchContributedQuestions.mockResolvedValue({ data: [], meta: listMeta(0) })
    const w = await mountPage()
    expect(t(w, 'soalan-empty').text()).toBe('Belum ada soalan.')
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
      filename: 'template-import-soalan.csv',
    })
    const w = await mountPage()
    expect(t(w, 'import-form').exists()).toBe(false)
    await t(w, 'import-template').trigger('click')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'template-import-soalan.csv')

    await t(w, 'import-toggle').trigger('click')
    const file = t(w, 'import-file')
    expect(file.attributes('accept')).toBe('.csv,.txt')
    expect(t(w, 'import-guide').text()).toContain(
      'Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport',
    )
  })

  it('imports a file, reports the failed rows and reloads the page data @provisional UNVERIFIED COPY', async () => {
    guru.importQuestions.mockResolvedValue({
      imported: 1,
      failed: [{ row: 3, message: 'Baris tidak lengkap.' }],
    })
    const w = await mountPage()
    await t(w, 'import-toggle').trigger('click')
    const csv = new File(['a'], 'soalan.csv', { type: 'text/csv' })
    await pickFiles(w, 'import-file', [csv])
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(guru.importQuestions).toHaveBeenCalledWith(csv)
    expect(t(w, 'import-result-summary').text()).toBe('1 soalan berjaya diimport.')
    expect(t(w, 'import-failure').text()).toBe('Baris 3: Baris tidak lengkap.')
    expect(guru.fetchContributions).toHaveBeenCalledTimes(2)
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
    expect(t(w, 'paper-files').attributes('accept')).toBe('.pdf,.doc,.docx,.xls,.xlsx')
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
