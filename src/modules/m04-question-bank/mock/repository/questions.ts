/**
 * The `questions` repository (owner M04; D12, overview §6.7; SRS v1.10 §7.1). The only doorway to
 * the question dataset: M04's own handlers and seed, and every consumer (M01 stats, M03 counts,
 * M05 practice, M06 SPM, M07 PKSK, M08, M10, M11, M13, M16) go through these methods.
 *
 * Contract names (SRS §7.1 → as built; the framework reserves `count`, `groupCount`, `query`,
 * `sample`, `where` and `contributeAnchors` for named queries and contributions):
 * - `questions.count(filter)` → `countWhere(filter)`; `namedCount(name, …)` → `count(name, …)` (X-11);
 * - `questions.query({subjectId?, educationLevelIds?, …, limit, seed})` → `practiceQuery(...)`;
 * - `questions.sample(filter, n, rng)` (M05, M06, M16; keyless rows) → `sampleKeyless(filter, n, rng)`;
 * - `questions.jutawan.count / sample / get / gradeAnswer` → `jutawanCount / jutawanSample /
 *   jutawanGet / jutawanGradeAnswer`;
 * - `questions.pksk.*` → `pkskList / pkskGet / pkskCreate / pkskUpdate / pkskDelete`
 *   (a repository exposes functions only).
 *
 * Writes take `now` (epoch ms, the handler passes `ctx.clock.now()`), so the store stays a pure
 * function of its inputs. Repository methods are synchronous (overview §6.7.1).
 */

import { toIsoMyt } from '@/lib/time'
import { fnv1a32, mulberry32, type Prng } from '@/mock/determinism'
import type { QueryResult } from '@/mock/db/store'
import type { Where } from '@/mock/define'
import { defineRepository, RepositoryError, type Contributor } from '@/mock/repository'

import { objectiveFacets, OTHER_CREATOR, STATE_PROFILE_ANCHORS } from '../data/anchors'
import { genericSpId, PKSK_DOMAINS } from '../data/tables'
import { composeQuestion, pickFacets, QUESTION_FACETS } from '../datasets/question-row'
import { directionOf } from '../datasets/question-derive'
import { jutawanDataset } from '../datasets/jutawan'
import { structuredDataset } from '../datasets/structured'
import {
  anchorRowOf,
  qualityScoreOf,
  QUESTION_RESERVED_RANGES,
  questionsDataset,
} from '../datasets/questions'
import { facetKey, m05AnchorDifficulty } from '../datasets/questions-spec'
import { compact, questionQueries } from './queries'
import { levelScope, visibleLevelIds } from './visible-levels'
import { workflowMethods } from './questions-workflow'
import {
  adminWhere,
  answerIndex,
  isEligible,
  isPracticeEligible,
  LETTERS,
  runtimeSpmPool,
  SOURCE_FAMILIES,
  type AdminListFilter,
} from './rules'
import {
  anchorUse,
  cellCounts,
  classifyCells,
  ledgerSet,
  markProfile,
  pkskCellsOf,
  poolCount,
  poolMove,
  recordTransform,
  replacePksk,
  resolved,
  resolvedCells,
  specState,
  type CellTransform,
  type ContributedCell,
} from './spec-state'
import type {
  JutawanQuestion,
  KeylessJutawanQuestion,
  KeylessQuestion,
  Language,
  PkskOption,
  PkskTargetLevel,
  Question,
  QuestionFacets,
  QuestionStatus,
  QuestionType,
  ScriptType,
  SourceType,
} from './types'

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

/** Fields of a created/edited objective question (SRS §5, #3/#5; M10 #53–#58). */
export interface QuestionInput {
  subjectId: number
  educationLevelId: number
  difficultyLevel: number
  questionType?: QuestionType
  questionText: string
  dskpSpId?: number | null
  questionImage?: string | null
  options?: string[] | null
  optionImages?: (string | null)[]
  correctAnswer?: number | null
  tfAnswer?: boolean | null
  correctAnswerText?: string | null
  altAnswers?: string[]
  modelAnswer?: string | null
  explanation?: string | null
  language?: Language
  pointsValue?: number
  curriculumChapterId?: number | null
  curriculumTopicId?: number | null
  scriptType?: ScriptType
  sourceType?: SourceType | null
  sourceFile?: string | null
  sourcePage?: number | null
  sourceSet?: string | null
}

export type QuestionPatch = Partial<QuestionInput> & {
  status?: QuestionStatus
  isActive?: boolean
  needsDiagram?: boolean
}

/** The viewer of a teacher write (M10 #53–#58). */
export interface Viewer {
  id: number
}

/** `practiceQuery` filter (SRS §7.1 `questions.query`): eligible, objective MCQ rows only. */
export interface PracticeFilter {
  subjectId?: number
  educationLevelIds?: readonly number[]
  difficultyLevel?: number
  curriculumChapterId?: number
  excludeIds?: readonly number[]
  limit: number
  /** Deterministic order key (e.g. the session id). */
  seed: string | number
}

export interface SpmPoolFilter {
  subjectId?: number
  educationLevelIds?: readonly number[]
  difficultyLevel?: number
}

/** Q-SPM-POOL view (BR-M04-32): count, condition and draws over one filter. */
export interface SpmPoolView {
  readonly total: number
  readonly where: Where<Question>
  sample(n: number, rng: Prng): Question[]
  page(page: number, pageSize?: number): QueryResult<Question>
}

export interface PkskInput {
  pkskDomainId: number
  pkskTargetLevel: PkskTargetLevel
  questionText: string
  difficultyLevel: number
  explanation?: string | null
  pkskOptions?: PkskOption[]
  status?: 'pending' | 'approved' | 'rejected'
}

