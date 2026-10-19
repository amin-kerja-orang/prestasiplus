import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { ErrorBodySchema } from '../../../common/error'
import { ANALYTICS_COMPONENT_SCHEMAS } from '../paths'
import {
  ANALYTICS_ERROR_MESSAGES,
  ANALYTICS_MESSAGES,
  AnalyticsExportQuerySchema,
  AnalyticsItemAnalysisQuerySchema,
  AnalyticsItemAnalysisSchema,
  AnalyticsMonitoringExportSchema,
  AnalyticsMonitoringOverviewSchema,
  AnalyticsSchoolDetailSchema,
  AnalyticsStudentDetailSchema,
  AnalyticsTeacherDetailSchema,
  AnalyticsTeacherReportQuerySchema,
  AnalyticsTeacherReportSchema,
} from '../schema'

/**
 * Payloads in `fixtures/` were captured from the real M11 mock (booted with its owners, project
 * clock) by a one-off vitest run that called the mock transport; arrays are cut to 25 items by the
 * generator. They carry the mock's numeric ids, so `wire()` stringifies id fields the way the v2
 * backend sends them (Id is an opaque string).
 */
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), 'utf8'))

const ID_KEY = /^(id|[a-z]+Id)$/
const wire = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(wire)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ID_KEY.test(k) && typeof x === 'number' ? String(x) : wire(x)]))
      : v

const fieldsOf = (r: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))

type Captured = Record<string, { status: number; headers: Record<string, string>; body: unknown }>

describe('M11 payloads captured from the mock', () => {
  const cases: [string, { parse: (v: unknown) => unknown }][] = [
    ['overview', AnalyticsMonitoringOverviewSchema],
    ['overview-filtered', AnalyticsMonitoringOverviewSchema],
    ['overview-school-admin', AnalyticsMonitoringOverviewSchema],
    ['school-detail', AnalyticsSchoolDetailSchema],
    ['school-detail-2', AnalyticsSchoolDetailSchema],
    ['student-detail', AnalyticsStudentDetailSchema],
    ['teacher-detail', AnalyticsTeacherDetailSchema],
    ['export', AnalyticsMonitoringExportSchema],
    ['report', AnalyticsTeacherReportSchema],
    ['report-7', AnalyticsTeacherReportSchema],
    ['report-admin', AnalyticsTeacherReportSchema],
    ['item-analysis', AnalyticsItemAnalysisSchema],
    ['item-analysis-admin', AnalyticsItemAnalysisSchema],
  ]
  it.each(cases)('%s parses with its response schema', (name, schema) => {
    expect(() => schema.parse(wire(fixture(name)))).not.toThrow()
  })

  it('the raw numeric ids are rejected: the contract id is an opaque string', () => {
    expect(AnalyticsTeacherDetailSchema.safeParse(fixture('teacher-detail')).success).toBe(false)
  })

  it('the filtered overview echoes period and tahap; the empty admin report keeps its shape', () => {
    const o = AnalyticsMonitoringOverviewSchema.parse(wire(fixture('overview-filtered')))
    expect(o.filters).toMatchObject({ period: '30d', tahap: 'Cemerlang' })
    const r = AnalyticsTeacherReportSchema.parse(wire(fixture('report-admin')))
    expect(r.population.total).toBe(0)
    expect(r.score.overall).toBeNull()
    expect(AnalyticsItemAnalysisSchema.parse(wire(fixture('item-analysis-admin'))).rows).toEqual([])
  })
})

describe('AnalyticsSchoolDetail variants the capture did not hit', () => {
  it('accepts a subscription, a warning and flagged pupils, and rejects UTC time and a bad enum', () => {
    const base = AnalyticsSchoolDetailSchema.parse(wire(fixture('school-detail')))
    const flagged = {
      ...base,
      subscription: { status: 'active', endsAt: '2027-01-01T00:00:00+08:00' },
      warning: { review: 1, excluded: 1 },
      students: base.students.map((s) => ({ ...s, flag: 'excluded', engaged: false })),
    }
    expect(AnalyticsSchoolDetailSchema.safeParse(flagged).success).toBe(true)
    expect(AnalyticsSchoolDetailSchema.safeParse({ ...flagged, subscription: { status: 'grace', endsAt: '2027-01-01T00:00:00+08:00' } }).success).toBe(false)
    expect(AnalyticsSchoolDetailSchema.safeParse({ ...flagged, subscription: { status: 'active', endsAt: '2027-01-01T00:00:00Z' } }).success).toBe(false)
    expect(AnalyticsSchoolDetailSchema.safeParse({ ...flagged, tahap: 'Hebat' }).success).toBe(false)
  })
})

