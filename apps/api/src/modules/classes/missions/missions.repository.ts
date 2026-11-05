import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import { VISIBLE_USER_SQL } from '../../command-center/shared/visibility'

export type MissionType = 'latih_tubi' | 'tracking_a' | 'youtube' | 'harian'
export type RemedialStatus = 'active' | 'completed' | 'cancelled'

/** A mission as the student reads and the practice adapter resolve it. Ids are decimal strings. */
export interface MissionRecord {
  id: string
  teacherId: string
  classroomId: string | null
  title: string
  missionType: MissionType
  /** Malaysia calendar day `YYYY-MM-DD`. */
  missionDate: string
  subjectId: string
  chapterId: string | null
  questionCount: number
  coinsPerCorrect: number
  description: string | null
  /** Coins paid once at the target (S6-T07); null for the older types. */
  rewardCoins: number | null
  resourceTitle: string | null
  resourceUrl: string | null
  resourceNote: string | null
  isTest: boolean
  createdAt: Date
}

/** Input of `createWithItems`: a Misi Harian of a teacher (S6-T07). */
export interface NewTeacherMission {
  teacherId: string
  /** Null = all the teacher's active classes. */
  classroomId: string | null
  title: string
  description: string | null
  /** Malaysia day `YYYY-MM-DD`. */
  date: string
  subjectId: string
  targetQuestions: number
  rewardCoins: number
  isTest: boolean
  now: Date
  /** MYT creation day `YYYY-MM-DD` the cap counts. */
  creationDay: string
  cap: number
}

export type CreateMissionOutcome = { status: 'capReached' } | { status: 'created'; mission: MissionRecord; recipients: number }

export interface RemedialRecord {
  id: string
  teacherId: string
  studentId: string
  subjectId: string
  totalQuestions: number
  status: RemedialStatus
  beforeAccuracy: number
  afterAccuracy: number | null
  completedAt: Date | null
  isTest: boolean
  createdAt: Date
}

export interface RemedialItem {
  position: number
  questionId: string
  questionVersionNo: number
}

export interface NewRemedial {
  teacherId: string
  studentId: string
  subjectId: string
  beforeAccuracy: number
  isTest: boolean
  now: Date
  /** In served order; stored with `position` 0..n-1. */
  items: readonly { questionId: string; questionVersionNo: number }[]
}

const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)

const toMission = (r: {
  id: bigint
  teacherId: bigint
  classroomId: bigint | null
  title: string
  missionType: string
  missionDate: Date
  subjectId: bigint
  chapterId: bigint | null
  questionCount: number
  coinsPerCorrect: number
  description: string | null
  rewardCoins: number | null
  resourceTitle: string | null
  resourceUrl: string | null
  resourceNote: string | null
  isTest: boolean
  createdAt: Date
}): MissionRecord => ({
  id: idToString(r.id),
  teacherId: idToString(r.teacherId),
  classroomId: r.classroomId === null ? null : idToString(r.classroomId),
  title: r.title,
  missionType: r.missionType as MissionType,
  missionDate: r.missionDate.toISOString().slice(0, 10),
  subjectId: idToString(r.subjectId),
  chapterId: r.chapterId === null ? null : idToString(r.chapterId),
  questionCount: r.questionCount,
  coinsPerCorrect: r.coinsPerCorrect,
  description: r.description,
  rewardCoins: r.rewardCoins,
  resourceTitle: r.resourceTitle,
  resourceUrl: r.resourceUrl,
  resourceNote: r.resourceNote,
  isTest: r.isTest,
  createdAt: r.createdAt,
})

