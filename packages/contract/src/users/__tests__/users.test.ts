import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { statusEnvelopeOf } from '../../schools/schema'
import {
  AdminDefaultsSchema,
  AdminUserDetailSchema,
  AdminUserListItemSchema,
  BulkDeleteRequestSchema,
  BulkImportMultipartSchema,
  BulkImportRequestSchema,
  CreateUserRequestSchema,
  IcMaskedSchema,
  ImportResultSchema,
  StudentSearchItemSchema,
  UpdateUserRequestSchema,
  UserListMetaSchema,
  UserRolesSchema,
  USER_MESSAGES,
  usersDeletedText,
  usersImportedText,
} from '../schema'

const detail = {
  id: '42',
  name: 'Pengguna Ujian',
  email: 'ujian@example.test',
  username: null,
  phone: null,
  roles: ['teacher'],
  grade: null,
  schoolId: '10',
  bio: null,
  avatarUrl: null,
  createdAt: '2026-10-16T09:30:00+08:00',
  updatedAt: '2026-10-16T09:30:00+08:00',
  lastLoginAt: null,
  school: { id: '10', name: 'SK Contoh Satu', code: 'ABC0001', type: 'SK', state: 'Johor', district: 'PPD CONTOH', city: null },
  landingPath: '/guru',
  icMasked: null,
  isActive: true,
  isSuspended: false,
  subscriptionPackage: 'none',
  hasPkskSubscription: false,
  ppdState: null,
  ppdDistrict: null,
  linkedStudents: [],
}
const create = {
  roles: ['teacher'],
  name: 'Guru Ujian',
  email: 'guru@example.test',
  password: 'secret1',
  passwordConfirmation: 'secret1',
  schoolId: '10',
}

describe('roles list', () => {
  it('accepts valid combinations', () => {
    expect(UserRolesSchema.safeParse(['teacher', 'parent']).success).toBe(true)
    expect(UserRolesSchema.safeParse(['student']).success).toBe(true)
    expect(UserRolesSchema.safeParse(['admin']).success).toBe(true)
  })
  it('rejects empty, duplicate, unknown, student+other and admin+other', () => {
    for (const bad of [[], ['teacher', 'teacher'], ['jpn_officer'], ['student', 'parent'], ['admin', 'teacher']])
      expect(UserRolesSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
  })
})

describe('responses carry the masked IC only', () => {
  it('accepts the mask and rejects a clear IC', () => {
    expect(IcMaskedSchema.safeParse('xxxxxx-xx-xx34').success).toBe(true)
    expect(IcMaskedSchema.safeParse('900101-10-1234').success).toBe(false)
    expect(IcMaskedSchema.safeParse('900101101234').success).toBe(false)
    expect(AdminUserDetailSchema.safeParse({ ...detail, icMasked: '900101-10-1234' }).success).toBe(false)
  })
  it('strips a plaintext icNumber and legacy fields from a response', () => {
    const out = AdminUserDetailSchema.parse({ ...detail, icNumber: '900101-10-1234', legacy_id: '1', legacy_source: 'cloud' })
    expect(out).not.toHaveProperty('icNumber')
    expect(out).not.toHaveProperty('legacy_id')
    expect(out).not.toHaveProperty('legacy_source')
    const item = AdminUserListItemSchema.parse({ ...listItem(), icNumber: '900101-10-1234' })
    expect(item).not.toHaveProperty('icNumber')
  })
  it('detail: nullable e-mail, string ids, +08:00', () => {
    expect(AdminUserDetailSchema.safeParse({ ...detail, email: null, username: 'murid01', roles: ['student'], grade: 4 }).success).toBe(true)
    expect(AdminUserDetailSchema.safeParse({ ...detail, id: 42 }).success).toBe(false)
    expect(AdminUserDetailSchema.safeParse({ ...detail, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(AdminUserDetailSchema.safeParse({ ...detail, isSuspended: undefined }).success).toBe(false)
  })
})

function listItem() {
  return {
    id: '42',
    name: 'Pengguna Ujian',
    email: null,
    username: 'ujian01',
    phone: null,
    roles: ['student'],
    school: { id: '10', name: 'SK Contoh Satu' },
    isActive: true,
    isSuspended: false,
    createdAt: '2026-10-16T09:30:00+08:00',
    avatarUrl: null,
  }
}

describe('list', () => {
  it('parses an item and meta with roleCounts', () => {
    expect(AdminUserListItemSchema.safeParse(listItem()).success).toBe(true)
    const meta = {
      page: 1, pageSize: 25, totalItems: 1, totalPages: 1, from: 1, to: 1,
      roleCounts: { student: 1, teacher: 0, parent: 0, sponsor: 0, schoolAdmin: 0, ppdOfficer: 0, admin: 0 },
    }
    expect(UserListMetaSchema.safeParse(meta).success).toBe(true)
    expect(UserListMetaSchema.safeParse({ ...meta, roleCounts: { student: 1 } }).success).toBe(false)
  })
})

describe('create request', () => {
  it('accepts a teacher with e-mail and a student with username and IC', () => {
    expect(CreateUserRequestSchema.safeParse(create).success).toBe(true)
    expect(
      CreateUserRequestSchema.safeParse({ ...create, roles: ['student'], email: null, username: 'murid01', grade: 4, icNumber: '900101-10-1234', schoolId: null }).success,
    ).toBe(true)
  })
  it('rejects missing fields and bad role combinations', () => {
    expect(CreateUserRequestSchema.safeParse({ ...create, name: '' }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, password: '12345', passwordConfirmation: '12345' }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, passwordConfirmation: 'other' }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, roles: ['student', 'teacher'], grade: 3 }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, email: null }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, email: 'bukan-emel' }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, phone: '1'.repeat(15) }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, icNumber: '1'.repeat(15) }).success).toBe(false)
  })
  it('enforces the role-conditional fields', () => {
    expect(CreateUserRequestSchema.safeParse({ ...create, roles: ['student'], grade: null }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, roles: ['student'], grade: 12 }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, roles: ['school_admin'], schoolId: null }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, roles: ['ppd_officer'], ppdState: 'Johor' }).success).toBe(false)
    expect(
      CreateUserRequestSchema.safeParse({ ...create, roles: ['ppd_officer'], ppdState: 'Johor', ppdDistrict: 'PPD CONTOH' }).success,
    ).toBe(true)
  })
})

