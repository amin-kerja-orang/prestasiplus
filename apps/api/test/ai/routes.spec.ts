import { AiSettingsSchema, AiStatusSchema, AiTestResultSchema, AiUsageRowSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, bootAiApp, FAKE_KEY, get, insertUsageRow, jsonResponse, login, post, put, SCHOOL_ADMIN, STUDENT, TEACHER, vendorEnv, type AiTestApp, stubFetch } from './helpers'
import { dumpAiTables, fixture } from './helpers'
import type { Response } from 'supertest'

const STATUS: Record<string, number> = { VALIDATION_ERROR: 422, CSRF_INVALID: 403, RATE_LIMITED: 429, AI_UNAVAILABLE: 503, AI_BUDGET_EXHAUSTED: 503 }
/** Error envelope with the status of the contract table. */
function expectError(res: Response, code: string): void {
  expect(res.body?.error?.code, JSON.stringify(res.body)).toBe(code)
  expect(res.status).toBe(STATUS[code])
  expect(res.body.error.requestId).toBeTruthy()
}

describe('/ai/* admin routes (mock provider)', () => {
  let t: AiTestApp
  beforeAll(async () => {
    t = await bootAiApp({ env: { AI_MONTHLY_BUDGET_SEN: '5000' } })
  })
  afterAll(async () => t.close())

  it('GET /ai/status: parses against the contract, no-store, no credential', async () => {
    const admin = await login(t, ADMIN)
    const res = await get(admin, '/ai/status')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    const status = AiStatusSchema.parse(res.body.data)
    expect(status).toMatchObject({ provider: 'mock', configured: true, budgetSen: 5000, monthToDateCostSen: 0, budgetState: 'ok', month: '2026-10' })
    expect(status.settings.updatedAt).toBeNull()
    expect(JSON.stringify(res.body)).not.toMatch(/apiKey|api_key|baseUrl|AI_API_KEY/i)
  })

  it('GET /ai/usage: newest first, paginated, filtered by month and provider, rows parse', async () => {
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 7, at: '2026-10-05T01:00:00Z' })
    await insertUsageRow(t.db, { provider: 'openai_compatible', costSen: 9, at: '2026-10-06T01:00:00Z' })
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 1, at: '2026-09-30T10:00:00Z' })
    const admin = await login(t, ADMIN)
    const res = await get(admin, '/ai/usage?pageSize=1')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 2 })
    const row = AiUsageRowSchema.parse(res.body.data[0])
    expect(row).toMatchObject({ provider: 'openai-compatible', costSen: 9 })
    const sept = await get(admin, '/ai/usage?month=2026-09')
    expect(sept.body.data).toHaveLength(1)
    const only = await get(admin, '/ai/usage?provider=anthropic')
    expect(only.body.data.map((r: { costSen: number }) => r.costSen)).toEqual([7])
    expectError(await get(admin, '/ai/usage?month=2026-13'), 'VALIDATION_ERROR')
    expectError(await get(admin, '/ai/usage?pageSize=1000'), 'VALIDATION_ERROR')
  })

  it('PUT /ai/settings: saves, returns the settings, audit row has actor and old and new value', async () => {
    const admin = await login(t, ADMIN)
    const res = await put(admin, '/ai/settings', { monthlyBudgetSen: 12345, notifyAt80: false, notifyAt100: true })
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    const s = AiSettingsSchema.parse(res.body.data)
    expect(s).toMatchObject({ monthlyBudgetSen: 12345, notifyAt80: false, notifyAt100: true })
    expect(s.updatedAt).not.toBeNull()
    const status = AiStatusSchema.parse((await get(admin, '/ai/status')).body.data)
    expect(status.budgetSen).toBe(12345)
    const audit = await t.db.query<{ action: string; actor_user_id: string; details: { before: { monthlyBudgetSen: number }; after: { monthlyBudgetSen: number } } }>(`select action, actor_user_id::text, detail as details from audit_events where action = 'ai.settings.updated'`)
    expect(audit).toHaveLength(1)
    expect(audit[0]?.actor_user_id).toBe(admin.session.user.id)
    expect(audit[0]?.details.before.monthlyBudgetSen).toBe(5000)
    expect(audit[0]?.details.after.monthlyBudgetSen).toBe(12345)
  })

  it('PUT /ai/settings: 422 for an unknown key, a missing key, a negative, fractional or over-large cap, or a non-boolean', async () => {
    const admin = await login(t, ADMIN)
    const ok = { monthlyBudgetSen: 100, notifyAt80: true, notifyAt100: true }
    for (const body of [{ ...ok, extra: 1 }, { monthlyBudgetSen: 1, notifyAt80: true }, { ...ok, monthlyBudgetSen: -1 }, { ...ok, monthlyBudgetSen: 1.5 }, { ...ok, monthlyBudgetSen: 100_000_001 }, { ...ok, notifyAt80: 'yes' }, { ...ok, monthlyBudgetSen: '5' }]) {
      expectError(await put(admin, '/ai/settings', body), 'VALIDATION_ERROR')
    }
  })

  it('POST /ai/test: mock health check parses, logs one health_check row', async () => {
    const admin = await login(t, ADMIN)
    const res = await post(admin, '/ai/test', {})
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    expect(AiTestResultSchema.parse(res.body.data)).toMatchObject({ ok: true, provider: 'mock' })
    const rows = await t.db.query<{ purpose: string; actor_user_id: string }>(`select purpose, actor_user_id::text from ai_usage_logs where purpose = 'health_check'`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actor_user_id).toBe(admin.session.user.id)
    expectError(await post(admin, '/ai/test', { unexpected: true }), 'VALIDATION_ERROR')
  })

  it('401 without a session on every route', async () => {
    for (const [method, path] of [['get', '/ai/status'], ['get', '/ai/usage'], ['put', '/ai/settings'], ['post', '/ai/test']] as const) {
      const res = await t.http()[method](`/api${path}`).send({})
      expect(res.status, `${method} ${path}`).toBe(401)
    }
  })

  it('403 for a Guru, a school admin and a Pelajar on every route (Admin Pusat only)', async () => {
    for (const who of [TEACHER, SCHOOL_ADMIN, STUDENT]) {
      const u = await login(t, who)
      expect((await get(u, '/ai/status')).status, who).toBe(403)
      expect((await get(u, '/ai/usage')).status, who).toBe(403)
      expect((await put(u, '/ai/settings', { monthlyBudgetSen: 1, notifyAt80: true, notifyAt100: true })).status, who).toBe(403)
      expect((await post(u, '/ai/test', {})).status, who).toBe(403)
    }
  })

  it('403 CSRF_INVALID on PUT and POST without the token, and nothing changes', async () => {
    const admin = await login(t, ADMIN)
    const before = (await t.db.query(`select * from ai_settings`))[0]
    expectError(await put(admin, '/ai/settings', { monthlyBudgetSen: 1, notifyAt80: true, notifyAt100: true }, null), 'CSRF_INVALID')
    expectError(await post(admin, '/ai/test', {}, 'wrong-token'), 'CSRF_INVALID')
    expect((await t.db.query(`select * from ai_settings`))[0]).toEqual(before)
  })
})

