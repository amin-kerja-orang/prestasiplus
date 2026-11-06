import { PracticeReadDashboardSchema, PerformanceStudentSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { walletSeed } from '../../prisma/seed/wallet'
import { contentSeed } from '../../prisma/seed/content'
import { PracticeReadsModule } from '../../src/modules/practice/reads'
import {
  type Client,
  type PracticeTestApp,
  type World,
  bootPracticeApp,
  fillBank,
  loadWorld,
  loginAs,
  play,
  resetPractice,
  userIdByEmail,
} from '../practice/helpers'

const Dashboard = envelopeOf(PracticeReadDashboardSchema)
const Prestasi = envelopeOf(PerformanceStudentSchema)

let t: PracticeTestApp
let w: World
let pelajar: Client
let me: string

beforeAll(async () => {
  t = await bootPracticeApp({ seeds: [walletSeed, contentSeed], modules: [PracticeReadsModule] })
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  me = await userIdByEmail(t.db, 'pelajar@demo.test')
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  await resetPractice(t.db)
  t.bank.reset()
  fillBank(t.bank, w)
})

const dashboard = async () => Dashboard.parse((await pelajar.get('/api/dashboard')).body).data
const prestasi = async () => Prestasi.parse((await pelajar.get(`/api/performance/students/${me}`)).body).data

/**
 * AC-MUR-2-4 (R1-MUR-2): the pupil completes one session; on reload "Sesi Minggu Ini" goes up by 1 and the dashboard
 * "Ketepatan" equals the Prestasi "Ketepatan". Through the real write path (start, check, submit), the real overview
 * read and the real Prestasi read (PracticeReadsModule binds the shared answer reader), no fake read port.
 */
describe('AC-MUR-2-4: Dashboard after a completed session', () => {
  it('"Sesi Minggu Ini" goes up by 1 and "Ketepatan" equals the Prestasi "Ketepatan"', async () => {
    const before = await dashboard()
    expect(before.week.sessions).toBe(0)
    expect(before.accuracyPct).toBeNull()

    const { submit } = await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 }, 4)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)

    const after = await dashboard()
    expect(after.week.sessions).toBe(before.week.sessions + 1)
    expect(after.accuracyPct).toBe(80) // 4 of 5, pooled

    const p = await prestasi()
    expect(p.stats.answered).toBe(5)
    expect(after.accuracyPct).toBe(p.stats.accuracy) // same one-decimal wire value
    expect(Math.round(after.accuracyPct as number)).toBe(p.heroAccuracy) // the whole number both screens show
  })

  it('the two figures still agree after a second session whose pooled value has a fraction (pooled, not the mean of sessions)', async () => {
    await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 }, 5)
    const second = await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c2, count: 10 }, 3)
    expect(second.started.questions).toHaveLength(6) // the chapter holds 6 questions
    const d = await dashboard()
    const p = await prestasi()
    expect(d.week.sessions).toBe(2)
    expect(d.accuracyPct).toBe(72.7) // 8 of 11; the mean of 100 and 50 would be 75
    expect(d.accuracyPct).toBe(p.stats.accuracy)
    expect(Math.round(d.accuracyPct as number)).toBe(p.heroAccuracy)
    expect(p.heroAccuracy).toBe(73)
  })
})
