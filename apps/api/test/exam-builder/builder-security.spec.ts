import { BIJAK_BUILDER_MESSAGES as MSG, BijakBuilderEditorSchema, BijakBuilderPaperCreateResultSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FakeBank, matBank } from './fakes'
import { serveSeededBlueprints, setPocMarkBudgets } from '../support/serve-blueprints'
import { ACCOUNTS, anonymous, bootBuilderApp, count, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

type Method = 'get' | 'post' | 'put' | 'delete'
interface Route {
  method: Method
  url: (id: string) => string
  body?: unknown
  mutation: boolean
}
const ROUTES: Route[] = [
  { method: 'get', url: () => '/api/admin/papers', mutation: false },
  { method: 'post', url: () => '/api/admin/papers', body: { subject: 'MAT', kertas: 2 }, mutation: true },
  { method: 'post', url: () => '/api/admin/papers/preview', body: { ids: [] }, mutation: true },
  { method: 'get', url: (id) => `/api/admin/papers/${id}`, mutation: false },
  { method: 'put', url: (id) => `/api/admin/papers/${id}`, body: { title: 'Lain' }, mutation: true },
  { method: 'delete', url: (id) => `/api/admin/papers/${id}`, mutation: true },
  { method: 'post', url: (id) => `/api/admin/papers/${id}/publish`, mutation: true },
  { method: 'post', url: (id) => `/api/admin/papers/${id}/withdraw`, mutation: true },
]

describe('paper builder security (AC6)', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let admin: Client
  let paperId: string

  beforeAll(async () => {
    bank = matBank()
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank, pool: 'builder-source' })
    await serveSeededBlueprints(t.db)
    admin = await loginAs(t, ACCOUNTS.admin)
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    paperId = envelopeOf(BijakBuilderPaperCreateResultSchema).parse(res.body).data.id
  })
  afterAll(async () => {
    await t.close()
  })

  const call = (c: Client, r: Route, id = paperId) => c[r.method === 'delete' ? 'del' : r.method](r.url(id), r.body as never)

  it.each(ROUTES)('$method $url(1): no session is 401', async (r) => {
    const anon = anonymous(t)
    const res = await anon[r.method](r.url(paperId)).send(r.body as object | undefined)
    expectError(res, 'UNAUTHORIZED', 401)
  })

  for (const [name, account] of [['teacher', ACCOUNTS.teacher], ['school admin', ACCOUNTS.schoolAdmin], ['student', ACCOUNTS.student]] as const) {
    it.each(ROUTES)(`$method $url(1): ${name} is 403`, async (r) => {
      const c = await loginAs(t, account)
      expectError(await call(c, r), 'FORBIDDEN', 403)
    })
  }

  it.each(ROUTES)('$method $url(1): an admin in Mod Pelajar is 403', async (r) => {
    const c = await loginAs(t, ACCOUNTS.admin)
    await c.enterMod()
    expectError(await call(c, r), 'FORBIDDEN', 403)
  })

  it.each(ROUTES.filter((r) => r.mutation))('$method $url(1): no CSRF token is 403 CSRF_INVALID and nothing changes', async (r) => {
    const papers = await count(t.db, 'select count(*) n from papers')
    const res = await admin.noCsrf(r.method, r.url(paperId), r.body)
    expectError(res, 'CSRF_INVALID', 403)
    expect(await count(t.db, 'select count(*) n from papers')).toBe(papers)
    expect(await count(t.db, 'select count(*) n from papers where id = $1', [paperId])).toBe(1)
  })

  it.each(['999999999', '007', 'abc', '99999999999999999999'])('unknown or malformed id %s: 404 on get, put, publish and withdraw; delete is ok', async (id) => {
    for (const r of ROUTES.filter((x) => x.url('X').includes('/X'))) {
      const res = await call(admin, r, id)
      if (r.method === 'delete') {
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ data: { ok: true } })
      } else {
        expectError(res, 'NOT_FOUND', 404, MSG.paperNotFound)
      }
    }
  })

  it('an unknown id does not touch the 422 body check: 404 comes before a bad body', async () => {
    expectError(await admin.put('/api/admin/papers/999999999', { title: '' }), 'NOT_FOUND', 404, MSG.paperNotFound)
  })

  it('unknown keys in a body are refused (strict contract schemas)', async () => {
    expectError(await admin.put(`/api/admin/papers/${paperId}`, { title: 'X', status: 'terbit' }), 'VALIDATION_ERROR', 422)
    expectError(await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, status: 'published' }), 'VALIDATION_ERROR', 422)
  })
})

