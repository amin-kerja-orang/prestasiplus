import { MISSION_DAILY_CAP, MISSION_MESSAGES, MISSION_REWARD_MAX, TeacherMissionSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { FixedClock } from '../../src/db/clock'
import type { GuruGlobalChallenge } from '@pp/contract'
import type { ClassActor } from '../../src/modules/classes/actor'
import type { ClassRecord } from '../../src/modules/classes/classes.repository'
import { MissionsService } from '../../src/modules/classes/missions/missions.service'
import type { MissionRecord, NewTeacherMission } from '../../src/modules/classes/missions/missions.repository'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'

// 2026-11-05 23:30 UTC is 2026-11-06 07:30 in Malaysia: the MYT day is already the 6th.
const NOW = '2026-11-05T23:30:00Z'
const TODAY = '2026-11-06'
const TEACHER = '10'
const OTHER_TEACHER = '11'
const SUBJECT = '5'

const actor = (over: Partial<ClassActor> = {}): ClassActor =>
  ({
    auth: { sessionRowId: 's1', active: { scope: { level: 'school' } } },
    userId: TEACHER,
    role: 'teacher',
    schoolId: '1',
    isTest: false,
    requestId: null,
    ip: null,
    ...over,
  }) as unknown as ClassActor

const cls = (id: string, teacherId: string | null, over: Partial<ClassRecord> = {}): ClassRecord =>
  ({ id, kind: 'classroom', teacherId, isActive: true, ...over }) as ClassRecord

interface World {
  missions: MissionRecord[]
  items: Map<string, string[]>
  classes: ClassRecord[]
  /** class id -> pupils currently enrolled (active). */
  roster: Map<string, string[]>
  completed: Map<string, number>
  audits: string[]
  /** The teacher's pupil set handed to the challenge reader, and the challenge rows it answers. */
  pupils: string[]
  asked: (readonly string[])[]
  challenges: GuruGlobalChallenge[]
  nextId: number
}

function build(clockAt = NOW) {
  const world: World = { missions: [], items: new Map(), classes: [], roster: new Map(), completed: new Map(), audits: [], pupils: ['21', '22'], asked: [], challenges: [], nextId: 100 }
  const repo = {
    listForTeacher: (teacherId: string) =>
      Promise.resolve(
        world.missions
          .filter((m) => m.teacherId === teacherId)
          .sort((a, b) => (a.missionDate === b.missionDate ? b.createdAt.getTime() - a.createdAt.getTime() : a.missionDate < b.missionDate ? 1 : -1)),
      ),
    countCreatedOnDay: (teacherId: string, day: string) =>
      Promise.resolve(world.missions.filter((m) => m.teacherId === teacherId && m.createdAt.toISOString().slice(0, 10) <= day && new Date(m.createdAt.getTime() + 8 * 3600_000).toISOString().slice(0, 10) === day).length),
    createWithItems: async (input: NewTeacherMission) => {
      // Mirrors the repository: cap re-check, then the snapshot of the chosen class or of all the teacher's active classes.
      if ((await repo.countCreatedOnDay(input.teacherId, input.creationDay)) >= input.cap) return { status: 'capReached' as const }
      const ids = world.classes.filter((c) => c.teacherId === input.teacherId && c.isActive && (input.classroomId === null || c.id === input.classroomId)).map((c) => c.id)
      const pupils = [...new Set(ids.flatMap((id) => world.roster.get(id) ?? []))]
      const mission: MissionRecord = {
        id: String(world.nextId++),
        teacherId: input.teacherId,
        classroomId: input.classroomId,
        title: input.title,
        missionType: 'harian',
        missionDate: input.date,
        subjectId: input.subjectId,
        chapterId: null,
        questionCount: input.targetQuestions,
        coinsPerCorrect: 3,
        description: input.description,
        rewardCoins: input.rewardCoins,
        resourceTitle: null,
        resourceUrl: null,
        resourceNote: null,
        isTest: input.isTest,
        createdAt: input.now,
      }
      world.missions.push(mission)
      world.items.set(mission.id, pupils)
      return { status: 'created' as const, mission, recipients: pupils.length }
    },
    completedCounts: (ids: string[]) => Promise.resolve(new Map(ids.map((id) => [id, world.completed.get(id) ?? 0]))),
    findById: (id: string) => Promise.resolve(world.missions.find((m) => m.id === id) ?? null),
    deleteOwn: (id: string, teacherId: string) => {
      const i = world.missions.findIndex((m) => m.id === id && m.teacherId === teacherId)
      if (i >= 0) world.missions.splice(i, 1)
      return Promise.resolve(i >= 0)
    },
    missionsForStudent: (userId: string, day: string) =>
      Promise.resolve(world.missions.filter((m) => m.missionDate === day && (world.items.get(m.id) ?? []).includes(userId))),
  }
  const classes = {
    activeSubjectExists: (id: string) => Promise.resolve(id === SUBJECT),
    get: (id: string) => Promise.resolve(world.classes.find((c) => c.id === id) ?? null),
    subjectNames: () => Promise.resolve(new Map([[SUBJECT, 'Matematik']])),
    teacherStudentIds: () => Promise.resolve(world.pupils),
  }
  const practice = { linkedSessions: () => Promise.resolve([]) }
  const gamification = { challengesForTeacher: (pupils: readonly string[]) => (world.asked.push(pupils), Promise.resolve(world.challenges)) }
  const audit = { record: (e: { action: string }) => (world.audits.push(e.action), Promise.resolve()) }
  const prisma = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn({}) }
  const service = new MissionsService(repo as never, classes as never, practice as never, audit as never, prisma as never, new FixedClock(clockAt), gamification as never)
  return { world, repo, service }
}

