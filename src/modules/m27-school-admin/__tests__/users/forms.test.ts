// @vitest-environment jsdom
/**
 * M27 S9, S10, S11 and S12 component tests (SRS M27 Part B FR-M27-94 to 98, 104 to 110, 117, 118, 120; BR-M27-33,
 * 34, 41; AC 27.x, 29.x, 30.x, 34.x) against a mocked client: exact copy, fields, the reset bar, save order, error
 * display, the 404 / 403 outcomes, the locked school label, the one-time credential block.
 */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useFlashStore } from '@/stores/flash'

import type { SchoolPupilFormOptions } from '../../api/school-admin'
import CiptaGuruPage from '../../pages/CiptaGuruPage.vue'
import EditGuruPage from '../../pages/EditGuruPage.vue'
import EditPelajarPage from '../../pages/EditPelajarPage.vue'
import TambahPelajarPage from '../../pages/TambahPelajarPage.vue'
import { detail, has, mountAt, text } from './helpers'

const api = vi.hoisted(() => ({
  fetchSchoolPupil: vi.fn(),
  fetchSchoolTeacher: vi.fn(),
  updateSchoolPupil: vi.fn(),
  updateSchoolTeacher: vi.fn(),
  resetSchoolPupilPassword: vi.fn(),
  resetSchoolTeacherPassword: vi.fn(),
  createSchoolTeacher: vi.fn(),
  createSchoolPupil: vi.fn(),
  fetchSchoolPupilFormOptions: vi.fn(),
}))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  ...api,
}))

const validation = (fields: Record<string, string>) =>
  new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Data tidak sah.', fields })

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  setRouteOutcome(null)
})

