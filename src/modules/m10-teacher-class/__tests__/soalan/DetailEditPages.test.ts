// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router/outcome'
import { useFlashStore } from '@/stores/flash'

import { pickFiles } from './pick-file'
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
      detail({ usage: { attempts: 4, correct: 3, accuracy: 75 } }),
    )
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(t(w, 'detail-subject').text()).toBe('Bahasa Melayu')
    expect(t(w, 'detail-source').text()).toBe('textbook_content_rebuild')
    expect(t(w, 'detail-tahap').text()).toBe('Tahap 4')
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

  it('never renders a stored mock image', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({ questionImage: 'blob:mock/question/a' }),
    )
    const w = await mountPage(SumbangSoalanDetailPage)
    expect(w.find('img').exists()).toBe(false)
  })

  it('SW12-01-A: shows the /api/files image URLs of the stem and of the options', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({
        questionImage: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg',
        optionImages: [null, '/api/files/Ab3Qx9vB2mLw7TnRa1YpUg', null, null],
      }),
    )
    const w = await mountPage(SumbangSoalanDetailPage)
    const srcs = w.findAll('img').map((i) => i.attributes('src'))
    expect(srcs).toEqual([
      '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg',
      '/api/files/Ab3Qx9vB2mLw7TnRa1YpUg',
    ])
    expect(all(w, 'detail-option-image')).toHaveLength(1)
  })

  it('raises the in-place 404 for a question that is not own', async () => {
    guru.fetchContributedQuestion.mockRejectedValue(notFound())
    await mountPage(SumbangSoalanDetailPage, 1)
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('S24 edit', () => {
  it('preloads the text, the saved difficulty and the correct option', async () => {
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'edit-source').text()).toContain('textbook_content_rebuild')
    expect((t(w, 'e-text').element as HTMLTextAreaElement).value).toBe('Pilih ayat yang betul?')
    expect(t(w, 'e-text').attributes('required')).toBeDefined()
    expect(
      t(w, 'e-difficulty')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Pilih --', 'Mudah', 'Sederhana', 'Sukar'])
    expect((t(w, 'e-difficulty').element as HTMLSelectElement).value).toBe('4')
    expect(w.findAll('[data-testid="e-correct"] [role="radio"]')[2]!.attributes('aria-checked')).toBe('true')
    expect((t(w, 'e-option-1').element as HTMLTextAreaElement).value).toBe('Dua')
    expect((t(w, 'e-explanation').element as HTMLTextAreaElement).value).toBe('Kerana tiga.')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/guru/soalan/522425')
    expect(t(w, 'edit-back').attributes('href')).toBe('/guru/soalan/522425')
  })

  it('shows "-- Pilih --" for a saved difficulty outside 2-4 and sends no difficulty', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(detail({ difficultyLevel: 1 }))
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    expect((t(w, 'e-difficulty').element as HTMLSelectElement).value).toBe('')
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    const body = guru.updateContributedQuestion.mock.calls[0]![1] as Record<string, unknown>
    expect(body.difficultyLevel).toBeUndefined()
  })

  it('saves the changed fields, flashes and goes to S23', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'e-explanation').setValue('Penjelasan baharu')
    await t(w, 'e-difficulty').setValue('3')
    await w.findAll('[data-testid="e-correct"] [role="radio"]')[0]!.trigger('click')
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion).toHaveBeenCalledWith(
      522425,
      {
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
      },
      null,
    )
    expect(router.currentRoute.value.path).toBe('/guru/soalan/522425')
    expect(useFlashStore().pending?.type).toBe('success')
  })

  it('saves a chosen image in one call through the client', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    const png = new File(['x'], 'rajah.png', { type: 'image/png' })
    await pickFiles(w, 'e-image', [png])
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion).toHaveBeenCalledTimes(1)
    const [id, body, image] = guru.updateContributedQuestion.mock.calls[0] as unknown as [
      number,
      Record<string, unknown>,
      File | null,
    ]
    expect(id).toBe(522425)
    expect(body.questionText).toBe('Pilih ayat yang betul?')
    expect(image).toBe(png)
  })

  it('SW12-01-A: shows the saved image and puts a questionImage error on the image field', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({ questionImage: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg' }),
    )
    guru.updateContributedQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Fail terlalu besar.',
        fields: { questionImage: 'Fail terlalu besar.' },
      }),
    )
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'e-image-current').attributes('src')).toBe('/api/files/Zk3Qx9vB2mLw7TnRa1YpUg')
    await pickFiles(w, 'e-image', [new File(['x'], 'rajah.png', { type: 'image/png' })])
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-testid="field-error"]').text()).toContain('Fail terlalu besar.')
    expect(router.currentRoute.value.path).toBe('/guru/soalan/522425')
  })

  it('SW12-01-A: the image field says what the files API takes (JPEG / PNG / WebP, 2 MB)', async () => {
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'e-image').attributes('accept')).toBe('image/jpeg,image/png,image/webp')
    expect(w.text()).toContain('Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.')
    expect(w.text()).not.toContain('max 5MB')
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await pickFiles(w, 'e-image', [big])
    expect(w.text()).toContain('Fail melebihi saiz maksimum 2 MB.')
  })

  it('SW12-01-A: a gif picked through "All files" is refused before any request', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    await pickFiles(w, 'e-image', [new File(['x'], 'a.gif', { type: 'image/gif' })])
    expect(w.text()).toContain(COPY.imageInvalid)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion.mock.calls[0]![2]).toBeNull()
  })

  it.each([
    ['a network error', new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' })],
    [
      'a 500',
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Internal error',
        body: { error: { code: 'SERVER_ERROR', message: 'Internal error' } },
      }),
    ],
  ])('SW12-01-A: %s shows the save-failed text, not the raw message', async (_n, error) => {
    guru.updateContributedQuestion.mockRejectedValue(error)
    const w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toBe(COPY.saveFailed)
  })

  it('SW12-01-A: "Batal" is disabled while the changes are being saved', async () => {
    let finish: (v: unknown) => void = () => undefined
    guru.updateContributedQuestion.mockReturnValue(new Promise((r) => (finish = r)))
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'form-cancel').attributes('href')).toBe('/guru/soalan/522425')
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-cancel').attributes('href')).toBeUndefined()
    expect(t(w, 'form-cancel').attributes('aria-disabled')).toBe('true')
    finish(detail())
    await flushPromises()
  })

  it('sends no image when none is chosen', async () => {
    guru.updateContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage(SumbangSoalanEditPage)
    await t(w, 'edit-form').trigger('submit')
    await flushPromises()
    expect(guru.updateContributedQuestion.mock.calls[0]![2]).toBeNull()
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

  it('offers no option block for a question that is not MCQ', async () => {
    guru.fetchContributedQuestion.mockResolvedValue(
      detail({ questionType: 'essay', options: null, correctAnswer: null }),
    )
    const w = await mountPage(SumbangSoalanEditPage)
    expect(t(w, 'edit-options').exists()).toBe(false)
  })

  it('raises the in-place 404', async () => {
    guru.fetchContributedQuestion.mockRejectedValue(notFound())
    await mountPage(SumbangSoalanEditPage, 1)
    expect(useRouteOutcome().value).toBe(404)
  })
})