describe('update request', () => {
  const update = { roles: ['teacher'], name: 'Guru Ujian', email: 'guru@example.test' }
  it('accepts partial bodies and a confirmed new password', () => {
    expect(UpdateUserRequestSchema.safeParse(update).success).toBe(true)
    expect(UpdateUserRequestSchema.safeParse({ ...update, phone: null, schoolId: null, icNumber: null }).success).toBe(true)
    expect(UpdateUserRequestSchema.safeParse({ ...update, newPassword: 'secret1', newPasswordConfirmation: 'secret1' }).success).toBe(true)
  })
  it('rejects an unconfirmed or short new password and no roles', () => {
    expect(UpdateUserRequestSchema.safeParse({ ...update, newPassword: 'secret1', newPasswordConfirmation: 'x' }).success).toBe(false)
    expect(UpdateUserRequestSchema.safeParse({ ...update, newPassword: '123' }).success).toBe(false)
    expect(UpdateUserRequestSchema.safeParse({ name: 'a', email: 'a@example.test' }).success).toBe(false)
  })
})

describe('bulk delete and search', () => {
  it('needs at least one id, as strings', () => {
    expect(BulkDeleteRequestSchema.safeParse({ ids: ['1', '2'] }).success).toBe(true)
    expect(BulkDeleteRequestSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(BulkDeleteRequestSchema.safeParse({ ids: [1] }).success).toBe(false)
    expect(BulkDeleteRequestSchema.safeParse({}).success).toBe(false)
  })
  it('student search item', () => {
    expect(StudentSearchItemSchema.safeParse({ id: '5', name: 'Murid Ujian', classLevel: 'D3', schoolName: null }).success).toBe(true)
  })
})

describe('bulk import', () => {
  const base = { role: 'teacher', schoolId: '10', importMode: 'paste', pasteContent: 'Guru Ujian, guru@example.test' }
  it('accepts the four import roles; school is required for teacher and school_admin', () => {
    expect(BulkImportRequestSchema.safeParse(base).success).toBe(true)
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'parent', schoolId: null }).success).toBe(true)
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'ppd_officer', schoolId: undefined }).success).toBe(true)
    expect(BulkImportRequestSchema.safeParse({ ...base, schoolId: null }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'school_admin', schoolId: undefined }).success).toBe(false)
  })
  it('rejects other roles, bad mode and a short default password', () => {
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'student' }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'admin' }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ ...base, importMode: 'xlsx' }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ ...base, defaultPassword: '123' }).success).toBe(false)
  })
  it('multipart variant carries text ids', () => {
    expect(BulkImportMultipartSchema.safeParse({ role: 'teacher', schoolId: '10', importMode: 'csv' }).success).toBe(true)
  })
  it('result and messages match the mock', () => {
    const result = { created: 2, skipped: 1, failed: 1, errors: [{ line: 4, message: 'Emel tidak sah.' }] }
    expect(ImportResultSchema.safeParse(result).success).toBe(true)
    expect(ImportResultSchema.safeParse({ ...result, errors: [{ line: 0, message: 'x' }] }).success).toBe(false)
    expect(usersImportedText(result)).toBe('Import selesai: 2 pengguna didaftarkan, 1 dilangkau, 1 gagal.')
    expect(usersDeletedText(3)).toBe('3 pengguna berjaya dipadam.')
    expect(USER_MESSAGES.created).toBe('Pengguna berjaya didaftarkan.')
    expect(USER_MESSAGES.updated).toBe('Pengguna berjaya dikemaskini.')
    expect(USER_MESSAGES.deleted).toBe('Pengguna berjaya dipadam.')
    expect(USER_MESSAGES.toggled).toBe('Status pengguna berjaya dikemaskini.')
    expect(USER_MESSAGES.ownDelete).toBe('Anda tidak boleh memadam akaun sendiri.')
    expect(USER_MESSAGES.noData).toBe('Tiada data untuk diimport.')
  })
})

