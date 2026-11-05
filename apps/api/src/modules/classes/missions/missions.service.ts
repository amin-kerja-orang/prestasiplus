import { Inject, Injectable } from '@nestjs/common'
import {
  MISSION_DAILY_CAP,
  MISSION_MESSAGES,
  MISSION_REWARD_MAX,
  MISSION_TYPE_LABELS,
  type MissionToday,
  type TeacherMission,
  TeacherMissionCreateSchema,
} from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock, mytDay } from '../../../db/clock'
import { isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { PracticeRepository } from '../../practice'
import type { ClassActor } from '../actor'
import { ClassesRepository } from '../classes.repository'
import { invalid, tryParseStrict } from '../strict-body'
import { MISSION_AUDIT } from './missions.constants'
import { MissionsRepository, type MissionRecord } from './missions.repository'

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

/**
 * D-T07-1: the reward ceiling is the contract constant (100) for now; S7-T01 replaces this one line with the
 * game-settings reader (`mission_reward_max`, D113-a). The contract schema applies the same ceiling at the boundary.
 */
const rewardMax = (): number => MISSION_REWARD_MAX

/**
 * Missions: the pupil read `GET /missions/today` (M05 #21) and the teacher Misi Harian create, list and delete
 * (API-GUR-11, S6-T07).
 */
@Injectable()
export class MissionsService {
  constructor(
    @Inject(MissionsRepository) private readonly repo: MissionsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The M10 missions whose mission date is today (Malaysia day) and whose stored recipients include the caller,
   * oldest first. Status (Q-SESS-LINK) comes from the caller's sessions linked by `missionId`: a completed
   * session beats an in-progress one, none gives `new`.
   */
  async today(actor: ClassActor): Promise<MissionToday[]> {
    const missions = await this.repo.missionsForStudent(actor.userId, mytDay(this.clock.now()), actor.isTest)
    if (missions.length === 0) return []
    const subjects = await this.classes.subjectNames(missions.map((m) => m.subjectId))
    const out: MissionToday[] = []
    for (const m of missions) {
      const sessions = (await this.practice.linkedSessions(actor.userId, 'missionId', m.id)).filter((s) => s.isTest === actor.isTest)
      const status = sessions.some((s) => s.status === 'completed') ? 'completed' : sessions.length > 0 ? 'in_progress' : 'new'
      out.push({
        id: m.id,
        title: m.title,
        typeLabel: MISSION_TYPE_LABELS[m.missionType],
        subjectName: (m.subjectId !== null ? subjects.get(m.subjectId) : undefined) ?? '',
        questionCount: m.questionCount,
        coinsPerCorrect: m.coinsPerCorrect,
        resourceTitle: m.resourceTitle,
        resourceUrl: m.resourceUrl,
        resourceNote: m.resourceNote,
        status,
        description: m.description,
        ...(m.rewardCoins !== null ? { rewardCoins: m.rewardCoins } : {}),
      })
    }
    return out
  }

  // --- teacher Misi Harian (API-GUR-11) ---------------------------------------------------------

  /** `GET /guru/missions`: the teacher's own missions, date descending then created descending, with the completion count. */
  async list(actor: ClassActor): Promise<TeacherMission[]> {
    const missions = await this.repo.listForTeacher(actor.userId, actor.isTest)
    if (missions.length === 0) return []
    const [subjects, completed] = await Promise.all([
      this.classes.subjectNames(missions.map((m) => m.subjectId)),
      this.repo.completedCounts(missions.map((m) => m.id), actor.userId, actor.isTest),
    ])
    return missions.map((m) => toTeacherMission(m, m.subjectId !== null ? (subjects.get(m.subjectId) ?? null) : null, completed.get(m.id) ?? 0))
  }

  /**
   * `POST /guru/missions`. Field failures (body, a date before today in Malaysia, an unknown or inactive subject) are
   * reported together with 422 `fields`; the class must be the caller's own active class (any other id is the generic 404, as the
   * other teacher routes answer, SEC-M10-02); the cap (5 per teacher per creation day) is 422 without `fields`.
   * The recipients are a snapshot of the active pupils at this moment.
   */
  async create(actor: ClassActor, raw: unknown): Promise<TeacherMission> {
    const parsed = tryParseStrict(TeacherMissionCreateSchema, raw)
    const now = this.clock.now()
    const today = mytDay(now)
    const fields: Record<string, string> = { ...parsed.fields }
    const body = parsed.data
    if (body) {
      if (body.date < today) fields.date ??= MISSION_MESSAGES.datePast
      if (body.rewardCoins > rewardMax()) fields.rewardCoins ??= MISSION_MESSAGES.reward
      if (!(isIdString(body.subjectId) && (await this.classes.activeSubjectExists(body.subjectId)))) fields.subjectId ??= MISSION_MESSAGES.subjectRequired
    }
    if (!body || Object.keys(fields).length > 0) throw invalid(fields)

    if (body.classroomId !== undefined && body.classroomId !== null) {
      const cls = isIdString(body.classroomId) ? await this.classes.get(body.classroomId) : null
      if (!cls || cls.kind !== 'classroom' || cls.teacherId !== actor.userId || !cls.isActive) throw notFound()
    }

    const refusedCap = (): ApiError => ApiError.of('VALIDATION_ERROR', { message: MISSION_MESSAGES.capReached })
    // Fast path; the repository checks again inside the transaction, under a lock.
    if ((await this.repo.countCreatedOnDay(actor.userId, today, actor.isTest)) >= MISSION_DAILY_CAP) throw refusedCap()

    const outcome = await this.prisma.transaction(async (tx) => {
      const res = await this.repo.createWithItems({
        teacherId: actor.userId,
        classroomId: body.classroomId ?? null,
        title: body.title,
        description: body.description ?? null,
        date: body.date,
        subjectId: body.subjectId,
        targetQuestions: body.targetQuestions,
        rewardCoins: body.rewardCoins,
        isTest: actor.isTest,
        now,
        creationDay: today,
        cap: MISSION_DAILY_CAP,
      })
      if (res.status === 'created') {
        await this.audit.record({
          tx,
          action: MISSION_AUDIT.MISSION_CREATED,
          actorUserId: actor.userId,
          actorRole: actor.role,
          sessionRowId: actor.auth.sessionRowId,
          targetType: 'mission',
          targetId: res.mission.id,
          schoolId: actor.schoolId,
          scopeLevel: actor.auth.active.scope.level,
          requestId: actor.requestId,
          ip: actor.ip,
          isTest: actor.isTest,
          details: { classroomId: body.classroomId ?? null, subjectId: body.subjectId, recipients: res.recipients },
        })
      }
      return res
    })
    if (outcome.status === 'capReached') throw refusedCap()
    const subjects = await this.classes.subjectNames([outcome.mission.subjectId])
    return toTeacherMission(outcome.mission, outcome.mission.subjectId !== null ? (subjects.get(outcome.mission.subjectId) ?? null) : null, 0)
  }

  /**
   * `DELETE /guru/missions/:id`: an own mission goes with its recipient rows. Another teacher's mission and an unknown id
   * are the generic 404.
   */
  async remove(actor: ClassActor, id: string): Promise<{ deleted: 1 }> {
    const mission = isIdString(id) ? await this.repo.findById(id) : null
    if (!mission) throw notFound()
    if (mission.teacherId !== actor.userId) throw notFound()
    await this.prisma.transaction(async (tx) => {
      if (!(await this.repo.deleteOwn(mission.id, actor.userId))) throw notFound()
      await this.audit.record({
        tx,
        action: MISSION_AUDIT.MISSION_DELETED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.auth.sessionRowId,
        targetType: 'mission',
        targetId: mission.id,
        schoolId: actor.schoolId,
        scopeLevel: actor.auth.active.scope.level,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        details: {},
      })
    })
    return { deleted: 1 }
  }
}

function toTeacherMission(m: MissionRecord, subjectName: string | null, completedCount: number): TeacherMission {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    targetQuestions: m.questionCount,
    rewardCoins: m.rewardCoins ?? 0,
    date: m.missionDate,
    classroomId: m.classroomId,
    subjectId: m.subjectId,
    subjectName,
    global: false,
    completedCount,
  }
}