describe('generated papers are invisible to the builder', () => {
  let t: BuilderTestApp
  let admin: Client
  let janaId: string

  beforeAll(async () => {
    // default PoC sources on both sides, so Jana Kertas can compose from the PoC bank
    t = await bootBuilderApp()
    await setPocMarkBudgets(t.db)
    await serveSeededBlueprints(t.db)
    admin = await loginAs(t, ACCOUNTS.admin)
    const student = await loginAs(t, ACCOUNTS.student)
    const res = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
    janaId = String((res.body.data as { id?: string; paperId?: string }).id ?? (res.body.data as { paperId?: string }).paperId)
  })
  afterAll(async () => {
    await t.close()
  })

  it('exists as a jana row, but get, put, publish, withdraw are 404, delete does nothing and the list omits it', async () => {
    expect(await count(t.db, `select count(*) n from papers where id = $1 and kind = 'jana'`, [janaId])).toBe(1)
    expectError(await admin.get(`/api/admin/papers/${janaId}`), 'NOT_FOUND', 404, MSG.paperNotFound)
    expectError(await admin.put(`/api/admin/papers/${janaId}`, { title: 'Lain' }), 'NOT_FOUND', 404, MSG.paperNotFound)
    expectError(await admin.post(`/api/admin/papers/${janaId}/publish`), 'NOT_FOUND', 404, MSG.paperNotFound)
    expectError(await admin.post(`/api/admin/papers/${janaId}/withdraw`), 'NOT_FOUND', 404, MSG.paperNotFound)
    const del = await admin.del(`/api/admin/papers/${janaId}`)
    expect(del.body).toEqual({ data: { ok: true } })
    expect(await count(t.db, `select count(*) n from papers where id = $1 and kind = 'jana'`, [janaId])).toBe(1)
    const list = await admin.get('/api/admin/papers?pageSize=100')
    expect((list.body.data as { id: string }[]).map((p) => p.id)).not.toContain(janaId)
    expect(await count(t.db, `select count(*) n from audit_events where target_id = $1`, [janaId])).toBe(0)
  })

  it('the default PoC sources also serve the builder: seeded papers are listed, the editor works', async () => {
    const list = await admin.get('/api/admin/papers?pageSize=100')
    expect(list.body.data).toHaveLength(4)
    const e = envelopeOf(BijakBuilderEditorSchema).parse((await admin.get(`/api/admin/papers/${list.body.data[0].id}`)).body)
    expect(e.data.paper.sections.length).toBeGreaterThan(0)
  })
})

describe('rate limit', () => {
  let t: BuilderTestApp
  let admin: Client

  beforeAll(async () => {
    t = await bootBuilderApp({ builderSource: matBank(), papersSource: matBank(), pool: 'builder-source', env: { THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '2' } })
    await serveSeededBlueprints(t.db)
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  it('the 3rd write in a minute is 429 RATE_LIMITED with Retry-After; reads are not limited', async () => {
    for (let i = 0; i < 2; i++) expect((await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })).status).toBe(201)
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    const err = expectError(res, 'RATE_LIMITED', 429)
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBe(err.retryAfter)
    expect(await count(t.db, `select count(*) n from papers where kind = 'pilihan' and status = 'draft'`)).toBe(2)
    expect((await admin.get('/api/admin/papers')).status).toBe(200)
  })
})
