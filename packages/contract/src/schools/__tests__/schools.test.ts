import { describe, expect, it } from 'vitest'

import {
  AdminSchoolSchema,
  ExistingStudentSchema,
  JpnSchema,
  PpdSchema,
  SchoolInputSchema,
  SchoolListMetaSchema,
  SchoolListQuerySchema,
  SchoolOptionsQuerySchema,
  SchoolSearchQuerySchema,
  SchoolSummarySchema,
} from '../schema'
import { buildOpenApiDocument } from '../../openapi'

const summary = {
  id: '10',
  name: 'SK Contoh Satu',
  code: 'ABC0001',
  type: 'SK',
  state: 'Johor',
  district: 'PPD CONTOH',
  city: null,
}
const admin = {
  ...summary,
  joinCode: 'JOIN-0001',
  isActive: true,
  createdAt: '2026-10-16T09:30:00+08:00',
  updatedAt: '2026-10-16T09:30:00+08:00',
  studentCount: 12,
  teacherCount: 3,
}

describe('school records', () => {
  it('parses summary and admin shapes (string ids, +08:00)', () => {
    expect(SchoolSummarySchema.parse(summary)).toEqual(summary)
    expect(AdminSchoolSchema.parse(admin).joinCode).toBe('JOIN-0001')
  })
  it('rejects numeric ids, unknown types and non +08:00 timestamps', () => {
    expect(SchoolSummarySchema.safeParse({ ...summary, id: 10 }).success).toBe(false)
    expect(SchoolSummarySchema.safeParse({ ...summary, type: 'XX' }).success).toBe(false)
    expect(AdminSchoolSchema.safeParse({ ...admin, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
  })
  it('does not leak legacy columns or the join code through the public summary', () => {
    const out = SchoolSummarySchema.parse({ ...summary, joinCode: 'X', legacy_id: '1', legacy_source: 'cloud' })
    expect(out).not.toHaveProperty('joinCode')
    expect(out).not.toHaveProperty('legacy_id')
    expect(out).not.toHaveProperty('legacy_source')
  })
  it('list meta carries counts and types', () => {
    const meta = { page: 1, pageSize: 30, totalItems: 2, totalPages: 1, from: 1, to: 2, counts: { total: 2, active: 1, inactive: 1 }, types: ['SK'] }
    expect(SchoolListMetaSchema.parse(meta).counts.total).toBe(2)
    expect(SchoolListMetaSchema.safeParse({ ...meta, counts: { total: 2 } }).success).toBe(false)
  })
})

describe('school input', () => {
  const input = { name: 'SK Baru', code: 'NEW1', type: 'SMK', state: 'Kedah' }
  it('accepts a minimal body and optional district/city/isActive', () => {
    expect(SchoolInputSchema.safeParse(input).success).toBe(true)
    expect(SchoolInputSchema.safeParse({ ...input, district: '', city: null, isActive: false }).success).toBe(true)
  })
  it('rejects missing fields, long code and bad type', () => {
    expect(SchoolInputSchema.safeParse({ ...input, name: '' }).success).toBe(false)
    expect(SchoolInputSchema.safeParse({ ...input, code: 'x'.repeat(21) }).success).toBe(false)
    expect(SchoolInputSchema.safeParse({ ...input, type: 'Swasta' }).success).toBe(false)
    expect(SchoolInputSchema.safeParse({ name: 'a', code: 'b', type: 'SK' }).success).toBe(false)
  })
})

const msg = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, path: string) =>
  r.error?.issues.find((i) => i.path.join('.') === path)?.message

describe('school validation copy (mock messages)', () => {
  const input = { name: 'SK Baru', code: 'NEW1', type: 'SMK', state: 'Kedah' }
  it('required fields', () => {
    expect(msg(SchoolInputSchema.safeParse({}), 'name')).toBe('The name field is required.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, name: '  ' }), 'name')).toBe('The name field is required.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, code: undefined }), 'code')).toBe('The code field is required.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, type: undefined }), 'type')).toBe('The type field is required.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, state: undefined }), 'state')).toBe('The state field is required.')
  })
  it('max, enum, string and boolean copy', () => {
    expect(msg(SchoolInputSchema.safeParse({ ...input, name: 'x'.repeat(256) }), 'name')).toBe('The name field must not be greater than 255 characters.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, code: 'x'.repeat(21) }), 'code')).toBe('The code field must not be greater than 20 characters.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, type: 'Swasta' }), 'type')).toBe('The selected type is invalid.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, name: 5 }), 'name')).toBe('The name field must be a string.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, district: 5 }), 'district')).toBe('The district field must be a string.')
    expect(msg(SchoolInputSchema.safeParse({ ...input, isActive: 'maybe' }), 'isActive')).toBe('The is active field must be true or false.')
  })
  it('accepts the Laravel booleans', () => {
    for (const v of [true, false, 1, 0, '1', '0']) expect(SchoolInputSchema.safeParse({ ...input, isActive: v }).success, String(v)).toBe(true)
  })
  it('options query: all=1 required copy', () => {
    expect(msg(SchoolOptionsQuerySchema.safeParse({}), 'all')).toBe('The all field is required.')
  })
})

