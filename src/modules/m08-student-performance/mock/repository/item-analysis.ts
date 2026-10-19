/**
 * Item analysis read models (SRS M08 v1.11 §7 #9 school (S9), #11 class (S11); BR-M08-17, -18, -19).
 * The class figures are computed from the M05 answer log at request time (the answers of the class
 * members to questions of the class subject); the school question list is the stored DATA-M08-11 set.
 */

import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions, type Question } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import type {
  ClassItemAnalysis,
  ItemAnalysis,
  Letter,
  SchoolItemAnalysis,
  SchoolItemQuestion,
} from '../../api/types'
import { headcountReads } from './headcount-port'
import { fnv1a32 } from '@/mock/determinism/hash'
import { answerTotalsOf, checkStamp, classAnalysisMemo } from './reads'
import {
  capPercent,
  difficultyIndex,
  difficultyLevel,
  discriminationStatus,
  gpsBand,
  pct,
  round,
} from './rules'
import { gpsOf } from './performance'
import { itemStatisticsRepo, schoolSpmHistoryRepo } from './stores'

const LETTERS: readonly Letter[] = ['A', 'B', 'C', 'D']

// ---------------------------------------------------------------------------------------------
// #11 Class item analysis
// ---------------------------------------------------------------------------------------------

function optionOf(q: Question | null, index: number | null): { letter: Letter; text: string } {
  const i = index ?? 0
  return { letter: LETTERS[i] ?? 'A', text: q?.options?.[i] ?? '' }
}

interface Tally {
  attempts: number
  correct: number
  students: Set<number>
  wrong: Map<number, number>
  wrongOptions: Map<number, number>
}

/** Memoised until the log changes (a class with 90 members costs about 40 s cold: XR-M08-M05-02). */
export function classItemAnalysis(cls: ClassroomRow): ClassItemAnalysis {
  // The totals stamp (log size) clears the memo through `totalsOf`; the key adds a hash of the members.
  checkStamp()
  const members = classrooms.memberIds(cls.kind, cls.classId)
  const key = `${String(cls.classId)}:${String(fnv1a32(members.join(',')))}`
  const hit = classAnalysisMemo.get(key) as ClassItemAnalysis | undefined
  if (hit) return hit
  const out = computeClassItemAnalysis(cls)
  classAnalysisMemo.set(key, out)
  return out
}

