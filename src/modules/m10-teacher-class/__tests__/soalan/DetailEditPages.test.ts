// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router/outcome'
import { useFlashStore } from '@/stores/flash'

import { COPY } from '../../components/soalan/lib'
import SumbangSoalanDetailPage from '../../pages/SumbangSoalanDetailPage.vue'
import SumbangSoalanEditPage from '../../pages/SumbangSoalanEditPage.vue'
import { detail, makeRouter } from './fixtures'

const guru = vi.hoisted(() => ({
  fetchContributedQuestion: vi.fn(),
  updateContributedQuestion: vi.fn(),
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

let router: Router
const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const all = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`)

async function mountPage(component: Component, id = 522425): Promise<VueWrapper> {
  await router.push(`/guru/soalan/${String(id)}`)
  const w = mount(component, { props: { id }, global: { plugins: [router] } })
  await flushPromises()
  return w
}

const notFound = () => new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' })

beforeEach(() => {
  setActivePinia(createPinia())
  router = makeRouter()
  guru.fetchContributedQuestion.mockResolvedValue(detail())
  guru.fetchChapters.mockResolvedValue([
    { id: 6, chapterNumber: 1, name: 'Satu' },
    { id: 7, chapterNumber: 2, name: 'Dua' },
  ])
  guru.fetchBidang.mockResolvedValue([{ id: 1, code: '1.0', name: 'Bunyi' }])
  guru.fetchSk.mockResolvedValue([{ id: 11, code: '1.1', description: 'SK satu' }])
  guru.fetchSp.mockResolvedValue([{ id: 111, code: '1.1.1', description: 'SP satu' }])
})
afterEach(() => vi.clearAllMocks())

describe('S23 detail', () => {
  it('shows the chips, options and explanation (no source, no usage figures)', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(detail({ status: 'pending', editable: true }))
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(t(w, 'detail-subject').text()).toBe('Bahasa Melayu')
    expect(t(w, 'detail-source').exists()).toBe(false)
    expect(t(w, 'detail-stats').exists()).toBe(false)
    expect(w.text()).not.toContain('Statistik')
    expect(t(w, 'detail-tahap').text()).toBe('⭐⭐⭐⭐')
    expect(t(w, 'detail-status').text()).toBe('Menunggu Semakan')
    expect(t(w, 'detail-type').text()).toBe('mcq')
    expect(t(w, 'detail-text').text()).toBe('Pilih ayat yang betul?')
    const options = all(w, 'detail-option')
    expect(
      options.map((o) =>
        o
          .text()
          .replace(/Betul$/, '')
          .trim(),
      ),
    ).toEqual(['A) Satu', 'B) Dua', 'C) Tiga', 'D) Empat'])
    expect(options.map((o) => o.attributes('data-correct'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ])
    expect(t(w, 'detail-explanation').text()).toContain('Penerangan')
    expect(w.find('img').exists()).toBe(false)
    expect(t(w, 'detail-back').attributes('href')).toBe('/guru/soalan')
    expect(t(w, 'detail-edit').attributes('href')).toBe('/guru/soalan/522425/edit')
  })

  it('FR-GUR-44-10: a rejected item shows Ditolak and "Sebab: {reason}"; Edit follows `editable`', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({ status: 'rejected', rejectionReason: 'Soalan kabur.', editable: false }),
    )
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(t(w, 'detail-status').text()).toBe('Ditolak')
    expect(t(w, 'detail-status').attributes('data-status')).toBe('rejected')
    expect(t(w, 'detail-reason').text()).toBe('Sebab: Soalan kabur.')
    expect(t(w, 'detail-edit').exists()).toBe(false)
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({ status: 'rejected', rejectionReason: 'Ulang.', editable: true }),
    )
    const again = await mountPage(SumbangSoalanDetailPage)
    expect(t(again, 'detail-edit').exists()).toBe(true)
  })

  it('FR-GUR-44-10: an approved item shows Diluluskan and no Edit button', async () => {
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(t(w, 'detail-status').text()).toBe('Diluluskan')
    expect(t(w, 'detail-reason').exists()).toBe(false)
    expect(t(w, 'detail-edit').exists()).toBe(false)
  })

  it('raises the in-place 404 for a question that is not own', async () => {
    guru.fetchContributedQuestion.mockRejectedValue(notFound())
    await mountPage(SumbangSoalanDetailPage, 1)
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('S24 edit (the create form with every saved field)', () => {
  const saved = () =>
    detail({
      status: 'pending',
      editable: true,
      difficultyLevel: 4,
      chapterId: 7,
      spIds: [111],
      tp: 5,
      cognitiveLevel: 'menilai',
    })

  async function mountEdit(d = saved()): Promise<VueWrapper> {
    guru.fetchContributedQuestion.mockResolvedValue(d)
    return mountPage(SumbangSoalanEditPage)
  }

  it('AC-GUR-44-6: preloads Tingkatan, Subjek, Bab, SP, TP, Aras, the 4-star difficulty and the correct option', async () => {
    const w = await mountEdit()
    expect(t(w, 'edit-source').exists()).toBe(false)
    expect((t(w, 'q-level').element as HTMLSelectElement).value).toBe('11')
    expect((t(w, 'q-subject').element as HTMLSelectElement).value).toBe('1')
    expect((t(w, 'q-chapter').element as HTMLSelectElement).value).toBe('7')
    expect((t(w, 'q-sp').element as HTMLSelectElement).value).toBe('111')
    expect((t(w, 'q-tp').element as HTMLSelectElement).value).toBe('5')
    expect((t(w, 'q-aras').element as HTMLSelectElement).value).toBe('menilai')
    expect((t(w, 'q-difficulty').element as HTMLSelectElement).value).toBe('4')
    expect(
      t(w, 'q-difficulty')
        .findAll('option')
        .map((o) => o.text()),
    ).toContain('⭐⭐⭐⭐ — Sukar')
    expect((t(w, 'q-text').element as HTMLTextAreaElement).value).toBe('Pilih ayat yang betul?')
    expect(
      w.findAll('[data-testid="q-correct"] [role="radio"]')[2]!.attributes('aria-checked'),
    ).toBe('true')
    expect((t(w, 'q-option-1').element as HTMLInputElement).value).toBe('Dua')
    expect((t(w, 'q-explanation').element as HTMLTextAreaElement).value).toBe('Kerana tiga.')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/guru/soalan/522425')
    expect(t(w, 'edit-back').attributes('href')).toBe('/guru/soalan/522425')
    expect(t(w, 'form-submit').text()).toBe('Simpan Perubahan')
  })

  it('FR-GUR-44-6: a saved difficulty of 1 or 5 is preselected and is not replaced by min(5, TP)', async () => {
    const w = await mountEdit({ ...saved(), difficultyLevel: 1 })
    expect((t(w, 'q-difficulty').element as HTMLSelectElement).value).toBe('1')
  })

  it('saves the FULL body (same as the create), flashes and goes to S23', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountEdit()
    await t(w, 'q-explanation').setValue('Penjelasan baharu')
    await t(w, 'q-difficulty').setValue('3')
    await w.findAll('[data-testid="q-correct"] [role="radio"]')[0]!.trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion).toHaveBeenCalledWith(522425, {
      educationLevelId: 11,
      subjectId: 1,
      questionType: 'mcq',
      difficultyLevel: 3,
      questionText: 'Pilih ayat yang betul?',
      options: ['Satu', 'Dua', 'Tiga', 'Empat'],
      correctAnswer: 0,
      explanation: 'Penjelasan baharu',
      chapterId: 7,
      spIds: [111],
      tp: 5,
      cognitiveLevel: 'menilai',
    })
    expect(router.currentRoute.value.path).toBe('/guru/soalan/522425')
    expect(useFlashStore().pending?.type).toBe('success')
  })

  it('shows the BM text and sends nothing when the difficulty is cleared', async () => {
    const w = await mountEdit()
    await t(w, 'q-difficulty').setValue('')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Sila pilih kesukaran.')
    expect(guru.updateContributedQuestion).not.toHaveBeenCalled()
  })

  it('has no image field and no source panel', async () => {
    const w = await mountEdit()
    expect(t(w, 'q-image').exists()).toBe(false)
    expect(t(w, 'e-image').exists()).toBe(false)
    expect(w.text()).not.toContain('Sumber Asal')
  })

  it('keeps the form and shows the server messages on a 422', async () => {
    guru.updateContributedQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { questionText: 'Sila isi soalan.' },
      }),
    )
    const w = await mountEdit()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain('Sila isi soalan.')
    expect(router.currentRoute.value.path).toBe('/guru/soalan/522425')
  })

  it('shows the save-failed text for a 500 and keeps the module BM 409 (SWE-09)', async () => {
    guru.updateContributedQuestion.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
    )
    let w = await mountEdit()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain(COPY.saveFailed)
    expect(t(w, 'form-errors').text()).not.toContain('Server Error')
    w.unmount()
    guru.updateContributedQuestion.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Soalan ini sudah diterima atau diluluskan dan tidak boleh diubah.',
      }),
    )
    w = await mountEdit()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain('tidak boleh diubah')
  })

  it('raises the in-place 404', async () => {
    guru.fetchContributedQuestion.mockRejectedValue(notFound())
    await mountPage(SumbangSoalanEditPage, 1)
    expect(useRouteOutcome().value).toBe(404)
  })
})
