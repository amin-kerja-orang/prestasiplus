import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { SchoolInputSchema, statusEnvelopeOf } from '../../schools/schema'
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
  UserListQuerySchema,
  ASSIGNABLE_ROLES,
  USER_ACCESS,
  IMPORT_MAX_CHARS,
  IMPORT_MAX_ROWS,
  PASSWORD_MAX,
  STUDENT_SEARCH_MIN_CHARS,
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
  mustChangePassword: false,
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
    expect(BulkImportMultipartSchema.safeParse({ role: 'teacher', schoolId: '10', importMode: 'csv', csvFile: 'a,b' }).success).toBe(true)
  })
  it('result and messages match the mock', () => {
    const result = { created: 2, skipped: 1, failed: 1, mustChangePasswordCount: 2, errors: [{ line: 4, message: 'Emel tidak sah.' }] }
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

const msg = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, path: string) =>
  r.error?.issues.find((i) => i.path.join('.') === path)?.message

describe('user validation copy (mock messages)', () => {
  it('create: required, length and e-mail copy', () => {
    expect(msg(CreateUserRequestSchema.safeParse({}), 'name')).toBe('The name field is required.')
    expect(msg(CreateUserRequestSchema.safeParse({}), 'roles')).toBe('The role field is required.')
    expect(msg(CreateUserRequestSchema.safeParse({}), 'password')).toBe('The password field is required.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['hantu'] }), 'roles.0')).toBe('The selected role is invalid.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, email: 'bukan-emel' }), 'email')).toBe('The email field must be a valid email address.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, email: null }), 'email')).toBe('The email field is required.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, name: 'x'.repeat(256) }), 'name')).toBe('The name field must not be greater than 255 characters.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, phone: '1'.repeat(15) }), 'phone')).toBe('The phone field must not be greater than 14 characters.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, icNumber: '1'.repeat(15) }), 'icNumber')).toBe('The ic number field must not be greater than 14 characters.')
  })
  it('create: password copy', () => {
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, password: '123', passwordConfirmation: '123' }), 'password')).toBe('The password field must be at least 6 characters.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, passwordConfirmation: 'lain' }), 'password')).toBe('The password field confirmation does not match.')
  })
  it('create: role-conditional copy', () => {
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['student'], grade: null }), 'grade')).toBe('The grade field is required when role is student.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['student'], grade: 12 }), 'grade')).toBe('The selected grade is invalid.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['school_admin'], schoolId: null }), 'schoolId')).toBe('The school id field is required when role is school_admin.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['ppd_officer'] }), 'ppdState')).toBe('The ppd state field is required.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['ppd_officer'], ppdState: 'Johor' }), 'ppdDistrict')).toBe('The ppd district field is required when role is ppd_officer.')
  })
  it('accepts what the mock coerces: digit-string grade, loose isActive, blank optionals', () => {
    expect(CreateUserRequestSchema.safeParse({ ...create, roles: ['student'], grade: '4' }).success).toBe(true)
    for (const v of [true, 0, '1', 'yes', 'off']) expect(CreateUserRequestSchema.safeParse({ ...create, isActive: v }).success, String(v)).toBe(true)
    expect(CreateUserRequestSchema.safeParse({ ...create, phone: '', username: '', schoolId: '', ppdState: '' }).success).toBe(true)
  })
  it('update: copy for new password', () => {
    const update = { roles: ['teacher'], name: 'Guru Ujian', email: 'guru@example.test' }
    expect(msg(UpdateUserRequestSchema.safeParse({ ...update, newPassword: '123' }), 'newPassword')).toBe('The new password field must be at least 6 characters.')
    expect(msg(UpdateUserRequestSchema.safeParse({ ...update, newPassword: 'secret1', newPasswordConfirmation: 'x' }), 'newPassword')).toBe('The new password field confirmation does not match.')
  })
  it('bulk delete copy', () => {
    expect(msg(BulkDeleteRequestSchema.safeParse({}), 'ids')).toBe('The ids field is required.')
    expect(msg(BulkDeleteRequestSchema.safeParse({ ids: [] }), 'ids')).toBe('The ids field is required.')
    expect(msg(BulkDeleteRequestSchema.safeParse({ ids: 'x' }), 'ids')).toBe('The ids field must be an array of integers.')
  })
  it('bulk import copy, incl. "Tiada data untuk diimport."', () => {
    const base = { role: 'teacher', schoolId: '10', importMode: 'paste', pasteContent: 'Guru, guru@example.test' }
    expect(msg(BulkImportRequestSchema.safeParse({}), 'role')).toBe('The role field is required.')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, role: 'student' }), 'role')).toBe('The selected role is invalid.')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, schoolId: null }), 'schoolId')).toBe('The school id field is required.')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, defaultPassword: '123' }), 'defaultPassword')).toBe('The default password field must be at least 6 characters.')
    expect(BulkImportRequestSchema.safeParse({ ...base, defaultPassword: '' }).success).toBe(true)
    expect(msg(BulkImportRequestSchema.safeParse({ role: 'parent' }), 'importMode')).toBe('The import mode field is required.')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, importMode: 'xlsx' }), 'importMode')).toBe('The selected import mode is invalid.')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, pasteContent: '  ' }), 'pasteContent')).toBe('Tiada data untuk diimport.')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, importMode: 'csv', csvFile: '' }), 'csvFile')).toBe('Tiada data untuk diimport.')
  })
  it('list query never rejects a page value', () => {
    expect(UserListQuerySchema.safeParse({ page: 'abc', role: 'hantu', isActive: 'x' }).success).toBe(true)
  })
})