describe('Queries tolerate what the mock tolerates', () => {
  it('accepts invalid range, class, subject and unknown filters without error', () => {
    expect(AnalyticsTeacherReportQuerySchema.safeParse({ range: 'abc', classroomId: 'zz' }).success).toBe(true)
    expect(AnalyticsItemAnalysisQuerySchema.safeParse({ subjectId: 'x' }).success).toBe(true)
    expect(AnalyticsExportQuerySchema.safeParse({ format: 'csv', period: 'forever', tahap: 'x', state: 'Atlantis' }).success).toBe(true)
  })

  it('answers the export format with the exact BM copy under fields.format', () => {
    const errors = fixture('errors') as Captured
    const mockFields = (errors['export-422']?.body as { error: { fields: Record<string, string> } }).error.fields
    for (const input of [{ format: 'xlsx' }, {}]) {
      expect(fieldsOf(AnalyticsExportQuerySchema.safeParse(input))).toEqual({ format: ANALYTICS_MESSAGES.exportFormat })
    }
    expect(mockFields).toEqual({ format: ANALYTICS_MESSAGES.exportFormat })
    expect((errors['export-422-missing']?.body as { error: { fields: unknown } }).error.fields).toEqual(mockFields)
  })
})

describe('Error bodies captured from the mock', () => {
  it('parse as ErrorBody and carry the generic copy', () => {
    const errors = fixture('errors') as Captured
    for (const entry of Object.values(errors)) expect(ErrorBodySchema.safeParse(entry.body).success).toBe(true)
    expect((errors['monitoring-401']?.body as { error: { message: string } }).error.message).toBe(ANALYTICS_ERROR_MESSAGES.unauthorized)
    expect((errors['monitoring-403-student']?.body as { error: { message: string } }).error.message).toBe(ANALYTICS_ERROR_MESSAGES.forbidden)
    expect((errors['school-404']?.body as { error: { message: string } }).error.message).toBe(ANALYTICS_ERROR_MESSAGES.notFound)
    expect(errors['report-403-school-admin']?.status).toBe(403)
  })
})

describe('OpenAPI registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>>
    components: { schemas: Record<string, unknown> }
  }
  const paths = [
    '/monitoring/overview',
    '/monitoring/schools/{schoolId}',
    '/monitoring/schools/{schoolId}/students/{userId}',
    '/monitoring/schools/{schoolId}/teachers/{userId}',
    '/monitoring/export',
    '/teacher/report',
    '/teacher/item-analysis',
  ]
  it('registers the 7 M11 GET routes with 401 and 403', () => {
    for (const p of paths) {
      const op = doc.paths[p]?.get
      expect(op, p).toBeDefined()
      expect(Object.keys(op?.responses ?? {})).toEqual(expect.arrayContaining(['200', '401', '403']))
    }
    expect(Object.keys(doc.paths['/monitoring/export']?.get?.responses ?? {})).toContain('422')
    expect(Object.keys(doc.paths['/monitoring/schools/{schoolId}']?.get?.responses ?? {})).toContain('404')
  })
  it('sends no-store on pupil and teacher personal data', () => {
    for (const p of ['/monitoring/schools/{schoolId}/students/{userId}', '/teacher/report']) {
      expect(doc.paths[p]?.get?.responses['200']?.headers).toHaveProperty('Cache-Control')
    }
  })
  it('exposes every component under the Analytics prefix', () => {
    for (const name of Object.keys(ANALYTICS_COMPONENT_SCHEMAS)) {
      expect(name.startsWith('Analytics')).toBe(true)
      expect(doc.components.schemas[name], name).toBeDefined()
    }
  })
})
