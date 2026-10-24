import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf, listEnvelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { NoStoreHeaderSchema, RateLimitedBodySchema, RetryAfterHeaderSchema } from './validation'
import {
  CompBulkActionRequestSchema,
  CompBulkActionResultSchema,
  CompBulkActionSchema,
  CompIcMaskedSchema,
  CompStudentClassSchema,
  CompStudentDetailSchema,
  CompStudentListItemSchema,
  CompStudentListMetaSchema,
  CompStudentListQuerySchema,
  CompStudentRegisterRequestSchema,
  CompToggleActiveResultSchema,
  CompToggleCoinsResultSchema,
  QuotaSchema,
  SchoolPackageAdminFormLevelSchema,
  SchoolPackageAssignRequestSchema,
  SchoolPackageAssignmentSchema,
  SchoolPackageCardSchema,
  SchoolPackageFormLevelSchema,
  SchoolPackageSchema,
  SchoolPackageUserViewSchema,
  StudentImportClassLevelSchema,
  StudentImportModeSchema,
  StudentImportMultipartSchema,
  StudentImportRequestSchema,
  StudentImportResultSchema,
  StudentImportRowErrorSchema,
  SchoolPackageNotAdminRefusalSchema,
  StudentImportNoDataRefusalSchema,
  StudentImportTooLargeSchema,
  StudentImportNoSubscriptionRefusalSchema,
  StudentImportQuotaShortRefusalSchema,
  SubscriptionCancelRefusalSchema,
  SubscriptionUpgradeRefusalSchema,
  SubscriptionCreateRequestSchema,
  SubscriptionDetailSchema,
  SubscriptionExtendRequestSchema,
  SubscriptionListItemSchema,
  SubscriptionListMetaSchema,
  SubscriptionListQuerySchema,
  SubscriptionQuotaRequestSchema,
  SubscriptionRenewalInvoiceSchema,
  SubscriptionSchoolSchema,
  SubscriptionStatusSchema,
  SubscriptionStudentSchema,
  SubscriptionStudentsQuerySchema,
  SubscriptionTierSchema,
  SubscriptionUpgradeRequestSchema,
  subscriptionStatusEnvelopeOf as statusEnvelopeOf,
} from './schema'

/** Components contributed by BE-25 (subscriptions and the rest of M02); appended in openapi.ts. */
export const SUBSCRIPTION_COMPONENT_SCHEMAS = {
  SubscriptionSchool: SubscriptionSchoolSchema,
  SubscriptionStatus: SubscriptionStatusSchema,
  SubscriptionTier: SubscriptionTierSchema,
  SchoolPackageFormLevel: SchoolPackageFormLevelSchema,
  SchoolPackage: SchoolPackageSchema,
  SubscriptionListQuery: SubscriptionListQuerySchema,
  SubscriptionListItem: SubscriptionListItemSchema,
  SubscriptionListMeta: SubscriptionListMetaSchema,
  SubscriptionDetail: SubscriptionDetailSchema,
  SubscriptionCreateRequest: SubscriptionCreateRequestSchema,
  SubscriptionQuotaRequest: SubscriptionQuotaRequestSchema,
  SubscriptionExtendRequest: SubscriptionExtendRequestSchema,
  SubscriptionUpgradeRequest: SubscriptionUpgradeRequestSchema,
  SubscriptionStudentsQuery: SubscriptionStudentsQuerySchema,
  SubscriptionStudent: SubscriptionStudentSchema,
  SubscriptionRenewalInvoice: SubscriptionRenewalInvoiceSchema,
  SchoolQuota: QuotaSchema,
  SchoolPackageAdminFormLevel: SchoolPackageAdminFormLevelSchema,
  SchoolPackageCard: SchoolPackageCardSchema,
  SchoolPackageUserView: SchoolPackageUserViewSchema,
  SchoolPackageAssignRequest: SchoolPackageAssignRequestSchema,
  SchoolPackageAssignment: SchoolPackageAssignmentSchema,
  CompIcMasked: CompIcMaskedSchema,
  CompStudentListQuery: CompStudentListQuerySchema,
  CompStudentListItem: CompStudentListItemSchema,
  CompStudentListMeta: CompStudentListMetaSchema,
  CompStudentClass: CompStudentClassSchema,
  CompStudentDetail: CompStudentDetailSchema,
  CompStudentRegisterRequest: CompStudentRegisterRequestSchema,
  CompBulkAction: CompBulkActionSchema,
  CompBulkActionRequest: CompBulkActionRequestSchema,
  CompBulkActionResult: CompBulkActionResultSchema,
  CompToggleCoinsResult: CompToggleCoinsResultSchema,
  CompToggleActiveResult: CompToggleActiveResultSchema,
  StudentImportRowError: StudentImportRowErrorSchema,
  StudentImportResult: StudentImportResultSchema,
  StudentImportClassLevel: StudentImportClassLevelSchema,
  StudentImportMode: StudentImportModeSchema,
  StudentImportRequest: StudentImportRequestSchema,
  StudentImportMultipartRequest: StudentImportMultipartSchema,
  RateLimitedBody: RateLimitedBodySchema,
  StudentImportTooLarge: StudentImportTooLargeSchema,
  SubscriptionUpgradeRefusal: SubscriptionUpgradeRefusalSchema,
  SubscriptionCancelRefusal: SubscriptionCancelRefusalSchema,
  SchoolPackageNotAdminRefusal: SchoolPackageNotAdminRefusalSchema,
  StudentImportNoSubscriptionRefusal: StudentImportNoSubscriptionRefusalSchema,
  StudentImportQuotaShortRefusal: StudentImportQuotaShortRefusalSchema,
  StudentImportNoDataRefusal: StudentImportNoDataRefusalSchema,
} as const

