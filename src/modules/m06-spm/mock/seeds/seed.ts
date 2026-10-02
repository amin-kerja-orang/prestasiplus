/**
 * M06 seeds (SRS M06 v1.4 §6.10).
 *
 * - `seedM06` (seed phase): the SPM pool cells, contributed to the M04 dataset through
 *   `questions.contributeCells` (no direct `overrideSpec`). The anchors inside the pool (564157-564161,
 *   563393, 561050, 570021-570024) are owned by M04 (§6.11) and already sit in those cells, so M06 has
 *   no anchor rows of its own to contribute.
 * - `finaliseM06` (after every dataset compiled): the Tracking A 2026 sets (a deterministic pick from
 *   the pool), the mock exams and the student's subjective attempts.
 *
 * Seeds mirror observation; PROPOSED values are marked in the comments.
 */

import type { SeedContext } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'
import { questions, structured } from '@/modules/m04-question-bank/mock'

import type { MockItem } from '../../api/types'
import {
  MOCK_SUBJECTS,
  P1_ITEMS,
  POOL_ALLOCATION,
  SUBJECT_ID,
  TRACKING_SETS,
  TRACKING_YEAR,
} from '../data/config'
import { paper1Item, spmRepo } from '../repository/spm'
import { LETTERS } from '../repository/rules'
import type { MockExamRow } from '../tables/tables'

const ADMIN = 1
const STUDENT = 2

/** The pool cells of SRS §6.10, in the `questions.contributeCells` shape. */
export function poolCells() {
  return Object.entries(POOL_ALLOCATION).flatMap(([code, [t4, t5]]) =>
    (
      [
        [10, t4],
        [11, t5],
      ] as const
    ).flatMap(([level, byD]) =>
      byD.map((count, i) => ({
        facets: {
          subjectId: SUBJECT_ID[code] as number,
          educationLevelId: level,
          difficultyLevel: i + 1,
          spmPool: true as const,
        },
        count,
      })),
    ),
  )
}

/**
 * Seed phase. M04's default allocation is already exactly the §6.10 cells (a test asserts every cell),
 * so contributing them again changes nothing by default; it would, however, overwrite the M04 owner
 * override `reset({ questionStore: { spmPool } })` (M04 seeds first, M06 after), which M04's own tests
 * and the §6.11 short-filter case rely on. M06 therefore contributes only when the test passes its own
 * cells through `reset({ poolCells })`.
 */
export function seedM06(ctx: SeedContext): void {
  const cells = ctx.overrides.poolCells
  if (cells === undefined) return
  questions.contributeCells(ctx, cells as ReturnType<typeof poolCells>)
}

function seedTrackingSets(ctx: SeedContext): void {
  const rows: Parameters<typeof spmRepo.seedTrackingSets>[0][number][] = []
  for (const [code, sets] of Object.entries(TRACKING_SETS)) {
    const subjectId = SUBJECT_ID[code] as number
    const lengths = sets.map((s) => (s[2]) ?? (s[1] as number))
    const total = lengths.reduce((a, b) => a + b, 0)
    // One deterministic draw per subject, cut into consecutive chunks: disjoint sets (§6.10).
    const picked = questions
      .spmPool({ subjectId, educationLevelIds: [10, 11] })
      .sample(total, ctx.prng.fresh(`m06:tracking-${code}`))
    let at = 0
    sets.forEach((s, i) => {
      const n = lengths[i] as number
      rows.push({
        subjectId,
        year: TRACKING_YEAR,
        setNo: s[0] as number,
        questionIds: picked.slice(at, at + n).map((q) => q.id),
        dskpTagged: n,
      })
      at += n
    })
  }
  spmRepo.seedTrackingSets(rows)
}

const wrongLetter = (key: string): string => LETTERS[(LETTERS.indexOf(key as 'A') + 1) % 4] as string

/** Answers that give exactly `score` right of the items (a coprime stride picks the wrong ones). */
function p1Answers(items: readonly MockItem[], score: number) {
  const wrong = items.length - score
  return items.map((it, i) => ({
    no: it.no,
    answer: (i * 11) % items.length >= wrong ? it.modelAnswer : wrongLetter(it.modelAnswer),
  }))
}

function p1Items(ctx: SeedContext, code: string, key: string): MockItem[] {
  const subjectId = SUBJECT_ID[code] as number
  return questions
    .spmPool({ subjectId })
    .sample(P1_ITEMS, ctx.prng.fresh(`m06:mock-${key}`))
    .map((q, i) => paper1Item(i + 1, q, curriculum.subject(subjectId)?.name ?? ''))
}

function p2Items(subjectId: number): MockItem[] {
  return structured
    .visible({ subjectId, pageSize: 6 })
    .rows.map((s, i) => ({
      no: i + 1,
      questionId: s.id,
      text: s.subQuestions[0]?.questionText ?? s.topic ?? '',
      modelAnswer: s.subQuestions.map((x) => x.modelAnswer).join('\n'),
      studentAnswer: null,
      marks: null,
      maxMarks: 10,
      feedback: null,
      topic: s.topic ?? (curriculum.subject(subjectId)?.name ?? ''),
    }))
}