describe('S9 Edit Pelajar (FR-M27-94 to 98)', () => {
  async function open(id = 3001) {
    api.fetchSchoolPupil.mockResolvedValue(detail())
    return mountAt(EditPelajarPage, `/admin-sekolah/pelajar/${id}`, { id })
  }

  it('loads the pupil by id and shows the profile card with "Daftar" and "Kemaskini" dates', async () => {
    const { wrapper: w } = await open()
    expect(api.fetchSchoolPupil).toHaveBeenCalledWith(3001, expect.anything())
    expect(text(w, 'user-profile-name')).toBe('Murid Contoh Satu')
    expect(text(w, 'user-profile-email')).toBe('murid1@demo.test')
    expect(text(w, 'user-profile-created')).toBe('Daftar: 04/03/2026')
    expect(text(w, 'user-profile-updated')).toBe('Kemaskini: 05/04/2026 14:07')
  })

  it('shows the three fields, the read-only status line and the footer; no role, school, grade, IC or security card', async () => {
    const { wrapper: w } = await open()
    const labels = w.findAll('label').map((l) => l.text().replace(/\s+/g, ' ').trim())
    expect(labels).toEqual([
      'Nama *',
      'Emel *',
      'No. Telefon (Pilihan)',
      'Kata Laluan Baru',
      'Sahkan Kata Laluan Baru',
    ])
    expect((w.get('[data-testid="user-name"]').element as HTMLInputElement).value).toBe('Murid Contoh Satu')
    expect((w.get('[data-testid="user-phone"]').element as HTMLInputElement).value).toBe('0191234567')
    expect(text(w, 'user-status-line')).toBe('Status Aktif')
    expect(has(w, 'user-status-line')).toBe(true)
    expect(w.text()).not.toMatch(/Peranan|Sekolah|Tingkatan|Kad Pengenalan|Nota Keselamatan/)
    expect(w.find('select').exists()).toBe(false)
    expect(text(w, 'user-cancel')).toBe('Batal')
    expect(text(w, 'user-submit')).toBe('Kemaskini')
    expect(w.get('[data-testid="user-cancel"]').attributes('href')).toBe('/admin-sekolah/pelajar')
  })

  it('has the amber bar "Reset Kata Laluan" closed by default, with its sub-line, placeholders and hint', async () => {
    const { wrapper: w } = await open()
    const toggle = w.get('[data-testid="user-password-toggle"]')
    expect(toggle.text()).toContain('Reset Kata Laluan')
    expect(toggle.text()).toContain('Klik untuk buka bahagian reset kata laluan')
    expect(toggle.text()).not.toContain('Tukar Kata Laluan')
    const panel = w.get('[data-testid="user-password-panel"]')
    expect(panel.attributes('style')).toContain('display: none')
    await toggle.trigger('click')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
    expect(w.get('[data-testid="user-new-password"]').attributes('placeholder')).toBe('Minimum 6 aksara')
    expect(w.get('[data-testid="user-new-password-confirm"]').attributes('placeholder')).toBe(
      'Taip semula kata laluan baru',
    )
    expect(panel.text()).toContain(
      'Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta.',
    )
  })

  it('saves name, e-mail and phone only, flashes the status and returns to S6', async () => {
    api.updateSchoolPupil.mockResolvedValue({ data: detail(), status: 'Pengguna berjaya dikemaskini.' })
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-name"]').setValue('Nama Baharu')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.updateSchoolPupil).toHaveBeenCalledWith(3001, {
      name: 'Nama Baharu',
      email: 'murid1@demo.test',
      phone: '0191234567',
    })
    expect(api.resetSchoolPupilPassword).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Pengguna berjaya dikemaskini.' })
  })

  it('sends a typed new password in the same PUT (one call, no reset call)', async () => {
    api.updateSchoolPupil.mockResolvedValue({ data: detail(), status: 'ok' })
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-password-toggle"]').trigger('click')
    await w.get('[data-testid="user-new-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-new-password-confirm"]').setValue('rahsia123')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.updateSchoolPupil).toHaveBeenCalledTimes(1)
    expect(api.updateSchoolPupil).toHaveBeenCalledWith(3001, {
      name: 'Murid Contoh Satu',
      email: 'murid1@demo.test',
      phone: '0191234567',
      newPassword: 'rahsia123',
      newPasswordConfirmation: 'rahsia123',
    })
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar')
  })

  it('shows validation errors above the form, keeps the values and clears the passwords; no navigation', async () => {
    api.updateSchoolPupil.mockRejectedValue(validation({ email: 'Emel telah digunakan.' }))
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-password-toggle"]').trigger('click')
    await w.get('[data-testid="user-new-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-name"]').setValue('Nama Baharu')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(text(w, 'user-form-alert')).toContain('Emel telah digunakan.')
    expect((w.get('[data-testid="user-name"]').element as HTMLInputElement).value).toBe('Nama Baharu')
    expect((w.get('[data-testid="user-new-password"]').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar/3001')
    expect(useFlashStore().pending).toBeNull()
  })

  it('shows a password validation error from the single PUT and stays on the page', async () => {
    api.updateSchoolPupil.mockRejectedValue(
      validation({ newPassword: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' }),
    )
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-new-password"]').setValue('abc')
    await w.get('[data-testid="user-new-password-confirm"]').setValue('abc')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(text(w, 'user-form-alert')).toContain('sekurang-kurangnya 6 aksara')
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar/3001')
  })

  it('renders the global 404 page for an unknown, foreign or wrong-role id', async () => {
    api.fetchSchoolPupil.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await mountAt(EditPelajarPage, '/admin-sekolah/pelajar/9', { id: 9 })
    expect(useRouteOutcome().value).toBe(404)
  })

  it('renders the global 403 page for an inactive pupil', async () => {
    api.fetchSchoolPupil.mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }))
    const { wrapper: w } = await mountAt(EditPelajarPage, '/admin-sekolah/pelajar/3002', { id: 3002 })
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'user-form')).toBe(false)
  })
})