const toRemedial = (r: {
  id: bigint
  teacherId: bigint
  studentId: bigint
  subjectId: bigint
  totalQuestions: number
  status: string
  beforeAccuracy: { toNumber(): number }
  afterAccuracy: { toNumber(): number } | null
  completedAt: Date | null
  isTest: boolean
  createdAt: Date
}): RemedialRecord => ({
  id: idToString(r.id),
  teacherId: idToString(r.teacherId),
  studentId: idToString(r.studentId),
  subjectId: idToString(r.subjectId),
  totalQuestions: r.totalQuestions,
  status: r.status as RemedialStatus,
  beforeAccuracy: r.beforeAccuracy.toNumber(),
  afterAccuracy: r.afterAccuracy === null ? null : r.afterAccuracy.toNumber(),
  completedAt: r.completedAt,
  isTest: r.isTest,
  createdAt: r.createdAt,
})

/** Newest first, ties by id descending (mock: createdAt desc, id desc). */
const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

/**
 * The only doorway to `missions`, `mission_items`, `remedial_tests` and `remedial_test_items` (BE-18, M10).
 * Every method uses `prisma.client`, so it joins the transaction a service opened with `prisma.transaction(...)`.
 * The teacher Misi Harian create, list and delete (S6-T07) live here too.
 */
