// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError, api } from '@/api'
import { useSessionStore } from '@/stores/session'

import type { ClientSession } from '../../api'
import RegisterPage from '../../pages/RegisterPage.vue'
import { PENDING_REF_KEY, clearPendingRef, setPendingRef } from '../../lib/pending-ref'

const apiMocks = vi.hoisted(() => ({ register: vi.fn() }))
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  register: apiMocks.register,
}))

const SESSION: ClientSession = {
  token: 'tok',
  remember: false,
  expiresAt: '2099-01-01T00:00:00+08:00',
  user: {
    id: 9000001,
    name: 'Murid Baru',
    email: 'baru@demo.test',
    phone: null,
    role: 'student',
    grade: 10,
    schoolId: null,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-09-30T09:00:00+08:00',
    updatedAt: '2026-09-30T09:00:00+08:00',
    lastLoginAt: null,
    school: null,
    landingPath: '/dashboard',
  },
}

const SCHOOLS = [
  {
    id: 900001,
    name: 'SMK DEMO',
    code: 'BEA4001',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD PETALING UTAMA',
    city: null,
  },
]

let wrapper: VueWrapper | null = null
let router: Router
const getSpy = vi.spyOn(api, 'get')

async function render(path = '/register'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', component: RegisterPage },
      { path: '/dashboard', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  wrapper = mount(RegisterPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function fillRequired(w: VueWrapper): Promise<void> {
  await w.get('[data-testid=register-name]').setValue('Murid Baru')
  await w.get('[data-testid=register-email]').setValue('baru@demo.test')
  await w.get('[data-testid=register-password]').setValue('rahsia1')
  await w.get('[data-testid=register-password-confirm]').setValue('rahsia1')
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  clearPendingRef()
  setActivePinia(createPinia())
  apiMocks.register.mockReset()
  getSpy.mockReset()
  getSpy.mockResolvedValue(SCHOOLS)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  wrapper?.unmount()
  wrapper = null
})

describe('RegisterPage (M01 S2)', () => {
  it('renders the fields in order with the live attributes (FR-M01-16, 21, 23)', async () => {
    const w = await render()
    const attrs = (id: string) => w.get(`[data-testid=${id}]`).attributes()
    expect(attrs('register-name')).toMatchObject({
      required: '',
      placeholder: 'Muhammad Fulan bin Fulan',
    })
    expect(attrs('register-email')).toMatchObject({ type: 'email', required: '' })
    expect(attrs('register-phone')).toMatchObject({
      type: 'tel',
      maxlength: '14',
      inputmode: 'tel',
      placeholder: 'Cth: 0191234567',
    })
    expect(attrs('register-ic')).toMatchObject({
      maxlength: '14',
      inputmode: 'numeric',
      placeholder: 'Cth: 031215101234',
    })
    expect(attrs('register-password')).toMatchObject({ required: '', type: 'password' })
    expect(attrs('register-password-confirm')).toMatchObject({ required: '', type: 'password' })
    expect(w.text()).toContain('Minimum 6 aksara')
    expect(w.text()).toContain('Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan.')
    expect(w.get('form').attributes('novalidate')).toBeUndefined()
  })

  it('shows the static 1-2-3 step indicator with only step 1 active (FR-M01-15)', async () => {
    const w = await render()
    const steps = w.findAll('[data-testid=register-steps] span[data-active]')
    expect(steps.map((s) => [s.text(), s.attributes('data-active')])).toEqual([
      ['1', 'true'],
      ['2', 'false'],
      ['3', 'false'],
    ])
  })

  it('offers three role cards, Pelajar selected; Guru and Ibu Bapa hide level and IC (FR-M01-19..21)', async () => {
    const w = await render()
    expect(w.get('[data-testid=role-student]').attributes('data-selected')).toBe('true')
    expect(w.find('[data-testid=register-levels]').exists()).toBe(true)
    expect(w.find('[data-testid=register-ic]').exists()).toBe(true)

    await w.get('[data-testid=role-teacher]').trigger('click')
    expect(w.get('[data-testid=role-teacher]').attributes('data-selected')).toBe('true')
    expect(w.find('[data-testid=register-levels]').exists()).toBe(false)
    expect(w.find('[data-testid=register-ic]').exists()).toBe(false)

    await w.get('[data-testid=role-parent]').trigger('click')
    expect(w.find('[data-testid=register-levels]').exists()).toBe(false)
    expect(w.find('[data-testid=register-ic]').exists()).toBe(false)

    await w.get('[data-testid=role-student]').trigger('click')
    expect(w.find('[data-testid=register-levels]').exists()).toBe(true)
  })

  it('lists only Ting. 1-5 (values 7-11), no Darjah, none selected (FR-M01-20)', async () => {
    const w = await render()
    const ids = w.findAll('[data-testid^=grade-]').map((g) => g.attributes('data-testid'))
    expect(ids).toEqual([7, 8, 9, 10, 11].map((n) => `grade-${String(n)}`))
    expect(w.findAll('[data-selected=true][data-testid^=grade-]')).toHaveLength(0)
    expect(w.text()).not.toContain('Sekolah Rendah')
    expect(w.text()).not.toContain('Darjah')
    expect(w.text()).toContain('Sekolah Menengah')
    await w.get('[data-testid=grade-10]').trigger('click')
    expect(w.get('[data-testid=grade-10]').text()).toBe('Ting.4')
    expect(w.findAll('[data-selected=true][data-testid^=grade-]')).toHaveLength(1)
  })

  it('does not change for ?role= and ?ref= (FR-M01-18) and carries ref in the background (FR-M01-70)', async () => {
    const w = await render('/register?role=teacher&ref=4JURJTT')
    expect(w.get('[data-testid=role-student]').attributes('data-selected')).toBe('true')
    expect(w.find('input[type=hidden]').exists()).toBe(false)
    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe('4JURJTT')

    apiMocks.register.mockResolvedValue(SESSION)
    await fillRequired(w)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.register).toHaveBeenCalledWith(
      expect.objectContaining({ referralCode: '4JURJTT' }),
    )
    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull()
  })

  it('submits the student payload with grade n / n+6 and stores the session (FR-M01-24, 25)', async () => {
    apiMocks.register.mockResolvedValue(SESSION)
    const w = await render()
    await fillRequired(w)
    await w.get('[data-testid=register-phone]').setValue('0191234567')
    await w.get('[data-testid=register-ic]').setValue('031215101234')
    await w.get('[data-testid=grade-10]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiMocks.register).toHaveBeenCalledWith({
      name: 'Murid Baru',
      email: 'baru@demo.test',
      phone: '0191234567',
      role: 'student',
      grade: 10,
      icNumber: '031215101234',
      schoolId: null,
      password: 'rahsia1',
      passwordConfirmation: 'rahsia1',
      referralCode: null,
    })
    expect(useSessionStore().user?.id).toBe(9000001)
    expect(router.currentRoute.value.fullPath).toBe('/dashboard')
  })

  it('omits grade and IC for a teacher (FR-M01-20)', async () => {
    apiMocks.register.mockResolvedValue(SESSION)
    const w = await render()
    await w.get('[data-testid=role-teacher]').trigger('click')
    await fillRequired(w)
    await w.get('form').trigger('submit')
    await flushPromises()
    const body = apiMocks.register.mock.calls[0]?.[0] as Record<string, unknown>
    expect(body.role).toBe('teacher')
    expect('grade' in body).toBe(false)
    expect('icNumber' in body).toBe(false)
  })

  describe('teacher registration (pending verification, AM2-N1)', () => {
    const PENDING = {
      status: 'pending_verification',
      message:
        'Pendaftaran diterima. Akaun guru anda akan diaktifkan selepas disahkan oleh pentadbir sekolah.',
    }

    it('shows the server message and a login link, stores no session and does not navigate', async () => {
      apiMocks.register.mockResolvedValue(PENDING)
      const w = await render()
      const setSession = vi.spyOn(useSessionStore(), 'setSession')
      setPendingRef('4JURJTT')
      await w.get('[data-testid=role-teacher]').trigger('click')
      await fillRequired(w)
      await w.get('form').trigger('submit')
      await flushPromises()

      expect(setSession).not.toHaveBeenCalled()
      expect(useSessionStore().user).toBeNull()
      expect(router.currentRoute.value.fullPath).toBe('/register')
      expect(localStorage.getItem('pp.auth')).toBeNull()
      expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull()

      expect(w.find('[data-testid=register-name]').exists()).toBe(false)
      expect(w.find('[data-testid=register-submit]').exists()).toBe(false)
      expect(w.find('[data-testid=register-alert]').exists()).toBe(false)
      const message = w.get('[data-testid=register-pending-message]')
      expect(message.attributes('data-variant')).toBe('success')
      expect(message.text()).toBe(PENDING.message)
      expect(w.get('[data-testid=register-login-link]').attributes('href')).toBe('/login')
    })

    it('labels the school required for a teacher only', async () => {
      const w = await render()
      const label = () => w.get('[data-testid=register-school-label]').text()
      const search = () => w.get('[data-testid=register-school-search]').attributes()
      expect(label()).toBe('Sekolah (Pilihan)')
      expect(search().required).toBeUndefined()
      await w.get('[data-testid=role-teacher]').trigger('click')
      expect(label()).toBe('Sekolah')
      expect(search().required).toBeDefined()
      await w.get('[data-testid=role-parent]').trigger('click')
      expect(label()).toBe('Sekolah (Pilihan)')
      expect(search().required).toBeUndefined()
    })
  })

  it('shows the loading label, then the server errors, keeping values but clearing passwords (FR-M01-26)', async () => {
    let reject!: (err: unknown) => void
    apiMocks.register.mockReturnValue(new Promise((_, r) => (reject = r)))
    const w = await render()
    await fillRequired(w)
    await w.get('[data-testid=grade-9]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=register-submit]').text()).toBe('Sedang Mendaftar...')
    expect(w.get('[data-testid=register-submit]').attributes('disabled')).toBeDefined()

    reject(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: {
          email: 'The email has already been taken.',
          password: 'The password field confirmation does not match.',
        },
      }),
    )
    await flushPromises()
    expect(
      w
        .get('[data-testid=register-alert]')
        .findAll('p')
        .map((p) => p.text()),
    ).toEqual([
      'The email has already been taken.',
      'The password field confirmation does not match.',
    ])
    expect((w.get('[data-testid=register-name]').element as HTMLInputElement).value).toBe(
      'Murid Baru',
    )
    expect((w.get('[data-testid=register-email]').element as HTMLInputElement).value).toBe(
      'baru@demo.test',
    )
    expect((w.get('[data-testid=register-password]').element as HTMLInputElement).value).toBe('')
    expect(
      (w.get('[data-testid=register-password-confirm]').element as HTMLInputElement).value,
    ).toBe('')
    expect(w.get('[data-testid=grade-9]').attributes('data-selected')).toBe('true')
    expect(w.get('[data-testid=register-submit]').text()).toBe('Daftar Sekarang')
  })

  describe('school picker (FR-M01-22)', () => {
    it('lists the 16 states with the short register labels', async () => {
      const w = await render()
      const options = w.findAll('[data-testid=register-state] option').map((o) => o.text())
      expect(options).toHaveLength(17)
      expect(options[0]).toBe('Negeri')
      expect(options).toEqual(
        expect.arrayContaining(['KL', 'N.Sembilan', 'P.Pinang', 'Johor', 'Terengganu']),
      )
    })

    it('searches after 300 ms from 2 characters with limit 15, and shows "{type} · {state} · {district}"', async () => {
      const w = await render()
      const input = w.get('[data-testid=register-school-search]')
      await input.trigger('focus')
      await input.setValue('d')
      await vi.advanceTimersByTimeAsync(400)
      expect(getSpy).not.toHaveBeenCalled()

      await input.setValue('de')
      await vi.advanceTimersByTimeAsync(299)
      expect(getSpy).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await flushPromises()
      expect(getSpy).toHaveBeenCalledWith(
        '/api/schools/search',
        expect.objectContaining({ query: { q: 'de', state: null, limit: 15, id: null } }),
      )
      const rows = w.findAll('[data-testid=school-option]')
      expect(rows).toHaveLength(1)
      expect(rows[0]?.text()).toContain('SMK DEMO')
      expect(rows[0]?.text()).toContain('SMK · Selangor · PPD PETALING UTAMA')
    })

    it("loads a state's schools with an empty query (state value = full name)", async () => {
      const w = await render()
      await w.get('[data-testid=register-state]').setValue('Kuala Lumpur')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(getSpy).toHaveBeenCalledWith(
        '/api/schools/search',
        expect.objectContaining({ query: { q: null, state: 'Kuala Lumpur', limit: 15, id: null } }),
      )
      await w.get('[data-testid=register-school-search]').trigger('focus')
      expect(w.findAll('[data-testid=school-option]')).toHaveLength(1)
    })

    it('shows "Tiada sekolah dijumpai" for a query with no results', async () => {
      getSpy.mockResolvedValue([])
      const w = await render()
      const input = w.get('[data-testid=register-school-search]')
      await input.trigger('focus')
      await input.setValue('zzz')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(w.get('[data-testid=school-empty]').text()).toBe('Tiada sekolah dijumpai')
    })

    it('picks a row into the chip "{type} · {state}", sends schoolId, and ✕ restores the inputs', async () => {
      apiMocks.register.mockResolvedValue(SESSION)
      const w = await render()
      const input = w.get('[data-testid=register-school-search]')
      await input.trigger('focus')
      await input.setValue('demo')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      await w.get('[data-testid=school-option]').trigger('click')

      const chip = w.get('[data-testid=school-chip]')
      expect(chip.text()).toContain('SMK DEMO')
      expect(chip.text()).toContain('SMK · Selangor')
      expect(chip.text()).not.toContain('PPD')
      expect(w.find('[data-testid=register-state]').exists()).toBe(false)
      expect(w.find('[data-testid=register-school-search]').exists()).toBe(false)

      await fillRequired(w)
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(apiMocks.register).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 900001 }))

      await w.get('[data-testid=school-clear]').trigger('click')
      expect(w.find('[data-testid=school-chip]').exists()).toBe(false)
      expect(w.find('[data-testid=register-state]').exists()).toBe(true)
      expect(w.find('[data-testid=register-school-search]').exists()).toBe(true)
    })

    it('closes the dropdown on a click outside', async () => {
      const w = await render()
      const input = w.get('[data-testid=register-school-search]')
      await input.trigger('focus')
      await input.setValue('demo')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(w.find('[data-testid=school-dropdown]').exists()).toBe(true)
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
      expect(w.find('[data-testid=school-dropdown]').exists()).toBe(false)
    })
  })

  it('has independent eye toggles on the two password fields (FR-M01-04)', async () => {
    const w = await render()
    await w.get('[data-testid=register-password-toggle]').trigger('click')
    expect(w.get('[data-testid=register-password]').attributes('type')).toBe('text')
    expect(w.get('[data-testid=register-password-confirm]').attributes('type')).toBe('password')
  })

  it('links to login, sponsor register and home (FR-M01-17)', async () => {
    const w = await render()
    const links = w.findAll('form a').map((a) => [a.text(), a.attributes('href')])
    expect(links).toEqual([
      ['Sudah ada akaun? Log Masuk 🔑', '/login'],
      ['Mewakili organisasi? Daftar sebagai Penaja', '/sponsor/register'],
      ['Kembali ke Laman Utama', '/'],
    ])
  })
})
