import { Inject, Injectable } from '@nestjs/common'
import type { QuestionSetStudentItem } from '@pp/contract'

import { isIdString } from '../../../db/ids'
import { PracticeRepository } from '../../practice'
import { ATTEMPT_LOOKUP_CONCURRENCY } from './question-sets.constants'
import { QuestionsRepository } from '../../questions'
import type { ClassActor } from '../actor'
import { ClassesRepository } from '../classes.repository'
import { QuestionSetsRepository, type QuestionSetRecord } from './question-sets.repository'

/** A set is visible to a member at `at`: published, or scheduled and due; a draft never (BR-M10-18). */
export function isVisibleAt(set: Pick<QuestionSetRecord, 'status' | 'scheduledAt'>, at: Date): boolean {
  if (set.status === 'published') return true
  return set.status === 'scheduled' && set.scheduledAt !== null && set.scheduledAt.getTime() <= at.getTime()
}

/** The student list "Set Soalan Guru" (S34) and the shared item rules used by the practice adapter. */
@Injectable()
export class QuestionSetsService {
  constructor(
    @Inject(QuestionSetsRepository) private readonly repo: QuestionSetsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
  ) {}

  /**
   * Served question ids per set, in `position` order, keeping only questions that are still eligible
   * (published live version, active). A deactivated question is skipped, never removed from the set. A set
   * that needs a rebuild (migrated header only) has no served items.
   */
  async eligibleItems(sets: readonly QuestionSetRecord[]): Promise<Map<string, string[]>> {
    const buildable = sets.filter((s) => !s.needsRebuild)
    const stored = await this.repo.itemIds(buildable.map((s) => s.id))
    const all = [...new Set([...stored.values()].flat())]
    const live = all.length === 0 ? [] : await this.questions.getMany(all, 'live')
    const eligible = new Set(live.filter((q) => q.isActive && q.version.status === 'published').map((q) => q.id))
    const out = new Map<string, string[]>()
    for (const s of sets) out.set(s.id, (stored.get(s.id) ?? []).filter((id) => eligible.has(id)))
    return out
  }

  /** `GET /set-soalan-saya`: the sets of the caller's active classes. */
  async listForStudent(actor: ClassActor, at: Date): Promise<QuestionSetStudentItem[]> {
    const classes = await this.classes.forStudent(actor.userId, { isTest: actor.isTest })
    const sets = await this.repo.visibleIn(classes.map((c) => c.id), at)
    if (sets.length === 0) return []
    const [items, teachers] = await Promise.all([
      this.eligibleItems(sets),
      this.classes.userNames(sets.map((s) => s.teacherId)),
    ])
    const used = await this.completedAttempts(actor.userId, sets.filter((x) => x.maxAttempts > 0).map((x) => x.id))
    return sets.map((s) => ({
      id: s.id,
      title: s.title,
      teacherName: teachers.get(s.teacherId) ?? null,
      questionCount: items.get(s.id)?.length ?? 0,
      timeLimitMinutes: s.timeLimitMinutes,
      attemptsLeft: s.maxAttempts === 0 ? null : Math.max(0, s.maxAttempts - (used.get(s.id) ?? 0)),
    }))
  }

  /**
   * Completed question_set sessions of the user per set (the same count BE-12 enforces at start). The practice
   * repository has no batch read, so the lookups run a few at a time instead of one after another.
   */
  private async completedAttempts(userId: string, setIds: readonly string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    for (let i = 0; i < setIds.length; i += ATTEMPT_LOOKUP_CONCURRENCY) {
      await Promise.all(
        setIds.slice(i, i + ATTEMPT_LOOKUP_CONCURRENCY).map(async (id) => {
          const sessions = await this.practice.linkedSessions(userId, 'questionSetId', id)
          out.set(id, sessions.filter((x) => x.status === 'completed').length)
        }),
      )
    }
    return out
  }

  /**
   * The practice adapter's view of one set for one student: null unless the student is an active member of
   * the set's class (real or Mod Pelajar enrolment) and the set is visible at `at`.
   */
  async visibleSetFor(userId: string, id: string, at: Date): Promise<QuestionSetRecord | null> {
    if (!isIdString(id) || !isIdString(userId)) return null
    const set = await this.repo.get(id)
    if (!set || !isVisibleAt(set, at)) return null
    const member = (await this.classes.isMember(set.classroomId, userId, false)) || (await this.classes.isMember(set.classroomId, userId, true))
    return member ? set : null
  }
}
