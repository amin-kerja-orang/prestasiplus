/**
 * The `structured` repository (owner M04; SRS v1.10 §7.1, BR-M04-26/27/36): structured questions
 * and their sub-questions. Admin reads (S8/S9), student practice lists (M05 S10/Q3, M06 S7–S9)
 * and the M10 authoring writes go through it.
 *
 * Contract names: SRS `structured.query({...})` (student lists) → `visible({...})`, because `query`
 * is the framework's named-query method. `structuredStore.*` in older docs = these methods.
 */

import { toIsoMyt } from '@/lib/time'
import type { Where } from '@/mock/define'
import { defineRepository, RepositoryError } from '@/mock/repository'

import { OTHER_CREATOR } from '../data/anchors'
import { directionOf } from '../datasets/question-derive'
import { structuredDataset, subQuestionsOf } from '../datasets/structured'
import { compact, structuredQueries } from './queries'
import { levelScope as questionLevelScope } from './visible-levels'
import type {
  ComplianceStatus,
  ScriptType,
  StructuredQuestion,
  StructuredStatus,
  StructuredSubQuestion,
} from './types'

/** The structured store has no level-less rows: the question scope without its `null`. */
const levelScope = (requested?: number): number[] =>
  questionLevelScope(requested).filter((id): id is number => id !== null)

/** Sub-question input of an M10 structured form. */
export interface StructuredSubInput {
  partLabel: string
  questionText: string
  marks: number
  answerType?: 'text' | 'numeric'
  expectedNumeric?: number | null
  numericTolerance?: number | null
  rubrics?: StructuredSubQuestion['rubrics']
  modelAnswer?: string
  parentSubId?: number | null
}

/** M10 #45–#50 structured form (BR-M10-20 field names). */
export interface StructuredInput {
  subjectId: number
  educationLevelId: number
  kbatLevel: number
  stimulus: string
  subQuestions: readonly StructuredSubInput[]
  stimulusImage?: string | null
  topic?: string | null
  questionNumber?: number | null
  estimatedMinutes?: number
  isTrial?: boolean
  curriculumChapterId?: number | null
  curriculumTopicId?: number | null
  dskpSpId?: number | null
  scriptType?: ScriptType
  questionTemplate?: 'eksperimen' | null
  complianceStatus?: ComplianceStatus
  /** `publish = 1` → `published`, else `draft` (BR-M04-36). */
  publish?: boolean
}

const NEWEST_FIRST = [
  { field: 'createdAtMs', dir: 'desc' },
  { field: 'id', dir: 'asc' },
] as const

function contract(message: string): never {
  throw new RepositoryError('CONTRACT', `structured: ${message}`)
}

function subsOf(id: number, subs: readonly StructuredSubInput[]): StructuredSubQuestion[] {
  const base = subQuestionsOf(
    id,
    subs.map((s) => [s.partLabel, s.marks, s.questionText] as const),
  )
  return base.map((b, i) => {
    const s = subs[i] as StructuredSubInput
    return {
      ...b,
      answerType: s.answerType ?? 'text',
      expectedNumeric: s.expectedNumeric ?? null,
      numericTolerance: s.numericTolerance ?? null,
      rubrics: s.rubrics ?? b.rubrics,
      modelAnswer: s.modelAnswer ?? b.modelAnswer,
      parentSubId: s.parentSubId ?? null,
    }
  })
}

