import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { ErrorBodySchema } from '../../../common/error'
import { KIRKPATRICK_COMPONENT_SCHEMAS } from '../paths'
import {
  KIRKPATRICK_ERROR_MESSAGES,
  KIRKPATRICK_MESSAGES as M,
  KIRKPATRICK_PDF,
  KirkpatrickBehaviorSchema,
  KirkpatrickChainSchema,
  KirkpatrickFeedbackConflictSchema,
  KirkpatrickFeedbackRequestSchema,
  KirkpatrickFeedbackResponseSchema,
  KirkpatrickFeedbackStatusSchema,
  KirkpatrickFilterOptionsSchema,
  KirkpatrickInterventionCreateRequestSchema,
  KirkpatrickInterventionInvalidDateSchema,
  KirkpatrickInterventionListSchema,
  KirkpatrickInterventionRefusalSchema,
  KirkpatrickInterventionRowSchema,
  KirkpatrickInterventionStudentNotFoundSchema,
  KirkpatrickLearningSchema,
  KirkpatrickMeSchema,
  KirkpatrickOverviewSchema,
  KirkpatrickReactionSchema,
  KirkpatrickResultsSchema,
  KirkpatrickSchoolQuerySchema,
  KirkpatrickScopeQuerySchema,
  KirkpatrickStudentSchema,
  kirkpatrickIsCalendarDay,
} from '../schema'

/**
 * Payloads in `fixtures/` were captured from the real M12 mock (booted with its owners, project
 * clock) by a one-off vitest run that called the mock transport; arrays are cut to 25 items by the
 * generator. They carry the mock's numeric ids, so `wire()` stringifies id fields the way the v2
 * backend sends them (Id is an opaque string).
 */
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), 'utf8'))

const ID_KEY = /^(id|[a-z]+Id|createdBy)$/
const wire = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(wire)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ID_KEY.test(k) && typeof x === 'number' ? String(x) : wire(x)]))
      : v

const fieldsOf = (r: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))

type Captured = Record<string, { status: number; headers: Record<string, string>; body: { error?: { code: string; message: string; fields?: Record<string, string> } } }>
const errors = fixture('errors') as Captured
const mockFields = (name: string) => errors[name]?.body.error?.fields

describe('M12 payloads captured from the mock', () => {
  const cases: [string, { parse: (v: unknown) => unknown }][] = [
    ['overview', KirkpatrickOverviewSchema],
    ['overview-school', KirkpatrickOverviewSchema],
    ['overview-school-admin', KirkpatrickOverviewSchema],
    ['reaction', KirkpatrickReactionSchema],
    ['learning', KirkpatrickLearningSchema],
    ['behavior', KirkpatrickBehaviorSchema],
    ['results', KirkpatrickResultsSchema],
    ['results-school', KirkpatrickResultsSchema],
    ['chain', KirkpatrickChainSchema],
    ['filter-options', KirkpatrickFilterOptionsSchema],
    ['filter-options-school-admin', KirkpatrickFilterOptionsSchema],
    ['student', KirkpatrickStudentSchema],
    ['me', KirkpatrickMeSchema],
    ['interventions', KirkpatrickInterventionListSchema],
    ['intervention-created', KirkpatrickInterventionRowSchema],
    ['feedback-status', KirkpatrickFeedbackStatusSchema],
    ['feedback-created', KirkpatrickFeedbackResponseSchema],
  ]
  it.each(cases)('%s parses with its response schema', (name, schema) => {
    expect(() => schema.parse(wire(fixture(name)))).not.toThrow()
  })

  it('the school admin overview is forced to one school; the derived intervention status is typed', () => {
    const o = KirkpatrickOverviewSchema.parse(wire(fixture('overview-school-admin')))
    expect(o.scope.schoolId).not.toBeNull()
    expect(KirkpatrickInterventionRowSchema.parse(wire(fixture('intervention-created'))).status).toBe('Meningkat')
  })

  it('the PDF answer is application/pdf, named as the contract says, and starts with %PDF', () => {
    const meta = fixture('export-pdf-meta') as { status: number; headers: Record<string, string>; head: string }
    expect(meta.status).toBe(200)
    expect(meta.headers['content-type']).toBe(KIRKPATRICK_PDF.contentType)
    expect(meta.headers['content-disposition']).toContain(`filename="${KIRKPATRICK_PDF.filename}"`)
    expect(meta.head.startsWith('%PDF')).toBe(true)
  })
})

