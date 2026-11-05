import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import { START, bootMissionsApp, count, insertMission, loadWorld, type MissionsTestApp, type World } from './helpers'

const AT = new Date(START)

// S6-T07 (AC-GM-20.2, AC-GUR-2b-7): the once-only target reward against the real database.
describe('S6-T07 settleTargetReward (DB)', () => {
  let t: MissionsTestApp
  let w: World
  let adapter: PracticeAssignmentsAdapter
  let prisma: PrismaService

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    adapter = t.get(PracticeAssignmentsAdapter)
    prisma = t.get(PrismaService)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const mission = async (target: number, reward: number | null, recipients = [w.student1]): Promise<string> => {
    const id = await insertMission(t, w, { teacherId: w.teacherA, recipients, type: 'harian', questionCount: target, title: `Ganjaran ${String(Math.random())}` })
    await t.db.query(`update missions set reward_coins = $2 where id = $1`, [id, reward])
    return id
  }

  /** A completed mission session of the pupil with `answers` answer rows (the state inside the submit transaction). */
  const session = async (missionId: string, studentId: string, answers: number): Promise<string> => {
    const row = (
      await t.db.query<{ id: string }>(
        `insert into practice_sessions (user_id, mode, mission_id, question_count, status, completed_at, started_at)
         values ($1, 'mission', $2, $3, 'completed', $4, $4) returning id`,
        [studentId, missionId, answers, START],
      )
    )[0] as { id: string }
    for (let i = 0; i < answers; i++) {
      await t.db.query(`insert into practice_answers (session_id, user_id, is_correct, answered_at) values ($1, $2, $3, $4)`, [row.id, studentId, i % 2 === 0, START])
    }
    return row.id
  }

  const settle = (missionId: string, studentId: string, sessionId: string) =>
    prisma.transaction((tx) => adapter.settleTargetReward({ userId: studentId, missionId, sessionId, isTest: false, at: AT }, tx))

  it('not met pays 0; met pays the coins once; the repeat pays 0; one row exists', async () => {
    const id = await mission(4, 30)
    expect(await settle(id, w.student1, await session(id, w.student1, 3))).toEqual({ paid: 0 })
    const second = await session(id, w.student1, 1) // cumulative: 3 + 1 answers reach the target of 4
    expect(await settle(id, w.student1, second)).toEqual({ paid: 30 })
    expect(await settle(id, w.student1, await session(id, w.student1, 4))).toEqual({ paid: 0 })
    expect(await count(t, 'mission_rewards where mission_id = $1 and student_id = $2 and coins = 30 and session_id = $3', [id, w.student1, second])).toBe(1)
  })

  it('a non-recipient and a null or zero reward are paid nothing', async () => {
    const id = await mission(1, 20, [w.student1])
    expect(await settle(id, w.student2, await session(id, w.student2, 5))).toEqual({ paid: 0 })
    const none = await mission(1, null)
    expect(await settle(none, w.student1, await session(none, w.student1, 5))).toEqual({ paid: 0 })
    const zero = await mission(1, 0)
    expect(await settle(zero, w.student1, await session(zero, w.student1, 5))).toEqual({ paid: 0 })
    expect(await count(t, 'mission_rewards where mission_id = any($1::bigint[])', [[id, none, zero]])).toBe(0)
  })

  it('two sessions completing at the same time pay exactly once', async () => {
    const id = await mission(2, 40)
    const a = await session(id, w.student1, 2)
    const b = await session(id, w.student1, 2)
    const results = await Promise.all([settle(id, w.student1, a), settle(id, w.student1, b)])
    expect(results.map((r) => r.paid).sort((x, y) => x - y)).toEqual([0, 40])
    expect(await count(t, 'mission_rewards where mission_id = $1', [id])).toBe(1)
  })

  it('two parallel sessions of 1 answer each that only together reach a target of 2 still pay once', async () => {
    const id = await mission(2, 15)
    const a = await session(id, w.student1, 1)
    const b = await session(id, w.student1, 1)
    const results = await Promise.all([settle(id, w.student1, a), settle(id, w.student1, b)])
    expect(results.reduce((n, r) => n + r.paid, 0)).toBe(15)
    expect(await count(t, 'mission_rewards where mission_id = $1', [id])).toBe(1)
  })

  it('deleting the mission removes its reward rows (cascade)', async () => {
    const id = await mission(1, 10)
    await settle(id, w.student1, await session(id, w.student1, 1))
    await t.db.query(`delete from missions where id = $1`, [id])
    expect(await count(t, 'mission_rewards where mission_id = $1', [id])).toBe(0)
  })

  it('payTargetReward credits the wallet once as mission_target / mission:<id> and the repeat credits nothing more', async () => {
    const id = await mission(2, 35)
    const sessionId = await session(id, w.student1, 2)
    const run = () => prisma.transaction((tx) => adapter.payTargetReward({ userId: w.student1, missionId: id, sessionId, isTest: false, at: AT }, tx))
    expect((await run()).paid).toBeGreaterThanOrEqual(35)
    expect((await run()).paid).toBe(0)
    const rows = await t.db.query<{ amount: number; description: string }>(`select amount::int, description from coin_ledger where user_id = $1 and source = 'mission_target' and source_id = $2`, [w.student1, `mission:${id}`])
    expect(rows).toEqual([{ amount: 35, description: 'Ganjaran misi' }])
  })
})
