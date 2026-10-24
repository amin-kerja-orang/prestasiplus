/**
 * Thin adapters over the owners' exported services (ADR-0014): the ONLY file of the battle module that talks to
 * users/schools (BE-05), curriculum (BE-08) and questions (BE-09). Feature code (queue, arena,
 * standings, tournaments) injects `BattleDeps` and never an owner repository. Ids are decimal strings.
 *
 * Fallbacks where an owner exports no fitting read (listed for the lead; no owner module was edited):
 *  1. Active students (bot pick, search): `UsersRepository.search` (name/e-mail substring, name A-Z) with an empty or
 *     name term, capped at `STUDENT_POOL_CAP`; the filters (active, not suspended, grade, school) run here. A direct
 *     `activeStudents({grade, schoolId, excludeIds, limit})` read in BE-05 would remove the cap.
 *  2. SPM pool: the `spmPool` filter of `QuestionFilter`: the size is one SQL count and a draw is `sampleIds` (no id list).
 *  3. Arena question and key: `flatFromVersion` from `questions/projection` (not in the questions index) gives text,
 *     options and the key index of a one-leaf MCQ.
 *  4. Platform answer accuracy: BE-12 exports only per-user reads (`PracticeRepository.answers(userId)`), no platform
 *     total (so no `PracticeRepository` is injected here). `platformAccuracy()` returns 0 (the SRS value for "no answers"), so bots answer wrong until BE-12 adds one.
 *  5. Avatar: no owner serves a user avatar yet; `avatar` is always null.
 *  5b. OPEN QUESTION for the lead: BE-05 should export a bounded read of active students (grade, school, exclude ids,
 *     limit). Until then the read in 1 and the pool count in 2 are cached in process for
 *     `CACHE_TTL_MS` (read through the Clock) so polls and the lobby do not rescan the tables; `invalidateCache()` is for tests.
 *  6. PKSK: no owner serves PKSK domains or tagged questions (Open question 6): `pkskDomains()` is `[]` and a PKSK
 *     draw returns `null` (callers answer 422 `{}`).
 */
import { Inject, Injectable } from '@nestjs/common'
import type { AuthContext } from '../../common/scope/auth-context'
import { CLOCK, type Clock } from '../../db/clock'
import type { Prng } from '../../db/prng'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { ClassesRepository } from '../classes'
import { CurriculumRepository } from '../curriculum'
import { type QuestionFilter, QuestionsRepository } from '../questions'
import { flatFromVersion } from '../questions/projection'
import { SchoolsRepository } from '../schools'
import { UsersRepository, type UserRecord } from '../users'
import type { Caller } from '../users/caller'

/** Most users one student read looks at (see fallback 1). */
export const STUDENT_POOL_CAP = 5000
/** Student pool and SPM pool reads are reused this long (see 5b). */
export const CACHE_TTL_MS = 60_000

/**
 * What the arena can serve and grade: a plain MCQ (no group, one part, no stimulus) with 2 to 4 text options, so the key index is
 * always 0..3 (`ARENA_OPTIONS`, `projection.ts` `correctAnswer`). A 5 to 8 option question never enters a battle draw or count.
 */
const BATTLE_POOL = { type: 'mcq', ungrouped: true, mcqShape: { minOptions: 2, maxOptions: 4 } } as const satisfies QuestionFilter
/** Rows read by the name search before the active / not-suspended filter (the caller sees at most `limit`). */
const SEARCH_OVER_READ = 40
const ARENA_OPTIONS = 4
const LABELS = ['A', 'B', 'C', 'D'] as const

export interface BattleStudent {
  id: string
  name: string
  schoolId: string | null
  schoolName: string | null
  grade: number | null
  avatar: string | null
}

export interface BattleSubject {
  id: string
  code: string
  name: string
  core: boolean
  /** Glyph name or emoji, null when the subject has none (lobby only). */
  icon: string | null
  /** `#RRGGBB` (lobby only). */
  colour: string
}

export interface BattleSchool {
  id: string
  name: string
  state: string | null
  type: string | null
  /** The PPD / district name as the owner stores it. */
  district: string | null
}

export interface StudentFilter {
  /** Only students of this grade. */
  grade?: number
  /** Only students of this school. */
  schoolId?: string
  /** Not students of this school (a student without a school is excluded too, as the mock requires a school). */
  notSchoolId?: string
  excludeIds?: ReadonlySet<string>
}

export interface PoolSpec {
  questionType: 'biasa' | 'pksk' | 'spm'
  subjectId: string | null
  /** The queue owner's education level id (biasa only). */
  levelId: string | null
}

export interface ArenaQuestionView {
  id: string
  text: string
  /** At most four, no key. */
  options: { id: number; label: string; text: string }[]
}