const json = (schema: z.ZodType, description: string, headers?: z.ZodObject) => ({
  description,
  content: { 'application/json': { schema } },
  ...(headers ? { headers } : {}),
})
const err = (description: string) => json(ErrorBodySchema, description)
const idParam = z.object({ id: z.string().min(1).meta({ description: 'Opaque entity id.' }) })

/** Registers the BE-25 endpoints (all `admin` only, except where noted by the parent-invite paths). */
export function registerSubscriptionPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const forbidden = err('FORBIDDEN: only the central admin role may call this route (a school_admin gets 403), or CSRF_INVALID on mutations.')
  const limited = json(RateLimitedBodySchema, 'RATE_LIMITED, with retryAfter and the Retry-After header (D57a).', RetryAfterHeaderSchema)
  const noStore = NoStoreHeaderSchema
  const notFound = err('NOT_FOUND.')
  const invalid = err('VALIDATION_ERROR with `fields`.')
  const body = (schema: z.ZodType, required = true) => ({
    required,
    content: { 'application/json': { schema } },
  })
  const subTags = ['school-subscriptions']
  const compTags = ['comp-students']

  const get = (path: string, summary: string, responses: Record<number, ReturnType<typeof json>>, extra = {}) =>
    registry.registerPath({ method: 'get', path, tags: subTags, summary, responses, ...extra })

  get('/admin/school-packages', 'The school packages (4 rows)', {
    200: json(envelopeOf(z.array(SchoolPackageSchema)), 'Packages.'),
    401: unauthorized,
    403: forbidden,
  })

  get(
    '/admin/school-subscriptions',
    'All school subscriptions, newest first (not paginated)',
    { 200: json(z.object({ data: z.array(SubscriptionListItemSchema), meta: SubscriptionListMetaSchema }), 'Rows.', noStore), 401: unauthorized, 403: forbidden },
    { request: { query: SubscriptionListQuerySchema } },
  )

  get(
    '/admin/school-subscriptions/{id}',
    'One subscription with its school and package',
    { 200: json(envelopeOf(SubscriptionDetailSchema), 'The subscription.'), 401: unauthorized, 403: forbidden, 404: notFound },
    { request: { params: idParam } },
  )

  get(
    '/admin/school-subscriptions/{id}/students',
    'Students of the subscription school (active and inactive, by name)',
    { 200: json(listEnvelopeOf(SubscriptionStudentSchema), 'A page; meta.pageSize is the size used.', noStore), 401: unauthorized, 403: forbidden, 404: notFound },
    { request: { params: idParam, query: SubscriptionStudentsQuerySchema } },
  )

  get(
    '/admin/school-subscriptions/{id}/renewal-invoice',
    'Renewal invoice data',
    { 200: json(envelopeOf(SubscriptionRenewalInvoiceSchema), 'The invoice.', noStore), 401: unauthorized, 403: forbidden, 404: notFound },
    { request: { params: idParam } },
  )

  registry.registerPath({
    method: 'post',
    path: '/admin/school-subscriptions',
    tags: subTags,
    summary: 'Create a subscription',
    description:
      'status: "Langganan berjaya dicipta.". New row is active from now; basic ends in 1 month with questionLimit 500, full in 12 months with no limit.',
    request: { body: body(SubscriptionCreateRequestSchema) },
    responses: { 201: json(statusEnvelopeOf(SubscriptionDetailSchema), 'Created.'), 401: unauthorized, 403: forbidden, 422: invalid, 429: limited },
  })

  const mutation = (
    method: 'post' | 'put',
    path: string,
    summary: string,
    description: string,
    bodySchema: z.ZodType | null,
    invalidText = 'VALIDATION_ERROR with `fields` (mock English templates).',
    refusal?: z.ZodType,
  ) =>
    registry.registerPath({
      method,
      path,
      tags: subTags,
      summary,
      description,
      request: bodySchema ? { params: idParam, body: body(bodySchema, method === 'put' || path.endsWith('/extend')) } : { params: idParam },
      responses: {
        200: json(statusEnvelopeOf(SubscriptionDetailSchema), 'Updated subscription.'),
        401: unauthorized,
        403: forbidden,
        404: notFound,
        422: refusal ? json(z.union([refusal, ErrorBodySchema]), invalidText) : err(invalidText),
        429: limited,
      },
    })

  mutation(
    'put',
    '/admin/school-subscriptions/{id}/quota',
    'Change the student quota',
    'status: "Kuota berjaya dikemaskini.". Works on any status; a history line is appended to notes only when a reason is given.',
    SubscriptionQuotaRequestSchema,
  )
  mutation(
    'post',
    '/admin/school-subscriptions/{id}/extend',
    'Extend the period by days',
    'status: "Tempoh langganan berjaya dilanjutkan.". An expired or grace row whose new end is in the future becomes active; a cancelled row is never reactivated.',
    SubscriptionExtendRequestSchema,
  )
  mutation(
    'post',
    '/admin/school-subscriptions/{id}/upgrade',
    'Upgrade a Pemantauan (basic) subscription to Penuh (full)',
    'status: "Langganan berjaya dinaik taraf.". Sets full, no question limit, 12 months from now, active.',
    SubscriptionUpgradeRequestSchema,
    '422 VALIDATION_ERROR: `fields.packageTier` "Hanya langganan Pemantauan boleh dinaik taraf." unless the tier is basic.',
    SubscriptionUpgradeRefusalSchema,
  )
  mutation(
    'post',
    '/admin/school-subscriptions/{id}/cancel',
    'Cancel a subscription',
    'status: "Langganan berjaya dibatalkan.".',
    null,
    '422 VALIDATION_ERROR: `fields.status` "Langganan ini sudah dibatalkan." when already cancelled.',
    SubscriptionCancelRefusalSchema,
  )

  registry.registerPath({
    method: 'get',
    path: '/admin/schools/{id}/quota',
    tags: subTags,
    summary: 'Student quota of a school',
    description: 'quota = studentQuota of the latest-starting active (or grace) subscription; used counts active and inactive students.',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(QuotaSchema), 'The quota.'), 401: unauthorized, 403: forbidden, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/students/import',
    tags: subTags,
    summary: 'Import students from DELIMa text (CSV or paste)',
    description:
      'status: "Import selesai: {created} pelajar didaftarkan, {skipped} dilangkau.". 422 `fields.schoolId`: "Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan." (no active or grace subscription) or "Kuota tidak mencukupi." (new records exceed the remaining quota; the whole import is refused). 422 `fields.csvFile` / `fields.pasteContent`: "Tiada data untuk diimport.". Central admin only. v2 limits (security review): at most 1000 rows and 1 MB, else 413 PAYLOAD_TOO_LARGE. The server hashes the DELIMa passwords on arrival, never logs the body and never echoes a row or password (errors carry only line and message); the quota check and the inserts run in one transaction with a lock. Rate limited (bulk account creation).',
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: StudentImportRequestSchema },
          'multipart/form-data': { schema: StudentImportMultipartSchema },
        },
      },
    },
    responses: {
      200: json(statusEnvelopeOf(StudentImportResultSchema), 'Result.'),
      401: unauthorized,
      403: forbidden,
      422: json(
        z.union([StudentImportNoSubscriptionRefusalSchema, StudentImportQuotaShortRefusalSchema, StudentImportNoDataRefusalSchema, ErrorBodySchema]),
        'VALIDATION_ERROR: the BM refusals above, or `fields` with the mock English templates (school id, class level, import mode).',
      ),
      413: json(StudentImportTooLargeSchema, 'PAYLOAD_TOO_LARGE "Fail import melebihi had yang dibenarkan.": more than 1000 rows or 1 MB (v2 limits; the mock has none).'),
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/users/{id}/packages',
    tags: subTags,
    summary: 'Package cards of a school admin',
    description: '422 `fields.id` "Pengguna ini bukan admin sekolah." when the user is not a school admin.',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(SchoolPackageUserViewSchema), 'Cards.'), 401: unauthorized, 403: forbidden, 404: notFound, 422: json(SchoolPackageNotAdminRefusalSchema, '422 `fields.id` "Pengguna ini bukan admin sekolah.".') },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/users/{id}/packages',
    tags: subTags,
    summary: 'Assign a package quota to a school admin (upsert per user and form level)',
    description: 'status: "Pakej berjaya ditetapkan.". 422 `fields.id` "Pengguna ini bukan admin sekolah." when the user is not a school admin.',
    request: { params: idParam, body: body(SchoolPackageAssignRequestSchema) },
    responses: {
      200: json(statusEnvelopeOf(SchoolPackageAssignmentSchema), 'Assigned.'),
      401: unauthorized,
      403: forbidden,
      404: notFound,
      422: json(z.union([SchoolPackageNotAdminRefusalSchema, ErrorBodySchema]), 'Not a school admin (BM copy), or `fields` with the mock English templates.'),
      429: limited,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/comp-students',
    tags: compTags,
    summary: 'Complimentary students, newest first (50 per page)',
    request: { query: CompStudentListQuerySchema },
    responses: {
      200: json(z.object({ data: z.array(CompStudentListItemSchema), meta: CompStudentListMetaSchema }), 'A page.', noStore),
      401: unauthorized,
      403: forbidden,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/comp-students',
    tags: compTags,
    summary: 'Register complimentary students from "NAMA, NOKP" lines',
    description:
      'status: "{n} pelajar komplimen berjaya didaftarkan.". Failed lines: "Format baris tidak sah. Gunakan NAMA, NOKP." and "No. KP mesti sekurang-kurangnya 6 digit.". The login e-mail is generated by the server and is not derived from the IC (v2; the mock used the last 6 IC digits + @prestasiplus.my); the initial password is random and nobody is shown it (R39: no must_reset_password flag; the pupil signs in after the IC-based reset); a login that already exists or repeats is skipped. Central admin only. Rate limited.',
    request: { body: body(CompStudentRegisterRequestSchema) },
    responses: {
      201: json(statusEnvelopeOf(StudentImportResultSchema), 'Result.'),
      401: unauthorized,
      403: forbidden,
      422: invalid,
      429: limited,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/comp-students/bulk-action',
    tags: compTags,
    summary: 'Bulk coins or active switch on complimentary students',
    description: 'status: "Tindakan berjaya dilaksanakan.". Ids that are not complimentary students are ignored. Every change is audited with the actor.',
    request: { body: body(CompBulkActionRequestSchema) },
    responses: { 200: json(statusEnvelopeOf(CompBulkActionResultSchema), 'Applied.'), 401: unauthorized, 403: forbidden, 422: invalid, 429: limited },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/comp-students/{id}',
    tags: compTags,
    summary: 'One complimentary student with enrolments',
    description: '404 unless the id is a complimentary student.',
    request: { params: idParam },
    responses: { 200: json(envelopeOf(CompStudentDetailSchema), 'The student.', noStore), 401: unauthorized, 403: forbidden, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/comp-students/{id}/toggle-coins',
    tags: compTags,
    summary: 'Flip coins on or off',
    description: 'status: "Tindakan berjaya dilaksanakan.". Audited with the actor.',
    request: { params: idParam },
    responses: { 200: json(statusEnvelopeOf(CompToggleCoinsResultSchema), 'New value.'), 401: unauthorized, 403: forbidden, 404: notFound, 429: limited },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/comp-students/{id}/toggle-active',
    tags: compTags,
    summary: 'Flip the active flag',
    description: 'status: "Tindakan berjaya dilaksanakan.". Audited with the actor.',
    request: { params: idParam },
    responses: { 200: json(statusEnvelopeOf(CompToggleActiveResultSchema), 'New value.'), 401: unauthorized, 403: forbidden, 404: notFound, 429: limited },
  })
}
