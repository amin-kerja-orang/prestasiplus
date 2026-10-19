// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { UserSettings } from '../../api'
import TetapanPage from '../../pages/TetapanPage.vue'

const apiMocks = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn() }))
vi.mock('../../api', () => apiMocks)

const DEFAULTS: UserSettings = {
  spiritualMode: false,
  showBismillahSplash: false,
  subuhPushEnabled: false,
  subuhPushTime: '05:30',
  ramadanModeEnabled: false,
  sahurPushTime: '04:30',
  faith: null,
}

let wrapper: VueWrapper | null = null

/** Reka selects have no native `<select>`: the value is driven through the component. */
const selectOf = (w: VueWrapper) => w.findComponent({ name: 'Select' })

async function render(): Promise<VueWrapper> {
  wrapper = mount(TetapanPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  apiMocks.getSettings.mockResolvedValue({ ...DEFAULTS })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
})

describe('TetapanPage', () => {
  it('shows the defaults (BR-17) and the exact copy', async () => {
    const w = await render()
    expect(w.text()).toContain('⚙️ Tetapan Peribadi')
    expect(w.text()).toContain(
      'Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda.',
    )
    expect(w.text()).toContain('🕌 Mod Rohani')
    expect(w.text()).toContain('🌍 Latar Agama (opsyen)')
    for (const id of [
      'spiritual_mode',
      'show_bismillah_splash',
      'subuh_push_enabled',
      'ramadan_mode_enabled',
    ]) {
      expect(w.get(`[data-testid="tetapan-${id}"]`).attributes('aria-checked')).toBe('false')
    }
    expect(
      (w.get('[data-testid="tetapan-subuh_push_enabled-time"]').element as HTMLInputElement).value,
    ).toBe('05:30')
    expect(
      (w.get('[data-testid="tetapan-ramadan_mode_enabled-time"]').element as HTMLInputElement)
        .value,
    ).toBe('04:30')
    const faith = w.get('[data-testid="tetapan-faith"]')
    expect(faith.text()).toContain('— Tidak nyatakan —')
    expect(selectOf(w).props('items').map((o: { label: string }) => o.label)).toEqual([
      '— Tidak nyatakan —',
      'Islam',
      'Hindu',
      'Buddha',
      'Kristian',
      'Tiada',
    ])
  })

  it('shows a loaded non-null faith as selected', async () => {
    apiMocks.getSettings.mockResolvedValue({ ...DEFAULTS, faith: 'buddhist' })
    const w = await render()
    expect(w.get('[data-testid="tetapan-faith"]').text()).toContain('Buddha')
  })

  it('disables the button while saving and keeps its label', async () => {
    let finish: (v: unknown) => void = () => undefined
    apiMocks.saveSettings.mockReturnValue(new Promise((r) => (finish = r)))
    const w = await render()
    await w.get('form').trigger('submit')
    const btn = w.get('[data-testid="tetapan-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.text()).toContain('Simpan Tetapan')
    finish({ data: DEFAULTS, status: 'ok' })
    await flushPromises()
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps the time inputs enabled whatever the checkbox (no dependency)', async () => {
    const w = await render()
    const time = w.get('[data-testid="tetapan-subuh_push_enabled-time"]')
    expect((time.element as HTMLInputElement).disabled).toBe(false)
  })

  it('sends every field on save and shows the saved status', async () => {
    const saved: UserSettings = {
      ...DEFAULTS,
      spiritualMode: true,
      faith: 'muslim',
      subuhPushTime: '05:45',
    }
    apiMocks.saveSettings.mockResolvedValue({ data: saved, status: 'Tetapan berjaya disimpan.' })
    const w = await render()
    await w.get('[data-testid="tetapan-spiritual_mode"]').trigger('click')
    await w.get('[data-testid="tetapan-subuh_push_enabled-time"]').setValue('05:45')
    selectOf(w).vm.$emit('update:modelValue', 'muslim')
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.saveSettings).toHaveBeenCalledWith({
      spiritualMode: true,
      showBismillahSplash: false,
      subuhPushEnabled: false,
      subuhPushTime: '05:45',
      ramadanModeEnabled: false,
      sahurPushTime: '04:30',
      faith: 'muslim',
    })
    const box = w.get('[data-testid="tetapan-status"]')
    expect(box.text()).toContain('Tetapan berjaya disimpan.')
    expect(box.attributes('data-variant')).toBe('success')
  })

  it('sends faith null when "Tidak nyatakan" is chosen', async () => {
    apiMocks.saveSettings.mockResolvedValue({ data: DEFAULTS, status: 'ok' })
    const w = await render()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.saveSettings.mock.calls[0]?.[0]).toMatchObject({ faith: null })
  })

  it('shows the red alert when saving fails and keeps the input', async () => {
    apiMocks.saveSettings.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { subuhPushTime: 'Waktu tidak sah.' },
      }),
    )
    const w = await render()
    await w.get('[data-testid="tetapan-spiritual_mode"]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="tetapan-alert"]').text()).toContain('Waktu tidak sah.')
    expect(w.get('[data-testid="tetapan-spiritual_mode"]').attributes('aria-checked')).toBe('true')
  })

  it('shows the error and a retry when loading fails', async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error('boom'))
    const w = await render()
    expect(w.get('[data-testid="tetapan-alert"]').text()).toContain(
      'Ralat berlaku. Sila cuba lagi.',
    )
    expect(w.find('[data-testid="tetapan-form"]').exists()).toBe(false)
    await w.get('[data-testid="tetapan-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="tetapan-form"]').exists()).toBe(true)
  })
})
