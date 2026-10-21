import { Inject, Injectable, Logger } from '@nestjs/common'

import { isIdString } from '../../../db/ids'
import type { Prng } from '../../../db/prng'
import { QuestionsRepository } from '../../questions'
import type { QuestionFilter, QuestionRecord } from '../../questions/types'
import { UsersRepository } from '../../users'
import type { PracticeQuestion, PracticeQuestionSource, PracticeSelection } from '../ports'
import { versionKey } from '../ports'
import { servableMcq, toPracticeQuestion, tpsOfDifficulty } from './be09-practice-mapping'

/** Ids hydrated per round while `sample` / `chapterQuestionIds` look for servable questions. */
const BATCH = 100

/**
 * BE-12 `PracticeQuestionSource` backed by the BE-09 question bank (M04). It reads ONLY through BE-09's
 * exported `QuestionsRepository` (`sample`, `eligibleIds`, `getMany(ids, 'live')`, `getVersions`) and
 * M01's `UsersRepository` (contributor name); it never queries the question tables itself (ADR-0014, D12).
 *
 * Eligibility (LEAD decision Q-2): the LIVE version is `published` AND the question `is_active`. That is
 * the only visibility scope the bank has: a published question is public to every learner (there is no
 * school or owner column that narrows serving), and a draft, review, approved or archived version, or a
 * deactivated question, is never served. On top of that practice serves only versions `servableMcq`
 * accepts (one text-only MCQ leaf, no stimulus), so every id `sample` / `chapterQuestionIds` returns is
 * one `live` will serve: a draw never comes up short because of an unservable id, and a chapter's
 * completeness (BR-16) never counts a question that can never be served.
 *
 * `versions` is a pinned read (OD-28, AC 11): the exact version a session served, without re-checking
 * eligibility, so a later edit, unpublish or deactivation never changes how an open session is graded.
 */
@Injectable()
export class Be09PracticeQuestionSource implements PracticeQuestionSource {
  private readonly logger = new Logger(Be09PracticeQuestionSource.name)

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  async sample(filter: PracticeSelection, n: number, rng: Prng): Promise<string[]> {
    if (!Number.isSafeInteger(n) || n <= 0) return []
    // BE-09 `sample` forces published + active and shuffles the WHOLE eligible list (Fisher-Yates over the
    // ascending ids with `rng`), so the same seed gives the same order. Walk it until `n` are servable.
    const shuffled = await this.questions.sample(this.filterOf(filter), Number.MAX_SAFE_INTEGER, rng)
    const out: string[] = []
    for (let i = 0; i < shuffled.length && out.length < n; i += BATCH) {
      const chunk = shuffled.slice(i, i + BATCH)
      const servable = await this.servableIds(chunk)
      for (const id of chunk) {
        if (out.length >= n) break
        if (servable.has(id)) out.push(id)
      }
    }
    return out
  }

  async chapterQuestionIds(chapterId: string): Promise<string[]> {
    if (!isIdString(chapterId)) return []
    const ids = await this.questions.eligibleIds({ chapterId, type: 'mcq' })
    const out: string[] = []
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH)
      const servable = await this.servableIds(chunk)
      out.push(...chunk.filter((id) => servable.has(id)))
    }
    return out
  }

  async live(ids: readonly string[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    const wanted = [...new Set(ids)].filter(isIdString)
    if (wanted.length === 0) return new Map()
    const records = (await this.questions.getMany(wanted, 'live')).filter(eligible)
    return this.mapAll(records, (r) => r.id)
  }

  async versions(refs: readonly { questionId: string; versionNo: number }[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    const wanted = refs.filter((r) => isIdString(r.questionId) && Number.isSafeInteger(r.versionNo) && r.versionNo >= 1)
    if (wanted.length === 0) return new Map()
    const records = await this.questions.getVersions(wanted)
    return this.mapAll(records, (r) => versionKey(r.id, r.version.versionNo))
  }

  // --- internals ------------------------------------------------------------------------------------

  /** The BE-09 filter of a practice draw. Published + active are forced by `sample` itself. */
  private filterOf(s: PracticeSelection): QuestionFilter {
    return {
      subjectId: s.subjectId,
      type: 'mcq',
      ...(s.educationLevelIds !== undefined ? { educationLevelIds: s.educationLevelIds } : {}),
      ...(s.difficulty !== undefined ? { difficultyTps: tpsOfDifficulty(s.difficulty) } : {}),
      ...(s.spmPool ? { spmPool: true } : {}),
    }
  }

  /** The ids among `ids` whose live version is eligible and servable now. */
  private async servableIds(ids: readonly string[]): Promise<Set<string>> {
    const records = await this.questions.getMany(ids, 'live')
    return new Set(records.filter((r) => eligible(r) && this.check(r)).map((r) => r.id))
  }

  /** `servableMcq`, logging a refusal with the id and reason only (never content or the key). */
  private check(r: QuestionRecord): boolean {
    const m = servableMcq(r)
    if (!m.ok) this.logger.warn(`Question ${r.id} v${String(r.version.versionNo)} not served to practice: ${m.reason}`)
    return m.ok
  }

  private async mapAll(records: QuestionRecord[], keyOf: (r: QuestionRecord) => string): Promise<Map<string, PracticeQuestion>> {
    const servable = records.filter((r) => this.check(r))
    const contributors = await this.contributorsOf(servable)
    const out = new Map<string, PracticeQuestion>()
    for (const r of servable) {
      const q = toPracticeQuestion(r, r.createdById ? (contributors.get(r.createdById) ?? null) : null)
      if (q) out.set(keyOf(r), q)
    }
    return out
  }

  /** "Soalan oleh:": the creator when they hold the teacher role; `profileUrl` is null (contract). */
  private async contributorsOf(records: readonly QuestionRecord[]): Promise<Map<string, NonNullable<PracticeQuestion['contributor']>>> {
    const ids = [...new Set(records.flatMap((r) => (r.createdById ? [r.createdById] : [])))]
    const out = new Map<string, NonNullable<PracticeQuestion['contributor']>>()
    if (ids.length === 0) return out
    for (const u of await this.users.getMany(ids)) {
      const name = u.name.trim()
      if (u.roles.includes('teacher') && name !== '') out.set(u.id, { name, profileUrl: null })
    }
    return out
  }
}

/** Q-2: the live version is published and the question is active. */
const eligible = (r: QuestionRecord): boolean => r.isActive && r.version.status === 'published'
