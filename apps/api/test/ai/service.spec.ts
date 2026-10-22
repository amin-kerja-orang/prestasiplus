import type { AiExtractRequest } from '@pp/contract'
import { Logger } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AiExtractionService } from '../../src/modules/ai-extraction'
import { AiCallPipeline } from '../../src/modules/ai-extraction/ai-call.pipeline'
import { AI_NOTIFICATION_TYPES } from '../../src/modules/ai-extraction/ai.constants'
import { AiRepository } from '../../src/modules/ai-extraction/ai.repository'
import {
  bootAiApp,
  captureLogs,
  dumpAiTables,
  fixture,
  FAKE_KEY,
  insertAdmin,
  insertUsageRow,
  jsonResponse,
  get,
  login,
  ADMIN,
  stubFetch,
  vendorEnv,
  type AiTestApp,
} from './helpers'

type Recorded = { extract: unknown; tags: unknown; text: unknown; health: unknown; error: unknown }
const rec = fixture<Recorded>('recorded-anthropic.json')

const REQ: AiExtractRequest = {
  pages: [{ page: 1, source: 'text-layer', text: '1. Selesaikan persamaan 2x + 6 = 14. [2 markah]\n2. Antara berikut, yang manakah nilai min bagi 2, 4, 6, 8?\nA. 4\nB. 5\nC. 6\nD. 8' }],
  subject: 'MAT',
  kertas: 2,
  taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik', form: 'T4' }],
}

const PRICES = JSON.stringify({ anthropic: { 'model-x': { inSenPerMTok: 300, outSenPerMTok: 1500 } } })
const anthropicEnv = (extra: Record<string, string> = {}) => ({ ...vendorEnv('anthropic'), AI_PRICE_TABLE_JSON: PRICES, AI_MONTHLY_BUDGET_SEN: '100000', ...extra })
const answers = () => stubFetch(() => jsonResponse(rec.extract))

let t: AiTestApp | undefined
afterEach(async () => {
  await t?.close()
  t = undefined
})
const svc = (a: AiTestApp) => a.app.get(AiExtractionService)