describe('rate limits of the admin routes', () => {
  it('reads and writes are limited per user with 429 RATE_LIMITED and Retry-After', async () => {
    const t = await bootAiApp({ env: { THROTTLE_AI_READ_PER_MINUTE: '3', THROTTLE_AI_WRITE_PER_MINUTE: '2' } })
    try {
      const admin = await login(t, ADMIN)
      for (let i = 0; i < 3; i += 1) expect((await get(admin, '/ai/status')).status).toBe(200)
      const limited = await get(admin, '/ai/status')
      expectError(limited, 'RATE_LIMITED')
      expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1)
      const body = { monthlyBudgetSen: 1, notifyAt80: true, notifyAt100: true }
      expect((await put(admin, '/ai/settings', body)).status).toBe(200)
      expect((await put(admin, '/ai/settings', body)).status).toBe(200)
      expectError(await put(admin, '/ai/settings', body), 'RATE_LIMITED')
    } finally {
      await t.close()
    }
  })
})

describe('POST /ai/test failures (real provider, stubbed transport)', () => {
  const rec = fixture<{ health: unknown }>('recorded-anthropic.json')

  it('a working provider is ok and the status shows only "configured", never the key', async () => {
    const t = await bootAiApp({ env: { ...vendorEnv('anthropic'), AI_MONTHLY_BUDGET_SEN: '1000' }, fetch: stubFetch(() => jsonResponse(rec.health)) })
    try {
      const admin = await login(t, ADMIN)
      const res = await post(admin, '/ai/test', {})
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const status = await get(admin, '/ai/status')
      expect(AiStatusSchema.parse(status.body.data)).toMatchObject({ provider: 'anthropic', configured: true, model: 'model-x' })
      for (const text of [JSON.stringify(res.body), JSON.stringify(status.body), await dumpAiTables(t.db)]) expect(text).not.toContain(FAKE_KEY)
    } finally {
      await t.close()
    }
  })

  it('provider down: 503 AI_UNAVAILABLE after the retries (the in-process AI_PROVIDER_ERROR is not exposed), nothing leaked', async () => {
    const t = await bootAiApp({ env: { ...vendorEnv('anthropic'), AI_MONTHLY_BUDGET_SEN: '1000', AI_MAX_RETRIES: '1' }, fetch: stubFetch(() => new Response(`down ${FAKE_KEY}`, { status: 503 })) })
    try {
      const admin = await login(t, ADMIN)
      const res = await post(admin, '/ai/test', {})
      expectError(res, 'AI_UNAVAILABLE')
      expect(JSON.stringify(res.body)).not.toContain(FAKE_KEY)
    } finally {
      await t.close()
    }
  })

  it('not configured (a real provider without a key): 503 AI_UNAVAILABLE, status says configured false', async () => {
    const t = await bootAiApp({ env: { AI_PROVIDER: 'anthropic', AI_MODEL: 'model-x' } })
    try {
      const admin = await login(t, ADMIN)
      expectError(await post(admin, '/ai/test', {}), 'AI_UNAVAILABLE')
      const status = AiStatusSchema.parse((await get(admin, '/ai/status')).body.data)
      expect(status).toMatchObject({ configured: false, capabilities: null })
    } finally {
      await t.close()
    }
  })

  it('budget reached: 503 AI_BUDGET_EXHAUSTED and the provider is not called', async () => {
    const f = stubFetch(() => jsonResponse(rec.health))
    const t = await bootAiApp({ env: { ...vendorEnv('anthropic'), AI_MONTHLY_BUDGET_SEN: '10' }, fetch: f })
    try {
      await insertUsageRow(t.db, { provider: 'anthropic', costSen: 10, at: '2026-10-02T01:00:00Z' })
      const admin = await login(t, ADMIN)
      expectError(await post(admin, '/ai/test', {}), 'AI_BUDGET_EXHAUSTED')
      expect(f.calls).toHaveLength(0)
      expect(AiStatusSchema.parse((await get(admin, '/ai/status')).body.data)).toMatchObject({ budgetState: 'exhausted', remainingSen: 0, percentUsed: 100 })
    } finally {
      await t.close()
    }
  })

  it('rate limited provider calls surface as 429 RATE_LIMITED with Retry-After', async () => {
    const t = await bootAiApp({ env: { AI_RATE_LIMIT_PER_MIN: '1' } })
    try {
      const admin = await login(t, ADMIN)
      expect((await post(admin, '/ai/test', {})).status).toBe(200)
      const res = await post(admin, '/ai/test', {})
      expectError(res, 'RATE_LIMITED')
      expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1)
    } finally {
      await t.close()
    }
  })
})
