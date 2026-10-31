/**
 * R1-11.3 (T50): the Sejarah half. A finished Databank (SPM "past_year") session is listed in the pupil's Sejarah
 * (`GET /api/practice/history`), newest first, with its counts, and moves the all-time totals by exactly that session.
 * (The Prestasi by-subject half is in databank-prestasi.spec.ts.)
 */
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PracticeReadHistoryResponseSchema } from '@pp/contract'

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

describe('a Databank session is listed in Sejarah', () => {
  it('the finished past_year session is the newest history row with its counts, and the totals count it once', async () => {
    await resetPractice(t.db)
    const { started, submit } = await play(pupil, t.bank, { mode: 'past_year', subjectCode: 'SEJ', count: 10 }, 4)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)

    const reader = await loginInto(reads, 'pelajar@demo.test')
    const history = PracticeReadHistoryResponseSchema.parse((await reader.get('/api/practice/history')).body)
    expect(history.meta.totalItems).toBe(1)
    expect(history.data).toHaveLength(1)
    expect(history.data[0]).toMatchObject({ id: started.sessionId, mode: 'past_year', questionCount: 10, correctCount: 4, wrongCount: 6, accuracyPct: 40 })
    expect(history.meta.totals).toMatchObject({ sessions: 1, answered: 10 })

    // a second Databank session is newest first and the totals follow
    const second = await play(pupil, t.bank, { mode: 'past_year', subjectCode: 'SEJ', count: 10 }, 10)
    expect(second.submit.status).toBe(200)
    const again = PracticeReadHistoryResponseSchema.parse((await reader.get('/api/practice/history')).body)
    expect(again.data.map((d) => d.id)).toEqual([second.started.sessionId, started.sessionId])
    expect(again.meta.totals).toMatchObject({ sessions: 2, answered: 20 })
  })
})

async function loginInto(r: typeof reads, identifier: string) {
  const agent = r.agent()
  const res = await agent.post('/api/auth/login').send({ identifier, password: 'Demo1234', remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return { get: (url: string) => agent.get(url) }
}
