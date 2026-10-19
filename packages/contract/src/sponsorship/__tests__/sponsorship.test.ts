import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { SPONSORSHIP_COMPONENT_SCHEMAS } from '../paths'
import {
  FosterApplicationCreatedSchema,
  FosterApplicationInputSchema,
  KELUARGA_ANGKAT_CATEGORIES,
  KELUARGA_ANGKAT_FIELD_ORDER,
  KELUARGA_ANGKAT_GENERIC_ERROR,
  KELUARGA_ANGKAT_INCOME_RANGES,
  KELUARGA_ANGKAT_MESSAGES,
  KELUARGA_ANGKAT_REASON_MAX,
  KELUARGA_ANGKAT_STATUSES,
  KELUARGA_ANGKAT_SUCCESS_TEXT,
  storedFosterReason,
  summarizeFosterFieldErrors,
  type KeluargaAngkatField,
} from '../schema'

const MSG = KELUARGA_ANGKAT_MESSAGES
const valid = {
  studentEmail: 'murid.contoh@demo.test',
  studentCategory: 'B40',
  familyIncomeRange: 'RM1,000 - RM2,500',
  reason: 'Pelajar tinggal bersama nenek.',
}

/** First message per field of a failed parse (as the server collects `fields`). */
function fieldsOf(value: unknown): Partial<Record<KeluargaAngkatField, string>> {
  const r = FosterApplicationInputSchema.safeParse(value)
  if (r.success) return {}
  const out: Record<string, string> = {}
  for (const i of r.error.issues) {
    const key = String(i.path[0])
    out[key] ??= i.message
  }
  return out
}
const parsed = (value: unknown) => FosterApplicationInputSchema.parse(value)

describe('wire values', () => {
  it('keeps the display strings of the screen verbatim', () => {
    expect([...KELUARGA_ANGKAT_CATEGORIES]).toEqual(['B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain'])
    expect([...KELUARGA_ANGKAT_INCOME_RANGES]).toEqual(['< RM1,000', 'RM1,000 - RM2,500', 'RM2,500 - RM4,000', '> RM4,000'])
    expect([...KELUARGA_ANGKAT_STATUSES]).toEqual(['pending', 'approved', 'matched', 'rejected'])
    expect(KELUARGA_ANGKAT_REASON_MAX).toBe(5000)
  })

  it('keeps the BM copy exactly', () => {
    expect(MSG).toEqual({
      required: 'Sila isi ruangan ini.',
      invalidEmail: 'Format e-mel tidak sah.',
      invalidChoice: 'Pilihan tidak sah.',
      studentNotFound: 'Email pelajar tidak dijumpai dalam PrestasiPlus.',
    })
    expect(KELUARGA_ANGKAT_SUCCESS_TEXT).toBe('Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja.')
    expect(KELUARGA_ANGKAT_GENERIC_ERROR).toBe('Ralat berlaku. Sila cuba lagi.')
  })
})

