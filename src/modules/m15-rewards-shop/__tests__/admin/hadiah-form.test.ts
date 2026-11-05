// @vitest-environment jsdom
/**
 * The Hadiah form of `/admin/hadiah/baharu` and `/:id/edit` against a mocked client (S7-T11; 30 P2-07, P07-02..14):
 * the labels and options, Aktif off by default, no consent field, `Kategori` with the OPT words, PUT replacing
 * with every field, the server's BM messages at the field, and a stored `api` row.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { HadiahReward } from '../../api/types'
import AdminHadiahForm from '../../components/AdminHadiahForm.vue'
import { routerAt } from './support'

const api = vi.hoisted(() => ({
  fetchHadiah: vi.fn(),
  createHadiah: vi.fn(),
  updateHadiah: vi.fn(),
}))
vi.mock('../../api/admin', () => api)

const STORED: HadiahReward = {
  id: '17',
  category: 'telco',
  vendor: 'Hotlink',
  title: 'Hotlink Topup RM10',
  description: 'Topup terus.',
  denominationRm: 10,
  tokenCost: 10,
  iconEmoji: '📱',
  stockQuantity: 5,
  maxPerMonthPerStudent: 2,
  voucherValidityDays: 90,
  deliveryMethod: 'instant',
  vendorSku: 'HL-10',
  displayOrder: 7,
  imageUrl: 'https://img.example/hl.png',
  termsText: 'Sah 90 hari.',
  isActive: true,
  requiresParentConsent: true,
  createdAt: '2026-09-26T11:46:00+08:00',
  updatedAt: '2026-09-26T11:46:00+08:00',
}

async function open(props: { mode: 'create' | 'edit'; id?: string }): Promise<VueWrapper> {
  const router = routerAt()
  await router.push('/admin/hadiah/baharu')
  await router.isReady()
  const w = mount(AdminHadiahForm, { props, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

const tid = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const input = (w: VueWrapper, id: string) => tid(w, id).element as HTMLInputElement
const submit = async (w: VueWrapper) => {
  await tid(w, 'hadiah-form').trigger('submit')
  await flushPromises()
}

async function fillRequired(w: VueWrapper) {
  await tid(w, 'hadiah-category').setValue('telco')
  await tid(w, 'hadiah-vendor').setValue('  Hotlink ')
  await tid(w, 'hadiah-title').setValue('Hotlink Topup RM10')
  await tid(w, 'hadiah-denomination').setValue('10')
  await tid(w, 'hadiah-token-cost').setValue('12')
}

beforeEach(() => {
  document.body.innerHTML = ''
  setActivePinia(createPinia())
  for (const f of Object.values(api)) f.mockReset()
})

describe('the fields (P07-02..14)', () => {
  it('has the exact labels, the hint and the placeholders', async () => {
    const w = await open({ mode: 'create' })
    const text = w.text()
    for (const label of [
      'Kategori',
      'Vendor',
      'Tajuk',
      'Penerangan',
      'Nilai (RM)',
      'Kos Token',
      'Emoji Icon',
      'Stok (kosong = tanpa had)',
      'Maks/bulan/pelajar',
      'Sah Hari (default 365)',
      'Delivery',
      'Vendor SKU (optional)',
      'Display Order',
      'Image URL (optional)',
      'Terma Khas',
      'Aktif',
    ]) {
      expect(text, label).toContain(label)
    }
    expect(text).toContain('100 syiling = 1 token = RM1')
    expect(input(w, 'hadiah-vendor').placeholder).toBe('cth: Roblox, Touch n Go, Hotlink')
    expect(input(w, 'hadiah-title').placeholder).toBe('cth: TnG eWallet RM50')
    // The five required fields carry the mark.
    expect(w.findAll('[data-ds="form-field"]').filter((f) => f.find('.text-error[aria-hidden="true"]').exists())).toHaveLength(5)
  })

  it('has the nine category words of OPT-HADIAH-KATEGORI, not the long form option of the SRS M15', async () => {
    const w = await open({ mode: 'create' })
    const options = tid(w, 'hadiah-category').findAll('option').map((o) => o.text())
    expect(options[0]).toBe('Pilih')
    expect(options.slice(1)).toEqual([
      '🏆 Mahkota',
      '💳 E-Wallet',
      '📱 Telco',
      '🎮 Gaming',
      '🎬 Streaming',
      '🍔 F&B',
      '🛒 E-Commerce',
      '📚 Pembelajaran',
      '🎭 Hiburan',
    ])
    expect(w.text()).not.toContain('RM500+')
  })

  it('offers Manual (admin paste) and Instant only, defaults to Manual, and has no API option', async () => {
    const w = await open({ mode: 'create' })
    expect(tid(w, 'hadiah-delivery').findAll('option').map((o) => o.text())).toEqual([
      'Manual (admin paste)',
      'Instant',
    ])
    expect(input(w, 'hadiah-delivery').value).toBe('manual')
    expect(w.text()).not.toContain('API')
  })

  it('starts with Aktif off, 365 days and display order 100, and has no consent field', async () => {
    const w = await open({ mode: 'create' })
    expect(tid(w, 'hadiah-active').attributes('aria-checked')).toBe('false')
    expect(input(w, 'hadiah-validity').value).toBe('365')
    expect(input(w, 'hadiah-order').value).toBe('100')
    expect(w.text()).not.toMatch(/kelulusan ibu bapa|consent/i)
  })
})

describe('create', () => {
  it('sends every field but the consent field, with the blank optional ones as null', async () => {
    api.createHadiah.mockResolvedValue(STORED)
    const w = await open({ mode: 'create' })
    await fillRequired(w)
    await submit(w)
    expect(api.createHadiah).toHaveBeenCalledTimes(1)
    const sent = api.createHadiah.mock.calls[0]![0]
    expect(sent).toEqual({
      category: 'telco',
      vendor: 'Hotlink',
      title: 'Hotlink Topup RM10',
      description: null,
      denominationRm: 10,
      tokenCost: 12,
      iconEmoji: null,
      stockQuantity: null,
      maxPerMonthPerStudent: null,
      voucherValidityDays: 365,
      deliveryMethod: 'manual',
      vendorSku: null,
      displayOrder: 100,
      imageUrl: null,
      termsText: null,
      isActive: false,
    })
    expect(sent).not.toHaveProperty('requiresParentConsent')
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('sends a decimal RM, the stock and the optional text as typed', async () => {
    api.createHadiah.mockResolvedValue(STORED)
    const w = await open({ mode: 'create' })
    await fillRequired(w)
    await tid(w, 'hadiah-denomination').setValue('0.5')
    await tid(w, 'hadiah-stock').setValue('0')
    await tid(w, 'hadiah-max-per-month').setValue('3')
    await tid(w, 'hadiah-icon').setValue('📱')
    await tid(w, 'hadiah-image').setValue('https://img.example/a.png')
    await tid(w, 'hadiah-delivery').setValue('instant')
    await tid(w, 'hadiah-description').setValue('Topup')
    await tid(w, 'hadiah-validity').setValue('')
    await submit(w)
    const sent = api.createHadiah.mock.calls[0]![0]
    expect(sent).toMatchObject({
      denominationRm: 0.5,
      stockQuantity: 0,
      maxPerMonthPerStudent: 3,
      iconEmoji: '📱',
      imageUrl: 'https://img.example/a.png',
      deliveryMethod: 'instant',
      description: 'Topup',
    })
    // A blank validity is left out for the server default.
    expect(sent).not.toHaveProperty('voucherValidityDays')
  })

  it('shows the server BM message at each field, marks it invalid, focuses the first and saves nothing', async () => {
    api.createHadiah.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: {
          category: 'Kategori diperlukan.',
          vendor: 'Vendor diperlukan.',
          title: 'Tajuk diperlukan.',
          denominationRm: 'Nilai (RM) diperlukan.',
          tokenCost: 'Kos Token diperlukan.',
        },
      }),
    )
    const w = await open({ mode: 'create' })
    await submit(w)
    const messages = w.findAll('[data-testid="field-error"]').map((e) => e.text())
    expect(messages).toEqual([
      'Kategori diperlukan.',
      'Vendor diperlukan.',
      'Tajuk diperlukan.',
      'Nilai (RM) diperlukan.',
      'Kos Token diperlukan.',
    ])
    expect(tid(w, 'hadiah-vendor').attributes('aria-invalid')).toBe('true')
    expect(w.emitted('saved')).toBeUndefined()
    // The focus lands in the first field that needs a fix (the category control).
    expect(w.findAll('[data-ds="form-field"]')[0]!.element.contains(document.activeElement)).toBe(true)
  })

  it('shows the message of a limit the server refused (length, range) at its field', async () => {
    api.createHadiah.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: {
          vendor: 'Vendor tidak boleh melebihi 60 aksara.',
          tokenCost: 'Kos Token mesti antara 1 dan 100000.',
          imageUrl: 'Format Image URL tidak sah.',
          stockQuantity: 'Stok tidak sah.',
        },
      }),
    )
    const w = await open({ mode: 'create' })
    await fillRequired(w)
    await submit(w)
    const text = w.text()
    for (const m of [
      'Vendor tidak boleh melebihi 60 aksara.',
      'Kos Token mesti antara 1 dan 100000.',
      'Format Image URL tidak sah.',
      'Stok tidak sah.',
    ]) {
      expect(text).toContain(m)
    }
  })

  it('a failure with no field shows its message in the form and keeps what was typed', async () => {
    api.createHadiah.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Maaf, ralat pelayan.' }))
    const w = await open({ mode: 'create' })
    await fillRequired(w)
    await submit(w)
    expect(tid(w, 'hadiah-failure').text()).toContain('Maaf, ralat pelayan.')
    expect(input(w, 'hadiah-title').value).toBe('Hotlink Topup RM10')
  })

  it('sends one request for a double submit', async () => {
    let release: (v: HadiahReward) => void = () => undefined
    api.createHadiah.mockReturnValue(new Promise<HadiahReward>((r) => (release = r)))
    const w = await open({ mode: 'create' })
    await fillRequired(w)
    await submit(w)
    await submit(w)
    expect(api.createHadiah).toHaveBeenCalledTimes(1)
    release(STORED)
    await flushPromises()
  })

  it('says Tambah on the button, and Batal goes back to the list', async () => {
    const w = await open({ mode: 'create' })
    expect(tid(w, 'form-submit').text()).toBe('Tambah')
    expect(tid(w, 'form-cancel').attributes('href')).toBe('/admin/hadiah')
  })
})

describe('edit', () => {
  it('reads the reward and fills every control', async () => {
    api.fetchHadiah.mockResolvedValue(STORED)
    const w = await open({ mode: 'edit', id: '17' })
    expect(api.fetchHadiah).toHaveBeenCalledWith('17', expect.objectContaining({ signal: expect.anything() }))
    expect(input(w, 'hadiah-category').value).toBe('telco')
    expect(input(w, 'hadiah-vendor').value).toBe('Hotlink')
    expect(input(w, 'hadiah-title').value).toBe('Hotlink Topup RM10')
    expect(input(w, 'hadiah-description').value).toBe('Topup terus.')
    expect(input(w, 'hadiah-denomination').value).toBe('10')
    expect(input(w, 'hadiah-token-cost').value).toBe('10')
    expect(input(w, 'hadiah-stock').value).toBe('5')
    expect(input(w, 'hadiah-max-per-month').value).toBe('2')
    expect(input(w, 'hadiah-validity').value).toBe('90')
    expect(input(w, 'hadiah-delivery').value).toBe('instant')
    expect(input(w, 'hadiah-sku').value).toBe('HL-10')
    expect(input(w, 'hadiah-order').value).toBe('7')
    expect(input(w, 'hadiah-image').value).toBe('https://img.example/hl.png')
    expect(input(w, 'hadiah-terms').value).toBe('Sah 90 hari.')
    expect(tid(w, 'form-submit').text()).toBe('Simpan')
    expect(w.text()).toContain('Edit Hadiah')
  })

  it('replaces with every field, keeps an unlimited stock as null, and never sends the stored consent flag', async () => {
    api.fetchHadiah.mockResolvedValue({ ...STORED, stockQuantity: null, maxPerMonthPerStudent: null })
    api.updateHadiah.mockResolvedValue(STORED)
    const w = await open({ mode: 'edit', id: '17' })
    await tid(w, 'hadiah-title').setValue('Hotlink Topup RM12')
    await submit(w)
    expect(api.updateHadiah).toHaveBeenCalledWith('17', {
      category: 'telco',
      vendor: 'Hotlink',
      title: 'Hotlink Topup RM12',
      description: 'Topup terus.',
      denominationRm: 10,
      tokenCost: 10,
      iconEmoji: '📱',
      stockQuantity: null,
      maxPerMonthPerStudent: null,
      voucherValidityDays: 90,
      deliveryMethod: 'instant',
      vendorSku: 'HL-10',
      displayOrder: 7,
      imageUrl: 'https://img.example/hl.png',
      termsText: 'Sah 90 hari.',
      isActive: true,
    })
    expect(api.createHadiah).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('shows a stored delivery of api as Manual, so the write is accepted', async () => {
    api.fetchHadiah.mockResolvedValue({ ...STORED, deliveryMethod: 'api' })
    api.updateHadiah.mockResolvedValue(STORED)
    const w = await open({ mode: 'edit', id: '17' })
    expect(input(w, 'hadiah-delivery').value).toBe('manual')
    await submit(w)
    expect(api.updateHadiah.mock.calls[0]![1]).toMatchObject({ deliveryMethod: 'manual' })
  })

  it('a reward that is not found shows the server message with a retry and no form', async () => {
    api.fetchHadiah.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Hadiah tidak dijumpai.' }))
    const w = await open({ mode: 'edit', id: '999' })
    expect(w.text()).toContain('Hadiah tidak dijumpai.')
    expect(tid(w, 'hadiah-form').exists()).toBe(false)
  })

  it('shows a loading state, not an empty form, while the reward is read', async () => {
    api.fetchHadiah.mockReturnValue(new Promise(() => undefined))
    const w = await open({ mode: 'edit', id: '17' })
    expect(tid(w, 'hadiah-form').exists()).toBe(false)
    expect(w.find('[data-state="loading"]').exists()).toBe(true)
  })
})