function exam(
  id: number,
  userId: number,
  subject: string,
  paperNumber: 1 | 2,
  createdAt: string,
  items: MockItem[],
): MockExamRow {
  return {
    id,
    userId,
    subject,
    subjectId: MOCK_SUBJECTS[subject] as number,
    paperNumber,
    status: 'in_progress',
    createdAt,
    submittedAt: null,
    score: null,
    maxScore: items.reduce((a, i) => a + i.maxMarks, 0),
    percent: null,
    grade: null,
    items,
  }
}

/** Admin mock 16 (BM Paper 1, 30 unanswered items; first three texts and keys as live). */
const LIVE_16: readonly { text: string; key: string }[] = [
  { text: "Apakah maksud perkataan 'inovatif' dalam konteks sains dan teknologi?", key: 'A' },
  { text: "Apakah tema utama dalam puisi 'Bumi Bertuah' karya A. Samad Said?", key: 'B' },
  { text: "Siapakah penulis novel 'Salina'?", key: 'A' },
]
/** Topic counts of mock 16: Sastra 11, Penulisan 10, Sosiobudaya 5, Kosa Kata 2, Tatabahasa 2. */
const TOPICS_16: readonly (readonly [string, number])[] = [
  ['Sastra', 11],
  ['Penulisan', 10],
  ['Sosiobudaya', 5],
  ['Kosa Kata', 2],
  ['Tatabahasa', 2],
]

function seedMocks(ctx: SeedContext): void {
  // admin 16: submitted 2026-05-25, nothing answered -> 0/30, 0.00%, G.
  const topics16 = TOPICS_16.flatMap(([t, n]) => Array.from({ length: n }, () => t))
  const items16 = p1Items(ctx, 'BM', '16').map((it, i) => {
    const live = LIVE_16[i]
    return {
      ...it,
      topic: topics16[i] as string,
      ...(live ? { text: live.text, modelAnswer: live.key } : {}),
    }
  })
  spmRepo.seedMock(exam(16, ADMIN, 'Bahasa Melayu', 1, '2026-05-25T10:00:00+08:00', items16))
  spmRepo.submitMock(16, [], '2026-05-25T10:40:00+08:00')
  // admin 317: Sejarah Paper 1, still in progress (created 2026-07-25).
  spmRepo.seedMock(
    exam(317, ADMIN, 'Sejarah', 1, '2026-07-25T10:00:00+08:00', p1Items(ctx, 'SEJ', '317')),
  )

  // student 318-327 (PROPOSED dates: one per day, 15-24 Sep 2026).
  const plan: readonly (readonly [string, string, 1 | 2, number | null])[] = [
    ['Matematik', 'MATH', 1, 29],
    ['Sains', 'SCI', 1, 25],
    ['Biologi', 'BIO', 1, 22],
    ['Fizik', 'PHY', 1, 19],
    ['Kimia', 'CHEM', 1, 16],
    ['Sejarah', 'SEJ', 1, 14],
    ['English', 'BI', 1, 12],
    ['Pendidikan Islam', 'PI', 1, 6],
    ['Matematik Tambahan', 'ADDMATH', 2, 38],
    ['Bahasa Melayu', 'BM', 2, null],
  ]
  plan.forEach(([subject, code, paper, score], i) => {
    const id = 318 + i
    const day = String(15 + i).padStart(2, '0')
    const createdAt = `2026-09-${day}T10:00:00+08:00`
    const items = paper === 1 ? p1Items(ctx, code, String(id)) : p2Items(SUBJECT_ID[code] as number)
    spmRepo.seedMock(exam(id, STUDENT, subject, paper, createdAt, items))
    if (score === null) return
    const at = `2026-09-${day}T10:45:00+08:00`
    if (paper === 1) {
      spmRepo.submitMock(id, p1Answers(items, score), at)
    } else {
      // Paper 2 38/60: the simulated marker gives round(10 x words / 60); 42 words = 7, 36 words = 6.
      const marks = [7, 6, 7, 6, 6, 6]
      const answers = items.map((it, k) => ({
        no: it.no,
        answer: Array.from({ length: (marks[k] as number) * 6 }, () => 'huraian').join(' '),
      }))
      spmRepo.submitMock(id, answers, at)
    }
  })
}

/** Student attempts of SRS §6.10: set 2510 (Matematik) 60%, set 3700 (BM, bahasa track) 75%. */
function seedSubjectiveAttempts(): void {
  const have = practice.structuredAttempts(STUDENT)
  const plan = [
    { id: 2510, pct: 60, track: null, at: '2026-09-23T19:30:00+08:00' },
    { id: 3700, pct: 75, track: 'bahasa' as const, at: '2026-09-24T19:30:00+08:00' },
  ]
  for (const p of plan) {
    const q = structured.get(p.id)
    if (!q) continue
    if (have.some((a) => a.structuredQuestionId === p.id && a.scope === 'spm')) continue
    const max = q.totalMarks > 0 ? q.totalMarks : 100
    practice.addStructuredAttempt({
      userId: STUDENT,
      structuredQuestionId: p.id,
      scope: 'spm',
      track: p.track,
      answers: [],
      marks: [],
      totalAwarded: Math.round(((max * p.pct) / 100) * 100) / 100,
      totalMax: max,
      submittedAt: p.at,
    })
  }
}

export function finaliseM06(ctx: SeedContext): void {
  seedTrackingSets(ctx)
  seedMocks(ctx)
  seedSubjectiveAttempts()
}