describe('request', () => {
  it('accepts a valid body for every category and income value', () => {
    for (const studentCategory of KELUARGA_ANGKAT_CATEGORIES) {
      expect(FosterApplicationInputSchema.safeParse({ ...valid, studentCategory }).success).toBe(true)
    }
    for (const familyIncomeRange of KELUARGA_ANGKAT_INCOME_RANGES) {
      expect(parsed({ ...valid, familyIncomeRange }).familyIncomeRange).toBe(familyIncomeRange)
    }
  })

  it('trims the e-mail but keeps the reason as typed', () => {
    const p = parsed({ ...valid, studentEmail: '  murid.contoh@demo.test ', reason: '  teks  ' })
    expect(p.studentEmail).toBe('murid.contoh@demo.test')
    expect(p.reason).toBe('  teks  ')
  })

  it('ignores applicantUserId, applicantRole and any other extra key', () => {
    const p = parsed({ ...valid, applicantUserId: '99', applicantRole: 'admin', studentId: '5', status: 'approved' })
    expect(Object.keys(p).sort()).toEqual(['familyIncomeRange', 'reason', 'studentCategory', 'studentEmail'])
  })

  it('studentEmail: blank, whitespace, missing or not a string is "Sila isi ruangan ini."', () => {
    for (const studentEmail of ['', '   ', undefined, null, 5, ['a@b.co']]) {
      expect(fieldsOf({ ...valid, studentEmail })).toEqual({ studentEmail: MSG.required })
    }
  })

  it('studentEmail: a bad shape is "Format e-mel tidak sah."', () => {
    for (const studentEmail of ['murid', 'murid@demo', 'murid@@demo.test', 'mu rid@demo.test', '@demo.test', 'murid@.']) {
      expect(fieldsOf({ ...valid, studentEmail })).toEqual({ studentEmail: MSG.invalidEmail })
    }
  })

  it('studentCategory: empty or not a string is required; another string is "Pilihan tidak sah."', () => {
    for (const studentCategory of ['', undefined, null, 3, {}]) {
      expect(fieldsOf({ ...valid, studentCategory })).toEqual({ studentCategory: MSG.required })
    }
    for (const studentCategory of ['b40', 'Lain', 'B40 ', 'Miskin']) {
      expect(fieldsOf({ ...valid, studentCategory })).toEqual({ studentCategory: MSG.invalidChoice })
    }
  })

  it('familyIncomeRange: missing, null, "" and a non-string are "not given" (null)', () => {
    const without = { studentEmail: valid.studentEmail, studentCategory: valid.studentCategory, reason: valid.reason }
    expect(parsed(without).familyIncomeRange).toBeUndefined()
    for (const familyIncomeRange of [null, '', 0, 12, true, {}, []]) {
      expect(parsed({ ...valid, familyIncomeRange }).familyIncomeRange).toBeNull()
    }
  })

  it('familyIncomeRange: a non-empty string outside the four values is "Pilihan tidak sah."', () => {
    for (const familyIncomeRange of ['RM1000', '<RM1,000', ' ', 'rm1,000 - rm2,500']) {
      expect(fieldsOf({ ...valid, familyIncomeRange })).toEqual({ familyIncomeRange: MSG.invalidChoice })
    }
  })

  it('reason: blank, whitespace, missing or not a string is required', () => {
    for (const reason of ['', ' \n\t ', undefined, null, 7]) {
      expect(fieldsOf({ ...valid, reason })).toEqual({ reason: MSG.required })
    }
  })

  it('reason: longer than 5,000 characters is accepted and stored cut, not rejected', () => {
    const long = 'x'.repeat(6000)
    expect(parsed({ ...valid, reason: long }).reason).toHaveLength(6000)
    expect(storedFosterReason(long)).toHaveLength(KELUARGA_ANGKAT_REASON_MAX)
    expect(storedFosterReason(long)).toBe(long.slice(0, 5000))
    expect(storedFosterReason('  teks  ')).toBe('  teks  ')
  })

  it('collects every failing field, in the field order', () => {
    const f = fieldsOf({})
    expect(Object.keys(f)).toEqual([...KELUARGA_ANGKAT_FIELD_ORDER].filter((k) => k !== 'familyIncomeRange'))
    expect(f).toEqual({ studentEmail: MSG.required, studentCategory: MSG.required, reason: MSG.required })
    const all = fieldsOf({ studentEmail: 'x', studentCategory: 'Y', familyIncomeRange: 'Z', reason: ' ' })
    expect(Object.keys(all)).toEqual([...KELUARGA_ANGKAT_FIELD_ORDER])
    expect(all).toEqual({
      studentEmail: MSG.invalidEmail,
      studentCategory: MSG.invalidChoice,
      familyIncomeRange: MSG.invalidChoice,
      reason: MSG.required,
    })
  })

  it('builds the top-level message like Laravel summarize', () => {
    expect(summarizeFosterFieldErrors({ reason: MSG.required })).toBe('Sila isi ruangan ini.')
    expect(summarizeFosterFieldErrors(fieldsOf({}))).toBe('Sila isi ruangan ini. (and 2 more errors)')
    expect(summarizeFosterFieldErrors({ studentEmail: MSG.studentNotFound, reason: MSG.required })).toBe(
      'Email pelajar tidak dijumpai dalam PrestasiPlus. (and 1 more error)',
    )
    expect(summarizeFosterFieldErrors({})).toBe('')
  })

  it('rejects a body that is not an object', () => {
    for (const body of [null, 'x', 5, [], undefined]) expect(FosterApplicationInputSchema.safeParse(body).success).toBe(false)
  })
})