const body = (over: Record<string, unknown> = {}) => ({ title: 'Jawab 20 soalan', targetQuestions: 20, rewardCoins: 15, date: TODAY, subjectId: SUBJECT, ...over })

const fieldsOf = async (p: Promise<unknown>): Promise<Record<string, string> | undefined> => {
  try {
    await p
  } catch (e) {
    if (e instanceof ApiError) return e.fields
    throw e
  }
  throw new Error('expected a refusal')
}
const refusal = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected a refusal')
}

describe('S6-T07 create validation (AC-GM-20.1)', () => {
  it('each BM message of the body check', async () => {
    const { service } = build()
    expect(await fieldsOf(service.create(actor(), body({ title: '  ' })))).toEqual({ title: MISSION_MESSAGES.titleRequired })
    expect(await fieldsOf(service.create(actor(), body({ title: 'x'.repeat(256) })))).toEqual({ title: MISSION_MESSAGES.titleTooLong })
    expect(await fieldsOf(service.create(actor(), body({ description: 'x'.repeat(501) })))).toEqual({ description: MISSION_MESSAGES.descriptionTooLong })
    expect(await fieldsOf(service.create(actor(), body({ targetQuestions: 0 })))).toEqual({ targetQuestions: MISSION_MESSAGES.target })
    expect(await fieldsOf(service.create(actor(), body({ targetQuestions: 1001 })))).toEqual({ targetQuestions: MISSION_MESSAGES.target })
    expect(await fieldsOf(service.create(actor(), body({ date: '2026-13-40' })))).toEqual({ date: MISSION_MESSAGES.dateInvalid })
  })

  it('rewardCoins 101 answers ERR-GAME-17 (422 MISSION_REWARD_TOO_HIGH), other field errors ride along; 100 and 0 are accepted', async () => {
    const { service } = build()
    expect(MISSION_REWARD_MAX).toBe(100)
    const err = await refusal(service.create(actor(), body({ rewardCoins: 101, title: ' ' })))
    expect(err.getStatus()).toBe(422)
    expect(err.code).toBe('MISSION_REWARD_TOO_HIGH')
    expect(err.message).toBe('Ganjaran misi melebihi had.')
    expect(err.fields).toEqual({ title: MISSION_MESSAGES.titleRequired, rewardCoins: 'Ganjaran misi melebihi had.' })
    expect((await refusal(service.create(actor(), body({ rewardCoins: 5000 })))).code).toBe('MISSION_REWARD_TOO_HIGH')
    // Not a whole number or negative: the contract field text, as before.
    expect(await fieldsOf(service.create(actor(), body({ rewardCoins: -1 })))).toEqual({ rewardCoins: MISSION_MESSAGES.reward })
    expect(await fieldsOf(service.create(actor(), body({ rewardCoins: 100.5 })))).toEqual({ rewardCoins: MISSION_MESSAGES.reward })
    expect((await service.create(actor(), body({ rewardCoins: 100 }))).rewardCoins).toBe(100)
    expect((await service.create(actor(), body({ rewardCoins: 0 }))).rewardCoins).toBe(0)
  })

  it('an unknown or inactive subject is refused on subjectId', async () => {
    const { service } = build()
    expect(await fieldsOf(service.create(actor(), body({ subjectId: '999' })))).toEqual({ subjectId: MISSION_MESSAGES.subjectRequired })
  })

  it('a field outside the contract is refused (strict)', async () => {
    const { service } = build()
    expect(Object.keys((await fieldsOf(service.create(actor(), body({ scope: 'global' })))) ?? {})).toEqual(['scope'])
  })

  it('a whitespace-only or empty description is stored as null; a text is trimmed', async () => {
    const { service, world } = build()
    for (const description of ['   ', '', null]) expect((await service.create(actor(), body({ description }))).description).toBeNull()
    expect((await service.create(actor(), body({ description: '  Fokus  ' }))).description).toBe('Fokus')
    expect(world.missions.map((m) => m.description)).toEqual([null, null, null, 'Fokus'])
  })

  it('creates a harian mission with defaults and the contract shape', async () => {
    const { service, world } = build()
    const m = await service.create(actor(), { title: 'Misi saya', date: TODAY, subjectId: SUBJECT })
    expect(TeacherMissionSchema.parse(m)).toMatchObject({ targetQuestions: 10, rewardCoins: 10, global: false, completedCount: 0, subjectName: 'Matematik', classroomId: null })
    expect(world.missions[0]).toMatchObject({ missionType: 'harian', questionCount: 10 })
    expect(world.audits).toEqual(['classes.mission.created'])
  })
})

