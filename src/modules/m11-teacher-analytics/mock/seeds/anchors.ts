/**
 * Seed contributions of M11 to the owners' stores (SRS M11 v1.10 §6.7, M04 §6.13.2 "M11 anchors", M05
 * §6.14.1 anchors): through `questions.contributeAnchors` (M04: the 531 anchor questions 700401–700931 with
 * `chapterLabel` and `curriculumTopicId`) and `practice.contributeAnswers` / `contributeSessions` (M05:
 * the observed answers of Students A, B and C and the answers behind the S5 rows of D, E, F, G, I, J).
 * M11 stores none of it (D12): the figures on S3–S5 are computed from the owners' stores.
 *
 * Each run of `../data/anchors.ts` becomes one anchor session of its pupil ("XA01" …), mode `random`
 * (M05 §6.14), ending at the newest answer of the run, so the pupil's last activity is the session's
 * `completedAt` (the answers end at it, M05 §6.14.1).
 */

import { fnv1a32 } from '@/mock/determinism'
import type { SeedContext } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions, type Question } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

import {
  A_OBSERVED_QUESTIONS,
  ANSWER_ID_START,
  OTHER_ANCHORS,
  QUESTION_BLOCK_SIZE,
  QUESTION_BLOCK_START,
  QUESTION_PUPILS,
  STUDENT_A,
  T1,
  T5,
  spread,
  type PupilAnchor,
  type Run,
  type RunAnswer,
  type TopicRef,
} from '../data/anchors'

/** The M11 8080 anchors 2001–2011 (M02 §6.15 C): no flag is given to them. */
export const RESERVED_PUPILS: ReadonlySet<number> = new Set(
  Array.from({ length: 11 }, (_, i) => 2001 + i),
)

const LETTERS = 4

/**
 * The M03 topic of a chapter number and name (the lowest id among duplicates, INFERRED). Four observed
 * Tajuk rows of Student A (Bab 1 "Kemahiran Membaca dan Memahami", Bab 3 "Tatabahasa", Bab 5 "Dunia
 * Baharu Tani", Bab 13 "Cergas Aktif") exist in M03 only as **chapter** titles (level 7), not as topics:
 * the anchor then points at the chapter's first topic, so S4 shows that topic's M03 name (SRS gap
 * reported with M11-T1; counts, Bab and percentages are the observed ones).
 */
function topicIdOf(subjectId: number, ref: TopicRef): number {
  let byTopic: number | null = null
  let byChapter: number | null = null
  for (let level = T1; level <= T5; level++) {
    for (const chapter of curriculum.chapters(subjectId, level)) {
      if (chapter.chapterNumber !== ref.bab) continue
      const topics = curriculum.topics(chapter.id)
      for (const topic of topics) {
        if (topic.name === ref.name && (byTopic === null || topic.id < byTopic)) byTopic = topic.id
      }
      const first = topics[0]
      if (chapter.name === ref.name && first && (byChapter === null || first.id < byChapter)) {
        byChapter = first.id
      }
    }
  }
  const best = byTopic ?? byChapter
  if (best === null) {
    throw new Error(
      `M11 anchors: no M03 topic or chapter "Bab ${String(ref.bab)} ${ref.name}" in subject ${String(subjectId)}`,
    )
  }
  return best
}

interface FlatAnswer {
  pupil: PupilAnchor
  run: Run
  runIndex: number
  /** 0 = the newest answer of the run. */
  index: number
  answer: RunAnswer
  questionId: number
}

/** Question ids of the block, newest first within each pupil (A, then B, then C). */
function flatten(): FlatAnswer[] {
  const out: FlatAnswer[] = []
  let id = QUESTION_BLOCK_START
  for (const pupil of QUESTION_PUPILS) {
    pupil.runs.forEach((run, runIndex) => {
      run.answers.forEach((answer, index) => {
        out.push({ pupil, run, runIndex, index, answer, questionId: id++ })
      })
    })
  }
  if (id - QUESTION_BLOCK_START !== QUESTION_BLOCK_SIZE) {
    throw new Error(
      `M11 anchors: ${String(id - QUESTION_BLOCK_START)} questions, M04 §6.13.2 allocates ${String(QUESTION_BLOCK_SIZE)}`,
    )
  }
  return out
}

function questionRow(f: FlatAnswer, subjectName: string, aRow: number | null): Question {
  const obs = aRow === null ? undefined : A_OBSERVED_QUESTIONS[aRow]
  const key = f.answer.key ?? fnv1a32(`m11:key:${String(f.questionId)}`) % LETTERS
  const options =
    obs?.options !== undefined
      ? [...obs.options]
      : ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D']
  return questions.anchorRow({
    id: f.questionId,
    subjectId: f.run.subjectId,
    educationLevelId: f.run.levelId,
    spmPool: f.run.levelId >= 10,
    ...(obs?.difficulty !== undefined ? { difficultyLevel: obs.difficulty } : {}),
    questionText:
      obs?.text ?? `Soalan M11 ${String(f.questionId)} (${subjectName}): pilih jawapan yang betul.`,
    options,
    correctAnswer: key,
    explanation: obs?.explanation ?? null,
    sourceSet: obs?.source ?? null,
    chapterLabel: f.run.label,
    curriculumTopicId: f.answer.topic ? topicIdOf(f.run.subjectId, f.answer.topic) : null,
    createdAt: '2026-01-06T09:00:00+08:00',
  })
}

