import { BijakBlueprintViewSchema, BIJAK_BUILDER_MESSAGES as MSG, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, auditRows, bootBuilderApp, count, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

const ListSchema = listEnvelopeOf(BijakBlueprintViewSchema)
const CSRF = 'CSRF_INVALID'

const section = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  markBudget: 10,
  questionCount: 10,
  rule: { type: 'all' },
  pool: 'a',
  ...over,
})
const body = (over: Record<string, unknown> = {}) => ({
  source: 'Spec',
  code: 'SEJ/1',
  durationMin: 90,
  instructions: ['Jawab semua.'],
  reference: [{ title: 'Rumus', items: ['a = b'] }],
  sections: [section(), section({ label: 'Bahagian B', markBudget: 6, questionCount: 8, rule: { type: 'choose', n: 3 }, compulsory: true, instruction: 'Pilih tiga.', pool: 'b' })],
  ...over,
})
const create = (over: Record<string, unknown> = {}) => ({ subject: 'SEJ', kertas: 1, ...body(), ...over })

let t: BuilderTestApp
let admin: Client

beforeAll(async () => {
  t = await bootBuilderApp()
  admin = await loginAs(t, ACCOUNTS.admin)
})
afterAll(async () => {
  await t.close()
})

const rows = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
const bpRows = (code: string) =>
  rows(
    `select b.id::text, b.version, b.status, b.source, b.code, b.duration_min, b.instructions, b.reference_sheets, b.total_marks,
            (select json_agg(s order by s.position) from (select position, label, instruction, rule_type, rule_n, question_count, mark_budget, compulsory, pool from blueprint_sections where blueprint_id = b.id) s) as sections
       from blueprints b where b.code = $1 order by b.version`,
    [code],
  )

describe('list', () => {
  it('lists the four seeded active blueprints, schema valid, with paging meta', async () => {
    const res = await admin.get('/api/admin/blueprints')
    expect(res.status).toBe(200)
    const parsed = ListSchema.parse(res.body)
    expect(parsed.data.map((b) => `${b.subject}/${b.kertas}`)).toEqual(['MAT/1', 'MAT/2', 'SN/2', 'SN/1'])
    expect(parsed.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 4, totalPages: 1, from: 1, to: 4 })
  })

  it('filters by subject and kertas and pages', async () => {
    const mat = ListSchema.parse((await admin.get('/api/admin/blueprints?subject=MAT')).body)
    expect(mat.data.map((b) => b.kertas)).toEqual([1, 2])
    const k2 = ListSchema.parse((await admin.get('/api/admin/blueprints?kertas=2')).body)
    expect(k2.data.map((b) => b.subject)).toEqual(['MAT', 'SN'])
    const one = ListSchema.parse((await admin.get('/api/admin/blueprints?subject=SN&kertas=1')).body)
    expect(one.data).toHaveLength(1)
    const p2 = ListSchema.parse((await admin.get('/api/admin/blueprints?pageSize=3&page=2')).body)
    expect(p2.data).toHaveLength(1)
    expect(p2.meta).toMatchObject({ page: 2, pageSize: 3, totalItems: 4, totalPages: 2, from: 4, to: 4 })
    const none = ListSchema.parse((await admin.get('/api/admin/blueprints?subject=ZZZ')).body)
    expect(none.data).toEqual([])
    expectError(await admin.get('/api/admin/blueprints?page=0'), 'VALIDATION_ERROR')
  })

  it('hides Draf-source and retired blueprints', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 2, source: 'Draf', code: 'DRAF/2' }))).status).toBe(201)
    const list = ListSchema.parse((await admin.get('/api/admin/blueprints')).body)
    expect(list.data.some((b) => b.subject === 'SEJ' && b.kertas === 2)).toBe(false)
    // a Draf blueprint is still readable by subject and kertas
    expect((await admin.get('/api/admin/blueprints/SEJ/2')).body.data.source).toBe('Draf')
    expect((await admin.post('/api/admin/blueprints/SN/1/retire')).status).toBe(200)
    const after = ListSchema.parse((await admin.get('/api/admin/blueprints')).body)
    expect(after.data.some((b) => b.subject === 'SN' && b.kertas === 1)).toBe(false)
    expect(after.meta.totalItems).toBe(3)
  })
})

