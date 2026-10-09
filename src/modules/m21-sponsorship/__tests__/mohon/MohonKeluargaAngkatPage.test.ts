// @vitest-environment jsdom
/**
 * M21-T2 S6 `/mohon-keluarga-angkat` (SRS M21 v1.2 FR-M21-46..49; URS FN-M21-4.2.1..4.2.6): static copy,
 * example click, submit payload, PROPOSED success and 422 notices.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import { FOSTER_APPLICATION_MESSAGES as MSG } from '../../api/types'
import { REASON_EXAMPLES } from '../../components/mohon/mohon-copy'
import MohonKeluargaAngkatPage from '../../pages/MohonKeluargaAngkatPage.vue'

const submit = vi.hoisted(() => vi.fn())
/** A spy result that the module mock turns into a rejection (the spy itself never holds a rejected promise). */
const { Failure, failure } = vi.hoisted(() => {
  class FailureResult {
    constructor(readonly error: Error) {}
  }
  return { Failure: FailureResult, failure: (error: Error) => new FailureResult(error) }
})
vi.mock('../../api/foster-application', () => ({
  submitFosterApplication: (...args: unknown[]): Promise<unknown> => {
    const r: unknown = submit(...args)
    if (r instanceof Failure) return Promise.reject(r.error)
    return Promise.resolve(r)
  },
}))

let wrapper: VueWrapper | undefined

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mohon-keluarga-angkat', component: { template: '<div />' } },
      { path: '/register', component: { template: '<div />' } },
    ],
  })
  await router.push('/mohon-keluarga-angkat')
  await router.isReady()
  wrapper = mount(MohonKeluargaAngkatPage, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

const email = () => wrapper!.get<HTMLInputElement>('#student_email')
const category = () => wrapper!.get<HTMLSelectElement>('#student_category')
const income = () => wrapper!.get<HTMLSelectElement>('#family_income_range')
const reason = () => wrapper!.get<HTMLTextAreaElement>('#reason')
const notice = () => wrapper!.get('[data-testid="mohon-notice"]')

async function fill(
  over: { email?: string; category?: string; income?: string; reason?: string } = {},
) {
  await email().setValue(over.email ?? 'pelajar@demo.test')
  await category().setValue(over.category ?? 'OKU')
  if (over.income !== undefined) await income().setValue(over.income)
  await reason().setValue(over.reason ?? 'Sebab ujian')
}

function validation(fields: Record<string, string>): ApiError {
  return new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'invalid', fields })
}

beforeEach(() => {
  submit.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S6 static copy (FR-M21-46, 48)', () => {
  it('renders the hero, fields, placeholders and the hint with the "sini" link', async () => {
    await mountPage()
    expect(wrapper!.get('h1').text()).toBe('Mohon Keluarga Angkat')
    expect(wrapper!.get('[data-testid="mohon-hero"]').text()).toContain(
      'Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma.',
    )
    expect(email().attributes('type')).toBe('email')
    expect(email().attributes('placeholder')).toBe('pelajar@email.com')
    expect(email().attributes('required')).toBeDefined()
    expect(wrapper!.get('label[for="student_email"]').text()).toBe('Email Pelajar')
    expect(wrapper!.get('#student_email_hint').text()).toBe(
      'Email pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di sini.',
    )
    const link = wrapper!.get('#student_email_hint a')
    expect(link.text()).toBe('sini')
    expect(link.attributes('href')).toBe('/register')
    expect(reason().attributes('rows')).toBe('4')
    expect(reason().attributes('placeholder')).toBe(
      'Terangkan kenapa pelajar ini memerlukan tajaan...',
    )
    expect(wrapper!.get('[data-testid="mohon-submit"]').text()).toBe('Hantar Permohonan')
  })

  it('has both selects with the exact options; category required, income optional', async () => {
    await mountPage()
    const opts = (s: VueWrapper | ReturnType<VueWrapper['get']>) =>
      s.findAll('option').map((o) => [o.attributes('value'), o.text()])
    expect(opts(category())).toEqual([
      ['', 'Pilih kategori'],
      ['B40', 'B40 — Pendapatan rendah'],
      ['Asnaf', 'Asnaf — Layak bantuan zakat'],
      ['Yatim', 'Yatim — Tiada ibu/bapa'],
      ['OKU', 'OKU — Orang kurang upaya'],
      ['Lain-lain', 'Lain-lain'],
    ])
    expect(opts(income())).toEqual([
      ['', 'Pilih (pilihan)'],
      ['< RM1,000', 'Bawah RM1,000'],
      ['RM1,000 - RM2,500', 'RM1,000 - RM2,500'],
      ['RM2,500 - RM4,000', 'RM2,500 - RM4,000'],
      ['> RM4,000', 'Atas RM4,000'],
    ])
    expect(category().attributes('required')).toBeDefined()
    expect(income().attributes('required')).toBeUndefined()
    expect(reason().attributes('required')).toBeDefined()
  })

  it('shows the info box copy', async () => {
    await mountPage()
    const box = wrapper!.get('[data-testid="mohon-info"]')
    const text = box.text()
    expect(text).toContain('Apa yang berlaku selepas mohon?')
    expect(box.findAll('ol li').map((li) => li.text())).toEqual([
      'Admin semak dan luluskan permohonan (1-3 hari bekerja)',
      'Pelajar masuk ke pool — sponsor/keluarga angkat boleh pilih',
      'Bila sponsor pilih, pelajar dapat akses PERCUMA PrestasiPlus selama 1 sesi persekolahan',
      'Keluarga angkat boleh pantau prestasi pelajar dari dashboard mereka',
    ])
    expect(text).toContain('Siapa boleh mohon?')
    expect(box.findAll('ul li').map((li) => li.text())).toEqual([
      'Pelajar sendiri — mohon untuk diri sendiri',
      'Ibu bapa — mohon untuk anak',
      'Guru / Kaunselor — mohon untuk pelajar yang dikenal pasti memerlukan',
    ])
  })
})