describe('security review fixes (D55, D57)', () => {
  type Op = { responses: Record<string, { headers?: Record<string, unknown> }>; description?: string }
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, Op>> }
  const ops = Object.entries(doc.paths)
    .filter(([p]) => /^\/(admin\/(users|teachers|schools|config)|students|schools|jpn)/.test(p))
    .flatMap(([p, m]) => Object.entries(m).map(([method, op]) => ({ key: method.toUpperCase() + ' ' + p, method, path: p, op })))

  it('every write route and every public lookup documents 429 with Retry-After', () => {
    const write = ops.filter((o) => o.method !== 'get')
    const publicGets = ops.filter((o) => ['/schools/search', '/jpn', '/jpn/{id}/ppd', '/students/search'].includes(o.path))
    expect(write.length).toBeGreaterThan(8)
    for (const o of [...write, ...publicGets]) {
      expect(o.op.responses['429'], o.key).toBeDefined()
      expect(o.op.responses['429']?.headers?.['Retry-After'], o.key).toBeDefined()
    }
  })
  it('personal-data and credential responses are no-store', () => {
    const noStore = [
      'GET /admin/users', 'GET /admin/users/{id}', 'POST /admin/users', 'PUT /admin/users/{id}', 'POST /admin/users/bulk-import',
      'GET /students/search', 'GET /admin/teachers', 'GET /admin/config/defaults', 'GET /admin/schools', 'GET /admin/schools/{id}/students',
    ]
    for (const key of noStore) {
      const o = ops.find((x) => x.key === key)
      expect(o, key).toBeDefined()
      const ok = Object.entries(o!.op.responses).find(([c]) => c.startsWith('2'))?.[1]
      expect(ok?.headers?.['Cache-Control'], key).toBeDefined()
    }
  })
  it('defaults are Admin Pusat only; student search is staff only and needs 3 characters', () => {
    expect(USER_ACCESS['GET /admin/config/defaults'].roles).toEqual(['admin'])
    expect([...USER_ACCESS['GET /students/search'].roles].sort()).toEqual(['admin', 'school_admin', 'teacher'])
    expect(STUDENT_SEARCH_MIN_CHARS).toBe(3)
  })
  it('school_admin can assign only student or teacher; only admin assigns admin, ppd_officer, school_admin', () => {
    expect([...ASSIGNABLE_ROLES.school_admin]).toEqual(['student', 'teacher'])
    for (const r of ['admin', 'ppd_officer', 'school_admin']) {
      expect(ASSIGNABLE_ROLES.admin).toContain(r)
      expect(ASSIGNABLE_ROLES.school_admin).not.toContain(r)
    }
  })
  it('every operation states its access in the description', () => {
    for (const o of ops) expect(o.op.description ?? '', o.key).toMatch(/Access: /)
  })
  it('password fields are capped at 128', () => {
    expect(PASSWORD_MAX).toBe(128)
    const long = 'x'.repeat(129)
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, password: long, passwordConfirmation: long }), 'password')).toBe('The password field must not be greater than 128 characters.')
    expect(msg(UpdateUserRequestSchema.safeParse({ roles: ['teacher'], name: 'a', newPassword: long, newPasswordConfirmation: long }), 'newPassword')).toBe('The new password field must not be greater than 128 characters.')
    expect(msg(BulkImportRequestSchema.safeParse({ role: 'parent', importMode: 'paste', pasteContent: 'a, a@example.test', defaultPassword: long }), 'defaultPassword')).toBe('The default password field must not be greater than 128 characters.')
  })
  it('bulk import is capped in size and rows', () => {
    const base = { role: 'parent', importMode: 'paste' }
    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => 'Nama ' + String(i) + ', n' + String(i) + '@example.test').join('\n')
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, pasteContent: rows }), 'pasteContent')).toBe('Data import melebihi had 1000 baris.')
    expect(BulkImportRequestSchema.safeParse({ ...base, pasteContent: rows.split('\n').slice(0, IMPORT_MAX_ROWS).join('\n') }).success).toBe(true)
    expect(msg(BulkImportRequestSchema.safeParse({ ...base, pasteContent: 'x'.repeat(IMPORT_MAX_CHARS + 1) }), 'pasteContent')).toBe('Data import melebihi had 1 MB.')
  })
  it('request bodies reject unknown keys (no mass assignment of roles, hashes or join codes)', () => {
    expect(CreateUserRequestSchema.safeParse({ ...create, icHash: 'x' }).success).toBe(false)
    expect(UpdateUserRequestSchema.safeParse({ roles: ['teacher'], name: 'a', email: 'a@example.test', scope: { level: 'national' } }).success).toBe(false)
    expect(BulkDeleteRequestSchema.safeParse({ ids: ['1'], force: true }).success).toBe(false)
    expect(SchoolInputSchema.safeParse({ name: 'a', code: 'b', type: 'SK', state: 'Johor', joinCode: 'X' }).success).toBe(false)
  })
  it('mustChangePassword is on the detail and the import report', () => {
    expect(AdminUserDetailSchema.safeParse({ ...detail, mustChangePassword: undefined }).success).toBe(false)
    expect(ImportResultSchema.safeParse({ created: 1, skipped: 0, failed: 0, errors: [] }).success).toBe(false)
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
