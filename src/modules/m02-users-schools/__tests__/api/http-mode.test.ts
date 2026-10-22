/**
 * M02 admin user api layer, http vs mock (D59b): the wire shapes of the real BE-05 (`roles[]`, string ids, no
 * password fields, `generatedPassword`, `resetPassword`, `credentials`). The transport is stubbed; the mode is
 * switched with `VITE_API_MODE`. Mock mode keeps the old shapes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { registerCompStudents } from '../../api/comp-students'
import { importUsers } from '../../api/imports'
import {
  createAdminUser,
  fetchAdminUser,
  rolesAfterEdit,
  updateAdminUser,
  type UpdateAdminUserRequest,
} from '../../api/users'

const sent: TransportRequest[] = []
let respond: (req: TransportRequest) => TransportResponse = () => ({
  status: 200,
  headers: {},
  body: {},
})

const WIRE_DETAIL = {
  id: '45',
  name: 'Guru Contoh',
  email: 'guru@example.test',
  username: null,
  phone: null,
  roles: ['school_admin', 'teacher'],
  grade: null,
  schoolId: '1',
  icMasked: 'xxxxxx-xx-xx34',
  isActive: true,
  subscriptionPackage: 'none',
  hasPkskSubscription: false,
  linkedStudents: [],
}

beforeEach(() => {
  sent.length = 0
  respond = () => ({ status: 200, headers: {}, body: {} })
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      if (req.method === 'GET' && req.url === '/api/session') {
        return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c' } } })
      }
      sent.push(req)
      return Promise.resolve(respond(req))
    }),
  }
  installTransport(transport)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const last = (): TransportRequest => sent[sent.length - 1]!
const body = (): Record<string, unknown> => last().body as Record<string, unknown>

describe('rolesAfterEdit', () => {
  it('keeps the whole list when the shown role is unchanged', () => {
    expect(rolesAfterEdit(['school_admin', 'teacher'], 'school_admin')).toEqual([
      'school_admin',
      'teacher',
    ])
  })
  it('swaps only the shown (first) role', () => {
    expect(rolesAfterEdit(['school_admin', 'teacher'], 'ppd_officer')).toEqual([
      'ppd_officer',
      'teacher',
    ])
  })
  it('de-duplicates when the new role is already in the list', () => {
    expect(rolesAfterEdit(['school_admin', 'teacher'], 'teacher')).toEqual(['teacher'])
  })
  it('uses the role alone when nothing was loaded', () => {
    expect(rolesAfterEdit([], 'parent')).toEqual(['parent'])
  })
})

describe('http mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'http')
  })

  it('create: roles[], string ids, no password fields; maps the one-time password', async () => {
    respond = () => ({
      status: 201,
      headers: {},
      body: {
        data: { ...WIRE_DETAIL, roles: ['teacher'], generatedPassword: 'Terjana-1' },
        status: 'ok',
      },
    })
    const result = await createAdminUser({
      role: 'teacher',
      name: 'Guru Contoh',
      email: 'guru@example.test',
      password: 'x',
      passwordConfirmation: 'x',
      schoolId: 3,
      linkedStudentIds: [5, 6],
    })
    expect(last().url).toBe('/api/admin/users')
    expect(body()).toEqual({
      roles: ['teacher'],
      name: 'Guru Contoh',
      email: 'guru@example.test',
      schoolId: '3',
      linkedStudentIds: ['5', '6'],
    })
    expect(body()).not.toHaveProperty('password')
    expect(body()).not.toHaveProperty('passwordConfirmation')
    expect(body()).not.toHaveProperty('role')
    expect(result.data.generatedPassword).toBe('Terjana-1')
    expect(result.data.role).toBe('teacher')
  })

  it('create: never calls the removed defaults route', async () => {
    respond = () => ({ status: 201, headers: {}, body: { data: WIRE_DETAIL, status: 'ok' } })
    await createAdminUser({ role: 'teacher', name: 'G', email: 'g@example.test' })
    expect(sent.some((r) => r.url === '/api/admin/config/defaults')).toBe(false)
  })

  it('detail: maps roles[] to the first role, keeps the list, null e-mail to empty and icMasked to icNumber', async () => {
    respond = () => ({ status: 200, headers: {}, body: { data: { ...WIRE_DETAIL, email: null } } })
    const u = await fetchAdminUser(45)
    expect(u.role).toBe('school_admin')
    expect(u.roles).toEqual(['school_admin', 'teacher'])
    expect(u.email).toBe('')
    expect(u.icNumber).toBe('xxxxxx-xx-xx34')
    expect(u.id).toBe('45')
  })

  it('update: PUTs the whole role list, no password pair, no subscription fields, resetPassword and string ids', async () => {
    respond = () => ({
      status: 200,
      headers: {},
      body: { data: { ...WIRE_DETAIL, generatedPassword: 'Terjana-2' }, status: 'ok' },
    })
    const request: UpdateAdminUserRequest = {
      name: 'Guru Contoh',
      email: 'guru@example.test',
      role: 'school_admin',
      roles: ['school_admin', 'teacher'],
      isActive: true,
      subscriptionPackage: 'none',
      hasPkskSubscription: false,
      newPassword: 'x',
      newPasswordConfirmation: 'x',
      schoolId: 1,
      resetPassword: true,
    }
    const result = await updateAdminUser(45, request)
    expect(last().method).toBe('PUT')
    expect(last().url).toBe('/api/admin/users/45')
    expect(body()).toEqual({
      name: 'Guru Contoh',
      email: 'guru@example.test',
      roles: ['school_admin', 'teacher'],
      isActive: true,
      schoolId: '1',
      resetPassword: true,
    })
    expect(result.data.generatedPassword).toBe('Terjana-2')
  })

  it('bulk import: no default password, string school id; passes the credentials through', async () => {
    respond = () => ({
      status: 200,
      headers: {},
      body: {
        data: {
          created: 1,
          skipped: 0,
          failed: 0,
          errors: [],
          credentials: [{ line: 1, email: 'a@example.test', generatedPassword: 'Terjana-3' }],
        },
        status: 'ok',
      },
    })
    const result = await importUsers({
      role: 'teacher',
      schoolId: 2,
      defaultPassword: 'jangan-hantar',
      importMode: 'paste',
      pasteContent: 'A, a@example.test',
    })
    expect(body()).toEqual({
      role: 'teacher',
      schoolId: '2',
      importMode: 'paste',
      pasteContent: 'A, a@example.test',
    })
    expect(result.data.credentials?.[0]?.generatedPassword).toBe('Terjana-3')
  })

  it('comp-student register: string classroom id', async () => {
    respond = () => ({
      status: 201,
      headers: {},
      body: { data: { created: 1, skipped: 0, failed: 0, errors: [] }, status: 'ok' },
    })
    await registerCompStudents({
      classroomId: 9,
      packageExpiresAt: '2026-12-31',
      students: 'A, 090101101234',
    })
    expect(body().classroomId).toBe('9')
  })
})

describe('mock mode (unchanged shapes)', () => {
  it('create keeps role and the password pair', async () => {
    respond = () => ({ status: 201, headers: {}, body: { data: { id: 1 }, status: 'ok' } })
    await createAdminUser({
      role: 'teacher',
      name: 'G',
      email: 'g@example.test',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      schoolId: 3,
    })
    expect(body()).toEqual({
      role: 'teacher',
      name: 'G',
      email: 'g@example.test',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      schoolId: 3,
    })
  })

  it('update keeps the single role, the subscription fields and the new password', async () => {
    respond = () => ({ status: 200, headers: {}, body: { data: { id: 1 }, status: 'ok' } })
    await updateAdminUser(1, {
      name: 'G',
      email: 'g@example.test',
      role: 'student',
      isActive: true,
      subscriptionPackage: 'personal',
      newPassword: 'rahsia123',
      newPasswordConfirmation: 'rahsia123',
    })
    expect(body()).toEqual({
      name: 'G',
      email: 'g@example.test',
      role: 'student',
      isActive: true,
      subscriptionPackage: 'personal',
      newPassword: 'rahsia123',
      newPasswordConfirmation: 'rahsia123',
    })
  })

  it('import keeps the default password and the numeric school id', async () => {
    respond = () => ({ status: 200, headers: {}, body: { data: {}, status: 'ok' } })
    await importUsers({
      role: 'teacher',
      schoolId: 2,
      defaultPassword: 'abc',
      importMode: 'paste',
      pasteContent: 'x',
    })
    expect(body()).toMatchObject({ schoolId: 2, defaultPassword: 'abc' })
  })

  it('detail is returned untouched', async () => {
    respond = () => ({
      status: 200,
      headers: {},
      body: { data: { id: 3, role: 'teacher', email: 'a@b.c' } },
    })
    const u = await fetchAdminUser(3)
    expect(u).toEqual({ id: 3, role: 'teacher', email: 'a@b.c' })
  })
})