describe('get', () => {
  it('returns the active blueprint view', async () => {
    const res = await admin.get('/api/admin/blueprints/MAT/2')
    expect(res.status).toBe(200)
    const view = BijakBlueprintViewSchema.parse(res.body.data)
    expect(view).toMatchObject({ subject: 'MAT', kertas: 2, code: '1449/2', source: 'Spec' })
    expect(view.sections.length).toBeGreaterThan(0)
  })

  it('404 blueprintNotFound for unknown subject, unknown or bad kertas', async () => {
    for (const url of ['/ZZZ/1', '/MAT/9', '/MAT/0', '/MAT/abc', '/MAT/1.5', '/MAT/99999999999', '/MAT/-1']) {
      expectError(await admin.get(`/api/admin/blueprints${url}`), 'NOT_FOUND', 404, MSG.blueprintNotFound)
    }
  })

  it('404 for a retired blueprint', async () => {
    expect((await admin.post('/api/admin/blueprints/SN/2/retire')).status).toBe(200)
    expectError(await admin.get('/api/admin/blueprints/SN/2'), 'NOT_FOUND', 404, MSG.blueprintNotFound)
  })
})

describe('create', () => {
  it('201 with the view, stored as active version 1, then 409 when one is active', async () => {
    const res = await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 1 }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const view = BijakBlueprintViewSchema.parse(res.body.data)
    expect(view).toMatchObject({ subject: 'SEJ', kertas: 1, source: 'Spec', code: 'SEJ/1', durationMin: 90, totalMarks: 16 })
    expect(view.sections[1]).toMatchObject({ compulsory: true, instruction: 'Pilih tiga.', rule: { type: 'choose', n: 3 } })
    expect(view.sections[0]?.instruction).toBe('Jawab semua soalan.')
    const [row] = await bpRows('SEJ/1')
    expect(row).toMatchObject({ version: 1, status: 'active', source: 'spec', total_marks: 16 })
    expect(row?.reference_sheets).toEqual([{ title: 'Rumus', items: ['a = b'] }])
    expectError(await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 1, code: 'SEJ/X' })), 'CONFLICT', 409, MSG.blueprintExists)
    expect(await bpRows('SEJ/X')).toHaveLength(0)
  })

  it('maps the Bijak subject codes (MAT, SN) to the curriculum subjects', async () => {
    const res = await admin.post('/api/admin/blueprints', create({ subject: 'MAT', kertas: 3, code: 'MAT/3' }))
    expect(res.status).toBe(201)
    expect(res.body.data.subject).toBe('MAT')
  })

  it('422 with fields for invalid bodies', async () => {
    const post = (over: Record<string, unknown>) => admin.post('/api/admin/blueprints', create({ code: 'BAD/1', ...over }))
    const e1 = expectError(await post({ sections: [] }), 'VALIDATION_ERROR')
    expect(e1.fields).toHaveProperty('sections')
    const e2 = expectError(await post({ sections: [section({ rule: { type: 'choose' } })] }), 'VALIDATION_ERROR')
    expect(Object.keys(e2.fields ?? {}).some((k) => k.startsWith('sections.0.rule'))).toBe(true)
    const e3 = expectError(await post({ subject: 'NOPE' }), 'VALIDATION_ERROR')
    expect(e3.fields).toEqual({ subject: 'Medan ini tidak sah.' })
    expect(expectError(await post({ source: 'Lain' }), 'VALIDATION_ERROR').fields).toHaveProperty('source')
    expect(expectError(await post({ durationMin: 0 }), 'VALIDATION_ERROR').fields).toHaveProperty('durationMin')
    expect(expectError(await post({ extra: 1 }), 'VALIDATION_ERROR')).toBeTruthy()
    expect(expectError(await post({ kertas: 40000, subject: 'SEJ' }), 'VALIDATION_ERROR').fields).toEqual({ kertas: 'Medan ini tidak sah.' })
    expect(await bpRows('BAD/1')).toHaveLength(0)
  })

  it('422 on the code field when (code, version) is taken by another contract', async () => {
    const e = expectError(await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 5, code: '1449/1' })), 'VALIDATION_ERROR')
    expect(e.fields).toEqual({ code: 'Kod kertas ini sudah digunakan oleh kontrak lain.' })
    expect(await count(t.db, `select count(*) n from blueprints b join subjects s on s.id = b.subject_id where s.code = 'SEJ' and b.kertas = 5`)).toBe(0)
  })

  it('a re-create after retire gets version max + 1', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 4, code: 'RE/4' }))).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints/SEJ/4/retire')).status).toBe(200)
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 4, code: 'RE/4B' }))).status).toBe(201)
    const [first] = await bpRows('RE/4')
    const [second] = await bpRows('RE/4B')
    expect(first).toMatchObject({ version: 1, status: 'retired' })
    expect(second).toMatchObject({ version: 2, status: 'active' })
  })
})

