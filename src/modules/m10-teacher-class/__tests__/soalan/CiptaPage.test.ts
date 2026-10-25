// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import { COPY } from '../../components/soalan/lib'
import SumbangSoalanCiptaPage from '../../pages/SumbangSoalanCiptaPage.vue'
import { detail, makeRouter } from './fixtures'
import { pickFiles } from './pick-file'

const guru = vi.hoisted(() => ({
  createContributedQuestion: vi.fn(),
  fetchChapters: vi.fn(() => Promise.resolve([])),
  fetchTopics: vi.fn(() => Promise.resolve([])),
  fetchBidang: vi.fn(() => Promise.resolve([])),
  fetchSk: vi.fn(() => Promise.resolve([])),
  fetchSp: vi.fn(() => Promise.resolve([])),
  createChapter: vi.fn(),
  createTopic: vi.fn(),
  createBidang: vi.fn(),
  createSk: vi.fn(),
  createSp: vi.fn(),
}))
vi.mock('../../api/guru', () => guru)
vi.mock('../../components/soalan/data', () => ({
  fetchLevelOptions: vi.fn(() => Promise.resolve([{ id: 11, name: 'Tingkatan 5' }])),
  fetchSubjectOptions: vi.fn(() => Promise.resolve([{ id: 1, name: 'Bahasa Melayu' }])),
}))

let router: Router
const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)

async function mountPage(): Promise<VueWrapper> {
  await router.push('/guru/soalan/cipta')
  const w = mount(SumbangSoalanCiptaPage, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

async function fill(w: VueWrapper): Promise<void> {
  await t(w, 'q-level').setValue('11')
  await t(w, 'q-subject').setValue('1')
  await t(w, 'q-difficulty').setValue('hard')
  await t(w, 'q-text').setValue('Soalan baharu?')
  for (const i of [0, 1, 2, 3]) await t(w, `q-option-${String(i)}`).setValue(`P${String(i)}`)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  router = makeRouter()
})
afterEach(() => vi.clearAllMocks())

describe('S22 save path', () => {
  it('201 goes to /guru/soalan with the created flash @provisional UNVERIFIED COPY', async () => {
    guru.createContributedQuestion.mockResolvedValue(detail({ id: 9000001 }))
    const w = await mountPage()
    await fill(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(guru.createContributedQuestion).toHaveBeenCalledTimes(1)
    const [body, images] = guru.createContributedQuestion.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { questionImage: File | null; optionImages: (File | null)[] },
    ]
    expect(body).toMatchObject({
      questionType: 'mcq',
      difficultyLevel: 'hard',
      questionText: 'Soalan baharu?',
      correctAnswer: 0,
    })
    expect(images.questionImage).toBeNull()
    expect(images.optionImages).toEqual([null, null, null, null])
    expect(router.currentRoute.value.path).toBe('/guru/soalan')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: COPY.created })
  })

  it('sends the option images and the question image through the client', async () => {
    guru.createContributedQuestion.mockResolvedValue(detail())
    const w = await mountPage()
    await fill(w)
    const png = new File(['x'], 'a.png', { type: 'image/png' })
    const rajah = new File(['y'], 'rajah.png', { type: 'image/png' })
    await pickFiles(w, 'q-option-image-1-input', [png])
    await pickFiles(w, 'q-image-input', [rajah])
    await w.find('form').trigger('submit')
    await flushPromises()
    const images = guru.createContributedQuestion.mock.calls[0]![1] as unknown as {
      questionImage: File | null
      optionImages: (File | null)[]
    }
    expect(images.questionImage).toBe(rajah)
    expect(images.optionImages).toEqual([null, png, null, null])
  })

  it('422 shows the field errors, stays on S22 and keeps the values', async () => {
    guru.createContributedQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { questionText: 'Sila isi soalan.', options: 'Sila isi semua pilihan jawapan.' },
      }),
    )
    const w = await mountPage()
    await fill(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/guru/soalan/cipta')
    expect(t(w, 'form-errors').text()).toContain('Sila isi soalan.')
    expect(w.text()).toContain('Sila isi semua pilihan jawapan.')
    expect((t(w, 'q-text').element as HTMLTextAreaElement).value).toBe('Soalan baharu?')
    expect((t(w, 'q-option-2').element as HTMLInputElement).value).toBe('P2')
    expect(useFlashStore().pending).toBeNull()
  })

  it('a 500 "Server Error" and a lost connection show the save-failed text, a module BM 409 shows as is (SWE-09)', async () => {
    const cases: [ApiError, string][] = [
      [
        new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
        COPY.saveFailed,
      ],
      [
        new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
        COPY.saveFailed,
      ],
      [
        new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan ini sudah wujud.' }),
        'Soalan ini sudah wujud.',
      ],
    ]
    for (const [error, shown] of cases) {
      guru.createContributedQuestion.mockRejectedValueOnce(error)
      const w = await mountPage()
      await fill(w)
      await w.find('form').trigger('submit')
      await flushPromises()
      expect(t(w, 'form-errors').text()).toContain(shown)
      expect(t(w, 'form-errors').text()).not.toMatch(/Server Error|Failed to fetch/)
      w.unmount()
    }
  })

  it('a generic failure shows the save-failed text @provisional UNVERIFIED COPY', async () => {
    guru.createContributedQuestion.mockRejectedValue(new Error('network'))
    const w = await mountPage()
    await fill(w)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'form-errors').text()).toContain(COPY.saveFailed)
  })
})
