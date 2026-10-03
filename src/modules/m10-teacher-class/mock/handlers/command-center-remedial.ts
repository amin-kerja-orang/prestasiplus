/**
 * Smart Remedial of the Command Center (SRS M10 v1.18 §7 #4–#6, BR-M10-11, BR-M10-12, FR-M10-22,
 * FR-M10-23).
 *
 * - **Scan** (BR-M10-11, DV-M10-03): for each student of S and each DSKP SP (the chapter when the
 *   question has no SP) with ≥ 2 answers, topic accuracy = correct ÷ answered × 100 (1 decimal); weak
 *   ⇔ < 50. A student with a weak topic is listed with the topics by ascending accuracy.
 * - **Generate** (BR-M10-12): up to 10 eligible questions for the student's weak topics of a subject
 *   → an `active` RemedialTest through M10's own `remedialTests` store (M05 reads it through the
 *   seams `forStudent` / `complete` / `get`; nothing is written to M05).
 * - **Cancel**: an active test of the viewer becomes `cancelled`.
 *
 * Question choice: (1) the eligible questions the student answered wrongly inside the weak topics,
 * newest first; (2) a top-up per weak topic that maps to a chapter (M04 `practiceQuery`); (3) the
 * subject pool at the student's level. M04 has no public read by `dskpSpId`. "Fewer if unavailable".
 */

import { toIsoMyt } from '@/lib/time'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import { dskpRepo } from '../repository/dskp'
import { remedialTestsRepo } from '../repository/remedial'
import type { RemedialTestRow } from '../repository/types'
import {
  round,
  percent,
  REMEDIAL_MAX_QUESTIONS,
  WEAK_BELOW,
  WEAK_MIN_ANSWERS,
} from './command-center-rules'
import { tally, type AnswerFact, type CcContext, type StudentFacts } from './command-center-data'

export interface WeakTopic {
  subjectId: number
  subject: string
  topicName: string
  accuracy: number
  /** `sp:{id}` or `ch:{id}`. */
  key: string
}

export interface WeakStudent {
  studentId: number
  name: string
  weakTopics: Omit<WeakTopic, 'subjectId' | 'key'>[]
  weakestAccuracy: number
}

export interface TopicInfo {
  spId: number | null
  chapterId: number | null
}

/** The topic keys of M04 questions (`dskpSpId`, else `curriculumChapterId`), by question id. */
export function topicInfoOf(ctx: CcContext): Map<number, TopicInfo> {
  const ids = new Set<number>()
  for (const s of ctx.students) for (const a of s.answers) ids.add(a.questionId)
  const out = new Map<number, TopicInfo>()
  for (const q of questions.getMany([...ids])) {
    out.set(q.id, { spId: q.dskpSpId, chapterId: q.curriculumChapterId })
  }
  return out
}

/** `sp:{id}` when the question has an SP, else `ch:{id}` of its chapter, else `null`. */
function topicKeyOf(info: ReadonlyMap<number, TopicInfo>, a: AnswerFact): string | null {
  const t = info.get(a.questionId)
  if (typeof t?.spId === 'number') return `sp:${String(t.spId)}`
  const chapter = t?.chapterId ?? a.chapterId
  return typeof chapter === 'number' ? `ch:${String(chapter)}` : null
}

const subjectName = (id: number): string => curriculum.subject(id)?.name ?? `Subjek ${String(id)}`

function topicName(key: string): string {
  const [kind, raw] = key.split(':')
  const id = Number(raw)
  if (kind === 'sp') return dskpRepo.getSp(id)?.description ?? `SP ${String(id)}`
  return curriculum.chapter(id)?.name ?? `Bab ${String(id)}`
}

/** BR-M10-11: the weak topics of one student, weakest first (all subjects). */
export function weakTopicsOf(
  student: StudentFacts,
  info: ReadonlyMap<number, TopicInfo>,
): WeakTopic[] {
  const by = new Map<string, { subjectId: number; answered: number; correct: number }>()
  for (const a of student.answers) {
    if (a.subjectId === null) continue
    const key = topicKeyOf(info, a)
    if (key === null) continue
    const cur = by.get(key) ?? { subjectId: a.subjectId, answered: 0, correct: 0 }
    cur.answered++
    if (a.isCorrect) cur.correct++
    by.set(key, cur)
  }
  const out: WeakTopic[] = []
  for (const [key, v] of by) {
    if (v.answered < WEAK_MIN_ANSWERS) continue
    const accuracy = round(percent(v.correct, v.answered), 1)
    if (accuracy >= WEAK_BELOW) continue
    out.push({
      subjectId: v.subjectId,
      subject: subjectName(v.subjectId),
      topicName: topicName(key),
      accuracy,
      key,
    })
  }
  return out.sort((a, b) => a.accuracy - b.accuracy || a.key.localeCompare(b.key))
}

/** #4 body. */
export function scanRemedial(ctx: CcContext) {
  const info = topicInfoOf(ctx)
  const weakStudents: WeakStudent[] = []
  for (const s of ctx.students) {
    const topics = weakTopicsOf(s, info)
    const weakest = topics[0]
    if (!weakest) continue
    weakStudents.push({
      studentId: s.id,
      name: s.name,
      weakTopics: topics.map(({ subject, topicName: name, accuracy }) => ({
        subject,
        topicName: name,
        accuracy,
      })),
      weakestAccuracy: weakest.accuracy,
    })
  }
  weakStudents.sort((a, b) => a.weakestAccuracy - b.weakestAccuracy || a.studentId - b.studentId)
  // BR-M10-11: the viewer's tests that are neither completed nor cancelled.
  const existingRemedials = remedialTestsRepo
    .forTeacher(ctx.viewerId)
    // URS FN-M10-2.2.11 ("Selesai ({x}%)") wins over the BR-M10-11 wording: completed tests are listed
    .filter((t) => t.status !== 'cancelled')
    .map((t) => ({
      id: t.id,
      studentId: t.studentId,
      status: t.status,
      totalQuestions: t.totalQuestions,
      afterAccuracy: t.afterAccuracy,
    }))
  return { weakStudents, existingRemedials }
}