describe('envelopes and config', () => {
  it('mutation envelope is {data, status}', () => {
    const env = statusEnvelopeOf(AdminUserDetailSchema)
    expect(env.safeParse({ data: detail, status: USER_MESSAGES.created }).success).toBe(true)
    expect(env.safeParse({ data: detail }).success).toBe(false)
  })
  it('defaults', () => {
    expect(AdminDefaultsSchema.safeParse({ schoolAdminDefaultPassword: 'a', bulkImportDefaultPassword: 'b', compStudentDefaultPassword: 'c' }).success).toBe(true)
  })
})

describe('OpenAPI registration', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
  it('contains every user path and method, and no impersonate route', () => {
    const expected: [string, string][] = [
      ['/admin/users', 'get'],
      ['/admin/users', 'post'],
      ['/admin/users/filters', 'get'],
      ['/admin/users/bulk-delete', 'post'],
      ['/admin/users/bulk-import', 'post'],
      ['/admin/users/{id}', 'get'],
      ['/admin/users/{id}', 'put'],
      ['/admin/users/{id}', 'delete'],
      ['/admin/users/{id}/toggle-active', 'post'],
      ['/students/search', 'get'],
      ['/admin/teachers', 'get'],
      ['/admin/teachers/{id}/classrooms', 'get'],
      ['/admin/config/defaults', 'get'],
    ]
    for (const [path, method] of expected) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    expect(Object.keys(doc.paths).some((p) => p.includes('impersonate'))).toBe(false)
  })
  it('contains the user components and exposes no clear IC field', () => {
    for (const name of ['AdminUserDetail', 'AdminUserListItem', 'CreateUserRequest', 'UpdateUserRequest', 'ImportResult', 'IcMasked', 'UserListMeta'])
      expect(doc.components.schemas[name], name).toBeDefined()
    const detailSchema = JSON.stringify(doc.components.schemas.AdminUserDetail)
    expect(detailSchema).toContain('icMasked')
    expect(detailSchema).not.toContain('"icNumber"')
    expect(JSON.stringify(doc.components.schemas)).not.toMatch(/legacy_/)
  })
})
