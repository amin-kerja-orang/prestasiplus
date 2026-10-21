import { JobError } from '../../src/modules/jobs'
import { afterEach, describe, expect, it } from 'vitest'

import { runWithAiContext } from '../../src/modules/ai-extraction/ai-context'
import { AiExtractorAdapter, toJobError } from '../../src/modules/ai-extraction/ai-extractor.adapter'
import { AiCancelledError, AiError } from '../../src/modules/ai-extraction/ai.errors'
import { bootAiApp, insertAdmin, type AiTestApp } from './helpers'

describe('toJobError (what the intake job runner sees)', () => {
  it('maps budget and rate limit to retryable codes, not-configured to a terminal one, cancel to CANCELLED', () => {
    expect(toJobError(AiError.budgetExhausted())).toMatchObject({ code: 'AI_BUDGET_EXHAUSTED', retryable: true })
    expect(toJobError(AiError.rateLimited(7))).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
    expect(toJobError(AiError.notConfigured())).toMatchObject({ code: 'AI_UNAVAILABLE', retryable: false })
    expect(toJobError(AiError.provider({ retryable: true, attempts: 4 }))).toMatchObject({ code: 'AI_PROVIDER_ERROR', retryable: true })
    expect(toJobError(AiError.provider({ retryable: false, attempts: 1 }))).toMatchObject({ code: 'AI_PROVIDER_ERROR', retryable: false })
    expect(toJobError(AiError.timeout(3))).toMatchObject({ code: 'AI_TIMEOUT' })
    expect(toJobError(new AiCancelledError())).toMatchObject({ code: 'CANCELLED', retryable: false })
    for (const e of [AiError.budgetExhausted(), new AiCancelledError()]) expect(toJobError(e)).toBeInstanceOf(JobError)
  })

  it('leaves an unknown error as it is', () => {
    const e = new TypeError('boom')
    expect(toJobError(e)).toBe(e)
  })
})

describe('AiExtractorAdapter (the BE-37 AI_EXTRACTOR port)', () => {
  let t: AiTestApp | undefined
  afterEach(async () => {
    await t?.close()
    t = undefined
  })
  const REQ = { pages: [{ page: 1, source: 'text-layer' as const, text: '1. Selesaikan 2x + 6 = 14. [2 markah]' }], subject: 'MAT', kertas: 2 as const }

  it('reports the provider id and returns an extracted paper of drafts', async () => {
    t = await bootAiApp()
    const a = t.app.get(AiExtractorAdapter)
    expect(a.id).toBe('mock')
    const paper = (await a.extractPaper(REQ)) as { questions: { status: string }[] }
    expect(paper.questions.length).toBeGreaterThan(0)
    expect(paper.questions.every((q) => q.status === 'draft')).toBe(true)
  })

  it('the context given with runWithAiContext reaches the usage log and the per-user limit; without it the call is a system call', async () => {
    t = await bootAiApp({ env: { AI_RATE_LIMIT_PER_USER_PER_MIN: '1' } })
    const a = t.app.get(AiExtractorAdapter)
    const id = await insertAdmin(t.db, 'job@demo.test')
    await runWithAiContext({ actorId: id }, () => a.extractPaper(REQ))
    await expect(runWithAiContext({ actorId: id }, () => a.extractPaper(REQ))).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true })
    await a.extractPaper(REQ)
    await a.extractPaper(REQ)
    const rows = await t.db.query<{ actor_user_id: string | null }>(`select actor_user_id::text from ai_usage_logs order by id`)
    expect(rows.map((r) => r.actor_user_id)).toEqual([id, null, null])
  })

  it('an aborted signal ends the call as CANCELLED without a usage row', async () => {
    t = await bootAiApp()
    const ctl = new AbortController()
    ctl.abort()
    await expect(t.app.get(AiExtractorAdapter).extractPaper(REQ, ctl.signal)).rejects.toMatchObject({ code: 'CANCELLED', retryable: false })
    expect(await t.db.query(`select 1 from ai_usage_logs`)).toHaveLength(0)
  })

  it('a budget stop reaches the job runner as a retryable AI_BUDGET_EXHAUSTED', async () => {
    t = await bootAiApp({ env: { AI_MONTHLY_BUDGET_SEN: '0' } })
    await expect(t.app.get(AiExtractorAdapter).extractPaper(REQ)).rejects.toMatchObject({ code: 'AI_BUDGET_EXHAUSTED', retryable: true })
  })
})
