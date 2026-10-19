import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { SUBSCRIPTION_COMPONENT_SCHEMAS } from '../paths'
import {
  CompBulkActionRequestSchema,
  CompStudentDetailSchema,
  CompStudentListItemSchema,
  CompStudentRegisterRequestSchema,
  QuotaSchema,
  SchoolPackageAssignRequestSchema,
  SchoolPackageSchema,
  StudentImportMultipartSchema,
  StudentImportRequestSchema,
  StudentImportResultSchema,
  SubscriptionCreateRequestSchema,
  SubscriptionDetailSchema,
  SubscriptionExtendRequestSchema,
  SubscriptionListMetaSchema,
  SubscriptionQuotaRequestSchema,
  SubscriptionRenewalInvoiceSchema,
  studentsImportedText,
  subscriptionStatusEnvelopeOf,
  SubscriptionUpgradeRefusalSchema,
  SubscriptionCancelRefusalSchema,
  SchoolPackageNotAdminRefusalSchema,
  StudentImportNoSubscriptionRefusalSchema,
  StudentImportQuotaShortRefusalSchema,
  StudentImportNoDataRefusalSchema,
  SubscriptionStudentsQuerySchema,
  CompStudentListQuerySchema,
  SubscriptionUpgradeRequestSchema,
  SUBSCRIPTION_MESSAGES,
  SCHOOL_PACKAGE_MESSAGES,
  STUDENT_IMPORT_MESSAGES,
  SubscriptionListQuerySchema,
  StudentImportTooLargeSchema,
  COMP_BULK_MAX_IDS,
  STUDENT_IMPORT_MAX_BYTES,
  STUDENT_IMPORT_MAX_ROWS,
} from '../schema'

const T = '2026-10-16T09:30:00+08:00'
const school = { id: '3', name: 'SMK Contoh', code: 'ABC1234', type: 'SMK', state: 'Selangor', district: null, city: null }
const pkg = {
  id: '2',
  code: 'T5',
  name: 'Pakej SPM Tingkatan 5',
  slug: 'spm-t5',
  educationLevel: 'spm',
  formLevel: 't5',
  priceAnnual: '30.00',
  maxRenewals: 0,
  isActive: true,
}
const detail = {
  id: '9',
  schoolId: '3',
  schoolPackageId: '2',
  packageTier: 'full',
  studentQuota: 1000,
  used: 40,
  status: 'active',
  startsAt: T,
  endsAt: '2027-10-16T09:30:00+08:00',
  questionLimit: null,
  paymentReference: null,
  paymentNotes: null,
  notes: null,
  createdAt: T,
  updatedAt: T,
  formLevel: 't5',
  remaining: 960,
  usedPercent: 4,
  school,
  package: pkg,
}
const meta = { page: 1, pageSize: 1, totalItems: 1, totalPages: 1, from: 1, to: 1 }