@Injectable()
export class MissionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- missions ---------------------------------------------------------------------------------

  /** M05 #21: the missions of one Malaysia day whose stored recipients include the student, oldest first. */
  async missionsForStudent(userId: string, day: string, isTest: boolean): Promise<MissionRecord[]> {
    const key = idOf(userId)
    if (key === null) return []
    const rows = await this.db.mission.findMany({
      where: { missionDate: new Date(`${day}T00:00:00.000Z`), isTest, items: { some: { studentId: key } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map(toMission)
  }

  /** The mission when the student is a stored recipient, else null (BR-M10-17). */
  async missionOfRecipient(missionId: string, userId: string): Promise<MissionRecord | null> {
    const id = idOf(missionId)
    const student = idOf(userId)
    if (id === null || student === null) return null
    const row = await this.db.mission.findFirst({ where: { id, items: { some: { studentId: student } } } })
    return row ? toMission(row) : null
  }

  async teacherHasMission(teacherId: string): Promise<boolean> {
    const key = idOf(teacherId)
    if (key === null) return false
    return (await this.db.mission.count({ where: { teacherId: key, isTest: false } })) > 0
  }

  // --- teacher Misi Harian (S6-T07, API-GUR-11) --------------------------------------------------

  /** The teacher's own missions, mission date descending, then created descending (ties by id). */
  async listForTeacher(teacherId: string, isTest: boolean): Promise<MissionRecord[]> {
    const key = idOf(teacherId)
    if (key === null) return []
    const rows = await this.db.mission.findMany({
      where: { teacherId: key, isTest },
      orderBy: [{ missionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toMission)
  }

  /** Missions the teacher created on one Malaysia creation day (`created_at`, MYT). It counts existing rows: a deleted mission frees a slot (known limit). */
  async countCreatedOnDay(teacherId: string, day: string, isTest: boolean): Promise<number> {
    const key = idOf(teacherId)
    if (key === null) return 0
    const start = new Date(`${day}T00:00:00+08:00`)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return this.db.mission.count({ where: { teacherId: key, isTest, createdAt: { gte: start, lt: end } } })
  }

  /**
   * Creates a Misi Harian and its recipient snapshot in ONE transaction (D-T07-3): the teacher's active pupils of the chosen
   * class, or of all the teacher's active classes. The daily cap is re-checked inside the transaction, under an advisory lock per
   * (teacher, creation day), so two parallel creates cannot both take the last slot. `classroom_id` stays null for "all classes".
   */
  async createWithItems(input: NewTeacherMission): Promise<CreateMissionOutcome> {
    const teacher = idFromString(input.teacherId)
    return this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mission-cap:${input.teacherId}:${input.creationDay}`}, 0))`
      if ((await this.countCreatedOnDay(input.teacherId, input.creationDay, input.isTest)) >= input.cap) return { status: 'capReached' as const }
      const classroom = input.classroomId === null ? null : idFromString(input.classroomId)
      const classFilter = classroom === null ? Prisma.empty : Prisma.sql`AND c.id = ${classroom}`
      // VISIBLE_USER_SQL: the same secondary-only rule as memberIdsOf (R1 is Tingkatan 1-5).
      const pupils = await tx.$queryRaw<{ student_id: bigint }[]>`
        SELECT DISTINCT e.student_id
          FROM enrolments e
          JOIN classrooms c ON c.id = e.classroom_id
          JOIN users u ON u.id = e.student_id
         WHERE c.teacher_id = ${teacher} AND c.kind = 'classroom' AND c.is_active ${classFilter}
           AND e.status = 'active' AND e.is_test = ${input.isTest} AND u.is_active
           AND ${VISIBLE_USER_SQL}
         ORDER BY e.student_id`
      const row = await tx.mission.create({
        data: {
          teacherId: teacher,
          classroomId: classroom,
          title: input.title,
          description: input.description,
          missionType: 'harian',
          missionDate: new Date(`${input.date}T00:00:00.000Z`),
          subjectId: idFromString(input.subjectId),
          questionCount: input.targetQuestions,
          rewardCoins: input.rewardCoins,
          isTest: input.isTest,
          createdAt: input.now,
          updatedAt: input.now,
        },
      })
      if (pupils.length > 0) {
        await tx.missionItem.createMany({
          data: pupils.map((p) => ({ missionId: row.id, studentId: p.student_id, createdAt: input.now })),
        })
      }
      return { status: 'created' as const, mission: toMission(row), recipients: pupils.length }
    })
  }

  /**
   * Distinct pupils of the teacher's active classes with a COMPLETED practice session linked to the mission, per mission id
   * (every asked id present, 0 when none).
   */
  async completedCounts(missionIds: readonly string[], teacherId: string, isTest: boolean): Promise<Map<string, number>> {
    const out = new Map<string, number>(missionIds.map((id) => [id, 0]))
    const keys = missionIds.flatMap((id) => (isIdString(id) ? [idFromString(id)] : []))
    const teacher = idOf(teacherId)
    if (keys.length === 0 || teacher === null) return out
    const rows = await this.db.$queryRaw<{ mission_id: bigint; n: number }[]>`
      SELECT s.mission_id, COUNT(DISTINCT s.user_id)::int AS n
        FROM practice_sessions s
       WHERE s.mission_id = ANY(${keys}::bigint[]) AND s.status = 'completed' AND s.is_test = ${isTest}
         AND EXISTS (
           SELECT 1 FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id
            WHERE e.student_id = s.user_id AND e.status = 'active' AND e.is_test = ${isTest}
              AND c.teacher_id = ${teacher} AND c.kind = 'classroom' AND c.is_active)
       GROUP BY s.mission_id`
    for (const r of rows) out.set(idToString(r.mission_id), r.n)
    return out
  }

  async findById(id: string): Promise<MissionRecord | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.mission.findUnique({ where: { id: key } })
    return row ? toMission(row) : null
  }

  /** Deletes a mission the teacher owns; recipient rows go with it (cascade). False when nothing matched. */
  async deleteOwn(id: string, teacherId: string): Promise<boolean> {
    const key = idOf(id)
    const teacher = idOf(teacherId)
    if (key === null || teacher === null) return false
    const res = await this.db.mission.deleteMany({ where: { id: key, teacherId: teacher } })
    return res.count > 0
  }

  // --- remedial tests ---------------------------------------------------------------------------

  async remedial(id: string): Promise<RemedialRecord | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.remedialTest.findUnique({ where: { id: key } })
    return row ? toRemedial(row) : null
  }

  /** The student's tests of every status, newest first. */
  async remedialForStudent(studentId: string, isTest: boolean): Promise<RemedialRecord[]> {
    const key = idOf(studentId)
    if (key === null) return []
    const rows = await this.db.remedialTest.findMany({ where: { studentId: key, isTest }, orderBy: NEWEST_FIRST })
    return rows.map(toRemedial)
  }

  /** The teacher's tests of every status, newest first. */
  async remedialForTeacher(teacherId: string, isTest: boolean): Promise<RemedialRecord[]> {
    const key = idOf(teacherId)
    if (key === null) return []
    const rows = await this.db.remedialTest.findMany({ where: { teacherId: key, isTest }, orderBy: NEWEST_FIRST })
    return rows.map(toRemedial)
  }

  /** The questions of a test in `position` order. */
  async remedialItems(id: string): Promise<RemedialItem[]> {
    const key = idOf(id)
    if (key === null) return []
    const rows = await this.db.remedialTestItem.findMany({ where: { remedialTestId: key }, orderBy: { position: 'asc' } })
    return rows.map((r) => ({ position: r.position, questionId: idToString(r.questionId), questionVersionNo: r.questionVersionNo }))
  }

  /** Serializes generation for one (teacher, student, subject) so two parallel calls cannot both open a test. */
  async lockGeneration(teacherId: string, studentId: string, subjectId: string): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`remedial:${teacherId}:${studentId}:${subjectId}`}, 0))`
  }

  /** True when the teacher already has an `active` test for the student and subject. */
  async hasOpen(teacherId: string, studentId: string, subjectId: string): Promise<boolean> {
    const t = idOf(teacherId)
    const s = idOf(studentId)
    const sub = idOf(subjectId)
    if (t === null || s === null || sub === null) return false
    return (await this.db.remedialTest.count({ where: { teacherId: t, studentId: s, subjectId: sub, status: 'active' } })) > 0
  }

  async countForStudent(studentId: string): Promise<number> {
    const key = idOf(studentId)
    if (key === null) return 0
    return this.db.remedialTest.count({ where: { studentId: key } })
  }

  /** Inserts the test and its N ordered items (position 0..N-1). */
  async createRemedial(input: NewRemedial): Promise<RemedialRecord> {
    const row = await this.db.remedialTest.create({
      data: {
        teacherId: idFromString(input.teacherId),
        studentId: idFromString(input.studentId),
        subjectId: idFromString(input.subjectId),
        totalQuestions: input.items.length,
        status: 'active',
        beforeAccuracy: input.beforeAccuracy,
        isTest: input.isTest,
        createdAt: input.now,
        updatedAt: input.now,
        items: {
          create: input.items.map((it, position) => ({
            position,
            questionId: idFromString(it.questionId),
            questionVersionNo: it.questionVersionNo,
          })),
        },
      },
    })
    return toRemedial(row)
  }

  /** `active` to `cancelled`; false when the test is not an active test of this teacher (nothing written). */
  async cancelRemedial(id: string, teacherId: string, now: Date): Promise<boolean> {
    const key = idOf(id)
    const t = idOf(teacherId)
    if (key === null || t === null) return false
    const res = await this.db.remedialTest.updateMany({
      where: { id: key, teacherId: t, status: 'active' },
      data: { status: 'cancelled', updatedAt: now },
    })
    return res.count > 0
  }

  /**
   * Called inside the practice submit transaction (`tx`): the student's active test becomes `completed`.
   * Idempotent: a test that is not active (completed already, cancelled) is left as it is. A session of the other mode
   * (`is_test` differs, Mod Pelajar) never completes the test.
   */
  async completeRemedial(
    tx: TxClient,
    input: { remedialTestId: string; userId: string; afterAccuracy: number; completedAt: Date; isTest: boolean },
  ): Promise<void> {
    const id = idOf(input.remedialTestId)
    const student = idOf(input.userId)
    if (id === null || student === null) return
    await tx.remedialTest.updateMany({
      where: { id, studentId: student, status: 'active', isTest: input.isTest },
      data: { status: 'completed', afterAccuracy: input.afterAccuracy, completedAt: input.completedAt, updatedAt: input.completedAt },
    })
  }
}
