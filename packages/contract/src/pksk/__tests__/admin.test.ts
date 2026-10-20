import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import type { z } from '../../zod'
import {
  PKSK_ADMIN_BULK_MAX,
  PKSK_ADMIN_FLASH,
  PKSK_ADMIN_MESSAGES,
  PkskAdminAccessGrantSchema,
  PkskAdminAccessListResponseSchema,
  PkskAdminAccessMutationResponseSchema,
  PkskAdminAccessStatsResponseSchema,
  PkskAdminBulkRequestSchema,
  PkskAdminBulkResponseSchema,
  PkskAdminQuestionCreateSchema,
  PkskAdminQuestionDetailResponseSchema,
  PkskAdminQuestionListQuerySchema,
  PkskAdminQuestionListResponseSchema,
  PkskAdminQuestionMutationResponseSchema,
  PkskAdminQuestionStatsResponseSchema,
  PkskAdminQuestionUpdateSchema,
  PkskPackageListResponseSchema,
  pkskAdminFieldErrors,
} from '../admin'
import { PKSK_ADMIN_COMPONENT_SCHEMAS, registerPkskAdminPaths } from '../admin-paths'
import { PKSK_SHARED_COMPONENT_SCHEMAS } from '../shared'

/**
 * The mock handlers are the spec: payloads are produced by booting the real mock runtime (the M07
 * mock tests' own boot helper) and calling the admin routes, then parsed with the schemas. Request
 * schemas are checked against the mock's own 422 `fields` (differential cases). The mock sends
 * numeric ids; the contract ids are decimal strings (UD-1), so `wire()` converts ids first.
 */

interface MockAnswer {
  status: number
  body: unknown
}
interface MockHelpers {
  bootPksk: () => Promise<{ runtime: unknown }>
  call: (
    runtime: unknown,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    userId: number | null,
    body?: unknown,
  ) => Promise<MockAnswer>
  MemoryStorage: new () => unknown
  ADMIN: number
  PELAJAR: number
  PELAJAR2: number
  GURU: number
}

const HELPERS_PATH = '../../../../../src/modules/m07-pksk/__tests__/mock/helpers'

let runtime: unknown
let h: MockHelpers

beforeAll(async () => {
  h = (await import(/* @vite-ignore */ HELPERS_PATH)) as MockHelpers
  vi.stubGlobal('localStorage', new h.MemoryStorage())
  runtime = (await h.bootPksk()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const Q = '/api/admin/pksk-questions'
const A = '/api/admin/pksk-access'

const get = (url: string) => h.call(runtime, 'GET', url, h.ADMIN)
const send = (method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) =>
  h.call(runtime, method, url, h.ADMIN, body)

const ID_KEYS = new Set(['id', 'pkskDomainId'])

/** Converts the mock's numeric ids to the contract's decimal strings. */
function wire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(wire)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, ID_KEYS.has(k) && typeof v === 'number' ? String(v) : wire(v)]),
    )
  }
  return value
}

const mcq = (n = 4, correct: number[] = [0]) =>
  Array.from({ length: n }, (_, i) => ({ text: `Pilihan ${String(i + 1)}`, isCorrect: correct.includes(i) }))

const validCreate = {
  bahagian: 'B',
  pkskDomainId: '2',
  pkskTargetLevel: 'T1',
  questionText: '  Soalan ujian kontrak?  ',
  difficultyLevel: 3,
  explanation: 'Sebab ujian.',
  options: mcq(),
}
const validUpdate = {
  pkskDomainId: '2',
  pkskTargetLevel: 'T1',
  status: 'approved',
  questionText: 'Teks baharu',
  difficultyLevel: 4,
  explanation: 'Penjelasan baharu',
  options: mcq(3, [1, 2]),
}

function errorOf(answer: MockAnswer) {
  const parsed = ErrorBodySchema.parse(answer.body)
  return parsed.error
}

