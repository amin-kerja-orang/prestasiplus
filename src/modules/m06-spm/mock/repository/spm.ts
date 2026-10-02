/**
 * The `spm` repository (owner **M06**; D12, overview §6.7): the only doorway to the M06 stores
 * (TrackingASet, MockExam). The SPM question pool itself belongs to M04 (`questions.spmPool`); M06
 * only supplies its cells (seed) and reads it. Repository methods are synchronous (§6.7.1).
 *
 * `ramalanQuestions(subjectId, year, setNo)` is the read M05 §7 #4 (`ramalan`) calls through its seam:
 * the question ids of a startable set in set order (BR-M06-14), `[]` for a Belum Cukup set, `null` for
 * an unknown one.
 */

import type { Prng } from '@/mock/determinism'
import { defineRepository } from '@/mock/repository'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions, structured, type Question } from '@/modules/m04-question-bank/mock'

import type {
  MockAnswerInput,
  MockExamView,
  MockItem,
  MockListItem,
  MockResult,
  SetStatus,
  TrackingASetCard,
} from '../../api/types'
import {
  DEFAULT_SET_SIZE,
  MOCK_SUBJECTS,
  P1_ITEMS,
  P2_ITEMS,
  P2_ITEM_MARKS,
  SPM_SUBJECTS,
  type SpmSubjectConfig,
} from '../data/config'
import {
  mockExamsTable,
  trackingSetsTable,
  type MockExamRow,
  type TrackingSetRow,
} from '../tables/tables'
import {
  LETTERS,
  gradeOf,
  heroClassOf,
  isStartable,
  markPaper2,
  paper2Feedback,
  round2,
  setStatus,
  weakTopicsOf,
} from './rules'

export interface SetView extends TrackingASetCard {
  subjectId: number
  /** Eligible questions in the set (a deactivated one leaves it). */
  eligibleCount: number
  size: number
}

const byCode = new Map<string, SpmSubjectConfig>(SPM_SUBJECTS.map((s) => [s.code, s]))
const bySubjectId = new Map<number, SpmSubjectConfig>(SPM_SUBJECTS.map((s) => [s.subjectId, s]))

/** The Q-SPM-POOL cell filter for a count. */
const poolFilter = (subjectId: number, level?: number, difficulty?: number) => ({
  subjectId,
  ...(level !== undefined ? { educationLevelIds: [level] } : {}),
  ...(difficulty !== undefined ? { difficultyLevel: difficulty } : {}),
})

function topicOf(q: Question, subjectName: string): string {
  if (q.chapterLabel) return q.chapterLabel
  const ch = q.curriculumChapterId !== null ? curriculum.chapter(q.curriculumChapterId) : undefined
  return ch?.name ?? subjectName
}

const keyLetter = (q: Question): string => LETTERS[q.correctAnswer ?? 0] ?? 'A'

export function paper1Item(no: number, q: Question, subjectName: string): MockItem {
  return {
    no,
    questionId: q.id,
    text: q.questionText,
    options: [...(q.options ?? [])],
    modelAnswer: keyLetter(q),
    studentAnswer: null,
    marks: null,
    maxMarks: 1,
    feedback: null,
    topic: topicOf(q, subjectName),
  }
}