describe('BE-25 subscriptions contract', () => {
  it('parses mock-shaped subscription payloads', () => {
    expect(SchoolPackageSchema.safeParse(pkg).success).toBe(true)
    expect(SubscriptionDetailSchema.safeParse(detail).success).toBe(true)
    expect(subscriptionStatusEnvelopeOf(SubscriptionDetailSchema).safeParse({ data: detail, status: 'Langganan berjaya dicipta.' }).success).toBe(true)
    expect(SubscriptionListMetaSchema.safeParse({ ...meta, counts: { active: 1, grace: 0, expired: 0, totalQuota: 1000 } }).success).toBe(true)
    expect(
      SubscriptionRenewalInvoiceSchema.safeParse({
        ref: 'INV-9-20261016',
        date: T,
        school,
        packageName: pkg.name,
        currentPeriod: { start: T, end: T },
        renewalPeriod: { start: T, end: T },
        studentCount: 1,
        pricePerStudent: '30.00',
        total: '30.00',
      }).success,
    ).toBe(true)
  })

  it('rejects bad subscription input', () => {
    const ok = { schoolId: '3', packageTier: 'basic', schoolPackageId: '1', studentQuota: 100 }
    expect(SubscriptionCreateRequestSchema.safeParse(ok).success).toBe(true)
    expect(SubscriptionCreateRequestSchema.safeParse({ ...ok, studentQuota: 2001 }).success).toBe(false)
    expect(SubscriptionCreateRequestSchema.safeParse({ ...ok, studentQuota: 0 }).success).toBe(false)
    expect(SubscriptionCreateRequestSchema.safeParse({ ...ok, packageTier: 'gold' }).success).toBe(false)
    expect(SubscriptionQuotaRequestSchema.safeParse({ studentQuota: 1.5 }).success).toBe(false)
    expect(SubscriptionExtendRequestSchema.safeParse({ days: 365 }).success).toBe(true)
    expect(SubscriptionExtendRequestSchema.safeParse({ days: 366 }).success).toBe(false)
    expect(SubscriptionDetailSchema.safeParse({ ...detail, startsAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(SubscriptionDetailSchema.safeParse({ ...detail, status: 'paused' }).success).toBe(false)
    expect(SchoolPackageSchema.safeParse({ ...pkg, priceAnnual: '30' }).success).toBe(false)
  })

  it('models the quota union', () => {
    expect(QuotaSchema.safeParse({ hasSubscription: false }).success).toBe(true)
    expect(QuotaSchema.safeParse({ hasSubscription: true, quota: 100, used: 40, remaining: 60 }).success).toBe(true)
    expect(QuotaSchema.safeParse({ hasSubscription: true }).success).toBe(false)
  })

  it('validates user packages', () => {
    expect(SchoolPackageAssignRequestSchema.safeParse({ formLevel: 't4', packageId: '1', studentQuota: 150 }).success).toBe(true)
    expect(SchoolPackageAssignRequestSchema.safeParse({ formLevel: 'd1_d6', packageId: '1', studentQuota: 150 }).success).toBe(false)
  })

  it('validates complimentary students and never exposes a clear IC', () => {
    const item = {
      id: '70',
      name: 'Murid Percuma',
      username: '123456@prestasiplus.my',
      icMasked: 'xxxxxx-xx-xx56',
      schoolName: null,
      classLabel: '',
      teacherName: '',
      isActive: true,
      coinsEnabled: false,
      packageExpiresAt: '2026-12-31',
    }
    expect(CompStudentListItemSchema.safeParse(item).success).toBe(true)
    expect(CompStudentListItemSchema.safeParse({ ...item, icMasked: '900101015656' }).success).toBe(false)
    expect(
      CompStudentDetailSchema.safeParse({
        userId: '70', username: item.username, name: item.name, icMasked: null, classLevel: 'T5', isActive: true,
        coinsEnabled: true, packageExpiresAt: '2026-12-31', originalSchoolName: null, classLabel: '', teacherName: '',
        syilingBalance: 0, coinBalance: 0, classes: [{ name: 'Kelas 5A', classCode: 'AB12', subjectName: null, teacherName: '', status: 'active' }],
      }).success,
    ).toBe(true)
    expect(CompStudentRegisterRequestSchema.safeParse({ classroomId: '4', packageExpiresAt: '2026-12-31', students: 'Murid Percuma, 900101015656' }).success).toBe(true)
    expect(CompStudentRegisterRequestSchema.safeParse({ classroomId: '4', packageExpiresAt: '31/12/2026', students: 'x' }).success).toBe(false)
    expect(CompBulkActionRequestSchema.safeParse({ action: 'coins_on', ids: ['70'] }).success).toBe(true)
    expect(CompBulkActionRequestSchema.safeParse({ action: 'coins_on', ids: [] }).success).toBe(false)
    expect(CompBulkActionRequestSchema.safeParse({ action: 'delete', ids: ['70'] }).success).toBe(false)
  })

  it('validates the student import', () => {
    const req = { schoolId: '3', classLevel: 'T5', importMode: 'paste', pasteContent: 'Murid Ujian\nmurid@moe-dl.test\nrahsia' }
    expect(StudentImportRequestSchema.safeParse(req).success).toBe(true)
    expect(StudentImportMultipartSchema.safeParse({ ...req, schoolId: '3' }).success).toBe(true)
    expect(StudentImportRequestSchema.safeParse({ ...req, classLevel: 'T6' }).success).toBe(false)
    expect(StudentImportRequestSchema.safeParse({ ...req, importMode: 'xlsx' }).success).toBe(false)
    expect(StudentImportResultSchema.safeParse({ created: 1, skipped: 0, failed: 1, errors: [{ line: 4, message: 'Nama diperlukan.' }] }).success).toBe(true)
    expect(StudentImportResultSchema.safeParse({ created: 1, skipped: 0, failed: 1, errors: [{ line: 0, message: 'x' }] }).success).toBe(false)
    expect(studentsImportedText({ created: 2, skipped: 1 })).toBe('Import selesai: 2 pelajar didaftarkan, 1 dilangkau.')
  })

  const msg = (
    schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } },
    value: unknown,
    field: string,
  ) => schema.safeParse(value).error?.issues.find((i) => i.path[0] === field)?.message

  it('accepts what the mock coerces', () => {
    const ok = { schoolId: '3', packageTier: 'basic', schoolPackageId: '1', studentQuota: '100' }
    expect(SubscriptionCreateRequestSchema.safeParse(ok).success).toBe(true)
    expect(SubscriptionQuotaRequestSchema.safeParse({ studentQuota: ' 2000 ' }).success).toBe(true)
    expect(SubscriptionExtendRequestSchema.safeParse({ days: '30', reason: null }).success).toBe(true)
    expect(SchoolPackageAssignRequestSchema.safeParse({ formLevel: 't4', packageId: '1', studentQuota: '150' }).success).toBe(true)
    // perPage and page are never rejected (unknown perPage answers 50, a bad page is page 1).
    expect(SubscriptionStudentsQuerySchema.safeParse({ perPage: 'abc', page: '-4' }).success).toBe(true)
    expect(CompStudentListQuerySchema.safeParse({ page: 'x' }).success).toBe(true)
    expect(SubscriptionUpgradeRequestSchema.safeParse({}).success).toBe(true)
  })

  it('produces the exact mock copy for shape errors, per field', () => {
    const ok = { schoolId: '3', packageTier: 'basic', schoolPackageId: '1', studentQuota: 100 }
    const c = SubscriptionCreateRequestSchema
    expect(msg(c, { ...ok, studentQuota: 0 }, 'studentQuota')).toBe('The student quota field must be at least 1.')
    expect(msg(c, { ...ok, studentQuota: 2001 }, 'studentQuota')).toBe('The student quota field must not be greater than 2000.')
    expect(msg(c, { ...ok, studentQuota: '2001' }, 'studentQuota')).toBe('The student quota field must not be greater than 2000.')
    expect(msg(c, { ...ok, studentQuota: 1.5 }, 'studentQuota')).toBe('The student quota field must be an integer.')
    expect(msg(c, { ...ok, studentQuota: 'abc' }, 'studentQuota')).toBe('The student quota field must be an integer.')
    expect(msg(c, { ...ok, studentQuota: undefined }, 'studentQuota')).toBe('The student quota field is required.')
    expect(msg(c, { ...ok, packageTier: 'gold' }, 'packageTier')).toBe('The selected package tier is invalid.')
    expect(msg(c, { ...ok, packageTier: undefined }, 'packageTier')).toBe('The package tier field is required.')
    expect(msg(c, { ...ok, schoolId: undefined }, 'schoolId')).toBe('The school id field is required.')
    expect(msg(c, { ...ok, paymentNotes: 5 }, 'paymentNotes')).toBe('The payment notes field must be a string.')
    expect(msg(SubscriptionExtendRequestSchema, { days: 366 }, 'days')).toBe('The days field must not be greater than 365.')
    expect(msg(SubscriptionExtendRequestSchema, { days: 0 }, 'days')).toBe('The days field must be at least 1.')
    const reg = { classroomId: '1', packageExpiresAt: '2026-12-31', students: 'x' }
    expect(msg(CompStudentRegisterRequestSchema, { ...reg, packageExpiresAt: '31/12/2026' }, 'packageExpiresAt')).toBe(
      'The package expires at field must be a valid date.',
    )
    expect(msg(CompStudentRegisterRequestSchema, { ...reg, students: undefined }, 'students')).toBe('The students field is required.')
    expect(msg(CompBulkActionRequestSchema, { action: 'x', ids: ['1'] }, 'action')).toBe('The selected action is invalid.')
    expect(msg(CompBulkActionRequestSchema, { action: 'activate', ids: [] }, 'ids')).toBe('The ids field is required.')
    const imp = { schoolId: '3', classLevel: 'T5', importMode: 'csv' }
    expect(msg(StudentImportRequestSchema, { ...imp, schoolId: undefined }, 'schoolId')).toBe('The school id field is required.')
    expect(msg(StudentImportRequestSchema, { ...imp, classLevel: undefined }, 'classLevel')).toBe('The class level field is required.')
    expect(msg(StudentImportRequestSchema, { ...imp, classLevel: 'T6' }, 'classLevel')).toBe('The selected class level is invalid.')
    expect(msg(StudentImportRequestSchema, { ...imp, importMode: undefined }, 'importMode')).toBe('The import mode field is required.')
    expect(msg(StudentImportRequestSchema, { ...imp, importMode: 'xlsx' }, 'importMode')).toBe('The selected import mode is invalid.')
  })

  it('pins the BM copy and field of the state-dependent 422s', () => {
    const refusal = (field: string, message: string) => ({ error: { code: 'VALIDATION_ERROR', message, fields: { [field]: message } } })
    const cases: [{ safeParse: (v: unknown) => { success: boolean } }, string, string][] = [
      [SubscriptionUpgradeRefusalSchema, 'packageTier', SUBSCRIPTION_MESSAGES.notBasic],
      [SubscriptionCancelRefusalSchema, 'status', SUBSCRIPTION_MESSAGES.alreadyCancelled],
      [SchoolPackageNotAdminRefusalSchema, 'id', SCHOOL_PACKAGE_MESSAGES.notSchoolAdmin],
      [StudentImportNoSubscriptionRefusalSchema, 'schoolId', STUDENT_IMPORT_MESSAGES.noSubscription],
      [StudentImportQuotaShortRefusalSchema, 'schoolId', STUDENT_IMPORT_MESSAGES.quotaShort],
      [StudentImportNoDataRefusalSchema, 'csvFile', STUDENT_IMPORT_MESSAGES.noData],
      [StudentImportNoDataRefusalSchema, 'pasteContent', STUDENT_IMPORT_MESSAGES.noData],
    ]
    for (const [schema, field, message] of cases) {
      expect(schema.safeParse(refusal(field, message)).success, `${field} ${message}`).toBe(true)
      expect(schema.safeParse(refusal(field, 'lain')).success).toBe(false)
      expect(schema.safeParse(refusal('other', message)).success).toBe(false)
    }
    expect(SUBSCRIPTION_MESSAGES.notBasic).toBe('Hanya langganan Pemantauan boleh dinaik taraf.')
    expect(SCHOOL_PACKAGE_MESSAGES.notSchoolAdmin).toBe('Pengguna ini bukan admin sekolah.')
  })

  it('applies the security limits', () => {
    // free text and search are bounded
    const ok = { schoolId: '3', packageTier: 'basic', schoolPackageId: '1', studentQuota: 100 }
    expect(SubscriptionCreateRequestSchema.safeParse({ ...ok, paymentReference: 'x'.repeat(255) }).success).toBe(true)
    expect(SubscriptionCreateRequestSchema.safeParse({ ...ok, paymentReference: 'x'.repeat(256) }).success).toBe(false)
    expect(SubscriptionCreateRequestSchema.safeParse({ ...ok, paymentNotes: 'x'.repeat(1001) }).success).toBe(false)
    expect(SubscriptionQuotaRequestSchema.safeParse({ studentQuota: 5, notes: 'x'.repeat(1001) }).success).toBe(false)
    expect(SubscriptionExtendRequestSchema.safeParse({ days: 5, reason: 'x'.repeat(1001) }).success).toBe(false)
    expect(SubscriptionListQuerySchema.safeParse({ search: 'x'.repeat(100) }).success).toBe(true)
    expect(SubscriptionListQuerySchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
    // bulk ids and import size are bounded
    const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1))
    expect(CompBulkActionRequestSchema.safeParse({ action: 'activate', ids: ids(COMP_BULK_MAX_IDS) }).success).toBe(true)
    expect(CompBulkActionRequestSchema.safeParse({ action: 'activate', ids: ids(COMP_BULK_MAX_IDS + 1) }).success).toBe(false)
    const imp = { schoolId: '3', classLevel: 'T5', importMode: 'csv' }
    expect(StudentImportRequestSchema.safeParse({ ...imp, csvFile: 'x'.repeat(STUDENT_IMPORT_MAX_BYTES) }).success).toBe(true)
    expect(StudentImportRequestSchema.safeParse({ ...imp, csvFile: 'x'.repeat(STUDENT_IMPORT_MAX_BYTES + 1) }).success).toBe(false)
    expect(STUDENT_IMPORT_MAX_ROWS).toBe(1000)
    expect(STUDENT_IMPORT_MESSAGES.tooLarge).toBe('Fail import melebihi had yang dibenarkan.')
    const tooLarge = (message: string, code = 'PAYLOAD_TOO_LARGE') => ({ error: { code, message } })
    expect(StudentImportTooLargeSchema.safeParse(tooLarge(STUDENT_IMPORT_MESSAGES.tooLarge)).success).toBe(true)
    expect(StudentImportTooLargeSchema.safeParse(tooLarge('lain')).success).toBe(false)
    expect(StudentImportTooLargeSchema.safeParse(tooLarge(STUDENT_IMPORT_MESSAGES.tooLarge, 'VALIDATION_ERROR')).success).toBe(false)
  })

  it('keeps the roster and idDelima out of the invoice', () => {
    const invoice = {
      ref: 'INV-9-20261016', date: T, school, packageName: pkg.name,
      currentPeriod: { start: T, end: T }, renewalPeriod: { start: T, end: T },
      studentCount: 1, pricePerStudent: '30.00', total: '30.00',
    }
    const parsed = SubscriptionRenewalInvoiceSchema.parse({ ...invoice, students: [{ no: 1, name: 'Murid Ujian', idDelima: 'a@b.test' }] })
    expect('students' in parsed).toBe(false)
  })

  it('documents 429 on writes, 413 on the import and no-store on personal data', () => {
    type Doc = { paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>> }
    const doc = buildOpenApiDocument() as unknown as Doc
    const writes: [string, string][] = [
      ['/admin/school-subscriptions', 'post'],
      ['/admin/school-subscriptions/{id}/quota', 'put'],
      ['/admin/school-subscriptions/{id}/extend', 'post'],
      ['/admin/school-subscriptions/{id}/upgrade', 'post'],
      ['/admin/school-subscriptions/{id}/cancel', 'post'],
      ['/admin/students/import', 'post'],
      ['/admin/users/{id}/packages', 'post'],
      ['/admin/comp-students', 'post'],
      ['/admin/comp-students/bulk-action', 'post'],
      ['/admin/comp-students/{id}/toggle-coins', 'post'],
      ['/admin/comp-students/{id}/toggle-active', 'post'],
    ]
    for (const [path, method] of writes) {
      const r = doc.paths[path]?.[method]?.responses['429']
      expect(r, `429 ${method} ${path}`).toBeDefined()
      expect(Object.keys(r?.headers ?? {})).toContain('Retry-After')
    }
    expect(doc.paths['/admin/students/import']?.post?.responses['413']).toBeDefined()
    expect(JSON.stringify(doc.paths['/admin/students/import']?.post?.responses['413'])).toContain('StudentImportTooLarge')
    for (const path of ['/admin/school-subscriptions/{id}/renewal-invoice', '/admin/school-subscriptions/{id}/students', '/admin/comp-students', '/admin/comp-students/{id}']) {
      expect(Object.keys(doc.paths[path]?.get?.responses['200']?.headers ?? {}), path).toContain('Cache-Control')
    }
  })

  it('registers every path and component in the OpenAPI document', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
    const expected: [string, string][] = [
      ['/admin/school-packages', 'get'],
      ['/admin/school-subscriptions', 'get'],
      ['/admin/school-subscriptions', 'post'],
      ['/admin/school-subscriptions/{id}', 'get'],
      ['/admin/school-subscriptions/{id}/students', 'get'],
      ['/admin/school-subscriptions/{id}/renewal-invoice', 'get'],
      ['/admin/school-subscriptions/{id}/quota', 'put'],
      ['/admin/school-subscriptions/{id}/extend', 'post'],
      ['/admin/school-subscriptions/{id}/upgrade', 'post'],
      ['/admin/school-subscriptions/{id}/cancel', 'post'],
      ['/admin/schools/{id}/quota', 'get'],
      ['/admin/students/import', 'post'],
      ['/admin/users/{id}/packages', 'get'],
      ['/admin/users/{id}/packages', 'post'],
      ['/admin/comp-students', 'get'],
      ['/admin/comp-students', 'post'],
      ['/admin/comp-students/{id}', 'get'],
      ['/admin/comp-students/{id}/toggle-active', 'post'],
      ['/admin/comp-students/{id}/toggle-coins', 'post'],
      ['/admin/comp-students/bulk-action', 'post'],
    ]
    for (const [path, method] of expected) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    for (const name of Object.keys(SUBSCRIPTION_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name], name).toBeDefined()
  })
})
