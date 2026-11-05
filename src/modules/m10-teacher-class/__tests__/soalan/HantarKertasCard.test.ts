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

async function fill(
  w: VueWrapper,
  files: File[] = [new File(['x'], 'kertas.pdf'), new File(['y'], 'skema.docx')],
  confirm = true,
): Promise<void> {
  await t(w, 'paper-jenis').setValue('trial')
  await t(w, 'paper-subject').setValue('Kimia')
  await t(w, 'paper-tahun').setValue('2024')
  await pickFiles(w, 'paper-files', files, true)
  if (confirm) await t(w, 'paper-confirm').trigger('click')
}

async function fillAndSubmit(w: VueWrapper): Promise<void> {
  await fill(w)
  await t(w, 'paper-form').trigger('submit')
  await flushPromises()
}

afterEach(() => vi.clearAllMocks())

describe('Hantar Kertas submit (contract #60)', () => {
  it('AC-GUR-44-2: posts the multipart fields and shows "Kertas dihantar kepada admin."', async () => {
    guru.submitQuestionPaper.mockResolvedValue({})
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(guru.submitQuestionPaper).toHaveBeenCalledTimes(1)
    const [body, files] = guru.submitQuestionPaper.mock.calls[0] as unknown as [
      Record<string, unknown>,
      File[],
    ]
    expect(body).toMatchObject({
      paperType: 'trial',
      subject: 'Kimia',
      year: 2024,
      levelId: '',
      answerSchemeConfirmed: true,
    })
    expect(files.map((f) => f.name)).toEqual(['kertas.pdf', 'skema.docx'])
    expect(t(w, 'paper-sent').text()).toContain(COPY.paperSent)
    expect(t(w, 'paper-file-list').exists()).toBe(false)
  })

  it('AC-GUR-44-14: the server scanned-PDF error shows on the file field', async () => {
    guru.submitQuestionPaper.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { files: 'PDF imbasan imej tidak diterima — teks mesti boleh disalin.' },
      }),
    )
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-files-error').text()).toBe(
      'PDF imbasan imej tidak diterima — teks mesti boleh disalin.',
    )
    expect(t(w, 'paper-sent').exists()).toBe(false)
  })

  it('44-F4: no confirmation shows "Sila sahkan skema jawapan disertakan." and sends nothing', async () => {
    const w = mount(HantarKertasCard)
    await fill(w, undefined, false)
    await t(w, 'paper-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'paper-confirm-error').text()).toBe('Sila sahkan skema jawapan disertakan.')
    expect(guru.submitQuestionPaper).not.toHaveBeenCalled()
  })

  it('44-F4: required fields show their BM text and nothing is sent', async () => {
    const w = mount(HantarKertasCard)
    await t(w, 'paper-form').trigger('submit')
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Sila pilih jenis soalan.')
    expect(text).toContain('Sila isi matapelajaran.')
    expect(t(w, 'paper-files-error').text()).toBe('Sila pilih fail.')
    expect(t(w, 'paper-banner').text()).toContain('medan perlu dibetulkan.')
    expect(guru.submitQuestionPaper).not.toHaveBeenCalled()
  })

  it('AC-GUR-44-14: 6 files show the file error and nothing is sent', async () => {
    const w = mount(HantarKertasCard)
    const six = Array.from({ length: 6 }, (_, i) => new File(['x'], `k${String(i)}.pdf`))
    await fill(w, six)
    expect(t(w, 'paper-files-error').text()).toBe('Maksimum 5 fail, saiz maksimum 20MB setiap fail')
    expect(t(w, 'paper-file-list').exists()).toBe(false)
    await t(w, 'paper-form').trigger('submit')
    await flushPromises()
    expect(guru.submitQuestionPaper).not.toHaveBeenCalled()
  })

  it('AC-GUR-44-3: a 25 MB file shows a BM error and is not uploaded', async () => {
    const w = mount(HantarKertasCard)
    const big = new File(['x'], 'besar.pdf')
    Object.defineProperty(big, 'size', { value: 25 * 1024 * 1024 })
    await fill(w, [big])
    expect(t(w, 'paper-files-error').text()).toBe('Fail melebihi saiz maksimum 20 MB.')
    await t(w, 'paper-form').trigger('submit')
    await flushPromises()
    expect(guru.submitQuestionPaper).not.toHaveBeenCalled()
  })

  it('44-F4: .doc and .xls are refused, any invalid file rejects all', async () => {
    const w = mount(HantarKertasCard)
    await fill(w, [new File(['x'], 'ok.pdf'), new File(['y'], 'lama.doc')])
    expect(t(w, 'paper-files-error').text()).toBe(
      'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.',
    )
    expect(t(w, 'paper-file-list').exists()).toBe(false)
  })

  it('44-F4: the accept list is pdf, docx, xlsx; the busy text is "Memuat naik..."', async () => {
    let release: (v: unknown) => void = () => undefined
    guru.submitQuestionPaper.mockReturnValue(new Promise((r) => (release = r)))
    const w = mount(HantarKertasCard)
    expect(w.find('input[type="file"]').attributes('accept')).toBe('.pdf,.docx,.xlsx')
    await fillAndSubmit(w)
    expect(t(w, 'paper-submit').text()).toContain('Memuat naik...')
    release({})
    await flushPromises()
    expect(t(w, 'paper-submit').text()).toContain('Hantar kepada Admin')
  })

  it('no "belum tersedia" text exists in the card or its copy', () => {
    const w = mount(HantarKertasCard)
    expect(w.text()).not.toContain('belum tersedia')
    expect(JSON.stringify(COPY)).not.toContain('belum tersedia')
  })

  it('a generic failure shows the failed text @provisional UNVERIFIED COPY', async () => {
    guru.submitQuestionPaper.mockRejectedValue(new Error('network'))
    const w = mount(HantarKertasCard)
    await fillAndSubmit(w)
    expect(t(w, 'paper-errors').text()).toContain(COPY.paperFailed)
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

  it('SW12-08: field errors show under their fields', async () => {
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
    expect(w.text()).toContain('Sila isi matapelajaran.')
    expect(t(w, 'paper-files-error').text()).toBe('Sila pilih fail.')
  })
})