export const spmRepo = defineRepository({
  owner: 'M06',
  name: 'spm',
  store: mockExamsTable,
  stores: { trackingSets: trackingSetsTable },
  methods: ({ store, stores, transaction }) => {
    const sets = stores.trackingSets

    const subjectName = (subjectId: number): string => curriculum.subject(subjectId)?.name ?? ''

    const setView = (row: TrackingSetRow, size: number): SetView => {
      const eligible = row.questionIds.filter((id) => questions.getEligible(id) !== null).length
      const bankSource = eligible > size ? eligible : null
      const readyCount = Math.min(eligible, size)
      const dskpTotal = bankSource ?? readyCount
      return {
        subjectId: row.subjectId,
        setNo: row.setNo,
        status: setStatus(readyCount, bankSource, size),
        readyCount,
        bankSource,
        dskpTagged: Math.min(row.dskpTagged, dskpTotal),
        dskpTotal,
        eligibleCount: eligible,
        size,
      }
    }

    const rowsOf = (subjectId: number, year?: number): TrackingSetRow[] =>
      sets
        .query({ where: { subjectId, ...(year !== undefined ? { year } : {}) } })
        .rows.sort((a, b) => a.setNo - b.setNo)

    const sizeOf = (subjectId: number): number =>
      bySubjectId.get(subjectId)?.targetSize ?? DEFAULT_SET_SIZE

    const toView = (m: MockExamRow): MockExamView => ({
      id: m.id,
      subject: m.subject,
      paperNumber: m.paperNumber,
      status: m.status,
      createdAt: m.createdAt,
      items: m.items.map((i) => ({
        no: i.no,
        text: i.text,
        ...(i.options ? { options: [...i.options] } : {}),
        maxMarks: i.maxMarks,
      })),
    })

    const resultOf = (m: MockExamRow): MockResult => ({
      id: m.id,
      subject: m.subject,
      paperNumber: m.paperNumber,
      score: m.score ?? 0,
      maxScore: m.maxScore,
      percent: m.percent ?? 0,
      grade: m.grade ?? 'G',
      heroClass: heroClassOf(m.grade ?? 'G'),
      weakTopics: weakTopicsOf(m.items),
      items: m.items.map((i) => ({ ...i, ...(i.options ? { options: [...i.options] } : {}) })),
    })

    return {
      // --- configuration ------------------------------------------------------------------------
      /** DATA-M06-01 (BR-M06-04/06): the 19 Latih Tubi subjects. */
      subjects: (): readonly SpmSubjectConfig[] => SPM_SUBJECTS,
      subjectByCode: (code: string): SpmSubjectConfig | undefined => byCode.get(code.toUpperCase()),
      subjectById: (subjectId: number): SpmSubjectConfig | undefined => bySubjectId.get(subjectId),

      /** BR-M06-02: the `spmPool` count of a subject (optionally of a level and a difficulty). */
      poolCount: (subjectId: number, level?: number, difficulty?: number): number =>
        questions.spmPool(poolFilter(subjectId, level, difficulty)).total,

      // --- Tracking A sets ----------------------------------------------------------------------
      seedTrackingSets: (rows: readonly Omit<TrackingSetRow, 'id'>[]): void => {
        transaction(() => {
          for (const r of rows)
            sets.insert({ ...r, id: `${String(r.subjectId)}:${String(r.year)}:${String(r.setNo)}` })
        })
      },
      /** The 2026 sets of a subject with their derived status, ordered by set number. */
      setsOf: (subjectId: number, year?: number): SetView[] => {
        const size = sizeOf(subjectId)
        return rowsOf(subjectId, year).map((r) => setView(r, size))
      },
      /** Subjects that have at least one set. */
      subjectsWithSets: (): number[] => [...new Set(sets.query().rows.map((r) => r.subjectId))],
      /** The M05 seam: BR-M06-14. `null` unknown set, `[]` not startable. */
      ramalanQuestions: (subjectId: number, year: number, setNo: number): number[] | null => {
        const row = sets.get(`${String(subjectId)}:${String(year)}:${String(setNo)}`)
        if (!row) return null
        const size = sizeOf(subjectId)
        const v = setView(row, size)
        if (!isStartable(v.status)) return []
        const eligibleIds = row.questionIds.filter((id) => questions.getEligible(id) !== null)
        return eligibleIds.slice(0, size)
      },

      // --- mock exams ---------------------------------------------------------------------------
      /** Seed / finalise: stores a complete exam row with its fixed id. */
      seedMock: (row: MockExamRow): void => {
        transaction(() => {
          store.insert(row)
        })
      },
      mock: (id: number): MockExamRow | undefined => store.get(id),
      mockView: (id: number): MockExamView | undefined => {
        const m = store.get(id)
        return m ? toView(m) : undefined
      },
      mockResult: (id: number): MockResult | undefined => {
        const m = store.get(id)
        return m && m.status === 'submitted' ? resultOf(m) : undefined
      },
      /** #12: the user's mocks, newest first. */
      mocksOf: (userId: number): MockListItem[] =>
        store
          .query({ where: { userId } })
          .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
          .map((m) => ({
            id: m.id,
            subject: m.subject,
            paperNumber: m.paperNumber,
            status: m.status,
            createdAt: m.createdAt,
            score: m.score,
            maxScore: m.maxScore,
            percent: m.percent,
            grade: m.grade,
          })),

      /** #13 (BR-M06-22): 30 objective items or 6 structured items of 10 marks (PROPOSED). */
      createMock: (
        userId: number,
        subject: string,
        paperNumber: 1 | 2,
        createdAt: string,
        rng: Prng,
      ): MockExamRow => {
        const subjectId = MOCK_SUBJECTS[subject] as number
        const name = subjectName(subjectId)
        let items: MockItem[]
        if (paperNumber === 1) {
          items = questions
            .spmPool({ subjectId })
            .sample(P1_ITEMS, rng)
            .map((q, i) => paper1Item(i + 1, q, name))
        } else {
          const pool = structured.visible({ subjectId, pageSize: 60 }).rows.slice()
          rng.shuffle(pool)
          items = pool.slice(0, P2_ITEMS).map((s, i) => ({
            no: i + 1,
            questionId: s.id,
            text: s.subQuestions[0]?.questionText ?? s.topic ?? name,
            modelAnswer: s.subQuestions.map((x) => x.modelAnswer).join('\n'),
            studentAnswer: null,
            marks: null,
            maxMarks: P2_ITEM_MARKS,
            feedback: null,
            topic: s.topic ?? name,
          }))
        }
        return transaction(() =>
          store.insert({
            userId,
            subject,
            subjectId,
            paperNumber,
            status: 'in_progress',
            createdAt,
            submittedAt: null,
            score: null,
            maxScore: items.reduce((a, i) => a + i.maxMarks, 0),
            percent: null,
            grade: null,
            items,
          }),
        )
      },

      /** #15 (BR-M06-24): grades the answers into the MockItem rows only (no M05 write, §6.5). */
      submitMock: (id: number, answers: readonly MockAnswerInput[], at: string): MockResult => {
        const m = store.get(id)
        if (!m) throw new Error(`unknown mock ${String(id)}`)
        const byNo = new Map(answers.map((a) => [a.no, a.answer.trim()]))
        const items = m.items.map((it): MockItem => {
          const given = byNo.get(it.no) ?? ''
          const answer = given === '' ? null : given
          if (m.paperNumber === 1) {
            const right = answer !== null && answer.toUpperCase() === it.modelAnswer
            return {
              ...it,
              studentAnswer: answer,
              marks: right ? 1 : 0,
              feedback: right
                ? 'Tahniah, jawapan anda betul.'
                : `Jawapan yang betul ialah ${it.modelAnswer}.`,
            }
          }
          const marks = markPaper2(answer, it.maxMarks)
          return {
            ...it,
            studentAnswer: answer,
            marks,
            feedback: paper2Feedback(marks, it.maxMarks),
          }
        })
        const score = items.reduce((a, i) => a + (i.marks ?? 0), 0)
        const percent = m.maxScore === 0 ? 0 : round2((score / m.maxScore) * 100)
        const updated = transaction(() =>
          store.update(id, {
            items,
            status: 'submitted',
            submittedAt: at,
            score,
            percent,
            grade: gradeOf(percent),
          }),
        )
        return resultOf(updated)
      },
    }
  },
})

export type SpmRepository = typeof spmRepo
export { setStatus }
export type { SetStatus }