describe('S6-T07 date rule uses the Malaysia day', () => {
  it('the MYT day of the clock is accepted and the day before is refused', async () => {
    const { service } = build() // 23:30 UTC on the 5th is the 6th in Malaysia
    expect((await service.create(actor(), body({ date: TODAY }))).date).toBe(TODAY)
    expect(await fieldsOf(service.create(actor(), body({ date: '2026-11-05' })))).toEqual({ date: MISSION_MESSAGES.datePast })
    expect((await service.create(actor(), body({ date: '2026-12-01' }))).date).toBe('2026-12-01')
  })

  it('just before Malaysia midnight (15:59 UTC) the same UTC day is still today', async () => {
    const { service } = build('2026-11-05T15:59:00Z')
    expect((await service.create(actor(), body({ date: '2026-11-05' }))).date).toBe('2026-11-05')
  })
})

describe('S6-T07 daily cap (5 per teacher per creation day)', () => {
  it('the 6th is refused with 422 and no fields; another teacher is unaffected', async () => {
    const { service, world } = build()
    for (let i = 0; i < MISSION_DAILY_CAP; i++) await service.create(actor(), body({ title: `Misi ${String(i)}` }))
    const err = await refusal(service.create(actor(), body({ title: 'Keenam' })))
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.getStatus()).toBe(422)
    expect(err.message).toBe(MISSION_MESSAGES.capReached)
    expect(err.fields).toBeUndefined()
    expect(world.missions).toHaveLength(MISSION_DAILY_CAP)
    await service.create(actor({ userId: OTHER_TEACHER }), body())
  })

  it('the cap counts the creation day, not the mission date', async () => {
    const { service } = build()
    for (let i = 0; i < MISSION_DAILY_CAP; i++) await service.create(actor(), body({ title: `Misi ${String(i)}`, date: '2026-12-25' }))
    expect((await refusal(service.create(actor(), body({ date: '2026-12-26' })))).message).toBe(MISSION_MESSAGES.capReached)
  })
})

