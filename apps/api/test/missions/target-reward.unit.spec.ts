import { describe, expect, it } from 'vitest'

import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import type { TargetRewardFacts } from '../../src/modules/classes/missions/missions.repository'

// S6-T07 settleTargetReward (FR-GM-20.2, AC-GM-20.2, AC-GUR-2b-7): DB-free; the fake repository mirrors the SQL rules.
const AT = new Date('2026-11-05T02:00:00Z')
const PUPIL = '21'
const MISSION = '7'
const SESSION = '0b6f3c6e-6a63-4f2b-8f3a-6f2f6f0c1a11'

interface Row { id: string; target: number; reward: number | null; recipients: string[] }

function build(row: Partial<Row> = {}) {
  const mission: Row = { id: MISSION, target: 10, reward: 25, recipients: [PUPIL], ...row }
  const world = { answered: 0, paid: new Map<string, { coins: number; isTest: boolean }>(), locks: [] as string[], lastIsTest: undefined as boolean | undefined }
  const repo = {
    lockTargetReward: (_tx: unknown, missionId: string, studentId: string) => {
      world.locks.push(`${missionId}:${studentId}`)
      return Promise.resolve()
    },
    targetRewardFacts: (_tx: unknown, i: { missionId: string; studentId: string; isTest: boolean }): Promise<TargetRewardFacts | null> => {
      world.lastIsTest = i.isTest
      if (i.missionId !== mission.id) return Promise.resolve(null)
      return Promise.resolve({ questionCount: mission.target, rewardCoins: mission.reward, recipient: mission.recipients.includes(i.studentId), answered: world.answered })
    },
    insertReward: (_tx: unknown, i: { missionId: string; studentId: string; coins: number; isTest: boolean }) => {
      const key = `${i.missionId}:${i.studentId}`
      if (world.paid.has(key)) return Promise.resolve(false) // ON CONFLICT (mission_id, student_id) DO NOTHING
      world.paid.set(key, { coins: i.coins, isTest: i.isTest })
      return Promise.resolve(true)
    },
  }
  const adapter = new PracticeAssignmentsAdapter(repo as never, {} as never, {} as never)
  const settle = (over: Partial<{ userId: string; missionId: string; isTest: boolean }> = {}) =>
    adapter.settleTargetReward({ userId: PUPIL, missionId: MISSION, sessionId: SESSION, isTest: false, at: AT, ...over }, {} as never)
  return { world, settle }
}

describe('S6-T07 settleTargetReward', () => {
  it('target not met: pays 0 and records nothing', async () => {
    const { world, settle } = build()
    world.answered = 9
    expect(await settle()).toEqual({ paid: 0 })
    expect(world.paid.size).toBe(0)
  })

  it('target met (answered >= question_count): pays the reward coins and records the row', async () => {
    const { world, settle } = build()
    world.answered = 10
    expect(await settle()).toEqual({ paid: 25 })
    expect(world.paid.get(`${MISSION}:${PUPIL}`)).toEqual({ coins: 25, isTest: false })
  })

  it('more answers than the target still pays once the target is reached (cumulative over sessions)', async () => {
    const { world, settle } = build()
    world.answered = 14
    expect(await settle()).toEqual({ paid: 25 })
  })

  it('a second completion pays nothing (unique mission and pupil)', async () => {
    const { world, settle } = build()
    world.answered = 10
    expect(await settle()).toEqual({ paid: 25 })
    world.answered = 20
    expect(await settle()).toEqual({ paid: 0 })
    expect(world.paid.size).toBe(1)
  })

  it('a pupil who is not a recipient is paid nothing', async () => {
    const { world, settle } = build({ recipients: ['99'] })
    world.answered = 50
    expect(await settle()).toEqual({ paid: 0 })
    expect(world.paid.size).toBe(0)
  })

  it('a reward of 0 or null pays nothing and writes no row', async () => {
    for (const reward of [0, null]) {
      const { world, settle } = build({ reward })
      world.answered = 50
      expect(await settle()).toEqual({ paid: 0 })
      expect(world.paid.size).toBe(0)
    }
  })

  it('an unknown mission or a malformed id pays nothing; the Mod Pelajar flag is passed to the count', async () => {
    const { world, settle } = build()
    world.answered = 50
    expect(await settle({ missionId: '404' })).toEqual({ paid: 0 })
    expect(await settle({ missionId: 'abc' })).toEqual({ paid: 0 })
    expect(await settle({ missionId: '0' })).toEqual({ paid: 0 })
    expect(await settle({ isTest: true })).toEqual({ paid: 25 })
    expect(world.lastIsTest).toBe(true)
    expect(world.paid.get(`${MISSION}:${PUPIL}`)?.isTest).toBe(true)
  })

  it('takes the per-(mission, pupil) lock before counting', async () => {
    const { world, settle } = build()
    await settle()
    expect(world.locks).toEqual([`${MISSION}:${PUPIL}`])
  })
})
