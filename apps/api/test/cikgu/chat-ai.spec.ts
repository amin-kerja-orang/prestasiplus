import {
  CIKGU_AI_UNAVAILABLE_MESSAGE,
  CIKGU_GENERAL_REPLY,
  CIKGU_RATE_LIMITED_MESSAGE,
  cikguMarkingReply,
  CIKGU_RUBRICS,
  CikguChatErrorBodySchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  CikguAiUnavailableError,
  type CikguAiPort,
  type CikguAiText,
  type CikguChatReplyInput,
  type CikguMarkEssayInput,
  type CikguMarkEssayOutput,
  type CikguRphPlanInput,
} from '../../src/modules/cikgu'
import { MockCikguAi } from '../../src/modules/cikgu/mock-cikgu-ai'
import { ADMIN, SCHOOL_ADMIN, STUDENT_1, STUDENT_2, STUDENT_3, TEACHER_A, TEACHER_B, bootCikguApp, client, handoff, reroleUser, type CikguTestApp } from './helpers'

/** A switchable test double of the AI port: records what it was given, fails on demand, or answers with fixed values. */
class FakeAi implements CikguAiPort {
  mode: 'ok' | 'unavailable' | 'crash' | 'bad-marks' = 'ok'
  readonly chat: CikguChatReplyInput[] = []
  readonly marks: CikguMarkEssayInput[] = []
  readonly plans: CikguRphPlanInput[] = []

  private guard(): void {
    if (this.mode === 'unavailable') throw new CikguAiUnavailableError()
    if (this.mode === 'crash') throw new Error('provider exploded with SECRET-PROVIDER-TEXT')
  }

  chatReply(input: CikguChatReplyInput): Promise<CikguAiText> {
    this.chat.push(input)
    this.guard()
    return Promise.resolve({ text: `FAKE:${input.route}`, tokens: { in: 5, out: 7 } })
  }

  markEssay(input: CikguMarkEssayInput): Promise<CikguMarkEssayOutput> {
    this.marks.push(input)
    this.guard()
    if (this.mode === 'bad-marks') return Promise.resolve({ marks: input.rubric.max + 1, reply: 'x' })
    return Promise.resolve({ marks: 3, reply: 'FAKE-MARK' })
  }

  rphPlan(input: CikguRphPlanInput): Promise<CikguAiText> {
    this.plans.push(input)
    this.guard()
    return Promise.resolve({ text: `FAKE-PLAN ${input.tajuk}` })
  }
}

