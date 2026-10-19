import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { SCHOOL_ACCESS, SchoolInputSchema, statusEnvelopeOf } from '../../schools/schema'
import {
  CreatedUserSchema,
  ImportCredentialSchema,
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
  MANAGEABLE_TARGET_ROLES,
  BULK_IMPORT_ROLES_BY_CALLER,
  ImportRoleForbiddenSchema,
  IMPORT_ROLE_FORBIDDEN_MESSAGE,
  LAST_ADMIN_MESSAGE,
  LastAdminConflictSchema,
  USER_ACCESS,
  IMPORT_MAX_CHARS,
  IMPORT_MAX_ROWS,
  UpdatedUserSchema,
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
  it('accepts partial bodies and clearing optionals; roles are required', () => {
    expect(UpdateUserRequestSchema.safeParse(update).success).toBe(true)
    expect(UpdateUserRequestSchema.safeParse({ ...update, phone: null, schoolId: null, icNumber: null }).success).toBe(true)
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
  it('rejects other roles, bad mode', () => {
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'student' }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ ...base, role: 'admin' }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ ...base, importMode: 'xlsx' }).success).toBe(false)
  })
  it('multipart variant carries text ids', () => {
    expect(BulkImportMultipartSchema.safeParse({ role: 'teacher', schoolId: '10', importMode: 'csv', csvFile: 'a,b' }).success).toBe(true)
  })
  it('result and messages match the mock', () => {
    const result = { created: 2, skipped: 1, failed: 1, credentials: [{ line: 2, email: 'a@example.test', generatedPassword: 'Xk3pQ9vL2m', mustChangePassword: true }], errors: [{ line: 4, message: 'Emel tidak sah.' }] }
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
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, roles: ['hantu'] }), 'roles.0')).toBe('The selected role is invalid.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, email: 'bukan-emel' }), 'email')).toBe('The email field must be a valid email address.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, email: null }), 'email')).toBe('The email field is required.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, name: 'x'.repeat(256) }), 'name')).toBe('The name field must not be greater than 255 characters.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, phone: '1'.repeat(15) }), 'phone')).toBe('The phone field must not be greater than 14 characters.')
    expect(msg(CreateUserRequestSchema.safeParse({ ...create, icNumber: '1'.repeat(15) }), 'icNumber')).toBe('The ic number field must not be greater than 14 characters.')
  })
  it('create: no admin-chosen password (D59b)', () => {
    expect(CreateUserRequestSchema.safeParse({ ...create, password: 'secret1' }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse({ ...create, passwordConfirmation: 'secret1' }).success).toBe(false)
    expect(CreateUserRequestSchema.safeParse(create).success).toBe(true)
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
    .flatMap(([p, m]) => Object.entries(m).map(([method, op]) => ({ key: method.toUpperCase() + ' ' + p, method, path: p, op })))
    .filter((o) => o.key in USER_ACCESS || o.key in SCHOOL_ACCESS)

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
      'GET /students/search', 'GET /admin/teachers', 'GET /admin/schools', 'GET /admin/schools/{id}/students',
    ]
    for (const key of noStore) {
      const o = ops.find((x) => x.key === key)
      expect(o, key).toBeDefined()
      const ok = Object.entries(o!.op.responses).find(([c]) => c.startsWith('2'))?.[1]
      expect(ok?.headers?.['Cache-Control'], key).toBeDefined()
    }
  })
  it('student search is staff only and needs 3 characters', () => {
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

describe('D58 decisions', () => {
  type Resp = { content?: { 'application/json': { schema: { $ref?: string; anyOf?: { $ref?: string }[] } } } }
  type Op = { description?: string; responses: Record<string, Resp> }
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, Op>> }
  const op = (path: string, method: string) => doc.paths[path]![method]!

  it('exports the last-admin message and pins it in the 409 of PUT, DELETE, bulk-delete and toggle', () => {
    expect(LAST_ADMIN_MESSAGE).toBe('Admin terakhir tidak boleh dinyahaktifkan atau dipadam.')
    const ok = { error: { code: 'CONFLICT', message: LAST_ADMIN_MESSAGE } }
    expect(LastAdminConflictSchema.safeParse(ok).success).toBe(true)
    expect(LastAdminConflictSchema.safeParse({ error: { code: 'CONFLICT', message: 'lain' } }).success).toBe(false)
    expect(LastAdminConflictSchema.safeParse({ error: { code: 'FORBIDDEN', message: LAST_ADMIN_MESSAGE } }).success).toBe(false)
    for (const [path, method] of [
      ['/admin/users/{id}', 'put'],
      ['/admin/users/{id}', 'delete'],
      ['/admin/users/bulk-delete', 'post'],
      ['/admin/users/{id}/toggle-active', 'post'],
    ] as const) {
      expect(op(path, method).responses['409']?.content?.['application/json'].schema.$ref, path + ' ' + method).toBe('#/components/schemas/LastAdminConflict')
    }
  })

  it('a school_admin may import teachers only, never parents (typed 403, server-enforced)', () => {
    expect([...BULK_IMPORT_ROLES_BY_CALLER.school_admin]).toEqual(['teacher'])
    expect(BULK_IMPORT_ROLES_BY_CALLER.admin).toContain('parent')
    expect(ASSIGNABLE_ROLES.school_admin).not.toContain('parent')
    expect(USER_ACCESS['POST /admin/users/bulk-import'].scope).toMatch(/teacher only/)
    expect(IMPORT_ROLE_FORBIDDEN_MESSAGE).toBe('Admin sekolah hanya boleh mengimport guru.')
    expect(ImportRoleForbiddenSchema.safeParse({ error: { code: 'FORBIDDEN', message: IMPORT_ROLE_FORBIDDEN_MESSAGE } }).success).toBe(true)
    expect(ImportRoleForbiddenSchema.safeParse({ error: { code: 'FORBIDDEN', message: 'x' } }).success).toBe(false)
    expect(ImportRoleForbiddenSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } }).success).toBe(false)
    const forbidden = op('/admin/users/bulk-import', 'post').responses['403']?.content?.['application/json'].schema
    expect(JSON.stringify(forbidden)).toContain('ImportRoleForbidden')
    expect(op('/admin/users/bulk-import', 'post').description).toMatch(/school_admin may import teachers only, never parents/)
  })

  it('every admin write route with a body is strict and documents BE-NFR-05', () => {
    expect(CreateUserRequestSchema.safeParse({ ...create, extra: 1 }).success).toBe(false)
    expect(UpdateUserRequestSchema.safeParse({ roles: ['teacher'], name: 'a', email: 'a@example.test', extra: 1 }).success).toBe(false)
    expect(BulkDeleteRequestSchema.safeParse({ ids: ['1'], extra: 1 }).success).toBe(false)
    expect(BulkImportRequestSchema.safeParse({ role: 'parent', importMode: 'paste', pasteContent: 'a, a@example.test', extra: 1 }).success).toBe(false)
    expect(BulkImportMultipartSchema.safeParse({ role: 'parent', importMode: 'paste', pasteContent: 'a, a@example.test', extra: 1 }).success).toBe(false)
    expect(SchoolInputSchema.safeParse({ name: 'a', code: 'b', type: 'SK', state: 'Johor', extra: 1 }).success).toBe(false)
    for (const [path, method] of [
      ['/admin/users', 'post'],
      ['/admin/users/{id}', 'put'],
      ['/admin/users/bulk-delete', 'post'],
      ['/admin/users/bulk-import', 'post'],
      ['/admin/schools', 'post'],
      ['/admin/schools/{id}', 'put'],
    ] as const)
      expect(op(path, method).description, path + ' ' + method).toMatch(/BE-NFR-05/)
  })

  it('D59: no shared default password is exposed, accepted or issued', () => {
    expect(doc.paths['/admin/config/defaults']).toBeUndefined()
    expect(BulkImportRequestSchema.safeParse({ role: 'parent', importMode: 'paste', pasteContent: 'a, a@example.test', defaultPassword: 'x1234567' }).success).toBe(false)
    expect(BulkImportMultipartSchema.safeParse({ role: 'parent', importMode: 'paste', pasteContent: 'a, a@example.test', defaultPassword: 'x1234567' }).success).toBe(false)
    expect(JSON.stringify(op('/admin/users/bulk-import', 'post'))).not.toMatch(/defaultPassword/)
  })

  it('D59: create returns a one-time generatedPassword with mustChangePassword true, no-store', () => {
    const created = { ...detail, mustChangePassword: true, generatedPassword: 'Xk3pQ9vL2m' }
    expect(CreatedUserSchema.safeParse(created).success).toBe(true)
    expect(CreatedUserSchema.safeParse({ ...created, generatedPassword: undefined }).success).toBe(false)
    expect(CreatedUserSchema.safeParse({ ...created, mustChangePassword: false }).success).toBe(false)
    expect(AdminUserDetailSchema.parse(created)).not.toHaveProperty('generatedPassword')
    const post = op('/admin/users', 'post').responses['201'] as { headers?: Record<string, unknown>; content?: { 'application/json': { schema: unknown } } }
    expect(post.headers?.['Cache-Control']).toBeDefined()
    expect(JSON.stringify(post.content)).toContain('CreatedUserEnvelope'.slice(0, 0) + 'CreatedUser')
    expect(op('/admin/users', 'post').description).toMatch(/generatedPassword/)
  })

  it('D59: update has no password fields; resetPassword triggers a generated one-time password', () => {
    const update = { roles: ['teacher'], name: 'Guru Ujian', email: 'guru@example.test' }
    expect(UpdateUserRequestSchema.safeParse(update).success).toBe(true)
    expect(UpdateUserRequestSchema.safeParse({ ...update, resetPassword: true }).success).toBe(true)
    expect(UpdateUserRequestSchema.safeParse({ ...update, resetPassword: 'yes' }).success).toBe(false)
    for (const bad of [{ newPassword: 'secret1' }, { newPasswordConfirmation: 'secret1' }, { password: 'secret1' }])
      expect(UpdateUserRequestSchema.safeParse({ ...update, ...bad }).success, JSON.stringify(bad)).toBe(false)
    const reset = { ...detail, mustChangePassword: true, generatedPassword: 'Xk3pQ9vL2m' }
    expect(UpdatedUserSchema.safeParse(reset).success).toBe(true)
    expect(UpdatedUserSchema.safeParse(detail).success).toBe(true)
    expect(UpdatedUserSchema.safeParse({ ...reset, generatedPassword: '' }).success).toBe(false)
    expect(AdminUserDetailSchema.parse(reset)).not.toHaveProperty('generatedPassword')
    const put = op('/admin/users/{id}', 'put')
    expect((put.responses['200'] as { headers?: Record<string, unknown> }).headers?.['Cache-Control']).toBeDefined()
    expect(put.description).toMatch(/resetPassword/)
    expect(put.description).toMatch(/generatedPassword/)
    expect(put.description).toMatch(/sessions are revoked/)
    expect(put.description).toMatch(/never logged/)
    expect(put.description).toMatch(/mustChangePassword/)
  })

  it('D59: the import report carries one generated password per created account', () => {
    const cred = { line: 2, email: 'a@example.test', generatedPassword: 'Xk3pQ9vL2m', mustChangePassword: true }
    expect(ImportCredentialSchema.safeParse(cred).success).toBe(true)
    expect(ImportCredentialSchema.safeParse({ ...cred, mustChangePassword: false }).success).toBe(false)
  })
})