describe('Scope query', () => {
  it('rejects a malformed schoolId with the mock copy and accepts blank and padded ids', () => {
    expect(fieldsOf(KirkpatrickScopeQuerySchema.safeParse({ schoolId: 'abc' }))).toEqual({ schoolId: M.invalid })
    expect(mockFields('overview-422-school')).toEqual({ schoolId: M.invalid })
    expect(fieldsOf(KirkpatrickSchoolQuerySchema.safeParse({ schoolId: '12.5' }))).toEqual({ schoolId: M.invalid })
    for (const schoolId of [undefined, '', ' 12 ', '900001']) {
      expect(KirkpatrickScopeQuerySchema.safeParse({ schoolId, state: 'Atlantis' }).success).toBe(true)
    }
  })
})

describe('POST /kirkpatrick/interventions request', () => {
  const ok = {
    studentId: '4664',
    alertType: 'inactive',
    actionDate: '2026-09-24',
    alertDescription: 'Tidak aktif seminggu',
    actionTaken: 'Panggilan kepada penjaga',
    beforeAccuracy: 40,
    afterAccuracy: 55.55,
    beforeMood: 'sad',
    afterMood: 'okay',
  }
  const parse = (v: unknown) => KirkpatrickInterventionCreateRequestSchema.safeParse(v)

  it('accepts the body the mock accepted, numeric ids and numeric text, and trims the notes', () => {
    expect(parse(ok).success).toBe(true)
    expect(parse({ ...ok, studentId: 4664, beforeAccuracy: ' 10.5 ', afterAccuracy: null, beforeMood: '', afterMood: null }).success).toBe(true)
    expect(parse({ ...ok, alertDescription: '  catatan  ' }).data?.alertDescription).toBe('catatan')
  })

  it('reports "Medan ini diperlukan." for every blank field, as the mock does', () => {
    expect(fieldsOf(parse({}))).toEqual(mockFields('intervention-empty'))
    expect(fieldsOf(parse({}))).toEqual({
      studentId: M.required,
      alertType: M.required,
      actionDate: M.required,
      alertDescription: M.required,
      actionTaken: M.required,
    })
    expect(fieldsOf(parse({ ...ok, studentId: null, actionDate: '', alertDescription: '   ' }))).toEqual({
      studentId: M.required,
      actionDate: M.required,
      alertDescription: M.required,
    })
    expect(fieldsOf(parse({ ...ok, studentId: '' }))).toEqual({ studentId: M.required })
    expect(fieldsOf(parse({ ...ok, studentId: '   ' }))).toEqual({ studentId: M.invalid })
  })

  it('reports "Medan ini tidak sah." for the bad values of the captured mock request', () => {
    // The captured mock request used studentId 'abc'; the contract id is opaque, so that one field is
    // left to the service ("Pelajar tidak dijumpai."). Every other field must match the mock.
    const bad = { studentId: 'abc', alertType: 'x', actionDate: 5, alertDescription: '   ', actionTaken: 'x'.repeat(2001), beforeAccuracy: 101, afterAccuracy: 'zz', beforeMood: 'angry' }
    const { studentId, ...expected } = mockFields('intervention-bad') ?? {}
    expect(studentId).toBe(M.invalid)
    expect(fieldsOf(parse(bad))).toEqual(expected)
    expect(fieldsOf(parse({ ...ok, studentId: true, beforeAccuracy: -1 }))).toEqual({ studentId: M.invalid, beforeAccuracy: M.invalid })
  })

  it('accepts the mock snake_case names and maps them, camelCase winning when both are sent', () => {
    const snake = { student_id: '4664', alert_type: 'declining', action_date: '2026-09-24', alert_description: ' a ', action_taken: 'b', before_accuracy: '10.5', before_mood: 'sad' }
    const r = parse(snake)
    expect(r.success).toBe(true)
    expect(r.data).toMatchObject({ studentId: '4664', alertType: 'declining', alertDescription: 'a', beforeAccuracy: '10.5', beforeMood: 'sad' })
    expect(parse({ ...snake, alertType: 'mood' }).data).toMatchObject({ alertType: 'mood' })
    // a present camelCase key wins even when it is null (mock pick), so the snake value is not used
    expect(fieldsOf(parse({ ...snake, studentId: null }))).toEqual({ studentId: M.required })
    expect(fieldsOf(parse({}))).toEqual(mockFields('intervention-empty'))
  })

  it('gives the exact 422 copy, keyed camelCase, on snake_case fields', () => {
    const snake = { student_id: '4664', alert_type: 'declining', action_date: '2026-09-24', alert_description: 'a', action_taken: 'b' }
    expect(fieldsOf(parse({ ...snake, alert_type: 'x', alert_description: '   ', before_accuracy: 101, after_accuracy: 'zz', before_mood: 'angry', action_date: 5 }))).toEqual({
      alertType: M.invalid,
      actionDate: M.invalid,
      alertDescription: M.required,
      beforeAccuracy: M.invalid,
      afterAccuracy: M.invalid,
      beforeMood: M.invalid,
    })
    expect(fieldsOf(parse({ student_id: '', action_taken: 'x'.repeat(2001) }))).toMatchObject({ studentId: M.required, actionTaken: M.invalid, alertType: M.required })
  })

  it('pins the state-dependent refusals to code, message and field', () => {
    const refusal = (name: string) => errors[name]?.body
    expect(KirkpatrickInterventionStudentNotFoundSchema.safeParse(refusal('intervention-no-student')).success).toBe(true)
    expect(KirkpatrickInterventionInvalidDateSchema.safeParse(refusal('intervention-bad-date')).success).toBe(true)
    expect(KirkpatrickInterventionRefusalSchema.safeParse(refusal('intervention-no-student')).success).toBe(true)
    expect(KirkpatrickInterventionRefusalSchema.safeParse(refusal('intervention-bad-date')).success).toBe(true)
    expect(KirkpatrickInterventionStudentNotFoundSchema.safeParse(refusal('intervention-bad-date')).success).toBe(false)
    expect(M.studentNotFound).toBe('Pelajar tidak dijumpai.')
    expect(M.invalidDate).toBe('Tarikh tidak sah.')
  })

  it('checks calendar days like the mock', () => {
    expect(kirkpatrickIsCalendarDay('2026-02-28')).toBe(true)
    expect(kirkpatrickIsCalendarDay('2026-02-31')).toBe(false)
    expect(kirkpatrickIsCalendarDay('26-02-28')).toBe(false)
  })
})