describe('usage log and run lifecycle (AC5)', () => {
  it('a mock call writes one usage row without content, cost 0, and a succeeded run', async () => {
    t = await bootAiApp()
    const adminId = (await t.db.query<{ id: string }>(`select id::text from users order by id limit 1`))[0]?.id as string
    const paper = await svc(t).extractPaper(REQ, { actorId: adminId })
    expect(paper.provider).toBe('mock')
    expect(paper.usage.costSen).toBe(0)
    const rows = await t.db.query<Record<string, unknown>>(`select * from ai_usage_logs`)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ provider: 'mock', purpose: 'extract_paper', cost_sen: 0, pages: 1 })
    expect(String(rows[0]?.actor_user_id)).toBe(adminId)
    expect(JSON.stringify(rows)).not.toContain('Selesaikan')
    const runs = await t.db.query<{ status: string; kind: string; cost_sen: number }>(`select status, kind, cost_sen from ai_extraction_runs`)
    expect(runs).toEqual([{ status: 'succeeded', kind: 'extract_paper', cost_sen: 0 }])
    expect(JSON.stringify(await t.db.query(`select * from ai_extraction_runs`))).not.toContain('Selesaikan')
  })

  it('a text-less request is answered without a provider call and without a row', async () => {
    t = await bootAiApp({ env: anthropicEnv(), fetch: answers() })
    const paper = await svc(t).extractPaper({ ...REQ, pages: [{ page: 1, source: 'text-layer', text: '  ' }] })
    expect(paper.questions).toEqual([])
    expect(t.fetch.calls).toHaveLength(0)
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(0)
  })

  it('a priced call stores tokens and a cost rounded up to whole sen (1200 in, 800 out = 1.56 sen -> 2)', async () => {
    t = await bootAiApp({ env: anthropicEnv(), fetch: answers() })
    const paper = await svc(t).extractPaper(REQ)
    expect(paper.usage).toMatchObject({ provider: 'anthropic', tokensIn: 1200, tokensOut: 800, costSen: 2 })
    const rows = await t.db.query<{ provider: string; cost_sen: number; tokens_in: number }>(`select provider, cost_sen, tokens_in from ai_usage_logs`)
    expect(rows).toEqual([{ provider: 'anthropic', cost_sen: 2, tokens_in: 1200 }])
    expect(t.fetch.calls[0]?.headers['x-api-key']).toBe(FAKE_KEY)
  })

  it('a paid provider whose model has no price (or a broken table) is not configured: AI_UNAVAILABLE, no provider call, status configured false', async () => {
    for (const table of ['', '{"anthropic":{"other-model":{"inSenPerMTok":1,"outSenPerMTok":1}}}', '{nope', '{"anthropic":{"model-x":{"inSenPerMTok":-1}}}']) {
      const f = answers()
      t = await bootAiApp({ env: anthropicEnv({ AI_PRICE_TABLE_JSON: table }), fetch: f })
      await expect(svc(t).extractPaper(REQ), table).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', retryable: false })
      expect(f.calls, table).toHaveLength(0)
      expect(await t.db.query('select 1 from ai_usage_logs')).toHaveLength(0)
      const admin = await login(t, ADMIN)
      const status = await get(admin, '/ai/status')
      expect(status.body.data, table).toMatchObject({ provider: 'anthropic', configured: false, capabilities: null })
      await t.close()
      t = undefined
    }
  })

  it('a wildcard price covers any model of the provider', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_PRICE_TABLE_JSON: JSON.stringify({ anthropic: { '*': { inSenPerMTok: 300, outSenPerMTok: 1500 } } }) }), fetch: answers() })
    expect((await svc(t).extractPaper(REQ)).usage.costSen).toBe(2)
  })

  it('a 2xx reply that cannot be used is still billed: one usage row with its tokens and cost, and the run ends failed with those totals', async () => {
    const empty = { ...(rec.extract as object), content: [{ type: 'text', text: '' }], usage: { input_tokens: 1200, output_tokens: 800 } }
    t = await bootAiApp({ env: anthropicEnv(), fetch: stubFetch(() => jsonResponse(empty)) })
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR', retryable: false })
    expect(await t.db.query('select provider, tokens_in, tokens_out, cost_sen, purpose from ai_usage_logs')).toEqual([{ provider: 'anthropic', tokens_in: 1200, tokens_out: 800, cost_sen: 2, purpose: 'extract_paper' }])
    expect(await t.db.query('select status, error_code, tokens_in, cost_sen from ai_extraction_runs')).toEqual([{ status: 'failed', error_code: 'AI_PROVIDER_ERROR', tokens_in: 1200, cost_sen: 2 }])
  })

  it('a model reply that is not JSON (billed tokens from usage) and a body that is not a reply at all (estimated tokens) each log one row', async () => {
    const junk = { ...(rec.extract as object), content: [{ type: 'text', text: 'maaf, tiada JSON di sini' }], usage: { input_tokens: 1200, output_tokens: 800 } }
    t = await bootAiApp({ env: anthropicEnv(), fetch: stubFetch(() => jsonResponse(junk)) })
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' })
    expect(await t.db.query('select tokens_in, tokens_out, cost_sen from ai_usage_logs')).toEqual([{ tokens_in: 1200, tokens_out: 800, cost_sen: 2 }])
    await t.close()
    t = await bootAiApp({ env: anthropicEnv(), fetch: stubFetch(() => jsonResponse({ content: 'not a list' })) })
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR' })
    const rows = await t.db.query<{ tokens_in: number; tokens_out: number }>('select tokens_in, tokens_out from ai_usage_logs')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokens_in).toBeGreaterThan(0)
    expect(rows[0]?.tokens_out).toBe(0)
  })

  it('a failed call writes no usage row and ends the run failed with the code', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_MAX_RETRIES: '1' }), fetch: stubFetch(() => jsonResponse({ error: 'x' }, 503)) })
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR', attempts: 2 })
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(0)
    expect(await t.db.query(`select status, error_code from ai_extraction_runs`)).toEqual([{ status: 'failed', error_code: 'AI_PROVIDER_ERROR' }])
  })

  it('a transient failure is retried with backoff (429, 429, 200 = 3 requests, 2 sleeps) and costs one usage row', async () => {
    const f = stubFetch((_c, n) => (n < 3 ? jsonResponse({}, 429) : jsonResponse(rec.extract)))
    t = await bootAiApp({ env: anthropicEnv(), fetch: f })
    await svc(t).extractPaper(REQ)
    expect(f.calls).toHaveLength(3)
    expect(t.sleeps).toHaveLength(2)
    expect(t.sleeps[0]).toBeGreaterThanOrEqual(800)
    expect(t.sleeps[0]).toBeLessThanOrEqual(1200)
    expect(t.sleeps[1]).toBeGreaterThanOrEqual(1600)
    expect(t.sleeps[1]).toBeLessThanOrEqual(2400)
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(1)
  })

  it('suggestTags and generateText each log one row with their purpose; tag refs come back as the caller sent them', async () => {
    const f = stubFetch((c) => jsonResponse(c.body.includes('q1') ? rec.tags : rec.text))
    t = await bootAiApp({ env: anthropicEnv(), fetch: f })
    const tags = await svc(t).suggestTags({ subject: 'MAT', items: [{ ref: 'item-a', stem: 'Nilai min bagi 2, 4, 6, 8 ialah' }], taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik', form: 'T4' }] })
    for (const s of tags.suggestions) expect(s.ref).toBe('item-a')
    expect(f.calls[0]?.body).not.toContain('item-a')
    await svc(t).generateText({ purpose: 'cikgu.chat', system: 'Anda pembantu.', input: 'Terangkan min.' })
    const purposes = await t.db.query<{ purpose: string }>(`select purpose from ai_usage_logs order by id`)
    expect(purposes.map((p) => p.purpose)).toEqual(['suggest_tags', 'generate_text'])
  })
})