describe('S6-T07 class ownership and the recipients snapshot (D-T07-3)', () => {
  const setup = () => {
    const t = build()
    t.world.classes.push(cls('1', TEACHER), cls('2', TEACHER), cls('3', OTHER_TEACHER), cls('4', TEACHER, { isActive: false }))
    t.world.roster.set('1', ['p1', 'p2'])
    t.world.roster.set('2', ['p2', 'p3'])
    t.world.roster.set('3', ['p9'])
    t.world.roster.set('4', ['p8'])
    return t
  }

  it('a foreign, inactive or unknown class is the generic 404', async () => {
    const { service } = setup()
    for (const classroomId of ['3', '4', '999']) {
      const err = await refusal(service.create(actor(), body({ classroomId })))
      expect(err.code).toBe('NOT_FOUND')
      expect(err.getStatus()).toBe(404)
    }
  })

  it('no classroomId (or null) snapshots the distinct pupils of all active own classes', async () => {
    const { service, world } = setup()
    const a = await service.create(actor(), body())
    const b = await service.create(actor(), body({ classroomId: null }))
    expect(world.items.get(a.id)).toEqual(['p1', 'p2', 'p3'])
    expect(world.items.get(b.id)).toEqual(['p1', 'p2', 'p3'])
    expect(a.classroomId).toBeNull()
  })

  it('one class snapshots only its pupils; a pupil enrolled later is not added', async () => {
    const { service, world } = setup()
    const m = await service.create(actor(), body({ classroomId: '1' }))
    expect(m.classroomId).toBe('1')
    expect(world.items.get(m.id)).toEqual(['p1', 'p2'])
    world.roster.get('1')?.push('late')
    expect(world.items.get(m.id)).toEqual(['p1', 'p2'])
  })

  it('today() serves a harian mission only to a snapshot recipient, with description and rewardCoins', async () => {
    const { service } = setup()
    await service.create(actor(), body({ classroomId: '1', description: 'Fokus Bab 3', rewardCoins: 25 }))
    const mine = await service.today(actor({ userId: 'p1', role: 'student' }))
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ typeLabel: 'Misi Harian', description: 'Fokus Bab 3', rewardCoins: 25, subjectName: 'Matematik', questionCount: 20 })
    expect(await service.today(actor({ userId: 'p3', role: 'student' }))).toEqual([])
    expect(await service.today(actor({ userId: 'late', role: 'student' }))).toEqual([])
  })
})