describe('POST /feedback request', () => {
  const parse = (v: unknown) => KirkpatrickFeedbackRequestSchema.safeParse(v)

  it('matches the captured field copy for blank, out-of-range and wrong-type values', () => {
    expect(fieldsOf(parse({}))).toEqual(mockFields('feedback-empty'))
    expect(fieldsOf(parse({ nps: 11, satisfaction: 0 }))).toEqual(mockFields('feedback-bad'))
    expect(fieldsOf(parse({ nps: 5.5, satisfaction: 'abc' }))).toEqual(mockFields('feedback-bad-type'))
    expect(fieldsOf(parse({ nps: '', satisfaction: null }))).toEqual({ nps: M.required, satisfaction: M.required })
    expect(fieldsOf(parse({ nps: ' ', satisfaction: 6 }))).toEqual({ nps: M.invalid, satisfaction: M.invalid })
  })

  it('accepts the edges and numeric text, as the mock does', () => {
    expect(parse({ nps: 0, satisfaction: 1 }).success).toBe(true)
    expect(parse({ nps: 10, satisfaction: 5 }).success).toBe(true)
    expect(parse({ nps: ' 7 ', satisfaction: '3' }).success).toBe(true)
    expect(parse({ nps: 9, satisfaction: 4, role: 'admin', schoolId: '1' }).data).toEqual({ nps: 9, satisfaction: 4 })
  })

  it('types the 409 refusal and the generic copy', () => {
    expect(KirkpatrickFeedbackConflictSchema.safeParse(errors['feedback-conflict']?.body).success).toBe(true)
    expect(errors['feedback-conflict']?.status).toBe(409)
    expect(errors['reaction-401']?.body.error?.message).toBe(KIRKPATRICK_ERROR_MESSAGES.unauthorized)
    expect(errors['learning-403-school-admin']?.body.error?.message).toBe(KIRKPATRICK_ERROR_MESSAGES.forbidden)
    expect(errors['student-404-non-digit']?.body.error?.message).toBe(KIRKPATRICK_ERROR_MESSAGES.notFound)
    for (const entry of Object.values(errors).filter((e) => e.status >= 400)) {
      expect(ErrorBodySchema.safeParse(entry.body).success).toBe(true)
    }
  })

  it('keeps the uniform 403 for the pupil view of an unknown id, a non-pupil and a school admin', () => {
    for (const k of ['student-403-unknown', 'student-403-non-student', 'student-403-school-admin']) {
      expect(errors[k]?.status).toBe(403)
      expect(errors[k]?.body.error?.message).toBe(KIRKPATRICK_ERROR_MESSAGES.forbidden)
    }
  })
})

