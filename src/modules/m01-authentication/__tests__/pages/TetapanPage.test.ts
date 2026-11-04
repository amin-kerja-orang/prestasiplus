// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useSessionStore } from '@/stores/session'

import type { Role, UserMe, UserSettings } from '../../api'
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
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }] })
  await router.push('/tetapan')
  wrapper = mount(TetapanPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  // No signed-in user here: the page must work without the account block (the block has its own test).
  vi.spyOn(useSessionStore(), 'refreshUser').mockResolvedValue(null)
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

/** "Tetapan Akaun" (S5-T05 part C; R1-MUR-A2, R1-GUR-A2, R1-AS-A2): read-only rows from the cached `GET /api/me` user. */
describe('TetapanPage "Tetapan Akaun" block', () => {
  const ME: UserMe = {
    id: 7,
    name: 'Pengguna Demo',
    email: 'pengguna@demo.test',
    phone: '0123456789',
    role: 'teacher',
    grade: null,
    schoolId: 8101,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-02-06T09:00:00+08:00',
    updatedAt: '2026-02-06T09:00:00+08:00',
    lastLoginAt: null,
    school: { id: 8101, name: 'SMK DEMO', code: 'ABA0001', type: 'SMK', state: 'Selangor', district: 'PPD PETALING UTAMA', city: 'Petaling Jaya' },
    landingPath: '/guru',
  }

  function signIn(user: UserMe): void {
    useSessionStore().setSession({ token: 't', remember: false, expiresAt: '2099-01-01T00:00:00+08:00', user })
  }
  const row = (w: VueWrapper, key: string) => w.get(`[data-testid="account-${key}"]`).text()

  it.each<[Role, string]>([
    ['student', 'Pelajar'],
    ['teacher', 'Guru'],
    ['school_admin', 'Admin Sekolah'],
    ['admin', 'Admin'],
  ])('shows e-mel, telefon, sekolah and peranan for %s ("%s") above Mod Rohani', async (role, label) => {
    signIn({ ...ME, role })
    const w = await render()
    expect(w.get('[data-testid="account-title"]').text()).toBe('Tetapan Akaun')
    expect(row(w, 'email')).toBe('pengguna@demo.test')
    expect(row(w, 'phone')).toBe('0123456789')
    expect(row(w, 'school')).toBe('SMK DEMO')
    expect(row(w, 'role')).toBe(label)
    const labels = w.findAll('[data-testid="account-rows"] dt').map((d) => d.text())
    expect(labels).toEqual(['📧 E-mel', '📱 Telefon', '🏫 Sekolah', '👤 Peranan'])
    const html = w.html()
    expect(html.indexOf('data-testid="account-panel"')).toBeLessThan(html.indexOf('data-testid="tetapan-form"'))
  })

  it('shows "—" for an empty telefon and no school, and invents no status row', async () => {
    signIn({ ...ME, phone: null, school: null, schoolId: null })
    const w = await render()
    expect(row(w, 'phone')).toBe('—')
    expect(row(w, 'school')).toBe('—')
    expect(w.find('[data-testid="account-status"]').exists()).toBe(false)
    const panel = w.get('[data-testid="account-panel"]').text()
    expect(panel).not.toContain('Status')
    expect(panel).not.toContain('Aktif')
  })

  it('refreshes the user from GET /api/me when the page opens', async () => {
    signIn(ME)
    await render()
    expect(useSessionStore().refreshUser).toHaveBeenCalledTimes(1)
  })

  it('the footer note: pupil gets the OQ-MUR-9 text, the teacher a link to /guru/profil/edit, the school admin a link to /profile', async () => {
    signIn({ ...ME, role: 'student' })
    let w = await render()
    expect(w.get('[data-testid="account-note"]').text()).toBe('Untuk menukar e-mel, telefon atau sekolah, hubungi guru atau pentadbir sekolah anda.')
    w.unmount()
    signIn({ ...ME, role: 'teacher' })
    w = await render()
    expect(w.get('[data-testid="account-note"]').text()).toBe('Untuk menukar maklumat akaun, buka Profil Saya.')
    expect(w.get('[data-testid="account-note-link"]').attributes('href')).toBe('/guru/profil/edit')
    w.unmount()
    signIn({ ...ME, role: 'school_admin' })
    w = await render()
    expect(w.get('[data-testid="account-note-link"]').attributes('href')).toBe('/profile')
  })

  it('has no account block without a user (the form still works)', async () => {
    const w = await render()
    expect(w.find('[data-testid="account-panel"]').exists()).toBe(false)
    expect(w.find('[data-testid="tetapan-form"]').exists()).toBe(true)
  })
})
