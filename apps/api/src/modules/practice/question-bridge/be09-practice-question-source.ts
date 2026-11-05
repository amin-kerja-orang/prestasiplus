import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import type { ServabilityActivity } from '@pp/contract'

import { isIdString } from '../../../db/ids'
import { mulberry32, type Prng } from '../../../db/prng'
import { QuestionsRepository } from '../../questions'
import { GROUP_SURFACES, drawUnits, filterOf as servingFilterOf, type DrawCandidate } from '../../questions/serving'
import type { QuestionFilter, QuestionRecord, StimulusGroupRecord } from '../../questions/types'
import { UsersRepository } from '../../users'
import type { PracticeDrillActivity, PracticeQuestion, PracticeQuestionSource, PracticeSelection } from '../ports'
import { PRACTICE_GROUP_SURFACES, versionKey } from '../ports'
import { servableMcq, toPracticeQuestion, tpsOfDifficulty } from './be09-practice-mapping'

const DRILLS: readonly PracticeDrillActivity[] = ['latih_tubi_spm', 'databank', 'bab']

/** A complete group: the stimulus content (`questionIds` narrowed to the SERVABLE members) and those members' records, in group order. */
interface GroupUnit {
  group: StimulusGroupRecord
  members: QuestionRecord[]
}

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
    @Optional() @Inject(PRACTICE_GROUP_SURFACES) private readonly surfaces: readonly ServabilityActivity[] = GROUP_SURFACES,
  ) {}

  /** True when the drill is in the surface list: whole groups and figures are served and counted (D105). */
  private allows(activity: PracticeDrillActivity | undefined): boolean {
    return activity !== undefined && this.surfaces.includes(activity)
  }

  async sample(filter: PracticeSelection, n: number, rng: Prng): Promise<string[]> {
    if (!Number.isSafeInteger(n) || n <= 0) return []
    const f = this.filterOf(filter)
    const grouped = this.allows(activityOf(filter))
    // BE-09 `sample` forces published + active and orders by a seeded hash with a LIMIT, so a wider window keeps the
    // same prefix as long as every window uses the same seed. One child seed from the caller's stream gives each
    // window an identical fresh copy: same seed, same draw. No window ever loads the whole eligible set.
    const seed = rng.int(0, 0xffffffff)
    const out: string[] = []
    const seen = new Set<string>()
    for (let round = 0, limit = Math.min(n * OVER_FETCH, Number.MAX_SAFE_INTEGER); ; round++, limit = Math.min(limit * OVER_FETCH, Number.MAX_SAFE_INTEGER)) {
      const window = await this.questions.sample(f, limit, mulberry32(seed))
      if (grouped) {
        // S1-T06 (DM-27): whole units. The window's servable singles and COMPLETE groups go to `drawUnits` (a group whole or not at
        // all, members contiguous in group order, never past `n`); the same seed gives the same draw.
        const drawn = drawUnits(await this.candidatesOf(window), n, mulberry32(seed))
        if (drawn.length >= n || window.length < limit || limit === Number.MAX_SAFE_INTEGER || round >= MAX_ROUNDS) return drawn
        continue
      }
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
    // Keyset pages of `HYDRATE_MAX` ids (one hydrate round trip each): never a single unbounded read. Not on the port: the
    // planner counts with `chapterCounts` and reads `chapterPage`; this walks a whole chapter (tests, tools).
    const out: string[] = []
    for (let after: string | undefined; ; ) {
      const page = await this.questions.eligibleIdsPage({ chapterId, type: 'mcq', ...(this.allows('bab') ? { wholeGroups: true } : {}) }, after, HYDRATE_MAX)
      if (page.length === 0) break
      const servable = await this.servableIds(page, this.allows('bab'))
      for (const id of page) if (servable.has(id)) out.push(id)
      after = page[page.length - 1]
      if (page.length < HYDRATE_MAX) break
    }
    return out
  }

  async chapterCounts(chapterIds: readonly string[], exact = false): Promise<ReadonlyMap<string, number>> {
    const wanted = [...new Set(chapterIds)].filter(isIdString)
    if (wanted.length === 0) return new Map()
    // Cheap form: eligible plain MCQs (the loader writes single-part MCQs only). `exact` adds the per-row shape check.
    // The shape of the chapter draw (`filterOf('bab')`): whole groups and figures on a surface that allows them, else ungrouped and text only.
    const { mcqShape, ...cheap } = servingFilterOf('bab', {}, this.surfaces)
    return this.questions.groupCount('chapter', { chapterIds: wanted, ...cheap, ...(exact && mcqShape ? { mcqShape } : {}), status: 'approved', active: true })
  }

  async chapterPage(chapterId: string, excludeIds: readonly string[], limit: number): Promise<string[]> {
    if (!isIdString(chapterId) || !Number.isSafeInteger(limit) || limit <= 0) return []
    const exclude = excludeIds.filter(isIdString)
    const excluded = new Set(exclude)
    const grouped = this.allows('bab')
    const out: string[] = []
    const emitted = new Set<string>()
    let after: string | undefined
    // Keyset pages of the chapter; ids the hydration refuses (`servableMcq`) are skipped and the next page read.
    while (out.length < limit) {
      const page = await this.questions.eligibleIdsPage({ ...servingFilterOf('bab', { chapterId }, this.surfaces), excludeIds: exclude }, after, Math.max(limit, 50))
      if (page.length === 0) break
      after = page[page.length - 1]
      if (grouped) {
        // A unit is a single question or a WHOLE group: a group with a member already answered, or one that would pass `limit`, is skipped.
        const { records, groups } = await this.servableRecords(page)
        for (const id of page) {
          const r = records.get(id)
          if (r === undefined) continue
          if (r.groupId === null) {
            if (out.length < limit) out.push(id)
            continue
          }
          const unit = groups.get(r.groupId)
          if (unit === undefined || emitted.has(r.groupId)) continue
          emitted.add(r.groupId)
          const ids = unit.members.map((m) => m.id)
          if (ids.some((m) => excluded.has(m)) || out.length + ids.length > limit) continue
          out.push(...ids)
        }
      } else {
        const servable = await this.servableIds(page)
        for (const id of page) if (out.length < limit && servable.has(id)) out.push(id)
      }
      if (page.length < Math.max(limit, 50)) break
    }
    return out
  }

  async live(ids: readonly string[], activity?: PracticeDrillActivity): Promise<ReadonlyMap<string, PracticeQuestion>> {
    const wanted = [...new Set(ids)].filter(isIdString)
    if (wanted.length === 0) return new Map()
    if (this.allows(activity)) {
      // S1-T06: figures and whole groups. A member of a group with a member that cannot be served is dropped with the whole group.
      const { records, groups } = await this.servableRecords(wanted)
      return this.mapServable([...records.values()], (r) => r.id, true, groups)
    }
    const records = (await this.questions.getMany(wanted, 'live')).filter(eligible)
    return this.mapAll(records, (r) => r.id)
  }

  async spmServable(ids: readonly string[]): Promise<ReadonlySet<string>> {
    const wanted = [...new Set(ids)].filter(isIdString)
    return wanted.length === 0 ? new Set() : new Set(await this.questions.eligibleAmong(wanted, { spmPool: true }))
  }

  /** Pinned grading read only: never a serving path (it skips the active, published and PKSK scope). */
  async versions(refs: readonly { questionId: string; versionNo: number }[]): Promise<ReadonlyMap<string, PracticeQuestion>> {
    const wanted = refs.filter((r) => isIdString(r.questionId) && Number.isSafeInteger(r.versionNo) && r.versionNo >= 1)
    if (wanted.length === 0) return new Map()
    const records = await this.questions.getVersions(wanted)
    // Grading a version a session already served: once a drill joins the set it may have been served as a figure or a group member.
    return this.mapAll(records, (r) => versionKey(r.id, r.version.versionNo), DRILLS.some((a) => this.allows(a)))
  }

  // --- internals ------------------------------------------------------------------------------------

  /**
   * The BE-09 filter of a practice draw. Published + active are forced by `sample` itself. The shape comes from the questions
   * serving filter of the draw's activity (`filterOf`), so the draw, the counts and the indicator share one definition: whole groups
   * and figures when the activity is in the surface list, else ungrouped and text only (today).
   */
  private filterOf(s: PracticeSelection): QuestionFilter {
    const shape = { ...servingFilterOf(activityOf(s), { subjectId: s.subjectId }, this.surfaces) }
    delete shape.spmPool
    return {
      ...shape,
      ...(s.educationLevelIds !== undefined ? { educationLevelIds: s.educationLevelIds } : {}),
      ...(s.difficulty !== undefined ? { difficultyTps: tpsOfDifficulty(s.difficulty) } : {}),
      ...(s.spmPool ? { spmPool: true } : {}),
    }
  }

  /**
   * Loads `ids` at their live version and keeps the servable ones on a surface that allows groups and figures. A group member is
   * kept only when its WHOLE group is: every eligible member of the group must pass the shape check and the group must hold a
   * stimulus (the same rule as `wholeGroups` in SQL, plus the per-record shape), else the whole group is out.
   */
  private async servableRecords(ids: readonly string[]): Promise<{ records: Map<string, QuestionRecord>; groups: Map<string, GroupUnit> }> {
    const records = new Map<string, QuestionRecord>()
    const groups = new Map<string, GroupUnit>()
    const loaded: QuestionRecord[] = []
    for (let i = 0; i < ids.length; i += HYDRATE_MAX) loaded.push(...(await this.questions.getMany(ids.slice(i, i + HYDRATE_MAX), 'live')).filter(eligible))
    const groupIds = [...new Set(loaded.flatMap((r) => (r.groupId === null ? [] : [r.groupId])))]
    if (groupIds.length > 0) {
      const have = new Map(loaded.map((r) => [r.id, r]))
      const defs = await this.questions.groupsByIds(groupIds)
      const missing = [...new Set(defs.flatMap((g) => g.questionIds).filter((id) => !have.has(id)))]
      for (let i = 0; i < missing.length; i += HYDRATE_MAX) {
        for (const r of (await this.questions.getMany(missing.slice(i, i + HYDRATE_MAX), 'live')).filter(eligible)) have.set(r.id, r)
      }
      for (const g of defs) {
        const eligibleMembers = g.questionIds.flatMap((id) => (have.has(id) ? [have.get(id) as QuestionRecord] : []))
        const members = eligibleMembers.filter((m) => this.check(m, true))
        if (g.stimuli.length > 0 && members.length > 0 && members.length === eligibleMembers.length) {
          groups.set(g.id, { group: { ...g, questionIds: members.map((m) => m.id) }, members })
        }
      }
    }
    for (const r of loaded) {
      if (r.groupId !== null && !groups.has(r.groupId)) continue
      if (this.check(r, true)) records.set(r.id, r)
    }
    return { records, groups }
  }

  /** The `drawUnits` candidates of a window of ids: servable singles and the members of complete groups, each with its group size. */
  private async candidatesOf(ids: readonly string[]): Promise<DrawCandidate[]> {
    const { records, groups } = await this.servableRecords(ids)
    const out: DrawCandidate[] = []
    const seen = new Set<string>()
    for (const r of records.values()) {
      if (r.groupId === null) {
        out.push({ id: r.id, groupId: null, groupPosition: null })
        continue
      }
      const unit = groups.get(r.groupId)
      if (unit === undefined || seen.has(r.groupId)) continue
      seen.add(r.groupId)
      for (const m of unit.members) out.push({ id: m.id, groupId: r.groupId, groupPosition: m.groupPosition, groupSize: unit.members.length })
    }
    return out
  }

  /**
   * The ids among `ids` whose live version is eligible and servable now. One `getMany` (one hydrate round
   * trip) per `HYDRATE_MAX` ids, so a typical draw window or chapter is a single round trip.
   */
  private async servableIds(ids: readonly string[], allowStimulus = false): Promise<Set<string>> {
    if (allowStimulus) return new Set((await this.servableRecords(ids)).records.keys())
    const out = new Set<string>()
    for (let i = 0; i < ids.length; i += HYDRATE_MAX) {
      const records = await this.questions.getMany(ids.slice(i, i + HYDRATE_MAX), 'live')
      for (const r of records) if (eligible(r) && this.check(r)) out.add(r.id)
    }
    return out
  }

  /** `servableMcq`, logging a refusal once per version with the id and reason only (never content or the key). */
  private check(r: QuestionRecord, allowStimulus = false): boolean {
    const m = servableMcq(r, { allowStimulus })
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

  private mapAll(records: QuestionRecord[], keyOf: (r: QuestionRecord) => string, allowStimulus = false): Promise<Map<string, PracticeQuestion>> {
    return this.mapServable(
      records.filter((r) => this.check(r, allowStimulus)),
      keyOf,
      allowStimulus,
      new Map(),
    )
  }

  private async mapServable(servable: QuestionRecord[], keyOf: (r: QuestionRecord) => string, allowStimulus: boolean, groups: ReadonlyMap<string, GroupUnit>): Promise<Map<string, PracticeQuestion>> {
    const contributors = await this.contributorsOf(servable)
    const out = new Map<string, PracticeQuestion>()
    for (const r of servable) {
      const group = r.groupId === null ? null : (groups.get(r.groupId)?.group ?? null)
      const q = toPracticeQuestion(r, r.createdById ? (contributors.get(r.createdById) ?? null) : null, { allowStimulus, group })
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
const eligible = (r: QuestionRecord): boolean => r.isActive && r.version.status === 'approved'

/** The drill surface of a selection (`PracticeSelection.activity`, else Latih Tubi SPM for the SPM pool, Databank for the rest). */
const activityOf = (s: PracticeSelection): PracticeDrillActivity => s.activity ?? (s.spmPool ? 'latih_tubi_spm' : 'databank')