describe('AI port: unavailable provider, swapped provider, failure stores nothing (AC13)', () => {
  let t: CikguTestApp
  const ai = new FakeAi()

  beforeAll(async () => {
    t = await bootCikguApp({ ai })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const counts = async () =>
    (
      await t.db.query<Record<string, number>>(
        `select (select count(*)::int from chat_threads) threads, (select count(*)::int from chat_messages) messages,
                (select count(*)::int from essay_markings) essays, (select count(*)::int from rph_plans) rphs`,
      )
    )[0]

  it('swapping the provider changes the reply and the tokens without any controller change', async () => {
    const teacher = await client(t, TEACHER_A)
    const res = await teacher.post('/cikgu/send', { message: 'Terangkan konsep mol' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ reply: 'FAKE:general', tokens: { in: 5, out: 7 }, tool_hops: 0 })
    const practice = await teacher.post('/cikgu/send', { message: 'minta latihan' })
    expect(practice.body).toMatchObject({ reply: 'FAKE:practice', tool_hops: 1 })
    expect(ai.chat.map((c) => c.route)).toEqual(['general', 'practice'])
  })

  it('a provider failure on the chat is 503 with the raw AI_UNAVAILABLE body, stores nothing and consumes no turn', async () => {
    const teacher = await client(t, TEACHER_B)
    const before = await counts()
    for (const mode of ['unavailable', 'crash'] as const) {
      ai.mode = mode
      for (const message of ['Terangkan konsep mol', 'minta latihan', 'Tolong jana RPH untuk Matematik T4 Bab 3 esok', handoff({ essay: 'satu dua tiga' })]) {
        const res = await teacher.post('/cikgu/send', { message })
        expect(res.status, `${mode}: ${message.slice(0, 20)}`).toBe(503)
        expect(res.text).toBe(JSON.stringify({ error: CIKGU_AI_UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' }))
        expect(CikguChatErrorBodySchema.safeParse(res.body).success).toBe(true)
        expect(res.text).not.toContain('SECRET-PROVIDER-TEXT')
      }
    }
    expect(await counts()).toEqual(before)
    ai.mode = 'ok'
    // No quota turn was consumed by the eight failures: the first success has 29 left.
    const ok = await teacher.post('/cikgu/send', { message: 'Terangkan konsep mol' })
    expect(ok.status).toBe(200)
    expect(ok.body.turns_remaining).toBe(29)
  })

  it('marks outside 0..max from a provider are rejected as unavailable and stored nowhere', async () => {
    const teacher = await client(t, TEACHER_B)
    const before = await counts()
    ai.mode = 'bad-marks'
    const res = await teacher.post('/cikgu/send', { message: handoff({ rubric: 'sejarah_essay', essay: 'satu dua tiga' }) })
    ai.mode = 'ok'
    expect(res.status).toBe(503)
    expect(await counts()).toEqual(before)
  })

  it('the RPH plan input never carries pengajaranKeperluan; the service appends the Keperluan Khas line itself', async () => {
    const teacher = await client(t, TEACHER_B)
    ai.plans.length = 0
    const res = await teacher.post('/cikgu/rph', { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 9', pengajaranKeperluan: 'Murid cerdik khas' })
    expect(res.status).toBe(201)
    expect(ai.plans).toHaveLength(1)
    expect(Object.keys(ai.plans[0] as object)).not.toContain('pengajaranKeperluan')
    expect(JSON.stringify(ai.plans[0])).not.toContain('Murid cerdik khas')
    expect(res.body.data.content).toBe('FAKE-PLAN Bab 9\nKeperluan Khas: Murid cerdik khas')
  })

  it('POST /cikgu/rph answers 503 AI_UNAVAILABLE in the standard envelope and stores nothing', async () => {
    const teacher = await client(t, TEACHER_B)
    const before = await counts()
    ai.mode = 'unavailable'
    const res = await teacher.post('/cikgu/rph', { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3' })
    ai.mode = 'crash'
    const res2 = await teacher.post('/cikgu/rph', { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3' })
    ai.mode = 'ok'
    for (const r of [res, res2]) {
      expect(r.status).toBe(503)
      expect(r.body.error).toMatchObject({ code: 'AI_UNAVAILABLE', message: CIKGU_AI_UNAVAILABLE_MESSAGE })
      expect(r.body.error.requestId).toBeTruthy()
      expect(JSON.stringify(r.body)).not.toContain('SECRET-PROVIDER-TEXT')
    }
    expect(await counts()).toEqual(before)
    const ok = await teacher.post('/cikgu/rph', { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3' })
    expect(ok.status).toBe(201)
    expect(ok.body.data.content).toBe('FAKE-PLAN Bab 3')
  })

  it('the AI port never receives the student name; the essay comes from the hand-off message only', async () => {
    const teacher = await client(t, TEACHER_B)
    const message = handoff({ rubric: 'pt3_bm_karangan', subject: 'Bahasa Melayu', level: 'T3', student: 'Murid Rahsia Satu', title: 'Hari Sukan', essay: 'Pada hari sukan kami bermain.' })
    const res = await teacher.post('/cikgu/send', { message })
    expect(res.status).toBe(200)
    const input = ai.marks.at(-1) as CikguMarkEssayInput
    expect(JSON.stringify(input)).not.toContain('Murid Rahsia Satu')
    expect(Object.keys(input).sort()).toEqual(['essay', 'level', 'rubric', 'subject', 'title'])
    expect(input).toMatchObject({ subject: 'Bahasa Melayu', level: 'T3', title: 'Hari Sukan', essay: 'Pada hari sukan kami bermain.' })
    // The name is stored for the teacher (the marking list), and the provider's marks and reply are what is stored.
    const row = await t.db.query<{ student_name: string; marks: number; comment: string }>(`select student_name, marks, comment from essay_markings where thread_id = $1`, [res.body.thread_id])
    expect(row[0]).toEqual({ student_name: 'Murid Rahsia Satu', marks: 3, comment: 'FAKE-MARK' })
  })
})

describe('AI port: the mock provider is the canned logic', () => {
  it('MockCikguAi replies equal the contract canned texts', async () => {
    const ai = new MockCikguAi()
    expect((await ai.chatReply({ route: 'general', message: 'x' })).text).toBe(CIKGU_GENERAL_REPLY)
    const rubric = CIKGU_RUBRICS[4]!
    const out = await ai.markEssay({ rubric, subject: null, level: null, title: null, essay: 'x' })
    expect(out).toEqual({ marks: 14, reply: cikguMarkingReply(rubric, 14) })
    expect(out.tokens).toBeUndefined()
  })
})

describe('roles on POST /cikgu/send: any signed-in role', () => {
  let t: CikguTestApp

  beforeAll(async () => {
    t = await bootCikguApp()
    await reroleUser(t, STUDENT_2, 'parent')
    await reroleUser(t, STUDENT_3, 'sponsor')
    await reroleUser(t, 'murid.demo002.01@example.test', 'ppd_officer')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it.each([
    [STUDENT_1, 'pelajar', 9],
    [TEACHER_A, 'guru', 29],
    [SCHOOL_ADMIN, 'pelajar', 9],
    [ADMIN, 'admin', 99],
    [STUDENT_2, 'pelajar', 9],
    [STUDENT_3, 'pelajar', 9],
    ['murid.demo002.01@example.test', 'pelajar', 9],
  ])('%s chats with tier %s', async (email, tier, left) => {
    const who = await client(t, email)
    const res = await who.post('/cikgu/send', { message: 'hai' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ tier, turns_remaining: left })
  })
})

describe('POST /cikgu/send: the per-minute throttle (D57a)', () => {
  let t: CikguTestApp

  beforeAll(async () => {
    t = await bootCikguApp({ env: { THROTTLE_CIKGU_SEND_PER_MINUTE: '3' } })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('the 4th turn in a minute is 429 with the raw RATE_LIMITED body and Retry-After; it is not the daily quota; the window reopens', async () => {
    const teacher = await client(t, TEACHER_A)
    for (let i = 0; i < 3; i++) expect((await teacher.post('/cikgu/send', { message: 'hai' })).status).toBe(200)
    const res = await teacher.post('/cikgu/send', { message: 'hai' })
    expect(res.status).toBe(429)
    const body = CikguChatErrorBodySchema.parse(res.body)
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toBe(CIKGU_RATE_LIMITED_MESSAGE)
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(res.headers['retry-after']).toBe(String(body.retryAfter))
    expect(res.body.quota_exhausted).toBeUndefined()
    // Throttled turns are not stored: still 3 turns.
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from chat_messages where role = 'user'`))[0]?.n).toBe(3)
    t.clock.advance(61_000)
    const again = await client(t, TEACHER_A)
    const ok = await again.post('/cikgu/send', { message: 'hai' })
    expect(ok.status).toBe(200)
    expect(ok.body.turns_remaining).toBe(26)
  })

  it('a guest is 401 {} and is not counted against the throttle', async () => {
    for (let i = 0; i < 6; i++) {
      const res = await t.http().post('/api/cikgu/send').send({ message: 'hai' })
      expect(res.status).toBe(401)
      expect(res.text).toBe('{}')
    }
  })
})
