/**
 * Ports other cards implement for the Bijak papers module. M28 never reads another owner's tables:
 * questions belong to M04 (BE-09) and attempts to BE-16 (D12, ADR-0014). Every port has a default so
 * the module works before those cards merge.
 *
 * - `BijakQuestionSource` (BE-09): marks, group and version of placed questions, and the eligible
 *   pool of a blueprint section. Default: the PoC fixture (`poc-question-source.ts`), which serves
 *   the reserved PoC question ids. WIRE-UP (main session, after BE-09): provide a `QuestionsService`
 *   backed implementation with `ports.provideQuestionSource(...)` from the question module's
 *   `onModuleInit` (the `CurriculumPorts` pattern). Nothing else changes.
 * - `BijakProgressSource` (BE-16): per-user progress on a paper (in-progress attempt, last score).
 *   Default: "never started".
 * - `BijakServedSource` (BE-16): the question ids the user has been served before (the mock's `seen`
 *   set, built from the user's attempts). Default: none.
 *
 * ```ts
 * @Module({ imports: [BijakPapersModule], providers: [AttemptProgress] })
 * export class BijakAttemptsModule implements OnModuleInit {
 *   constructor(private readonly ports: BijakPapersPorts, private readonly progress: AttemptProgress) {}
 *   onModuleInit() { this.ports.provideProgress(this.progress); this.ports.provideServed(this.progress) }
 * }
 * ```
 */
import { Injectable } from '@nestjs/common'

import { PocPoolSource } from './poc-pool-source'
import { PocQuestionSource } from './poc-question-source'
import type { BijakPoolSource } from './pool-source'

export interface BijakQuestionInfo {
  /** Decimal-string question id. */
  id: string
  /** Marks of the question: the sum of its leaf marks (an MCQ carries its mark on its key). Never the answer. */
  marks: number
  /** Stimulus group the question belongs to, or null. */
  groupId: string | null
  /** The published version number (printed on the paper, `paper_placements.pinned_version_no`). */
  versionNo: number
  /**
   * True when the question has a part that is not marked automatically (a mark-scheme-points or rubric part: a person
   * marks it). Absent means false. Feeds the cover's examiner grid (AC-20.3).
   */
  manual?: boolean
}

export interface BijakPoolScope {
  /** Curriculum subject row (M03) of the blueprint. */
  subjectId: string
  /** Curriculum subject code (MATH, SCI, SEJ ...). */
  subjectCode: string
  kertas: number
}

export interface BijakPool {
  /** Eligible questions of the pool tag in published order: published (D54a), active, tagged with the pool. */
  entries: { questionId: string; groupId?: string }[]
  /** Group id -> member question ids in published order (members may lie outside the pool: that group is skipped). */
  groups: ReadonlyMap<string, readonly string[]>
}

export interface BijakQuestionSource {
  /** Info per id; an id that does not exist is absent from the map. */
  getMany(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>>
  /** The eligible pool a blueprint section draws from (`blueprint_sections.pool`). */
  pool(pool: string, scope: BijakPoolScope): Promise<BijakPool>
}

export interface PaperProgress {
  /** Set when the latest attempt is in progress. */
  attemptId?: string
  /** Score of the latest submitted attempt. */
  lastScore?: { score: number; max: number }
}

export interface BijakProgressSource {
  /** Progress of one user per paper id (decimal string); a paper missing from the map was never started. */
  progressFor(userId: string, paperIds: readonly string[]): Promise<ReadonlyMap<string, PaperProgress>>
}

export interface BijakServedSource {
  /** Question ids (decimal strings) the user has been served before. */
  servedQuestionIds(userId: string): Promise<ReadonlySet<string>>
}

class NoProgress implements BijakProgressSource {
  async progressFor(): Promise<ReadonlyMap<string, PaperProgress>> {
    return new Map()
  }
}

class NothingServed implements BijakServedSource {
  async servedQuestionIds(): Promise<ReadonlySet<string>> {
    return new Set()
  }
}

/**
 * The three ports as one injectable holder, so a later module can plug in its implementation
 * without editing `papers.module.ts` and without a circular import. The papers services read the
 * current provider on every request. Registering a port twice is a wiring error and throws.
 */
@Injectable()
export class BijakPapersPorts {
  private questions: BijakQuestionSource = new PocQuestionSource()
  private progress: BijakProgressSource = new NoProgress()
  private served: BijakServedSource = new NothingServed()
  private pools: BijakPoolSource = new PocPoolSource()
  private poolsSet = false
  private questionsSet = false
  private progressSet = false
  private servedSet = false

  get questionSource(): BijakQuestionSource {
    return this.questions
  }
  get progressSource(): BijakProgressSource {
    return this.progress
  }
  get servedSource(): BijakServedSource {
    return this.served
  }
  /** BJS-07: candidate facts of the standard pool. Default: the PoC fixture. */
  get poolSource(): BijakPoolSource {
    return this.pools
  }

  /** BJS-07: replace the PoC fixture by the question bank (see `question-bridge/pool-composite.ts`). */
  providePoolSource(provider: BijakPoolSource): void {
    if (this.poolsSet) throw new Error('BijakPapersPorts: the pool source is already set')
    this.pools = provider
    this.poolsSet = true
  }

  /** BE-09: replace the PoC fixture by the question bank. */
  provideQuestionSource(provider: BijakQuestionSource): void {
    if (this.questionsSet) throw new Error('BijakPapersPorts: the question source is already set')
    this.questions = provider
    this.questionsSet = true
  }

  /** BE-16: replace the "never started" default. */
  provideProgress(provider: BijakProgressSource): void {
    if (this.progressSet) throw new Error('BijakPapersPorts: the progress source is already set')
    this.progress = provider
    this.progressSet = true
  }

  /** BE-16: replace the "nothing served yet" default. */
  provideServed(provider: BijakServedSource): void {
    if (this.servedSet) throw new Error('BijakPapersPorts: the served source is already set')
    this.served = provider
    this.servedSet = true
  }
}
