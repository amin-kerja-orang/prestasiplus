import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import {
  SCHOOL_ADMIN_PENDING_COMPONENT_SCHEMAS,
  SCHOOL_ADMIN_PENDING_TEACHER_FLASH,
  SCHOOL_ADMIN_TEACHER_VERIFIED_NOTICE,
  SchoolAdminPendingTeacherListResponseSchema,
  SchoolAdminVerifyTeacherResultSchema,
} from '../pending-teachers'

const row = { id: '12', name: 'Guru Menunggu', initials: 'GM', email: 'menunggu@ujian.test', phone: null, requestedAt: '2026-10-19T09:00:00+08:00' }
const meta = { page: 1, pageSize: 1, totalItems: 1, totalPages: 1, from: 1, to: 1 }

describe('BE-21 AC13 pending teachers contract', () => {
  it('parses a pending list and an empty one', () => {
    expect(SchoolAdminPendingTeacherListResponseSchema.safeParse({ data: [row], meta }).success).toBe(true)
    expect(SchoolAdminPendingTeacherListResponseSchema.safeParse({ data: [], meta: { ...meta, totalItems: 0, from: null, to: null } }).success).toBe(true)
  })
  it('rejects a row with a non +08:00 timestamp or a missing name', () => {
    expect(SchoolAdminPendingTeacherListResponseSchema.safeParse({ data: [{ ...row, requestedAt: '2026-10-19T01:00:00Z' }], meta }).success).toBe(false)
    expect(SchoolAdminPendingTeacherListResponseSchema.safeParse({ data: [{ id: '12' }], meta }).success).toBe(false)
  })
  it('the verify result is always active and carries the BM status', () => {
    const ok = { data: { id: '12', isActive: true, schoolId: '3' }, status: SCHOOL_ADMIN_PENDING_TEACHER_FLASH.verified }
    expect(SchoolAdminVerifyTeacherResultSchema.safeParse(ok).success).toBe(true)
    expect(SchoolAdminVerifyTeacherResultSchema.safeParse({ ...ok, data: { ...ok.data, isActive: false } }).success).toBe(false)
    expect(SchoolAdminVerifyTeacherResultSchema.safeParse({ ...ok, status: '' }).success).toBe(false)
  })
  it('the notice fits the notification contract (system category)', () => {
    expect(SCHOOL_ADMIN_TEACHER_VERIFIED_NOTICE.category).toBe('system')
    expect(SCHOOL_ADMIN_TEACHER_VERIFIED_NOTICE.type.length).toBeLessThanOrEqual(64)
  })
  it('both operations and all components are in the OpenAPI document', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
    expect(doc.paths['/admin-sekolah/guru/pending']?.get).toBeDefined()
    expect(doc.paths['/admin-sekolah/guru/{id}/verify']?.post).toBeDefined()
    for (const id of Object.keys(SCHOOL_ADMIN_PENDING_COMPONENT_SCHEMAS)) expect(doc.components.schemas[id], id).toBeDefined()
  })
})