describe('S6 examples (FR-M21-47)', () => {
  it('lists five examples, each starting with "• ", and the note', async () => {
    await mountPage()
    const items = wrapper!.findAll('[data-testid="mohon-example"]')
    expect(items).toHaveLength(5)
    for (const it of items) expect(it.text().startsWith('• ')).toBe(true)
    expect(wrapper!.get('[data-testid="mohon-examples"]').text()).toContain(
      'Contoh sebab permohonan:',
    )
    expect(wrapper!.get('[data-testid="mohon-examples"]').text()).toContain(
      'Klik mana-mana contoh untuk guna sebagai template. Sila ubahsuai mengikut situasi sebenar.',
    )
  })

  it('a click replaces the textarea with the text including "• " and sends nothing', async () => {
    await mountPage()
    const items = wrapper!.findAll('[data-testid="mohon-example"]')
    await items[1]!.trigger('click')
    expect(reason().element.value).toBe(REASON_EXAMPLES[1])
    expect(reason().element.value.startsWith('• Pelajar yatim piatu')).toBe(true)
    await items[3]!.trigger('click')
    expect(reason().element.value).toBe(REASON_EXAMPLES[3])
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('S6 submit (FR-M21-49)', () => {
  it('posts the form, resets it and shows the PROPOSED success notice', async () => {
    submit.mockResolvedValue({ id: 4 })
    await mountPage()
    await fill({ income: '< RM1,000' })
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(submit).toHaveBeenCalledWith({
      studentEmail: 'pelajar@demo.test',
      studentCategory: 'OKU',
      familyIncomeRange: '< RM1,000',
      reason: 'Sebab ujian',
    })
    expect(notice().text()).toContain(MSG.success)
    expect(notice().text()).toBe(
      'Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja.',
    )
    expect(email().element.value).toBe('')
    expect(category().element.value).toBe('')
    expect(income().element.value).toBe('')
    expect(reason().element.value).toBe('')
  })

  it('shows the 422 messages, keeps the typed values and marks the rejected field', async () => {
    submit.mockReturnValue(failure(validation({ studentEmail: MSG.studentNotFound })))
    await mountPage()
    await fill({ email: 'tiada.pelajar@demo.test' })
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(notice().text()).toBe('Email pelajar tidak dijumpai dalam PrestasiPlus.')
    expect(email().element.value).toBe('tiada.pelajar@demo.test')
    expect(reason().element.value).toBe('Sebab ujian')
    expect(email().classes()).toContain('border-red-400')
    expect(category().classes()).not.toContain('border-red-400')
    expect(wrapper!.find('[aria-invalid], [aria-live], [aria-describedby]').exists()).toBe(false)
    expect(wrapper!.find('[data-variant="success"]').exists()).toBe(false)
  })

  it('lists one line per rejected field', async () => {
    submit.mockReturnValue(
      failure(validation({ studentEmail: MSG.invalidEmail, reason: MSG.required })),
    )
    await mountPage()
    await fill()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(
      notice()
        .findAll('p')
        .map((p) => p.text()),
    ).toEqual(['Format e-mel tidak sah.', 'Sila isi ruangan ini.'])
  })

  it('removes duplicate 422 messages', async () => {
    submit.mockReturnValue(
      failure(validation({ studentEmail: MSG.required, studentCategory: MSG.required })),
    )
    await mountPage()
    await fill()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(
      notice()
        .findAll('p')
        .map((p) => p.text()),
    ).toEqual(['Sila isi ruangan ini.'])
  })

  it('sends a whitespace-only reason as typed (the browser check lets it pass; the server rejects it)', async () => {
    submit.mockResolvedValue({ id: 4 })
    await mountPage()
    await fill({ reason: '   ' })
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ reason: '   ' }))
  })

  it.each([
    ['a 500', new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' })],
    [
      'a network error',
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
    ],
  ])('%s shows the generic error box', async (_name, boom) => {
    submit.mockReturnValue(failure(boom))
    await mountPage()
    await fill()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper!.get('[data-variant="error"]').isVisible()).toBe(true)
    expect(notice().text()).toBe('Ralat berlaku. Sila cuba lagi.')
    expect(wrapper!.get('[data-testid="mohon-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('a new submit clears the previous notice', async () => {
    submit
      .mockResolvedValueOnce({ id: 4 })
      .mockReturnValueOnce(failure(validation({ reason: MSG.required })))
    await mountPage()
    await fill()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper!.find('[data-variant="success"]').exists()).toBe(true)
    await fill()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper!.find('[data-variant="success"]').exists()).toBe(false)
    expect(notice().text()).toBe('Sila isi ruangan ini.')
  })

  it('disables the button while the request is pending (no double submit)', async () => {
    let resolve: (v: { id: number }) => void = () => undefined
    submit.mockReturnValue(new Promise((r) => (resolve = r)))
    await mountPage()
    await fill()
    await wrapper!.get('form').trigger('submit')
    await wrapper!.get('form').trigger('submit')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(wrapper!.get('[data-testid="mohon-submit"]').attributes('disabled')).toBeDefined()
    resolve({ id: 4 })
    await flushPromises()
    expect(wrapper!.get('[data-testid="mohon-submit"]').attributes('disabled')).toBeUndefined()
  })
})