describe('response and error body', () => {
  it('201 data is only { id } (a string)', () => {
    expect(FosterApplicationCreatedSchema.safeParse({ id: '17' }).success).toBe(true)
    expect(FosterApplicationCreatedSchema.safeParse({ id: 17 }).success).toBe(false)
    expect(FosterApplicationCreatedSchema.safeParse({ id: '' }).success).toBe(false)
  })

  it('never echoes personal or sensitive fields', () => {
    for (const leak of ['studentEmail', 'studentCategory', 'familyIncomeRange', 'reason', 'status', 'applicantUserId', 'applicantRole', 'studentId']) {
      expect(FosterApplicationCreatedSchema.safeParse({ id: '17', [leak]: 'x' }).success).toBe(false)
    }
  })

  it('error bodies parse: 401, 403 CSRF_INVALID, 422 with fields', () => {
    expect(ErrorBodySchema.safeParse({ error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } }).success).toBe(true)
    expect(ErrorBodySchema.safeParse({ error: { code: 'CSRF_INVALID', message: 'Token CSRF tidak sah.' } }).success).toBe(true)
    const fields = fieldsOf({})
    const body = { error: { code: 'VALIDATION_ERROR', message: summarizeFosterFieldErrors(fields), fields } }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { tags?: string[]; parameters?: { name: string; in: string; required?: boolean }[]; responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }

  it('has exactly one operation under the sponsorship tag: POST /mohon-keluarga-angkat', () => {
    const ops = Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.entries(item).filter(([, op]) => op.tags?.includes('sponsorship')).map(([method]) => `${method.toUpperCase()} ${path}`),
    )
    expect(ops).toEqual(['POST /mohon-keluarga-angkat'])
  })

  it('requires X-CSRF-Token and documents 201, 401, 403, 422, 429, 500', () => {
    const op = doc.paths['/mohon-keluarga-angkat']?.post
    expect(op?.parameters).toContainEqual(expect.objectContaining({ name: 'X-CSRF-Token', in: 'header', required: true }))
    expect(Object.keys(op?.responses ?? {}).sort()).toEqual(['201', '401', '403', '422', '429', '500'])
  })

  it('D57(a): 429 RATE_LIMITED on the write route carries retryAfter (ErrorBody) and a Retry-After header', () => {
    const op = doc.paths['/mohon-keluarga-angkat']?.post
    const r = op?.responses['429'] as { headers?: Record<string, unknown>; content?: Record<string, { schema?: unknown }> } | undefined
    expect(r).toBeDefined()
    expect(JSON.stringify(r)).toMatch(/RATE_LIMITED/)
    expect(Object.keys(r?.headers ?? {})).toContain('Retry-After')
    expect(JSON.stringify(r?.content?.['application/json']?.schema)).toMatch(/ErrorBody/)
  })

  it('D57(b): the 201 carries no credential or token, so it sets no Cache-Control', () => {
    const op = doc.paths['/mohon-keluarga-angkat']?.post
    for (const [status, r] of Object.entries(op?.responses ?? {})) {
      expect(Object.keys((r as { headers?: Record<string, unknown> }).headers ?? {}), status).not.toContain('Cache-Control')
    }
  })

  it('contains every sponsorship component, all prefixed KeluargaAngkat', () => {
    for (const name of Object.keys(SPONSORSHIP_COMPONENT_SCHEMAS)) {
      expect(doc.components.schemas).toHaveProperty(name)
      expect(name).toMatch(/^(KeluargaAngkat|Sponsorship)/)
    }
  })

  it('exposes the enums on the wire', () => {
    const schemas = doc.components.schemas as Record<string, { enum?: string[] }>
    expect(schemas.KeluargaAngkatCategory?.enum).toEqual([...KELUARGA_ANGKAT_CATEGORIES])
    expect(schemas.KeluargaAngkatIncomeRange?.enum).toEqual([...KELUARGA_ANGKAT_INCOME_RANGES])
  })

  it('has no Penaja or admin route', () => {
    for (const path of Object.keys(doc.paths)) expect(path).not.toMatch(/penaja|sponsor|anak-angkat/i)
  })
})