function computeClassItemAnalysis(cls: ClassroomRow): ClassItemAnalysis {
  const memberIds = classrooms.memberIds(cls.kind, cls.classId)
  const subjectId = cls.subjectId
  const tallies = new Map<number, Tally>()
  const perMember = new Map<number, { n: number; c: number }>()
  const memberAnswers = new Map<number, { questionId: number; isCorrect: boolean }[]>()
  const finishedInSubject = new Set<number>()

  const facts = practice.answerFacts(memberIds, subjectId === null ? {} : { subjectId })
  for (const uid of memberIds) {
    const rows = facts.get(uid) ?? []
    const mine: { questionId: number; isCorrect: boolean }[] = []
    for (const a of rows) {
      const t = tallies.get(a.questionId) ?? {
        attempts: 0,
        correct: 0,
        students: new Set<number>(),
        wrong: new Map<number, number>(),
        wrongOptions: new Map<number, number>(),
      }
      t.attempts++
      t.students.add(uid)
      if (a.isCorrect) t.correct++
      else {
        t.wrong.set(uid, (t.wrong.get(uid) ?? 0) + 1)
        if (a.selectedOptionId !== null) {
          t.wrongOptions.set(a.selectedOptionId, (t.wrongOptions.get(a.selectedOptionId) ?? 0) + 1)
        }
      }
      tallies.set(a.questionId, t)
      const m = perMember.get(uid) ?? { n: 0, c: 0 }
      m.n++
      if (a.isCorrect) m.c++
      perMember.set(uid, m)
      mine.push({ questionId: a.questionId, isCorrect: a.isCorrect })
    }
    memberAnswers.set(uid, mine)
    // BR-M08-19: a member counts when they have ≥ 1 finished session in the class subject.
    if (practice.history(uid).some((s) => subjectId === null || s.subjectId === subjectId)) {
      finishedInSubject.add(uid)
    }
  }

  const qids = [...tallies.keys()]
  const qRows = new Map(qids.map((id) => [id, questions.get(id)]))
  const difficulty: ItemAnalysis['difficulty'] = qids
    .map((questionId) => {
      const t = tallies.get(questionId) as Tally
      const q = qRows.get(questionId) ?? null
      const index = difficultyIndex(t.correct, t.attempts)
      let popular: { idx: number; times: number } | null = null
      for (const [idx, times] of [...t.wrongOptions.entries()].sort((a, b) => a[0] - b[0])) {
        if (popular === null || times > popular.times) popular = { idx, times }
      }
      const subject = q?.subjectId ? (curriculum.subject(q.subjectId)?.name ?? '') : ''
      const topic = q?.curriculumTopicId
        ? (curriculum.topic(q.curriculumTopicId)?.name ?? null)
        : null
      return {
        questionId,
        text: q?.questionText ?? '',
        subject,
        topic,
        // M04 rows carry a topic id only; the subtopic is not on the question (SRS gap, XR-M08-M04-01).
        subtopic: null,
        attempts: t.attempts,
        students: t.students.size,
        accuracy: round(capPercent(pct(t.correct, t.attempts)), 1),
        index,
        level: difficultyLevel(index),
        wrongStudents: [...t.wrong.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([userId, times]) => ({
            userId,
            name: users.get(userId)?.name ?? `Murid ${String(userId)}`,
            times,
          })),
        correctOption: optionOf(q, q?.correctAnswer ?? null),
        popularWrong: popular ? { ...optionOf(q, popular.idx), times: popular.times } : null,
      }
    })
    // Default order: Indeks descending, ties by question id (BR-M08-18).
    .sort((a, b) => b.index - a.index || a.questionId - b.questionId)

  const summary = { mudah: 0, sederhana: 0, sukar: 0 }
  for (const d of difficulty) {
    if (d.level === 'Mudah') summary.mudah++
    else if (d.level === 'Sederhana') summary.sederhana++
    else summary.sukar++
  }

  // BR-M08-19 discrimination.
  const N = finishedInSubject.size
  const sufficient = N >= 4
  const rows: ItemAnalysis['discrimination']['rows'] = []
  if (sufficient) {
    const ranked = [...finishedInSubject].sort((a, b) => {
      const ma = perMember.get(a) ?? { n: 0, c: 0 }
      const mb = perMember.get(b) ?? { n: 0, c: 0 }
      return pct(mb.c, mb.n) - pct(ma.c, ma.n) || a - b
    })
    const g = Math.max(1, Math.round(0.27 * N))
    const upper = new Set(ranked.slice(0, g))
    const lower = new Set(ranked.slice(-g))
    const group = (set: Set<number>, qid: number) => {
      let n = 0
      let c = 0
      for (const uid of set) {
        for (const a of memberAnswers.get(uid) ?? []) {
          if (a.questionId !== qid) continue
          n++
          if (a.isCorrect) c++
        }
      }
      return { n, c }
    }
    for (const questionId of qids) {
      const u = group(upper, questionId)
      const l = group(lower, questionId)
      if (u.n === 0 || l.n === 0) continue
      const d = round(u.c / u.n - l.c / l.n, 3)
      rows.push({
        questionId,
        text: qRows.get(questionId)?.questionText ?? '',
        upperPct: round(pct(u.c, u.n), 1),
        lowerPct: round(pct(l.c, l.n), 1),
        index: d,
        status: discriminationStatus(d),
      })
    }
    rows.sort((a, b) => b.index - a.index || a.questionId - b.questionId)
  }

  return {
    class: {
      id: cls.classId,
      name: cls.name,
      subjectName:
        cls.subjectId === null ? null : (curriculum.subject(cls.subjectId)?.name ?? null),
      levelSlug: cls.educationLevel,
      year: cls.academicYear,
      students: memberIds.length,
    },
    analysis: {
      questionCount: qids.length,
      summary,
      difficulty,
      discrimination: { sufficient, rows },
    },
  }
}

// ---------------------------------------------------------------------------------------------
// #9 School item analysis
// ---------------------------------------------------------------------------------------------