export interface PkskFilter {
  domainIds?: readonly number[]
  targetLevel?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface GradeResult {
  isCorrect: boolean
  /** The key as an option index 0–3 (SRS §7.1 `correctOptionId`). */
  correctOptionId: number
  correctAnswer: number
  correctLetter: (typeof LETTERS)[number]
  explanation: string | null
}

/** `sampleKeyless` filter (SRS §7.1, confirmed for M16 XR-M16-01 b). */
export interface SampleFilter {
  educationLevelIds?: readonly number[]
  subjectId?: number
  questionType?: QuestionType
  difficultyLevel?: number
  /** Only eligible rows (approved and active, BR-M04-03). */
  eligible?: boolean
  spmPool?: boolean
  /** PKSK draws: set both (M07 domains). */
  pkskDomainId?: number
  pkskTargetLevel?: PkskTargetLevel
}

/** `jutawanSample` filter (BR-M04-37). */
export interface JutawanFilter {
  subjectId: number
  level: number
  difficulty?: number
}

export type BulkAction = 'approve' | 'reject' | 'archive' | 'delete' | 'pending_review'

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const NEWEST_FIRST = [
  { field: 'createdAtMs', dir: 'desc' },
  { field: 'id', dir: 'asc' },
] as const

function contract(message: string, issues: readonly string[] = []): never {
  throw new RepositoryError('CONTRACT', `questions: ${message}`, issues)
}

function seedOf(seed: string | number): number {
  return typeof seed === 'number' ? seed >>> 0 : fnv1a32(seed)
}

const FACET_SET = new Set<string>(QUESTION_FACETS)

/** A complete runtime row (S2/S5 admin, M10 teacher, M07 PKSK): facets + fields + timestamps. */
function runtimeRow(
  facets: QuestionFacets,
  fields: Partial<Question>,
  now: number,
): Omit<Question, 'id'> {
  const createdAt = toIsoMyt(now)
  // `composeQuestion` needs an id for its derived defaults; runtime rows override every one of them.
  const row = composeQuestion(0, facets, null, {
    questionText: '',
    sourceFile: null,
    sourcePage: null,
    sourceSet: null,
    explanation: null,
    options: null,
    correctAnswer: null,
    pkskOptions: null,
    usage: { attempts: 0, correct: 0 },
    createdAt,
    createdAtMs: now,
    ...fields,
  })
  const { id: _id, ...rest } = row
  void _id
  return { ...rest, updatedAt: createdAt, hasExplanation: rest.explanation !== null }
}

/** Facets and fields of an objective input (admin S2/S5, teacher writes). */
function objectiveFromInput(
  input: QuestionInput,
  opts: { status: QuestionStatus; createdBy: number },
): { facets: QuestionFacets; fields: Partial<Question> } {
  const type = input.questionType ?? 'mcq'
  const dskpSpId = input.dskpSpId ?? null
  const script = input.scriptType ?? 'rumi'
  const sourceType = input.sourceType ?? null
  const sourceFile = input.sourceFile ?? null
  const facets = objectiveFacets(input.subjectId, input.educationLevelId, {
    status: opts.status,
    isActive: true,
    questionType: type,
    spmPool: runtimeSpmPool(input.subjectId, input.educationLevelId),
    difficultyLevel: input.difficultyLevel,
    complianceStatus: 'draft',
    aiVerified: false,
    sourceType,
    hasSourceFile: sourceFile !== null,
    dskpTagged: dskpSpId !== null,
    dskpSpId,
    needsDiagram: false,
    qualityBucket: 'unscored',
    legacyGeneric: sourceType === 'ai_generated',
    curriculumChapterId: input.curriculumChapterId ?? null,
    createdBy: opts.createdBy,
    teacherDatabank: false,
  })
  const fields: Partial<Question> = {
    questionText: input.questionText,
    questionImage: input.questionImage ?? null,
    options: type === 'mcq' ? (input.options ?? ['', '', '', '']) : null,
    optionImages: input.optionImages ?? [null, null, null, null],
    correctAnswer: type === 'mcq' ? (input.correctAnswer ?? null) : null,
    tfAnswer: type === 'true_false' ? (input.tfAnswer ?? null) : null,
    correctAnswerText:
      type === 'short_answer' || type === 'fill_blank' ? (input.correctAnswerText ?? null) : null,
    altAnswers: input.altAnswers ?? [],
    modelAnswer: type === 'essay' ? (input.modelAnswer ?? null) : null,
    explanation: input.explanation ?? null,
    language: input.language ?? 'bm',
    pointsValue: input.pointsValue ?? 1,
    curriculumTopicId: input.curriculumTopicId ?? null,
    scriptType: script,
    textDirection: directionOf(script),
    sourceFile,
    sourcePage: input.sourcePage ?? null,
    sourceSet: input.sourceSet ?? null,
    qualityScore: null,
  }
  return { facets, fields }
}

/** A patch of input fields → a row patch (facets kept consistent). */
function patchFromInput(current: Question, patch: QuestionPatch): Partial<Question> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = v
  if (patch.dskpSpId !== undefined) out.dskpTagged = patch.dskpSpId !== null
  if (patch.sourceFile !== undefined) out.hasSourceFile = patch.sourceFile !== null
  if (patch.explanation !== undefined) out.hasExplanation = patch.explanation !== null
  if (patch.scriptType !== undefined) out.textDirection = directionOf(patch.scriptType)
  if (patch.sourceType !== undefined) out.legacyGeneric = patch.sourceType === 'ai_generated'
  // BR-M04-32: a row moved to T4/T5 of a pool subject joins the pool; the flag is never cleared.
  const s = patch.subjectId ?? current.subjectId
  const l = patch.educationLevelId ?? current.educationLevelId
  if (!current.spmPool && runtimeSpmPool(s, l) && current.pkskDomainId === null) out.spmPool = true
  return out
}