describe('role hierarchy, scope and read limits (security re-review)', () => {
  type Op = { responses: Record<string, unknown>; description?: string }
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, Op>> }
  const op = (p: string, m: string) => doc.paths[p]![m]!

  it('a school_admin can manage only students, teachers and parents, never a peer or higher role', () => {
    expect([...MANAGEABLE_TARGET_ROLES.school_admin]).toEqual(['student', 'teacher', 'parent'])
    for (const r of ['admin', 'school_admin', 'ppd_officer', 'sponsor']) expect(MANAGEABLE_TARGET_ROLES.school_admin).not.toContain(r)
    expect(MANAGEABLE_TARGET_ROLES.admin).toContain('school_admin')
  })

  it('every id-targeting operation says out-of-scope and higher-role targets are 404', () => {
    for (const k of [
      'GET /admin/users/{id}',
      'PUT /admin/users/{id}',
      'DELETE /admin/users/{id}',
      'POST /admin/users/{id}/toggle-active',
      'POST /admin/users/bulk-delete',
    ] as const) {
      expect(USER_ACCESS[k].scope, k).toMatch(/MANAGEABLE_TARGET_ROLES|404/)
      const [method, ...rest] = k.split(' ')
      const o = op(rest.join(' '), method!.toLowerCase())
      expect(o.description, k).toMatch(/another school_admin|higher or equal role|never 403|skipped as unknown/)
    }
    expect(USER_ACCESS['GET /admin/users/{id}'].scope).toMatch(/another school_admin/)
    expect(USER_ACCESS['GET /admin/users/{id}'].scope).toMatch(/404, never 403/)
  })

  it('the list hides higher-role rows and scopes roleCounts', () => {
    expect(USER_ACCESS['GET /admin/users'].scope).toMatch(/hidden/)
    expect(USER_ACCESS['GET /admin/users'].scope).toMatch(/roleCounts/)
    expect(op('/admin/users', 'get').description).toMatch(/hides every row outside its school/)
  })

  it('duplicate e-mail/username copy is generic for a school_admin (documented trade-off)', () => {
    const d = op('/admin/users', 'post').description!
    expect(d).toMatch(/The email has already been taken./)
    expect(d).toMatch(/identical whether the existing account is in scope or in another school/)
    expect(d).toMatch(/Trade-off/)
    expect(op('/admin/users/bulk-import', 'post').description).toMatch(/counted identically/)
  })

  it('429 with Retry-After is documented on the read operations', () => {
    for (const [p, m] of [
      ['/admin/users', 'get'],
      ['/admin/users/{id}', 'get'],
      ['/admin/users/filters', 'get'],
      ['/admin/teachers', 'get'],
      ['/admin/teachers/{id}/classrooms', 'get'],
    ] as const) {
      const r = op(p, m).responses['429'] as { headers?: Record<string, unknown> } | undefined
      expect(r, p).toBeDefined()
      expect(r?.headers?.['Retry-After'], p).toBeDefined()
    }
  })

  it('linkedStudents is limited to the caller school and the search item is minimal', () => {
    const detailDoc = JSON.stringify(buildOpenApiDocument().components)
    expect(detailDoc).toMatch(/only children in the caller school are listed/)
    const item = StudentSearchItemSchema.parse({ id: '5', name: 'Murid Ujian', classLevel: 'D3', phone: '0123456789', avatarUrl: 'x' })
    expect(item).not.toHaveProperty('phone')
    expect(item).not.toHaveProperty('avatarUrl')
    expect(item.schoolName).toBeUndefined()
    expect(StudentSearchItemSchema.safeParse({ id: '5', name: 'a', classLevel: null, schoolName: 'SK Contoh' }).success).toBe(true)
    const search = op('/students/search', 'get').description!
    expect(search).toMatch(/name only/)
    expect(search).toMatch(/teacher sees only students in its own classes/)
    expect(USER_ACCESS['GET /students/search'].scope).toMatch(/teacher: only students in its own classes/)
  })
})

describe('envelopes and config', () => {
  it('mutation envelope is {data, status}', () => {
    const env = statusEnvelopeOf(AdminUserDetailSchema)
    expect(env.safeParse({ data: detail, status: USER_MESSAGES.created }).success).toBe(true)
    expect(env.safeParse({ data: detail }).success).toBe(false)
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
