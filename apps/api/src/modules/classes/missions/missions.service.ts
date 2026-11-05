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
import type { TxClient } from '../../../db/client'
import { PrismaService } from '../../../db/prisma.service'
import { PracticeRepository } from '../../practice'
import { StreakService } from '../../wallet'
import type { ClassActor } from '../actor'
import { ClassesRepository } from '../classes.repository'
import { invalid, tryParseStrict } from '../strict-body'
import { goalMet, goalProgress, mytDayWindow, type GoalFacts } from './goals.rules'
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
    @Inject(StreakService) private readonly streaks: StreakService,
  ) {}

  /**
   * The M10 missions whose mission date is today (Malaysia day) and whose stored recipients include the caller,
   * oldest first. Status (Q-SESS-LINK) comes from the caller's sessions linked by `missionId`: a completed
   * session beats an in-progress one, none gives `new`.
   *
   * S6-T07: then, for EVERY pupil, the Global goals dated today (Malaysia day): `global: true`, `goalKind`, `target` (the goal
   * target), `progress` (computed read-only from the pupil's practice of today) and `completed` (the reward row exists). A Global goal
   * has no subject, no questions and starts no session; `status` is `completed` once paid, else `new`.
   */
  async today(actor: ClassActor): Promise<MissionToday[]> {
    const day = mytDay(this.clock.now())
    const missions = await this.repo.missionsForStudent(actor.userId, day, actor.isTest)
    const subjects = missions.length === 0 ? new Map<string, string>() : await this.classes.subjectNames(missions.map((m) => m.subjectId))
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
    const globals = await this.repo.globalMissionsOfDay(day)
    if (globals.length > 0) {
      const [facts, paid] = await Promise.all([this.goalFacts(actor.userId, day, actor.isTest), this.repo.paidMissionIds(actor.userId, globals.map((g) => g.id))])
      for (const g of globals) {
        if (g.goalKind === null) continue
        const progress = goalProgress(g.goalKind, facts)
        const completed = paid.has(g.id)
        out.push({
          id: g.id,
          title: g.title,
          typeLabel: MISSION_TYPE_LABELS[g.missionType],
          subjectName: '',
          questionCount: g.questionCount,
          coinsPerCorrect: g.coinsPerCorrect,
          resourceTitle: null,
          resourceUrl: null,
          resourceNote: null,
          status: completed ? 'completed' : 'new',
          description: g.description,
          ...(g.rewardCoins !== null ? { rewardCoins: g.rewardCoins } : {}),
          global: true,
          goalKind: g.goalKind,
          target: g.questionCount,
          progress,
          completed,
        })
      }
    }
    return out
  }

  /**
   * The pupil's practice facts of a Malaysia day for the goal rules, READ-ONLY through S5's existing reads
   * (`PracticeRepository.dayFacts` for the completed sessions and `answers` for the answers, both with the day's `[00:00, 24:00)` +08:00
   * window) and the stored streak (`StreakService.get`). Only rows of the same Mod Pelajar mode count.
   */
  async goalFacts(userId: string, day: string, isTest: boolean, tx?: TxClient): Promise<GoalFacts> {
    const { from, to } = mytDayWindow(day)
    const [{ sessions }, answers, streak] = await Promise.all([
      this.practice.dayFacts(userId, from, to),
      this.practice.answers(userId, { from, to, includeTest: isTest }),
      this.streaks.get(userId, tx ? { tx } : {}),
    ])
    return {
      sessions: sessions.filter((x) => x.isTest === isTest).map((x) => ({ correct: x.correctCount, total: x.questionCount, timeSpentSec: x.timeSpentSec })),
      answers: answers.filter((a) => a.isTest === isTest).map((a) => ({ isCorrect: a.isCorrect, topicId: a.topicId })),
      streak: streak.current,
    }
  }

  /**
   * S6-T07: pays the Global goals dated `day` that the pupil has now reached and not been paid for, once each (`mission_rewards`,
   * unique on mission and pupil; the insert is `ON CONFLICT DO NOTHING`). Runs inside the caller's transaction `tx` (the practice submit),
   * under a per-pupil lock so two sessions completing at once each see the other's rows. Returns the rewards paid by THIS call; the wallet
   * credit is the caller's. A goal with a reward of 0 or null pays nothing and writes no row.
   */
  async evaluateGlobalGoals(input: { userId: string; day: string; isTest: boolean; at: Date; sessionId?: string | null }, tx: TxClient): Promise<{ missionId: string; coins: number }[]> {
    const globals = (await this.repo.globalMissionsOfDay(input.day, tx)).filter((g) => g.goalKind !== null && (g.rewardCoins ?? 0) > 0)
    if (globals.length === 0) return []
    await this.repo.lockTargetReward(tx, 'goals', input.userId)
    const paid = await this.repo.paidMissionIds(input.userId, globals.map((g) => g.id), tx)
    const open = globals.filter((g) => !paid.has(g.id))
    if (open.length === 0) return []
    const facts = await this.goalFacts(input.userId, input.day, input.isTest, tx)
    const out: { missionId: string; coins: number }[] = []
    for (const g of open) {
      if (g.goalKind === null || !goalMet(goalProgress(g.goalKind, facts), g.questionCount)) continue
      const coins = g.rewardCoins ?? 0
      if (await this.repo.insertReward(tx, { missionId: g.id, studentId: input.userId, coins, sessionId: input.sessionId ?? null, isTest: input.isTest, paidAt: input.at })) out.push({ missionId: g.id, coins })
    }
    return out
  }

  // --- teacher Misi Harian (API-GUR-11) ---------------------------------------------------------

  /** `GET /guru/missions`: own and Global missions, date descending then created descending, with the completion count. */
  async list(actor: ClassActor): Promise<TeacherMission[]> {
    const missions = await this.repo.listForTeacher(actor.userId, actor.isTest)
    if (missions.length === 0) return []
    const [subjects, completed, rewarded] = await Promise.all([
      this.classes.subjectNames(missions.map((m) => m.subjectId)),
      this.repo.completedCounts(missions.filter((m) => m.scope !== 'global').map((m) => m.id), actor.userId, actor.isTest),
      this.repo.rewardedCounts(missions.filter((m) => m.scope === 'global').map((m) => m.id), actor.userId, actor.isTest),
    ])
    return missions.map((m) => toTeacherMission(m, m.subjectId !== null ? (subjects.get(m.subjectId) ?? null) : null, (m.scope === 'global' ? rewarded : completed).get(m.id) ?? 0))
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
   * `DELETE /guru/missions/:id`: an own mission goes with its recipient rows (rewards already paid stay). A Global mission
   * is 403 "Misi global tidak boleh dipadam."; another teacher's mission and an unknown id are the generic 404.
   */
  async remove(actor: ClassActor, id: string): Promise<{ deleted: 1 }> {
    const mission = isIdString(id) ? await this.repo.findById(id) : null
    if (!mission) throw notFound()
    if (mission.scope === 'global') throw ApiError.of('FORBIDDEN', { message: MISSION_MESSAGES.globalNotDeletable })
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
    global: m.scope === 'global',
    goalKind: m.goalKind,
    completedCount,
  }
}