describe('budget (AC6, AC9)', () => {
  const adminCount = async (a: AiTestApp) => Number((await a.db.query<{ n: string }>(`select count(*)::text n from users u where is_active and not is_suspended and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'admin')`))[0]?.n)
  const notices = (a: AiTestApp, type: string) => a.db.query<{ user_id: string }>(`select user_id::text from notifications where type = $1 order by user_id`, [type])

  it('crossing 80% notifies every active, unsuspended Admin Pusat once per month and nobody else', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '100' }), fetch: answers() })
    await insertAdmin(t.db, 'a2@demo.test')
    await insertAdmin(t.db, 'a3@demo.test', { active: false })
    await insertAdmin(t.db, 'a4@demo.test', { suspended: true })
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 79, at: '2026-10-05T01:00:00Z' })
    await svc(t).extractPaper(REQ) // 79 + 2 = 81%
    await svc(t).extractPaper(REQ) // 83%: no second notice
    const got = await notices(t, AI_NOTIFICATION_TYPES.budgetWarning)
    expect(got).toHaveLength(await adminCount(t))
    expect(new Set(got.map((g) => g.user_id)).size).toBe(got.length)
    // Next month the notice is due again.
    t.clock.set('2026-11-03T10:00:00+08:00')
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 79, at: '2026-11-02T01:00:00Z' })
    await svc(t).extractPaper(REQ)
    expect(await notices(t, AI_NOTIFICATION_TYPES.budgetWarning)).toHaveLength(got.length * 2)
  })

  it('notifyAt80 off sends no warning', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '100' }), fetch: answers() })
    await t.db.query(`insert into ai_settings (id, monthly_budget_sen, notify_at_80) values (1, 100, false)`)
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 79, at: '2026-10-05T01:00:00Z' })
    await svc(t).extractPaper(REQ)
    expect(await notices(t, AI_NOTIFICATION_TYPES.budgetWarning)).toHaveLength(0)
  })

  it('at 100% extractPaper, suggestTags and generateText are refused with AI_BUDGET_EXHAUSTED, no provider call, no row; one cap notice', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '100' }), fetch: answers() })
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 100, at: '2026-10-05T01:00:00Z' })
    const s = svc(t)
    await expect(s.extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED', retryable: true })
    await expect(s.suggestTags({ subject: 'MAT', items: [{ ref: 'a', stem: 'x' }], taxonomy: [{ code: 'C', label: 'L', form: 'T4' }] })).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    await expect(s.generateText({ purpose: 'cikgu.chat', system: '', input: 'hai' })).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    expect(t.fetch.calls).toHaveLength(0)
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(1)
    expect(await t.db.query(`select 1 from ai_extraction_runs`)).toHaveLength(0)
    expect(await notices(t, AI_NOTIFICATION_TYPES.budgetCapped)).toHaveLength(await adminCount(t))
  })

  it('cap 0 does not stop the mock (it costs nothing) but still refuses a paid provider; mock usage never counts', async () => {
    t = await bootAiApp({ env: { AI_MONTHLY_BUDGET_SEN: '0' } })
    await expect(svc(t).extractPaper(REQ)).resolves.toBeDefined()
    await t.close()
    t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '0' }), fetch: answers() })
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    expect(t.fetch.calls).toHaveLength(0)
    await t.close()
    t = await bootAiApp({ env: { AI_MONTHLY_BUDGET_SEN: '5' } })
    await insertUsageRow(t.db, { provider: 'mock', costSen: 999, at: '2026-10-05T01:00:00Z' })
    await expect(svc(t).extractPaper(REQ)).resolves.toBeDefined()
  })

  it('a paid provider with no cap anywhere is refused (fail closed); the mock is not', async () => {
    t = await bootAiApp({ env: { ...anthropicEnv(), AI_MONTHLY_BUDGET_SEN: undefined }, fetch: answers() })
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    expect(t.fetch.calls).toHaveLength(0)
    await t.close()
    t = await bootAiApp()
    await expect(svc(t).extractPaper(REQ)).resolves.toBeDefined()
  })

  it('the month is the Malaysia month: 23:59 on the 31st still counts to October, 00:01 on the 1st to November', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '100' }), fetch: answers() })
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 100, at: '2026-10-31T15:59:00Z' })
    await insertUsageRow(t.db, { provider: 'anthropic', costSen: 10, at: '2026-10-31T16:01:00Z' })
    t.clock.set('2026-10-31T23:59:30+08:00')
    await expect(svc(t).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    t.clock.set('2026-11-01T00:01:30+08:00')
    await expect(svc(t).extractPaper(REQ)).resolves.toBeDefined()
  })
})

