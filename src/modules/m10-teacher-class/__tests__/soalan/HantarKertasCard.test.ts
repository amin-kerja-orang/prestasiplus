// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import HantarKertasCard from '../../components/soalan/HantarKertasCard.vue'
import { COPY } from '../../components/soalan/lib'

const guru = vi.hoisted(() => ({ submitQuestionPaper: vi.fn() }))
vi.mock('../../api/guru', () => guru)

const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)

async function fillAndSubmit(w: VueWrapper): Promise<void> {
  await t(w, 'paper-jenis').setValue('Trial Paper')
  await t(w, 'paper-subject').setValue('Kimia')
  await t(w, 'paper-tahun').setValue('2024')
  const input = t(w, 'paper-files')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['x'], 'kertas.pdf'), new File(['y'], 'skema.docx')],
    configurable: true,
  })
  await input.trigger('change')
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
})