describe('queries and lookups', () => {
  it('list query never rejects a page value (the server treats a bad one as 1)', () => {
    expect(SchoolListQuerySchema.safeParse({}).success).toBe(true)
    expect(SchoolListQuerySchema.safeParse({ page: 'abc', state: 'Johor' }).success).toBe(true)
    expect(SchoolListQuerySchema.safeParse({ page: '0' }).success).toBe(true)
  })
  it('options query needs all=1', () => {
    expect(SchoolOptionsQuerySchema.safeParse({ all: '1' }).success).toBe(true)
    expect(SchoolOptionsQuerySchema.safeParse({}).success).toBe(false)
    expect(SchoolOptionsQuerySchema.safeParse({ all: '0' }).success).toBe(false)
  })
  it('search query ignores a bad limit instead of rejecting it', () => {
    expect(SchoolSearchQuerySchema.safeParse({ q: 'sk', limit: '15' }).success).toBe(true)
    expect(SchoolSearchQuerySchema.safeParse({ limit: '0' }).success).toBe(true)
    expect(SchoolSearchQuerySchema.safeParse({ limit: 'x' }).success).toBe(true)
  })
  it('JPN and PPD', () => {
    expect(JpnSchema.safeParse({ id: '1', code: 'JHR', name: 'Johor' }).success).toBe(true)
    expect(PpdSchema.safeParse({ id: '5', jpnId: '1', code: 'PPD CONTOH', name: 'PPD Contoh' }).success).toBe(true)
    expect(PpdSchema.safeParse({ id: '5', jpnId: 1, code: 'PPD CONTOH', name: 'PPD Contoh' }).success).toBe(false)
  })
  it('existing student row', () => {
    const row = { id: '7', name: 'Murid Ujian', email: null, idDelima: null, classLevel: 'T4', isActive: true }
    expect(ExistingStudentSchema.safeParse(row).success).toBe(true)
    expect(ExistingStudentSchema.safeParse({ ...row, classLevel: 'T6' }).success).toBe(false)
  })
})

describe('OpenAPI registration', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
  it('contains every school path and method', () => {
    const expected: [string, string][] = [
      ['/admin/schools', 'get'],
      ['/admin/schools', 'post'],
      ['/admin/schools/options', 'get'],
      ['/admin/schools/{id}', 'get'],
      ['/admin/schools/{id}', 'put'],
      ['/admin/schools/{id}/toggle', 'post'],
      ['/admin/schools/{id}/students', 'get'],
      ['/schools', 'get'],
      ['/schools/search', 'get'],
      ['/jpn', 'get'],
      ['/jpn/{id}/ppd', 'get'],
    ]
    for (const [path, method] of expected) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
  })
  it('contains the school components', () => {
    for (const name of ['SchoolSummary', 'AdminSchool', 'SchoolInput', 'SchoolListMeta', 'Jpn', 'Ppd', 'ExistingStudent'])
      expect(doc.components.schemas[name], name).toBeDefined()
  })
  it('never exposes legacy columns', () => {
    expect(JSON.stringify(doc.components.schemas)).not.toMatch(/legacy_/)
  })
})