@Injectable()
export class BattleDeps {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>()

  /**
   * Runs `read` unless the same key was read less than `CACHE_TTL_MS` ago (Clock time). The PROMISE is cached (single flight):
   * concurrent callers after the TTL share one read, and a failed read is dropped so the next caller retries.
   */
  private cached<T>(key: string, read: () => Promise<T>): Promise<T> {
    const now = this.clock.now().getTime()
    const hit = this.cache.get(key)
    if (hit && now - hit.at < CACHE_TTL_MS && now >= hit.at) return hit.value as Promise<T>
    const value = read()
    const entry = { at: now, value }
    this.cache.set(key, entry)
    value.catch(() => {
      if (this.cache.get(key) === entry) this.cache.delete(key)
    })
    return value
  }

  /** Forgets every cached read (tests that change users or questions behind the service). */
  invalidateCache(): void {
    this.cache.clear()
  }

  // --- students (BE-05, BE-06 schools) ---------------------------------------------------------------

  private isActiveStudent(u: UserRecord): boolean {
    return u.roles.includes('student') && u.isActive && !u.isSuspended
  }

  private async toStudents(rows: readonly UserRecord[]): Promise<BattleStudent[]> {
    const ids = [...new Set(rows.flatMap((r) => (r.schoolId === null ? [] : [r.schoolId])))]
    const names = new Map((await this.schools.getMany(ids)).map((s) => [s.id, s.name]))
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      schoolId: r.schoolId,
      schoolName: r.schoolId === null ? null : (names.get(r.schoolId) ?? null),
      grade: r.grade,
      avatar: null,
    }))
  }

  /** One student (any state is "not found" unless active), with the CURRENT school. */
  async student(id: string): Promise<BattleStudent | null> {
    const u = await this.users.get(id)
    if (!u || !this.isActiveStudent(u)) return null
    return (await this.toStudents([u]))[0] ?? null
  }

  /** Display data of users by id (any role/state: history shows past opponents). Unknown ids are omitted. */
  async players(ids: readonly string[]): Promise<Map<string, BattleStudent>> {
    const rows = await this.users.getMany(ids)
    const students = await this.toStudents(rows)
    return new Map(students.map((s) => [s.id, s]))
  }

  /** Active students, name A-Z then id (deterministic), after the filters. For the bot pick. */
  async activeStudents(filter: StudentFilter = {}, limit: number = STUDENT_POOL_CAP): Promise<BattleStudent[]> {
    const rows = await this.cached(`students:${filter.schoolId ?? '*'}`, () =>
      this.users.search({ q: '', role: 'student', ...(filter.schoolId === undefined ? {} : { schoolId: filter.schoolId }), limit: STUDENT_POOL_CAP }),
    )
    const kept = rows.filter(
      (u) =>
        this.isActiveStudent(u) &&
        (filter.grade === undefined || u.grade === filter.grade) &&
        (filter.notSchoolId === undefined || (u.schoolId !== null && u.schoolId !== filter.notSchoolId)) &&
        !(filter.excludeIds?.has(u.id) ?? false),
    )
    return this.toStudents(kept.slice(0, limit))
  }

  /**
   * M16-07 search: active students whose NAME contains `q` (case-insensitive), not `excludeId`, name A-Z (`ms` collation)
   * then id. A bounded database read (`searchStudentsByName`, name only) with a national read scope; the active /
   * not-suspended / student check runs on the rows it returns.
   */
  async searchStudents(q: string, excludeId: string, limit: number): Promise<BattleStudent[]> {
    const everyone = { auth: { active: { scope: { level: 'national' } } } as unknown as AuthContext, userId: excludeId, role: 'admin', schoolId: null, isAdmin: true, requestId: null, ip: null } satisfies Caller
    const found = await this.users.searchStudentsByName(everyone, q, limit + SEARCH_OVER_READ)
    const full = await this.users.getMany(found.filter((r) => r.id !== excludeId).map((r) => r.id))
    const kept = full.filter((u) => this.isActiveStudent(u))
    kept.sort((a, b) => a.name.localeCompare(b.name, 'ms') || (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    return this.toStudents(kept.slice(0, limit))
  }

  /** The caller's grade (1..11) or null. */
  async gradeOf(userId: string): Promise<number | null> {
    return (await this.users.get(userId))?.grade ?? null
  }

  async school(id: string): Promise<BattleSchool | null> {
    const s = await this.schools.get(id)
    return s ? { id: s.id, name: s.name, state: s.state, type: s.type, district: s.district } : null
  }

  async schoolsByIds(ids: readonly string[]): Promise<Map<string, BattleSchool>> {
    const rows = await this.schools.getMany([...new Set(ids)])
    return new Map(rows.map((s) => [s.id, { id: s.id, name: s.name, state: s.state, type: s.type, district: s.district }]))
  }

  /** Pupil ids in the active classes of a teacher (BE-17 `forTeacher` + `memberIdsOf`: two batched reads). For the children's names rule. */
  async ownPupilIdsOfTeacher(teacherId: string): Promise<Set<string>> {
    const classes = (await this.classes.forTeacher(teacherId)).filter((c) => c.isActive)
    const rosters = await this.classes.memberIdsOf(classes.map((c) => c.id))
    return new Set([...rosters.values()].flat())
  }

  // --- curriculum (BE-08) ------------------------------------------------------------------------------

  /** Active subjects with the `core` flag (Open question 4: the battle subject set is what BE-08 serves). */
  async subjects(): Promise<BattleSubject[]> {
    const rows = await this.curriculum.subjects({ active: true })
    return rows.map((s) => ({ id: idToString(s.id), code: s.code, name: s.name, core: s.isCore, icon: s.icon, colour: s.color }))
  }

  async subject(id: string): Promise<BattleSubject | null> {
    if (!isIdString(id)) return null
    const s = await this.curriculum.subject(idFromString(id))
    return s && s.isActive ? { id: idToString(s.id), code: s.code, name: s.name, core: s.isCore, icon: s.icon, colour: s.color } : null
  }

  /** The education level id of a grade (BR-M16-02), or null. */
  async levelIdOfGrade(grade: number | null): Promise<string | null> {
    if (grade === null) return null
    const level = await this.curriculum.levelForGrade(grade)
    return level ? idToString(level.id) : null
  }

  // --- questions (BE-09) -------------------------------------------------------------------------------

  /** Size of the SPM pool of a subject (lobby `spmSubjects`, start check): one SQL count, cached `CACHE_TTL_MS`. */
  async spmPoolCount(subjectId: string): Promise<number> {
    return this.cached(`spm-count:${subjectId}`, () =>
      this.questions.count({ ...BATTLE_POOL, subjectId, spmPool: true, status: 'published', active: true }),
    )
  }

  /** PKSK domains served by an owner: none yet (Open question 6). */
  pkskDomains(): { id: string; name: string }[] {
    return []
  }

  /**
   * Draws `n` eligible keyless MCQ ids (pool rule `battle-pool.ts poolFilter`): biasa = published MCQ of the subject at
   * the owner's level; spm = SPM pool MCQ of the subject; pksk = unsupported. Drawn in SQL (`sampleIds`: seeded hash order,
   * LIMIT `n`), so a seeded stream gives the same ids and memory stays O(n). `null` when fewer than `n` can be drawn.
   */
  async drawQuestions(spec: PoolSpec, n: number, rng: Prng): Promise<string[] | null> {
    if (spec.questionType === 'pksk' || spec.subjectId === null) return null
    if (!Number.isSafeInteger(n) || n <= 0) return n === 0 ? [] : null
    const filter: QuestionFilter =
      spec.questionType === 'spm'
        ? { ...BATTLE_POOL, subjectId: spec.subjectId, spmPool: true }
        : { ...BATTLE_POOL, subjectId: spec.subjectId, ...(spec.levelId === null ? {} : { educationLevelId: spec.levelId }) }
    const ids = await this.questions.sampleIds(filter, n, rng.int(0, 0xffffffff))
    return ids.length < n ? null : ids
  }

  /** The question as the arena serves it: text and up to four options, NEVER the key. */
  async arenaQuestion(id: string): Promise<ArenaQuestionView | null> {
    const record = await this.questions.get(id, 'live')
    if (!record) return null
    const flat = flatFromVersion(record.version)
    if (flat.questionType !== 'mcq' || flat.options === null) return null
    return {
      id: record.id,
      text: flat.questionText,
      options: flat.options.slice(0, ARENA_OPTIONS).map((text, i) => ({ id: i, label: LABELS[i] ?? '', text })),
    }
  }

  /** Grades one arena answer (`optionId` 0..3, or null for a timeout). Null when the question has no usable key. */
  async gradeAnswer(id: string, optionId: number | null): Promise<{ correct: boolean; correctOptionId: number } | null> {
    const record = await this.questions.get(id, 'live')
    if (!record) return null
    const flat = flatFromVersion(record.version)
    if (flat.questionType !== 'mcq' || flat.correctAnswer === null) return null
    return { correct: optionId !== null && optionId === flat.correctAnswer, correctOptionId: flat.correctAnswer }
  }

  // --- practice (BE-12) --------------------------------------------------------------------------------

  /** Platform answer accuracy p in [0, 1] for the bot's answers (fallback 4: 0 until BE-12 exports a platform total; the caller reads it once per process start). */
  async platformAccuracy(): Promise<number> {
    return 0
  }
}