const iso = (ms: number): string => new Date(ms).toISOString()

type AnswerInput = Parameters<typeof practice.contributeAnswers>[1][number]
type SessionInput = Parameters<typeof practice.contributeSessions>[1][number]

export function contributeAnchors(ctx: SeedContext): void {
  const flat = flatten()
  const subjectName = (id: number) => curriculum.subject(id)?.name ?? `Subjek ${String(id)}`

  // --- M04: the 531 anchor questions ---------------------------------------------------------------
  const rows = flat.map((f) => {
    const aRow =
      f.pupil === STUDENT_A && f.runIndex === 0 && f.index < A_OBSERVED_QUESTIONS.length
        ? f.index
        : null
    return questionRow(f, subjectName(f.run.subjectId), aRow)
  })
  questions.contributeAnchors(ctx, rows)

  // --- M05: answers and sessions of A, B, C ----------------------------------------------------------
  const answers: AnswerInput[] = []
  const sessions: SessionInput[] = []
  let nextAnswer = ANSWER_ID_START
  const key = (pupil: PupilAnchor, n: number) => `${pupil.key}${String(n).padStart(2, '0')}`
  for (const pupil of QUESTION_PUPILS) {
    pupil.runs.forEach((run, runIndex) => {
      const sessionId = key(pupil, runIndex + 1)
      const endMs = Date.parse(run.end)
      const mine = flat.filter((f) => f.pupil === pupil && f.runIndex === runIndex)
      for (const f of mine) {
        const key4 = f.answer.key ?? fnv1a32(`m11:key:${String(f.questionId)}`) % LETTERS
        const pick = f.answer.pick ?? (f.answer.ok ? key4 : (key4 + 1) % LETTERS)
        answers.push({
          id: nextAnswer++,
          userId: pupil.userId,
          questionId: f.questionId,
          isCorrect: f.answer.ok,
          answeredAt: iso(endMs - f.index * run.step * 1000),
          sessionId,
          selectedOptionId: pick,
        })
      }
      sessions.push({
        id: sessionId,
        userId: pupil.userId,
        mode: 'random',
        completedAt: iso(endMs),
        questionCount: run.answers.length,
        correctCount: run.answers.filter((a) => a.ok).length,
        subjectId: run.subjectId,
        levelId: run.levelId,
        timeSpent: Math.max(1, (run.answers.length - 1) * run.step),
        questionIds: mine.map((f) => f.questionId),
      })
    })
  }

  // --- M05: the S5 rows of D, E, F, G, I, J (answers to the T5 anchor questions) -----------------------
  const t5 = flat.filter((f) => f.run.levelId === T5).map((f) => f.questionId)
  const sessionSize = 50
  const need = Math.max(...OTHER_ANCHORS.map((a) => a[2]))
  if (t5.length < need) {
    throw new Error(
      `M11 anchors: ${String(t5.length)} T5 anchor questions, the S5 rows need ${String(need)} distinct ones`,
    )
  }
  for (const [prefix, userId, n, c, last] of OTHER_ANCHORS) {
    const fate = spread(n, c)
    const lastMs = Date.parse(last)
    const chunks = Math.ceil(n / sessionSize)
    for (let s = 0; s < chunks; s++) {
      const from = s * sessionSize
      const to = Math.min(n, from + sessionSize)
      const endMs = lastMs - s * 3_600_000
      const sessionId = `${prefix}${String(s + 1).padStart(2, '0')}`
      const qids: number[] = []
      for (let i = from; i < to; i++) {
        const questionId = t5[i] as number
        const ok = (fate[i] as RunAnswer).ok
        qids.push(questionId)
        answers.push({
          id: nextAnswer++,
          userId,
          questionId,
          isCorrect: ok,
          answeredAt: iso(endMs - (i - from) * 10_000),
          sessionId,
        })
      }
      sessions.push({
        id: sessionId,
        userId,
        mode: 'random',
        completedAt: iso(endMs),
        questionCount: qids.length,
        correctCount: fate.slice(from, to).filter((a) => a.ok).length,
        levelId: T5,
        timeSpent: Math.max(1, (qids.length - 1) * 10),
        questionIds: qids,
      })
    }
  }

  practice.contributeAnswers(ctx, answers)
  practice.contributeSessions(ctx, sessions)
}