describe('usage row write failure (G4 m4)', () => {
  it('a billed success whose usage row cannot be written is logged at error level (no key, no content) and still fails as before', async () => {
    t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '100' }), fetch: answers() })
    const repo = t.app.get(AiRepository)
    const spy = vi.spyOn(repo, 'insertUsage').mockRejectedValueOnce(new Error('db down'))
    const errors: string[] = []
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map((x) => String(x)).join(' '))
    })
    try {
      await expect(svc(t).extractPaper(REQ)).rejects.toThrow()
    } finally {
      spy.mockRestore()
      logSpy.mockRestore()
    }
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('provider=anthropic')
    expect(errors[0]).toMatch(/model=.+ batch=.+ run=.+ tokensIn=\d+ tokensOut=\d+ costSen=\d+/)
    expect(errors[0]).not.toContain(FAKE_KEY)
    expect(errors[0]).not.toContain('Selesaikan persamaan')
  })
})

describe('limits under load (AC8)', () => {
  it('at most AI_MAX_CONCURRENCY provider calls run at once, and every call still finishes with one row', async () => {
    let running = 0
    let peak = 0
    const f = stubFetch(async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 15))
      running -= 1
      return jsonResponse(rec.extract)
    })
    t = await bootAiApp({ env: anthropicEnv({ AI_MAX_CONCURRENCY: '2' }), fetch: f })
    await Promise.all(Array.from({ length: 10 }, () => svc(t as AiTestApp).extractPaper(REQ)))
    expect(peak).toBe(2)
    expect(t.app.get(AiCallPipeline).concurrency.peak).toBe(2)
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(10)
  })

  it('the cap crossed while calls are queued refuses the queued calls (budget re-checked after the slot), with no run for them', async () => {
    const prices = JSON.stringify({ anthropic: { 'model-x': { inSenPerMTok: 2500, outSenPerMTok: 3750 } } }) // 1200 in + 800 out = 6 sen
    const f = stubFetch(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return jsonResponse(rec.extract)
    })
    t = await bootAiApp({ env: anthropicEnv({ AI_PRICE_TABLE_JSON: prices, AI_MONTHLY_BUDGET_SEN: '10', AI_MAX_CONCURRENCY: '1' }), fetch: f })
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => svc(t as AiTestApp).extractPaper(REQ)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2) // 6, then 12 (the check before the second still saw 6)
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(refused).toHaveLength(2)
    for (const r of refused) expect(r.reason).toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    expect(f.calls).toHaveLength(2)
    expect(await t.db.query('select 1 from ai_usage_logs')).toHaveLength(2)
    expect(await t.db.query('select status from ai_extraction_runs')).toEqual([{ status: 'succeeded' }, { status: 'succeeded' }])
  })

  it('a retry that waits in backoff holds no concurrency slot, and the budget is checked again before the retry', async () => {
    const prices = JSON.stringify({ anthropic: { 'model-x': { inSenPerMTok: 2500, outSenPerMTok: 3750 } } })
    let app: AiTestApp | undefined
    const inFlightDuringSleep: number[] = []
    const f = stubFetch((_c, n) => (n === 1 ? jsonResponse({}, 429) : jsonResponse(rec.extract)))
    app = await bootAiApp({
      env: anthropicEnv({ AI_PRICE_TABLE_JSON: prices, AI_MONTHLY_BUDGET_SEN: '10', AI_MAX_CONCURRENCY: '1' }),
      fetch: f,
      sleep: () => {
        inFlightDuringSleep.push((app as AiTestApp).app.get(AiCallPipeline).concurrency.inFlight)
        return Promise.resolve()
      },
    })
    t = app
    await svc(app).extractPaper(REQ)
    expect(inFlightDuringSleep).toEqual([0])
    expect(app.app.get(AiCallPipeline).concurrency.inFlight).toBe(0)
    // Cap reached while the first attempt backs off: the retry is refused instead of spending past the cap.
    await app.close()
    const g = stubFetch((_c, n) => (n === 1 ? jsonResponse({}, 503) : jsonResponse(rec.extract)))
    app = await bootAiApp({
      env: anthropicEnv({ AI_PRICE_TABLE_JSON: prices, AI_MONTHLY_BUDGET_SEN: '10', AI_MAX_CONCURRENCY: '1' }),
      fetch: g,
      sleep: async () => {
        await insertUsageRow((app as AiTestApp).db, { provider: 'anthropic', costSen: 10, at: '2026-10-19T01:00:00Z' })
      },
    })
    t = app
    await expect(svc(app).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' })
    expect(g.calls).toHaveLength(1)
    expect(await app.db.query('select status, error_code from ai_extraction_runs')).toEqual([{ status: 'failed', error_code: 'AI_BUDGET_EXHAUSTED' }])
  })

  it('the global rate limit lets exactly AI_RATE_LIMIT_PER_MIN of a burst through; the rest get RATE_LIMITED with retryAfter and leave no row', async () => {
    t = await bootAiApp({ env: { AI_RATE_LIMIT_PER_MIN: '5' } })
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => svc(t as AiTestApp).extractPaper(REQ)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(refused).toHaveLength(7)
    expect(refused[0]?.reason).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
    expect((refused[0]?.reason as { retryAfter: number }).retryAfter).toBeGreaterThanOrEqual(1)
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(5)
    t.clock.set(new Date(t.clock.now().getTime() + 61_000))
    await expect(svc(t).extractPaper(REQ)).resolves.toBeDefined()
  })

  it('the per-user limit is per actor', async () => {
    t = await bootAiApp({ env: { AI_RATE_LIMIT_PER_USER_PER_MIN: '2' } })
    const a = await insertAdmin(t.db, 'u1@demo.test')
    const b = await insertAdmin(t.db, 'u2@demo.test')
    const s = svc(t)
    await s.extractPaper(REQ, { actorId: a })
    await s.extractPaper(REQ, { actorId: a })
    await expect(s.extractPaper(REQ, { actorId: a })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await expect(s.extractPaper(REQ, { actorId: b })).resolves.toBeDefined()
  })

  it('the per-school limit is shared by the users of one school', async () => {
    t = await bootAiApp({ env: { AI_RATE_LIMIT_PER_SCHOOL_PER_MIN: '3' } })
    const school = (await t.db.query<{ id: string }>(`select id::text from schools order by id limit 1`))[0]?.id as string
    const ids = [await insertAdmin(t.db, 's1@demo.test'), await insertAdmin(t.db, 's2@demo.test'), await insertAdmin(t.db, 's3@demo.test')]
    await t.db.query(`update users set school_id = $1::bigint where id = any($2::bigint[])`, [school, ids])
    const s = svc(t)
    await s.extractPaper(REQ, { actorId: ids[0] })
    await s.extractPaper(REQ, { actorId: ids[1] })
    await s.extractPaper(REQ, { actorId: ids[2] })
    await expect(s.extractPaper(REQ, { actorId: ids[0] })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('secrets and personal data never leave the process (BE-NFR-32, AC-04.8)', () => {
  it('the key appears in no log line, error, response, usage row, run row, audit row or notification, even when the provider echoes it', async () => {
    const logs = captureLogs()
    try {
      const f = stubFetch(() => new Response(`CANARY-BODY echoed ${FAKE_KEY} and the prompt`, { status: 500 }))
      t = await bootAiApp({ env: anthropicEnv({ AI_MONTHLY_BUDGET_SEN: '100', AI_MAX_RETRIES: '1' }), fetch: f })
      const err = await svc(t).extractPaper(REQ).catch((e: unknown) => e)
      expect(err).toMatchObject({ code: 'AI_PROVIDER_ERROR' })
      const haystack = [logs.lines.join('\n'), String((err as Error).message), JSON.stringify(err), String((err as Error).stack), await dumpAiTables(t.db)].join('\n')
      for (const needle of [FAKE_KEY, 'CANARY-BODY']) expect(haystack).not.toContain(needle)
      expect(f.calls.length).toBeGreaterThan(0)
    } finally {
      logs.restore()
    }
  })

  it('names, IC numbers, phones, emails and schools are masked in every outbound request body (extract, tags, text)', async () => {
    const f = stubFetch((c) => jsonResponse(c.body.includes('q1') ? rec.tags : rec.extract))
    t = await bootAiApp({ env: anthropicEnv(), fetch: f })
    const cover = 'SEKOLAH MENENGAH KEBANGSAAN TAMAN CONTOH\nNama: Ahmad bin Ali\nNo. K/P: 080515-14-1234\nTel: 012-345 6789\nEmel: ahmad.canary@example.test\n1. Selesaikan 2x + 6 = 14. [2 markah]'
    await svc(t).extractPaper({ ...REQ, pages: [{ page: 1, source: 'ocr', text: cover }] })
    await svc(t).suggestTags({ subject: 'MAT', items: [{ ref: 'k1', stem: 'Ahmad bin Ali (080515-14-1234) menyelesaikan 2x + 6 = 14' }], taxonomy: [{ code: 'C', label: 'L', form: 'T4' }] })
    await svc(t).generateText({ purpose: 'cikgu.chat', system: 'Anda pembantu.', input: 'Saya Ahmad bin Ali, K/P 080515-14-1234, emel ahmad.canary@example.test' })
    expect(f.calls).toHaveLength(3)
    for (const [i, c] of f.calls.entries()) {
      for (const canary of ['Ahmad', 'bin Ali', '080515-14-1234', '012-345 6789', 'ahmad.canary@example.test', 'TAMAN CONTOH']) expect(c.body).not.toContain(canary)
      if (i < 2) expect(c.body).toContain('2x + 6 = 14') // the question content itself is still sent
    }
  })

  it('page images and caller ids are never forwarded', async () => {
    const f = answers()
    t = await bootAiApp({ env: anthropicEnv(), fetch: f })
    const id = await insertAdmin(t.db, 'ctx@demo.test')
    await svc(t).extractPaper({ ...REQ, images: [{ page: 1, fileId: '987654321', width: 10, height: 10 }] }, { actorId: id })
    const body = f.calls[0]?.body ?? ''
    expect(body).not.toContain('987654321')
    expect(body).not.toMatch(new RegExp(`"${id}"`))
  })
})
