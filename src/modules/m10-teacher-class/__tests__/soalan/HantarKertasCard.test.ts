// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import HantarKertasCard from '../../components/soalan/HantarKertasCard.vue'
import { COPY } from '../../components/soalan/lib'
import { pickFiles } from './pick-file'

const guru = vi.hoisted(() => ({ submitQuestionPaper: vi.fn() }))
vi.mock('../../api/guru', () => guru)

const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)

async function fillAndSubmit(w: VueWrapper): Promise<void> {
  await t(w, 'paper-jenis').setValue('Trial Paper')
  await t(w, 'paper-subject').setValue('Kimia')
  await t(w, 'paper-tahun').setValue('2024')
  await pickFiles(
    w,
    'paper-files',
    [new File(['x'], 'kertas.pdf'), new File(['y'], 'skema.docx')],
    true,
  )
  await t(w, 'paper-form').trigger('submit')
  await flushPromises()
}

afterEach(() => vi.clearAllMocks())

describe('Hantar Kertas submit (contract #60)', () => {
  it('posts the multipart fields and shows the sent text @provisional UNVERIFIED COPY', async () => {
    guru.submitQuestionPaper.mockResolvedValue({})
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(guru.submitQuestionPaper).toHaveBeenCalledTimes(1)
    const [body, files] = guru.submitQuestionPaper.mock.calls[0] as unknown as [
      Record<string, unknown>,
      File[],
    ]
    expect(body).toMatchObject({
      jenisSoalan: 'Trial Paper',
      subject: 'Kimia',
      tahun: 2024,
      tingkatan: '',
    })
    expect(files.map((f) => f.name)).toEqual(['kertas.pdf', 'skema.docx'])
    expect(t(w, 'paper-sent').text()).toContain(COPY.paperSent)
    expect(t(w, 'paper-file-list').exists()).toBe(false)
  })

  it('422 shows the server messages', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { files: 'Sila pilih fail.' },
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toContain('Sila pilih fail.')
    expect(t(w, 'paper-sent').exists()).toBe(false)
  })

  it('a generic failure shows the failed text @provisional UNVERIFIED COPY', async () => {
    guru.submitQuestionPaper.mockRejectedValue(new Error('network'))
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toContain(COPY.paperFailed)
  })

  it('SW12-08: a 503 with a server message shows exactly that message', async () => {
    const reason = 'Muat naik kertas soalan belum tersedia buat masa ini.'
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'SERVER_ERROR',
        message: reason,
        body: { error: { code: 'SERVER_ERROR', message: reason } },
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toBe(reason)
    expect(t(w, 'paper-errors').text()).not.toContain(COPY.paperFailed)
    expect(t(w, 'paper-sent').exists()).toBe(false)
  })

  it('SW12-08: a 503 with an empty message keeps the generic failed text', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'SERVER_ERROR',
        message: '  ',
        body: { error: { code: 'SERVER_ERROR', message: '  ' } },
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toBe(COPY.paperFailed)
  })

  it('SW12-08: a bare 503 without the API envelope (proxy) keeps the generic failed text', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'SERVER_ERROR',
        message: 'HTTP 503',
        body: '<html>503</html>',
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toBe(COPY.paperFailed)
  })

  it('SW12-08: a 503 envelope with an English default message keeps the generic failed text', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'SERVER_ERROR',
        message: 'Server Error',
        body: { error: { code: 'SERVER_ERROR', message: 'Server Error' } },
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toBe(COPY.paperFailed)
  })

  it('SW12-08: a network error keeps the generic failed text', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toBe(COPY.paperFailed)
  })

  it('SW12-08: a 500 never shows the raw server text', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Internal Server Error' }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toBe(COPY.paperFailed)
  })

  it('SW12-08: field errors are still listed, one per field', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { subject: 'Sila isi matapelajaran.', files: 'Sila pilih fail.' },
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    const lines = t(w, 'paper-errors')
      .findAll('p')
      .map((p) => p.text())
    expect(lines).toEqual(['Sila isi matapelajaran.', 'Sila pilih fail.'])
  })
})