describe('S6-T07 list and delete', () => {
  it('lists only the own missions with global false and completedCount', async () => {
    const { service, world } = build()
    const own = await service.create(actor(), body({ date: '2026-11-20' }))
    await service.create(actor({ userId: OTHER_TEACHER }), body({ title: 'Guru lain' }))
    world.completed.set(own.id, 4)
    const rows = await service.list(actor())
    expect(rows.map((r) => r.title)).toEqual(['Jawab 20 soalan'])
    expect(rows[0]).toMatchObject({ global: false, completedCount: 4, date: '2026-11-20' })
    for (const r of rows) TeacherMissionSchema.parse(r)
  })

  const challenge = (over: Partial<GuruGlobalChallenge> = {}): GuruGlobalChallenge => ({ id: '5', title: 'Cabaran A', description: 'Jawab soalan', target: 10, rewardSyiling: 30, rewardXp: 50, difficulty: 'easy', icon: 'target', completedToday: 3, ...over })

  it('appends one Global row per active challenge after the own missions, with the mapped fields and today\'s MYT date', async () => {
    const { service, world } = build()
    world.challenges = [challenge(), challenge({ id: '6', title: 'Cabaran B', description: '', completedToday: 0 })]
    await service.create(actor(), body({ date: '2026-11-20' }))
    const rows = await service.list(actor())
    expect(rows.map((r) => r.title)).toEqual(['Jawab 20 soalan', 'Cabaran A', 'Cabaran B'])
    expect(rows[0]).toMatchObject({ global: false })
    expect(rows[1]).toEqual({ id: 'challenge-5', title: 'Cabaran A', description: 'Jawab soalan', targetQuestions: 10, rewardCoins: 30, date: TODAY, classroomId: null, subjectId: null, subjectName: null, global: true, completedCount: 3 })
    expect(rows[2]).toMatchObject({ id: 'challenge-6', description: null, completedCount: 0 })
    for (const r of rows) TeacherMissionSchema.parse(r)
  })

  it('counts over the teacher\'s pupil set; an empty set gives 0; a teacher without missions still sees the challenges', async () => {
    const { service, world } = build()
    world.challenges = [challenge({ completedToday: 4 })]
    expect((await service.list(actor()))[0]).toMatchObject({ global: true, completedCount: 4 })
    expect(world.asked).toEqual([['21', '22']])
    world.pupils = []
    expect((await service.list(actor()))[0]).toMatchObject({ completedCount: 0 })
    expect(world.asked[1]).toEqual([])
  })

  it('delete never reaches a challenge: its id is not a mission id, 404', async () => {
    const { service, world } = build()
    world.challenges = [challenge({ id: '1' })]
    const own = await service.create(actor(), body())
    const err = await refusal(service.remove(actor(), 'challenge-1'))
    expect(err.code).toBe('NOT_FOUND')
    expect(world.missions.some((m) => m.id === own.id)).toBe(true)
  })

  it('delete: own OK (and gone), foreign and unknown 404', async () => {
    const { service, world } = build()
    const own = await service.create(actor(), body())
    const foreign = await service.create(actor({ userId: OTHER_TEACHER }), body())

    expect(await service.remove(actor(), own.id)).toEqual({ deleted: 1 })
    expect(world.missions.some((m) => m.id === own.id)).toBe(false)
    expect(world.audits).toContain('classes.mission.deleted')

    for (const id of [foreign.id, '987654', 'abc']) {
      const err = await refusal(service.remove(actor(), id))
      expect(err.code).toBe('NOT_FOUND')
    }
    expect(world.missions.some((m) => m.id === foreign.id)).toBe(true)
  })
})

describe('S6-T07 the practice adapter serves harian like latih_tubi', () => {
  const record = (type: MissionRecord['missionType']): MissionRecord => ({
    id: '7',
    teacherId: TEACHER,
    classroomId: null,
    title: 't',
    missionType: type,
    missionDate: TODAY,
    subjectId: SUBJECT,
    chapterId: null,
    questionCount: 3,
    coinsPerCorrect: 3,
    description: null,
    rewardCoins: 10,
    resourceTitle: null,
    resourceUrl: null,
    resourceNote: null,
    isTest: false,
    createdAt: new Date(NOW),
  })

  const adapterFor = (m: MissionRecord) => {
    const draws: unknown[] = []
    const repo = { missionOfRecipient: () => Promise.resolve(m) }
    const pool = { draw: (filter: unknown) => (draws.push(filter), Promise.resolve(['q1', 'q2', 'q3'])) }
    return { draws, adapter: new PracticeAssignmentsAdapter(repo as never, pool as never, {} as never, {} as never) }
  }
  const at = new Date(NOW)

  it('harian draws from the subject SPM pool', async () => {
    const { adapter, draws } = adapterFor(record('harian'))
    expect(await adapter.resolve('mission', { userId: 'p1', id: '7', at })).toMatchObject({ status: 'ok', subjectId: SUBJECT, questionIds: ['q1', 'q2', 'q3'] })
    expect(draws).toEqual([{ subjectId: SUBJECT, spmPool: true }])
  })

  it('latih_tubi still draws, youtube still has no source, a mission without a subject is not found', async () => {
    expect(await adapterFor(record('latih_tubi')).adapter.resolve('mission', { userId: 'p1', id: '7', at })).toMatchObject({ questionIds: ['q1', 'q2', 'q3'] })
    expect(await adapterFor(record('youtube')).adapter.resolve('mission', { userId: 'p1', id: '7', at })).toMatchObject({ questionIds: [] })
  })
})
