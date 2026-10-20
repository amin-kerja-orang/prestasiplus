// @vitest-environment jsdom
/**
 * M27 http-mode behaviour against the real BE-21 (D59b, UD-2): string class id, no typed passwords, the teacher
 * credential block, no impersonation button, the real password minimum. Mock mode (flag off) is unchanged.
 */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CiptaGuruPage from '../../pages/CiptaGuruPage.vue'
import EditPelajarPage from '../../pages/EditPelajarPage.vue'
import SenaraiGuruPage from '../../pages/SenaraiGuruPage.vue'
import SenaraiPelajarPage from '../../pages/SenaraiPelajarPage.vue'
import TambahPelajarPage from '../../pages/TambahPelajarPage.vue'
import { detail, has, mountAt, pupil, teacher, text } from './helpers'

const mode = vi.hoisted(() => ({ http: false }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

const api = vi.hoisted(() => ({
  fetchSchoolPupil: vi.fn(),
  fetchSchoolPupils: vi.fn(),
  fetchSchoolTeachers: vi.fn(),
  createSchoolTeacher: vi.fn(),
  createSchoolPupil: vi.fn(),
  fetchSchoolPupilFormOptions: vi.fn(),
}))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  ...api,
}))

const list = (rows: unknown[]) => ({
  data: rows,
  meta: {
    page: 1,
    pageSize: 25,
    totalItems: rows.length,
    totalPages: 1,
    from: 1,
    to: rows.length,
    counts: { total: rows.length, active: rows.length, inactive: 0 },
  },
})

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  mode.http = false
})

describe('Tambah Pelajar', () => {
  const OPTIONS = {
    school: { id: 900001, name: 'SMK Contoh Ujian', code: 'ABC1234', district: 'PPD Contoh', state: 'Selangor' },
    classes: [{ id: '2001', name: '5 Amanah' }],
  }
  const CREATED = {
    data: detail(),
    status: 'Pelajar berjaya dicipta.',
    credential: { name: 'M', school: 'S', email: 'm@demo.test', password: 'Terjana-9999' },
  }

  async function fill() {
    api.fetchSchoolPupilFormOptions.mockResolvedValue(OPTIONS)
    api.createSchoolPupil.mockResolvedValue(CREATED)
    const { wrapper: w } = await mountAt(TambahPelajarPage, '/admin-sekolah/pelajar/baru')
    await w.get('[data-testid="pupil-name"]').setValue('M')
    await w.get('[data-testid="pupil-class"]').setValue('2001')
    await w.get('[data-testid="pupil-email"]').setValue('m@demo.test')
    return w
  }

  it('http: sends the class id as a string, hides the password field and never sends a password', async () => {
    mode.http = true
    const w = await fill()
    expect(has(w, 'pupil-password')).toBe(false)
    expect(has(w, 'pupil-password-hint')).toBe(false)
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.createSchoolPupil).toHaveBeenCalledWith({ name: 'M', email: 'm@demo.test', classId: '2001' })
  })

  it('mock: keeps the numeric class id and the password field', async () => {
    const w = await fill()
    expect(has(w, 'pupil-password')).toBe(true)
    await w.get('[data-testid="pupil-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.createSchoolPupil).toHaveBeenCalledWith({
      name: 'M',
      email: 'm@demo.test',
      password: 'rahsia123',
      classId: 2001,
    })
  })
})

describe('Cipta Guru', () => {
  const CREATED = {
    data: detail({ role: 'teacher' }),
    status: 'Guru berjaya dicipta.',
    credential: { name: 'Guru Baharu', school: 'SMK Contoh Ujian', email: 'g@demo.test', password: 'Terjana-1234' },
  }

  it('http: no password fields, none sent, shows the returned credential and a link to the list', async () => {
    mode.http = true
    api.createSchoolTeacher.mockResolvedValue(CREATED)
    const { wrapper: w, router } = await mountAt(CiptaGuruPage, '/admin-sekolah/guru/baru')
    expect(has(w, 'user-password')).toBe(false)
    expect(has(w, 'user-password-confirm')).toBe(false)
    await w.get('[data-testid="user-name"]').setValue('Guru Baharu')
    await w.get('[data-testid="user-email"]').setValue('g@demo.test')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    const sent = api.createSchoolTeacher.mock.calls[0]?.[0] as Record<string, unknown>
    expect(sent).not.toHaveProperty('password')
    expect(sent).not.toHaveProperty('passwordConfirmation')
    expect(text(w, 'credential-password')).toBe('Terjana-1234')
    expect(text(w, 'pupil-credential')).toContain('Maklumat log masuk guru')
    expect(w.get('[data-testid="sg-credential-continue"]').attributes('href')).toBe('/admin-sekolah/guru')
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/guru/baru')
  })

  it('mock: keeps the password pair and redirects to the list', async () => {
    api.createSchoolTeacher.mockResolvedValue({ data: detail({ role: 'teacher' }), status: 'ok' })
    const { wrapper: w, router } = await mountAt(CiptaGuruPage, '/admin-sekolah/guru/baru')
    expect(w.get('[data-testid="user-password"]').attributes('placeholder')).toBe('Minimum 6 aksara')
    await w.get('[data-testid="user-name"]').setValue('G')
    await w.get('[data-testid="user-password"]').setValue('rahsia123')
    await w.get('[data-testid="user-password-confirm"]').setValue('rahsia123')
    await w.get('[data-testid="user-form"]').trigger('submit')
    await flushPromises()
    expect(api.createSchoolTeacher).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'rahsia123', passwordConfirmation: 'rahsia123' }),
    )
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/guru')
  })
})

describe('Menyamar button', () => {
  it('http: no impersonate button on the pupil list', async () => {
    mode.http = true
    api.fetchSchoolPupils.mockResolvedValue(list([pupil()]))
    const { wrapper: w } = await mountAt(SenaraiPelajarPage, '/admin-sekolah/pelajar')
    expect(w.findAll('[data-testid="user-impersonate"]')).toHaveLength(0)
  })

  it('http: no impersonate button on the teacher list', async () => {
    mode.http = true
    api.fetchSchoolTeachers.mockResolvedValue(list([teacher()]))
    const { wrapper: w } = await mountAt(SenaraiGuruPage, '/admin-sekolah/guru')
    expect(w.findAll('[data-testid="user-impersonate"]')).toHaveLength(0)
  })

  it('mock: the button is still rendered', async () => {
    api.fetchSchoolPupils.mockResolvedValue(list([pupil()]))
    const { wrapper: w } = await mountAt(SenaraiPelajarPage, '/admin-sekolah/pelajar')
    expect(w.findAll('[data-testid="user-impersonate"]').length).toBeGreaterThan(0)
  })
})

describe('new password placeholder', () => {
  it.each([
    [true, 'Minimum 8 aksara'],
    [false, 'Minimum 6 aksara'],
  ])('http=%s shows "%s" on the edit form', async (http, copy) => {
    mode.http = http
    api.fetchSchoolPupil.mockResolvedValue(detail())
    const { wrapper: w } = await mountAt(EditPelajarPage, '/admin-sekolah/pelajar/3001', { id: 3001 })
    expect(w.get('[data-testid="user-new-password"]').attributes('placeholder')).toBe(copy)
  })
})