/** A row without its answer keys (for games and battles). */
function keyless(q: Question): KeylessQuestion {
  const {
    correctAnswer: _a,
    tfAnswer: _b,
    correctAnswerText: _c,
    altAnswers: _d,
    modelAnswer: _e,
    explanation: _f,
    aiExplanation: _g,
    pkskOptions,
    ...rest
  } = q
  void [_a, _b, _c, _d, _e, _f, _g]
  return { ...rest, pkskOptions: pkskOptions ? pkskOptions.map((o) => ({ text: o.text })) : null }
}

function inRanges(id: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([lo, hi]) => id >= lo && id <= hi)
}

/** Id blocks each contributor may use (SRS §6.13.1–§6.13.2). */
const CONTRIBUTOR_IDS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  M05: [[600001, 699999]],
  M07: [[177698, 178460]],
  M08: [[700001, 700299]],
  M10: [
    [700300, 700399],
    [522425, 522447],
    [525428, 525433],
  ],
  M11: [[700400, 700999]],
  M18: [[701001, 701099]],
}

const ENUMS: Readonly<Record<string, readonly unknown[]>> = {
  status: ['draft', 'pending_review', 'approved', 'rejected', 'archived', 'pending'],
  questionType: ['mcq', 'true_false', 'short_answer', 'fill_blank', 'essay'],
  complianceStatus: ['verified', 'pending_mapping', 'quarantined', 'rejected', 'draft'],
  sourceType: ['textbook', 'dskp', 'trial', 'marking_scheme', 'ai_generated', null],
  qualityBucket: ['unscored', 'cemerlang', 'baik', 'le50'],
  pkskTargetLevel: ['T1', 'T4', null],
}
const BOOLEAN_FACETS = [
  'isActive',
  'spmPool',
  'aiVerified',
  'hasSourceFile',
  'dskpTagged',
  'needsDiagram',
  'legacyGeneric',
  'teacherDatabank',
]

/** Schema check of a contributed anchor (DATA-M04-01 + cell room). */
function anchorIssues(row: Question, contributor: string): string[] {
  const issues: string[] = []
  const id = row.id
  if (typeof id !== 'number' || !Number.isSafeInteger(id)) return ['id must be an integer']
  const ranges = CONTRIBUTOR_IDS[contributor]
  if (!ranges) issues.push(`${contributor} has no question id block (SRS §6.13.2)`)
  else if (!inRanges(id, ranges))
    issues.push(`id ${String(id)} is outside the ${contributor} id block`)
  const r = row as unknown as Record<string, unknown>
  for (const f of QUESTION_FACETS) {
    if (!(f in r) || r[f] === undefined)
      issues.push(`facet '${f}' is missing (use questions.anchorRow)`)
  }
  for (const [f, values] of Object.entries(ENUMS)) {
    if (f in r && !values.includes(r[f])) issues.push(`${f} ${JSON.stringify(r[f])} is not allowed`)
  }
  for (const f of BOOLEAN_FACETS) {
    if (f in r && typeof r[f] !== 'boolean') issues.push(`${f} must be a boolean`)
  }
  if (typeof row.questionText !== 'string' || row.questionText === '')
    issues.push('questionText is required')
  if (row.pkskDomainId === null) {
    // SRS §6.11 "Module fixtures as anchors": approved and active.
    if (row.status !== 'approved' || !row.isActive)
      issues.push('objective anchors are approved and active')
    if (typeof row.subjectId !== 'number') issues.push('subjectId is required')
  } else if (row.subjectId !== null || row.educationLevelId !== null) {
    issues.push('PKSK rows have no subject or level (BR-M04-33)')
  }
  if (issues.length > 0) return issues
  const key = facetKey(pickFacets(r))
  const count = cellCounts().get(key)
  if (count === undefined) {
    issues.push(
      `no cell for its facets ${JSON.stringify(pickFacets(r))} (SRS §6.13.2); use questions.anchorRow(partial)`,
    )
    return issues
  }
  const prev = specState().ledger.get(id)
  const used = (anchorUse().get(key) ?? 0) - (prev === key ? 1 : 0)
  if (used + 1 > count)
    issues.push(`cell over-subscribed: ${String(used + 1)} anchors, count ${String(count)}`)
  else ledgerSet(id, key)
  return issues
}

// ---------------------------------------------------------------------------------------------
// The repository
// ---------------------------------------------------------------------------------------------