/** Per-subject rows from the answer log (M05 `answerFacts`: one pass over the pupils). */
function computedSubjects(pupilIds: readonly number[]): SchoolItemAnalysis['subjects'] {
  const bySubject = new Map<
    number,
    { pupils: Set<number>; questions: Set<number>; n: number; c: number }
  >()
  const facts = practice.answerFacts(pupilIds)
  for (const id of pupilIds) {
    for (const a of facts.get(id) ?? []) {
      if (a.subjectId === null) continue
      const s = bySubject.get(a.subjectId) ?? {
        pupils: new Set<number>(),
        questions: new Set<number>(),
        n: 0,
        c: 0,
      }
      s.pupils.add(id)
      s.questions.add(a.questionId)
      s.n++
      if (a.isCorrect) s.c++
      bySubject.set(a.subjectId, s)
    }
  }
  return [...bySubject.entries()]
    .map(([subjectId, s]) => ({
      subjectId,
      name: curriculum.subject(subjectId)?.name ?? `Subjek ${String(subjectId)}`,
      pupils: s.pupils.size,
      questions: s.questions.size,
      accuracy: round(capPercent(pct(s.c, s.n)), 1),
      wrong: s.n - s.c,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || a.subjectId - b.subjectId)
}

const TINGKATAN_LEVEL: Readonly<Record<'T4' | 'T5', number>> = { T4: 10, T5: 11 }

export function schoolItemAnalysis(
  schoolId: number,
  tingkatan: 'T4' | 'T5' | null,
  variant: 'own' | 'byId',
): SchoolItemAnalysis | null {
  const school = schools.get(schoolId)
  if (!school) return null
  const all = users.adminList({ role: 'student', schoolId, pageSize: 100_000 }).rows
  // BR-M08-17: with `tingkatan`, the school's pupils enrolled in classes of that level.
  const pupils =
    tingkatan === null
      ? all
      : all.filter((u) =>
          classrooms
            .enrolmentsOf(u.id)
            .some((e) => e.status === 'active' && e.levelId === TINGKATAN_LEVEL[tingkatan]),
        )
  const observed = itemStatisticsRepo.summary(schoolId, tingkatan)
  const stored = itemStatisticsRepo.forScope('school', schoolId, tingkatan)
  let studentsShown = pupils.length
  let answers: number | null = 0
  let correct: number | null = 0
  let accuracyShown: number | null
  let subjects: SchoolItemAnalysis['subjects']
  if (observed) {
    // DISPLAY_CONSTANT (DV-M08-32): the observed S30 rows; the M05 log cannot reproduce them.
    studentsShown = observed.students
    answers = observed.answers
    accuracyShown = observed.accuracy
    correct = Math.round((observed.answers * observed.accuracy) / 100)
    subjects = observed.subjects.map((s) => ({
      subjectId: curriculum.subjects().find((x) => x.name === s.name)?.id ?? 0,
      name: s.name,
      pupils: s.pupils,
      questions: s.questions,
      accuracy: s.accuracy,
      wrong: s.wrong,
    }))
  } else if (stored.length > 0) {
    // D11 coherence (DV-M08-32): the stored question list of this view is observed, its header is not,
    // and the log contradicts the observed list, so no computed header or subject table is shown.
    answers = null
    correct = null
    accuracyShown = null
    subjects = []
  } else {
    let n = 0
    let c = 0
    for (const u of pupils) {
      const t = answerTotalsOf(u.id)
      n += t.answered
      c += t.correct
    }
    answers = n
    correct = c
    accuracyShown = round(capPercent(pct(c, n)), 1)
    subjects = computedSubjects(pupils.map((u) => u.id))
  }
  const catalogue = new Map(itemStatisticsRepo.catalogue().map((q) => [q.id, q]))
  const denominator = Math.max(1, pupils.length)
  const list: SchoolItemQuestion[] = stored.map((r) => {
    const q = questions.get(r.questionId)
    const cat = catalogue.get(r.questionId)
    const correctLetter = (
      q?.correctAnswer !== null && q?.correctAnswer !== undefined
        ? LETTERS[q.correctAnswer]
        : cat?.correct
    ) as Letter
    const text = (letter: Letter | null): string =>
      letter === null
        ? ''
        : (q?.options?.[LETTERS.indexOf(letter)] ?? cat?.known[letter] ?? `Pilihan ${letter}`)
    return {
      rank: r.rank,
      questionId: r.questionId,
      stem: q?.questionText ?? cat?.stem ?? '',
      subjectName:
        (q?.subjectId ? curriculum.subject(q.subjectId)?.name : undefined) ??
        cat?.subjectName ??
        '',
      chips: cat ? [cat.topic, cat.subtopic] : [],
      level: difficultyLevel(difficultyIndex(r.attempts - r.wrong, r.attempts)),
      wrongPct: round(pct(r.wrong, r.attempts), 1),
      attempts: r.attempts,
      pupils: r.pupils,
      pupilsPct: round(pct(r.pupils, denominator), 1),
      wrongPupils: r.wrongPupils.map((w) => ({
        userId: w.userId,
        name: users.get(w.userId)?.name ?? `Murid ${String(w.userId)}`,
        classLabel: w.classLabel,
        wrongOption: w.wrongOption,
      })),
      correctOption: { letter: correctLetter, text: text(correctLetter) },
      popularWrongOption:
        r.popularWrongOption === null
          ? null
          : { letter: r.popularWrongOption, text: text(r.popularWrongOption) },
      popularWrongCount: r.popularWrongCount,
    }
  })
  const difficulty = { mudah: 0, sederhana: 0, sukar: 0 }
  for (const q of list) {
    if (q.level === 'Mudah') difficulty.mudah++
    else if (q.level === 'Sederhana') difficulty.sederhana++
    else difficulty.sukar++
  }

  const pupilIds = new Set(all.map((u) => u.id))
  const gps = gpsOf(headcountReads.entries().filter((e) => pupilIds.has(e.studentId)))
  const history = schoolSpmHistoryRepo.platform()

  return {
    school: {
      id: school.id,
      name: school.name,
      code: school.code === '' ? null : school.code,
      type: school.type,
      district: school.district,
      state: school.state,
    },
    variant,
    tingkatan,
    students: studentsShown,
    answers,
    correct,
    accuracy: accuracyShown,
    difficulty,
    gps: {
      value: gps.value,
      band: gps.value === null ? null : gpsBand(gps.value),
      entries: gps.entries,
      years: history.map((h) => ({ year: h.year, gps: h.gps })),
    },
    subjects,
    questions: list,
  }
}
