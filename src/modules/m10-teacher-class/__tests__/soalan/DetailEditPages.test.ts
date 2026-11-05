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
}))
vi.mock('../../api/guru', () => guru)

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
})
afterEach(() => vi.clearAllMocks())

describe('S23 detail', () => {
  it('shows the chips, options, explanation and statistics', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({
        status: 'pending',
        editable: true,
        usage: { attempts: 4, correct: 3, accuracy: 75 },
      }),
    )
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(t(w, 'detail-subject').text()).toBe('Bahasa Melayu')
    expect(t(w, 'detail-source').text()).toBe('textbook_content_rebuild')
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
    expect(t(w, 'stat-attempts').text()).toContain('4')
    expect(t(w, 'stat-correct').text()).toContain('3')
    expect(t(w, 'stat-accuracy').text()).toContain('75%')
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
  })

  it('FR-GUR-44-10: an approved item shows Diluluskan and no Edit button', async () => {
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(t(w, 'detail-status').text()).toBe('Diluluskan')
    expect(t(w, 'detail-reason').exists()).toBe(false)
    expect(t(w, 'detail-edit').exists()).toBe(false)
  })

  it('never renders a stored mock image', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({ questionImage: 'blob:mock/question/a' }),
    )
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(w.find('img').exists()).toBe(false)
  })

  it('raises the in-place 404 for a question that is not own', async () => {
    guru.fetchContributedQuestion.mockRejectedValue(notFound())
    await mountPage(SumbangSoalanDetailPage, 1)
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('S24 edit', () => {
  it('AC-GUR-44-6: preloads the text, the saved difficulty (4 stars), TP and the correct option', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(detail({ tp: 5 }))
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'edit-source').text()).toContain('textbook_content_rebuild')
    expect((t(w, 'e-text').element as HTMLTextAreaElement).value).toBe('Pilih ayat yang betul?')
    expect(
      t(w, 'e-difficulty')
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
    expect((t(w, 'e-difficulty').element as HTMLSelectElement).value).toBe('4')
    expect(t(w, 'e-tp').text()).toContain('5')
    expect(
      w.findAll('[data-testid="e-correct"] [role="radio"]')[2]!.attributes('aria-checked'),
    ).toBe('true')
    expect((t(w, 'e-option-1').element as HTMLTextAreaElement).value).toBe('Dua')
    expect((t(w, 'e-explanation').element as HTMLTextAreaElement).value).toBe('Kerana tiga.')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/guru/soalan/522425')
    expect(t(w, 'edit-back').attributes('href')).toBe('/guru/soalan/522425')
  })

  it('FR-GUR-44-6: a saved difficulty of 1 or 5 is preselected and sent as saved', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(detail({ difficultyLevel: 1 }))
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    expect((t(w, 'e-difficulty').element as HTMLSelectElement).value).toBe('1')
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    const body = guru.updateContributedQuestion.mock.calls[0]![1] as Record<string, unknown>
    expect(body.difficultyLevel).toBe(1)
  })

  it('shows the BM text and sends nothing when the difficulty is cleared', async () => {
    const w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'e-difficulty').setValue('')
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Sila pilih kesukaran.')
    expect(guru.updateContributedQuestion).not.toHaveBeenCalled()
  })

  it('saves the changed fields, flashes and goes to S23', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'e-explanation').setValue('Penjelasan baharu')
    await t(w, 'e-difficulty').setValue('3')
    await w.findAll('[data-testid="e-correct"] [role="radio"]')[0]!.trigger('click')
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion).toHaveBeenCalledWith(522425, {
      questionText: 'Pilih ayat yang betul?',
      explanation: 'Penjelasan baharu',
      difficultyLevel: 3,
      options: [
        { id: 0, optionText: 'Satu' },
        { id: 1, optionText: 'Dua' },
        { id: 2, optionText: 'Tiga' },
        { id: 3, optionText: 'Empat' },
      ],
      correctOptionId: 0,
    })
    expect(router.currentRoute.value.path).toBe('/guru/soalan/522425')
    expect(useFlashStore().pending?.type).toBe('success')
  })

  it('has no image field (API-GUR-18 dropped the image fields)', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'e-image').exists()).toBe(false)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion).toHaveBeenCalledTimes(1)
    expect(guru.updateContributedQuestion.mock.calls[0]).toHaveLength(2)
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
    const w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain('Sila isi soalan.')
    expect(router.currentRoute.value.path).toBe('/guru/soalan/522425')
  })

  it('shows the save-failed text for a 500 and keeps a module BM 409 (SWE-09)', async () => {
    guru.updateContributedQuestion.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
    )
    let w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain(COPY.saveFailed)
    expect(t(w, 'form-errors').text()).not.toContain('Server Error')
    w.unmount()
    guru.updateContributedQuestion.mockRejectedValueOnce(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan sedang disemak.' }),
    )
    w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain('Soalan sedang disemak.')
  })

  it('always offers the option block (MCQ only)', async () => {
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'edit-options').exists()).toBe(true)
  })

  it('raises the in-place 404', async () => {
    guru.fetchContributedQuestion.mockRejectedValue(notFound())
    await mountPage(SumbangSoalanEditPage, 1)
    expect(useRouteOutcome().value).toBe(404)
  })
})