/** A subject named by an id, a code ("CHEM") or a name ("Kimia"); case-insensitive. */
export function resolveSubject(value: string): { id: number; code: string; name: string } | null {
  const wanted = value.trim().toLowerCase()
  if (wanted === '') return null
  const all = curriculum.subjects()
  const hit =
    all.find((s) => String(s.id) === wanted) ??
    all.find((s) => s.code.toLowerCase() === wanted) ??
    all.find((s) => s.name.toLowerCase() === wanted)
  return hit ? { id: hit.id, code: hit.code, name: hit.name } : null
}

export type GenerateOutcome =
  { ok: true; test: RemedialTestRow } | { ok: false; reason: 'noQuestions' | 'alreadyOpen' }

/** BR-M10-12: builds and stores the test (the caller has checked the student and the subject). */
export function generateRemedial(
  ctx: CcContext,
  student: StudentFacts,
  subject: { id: number; code: string; name: string },
  now: number,
): GenerateOutcome {
  const open = remedialTestsRepo
    .forTeacher(ctx.viewerId)
    .some((t) => t.studentId === student.id && t.subjectId === subject.id && t.status === 'active')
  if (open) return { ok: false, reason: 'alreadyOpen' }

  const info = topicInfoOf(ctx)
  const weak = weakTopicsOf(student, info).filter((t) => t.subjectId === subject.id)
  if (weak.length === 0) return { ok: false, reason: 'noQuestions' }
  const weakKeys = new Set(weak.map((t) => t.key))

  const picked: number[] = []
  const taken = new Set<number>()
  // (1) eligible questions answered wrongly inside the weak topics, newest first
  for (let i = student.answers.length - 1; i >= 0 && picked.length < REMEDIAL_MAX_QUESTIONS; i--) {
    const a = student.answers[i]
    if (!a || a.isCorrect || a.subjectId !== subject.id || taken.has(a.questionId)) continue
    const key = topicKeyOf(info, a)
    if (key === null || !weakKeys.has(key)) continue
    if (!questions.eligibleForPractice(a.questionId)) continue
    taken.add(a.questionId)
    picked.push(a.questionId)
  }
  const levelId = student.grade === null ? undefined : curriculum.levelForGrade(student.grade)?.id
  const seedBase = `remedial:${String(ctx.viewerId)}:${String(student.id)}:${String(subject.id)}:${String(
    remedialTestsRepo.forStudent(student.id).length,
  )}`
  const take = (pool: readonly { id: number }[]): void => {
    for (const q of pool) {
      if (picked.length >= REMEDIAL_MAX_QUESTIONS) break
      if (taken.has(q.id)) continue
      taken.add(q.id)
      picked.push(q.id)
    }
  }
  // (2) top-up inside the weak topics, weakest first: each weak topic that maps to a chapter (a
  // `ch:` topic, or the chapter of the questions the student answered under an `sp:` topic) is
  // drawn through M04 `practiceQuery({ curriculumChapterId })`. M04's public contract has no read by
  // `dskpSpId`, so the exact SP cannot be drawn (recorded deviation from BR-M10-12).
  const chapterOf = new Map<string, number>()
  for (const a of student.answers) {
    if (a.subjectId !== subject.id) continue
    const key = topicKeyOf(info, a)
    if (key === null || !weakKeys.has(key) || chapterOf.has(key)) continue
    const chapter = info.get(a.questionId)?.chapterId ?? a.chapterId
    if (typeof chapter === 'number') chapterOf.set(key, chapter)
  }
  for (const t of weak) {
    if (picked.length >= REMEDIAL_MAX_QUESTIONS) break
    const chapter = chapterOf.get(t.key)
    if (chapter === undefined) continue
    take(
      questions.practiceQuery({
        subjectId: subject.id,
        curriculumChapterId: chapter,
        ...(levelId === undefined ? {} : { educationLevelIds: [levelId] }),
        excludeIds: [...taken],
        limit: REMEDIAL_MAX_QUESTIONS - picked.length,
        seed: `${seedBase}:${t.key}`,
      }),
    )
  }
  // (3) only then the subject pool at the student's level
  if (picked.length < REMEDIAL_MAX_QUESTIONS) {
    take(
      questions.practiceQuery({
        subjectId: subject.id,
        ...(levelId === undefined ? {} : { educationLevelIds: [levelId] }),
        excludeIds: [...taken],
        limit: REMEDIAL_MAX_QUESTIONS - picked.length,
        seed: seedBase,
      }),
    )
  }
  if (picked.length === 0) return { ok: false, reason: 'noQuestions' }

  const subjectTally = tally(student.answers.filter((a) => a.subjectId === subject.id))
  const test = remedialTestsRepo.create(
    {
      teacherId: ctx.viewerId,
      studentId: student.id,
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      questionIds: picked,
      beforeAccuracy: round(percent(subjectTally.correct, subjectTally.answered), 1),
    },
    toIsoMyt(now),
  )
  return { ok: true, test }
}
