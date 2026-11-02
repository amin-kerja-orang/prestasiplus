/**
 * R1-10.4 / R1-11.3 (T40): a finished Databank (SPM "past_year") session is recorded like every practice session and lands in
 * Prestasi by subject. The AC wording says the mode is `spm_tahun_lepas`; V3 keeps the practice mode code `past_year` (the ETL maps
 * the old name to it, see the D9 naming row in docs/architecture/v2-backend-deviations.md). V2: docs/discovery/cloud-student-mechanism.md
 * 2.x (Databank Soalan SPM: "POST result -> mode spm_tahun_lepas", the figure feeds Prestasi).
 */
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PracticeReadProgressSchema } from '@pp/contract'

import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { PracticeAnalyticsReadsModule } from '../../src/modules/practice/reads/analytics'
import { type Client, type PracticeTestApp, bootPracticeApp, fillBank, loadWorld, loginAs, play, resetPractice, type World } from './helpers'

let t: PracticeTestApp
let w: World
let pupil: Client
let reads: { agent(): TestAgent; close(): Promise<void> }

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  fillBank(t.bank, w)
  pupil = await loginAs(t, 'pelajar@demo.test')
  // The Prestasi reads module on the SAME database and the same frozen clock.
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PracticeAnalyticsReadsModule])] })
    .overrideProvider(CLOCK)
    .useValue(t.clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  reads = { agent: () => request.agent(app.getHttpServer()) as unknown as TestAgent, close: () => app.close() }
}, 180_000)
afterAll(async () => {
  await reads.close()
  await t.close()
})

describe('a Databank session is recorded and appears in Prestasi by subject', () => {
  it('stored with the mode past_year (the Databank mode of V3), then listed under its subject with its answered and correct counts', async () => {
    await resetPractice(t.db)
    const { started, submit } = await play(pupil, t.bank, { mode: 'past_year', subjectCode: 'SEJ', count: 10 }, 4)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)

    // the session row
    const row = (await t.db.query<{ mode: string; status: string; correct_count: number; question_count: number; subject_code: string }>(
      `select s.mode, s.status, s.correct_count, s.question_count, sj.code subject_code from practice_sessions s join subjects sj on sj.id = s.subject_id where s.id = $1`,
      [started.sessionId],
    ))[0]
    expect(row).toMatchObject({ mode: 'past_year', status: 'completed', correct_count: 4, question_count: 10, subject_code: 'SEJ' })
    // the reward port was told the SPM ledger source (quiz_spm) of that mode
    expect(t.reward.calls.at(-1)).toMatchObject({ mode: 'past_year', source: 'quiz_spm', correct: 4, total: 10 })

    // Prestasi by subject (the practice progress read): the figure of the subject moved by exactly this session
    const reader = await loginInto(reads, 'pelajar@demo.test')
    const progress = PracticeReadProgressSchema.parse((await reader.get('/api/practice/progress?period=all')).body.data)
    const sej = progress.subjects.find((s) => s.code === 'SEJ')
    expect(sej).toMatchObject({ answered: 10, correct: 4, wrong: 6, accuracyPct: 40 })
    expect(progress.answered).toBe(10)
    expect(progress.sessions).toBe(1)
    // a subject the pupil did not practise is absent
    expect(progress.subjects.find((s) => s.code === 'MATH')).toBeUndefined()
  })
})

async function loginInto(r: typeof reads, identifier: string) {
  const agent = r.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: 'Demo1234', remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return { get: (url: string) => agent.get(url) }
}