export const structuredRepo = defineRepository({
  name: 'structured',
  owner: 'M04',
  store: structuredDataset,
  queries: structuredQueries,
  methods: ({ store, transaction }) => {
    const get = (id: number): StructuredQuestion | null => store.get(id) ?? null
    const touch = (now: number) => ({ updatedAt: toIsoMyt(now), updatedAtMs: now })

    return {
      /** Any row (S9, M05 Q3); `null` if unknown. */
      get,
      getMany: (ids: readonly number[]): StructuredQuestion[] => store.getMany(ids),
      /** Student-visible (BR-M04-03): published, active, T4/T5. */
      getVisible: (id: number): StructuredQuestion | null => {
        const row = get(id)
        return row &&
          row.status === 'published' &&
          row.isActive &&
          (row.educationLevelId === 10 || row.educationLevelId === 11)
          ? row
          : null
      },
      /** SRS `structured.query`: published + active T4/T5 rows (FR-M04-115), 20 per page. */
      visible: (
        filter: {
          subjectId?: number
          kbatLevel?: number
          educationLevelId?: number
          page?: number
          pageSize?: number
        } = {},
      ) =>
        store.query({
          where: compact<Where<StructuredQuestion>>({
            status: 'published',
            isActive: true,
            educationLevelId: filter.educationLevelId ?? [10, 11],
            subjectId: filter.subjectId,
            kbatLevel: filter.kbatLevel,
          }),
          sort: NEWEST_FIRST,
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 20,
        }),
      /** S8 (#18): every row, newest first (BR-M04-26), 25 per page, with the stats. */
      adminList: (
        filter: {
          subjectId?: number
          educationLevelId?: number
          kbatLevel?: number
          page?: number
        } = {},
      ) => {
        // Secondary-only (D72): the structured questions of a hidden Darjah level are neither listed nor counted.
        const scope = { educationLevelId: levelScope() } as Where<StructuredQuestion>
        const page = store.query({
          where: compact<Where<StructuredQuestion>>({
            subjectId: filter.subjectId,
            educationLevelId: levelScope(filter.educationLevelId),
            kbatLevel: filter.kbatLevel,
          }),
          sort: NEWEST_FIRST,
          page: filter.page ?? 1,
          pageSize: 25,
        })
        return {
          ...page,
          stats: {
            total: store.count(scope),
            published: store.count({ ...scope, status: 'published' }),
            bySubject: store.groupCount('subjectId', scope),
          },
        }
      },
      /** M10 S17 (`structured.list`): `updatedAt` desc, ties id asc (BR-M10-20). */
      list: (
        filter: {
          viewer?: { id: number }
          subjectId?: number
          educationLevelId?: number
          status?: StructuredStatus
          page?: number
          pageSize?: number
        } = {},
      ) =>
        store.query({
          where: compact<Where<StructuredQuestion>>({
            createdBy: filter.viewer?.id,
            subjectId: filter.subjectId,
            educationLevelId: levelScope(filter.educationLevelId),
            status: filter.status,
          }),
          sort: [
            { field: 'updatedAtMs', dir: 'desc' },
            { field: 'id', dir: 'asc' },
          ],
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 20,
        }),
      /** S11 structured list: `needsDiagram`, id desc, 20 per page (BR-M04-19). */
      flagged: (filter: { subjectId?: number; page?: number } = {}) =>
        store.query({
          where: compact<Where<StructuredQuestion>>({
            needsDiagram: true,
            subjectId: filter.subjectId,
          }),
          sort: { field: 'id', dir: 'desc' },
          page: filter.page ?? 1,
          pageSize: 20,
        }),

      // --- writes (M10 #45–#50, BR-M04-36; M04 S11) ----------------------------------------------

      create: (viewer: { id: number }, input: StructuredInput, now: number): StructuredQuestion => {
        if (input.subQuestions.length === 0) contract('a structured question needs sub-questions')
        const script = input.scriptType ?? 'rumi'
        const iso = toIsoMyt(now)
        return transaction(() => {
          // The id is allocated by the store; sub-question ids derive from it after the insert.
          const row = store.insert({
            subjectId: input.subjectId,
            educationLevelId: input.educationLevelId,
            kbatLevel: input.kbatLevel,
            status: input.publish === true ? 'published' : 'draft',
            isActive: true,
            needsDiagram: false,
            contribSchoolId: null,
            createdAt: iso,
            createdAtMs: now,
            updatedAt: iso,
            updatedAtMs: now,
            createdBy: viewer.id,
            stimulus: input.stimulus,
            estimatedMinutes: input.estimatedMinutes ?? 10,
            isTrial: input.isTrial ?? false,
            topic: input.topic ?? null,
            questionNumber: input.questionNumber ?? null,
            stimulusImage: input.stimulusImage ?? null,
            totalMarks: 0,
            visibility: 'public',
            complianceStatus: input.complianceStatus ?? 'draft',
            sourceFile: null,
            sourcePage: null,
            sourceSet: null,
            curriculumChapterId: input.curriculumChapterId ?? null,
            curriculumTopicId: input.curriculumTopicId ?? null,
            dskpSpId: input.dskpSpId ?? null,
            scriptType: script,
            textDirection: directionOf(script),
            questionTemplate: input.questionTemplate ?? null,
            subQuestions: [],
          })
          const subs = subsOf(row.id, input.subQuestions)
          return store.update(row.id, {
            subQuestions: subs,
            totalMarks: subs.reduce((a, s) => a + s.marks, 0),
          })
        })
      },
      /** Every field except the DSKP chain on edit (M10 #48); `totalMarks` recomputed. */
      update: (
        id: number,
        patch: Partial<Omit<StructuredInput, 'dskpSpId' | 'publish'>>,
        now: number,
      ) => {
        if (!get(id)) return null
        const out: Partial<StructuredQuestion> = {}
        for (const [k, v] of Object.entries(patch)) {
          if (v !== undefined && k !== 'subQuestions') (out as Record<string, unknown>)[k] = v
        }
        if (patch.scriptType !== undefined) out.textDirection = directionOf(patch.scriptType)
        if (patch.subQuestions) {
          const subs = subsOf(id, patch.subQuestions)
          out.subQuestions = subs
          out.totalMarks = subs.reduce((a, s) => a + s.marks, 0)
        }
        return transaction(() => store.update(id, { ...out, ...touch(now) }))
      },
      delete: (id: number): boolean => {
        if (!get(id)) return false
        transaction(() => store.remove(id))
        return true
      },
      /** `draft` ⇄ `published` (M10 #50). */
      toggleStatus: (id: number, now: number): StructuredQuestion | null => {
        const row = get(id)
        if (!row) return null
        return transaction(() =>
          store.update(id, {
            status: row.status === 'published' ? 'draft' : 'published',
            ...touch(now),
          }),
        )
      },
      /** BR-M04-12 (≥3 open reports) and "Tolak & Aktifkan Semula". */
      setActive: (id: number, isActive: boolean, now?: number): StructuredQuestion | null => {
        if (!get(id)) return null
        return transaction(() =>
          store.update(id, now === undefined ? { isActive } : { isActive, ...touch(now) }),
        )
      },
      /** S11 upload / dismiss (BR-M04-19). */
      resolveDiagram: (
        id: number,
        image: string | null,
        now: number,
      ): StructuredQuestion | null => {
        if (!get(id)) return null
        return transaction(() =>
          store.update(id, {
            needsDiagram: false,
            ...(image ? { stimulusImage: image } : {}),
            ...touch(now),
          }),
        )
      },
    }
  },
})

/** The default creator of generated structured rows (PROPOSED; SRS "Guru Pakar" is stimulus text). */
export const STRUCTURED_DEFAULT_CREATOR = OTHER_CREATOR