export const questionsRepo = defineRepository({
  name: 'questions',
  owner: 'M04',
  store: questionsDataset,
  stores: { structured: structuredDataset, jutawan: jutawanDataset },
  queries: questionQueries,
  validateAnchor: (row, contributor) => anchorIssues(row, contributor),
  methods: ({ store, stores, transaction, phase }) => {
    const get = (id: number): Question | null => store.get(id) ?? null

    const requireRow = (id: number): Question => {
      const row = get(id)
      if (!row) throw new RepositoryError('CONTRACT', `questions: id ${String(id)} not found`)
      return row
    }

    const setFields = (id: number, patch: Partial<Question>, now?: number): Question => {
      const p = now === undefined ? patch : { ...patch, updatedAt: toIsoMyt(now) }
      return store.update(id, p)
    }

    const practiceWhere = (
      f: Omit<PracticeFilter, 'limit' | 'seed' | 'excludeIds'>,
    ): Where<Question> =>
      compact({
        pkskDomainId: null,
        status: 'approved',
        isActive: true,
        questionType: 'mcq',
        subjectId: f.subjectId,
        educationLevelId: f.educationLevelIds ? [...f.educationLevelIds] : undefined,
        difficultyLevel: f.difficultyLevel,
        curriculumChapterId: f.curriculumChapterId,
      })

    const poolWhere = (f: SpmPoolFilter): Where<Question> =>
      compact({
        pkskDomainId: null,
        status: 'approved',
        isActive: true,
        questionType: 'mcq',
        spmPool: true,
        // D72: the pool is Tingkatan 4 / 5; a requested hidden Darjah level matches nothing.
        educationLevelId: f.educationLevelIds
          ? f.educationLevelIds.filter((l) => visibleLevelIds().includes(l))
          : [10, 11],
        subjectId: f.subjectId,
        difficultyLevel: f.difficultyLevel,
      })

    const requireSeedPhase = (what: string) => {
      if (store.compiled || phase() === 'live') {
        throw new RepositoryError(
          'PHASE',
          `questions.${what}: seed phase only (the dataset compiles at finalise); call it from seed(ctx)`,
        )
      }
    }

    const applyTransform = (t: CellTransform) => {
      // Validate now (a failing transform is a CONTRACT error at the call, not a boot crash).
      try {
        t(resolvedCells())
      } catch (err) {
        contract((err as Error).message)
      }
      recordTransform(t)
      store.overrideSpec(t)
    }

    const insertRuntime = (row: Omit<Question, 'id'>): Question =>
      transaction(() => store.insert(row as Question))

    return {
      // M04-T2: S6 quality reads and the audit (questions-workflow.ts).
      ...workflowMethods({ store, transaction }),

      // --- reads ---------------------------------------------------------------------------------

      /** Any row incl. PKSK and inactive rows; `null` if unknown (§7.1). */
      get,
      getMany: (ids: readonly number[]): Question[] => store.getMany(ids),
      exists: (id: number): boolean => store.has(id),
      /** The row only if eligible (approved and active, BR-M04-03), else `null` (§7.1). */
      getEligible: (id: number): Question | null => {
        const row = get(id)
        return row && isEligible(row) ? row : null
      },
      /** BR-M04-03 for MCQ practice (M05 drills and revision, M06 pools): eligible objective MCQ. */
      eligibleForPractice: (id: number): boolean => {
        const row = get(id)
        return row !== null && isPracticeEligible(row)
      },
      /** The practice condition (eligible objective MCQ) plus a filter, for counts and draws. */
      practiceWhere,
      /** §7.1 `questions.query`: eligible MCQ rows in a deterministic order by `seed`. */
      practiceQuery: (filter: PracticeFilter): Question[] => {
        const exclude = new Set(filter.excludeIds ?? [])
        const rows = store.sample(
          practiceWhere(filter),
          filter.limit + exclude.size,
          mulberry32(seedOf(filter.seed)),
        )
        return rows.filter((r) => !exclude.has(r.id)).slice(0, filter.limit)
      },
      /** Ad-hoc filter count (X-11). PKSK rows are excluded unless the filter names `pkskDomainId`. */
      countWhere: (filter: Where<Question> = {}): number =>
        store.count('pkskDomainId' in filter ? filter : { ...filter, pkskDomainId: null }),
      /**
       * Secondary-only (D72): Q-ALL / Q-APPROVED without the hidden Darjah questions (the admin "Jumlah",
       * tiles and quality total). The named queries themselves keep the observed whole-bank figures.
       */
      visibleCount: (name: 'Q-ALL' | 'Q-APPROVED', subjectId?: number): number =>
        store.count(
          compact<Where<Question>>({
            ...(name === 'Q-ALL'
              ? { pkskDomainId: null }
              : { pkskDomainId: null, status: 'approved' as const }),
            subjectId,
            educationLevelId: levelScope(),
          }),
        ),
      /**
       * Secondary-only (D72): Q-ACTIVE grouped by subject or level without the hidden Darjah questions
       * (M03 admin subject / level `questionCount`). The named query keeps the observed whole-bank figures.
       */
      visibleActiveGroupCount: (by: 'subjectId' | 'educationLevelId'): Map<number, number> => {
        const groups = store.groupCount(by, {
          pkskDomainId: null,
          isActive: true,
          educationLevelId: levelScope(),
        } as Where<Question>)
        // A question with no subject / level has no admin row to count against.
        return new Map([...groups].flatMap(([k, n]) => (k === null ? [] : [[k, n] as const])))
      },
      /** Q-SPM-POOL (BR-M04-32). */
      spmPool: (filter: SpmPoolFilter = {}): SpmPoolView => {
        const where = poolWhere(filter)
        return {
          total: store.count(where),
          where,
          sample: (n, rng) => store.sample(where, n, rng),
          page: (page, pageSize = 20) => store.query({ where, sort: NEWEST_FIRST, page, pageSize }),
        }
      },
      /** Q-SP-AVAILABLE (M08 S6/S7). */
      spAvailable: (dskpSpId: number, opts: { levelId?: number } = {}): number =>
        store.count(
          compact<Where<Question>>({
            pkskDomainId: null,
            status: 'approved',
            isActive: true,
            dskpSpId,
            // D72: a hidden Darjah level counts nothing.
            educationLevelId: levelScope(opts.levelId),
          }),
        ),
      /** Grades an MCQ answer ("A"–"D" or 0–3). `null` for unknown or non-MCQ rows. */
      gradeAnswer: (id: number, answer: unknown): GradeResult | null => {
        const row = get(id)
        if (!row || row.questionType !== 'mcq' || row.correctAnswer === null) return null
        const chosen = answerIndex(answer)
        return {
          isCorrect: chosen === row.correctAnswer,
          correctOptionId: row.correctAnswer,
          correctAnswer: row.correctAnswer,
          correctLetter: LETTERS[row.correctAnswer] as (typeof LETTERS)[number],
          explanation: row.explanation,
        }
      },
      /** S1 list (§7 #1): filters BR-M04-04…07, newest first (BR-M04-31), 20 per page. */
      adminList: (filter: AdminListFilter & { page?: number; pageSize?: number } = {}) => {
        const term = filter.search?.trim() ?? ''
        return store.query({
          // Secondary-only (D72): the questions of a hidden Darjah level are never listed or counted.
          where: { ...adminWhere(filter), educationLevelId: levelScope(filter.educationLevelId) },
          sort: NEWEST_FIRST,
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 20,
          search: term !== '' ? { term, fields: ['questionText'] } : undefined,
        })
      },
      /** S11 MCQ list: `needsDiagram` rows, id desc, 20 per page (BR-M04-19). */
      flagged: (
        filter: { subjectId?: number; creatorIds?: readonly number[]; page?: number } = {},
      ) =>
        store.query({
          where: compact({
            pkskDomainId: null,
            needsDiagram: true,
            educationLevelId: levelScope(),
            subjectId: filter.subjectId,
            createdBy: filter.creatorIds ? [...filter.creatorIds] : undefined,
          }),
          sort: { field: 'id', dir: 'desc' },
          page: filter.page ?? 1,
          pageSize: 20,
        }),
      /** Q-CONTRIB list (M10 S1, S21–S24): ids ascending, 20 per page, with the S21 counts. */
      contributions: (
        userId: number,
        filter: { status?: QuestionStatus; subjectId?: number; page?: number } = {},
      ) => {
        const base = {
          pkskDomainId: null,
          createdBy: userId,
          educationLevelId: levelScope(),
        } as Where<Question>
        const where = compact({
          ...base,
          status: filter.status,
          subjectId: filter.subjectId,
        }) as Where<Question>
        const page = store.query({
          where,
          sort: { field: 'id', dir: 'asc' },
          page: filter.page ?? 1,
          pageSize: 20,
        })
        return {
          ...page,
          counts: {
            total: store.count(base),
            approved: store.count({ ...base, status: 'approved' }),
            pending: store.count({ ...base, status: 'pending_review' }),
            used: store.count({ ...base, usageAttempts: { gte: 1 } }),
          },
          bySubject: store.groupCount('subjectId', base),
        }
      },
      /** Q-TEACHER-DATABANK list (M10 S28): eligible databank rows, id desc, 15 per page. */
      teacherDatabank: (
        subjectId: number,
        filter: {
          q?: string
          questionType?: QuestionType
          sourceFamily?: string
          difficulty?: number
          dskpSpId?: number
          page?: number
        } = {},
      ) => {
        const base = {
          pkskDomainId: null,
          status: 'approved',
          isActive: true,
          teacherDatabank: true,
          subjectId,
          educationLevelId: levelScope(),
        } as Where<Question>
        const family = filter.sourceFamily ? SOURCE_FAMILIES[filter.sourceFamily] : undefined
        const where = compact({
          ...base,
          questionType: filter.questionType,
          difficultyLevel: filter.difficulty,
          dskpSpId: filter.dskpSpId,
          sourceType: family ? [...family] : filter.sourceFamily ? { isNull: false } : undefined,
        }) as Where<Question>
        const term = filter.q?.trim() ?? ''
        const page = store.query({
          where: filter.sourceFamily && !family ? { id: -1 } : where,
          sort: { field: 'id', dir: 'desc' },
          page: filter.page ?? 1,
          pageSize: 15,
          search: term !== '' ? { term, fields: ['questionText'] } : undefined,
        })
        return {
          ...page,
          counts: {
            total: store.count(base),
            objective: store.count({ ...base, questionType: 'mcq' }),
            subjective: store.count({ ...base, questionType: 'essay' }),
          },
        }
      },
      /** S6 aggregates: per subject and level (count, mean) over the scored rows (cheap field). */
      qualityStats: () => {
        const bySubject = new Map<number, { count: number; sum: number }>()
        const byLevel = new Map<number, { count: number; sum: number }>()
        let count = 0
        let sum = 0
        const add = (m: Map<number, { count: number; sum: number }>, k: number, v: number) => {
          const e = m.get(k) ?? { count: 0, sum: 0 }
          e.count += 1
          e.sum += v
          m.set(k, e)
        }
        store.count(
          {
            pkskDomainId: null,
            qualityBucket: ['cemerlang', 'baik', 'le50'],
            educationLevelId: levelScope(),
          },
          (r) => {
            const v = r.qualityScore ?? 0
            count += 1
            sum += v
            if (r.subjectId !== null) add(bySubject, r.subjectId, v)
            if (r.educationLevelId !== null) add(byLevel, r.educationLevelId, v)
            return false
          },
          { matchFields: ['qualityScore', 'subjectId', 'educationLevelId'] },
        )
        return { count, sum, bySubject, byLevel }
      },

      /**
       * SRS §7.1 `questions.sample(filter, n, rng)` (M05, M06, M16 battle and game pools): `n`
       * distinct rows, **without answer keys**; grade with `gradeAnswer`. Objective rows unless the
       * filter names a PKSK domain.
       */
      sampleKeyless: (filter: SampleFilter, n: number, rng: Prng): KeylessQuestion[] => {
        const where = compact({
          pkskDomainId: filter.pkskDomainId ?? null,
          pkskTargetLevel: filter.pkskTargetLevel,
          subjectId: filter.subjectId,
          educationLevelId: filter.educationLevelIds ? [...filter.educationLevelIds] : undefined,
          questionType: filter.questionType,
          difficultyLevel: filter.difficultyLevel,
          spmPool: filter.spmPool,
          ...(filter.eligible === true ? { status: 'approved' as const, isActive: true } : {}),
        }) as Where<Question>
        return store.sample(where, n, rng).map(keyless)
      },
      /** Q-TEACHER-CONTRIB (M17 S11): objective + structured teacher contributions, per school. */
      teacherContributions: (schoolId?: number): number =>
        questionQueries['Q-TEACHER-CONTRIB'].count(schoolId),

      // --- Jutawan store (M16; BR-M04-37, SRS §7.1 `questions.jutawan.*`) -------------------------

      /** Q-JUT-COUNT(subject, level): 0 for every pair outside the 143 cells. */
      jutawanCount: (subjectId: number, level: number): number =>
        stores.jutawan.count({ subjectId, educationLevelId: level }),
      /** `n` distinct rows of the cell, without keys. */
      jutawanSample: (filter: JutawanFilter, n: number, rng: Prng): KeylessJutawanQuestion[] =>
        stores.jutawan
          .sample(
            compact({
              subjectId: filter.subjectId,
              educationLevelId: filter.level,
              difficultyLevel: filter.difficulty,
            }) as Where<JutawanQuestion>,
            n,
            rng,
          )
          .map(({ correctAnswer: _k, explanation: _e, ...rest }) => {
            void _k
            void _e
            return rest
          }),
      jutawanGet: (id: number): JutawanQuestion | null => stores.jutawan.get(id) ?? null,
      jutawanGradeAnswer: (id: number, optionId: unknown) => {
        const row = stores.jutawan.get(id)
        if (!row) return null
        return {
          isCorrect: answerIndex(optionId) === row.correctAnswer,
          correctOptionId: row.correctAnswer,
        }
      },

      // --- admin writes (M04 handlers) -----------------------------------------------------------

      /** S2 create (BR-M04-09) or S5 import row (BR-M04-10: `status = 'draft'`). */
      create: (
        input: QuestionInput,
        opts: { createdBy: number; now: number; status?: QuestionStatus },
      ): Question => {
        const { facets, fields } = objectiveFromInput(input, {
          status: opts.status ?? 'approved',
          createdBy: opts.createdBy,
        })
        return insertRuntime(runtimeRow(facets, fields, opts.now))
      },
      /** S4 edit / generic field update (facets kept consistent). */
      update: (id: number, patch: QuestionPatch, now: number): Question => {
        const current = requireRow(id)
        return transaction(() => setFields(id, patchFromInput(current, patch), now))
      },
      /** Permanent delete (BR-M04-01). */
      remove: (id: number): void => {
        requireRow(id)
        transaction(() => store.remove(id))
      },
      /** S1 bulk action (#7): returns the number of rows changed. PKSK ids are ignored. */
      bulkAction: (action: BulkAction, ids: readonly number[], now: number): number =>
        transaction(() => {
          const status: Record<Exclude<BulkAction, 'delete'>, QuestionStatus> = {
            approve: 'approved',
            reject: 'rejected',
            archive: 'archived',
            pending_review: 'pending_review',
          }
          let n = 0
          for (const id of new Set(ids)) {
            const row = get(id)
            if (!row || row.pkskDomainId !== null) continue
            if (action === 'delete') store.remove(id)
            else setFields(id, { status: status[action] }, now)
            n++
          }
          return n
        }),
      /** BR-M04-12: a report (or an admin) takes the question out of practice. */
      deactivate: (id: number, now?: number): Question =>
        transaction(() => {
          requireRow(id)
          return setFields(id, { isActive: false }, now)
        }),
      /** "Tolak & Aktifkan Semula" (BR-M04-13). */
      reactivate: (id: number, now?: number): Question =>
        transaction(() => {
          requireRow(id)
          return setFields(id, { isActive: true }, now)
        }),
      /** S11 upload / dismiss (BR-M04-19): `needsDiagram = false`, optional question image. */
      resolveDiagram: (id: number, image: string | null, now: number): Question =>
        transaction(() => {
          requireRow(id)
          return setFields(
            id,
            image ? { needsDiagram: false, questionImage: image } : { needsDiagram: false },
            now,
          )
        }),
      /** BR-M04-24: store an AI explanation. */
      setAiExplanation: (id: number, markdown: string, now: number): Question =>
        transaction(() => {
          requireRow(id)
          return setFields(id, { aiExplanation: { markdown, generatedAt: toIsoMyt(now) } }, now)
        }),

      // --- teacher writes (M10 #53–#58, BR-M04-35) -----------------------------------------------

      createFromTeacher: (viewer: Viewer, input: QuestionInput, now: number): Question => {
        const { facets, fields } = objectiveFromInput(input, {
          status: 'pending_review',
          createdBy: viewer.id,
        })
        return insertRuntime(runtimeRow(facets, fields, now))
      },
      /** Own rows only; `null` = not found / not own (the handler answers 404). */
      updateOwn: (
        viewer: Viewer,
        id: number,
        patch: QuestionInput | QuestionPatch,
        now: number,
      ) => {
        const row = get(id)
        if (!row || row.createdBy !== viewer.id || row.pkskDomainId !== null) return null
        const { status: _s, isActive: _a, needsDiagram: _n, ...allowed } = patch as QuestionPatch
        void _s
        void _a
        void _n
        return transaction(() => setFields(id, patchFromInput(row, allowed), now))
      },
      deleteOwn: (viewer: Viewer, id: number): boolean => {
        const row = get(id)
        if (!row || row.createdBy !== viewer.id || row.pkskDomainId !== null) return false
        transaction(() => store.remove(id))
        return true
      },
      /** Parsed teacher import rows (the handler parses the CSV). Returns the created rows. */
      importFromTeacher: (
        viewer: Viewer,
        rows: readonly QuestionInput[],
        now: number,
      ): Question[] =>
        transaction(() =>
          rows.map((input) => {
            const { facets, fields } = objectiveFromInput(input, {
              status: 'pending_review',
              createdBy: viewer.id,
            })
            return store.insert(runtimeRow(facets, fields, now))
          }),
        ),

      // --- PKSK rows (M07 only; BR-M04-33) -------------------------------------------------------

      pkskList: (filter: PkskFilter = {}) => {
        const term = filter.search?.trim() ?? ''
        return store.query({
          where: compact({
            pkskDomainId: filter.domainIds ? [...filter.domainIds] : { ne: null },
            pkskTargetLevel: filter.targetLevel,
            status: filter.status,
          }) as Where<Question>,
          sort: NEWEST_FIRST,
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 20,
          search: term !== '' ? { term, fields: ['questionText'] } : undefined,
        })
      },
      pkskGet: (id: number): Question | null => {
        const row = get(id)
        return row && row.pkskDomainId !== null ? row : null
      },
      pkskCreate: (input: PkskInput, now: number): Question => {
        if (!(input.pkskDomainId in PKSK_DOMAINS))
          contract(`unknown PKSK domain ${String(input.pkskDomainId)}`)
        const bahagian = PKSK_DOMAINS[input.pkskDomainId]?.[0]
        const facets: QuestionFacets = {
          ...objectiveFacets(0, null),
          subjectId: null,
          pkskDomainId: input.pkskDomainId,
          pkskTargetLevel: input.pkskTargetLevel,
          status: input.status ?? 'pending',
          questionType: bahagian === 'C' ? 'essay' : 'mcq',
          difficultyLevel: input.difficultyLevel,
          sourceType: null,
          hasSourceFile: false,
          dskpTagged: false,
          dskpSpId: null,
          createdBy: OTHER_CREATOR,
        }
        return insertRuntime(
          runtimeRow(
            facets,
            {
              questionText: input.questionText,
              explanation: input.explanation ?? null,
              pkskOptions: input.pkskOptions ?? [],
            },
            now,
          ),
        )
      },
      pkskUpdate: (id: number, patch: Partial<PkskInput>, now: number): Question | null => {
        const row = get(id)
        if (!row || row.pkskDomainId === null) return null
        const out: Partial<Question> = compact({
          pkskDomainId: patch.pkskDomainId,
          pkskTargetLevel: patch.pkskTargetLevel,
          questionText: patch.questionText,
          difficultyLevel: patch.difficultyLevel,
          explanation: patch.explanation,
          pkskOptions: patch.pkskOptions,
          status: patch.status,
        })
        if (patch.pkskDomainId !== undefined) {
          out.questionType = PKSK_DOMAINS[patch.pkskDomainId]?.[0] === 'C' ? 'essay' : 'mcq'
        }
        if (patch.explanation !== undefined) out.hasExplanation = patch.explanation !== null
        return transaction(() => setFields(id, out, now))
      },
      pkskDelete: (id: number): boolean => {
        const row = get(id)
        if (!row || row.pkskDomainId === null) return false
        transaction(() => store.remove(id))
        return true
      },

      // --- seed phase (contributions and owner overrides) ----------------------------------------

      /**
       * Owner method wrapping `overrideSpec` for non-owner distribution cells (overview §6.6):
       * - SPM pool cells `{ facets: {subjectId, educationLevelId, difficultyLevel, spmPool: true}, count }`
       *   (M06): each sets the pool count of that cell; rows move between pool and non-pool eligible
       *   MCQ rows of the same subject, level and difficulty, so Q-ELIGIBLE and Q-DIFFICULTY stay;
       * - PKSK cells `{ facets: {pkskDomainId, pkskTargetLevel, difficultyLevel}, count }` (M07):
       *   replace the PKSK family, keeping 763, the domain × level totals and 190/191/191/191.
       * Seed phase only (`PHASE` after compile); invalid cells throw `CONTRACT`.
       */
      contributeCells: (contributor: Contributor, cells: readonly ContributedCell[]): void => {
        const who = typeof contributor === 'string' ? contributor : contributor.module
        if (!/^(?:core|M\d{2})$/.test(who))
          contract(`contributeCells: invalid contributor ${JSON.stringify(who)}`)
        requireSeedPhase('contributeCells')
        if (!Array.isArray(cells)) contract('contributeCells: cells must be an array')
        const { pool, pksk, issues } = classifyCells(cells)
        if (issues.length > 0) {
          contract(`contributeCells(${who}): ${String(issues.length)} cell(s) rejected`, issues)
        }
        if (pool.length > 0) {
          const reserved = anchorUse()
          const moves = pool.map((c) => ({
            ...c,
            delta: c.count - poolCount(resolvedCells(), c.s, c.l, c.d),
          }))
          applyTransform((input) => {
            let out = input
            for (const m of moves) out = poolMove(out, m.s, m.l, m.d, m.delta, reserved)
            return out
          })
        }
        if (pksk.length > 0) {
          const next = pkskCellsOf(pksk)
          applyTransform((input) => replacePksk(input, next))
        }
      },

      /**
       * Completes a contributed anchor (SRS §6.13.2): the given facets are kept; missing facets are
       * taken from the matching cell with the most free room (so every anchor has a slot); the
       * other fields are derived like a generated row and overridden by `partial`. Seed phase only.
       */
      anchorRow: (partial: Partial<Question> & { id: number }): Question => {
        requireSeedPhase('anchorRow')
        if (typeof partial.id !== 'number') contract('anchorRow: id is required')
        const given: Partial<Record<keyof QuestionFacets, unknown>> = {}
        for (const f of QUESTION_FACETS) {
          const v = (partial as Record<string, unknown>)[f]
          if (v !== undefined) given[f] = v
        }
        const pksk = given.pkskDomainId !== undefined && given.pkskDomainId !== null
        // Unless the contributor says otherwise, an anchor is a plain generated-style row: not in
        // the teacher databank, not a user-1 or teacher contribution, inside the S10 coverage.
        given.teacherDatabank ??= false
        given.createdBy ??= OTHER_CREATOR
        given.contribSchoolId ??= null
        given.coverageExcluded ??= false
        if (!pksk) {
          given.pkskDomainId = null
          given.pkskTargetLevel ??= null
          given.status ??= 'approved'
          given.isActive ??= true
          given.questionType ??= 'mcq'
        } else {
          given.subjectId ??= null
          given.educationLevelId ??= null
        }
        if (given.dskpSpId !== undefined && given.dskpTagged === undefined) {
          given.dskpTagged = given.dskpSpId !== null
        }
        if (given.dskpTagged === false && given.dskpSpId === undefined) given.dskpSpId = null
        const m05 = m05AnchorDifficulty(partial.id)
        if (m05 !== null && given.difficultyLevel === undefined && !pksk)
          given.difficultyLevel = m05
        const { cells, keys, counts } = resolved()
        const used = anchorUse()
        const tests = Object.entries(given)
        let best: { facets: QuestionFacets; key: string; free: number } | null = null
        for (let i = 0; i < cells.length; i++) {
          const f = (cells[i] as { facets: QuestionFacets }).facets as unknown as Record<
            string,
            unknown
          >
          let ok = true
          for (const [k, v] of tests) {
            if (f[k] !== v) {
              ok = false
              break
            }
          }
          if (!ok) continue
          const key = keys[i] as string
          const free = (counts.get(key) ?? 0) - (used.get(key) ?? 0)
          if (free > 0 && (!best || free > best.free)) {
            best = { facets: f as unknown as QuestionFacets, key, free }
          }
        }
        if (!best) {
          contract(
            `anchorRow(${String(partial.id)}): no cell with room for ${JSON.stringify(given)}`,
          )
        }
        const facets = { ...best.facets }
        ledgerSet(partial.id, best.key)
        const extra: Partial<Question> = {}
        for (const [k, v] of Object.entries(partial)) {
          if (!FACET_SET.has(k) && v !== undefined) (extra as Record<string, unknown>)[k] = v
        }
        return composeQuestion(partial.id, facets, qualityScoreOf(facets), extra)
      },

      /**
       * Owner overrides (`reset({ questionStore: … })`, applied by the M04 seed):
       * - `profile: 'states'` adds the test-only state anchors 570001–570003, 570010–570013 (one
       *   extra cell of count 1 each, SRS §6.11 "State profile");
       * - `spmPool: { [subjectId | M06 code]: { [levelId]: { [difficulty]: count } } }` sets pool
       *   cells (M06 §6.11, e.g. `{ MATH: { 11: { 4: 3 } } }`).
       */
      applySeedOverrides: (value: unknown): void => {
        requireSeedPhase('applySeedOverrides')
        if (value === undefined || value === null) return
        if (typeof value !== 'object') contract('questionStore override must be an object')
        const v = value as { profile?: unknown; spmPool?: unknown }
        for (const key of Object.keys(v)) {
          if (key !== 'profile' && key !== 'spmPool')
            contract(`questionStore override: unknown key '${key}'`)
        }
        if (v.profile !== undefined) {
          if (v.profile !== 'states') contract(`questionStore.profile must be 'states'`)
          const extra = STATE_PROFILE_ANCHORS.map((a) => ({ facets: a.facets, count: 1 }))
          applyTransform((cells) => [
            ...cells,
            ...extra.map((c) => ({ facets: { ...c.facets }, count: 1 })),
          ])
          markProfile()
          store.addAnchors(STATE_PROFILE_ANCHORS.map(anchorRowOf), 'M04')
        }
        if (v.spmPool !== undefined) {
          if (typeof v.spmPool !== 'object' || v.spmPool === null)
            contract('questionStore.spmPool must be an object')
          const cells: ContributedCell[] = []
          for (const [subject, byLevel] of Object.entries(v.spmPool as Record<string, unknown>)) {
            const s = /^\d+$/.test(subject) ? Number(subject) : SUBJECT_BY_CODE[subject]
            if (s === undefined) contract(`questionStore.spmPool: unknown subject '${subject}'`)
            for (const [level, byD] of Object.entries(byLevel as Record<string, unknown>)) {
              for (const [d, count] of Object.entries(byD as Record<string, unknown>)) {
                cells.push({
                  facets: {
                    subjectId: s,
                    educationLevelId: Number(level),
                    difficultyLevel: Number(d),
                    spmPool: true,
                  },
                  count: count as number,
                })
              }
            }
          }
          const { pool, issues } = classifyCells(cells)
          if (issues.length > 0) contract('questionStore.spmPool rejected', issues)
          const reserved = anchorUse()
          const moves = pool.map((c) => ({
            ...c,
            delta: c.count - poolCount(resolvedCells(), c.s, c.l, c.d),
          }))
          applyTransform((input) => {
            let out = input
            for (const m of moves) out = poolMove(out, m.s, m.l, m.d, m.delta, reserved)
            return out
          })
        }
      },

      // --- test hook (dev/e2e) -------------------------------------------------------------------

      /**
       * `questions.createFixture(row)` (SRS §7.1; M10 E2E 700301): an overlay insert with a
       * reserved anchor id. The given fields win over an approved, active objective default.
       */
      createFixture: (
        row: Partial<Question> & { id: number; subjectId: number; educationLevelId: number },
      ) => {
        if (!inRanges(row.id, QUESTION_RESERVED_RANGES)) {
          contract(`createFixture: id ${String(row.id)} is not in a reserved anchor range`)
        }
        if (store.has(row.id)) contract(`createFixture: id ${String(row.id)} exists`)
        const given: Partial<QuestionFacets> = {}
        for (const f of QUESTION_FACETS) {
          const v = (row as Record<string, unknown>)[f]
          if (v !== undefined) (given as Record<string, unknown>)[f] = v
        }
        const facets = objectiveFacets(row.subjectId, row.educationLevelId, {
          dskpTagged: false,
          ...given,
        })
        if (row.dskpSpId === undefined && facets.dskpTagged) {
          facets.dskpSpId = genericSpId(row.subjectId, row.educationLevelId)
        }
        const full = composeQuestion(row.id, facets, null, row)
        return transaction(() => store.insert(full))
      },
    }
  },
})

/** M06 subject codes accepted by the `questionStore.spmPool` override (M03 codes). */
const SUBJECT_BY_CODE: Readonly<Record<string, number>> = {
  BM: 1,
  BI: 2,
  MATH: 3,
  SCI: 4,
  SEJ: 5,
  PI: 6,
  PM: 7,
  ADDMATH: 8,
  PHY: 9,
  CHEM: 10,
  BIO: 11,
  GEO: 12,
  PSV: 13,
  BA: 18,
  AKAUN: 21,
  EKON: 22,
  PERNIAGA: 23,
  TI: 25,
  PSI: 27,
}

export type QuestionsRepository = typeof questionsRepo
export { pickFacets }
export type { Question }