describe('choose rule bounds', () => {
  const choose = (n: number) => [section({ questionCount: 5, markBudget: 5, rule: { type: 'choose', n } })]

  it.each([40000, 6])('create and versions reject n = %i above the question count with sections.0.rule.n', async (n) => {
    const c = expectError(await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 20, code: 'N/20', sections: choose(n) })), 'VALIDATION_ERROR')
    expect(c.fields).toEqual({ 'sections.0.rule.n': 'Medan ini tidak sah.' })
    const v = expectError(await admin.post('/api/admin/blueprints/MAT/1/versions', body({ code: 'N/20V', sections: [section(), ...choose(n)] })), 'VALIDATION_ERROR')
    expect(v.fields).toEqual({ 'sections.1.rule.n': 'Medan ini tidak sah.' })
    expect(await bpRows('N/20')).toHaveLength(0)
    expect(await bpRows('N/20V')).toHaveLength(0)
  })

  it('accepts n equal to the question count', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 21, code: 'N/21', sections: choose(5) }))).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints/SEJ/21/versions', body({ code: 'N/21B', sections: choose(5) }))).status).toBe(201)
  })
})

describe('versions (AC5)', () => {
  it('keeps the old row content, activates n+1 and leaves papers on the old version', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 6, code: 'V/6' }))).status).toBe(201)
    const [old] = await bpRows('V/6')
    const subjectId = ((await rows(`select id::text from subjects where code = 'SEJ'`))[0] as { id: string }).id
    await rows(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, blueprint_id, is_test)
       values ('pilihan', 'Kertas lama', $1, 6, 90, 'published', $2, false)`,
      [subjectId, old?.id],
    )
    const res = await admin.post(
      '/api/admin/blueprints/SEJ/6/versions',
      body({ code: 'V/6B', durationMin: 120, instructions: ['Baharu.'], reference: [], sections: [section({ label: 'Satu', markBudget: 5, questionCount: 5 })] }),
    )
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(BijakBlueprintViewSchema.parse(res.body.data)).toMatchObject({ code: 'V/6B', durationMin: 120, totalMarks: 5 })

    const [oldAfter] = await bpRows('V/6')
    expect({ ...oldAfter, status: 'active' }).toEqual({ ...old, status: 'active' })
    expect(oldAfter?.status).toBe('retired')
    const [fresh] = await bpRows('V/6B')
    expect(fresh).toMatchObject({ version: 2, status: 'active', duration_min: 120, instructions: ['Baharu.'] })

    const get = await admin.get('/api/admin/blueprints/SEJ/6')
    expect(get.body.data).toMatchObject({ code: 'V/6B', durationMin: 120 })
    const papers = await rows(`select blueprint_id::text from papers where title = 'Kertas lama'`)
    expect(papers).toEqual([{ blueprint_id: old?.id }])
  })

  it('404 when the blueprint never existed, 422 for a bad body, 409 when retired', async () => {
    expectError(await admin.post('/api/admin/blueprints/ZZZ/1/versions', body()), 'NOT_FOUND', 404, MSG.blueprintNotFound)
    expectError(await admin.post('/api/admin/blueprints/SEJ/77/versions', body()), 'NOT_FOUND', 404, MSG.blueprintNotFound)
    expect(expectError(await admin.post('/api/admin/blueprints/MAT/1/versions', body({ sections: [] })), 'VALIDATION_ERROR').fields).toHaveProperty('sections')
    expect((await admin.post('/api/admin/blueprints/SEJ/6/retire')).status).toBe(200)
    expectError(await admin.post('/api/admin/blueprints/SEJ/6/versions', body()), 'CONFLICT', 409, MSG.blueprintAlreadyRetired)
  })

  it('422 on the code field when (code, version) of the new version is taken', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 12, code: 'P/12' }))).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints/SEJ/12/versions', body({ code: 'DUP/12' }))).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 13, code: 'Q/13' }))).status).toBe(201)
    const e = expectError(await admin.post('/api/admin/blueprints/SEJ/13/versions', body({ code: 'DUP/12' })), 'VALIDATION_ERROR')
    expect(e.fields).toEqual({ code: 'Kod kertas ini sudah digunakan oleh kontrak lain.' })
    // nothing changed: the old version is still the active one
    expect((await bpRows('Q/13'))[0]).toMatchObject({ version: 1, status: 'active' })
    expect(await count(t.db, `select count(*) n from blueprints where code = 'DUP/12'`)).toBe(1)
  })

  it('two concurrent versions: one wins, the other gets a clean 409 or both chain', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 8, code: 'C/8' }))).status).toBe(201)
    const [a, b] = await Promise.all([
      admin.post('/api/admin/blueprints/SEJ/8/versions', body({ code: 'C/8A' })),
      admin.post('/api/admin/blueprints/SEJ/8/versions', body({ code: 'C/8B' })),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await count(t.db, `select count(*) n from blueprints where code like 'C/8%' and status = 'active'`)).toBe(1)
  })
})

describe('retire', () => {
  it('200 ok, then 404 on get, absent from the list, 409 on versions and on a second retire', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 9, code: 'R/9' }))).status).toBe(201)
    const res = await admin.post('/api/admin/blueprints/SEJ/9/retire')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { ok: true } })
    expectError(await admin.get('/api/admin/blueprints/SEJ/9'), 'NOT_FOUND', 404, MSG.blueprintNotFound)
    const list = ListSchema.parse((await admin.get('/api/admin/blueprints?subject=SEJ')).body)
    expect(list.data.some((b) => b.kertas === 9)).toBe(false)
    expectError(await admin.post('/api/admin/blueprints/SEJ/9/versions', body()), 'CONFLICT', 409, MSG.blueprintAlreadyRetired)
    expectError(await admin.post('/api/admin/blueprints/SEJ/9/retire'), 'CONFLICT', 409, MSG.blueprintAlreadyRetired)
    expectError(await admin.post('/api/admin/blueprints/SEJ/88/retire'), 'NOT_FOUND', 404, MSG.blueprintNotFound)
    expect((await bpRows('R/9'))[0]?.status).toBe('retired')
  })
})

describe('audit (AC8)', () => {
  it('records create, version and retire with actor, target and from/to', async () => {
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'SEJ', kertas: 11, code: 'A/11' }))).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints/SEJ/11/versions', body({ code: 'A/11B' }))).status).toBe(201)
    expect((await admin.post('/api/admin/blueprints/SEJ/11/retire')).status).toBe(200)
    const [v1] = await bpRows('A/11')
    const [v2] = await bpRows('A/11B')
    const created = (await auditRows(t.db, 'bijak.blueprint.created')).find((r) => r.target_id === v1?.id)
    expect(created).toMatchObject({ actor_user_id: admin.userId, target_type: 'bijak_blueprint' })
    expect(created?.detail).toMatchObject({ from: null, to: 'active', toVersion: 1, subject: 'SEJ', kertas: 11 })
    const versioned = (await auditRows(t.db, 'bijak.blueprint.version_created')).find((r) => r.target_id === v2?.id)
    expect(versioned).toMatchObject({ actor_user_id: admin.userId, target_type: 'bijak_blueprint' })
    expect(versioned?.detail).toMatchObject({ fromVersion: 1, toVersion: 2, from: 'active', to: 'active' })
    const retired = (await auditRows(t.db, 'bijak.blueprint.retired')).find((r) => r.target_id === v2?.id)
    expect(retired).toMatchObject({ actor_user_id: admin.userId, target_type: 'bijak_blueprint' })
    expect(retired?.detail).toMatchObject({ from: 'active', to: 'retired', fromVersion: 2 })
  })

  it('writes no audit row for a refused request', async () => {
    const before = await count(t.db, `select count(*) n from audit_events where action like 'bijak.blueprint.%'`)
    expect((await admin.post('/api/admin/blueprints', create({ subject: 'MAT', kertas: 1, code: 'A/11C' }))).status).toBe(409)
    expect((await admin.post('/api/admin/blueprints/SEJ/404/retire')).status).toBe(404)
    expect(await count(t.db, `select count(*) n from audit_events where action like 'bijak.blueprint.%'`)).toBe(before)
  })
})

describe('access (AC6)', () => {
  const routes: { name: string; method: 'get' | 'post'; url: string; body?: unknown }[] = [
    { name: 'list', method: 'get', url: '/api/admin/blueprints' },
    { name: 'get', method: 'get', url: '/api/admin/blueprints/MAT/1' },
    { name: 'create', method: 'post', url: '/api/admin/blueprints', body: create({ code: 'ZZ/1' }) },
    { name: 'version', method: 'post', url: '/api/admin/blueprints/MAT/1/versions', body: body() },
    { name: 'retire', method: 'post', url: '/api/admin/blueprints/MAT/1/retire' },
  ]

  it('anonymous gets 401 on all five routes', async () => {
    for (const r of routes) {
      const res = await t.agent()[r.method](r.url).send(r.body as object)
      expectError(res, 'UNAUTHORIZED', 401)
    }
  })

  it.each([['teacher', ACCOUNTS.teacher], ['school admin', ACCOUNTS.schoolAdmin], ['student', ACCOUNTS.student]])('%s gets 403 on all five routes', async (_n, account) => {
    const c = await loginAs(t, account)
    for (const r of routes) {
      const res = r.method === 'get' ? await c.get(r.url) : await c.post(r.url, r.body)
      expectError(res, 'FORBIDDEN', 403)
    }
  })

  it('admin inside Mod Pelajar gets 403 on all five routes', async () => {
    const c = await loginAs(t, ACCOUNTS.admin)
    await c.enterMod()
    for (const r of routes) {
      const res = r.method === 'get' ? await c.get(r.url) : await c.post(r.url, r.body)
      expectError(res, 'FORBIDDEN', 403)
    }
  })

  it('POSTs without a CSRF token get 403 CSRF_INVALID and change nothing', async () => {
    const before = await count(t.db, 'select count(*) n from blueprints')
    for (const r of routes.filter((x) => x.method === 'post')) {
      expectError(await admin.noCsrf('post', r.url, r.body), CSRF, 403)
    }
    expect(await count(t.db, 'select count(*) n from blueprints')).toBe(before)
  })
})

describe('rate limit', () => {
  it('429 on the third write per minute with THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE=2', async () => {
    const limited = await bootBuilderApp({ env: { THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '2' } })
    try {
      const c = await loginAs(limited, ACCOUNTS.admin)
      expect((await c.post('/api/admin/blueprints/MAT/1/retire')).status).toBe(200)
      expect((await c.post('/api/admin/blueprints/MAT/1/retire')).status).toBe(409)
      expectError(await c.post('/api/admin/blueprints/MAT/2/retire'), 'RATE_LIMITED', 429)
      expect((await c.get('/api/admin/blueprints')).status).toBe(200)
    } finally {
      await limited.close()
    }
  })
})