describe('OpenAPI registration', () => {
  type Op = { responses: Record<string, { headers?: Record<string, unknown>; content?: Record<string, unknown> }> }
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, Op>>; components: { schemas: Record<string, unknown> } }
  const gets = [
    '/kirkpatrick/overview',
    '/kirkpatrick/reaction',
    '/kirkpatrick/learning',
    '/kirkpatrick/behavior',
    '/kirkpatrick/results',
    '/kirkpatrick/chain',
    '/kirkpatrick/filter-options',
    '/kirkpatrick/students/{id}',
    '/kirkpatrick/me',
    '/kirkpatrick/export-pdf',
    '/kirkpatrick/interventions',
    '/feedback/status',
  ]
  it('registers the 12 GET and 2 POST routes', () => {
    for (const p of gets) expect(doc.paths[p]?.get, p).toBeDefined()
    expect(doc.paths['/kirkpatrick/interventions']?.post).toBeDefined()
    expect(doc.paths['/feedback']?.post).toBeDefined()
  })
  it('documents 429 with Retry-After and CSRF on both writes', () => {
    for (const op of [doc.paths['/kirkpatrick/interventions']?.post, doc.paths['/feedback']?.post]) {
      expect(Object.keys(op?.responses ?? {})).toEqual(expect.arrayContaining(['201', '401', '403', '422', '429']))
      expect(op?.responses['429']?.headers).toHaveProperty('Retry-After')
    }
    expect(Object.keys(doc.paths['/feedback']?.post?.responses ?? {})).toContain('409')
  })
  it('serves the PDF as application/pdf and no-store on personal data', () => {
    expect(doc.paths['/kirkpatrick/export-pdf']?.get?.responses['200']?.content).toHaveProperty('application/pdf')
    for (const p of ['/kirkpatrick/interventions', '/kirkpatrick/students/{id}', '/kirkpatrick/me']) {
      expect(doc.paths[p]?.get?.responses['200']?.headers, p).toHaveProperty('Cache-Control')
    }
    expect(doc.paths['/kirkpatrick/interventions']?.post?.responses['201']?.headers).toHaveProperty('Cache-Control')
  })
  it('exposes every component under the Kirkpatrick prefix', () => {
    for (const name of Object.keys(KIRKPATRICK_COMPONENT_SCHEMAS)) {
      expect(name.startsWith('Kirkpatrick')).toBe(true)
      expect(doc.components.schemas[name], name).toBeDefined()
    }
  })
})
