import { Inject, Injectable, Logger } from '@nestjs/common'

import { isIdString } from '../../../db/ids'
import { mulberry32, type Prng } from '../../../db/prng'
import { QuestionsRepository } from '../../questions'
import type { QuestionFilter, QuestionRecord } from '../../questions/types'
import { UsersRepository } from '../../users'
import type { PracticeQuestion, PracticeQuestionSource, PracticeSelection } from '../ports'
import { versionKey } from '../ports'
import { servableMcq, toPracticeQuestion, tpsOfDifficulty } from './be09-practice-mapping'

/** Most ids hydrated in one `getMany` call (one hydrate round trip); `hydratePicks` binds 2 parameters per id. */
const HYDRATE_MAX = 500
/** `sample` asks the bank for `n * OVER_FETCH` ids, and widens by the same factor while the draw comes up short. */
export const OVER_FETCH = 4
/** Windows one `sample` reads at most (each is a LIMIT-ed SQL draw, the last of `n * 4^MAX_ROUNDS` ids). */
const MAX_ROUNDS = 4
/** Refusals logged once per question version; the memory is bounded (cleared when full). */
const LOGGED_MAX = 10_000

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
 * It is for grading an already-served version ONLY and must never feed a serving path (`sample`,
 * `chapterQuestionIds`, `live`): it skips the active, published and PKSK scope.
 */
@Injectable()
export class Be09PracticeQuestionSource implements PracticeQuestionSource {
  private readonly logger = new Logger(Be09PracticeQuestionSource.name)
  private readonly logged = new Set<string>()

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  async sample(filter: PracticeSelection, n: number, rng: Prng): Promise<string[]> {
    if (!Number.isSafeInteger(n) || n <= 0) return []
    const f = this.filterOf(filter)
    // BE-09 `sample` forces published + active and orders by a seeded hash with a LIMIT, so a wider window keeps the
    // same prefix as long as every window uses the same seed. One child seed from the caller's stream gives each
    // window an identical fresh copy: same seed, same draw. No window ever loads the whole eligible set.
    const seed = rng.int(0, 0xffffffff)
    const out: string[] = []
    const seen = new Set<string>()
    for (let round = 0, limit = Math.min(n * OVER_FETCH, Number.MAX_SAFE_INTEGER); ; round++, limit = Math.min(limit * OVER_FETCH, Number.MAX_SAFE_INTEGER)) {
      const window = await this.questions.sample(f, limit, mulberry32(seed))
      // Only ids not already checked (a concurrent publish can shift the window; never serve one twice).
      const fresh = window.filter((id) => !seen.has(id))
      for (const id of fresh) seen.add(id)
      const servable = await this.servableIds(fresh)
      for (const id of fresh) {
        if (out.length >= n) break
        if (servable.has(id)) out.push(id)
      }
      // Done when the draw is full, or the bank had no more eligible ids than this window asked for.
      if (out.length >= n || window.length < limit || limit === Number.MAX_SAFE_INTEGER || round >= MAX_ROUNDS) return out
    }
  }

  async chapterQuestionIds(chapterId: string): Promise<string[]> {
    if (!isIdString(chapterId)) return []
    const ids = await this.questions.eligibleIds({ chapterId, type: 'mcq' })
    const servable = await this.servableIds(ids)
    return ids.filter((id) => servable.has(id))
  }

  async chapterCounts(chapterIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const wanted = [...new Set(chapterIds)].filter(isIdString)
    if (wanted.length === 0) return new Map()
    // The SQL scope is the servable shape (one MCQ, no group); loaded questions are single-part MCQ by construction.
    return this.questions.groupCount('chapter', { chapterIds: wanted, type: 'mcq', ungrouped: true, status: 'published', active: true })
  }

  async chapterPage(chapterId: string, excludeIds: readonly string[], limit: number): Promise<string[]> {
    if (!isIdString(chapterId) || !Number.isSafeInteger(limit) || limit <= 0) return []
    const exclude = excludeIds.filter(isIdString)
    const out: string[] = []
    let after: string | undefined
    // Keyset pages of the chapter; ids the hydration refuses (`servableMcq`) are skipped and the next page read.
    while (out.length < limit) {
      const page = await this.questions.eligibleIdsPage({ chapterId, type: 'mcq', ungrouped: true, excludeIds: exclude }, after, Math.max(limit, 50))
      if (page.length === 0) break
      after = page[page.length - 1]
      const servable = await this.servableIds(page)
      for (const id of page) if (out.length < limit && servable.has(id)) out.push(id)
      if (page.length < Math.max(limit, 50)) break
    }
    return out
  }

  async live(ids: readonly string[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    const wanted = [...new Set(ids)].filter(isIdString)
    if (wanted.length === 0) return new Map()
    const records = (await this.questions.getMany(wanted, 'live')).filter(eligible)
    return this.mapAll(records, (r) => r.id)
  }

  /** Pinned grading read only: never a serving path (it skips the active, published and PKSK scope). */
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

  /**
   * The ids among `ids` whose live version is eligible and servable now. One `getMany` (one hydrate round
   * trip) per `HYDRATE_MAX` ids, so a typical draw window or chapter is a single round trip.
   */
  private async servableIds(ids: readonly string[]): Promise<Set<string>> {
    const out = new Set<string>()
    for (let i = 0; i < ids.length; i += HYDRATE_MAX) {
      const records = await this.questions.getMany(ids.slice(i, i + HYDRATE_MAX), 'live')
      for (const r of records) if (eligible(r) && this.check(r)) out.add(r.id)
    }
    return out
  }

  /** `servableMcq`, logging a refusal once per version with the id and reason only (never content or the key). */
  private check(r: QuestionRecord): boolean {
    const m = servableMcq(r)
    if (!m.ok) {
      const key = versionKey(r.id, r.version.versionNo)
      if (!this.logged.has(key)) {
        if (this.logged.size >= LOGGED_MAX) this.logged.clear()
        this.logged.add(key)
        this.logger.warn(`Question ${r.id} v${String(r.version.versionNo)} not served to practice: ${m.reason}`)
      }
    }
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