describe('S10 Edit Guru (FR-M27-104 to 107)', () => {
  async function open() {
    api.fetchSchoolTeacher.mockResolvedValue(
      detail({ id: 5, role: 'teacher', name: 'Guru Contoh Satu', email: 'guru@demo.test', phone: null }),
    )
    return mountAt(EditGuruPage, '/admin-sekolah/guru/5', { id: 5 })
  }

  it('shows the form and the closed reset bar, no status line, no role / school / switch', async () => {
    const { wrapper: w } = await open()
    expect(api.fetchSchoolTeacher).toHaveBeenCalledWith(5, expect.anything())
    expect(w.findAll('label').slice(0, 3).map((l) => l.text().replace(/\s+/g, ' ').trim())).toEqual([
      'Nama *',
      'Emel *',
      'No. Telefon (Pilihan)',
    ])
    expect(has(w, 'user-status-line')).toBe(false)
    expect(w.get('[data-testid="user-password-toggle"]').text()).toContain('Reset Kata Laluan')
    expect(w.get('[data-testid="user-password-panel"]').attributes('style')).toContain('display: none')
    expect(w.find('select').exists()).toBe(false)
    expect(w.get('[data-testid="user-cancel"]').attributes('href')).toBe('/admin-sekolah/guru')
    expect((w.get('[data-testid="user-phone"]').element as HTMLInputElement).value).toBe('')
  })

  it('saves through #13 with the password pair in the same call and returns to S7', async () => {
    api.updateSchoolTeacher.mockResolvedValue({ data: detail({ role: 'teacher' }), status: 'Pengguna berjaya dikemaskini.' })
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-new-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-new-password-confirm"]').setValue('rahsia123')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.updateSchoolTeacher).toHaveBeenCalledWith(5, {
      name: 'Guru Contoh Satu',
      email: 'guru@demo.test',
      phone: '',
      newPassword: 'rahsia123',
      newPasswordConfirmation: 'rahsia123',
    })
    expect(api.resetSchoolTeacherPassword).not.toHaveBeenCalled()
    expect(api.updateSchoolPupil).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/guru')
  })

  it('renders the 403 page for an inactive teacher and the 404 page for a foreign id', async () => {
    api.fetchSchoolTeacher.mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }))
    await mountAt(EditGuruPage, '/admin-sekolah/guru/6', { id: 6 })
    expect(useRouteOutcome().value).toBe(403)
    setRouteOutcome(null)
    api.fetchSchoolTeacher.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await mountAt(EditGuruPage, '/admin-sekolah/guru/7', { id: 7 })
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('S11 Cipta Pengguna (FR-M27-108 to 110)', () => {
  async function open() {
    return mountAt(CiptaGuruPage, '/admin-sekolah/guru/baru')
  }

  it('shows the card heading, the read-only role, the locked school label and the six fields', async () => {
    const { wrapper: w } = await open()
    expect(w.get('h2').text()).toBe('Borang Pendaftaran Pengguna')
    expect(w.text()).toContain('Isi maklumat untuk mendaftarkan pengguna baru')
    expect(text(w, 'user-role')).toBe('Guru')
    expect(text(w, 'user-school-name')).toBe('SMK Contoh Ujian')
    expect(text(w, 'user-school-meta')).toBe('ABC1234 · PPD Contoh · Selangor')
    expect(w.findAll('label').map((l) => l.text().replace(/\s+/g, ' ').trim())).toEqual([
      'Nama *',
      'Emel *',
      'No. Telefon (Pilihan)',
      'Kata Laluan *',
      'Sahkan Kata Laluan *',
    ])
    expect(w.get('[data-testid="user-password"]').attributes('placeholder')).toBe('Minimum 6 aksara')
    expect(w.get('[data-testid="user-password-confirm"]').attributes('placeholder')).toBe('Taip semula kata laluan')
    expect(w.find('select').exists()).toBe(false)
    expect(text(w, 'user-cancel')).toBe('Batal')
    expect(text(w, 'user-submit')).toBe('Daftar Pengguna')
    expect(w.get('[data-testid="user-cancel"]').attributes('href')).toBe('/admin-sekolah/guru')
  })

  it('creates with only the form fields (no role, school or isActive), flashes and opens S7', async () => {
    api.createSchoolTeacher.mockResolvedValue({
      data: detail({ role: 'teacher' }),
      status: 'Pengguna berjaya didaftarkan.',
    })
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-name"]').setValue('Guru Baharu')
    await w.get('[data-testid="user-email"]').setValue('baharu@demo.test')
    await w.get('[data-testid="user-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-password-confirm"]').setValue('rahsia123')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.createSchoolTeacher).toHaveBeenCalledWith({
      name: 'Guru Baharu',
      email: 'baharu@demo.test',
      phone: '',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
    })
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/guru')
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Pengguna berjaya didaftarkan.' })
  })

  it('shows the server errors above the form, keeps the values and clears the passwords', async () => {
    api.createSchoolTeacher.mockRejectedValue(validation({ email: 'Emel telah digunakan.' }))
    const { wrapper: w, router } = await open()
    await w.get('[data-testid="user-name"]').setValue('Guru Baharu')
    await w.get('[data-testid="user-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-password-confirm"]').setValue('lain')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(text(w, 'user-form-alert')).toContain('Emel telah digunakan.')
    expect((w.get('[data-testid="user-name"]').element as HTMLInputElement).value).toBe('Guru Baharu')
    expect((w.get('[data-testid="user-password"]').element as HTMLInputElement).value).toBe('')
    expect((w.get('[data-testid="user-password-confirm"]').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/guru/baru')
  })
})

describe('S12 Tambah Pelajar (FR-M27-117, 118, 120)', () => {
  const OPTIONS: SchoolPupilFormOptions = {
    school: { id: 900001, name: 'SMK Contoh Ujian', code: 'ABC1234', district: 'PPD Contoh', state: 'Selangor' },
    classes: [
      { id: 2001, name: '5 Amanah' },
      { id: 2002, name: '5 Bestari' },
    ],
    passwordPlaceholder: '••••••••',
    passwordHint: 'Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).',
    passwordMinLength: 8,
  }
  const CREATED = {
    data: detail({ id: 4001, name: 'Murid Baharu', email: 'baharu@demo.test' }),
    status: 'Pelajar "Murid Baharu" berjaya dicipta.',
    credential: {
      name: 'Murid Baharu',
      school: 'SMK Contoh Ujian',
      email: 'baharu@demo.test',
      password: 'Terjana-9999',
    },
  }

  async function open() {
    api.fetchSchoolPupilFormOptions.mockResolvedValue(OPTIONS)
    return mountAt(TambahPelajarPage, '/admin-sekolah/pelajar/baru')
  }

  it('shows the fields, the locked school label, the class options, the placeholder and the hint', async () => {
    const { wrapper: w } = await open()
    expect(w.findAll('label').map((l) => l.text().replace(/\s+/g, ' ').trim())).toEqual([
      'Nama penuh *',
      'Kelas',
      'Emel *',
      'Kata laluan',
    ])
    expect(text(w, 'user-school-name')).toBe('SMK Contoh Ujian')
    expect(text(w, 'user-school-meta')).toBe('ABC1234 · PPD Contoh · Selangor')
    expect(w.get('[data-testid="pupil-class"]').findAll('option').map((o) => o.text())).toEqual([
      'Tiada kelas',
      '5 Amanah',
      '5 Bestari',
    ])
    expect(w.get('[data-testid="pupil-password"]').attributes('placeholder')).toBe('••••••••')
    expect(text(w, 'pupil-password-hint')).toBe('Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).')
    expect(text(w, 'user-submit')).toBe('Cipta Pelajar')
    expect(text(w, 'user-cancel')).toBe('Batal')
    expect(w.get('[data-testid="user-cancel"]').attributes('href')).toBe('/admin-sekolah/pelajar')
    expect(has(w, 'pupil-credential')).toBe(false)
  })

  it('creates with the chosen class and shows the flash and the one-time credential block, emptying the form', async () => {
    api.createSchoolPupil.mockResolvedValue(CREATED)
    const { wrapper: w } = await open()
    await w.get('[data-testid="pupil-name"]').setValue('Murid Baharu')
    await w.get('[data-testid="pupil-class"]').setValue('2001')
    await w.get('[data-testid="pupil-email"]').setValue('baharu@demo.test')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.createSchoolPupil).toHaveBeenCalledWith({
      name: 'Murid Baharu',
      email: 'baharu@demo.test',
      classId: 2001,
    })
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Pelajar "Murid Baharu" berjaya dicipta.',
    })
    const block = w.get('[data-testid="pupil-credential"]')
    expect(block.text()).toContain('Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula.')
    expect(block.findAll('dt').map((e) => e.text())).toEqual(['Nama:', 'Sekolah:', 'Emel:', 'Kata laluan:'])
    expect(text(w, 'credential-password')).toBe('Terjana-9999')
    expect((w.get('[data-testid="pupil-name"]').element as HTMLInputElement).value).toBe('')
    expect((w.get('[data-testid="pupil-email"]').element as HTMLInputElement).value).toBe('')
    expect((w.get('[data-testid="pupil-class"]').element as HTMLSelectElement).value).toBe('')
  })

  it('sends a typed password and none when left empty; never role, school or isActive', async () => {
    api.createSchoolPupil.mockResolvedValue(CREATED)
    const { wrapper: w } = await open()
    await w.get('[data-testid="pupil-name"]').setValue('Murid Baharu')
    await w.get('[data-testid="pupil-email"]').setValue('baharu@demo.test')
    await w.get('[data-testid="pupil-password"]').setValue('rahsia1234')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.createSchoolPupil).toHaveBeenLastCalledWith({
      name: 'Murid Baharu',
      email: 'baharu@demo.test',
      password: 'rahsia1234',
    })
    expect(Object.keys(api.createSchoolPupil.mock.calls[0]![0] as object)).not.toContain('role')
  })

  it('shows the errors above the form, keeps the values and clears the password', async () => {
    api.createSchoolPupil.mockRejectedValue(validation({ name: 'Nama mesti sekurang-kurangnya 3 aksara.' }))
    const { wrapper: w } = await open()
    await w.get('[data-testid="pupil-name"]').setValue('Ab')
    await w.get('[data-testid="pupil-password"]').setValue('rahsia')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(text(w, 'user-form-alert')).toContain('sekurang-kurangnya 3 aksara')
    expect((w.get('[data-testid="pupil-name"]').element as HTMLInputElement).value).toBe('Ab')
    expect((w.get('[data-testid="pupil-password"]').element as HTMLInputElement).value).toBe('')
    expect(has(w, 'pupil-credential')).toBe(false)
  })

  it('keeps the credential in component memory only: a fresh mount shows no block', async () => {
    api.createSchoolPupil.mockResolvedValue(CREATED)
    const first = await open()
    await first.wrapper.get('[data-testid="pupil-name"]').setValue('Murid Baharu')
    await first.wrapper.get('[data-testid="pupil-email"]').setValue('baharu@demo.test')
    await first.wrapper.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(has(first.wrapper, 'pupil-credential')).toBe(true)
    first.wrapper.unmount()
    const second = await open()
    expect(has(second.wrapper, 'pupil-credential')).toBe(false)
    expect(second.wrapper.html()).not.toContain('Terjana-9999')
  })

  it('renders the 403 page when the form options answer 403', async () => {
    api.fetchSchoolPupilFormOptions.mockRejectedValue(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }))
    const { wrapper: w } = await mountAt(TambahPelajarPage, '/admin-sekolah/pelajar/baru')
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'user-form')).toBe(false)
  })
})