/** Both sides must report the same `fields` keys and messages. */
async function expectSameFields(
  schema: z.ZodType,
  method: 'POST' | 'PUT',
  url: string,
  body: Record<string, unknown>,
) {
  const mock = errorOf(await send(method, url, body))
  expect(mock.code).toBe('VALIDATION_ERROR')
  const result = schema.safeParse(body)
  expect(result.success, JSON.stringify(body)).toBe(false)
  if (result.success) return
  expect(pkskAdminFieldErrors(result.error), JSON.stringify(body)).toEqual(mock.fields)
}

describe('mock-produced reads parse', () => {
  it('lists questions (shape, meta, filters)', async () => {
    const r = await get(Q)
    expect(r.status).toBe(200)
    const parsed = PkskAdminQuestionListResponseSchema.parse(wire(r.body))
    expect(parsed.data).toHaveLength(20)
    expect(parsed.meta).toMatchObject({ page: 1, pageSize: 20 })
    for (const qs of ['bahagian=b&level=t1&status=APPROVED', 'search=inovasi', 'page=2', 'level=T9', 'status=zzz']) {
      const f = await get(`${Q}?${qs}`)
      PkskAdminQuestionListResponseSchema.parse(wire(f.body))
    }
    const empty = PkskAdminQuestionListResponseSchema.parse(wire((await get(`${Q}?bahagian=Z`)).body))
    expect(empty.data).toEqual([])
    expect(empty.meta.from).toBeNull()
  })

  it('stats and detail parse', async () => {
    PkskAdminQuestionStatsResponseSchema.parse((await get(`${Q}/stats`)).body)
    const detail = PkskAdminQuestionDetailResponseSchema.parse(wire((await get(`${Q}/177698`)).body))
    expect(detail.data.id).toBe('177698')
    expect(detail.data.options.length).toBeGreaterThanOrEqual(2)
  })

  it('lists access grants, stats and packages', async () => {
    const list = PkskAdminAccessListResponseSchema.parse(wire((await get(A)).body))
    expect(list.data.length).toBeGreaterThan(0)
    expect(list.data[0]?.package.level).toBe('ALL')
    PkskAdminAccessListResponseSchema.parse(wire((await get(`${A}?search=%20ibu%20`)).body))
    PkskAdminAccessStatsResponseSchema.parse((await get(`${A}/stats`)).body)
    const pkgs = PkskPackageListResponseSchema.parse(wire((await get('/api/pksk-packages')).body))
    expect(pkgs.data.map((p) => p.level)).toEqual(['T1', 'T4', 'ALL'])
  })

  it('query schema accepts the frontend queries and rejects unknown keys', () => {
    expect(PkskAdminQuestionListQuerySchema.parse({ bahagian: 'b', level: 't1', status: 'APPROVED', search: 'x', page: '2' }).page).toBe(2)
    expect(PkskAdminQuestionListQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false)
    expect(PkskAdminQuestionListQuerySchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('mock-produced writes parse (questions)', () => {
  let createdId = ''

  it('create: request schema accepts the body the mock accepts, response parses', async () => {
    expect(PkskAdminQuestionCreateSchema.safeParse(validCreate).success).toBe(true)
    const r = await send('POST', Q, validCreate)
    expect(r.status).toBe(201)
    const parsed = PkskAdminQuestionMutationResponseSchema.parse(wire(r.body))
    expect(parsed.status).toBe(PKSK_ADMIN_FLASH.questionCreated)
    expect(parsed.data.status).toBe('approved')
    createdId = parsed.data.id
  })

  it('create Bahagian C without options', async () => {
    const body = { bahagian: 'C', pkskDomainId: '15', pkskTargetLevel: 'T4', questionText: 'Tulis esei.', difficultyLevel: 2 }
    expect(PkskAdminQuestionCreateSchema.safeParse(body).success).toBe(true)
    expect(PkskAdminQuestionCreateSchema.safeParse({ ...body, options: mcq() }).success).toBe(true)
    const r = await send('POST', Q, body)
    expect(r.status).toBe(201)
    expect(PkskAdminQuestionMutationResponseSchema.parse(wire(r.body)).data.options).toEqual([])
  })

  it('create Bahagian A with no correct option parses (flags as posted)', async () => {
    const body = { ...validCreate, bahagian: 'A', pkskDomainId: '1', options: mcq(3, []) }
    expect(PkskAdminQuestionCreateSchema.safeParse(body).success).toBe(true)
    expect((await send('POST', Q, body)).status).toBe(201)
  })

  it('create 422: the schema reports the same fields and messages as the mock', async () => {
    const cases: Record<string, unknown>[] = [
      { ...validCreate, bahagian: undefined },
      { ...validCreate, bahagian: 'Z' },
      { ...validCreate, pkskDomainId: undefined },
      { ...validCreate, pkskTargetLevel: 'T9' },
      { ...validCreate, pkskTargetLevel: undefined },
      { ...validCreate, questionText: '   ' },
      { ...validCreate, questionText: undefined },
      { ...validCreate, difficultyLevel: undefined },
      { ...validCreate, difficultyLevel: 6 },
      { ...validCreate, difficultyLevel: 0 },
      { ...validCreate, options: mcq(1) },
      { ...validCreate, options: mcq(7) },
      { ...validCreate, options: undefined },
      { ...validCreate, options: [{ text: '  ', isCorrect: true }, ...mcq(2)] },
      { ...validCreate, options: [{ text: '  ', isCorrect: true }] },
      { ...validCreate, bahagian: 'Z', questionText: '' },
      { ...validCreate, bahagian: undefined, pkskTargetLevel: 'T9', questionText: '', difficultyLevel: 9, options: mcq(1) },
    ]
    for (const body of cases) await expectSameFields(PkskAdminQuestionCreateSchema, 'POST', Q, body)
  })

  it('create 422: per-element option issues collapse into the single key `options`', () => {
    const r = PkskAdminQuestionCreateSchema.safeParse({
      ...validCreate,
      options: [mcq(1)[0], { text: '', isCorrect: false }, mcq(1)[0]],
    })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.issues.some((i) => i.path.join('.') === 'options.1.text')).toBe(true)
    expect(pkskAdminFieldErrors(r.error)).toEqual({ options: PKSK_ADMIN_MESSAGES.optionText })
  })

  it('service rules are not schema rules: unknown domain or domain of another Bahagian parse, the mock answers 422', async () => {
    for (const body of [
      { ...validCreate, pkskDomainId: '99' },
      { ...validCreate, pkskDomainId: '1' },
    ]) {
      expect(PkskAdminQuestionCreateSchema.safeParse(body).success).toBe(true)
      const e = errorOf(await send('POST', Q, body))
      expect(e.fields).toEqual({ pkskDomainId: PKSK_ADMIN_MESSAGES.domain })
    }
  })

  it('update: schema accepts the mock body, response parses', async () => {
    expect(PkskAdminQuestionUpdateSchema.safeParse(validUpdate).success).toBe(true)
    const r = await send('PUT', `${Q}/${createdId}`, { ...validUpdate, status: 'pending' })
    expect(r.status).toBe(200)
    const parsed = PkskAdminQuestionMutationResponseSchema.parse(wire(r.body))
    expect(parsed.status).toBe(PKSK_ADMIN_FLASH.questionUpdated)
    expect(parsed.data.status).toBe('pending')
    // difficultyLevel and options absent keep the stored values
    const slim = { pkskDomainId: '2', pkskTargetLevel: 'T1', status: 'approved', questionText: 'Teks baharu' }
    expect(PkskAdminQuestionUpdateSchema.safeParse(slim).success).toBe(true)
    expect((await send('PUT', `${Q}/${createdId}`, slim)).status).toBe(200)
    expect(PkskAdminQuestionUpdateSchema.safeParse({ ...slim, difficultyLevel: null }).success).toBe(true)
  })

  it('update 422: same fields and messages as the mock', async () => {
    const cases: Record<string, unknown>[] = [
      { ...validUpdate, status: 'zzz' },
      { ...validUpdate, status: undefined },
      { ...validUpdate, pkskTargetLevel: '' },
      { ...validUpdate, questionText: '' },
      { ...validUpdate, difficultyLevel: 9 },
      { ...validUpdate, options: mcq(1) },
      { ...validUpdate, options: [{ text: ' ', isCorrect: false }, ...mcq(2)] },
    ]
    for (const body of cases) await expectSameFields(PkskAdminQuestionUpdateSchema, 'PUT', `${Q}/${createdId}`, body)
  })

  it('bulk: body and response', async () => {
    const body = { action: 'reject', ids: ['177698', '177699', '177698'] }
    expect(PkskAdminBulkRequestSchema.safeParse(body).success).toBe(true)
    const r = await send('POST', `${Q}/bulk`, body)
    expect(r.status).toBe(200)
    const parsed = PkskAdminBulkResponseSchema.parse(r.body)
    expect(parsed.data.affected).toBe(2)
    expect(parsed.status).toBe(PKSK_ADMIN_FLASH.bulkRejected(2))
    const approve = PkskAdminBulkResponseSchema.parse((await send('POST', `${Q}/bulk`, { action: 'approve', ids: ['177698', '177699'] })).body)
    expect(approve.status).toBe(PKSK_ADMIN_FLASH.bulkApproved(2))
    const created = PkskAdminQuestionMutationResponseSchema.parse(wire((await send('POST', Q, validCreate)).body))
    const del = PkskAdminBulkResponseSchema.parse((await send('POST', `${Q}/bulk`, { action: 'delete', ids: [created.data.id] })).body)
    expect(del.status).toBe(PKSK_ADMIN_FLASH.bulkDeleted(1))
  })

  it('bulk 422: action and ids messages equal the mock (single-fault bodies)', async () => {
    const cases: Record<string, unknown>[] = [
      { action: 'archive', ids: ['177698'] },
      { ids: ['177698'] },
      { action: 'approve', ids: [] },
      { action: 'approve' },
      { action: 'approve', ids: ['abc'] },
    ]
    for (const body of cases) await expectSameFields(PkskAdminBulkRequestSchema, 'POST', `${Q}/bulk`, body)
  })

  it('bulk: a non-PKSK id passes the schema (service rule) and the mock answers fields.ids', async () => {
    // 1 is a user id, not a PKSK question id: unknown to the PKSK bank.
    const body = { action: 'delete', ids: ['177700', '99999999'] }
    expect(PkskAdminBulkRequestSchema.safeParse(body).success).toBe(true)
    expect(errorOf(await send('POST', `${Q}/bulk`, body)).fields).toEqual({ ids: PKSK_ADMIN_MESSAGES.ids })
  })

  it('bulk: caps and strictness', () => {
    const ids = Array.from({ length: PKSK_ADMIN_BULK_MAX + 1 }, (_, i) => String(i + 1))
    expect(PkskAdminBulkRequestSchema.safeParse({ action: 'approve', ids }).success).toBe(false)
    expect(PkskAdminBulkRequestSchema.safeParse({ action: 'approve', ids: ['1'], extra: 1 }).success).toBe(false)
  })

  it('404 and delete', async () => {
    const missing = await get(`${Q}/99999999`)
    expect(missing.status).toBe(404)
    expect(errorOf(missing)).toMatchObject({ code: 'NOT_FOUND', message: PKSK_ADMIN_MESSAGES.questionNotFound })
    const created = PkskAdminQuestionMutationResponseSchema.parse(wire((await send('POST', Q, validCreate)).body))
    const del = await send('DELETE', `${Q}/${created.data.id}`)
    expect(del.status).toBe(204)
    const again = await send('DELETE', `${Q}/${created.data.id}`)
    expect(again.status).toBe(404)
    expect(errorOf(again).message).toBe(PKSK_ADMIN_MESSAGES.questionNotFound)
    expect(errorOf(await send('PUT', `${Q}/99999999`, validUpdate)).message).toBe(PKSK_ADMIN_MESSAGES.questionNotFound)
  })

  it('strict bodies and caps', () => {
    expect(PkskAdminQuestionCreateSchema.safeParse({ ...validCreate, status: 'approved' }).success).toBe(false)
    expect(PkskAdminQuestionCreateSchema.safeParse({ ...validCreate, questionText: 'x'.repeat(2001) }).success).toBe(false)
    expect(PkskAdminQuestionCreateSchema.safeParse({ ...validCreate, explanation: 'x'.repeat(2001) }).success).toBe(false)
    expect(PkskAdminQuestionCreateSchema.safeParse({ ...validCreate, options: [{ text: 'x'.repeat(501), isCorrect: true }, ...mcq(2)] }).success).toBe(false)
    expect(PkskAdminQuestionUpdateSchema.safeParse({ ...validUpdate, bahagian: 'B' }).success).toBe(false)
    // transport tolerances of the mock that the canonical schema does not accept
    expect(PkskAdminQuestionUpdateSchema.safeParse({ ...validUpdate, difficultyLevel: '' }).success).toBe(false)
    expect(PkskAdminQuestionCreateSchema.safeParse({ ...validCreate, pkskDomainId: 2 }).success).toBe(false)
  })
})

describe('mock-produced writes parse (access)', () => {
  it('grant: body accepted, response parses (past expiry too)', async () => {
    const body = { userId: String(h.PELAJAR2), packageId: '1', expiresAt: null }
    expect(PkskAdminAccessGrantSchema.safeParse(body).success).toBe(true)
    expect(PkskAdminAccessGrantSchema.safeParse({ userId: '3', packageId: '1' }).success).toBe(true)
    const r = await send('POST', A, body)
    expect(r.status).toBe(201)
    const parsed = PkskAdminAccessMutationResponseSchema.parse(wire(r.body))
    expect(parsed.status).toBe(PKSK_ADMIN_FLASH.accessGranted)
    expect(parsed.data).toMatchObject({ status: 'active', displayStatus: 'active', expiresAt: null })
    expect(parsed.data.grantedBy).not.toBeNull()

    const past = { userId: String(h.GURU), packageId: '2', expiresAt: '2026-01-01' }
    expect(PkskAdminAccessGrantSchema.safeParse(past).success).toBe(true)
    const p = PkskAdminAccessMutationResponseSchema.parse(wire((await send('POST', A, past)).body))
    expect(p.data).toMatchObject({ expiresAt: '2026-01-01', status: 'active', displayStatus: 'expired' })
  })

  it('grant 422: same fields and messages as the mock', async () => {
    const cases: Record<string, unknown>[] = [
      { packageId: '1' },
      { userId: '1.5', packageId: '1' },
      { userId: 'abc', packageId: '1' },
      { userId: String(h.PELAJAR2) },
      { userId: String(h.PELAJAR2), packageId: 'x' },
      { userId: String(h.PELAJAR2), packageId: '1', expiresAt: '2026-13-45' },
      { userId: String(h.PELAJAR2), packageId: '1', expiresAt: 'esok' },
      { userId: String(h.PELAJAR2), packageId: '1', expiresAt: 5 },
      { packageId: '1', expiresAt: 'esok' },
    ]
    for (const body of cases) await expectSameFields(PkskAdminAccessGrantSchema, 'POST', A, body)
  })

  it('grant: unknown user or package is a service rule with the mock messages', async () => {
    const unknownUser = { userId: '99999', packageId: '1' }
    expect(PkskAdminAccessGrantSchema.safeParse(unknownUser).success).toBe(true)
    expect(errorOf(await send('POST', A, unknownUser)).fields).toEqual({ userId: PKSK_ADMIN_MESSAGES.userNotFound })
    const unknownPackage = { userId: String(h.PELAJAR2), packageId: '9' }
    expect(PkskAdminAccessGrantSchema.safeParse(unknownPackage).success).toBe(true)
    expect(errorOf(await send('POST', A, unknownPackage)).fields).toEqual({ packageId: PKSK_ADMIN_MESSAGES.package })
    expect(PkskAdminAccessGrantSchema.safeParse({ userId: '1', packageId: '1', extra: true }).success).toBe(false)
  })

  it('revoke: response parses; 404 and 409 carry the mock messages', async () => {
    const list = PkskAdminAccessListResponseSchema.parse(wire((await get(A)).body))
    const active = list.data.find((x) => x.displayStatus === 'active' && x.user.id === String(h.PELAJAR2))
    expect(active).toBeDefined()
    const r = await send('POST', `${A}/${active?.id ?? '0'}/revoke`)
    expect(r.status).toBe(200)
    const parsed = PkskAdminAccessMutationResponseSchema.parse(wire(r.body))
    expect(parsed.status).toBe(PKSK_ADMIN_FLASH.accessRevoked)
    expect(parsed.data).toMatchObject({ status: 'revoked', displayStatus: 'revoked' })

    const again = await send('POST', `${A}/${active?.id ?? '0'}/revoke`)
    expect(again.status).toBe(409)
    expect(errorOf(again)).toMatchObject({ code: 'CONFLICT', message: PKSK_ADMIN_MESSAGES.accessNotActive })
    const missing = await send('POST', `${A}/9999/revoke`)
    expect(missing.status).toBe(404)
    expect(errorOf(missing)).toMatchObject({ code: 'NOT_FOUND', message: PKSK_ADMIN_MESSAGES.accessNotFound })
  })
})

describe('guards', () => {
  it('every admin route answers 401 without a session and 403 for a student (error body parses)', async () => {
    const routes: ['GET' | 'POST' | 'PUT' | 'DELETE', string][] = [
      ['GET', Q],
      ['GET', `${Q}/stats`],
      ['POST', `${Q}/bulk`],
      ['GET', `${Q}/177698`],
      ['POST', Q],
      ['PUT', `${Q}/177698`],
      ['DELETE', `${Q}/177698`],
      ['GET', A],
      ['GET', `${A}/stats`],
      ['POST', A],
      ['POST', `${A}/1/revoke`],
      ['GET', '/api/pksk-packages'],
    ]
    for (const [method, url] of routes) {
      const body = method === 'GET' ? undefined : {}
      const guest = await h.call(runtime, method, url, null, body)
      expect(guest.status, url).toBe(401)
      expect(errorOf(guest)).toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthenticated.' })
      const student = await h.call(runtime, method, url, h.PELAJAR, body)
      expect(student.status, url).toBe(403)
      expect(errorOf(student)).toMatchObject({ code: 'FORBIDDEN', message: 'This action is unauthorized.' })
    }
  })
})

describe('OpenAPI (local registry)', () => {
  const registry = new OpenAPIRegistry()
  for (const [name, schema] of Object.entries({ ...PKSK_SHARED_COMPONENT_SCHEMAS, ...PKSK_ADMIN_COMPONENT_SCHEMAS })) {
    registry.register(name, schema)
  }
  registerPkskAdminPaths(registry)
  const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'pksk-admin', version: '0' },
  }) as unknown as {
    paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }

  const operations: [string, string][] = [
    ['get', '/admin/pksk-questions'],
    ['get', '/admin/pksk-questions/stats'],
    ['post', '/admin/pksk-questions/bulk'],
    ['get', '/admin/pksk-questions/{id}'],
    ['post', '/admin/pksk-questions'],
    ['put', '/admin/pksk-questions/{id}'],
    ['delete', '/admin/pksk-questions/{id}'],
    ['get', '/admin/pksk-access'],
    ['get', '/admin/pksk-access/stats'],
    ['post', '/admin/pksk-access'],
    ['post', '/admin/pksk-access/{id}/revoke'],
    ['get', '/pksk-packages'],
  ]

  it('has all 12 path and method pairs', () => {
    for (const [method, path] of operations) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    expect(operations).toHaveLength(12)
  })

  it('has every admin component', () => {
    for (const name of Object.keys(PKSK_ADMIN_COMPONENT_SCHEMAS)) {
      expect(doc.components.schemas[name], name).toBeDefined()
    }
  })

  it('documents 401/403 on every route and 429 on every write', () => {
    for (const [method, path] of operations) {
      const responses = doc.paths[path]?.[method]?.responses ?? {}
      expect(responses['401'], `${method} ${path}`).toBeDefined()
      expect(responses['403'], `${method} ${path}`).toBeDefined()
      if (method !== 'get') expect(responses['429'], `${method} ${path}`).toBeDefined()
    }
  })
})
