import { Inject, Injectable } from '@nestjs/common'
import type { PracticeMode, StartSessionRequest } from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../db/ids'
import { type Prng, prngStream } from '../../db/prng'
import { CurriculumRepository, type SubjectWithLevels } from '../curriculum'
import { SubscriptionService } from '../subscriptions'
import {
  chapterLocked,
  invalidField,
  missionDone,
  noAttemptsLeft,
  noWrongQuestions,
  notEnoughQuestions,
  notFound,
  remedialDone,
  setNotReady,
  trialExhausted,
} from './errors'
import { type AssignmentKind, type AssignmentResolution, type PracticeQuestion, PracticePorts } from './ports'
import { PracticeRepository, type SessionRecord } from './practice.repository'
import {
  COUNT_OPTIONS,
  LATIH_TUBI_COUNTS,
  LATIH_TUBI_TARGETS,
  MISSION_COINS_PER_CORRECT,
  OFFERED_LEVEL_CODES,
  PAST_YEAR_COUNTS,
  REVISION_LENGTH,
  SPM_LEVEL_CODES,
  UNLOCK_SCORE,
} from './rules'

/** What a start resolves to, before the session row exists. */
export interface StartPlan {
  mode: PracticeMode
  subjectId: string | null
  levelId: string | null
  difficulty: number | null
  chapterId: string | null
  year: number | null
  setNo: number | null
  targetQuestionId: string | null
  missionId: string | null
  remedialTestId: string | null
  questionSetId: string | null
  timeLimitSec: number | null
  /** The questions to serve, at the live version, in served order. */
  served: PracticeQuestion[]
  /** Revision (BR-14). */
  revisionMeta: { selected: number; totalWrong: number } | null
  /** Mission coin rate (BR-09). */
  coinsPerCorrect: number | null
  /** An in-progress mission session to resume (BR-32) instead of a new one. */
  resume: SessionRecord | null
}

const blank = (mode: PracticeMode): StartPlan => ({
  mode,
  subjectId: null,
  levelId: null,
  difficulty: null,
  chapterId: null,
  year: null,
  setNo: null,
  targetQuestionId: null,
  missionId: null,
  remedialTestId: null,
  questionSetId: null,
  timeLimitSec: null,
  served: [],
  revisionMeta: null,
  coinsPerCorrect: null,
  resume: null,
})

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const cmpId = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)

/** An id in the path of the data model (bigint): anything else is an unknown record, never a 500. */
function validId(v: string | undefined | null): string {
  if (v == null || !isIdString(v)) throw notFound()
  return v
}

function countIn(v: unknown, options: readonly number[]): number {
  if (!isInt(v) || !options.includes(v)) throw invalidField('count')
  return v
}

/**
 * Resolves a start (SRS M05 section 7 #4; BR-04, 07, 11, 13 to 17, 32; M06 BR-M06-04 / 07 / 13) or refuses
 * it with the module error. Nothing is written here. Question selection goes through the question source
 * port (BE-09), assigned work through the assignment port (BE-18), ramalan sets through BE-41's port.
 */
@Injectable()
export class PracticeStartPlanner {
  constructor(
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
    @Inject(PracticeRepository) private readonly repo: PracticeRepository,
    @Inject(SubscriptionService) private readonly subscriptions: SubscriptionService,
  ) {}

  async plan(userId: string, req: StartSessionRequest, now: Date, isTest: boolean): Promise<StartPlan> {
    // BR-07: a user without a subscription and no trial left cannot start (402).
    const trial = await this.subscriptions.trial(userId, now)
    if (trial.active && trial.remaining === 0) throw trialExhausted()

    const plan = blank(req.mode)
    switch (req.mode) {
      case 'random':
        return this.random(plan, userId, req, now)
      case 'chapter':
        return this.chapter(plan, userId, req, isTest)
      case 'revision':
        return this.revision(plan, userId, req)
      case 'past_year':
        return this.pastYear(plan, userId, req, now)
      case 'latih_tubi':
        return this.latihTubi(plan, userId, req, now)
      case 'ramalan':
        return this.ramalan(plan, req)
      case 'mission':
        return this.mission(plan, userId, req, now)
      case 'remedial':
        return this.remedial(plan, userId, req, now)
      case 'question_set':
        return this.questionSet(plan, userId, req, now)
    }
  }

  // --- helpers ----------------------------------------------------------------------------------

  /** Seeded draw (BR-13): a stream keyed by the user, the start instant and how many sessions they began. */
  private async rng(userId: string, now: Date): Promise<Prng> {
    const started = await this.repo.countSessions(userId)
    return prngStream(`practice:start:${userId}:${String(now.getTime())}:${String(started)}`)
  }

