import { GuruWeeklyReportSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, expectError, loginAs, parseData } from '../../../curriculum/helpers'
import { bootWorld, type World } from './boot'

/**
 * API-GUR-21 `GET /api/guru/weekly-report` on a migrated database (clock: Monday 2026-10-19 09:00 MYT).
 * Needs a database: `npm run be:test -- test/reports/performance/http/guru-weekly-report.spec.ts`.
 */
let w: World
const as: Record<string, Client> = {}

beforeAll(async () => {
  w = await bootWorld()
  for (const k of ['pelajar', 'guru', 'admin']) as[k] = await loginAs(w, `${k}@demo.test`)
  const pupil = w.ids['pelajar@demo.test'] as string
  // 5 answers inside the week (4 correct) and one before it, all outside any session and without a subject.
  for (let i = 0; i < 5; i++) {
    await w.db.query(`insert into practice_answers (user_id, is_correct, answered_at) values ($1, $2, '2026-10-20T10:00:00+08:00')`, [pupil, i < 4])
  }
  await w.db.query(`insert into practice_answers (user_id, is_correct, answered_at) values ($1, true, '2026-10-18T23:30:00+08:00')`, [pupil])
}, 120_000)
afterAll(async () => {
  await w?.close()
})

describe('guru weekly report', () => {
  it('401 without a session', async () => {
    expectError(await w.http().get(`/api/guru/weekly-report?classroomId=${w.classId}`), 'UNAUTHORIZED')
  })

  it('403 for a pupil and for an admin', async () => {
    for (const k of ['pelajar', 'admin']) expectError(await (as[k] as Client).get(`/api/guru/weekly-report?classroomId=${w.classId}`), 'FORBIDDEN')
  })

  it("403 for another teacher's class and for an unknown class", async () => {
    expectError(await (as.guru as Client).get(`/api/guru/weekly-report?classroomId=${w.otherClassId}`), 'FORBIDDEN')
    expectError(await (as.guru as Client).get('/api/guru/weekly-report?classroomId=987654'), 'FORBIDDEN')
  })

  it('422 for a missing classroomId and a malformed week', async () => {
    expectError(await (as.guru as Client).get('/api/guru/weekly-report'), 'VALIDATION_ERROR')
    expectError(await (as.guru as Client).get(`/api/guru/weekly-report?classroomId=${w.classId}&week=2026-13-40`), 'VALIDATION_ERROR')
  })

  it('200 with the contract shape for the own class, no-store', async () => {
    const res = await (as.guru as Client).get(`/api/guru/weekly-report?classroomId=${w.classId}`)
    expect(res.status).toBe(200)
    expect(String(res.headers['cache-control'])).toContain('no-store')
    const data = parseData(res, GuruWeeklyReportSchema)
    expect(data.classroom).toEqual({ id: w.classId, name: '4 Amanah' })
    expect(data.week).toEqual({ from: '2026-10-19', to: '2026-10-25', label: '19 Okt 2026 — 25 Okt 2026' })
    expect(data.summary).toMatchObject({ answered: 5, activePupils: 1, attentionSubjects: 0 })
    expect(data.topPerformers).toHaveLength(1)
    expect(data.topPerformers[0]).toMatchObject({ rank: 1, answered: 5, accuracy: 80 })
  })

  it('the previous week is reachable with the week parameter', async () => {
    const res = await (as.guru as Client).get(`/api/guru/weekly-report?classroomId=${w.classId}&week=2026-10-14`)
    const data = parseData(res, GuruWeeklyReportSchema)
    expect(data.week.from).toBe('2026-10-12')
    expect(data.summary.answered).toBe(1)
  })
})