  private async subjectOf(code: unknown): Promise<SubjectWithLevels> {
    if (typeof code !== 'string' || code === '') throw notFound()
    const s = await this.curriculum.subjectByCode(code)
    if (!s?.isActive) throw notFound()
    return s
  }

  private async levelCodes(): Promise<Map<string, string>> {
    return new Map((await this.curriculum.levels()).map((l) => [idToString(l.id), l.code]))
  }

  /** The questions among `ids` that are eligible now, at their live version, in the order of `ids`. */
  private async serve(ids: readonly string[]): Promise<PracticeQuestion[]> {
    const unique = [...new Set(ids)]
    const live = await this.ports.questions.live(unique)
    const out: PracticeQuestion[] = []
    for (const id of unique) {
      const q = live.get(id)
      if (q) out.push(q)
    }
    return out
  }

  private async assigned(kind: AssignmentKind, userId: string, id: string | undefined, now: Date) {
    const itemId = validId(id)
    const res: AssignmentResolution = await this.ports.assignments.resolve(kind, { userId, id: itemId, at: now })
    if (res.status === 'not_ready') throw setNotReady()
    if (res.status === 'not_found') throw notFound()
    return res
  }

  // --- modes ------------------------------------------------------------------------------------

  private async random(plan: StartPlan, userId: string, req: StartSessionRequest, now: Date): Promise<StartPlan> {
    const subject = await this.subjectOf(req.subjectCode)
    const codes = await this.levelCodes()
    const offered = subject.educationLevelIds.map(idToString).filter((id) => OFFERED_LEVEL_CODES.includes(codes.get(id) ?? ''))
    const levelId = req.levelId ?? null
    if (levelId !== null && !offered.includes(levelId)) throw invalidField('levelId')
    const difficulty = req.difficulty ?? null
    const count = countIn(req.count, COUNT_OPTIONS)
    const levels = levelId !== null ? [levelId] : offered
    if (levels.length === 0) throw notEnoughQuestions()
    const subjectId = idToString(subject.id)
    const ids = await this.ports.questions.sample(
      { subjectId, educationLevelIds: levels, ...(difficulty !== null ? { difficulty } : {}) },
      count,
      await this.rng(userId, now),
    )
    const served = await this.serve(ids)
    if (served.length < count) throw notEnoughQuestions()
    return Object.assign(plan, { subjectId, levelId, difficulty, served })
  }

  /**
   * BR-15: the chapters of a subject and level that have at least one eligible chapter question, in chapter order, each with
   * its question count. One grouped count for all chapters: no question ids are loaded or hydrated.
   */
  private async practiceChapters(subjectId: bigint, levelId: bigint) {
    const chapters = await this.curriculum.chapters(subjectId, levelId, { active: true })
    const counts = await this.ports.questions.chapterCounts(chapters.map((c) => idToString(c.id)))
    return chapters.map((chapter) => ({ chapter, count: counts.get(idToString(chapter.id)) ?? 0 })).filter((c) => c.count > 0)
  }

  private async chapter(plan: StartPlan, userId: string, req: StartSessionRequest, isTest: boolean): Promise<StartPlan> {
    const chapterId = idFromString(validId(req.chapterId))
    const ch = await this.curriculum.chapter(chapterId, { active: true })
    if (!ch || ch.educationLevelId === null) throw notFound()
    const count = countIn(req.count, COUNT_OPTIONS)
    const chapterKey = idToString(ch.id)
    // The exact (servable-shape) count of this one chapter: a chapter whose questions cannot be served is empty.
    if (((await this.ports.questions.chapterCounts([chapterKey], true)).get(chapterKey) ?? 0) === 0) throw notEnoughQuestions()

    // BR-16: chapter 1 is open; chapter k needs chapter k - 1 complete with a score of at least 70.
    const list = await this.practiceChapters(ch.subjectId, ch.educationLevelId)
    const i = list.findIndex((c) => c.chapter.id === ch.id)
    if (i > 0) {
      // The chapter before this one that can actually be served: its exact count is what "complete" is measured against, and a
      // chapter whose questions are all unservable is skipped, so one non-servable question never locks the rest for good.
      let prev: { chapter: (typeof list)[number]['chapter']; count: number } | null = null
      for (let j = i - 1; j >= 0 && prev === null; j--) {
        const candidate = list[j]
        if (!candidate) continue
        const key = idToString(candidate.chapter.id)
        const exact = (await this.ports.questions.chapterCounts([key], true)).get(key) ?? 0
        if (exact > 0) prev = { chapter: candidate.chapter, count: exact }
      }
      if (prev) {
        const progress = await this.repo.chapterProgress(userId, idToString(prev.chapter.id), isTest)
        const answered = progress.size
        const correct = [...progress.values()].filter((p) => p.correct).length
        const complete = answered >= prev.count && prev.count > 0
        const score = answered === 0 ? 0 : (correct / answered) * 100
        if (!(complete && score >= UNLOCK_SCORE)) throw chapterLocked()
      }
    } else if (i < 0) {
      throw chapterLocked()
    }

    // BR-17: unanswered questions first (ascending id), then the answered ones by oldest last answer. Only `count`
    // ids are read: the unanswered ones in SQL, the answered ones from the user's own (bounded) history.
    const last = await this.repo.chapterProgress(userId, chapterKey, isTest)
    const fresh = await this.ports.questions.chapterPage(chapterKey, [...last.keys()], count)
    const ids = [...fresh]
    if (ids.length < count && last.size > 0) {
      const seen = [...last.keys()].sort((a, b) => (last.get(a)?.lastAt.getTime() ?? 0) - (last.get(b)?.lastAt.getTime() ?? 0) || cmpId(a, b))
      // Only answered questions that still belong to this chapter (a question moved to another chapter is not repeated here).
      const live = await this.serve(seen.slice(0, Math.max(count * 4, 50)))
      for (const q of live) if (ids.length < count && q.chapterId === chapterKey) ids.push(q.id)
      // Rare: the oldest answered ones are mostly ineligible now, so read further in the history.
      for (let at = Math.max(count * 4, 50); ids.length < count && at < seen.length; at += 200) {
        for (const q of await this.serve(seen.slice(at, at + 200))) if (ids.length < count && q.chapterId === chapterKey) ids.push(q.id)
      }
    }
    const served = await this.serve(ids)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, {
      subjectId: idToString(ch.subjectId),
      levelId: idToString(ch.educationLevelId),
      chapterId: idToString(ch.id),
      served,
    })
  }

  private async revision(plan: StartPlan, userId: string, req: StartSessionRequest): Promise<StartPlan> {
    const subject = await this.subjectOf(req.subjectCode)
    if (req.count !== undefined && req.count !== REVISION_LENGTH) throw invalidField('count')
    const subjectId = idToString(subject.id)
    const queue = await this.repo.queue(userId, { subjectId })
    // XL-19: only questions eligible for practice are served and counted.
    const live = await this.ports.questions.live(queue.map((q) => q.questionId))
    const eligible = queue.filter((q) => live.has(q.questionId))
    if (eligible.length === 0) throw noWrongQuestions()
    const picked = eligible.slice(0, REVISION_LENGTH)
    const served = picked.map((q) => live.get(q.questionId)).filter((q): q is PracticeQuestion => q !== undefined)
    return Object.assign(plan, { subjectId, served, revisionMeta: { selected: picked.length, totalWrong: eligible.length } })
  }

  private async pastYear(plan: StartPlan, userId: string, req: StartSessionRequest, now: Date): Promise<StartPlan> {
    const subject = await this.subjectOf(req.subjectCode)
    const count = countIn(req.count, PAST_YEAR_COUNTS)
    const subjectId = idToString(subject.id)
    const ids = await this.ports.questions.sample({ subjectId, spmPool: true }, count, await this.rng(userId, now))
    const served = await this.serve(ids)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, { subjectId, served })
  }

  private async latihTubi(plan: StartPlan, userId: string, req: StartSessionRequest, now: Date): Promise<StartPlan> {
    const subject = await this.subjectOf(req.subjectCode)
    const codes = await this.levelCodes()
    const levelId = req.levelId ?? null
    if (levelId !== null && !SPM_LEVEL_CODES.includes(codes.get(levelId) ?? '')) throw invalidField('levelId')
    const difficulty = req.difficulty ?? null
    if (difficulty !== null && (difficulty < 2 || difficulty > 5)) throw invalidField('difficulty')
    const subjectId = idToString(subject.id)

    if (req.targetQuestionId !== undefined && req.targetQuestionId !== null) {
      // M04 BR-M04-17 "Buka Soalan Sama": one eligible SPM-pool question of the subject.
      if (req.count !== 1) throw invalidField('count')
      if (!isIdString(req.targetQuestionId)) throw invalidField('targetQuestionId')
      const q = (await this.ports.questions.live([req.targetQuestionId])).get(req.targetQuestionId)
      if (!q?.spmPool || q.subjectId !== subjectId) throw invalidField('targetQuestionId')
      return Object.assign(plan, { subjectId, targetQuestionId: q.id, served: [q] })
    }

    const target = LATIH_TUBI_TARGETS[subject.code]
    const count = target !== undefined ? countIn(req.count, [target]) : countIn(req.count, LATIH_TUBI_COUNTS)
    const ids = await this.ports.questions.sample(
      {
        subjectId,
        spmPool: true,
        ...(levelId !== null ? { educationLevelIds: [levelId] } : {}),
        ...(difficulty !== null ? { difficulty } : {}),
      },
      count,
      await this.rng(userId, now),
    )
    const served = await this.serve(ids)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, { subjectId, levelId, difficulty, served })
  }

  private async ramalan(plan: StartPlan, req: StartSessionRequest): Promise<StartPlan> {
    const subject = await this.subjectOf(req.subjectCode)
    if (!isInt(req.year) || !isInt(req.setNo) || req.year < 1900 || req.year > 2100 || req.setNo < 1 || req.setNo > 999) throw notFound()
    const subjectId = idToString(subject.id)
    const ids = await this.ports.ramalan.ramalanQuestionIds(subjectId, req.year, req.setNo)
    if (ids === null) throw notFound()
    if (ids.length === 0) throw setNotReady()
    const served = await this.serve(ids)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, { subjectId, year: req.year, setNo: req.setNo, served })
  }

  private async mission(plan: StartPlan, userId: string, req: StartSessionRequest, now: Date): Promise<StartPlan> {
    const res = await this.assigned('mission', userId, req.missionId, now)
    if (res.status !== 'ok' || req.missionId === undefined) throw notFound()
    const sessions = await this.repo.linkedSessions(userId, 'missionId', req.missionId)
    if (sessions.some((s) => s.status === 'completed')) throw missionDone()
    // BR-32: an in-progress session of the mission is resumed, not duplicated.
    const open = sessions.find((s) => s.status === 'in_progress')
    if (open) return { ...plan, missionId: req.missionId, resume: open }
    if (res.questionIds.length === 0) throw notEnoughQuestions()
    const served = await this.serve(res.questionIds)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, {
      subjectId: res.subjectId,
      missionId: req.missionId,
      served,
      coinsPerCorrect: res.coinsPerCorrect || MISSION_COINS_PER_CORRECT,
    })
  }

  private async remedial(plan: StartPlan, userId: string, req: StartSessionRequest, now: Date): Promise<StartPlan> {
    const res = await this.assigned('remedial', userId, req.remedialTestId, now)
    if (res.status !== 'ok' || req.remedialTestId === undefined) throw notFound()
    if (res.completed) throw remedialDone()
    const sessions = await this.repo.linkedSessions(userId, 'remedialTestId', req.remedialTestId as string)
    if (sessions.some((s) => s.status === 'completed')) throw remedialDone()
    // An in-progress session of the test is resumed, not duplicated (one attempt per test).
    const open = sessions.find((s) => s.status === 'in_progress')
    if (open) return { ...plan, remedialTestId: req.remedialTestId as string, resume: open }
    if (res.questionIds.length === 0) throw notEnoughQuestions()
    const served = await this.serve(res.questionIds)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, { subjectId: res.subjectId, remedialTestId: req.remedialTestId, served })
  }

  private async questionSet(plan: StartPlan, userId: string, req: StartSessionRequest, now: Date): Promise<StartPlan> {
    const res = await this.assigned('question_set', userId, req.questionSetId, now)
    if (res.status !== 'ok' || req.questionSetId === undefined) throw notFound()
    const sessions = await this.repo.linkedSessions(userId, 'questionSetId', req.questionSetId)
    const done = sessions.filter((s) => s.status === 'completed').length
    if ((res.maxAttempts ?? 0) > 0 && done >= (res.maxAttempts ?? 0)) throw noAttemptsLeft()
    const open = sessions.find((s) => s.status === 'in_progress')
    if (open) return { ...plan, questionSetId: req.questionSetId as string, resume: open }
    if (res.questionIds.length === 0) throw notEnoughQuestions()
    const served = await this.serve(res.questionIds)
    if (served.length === 0) throw notEnoughQuestions()
    return Object.assign(plan, {
      subjectId: res.subjectId ?? served[0]?.subjectId ?? null,
      questionSetId: req.questionSetId,
      served,
      timeLimitSec: res.timeLimitSec ?? null,
    })
  }
}
