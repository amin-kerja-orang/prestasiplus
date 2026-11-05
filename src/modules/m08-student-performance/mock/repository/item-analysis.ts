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
  ItemAnalysisMe,
  ItemMeCategory,
  ItemMeItem,
  ItemMeSubject,
  ItemMeTapis,
  Letter,
  SchoolItemAnalysis,
  SchoolItemQuestion,
  Tingkatan,
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
        level: difficultyLevel(pct(t.correct, t.attempts)),
        wrongStudents: [...t.wrong.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([userId, times]) => ({
            userId,
            name: users.get(userId)?.name ?? `Murid ${String(userId)}`,
            times,
          })),
        correctOption: q?.correctAnswer == null ? null : optionOf(q, q.correctAnswer),
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
      const d = round(u.c / u.n - l.c / l.n, 2)
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

/** Level ids of Tingkatan 1 to 5 in the enrolment rows (T4 / T5 observed as 10 / 11; T1 to T3 follow in sequence). */
const TINGKATAN_LEVEL: Readonly<Record<Tingkatan, number>> = { T1: 7, T2: 8, T3: 9, T4: 10, T5: 11 }
const TINGKATAN_ORDER: readonly Tingkatan[] = ['T1', 'T2', 'T3', 'T4', 'T5']

export function schoolItemAnalysis(
  schoolId: number,
  tingkatan: Tingkatan | null,
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
      level: difficultyLevel(pct(r.attempts - r.wrong, r.attempts)),
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

  // AC-AS-6-6: the Tingkatan that have data (a pupil enrolled at that level, or a stored / observed view).
  const enrolledLevels = new Set<number>()
  for (const u of all) {
    for (const e of classrooms.enrolmentsOf(u.id)) {
      if (e.status === 'active') enrolledLevels.add(e.levelId)
    }
  }
  const tingkatanOptions = TINGKATAN_ORDER.filter(
    (t) =>
      enrolledLevels.has(TINGKATAN_LEVEL[t]) ||
      itemStatisticsRepo.summary(schoolId, t) !== undefined ||
      itemStatisticsRepo.forScope('school', schoolId, t).length > 0,
  )
  // FR-AS-6-5 "Soalan Diuji" (XS-7): distinct questions; a question belongs to one subject, so the subject rows add up.
  const questionsTested =
    subjects.length > 0 ? subjects.reduce((sum, s) => sum + s.questions, 0) : stored.length

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
    tingkatanOptions,
    questionsTested,
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

// ---------------------------------------------------------------------------------------------
// GET /api/item-analysis/me (API-RPT-05, R1-MUR-6): the pupil's own Analisa Item
// ---------------------------------------------------------------------------------------------

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  random: 'Latih Tubi',
  latih_tubi: 'Latih Tubi',
  chapter: 'Latihan Bab',
  revision: 'Ulang Kaji',
  past_year: 'Soalan Tahun Lepas',
  ramalan: 'Ramalan',
  mission: 'Misi',
  remedial: 'Ujian Remedial',
  question_set: 'Set Soalan',
  pksk: 'PKSK',
}

interface MeTally {
  questionId: number
  attempts: number
  correct: number
  lastAt: string
  lastMs: number
  subjectId: number | null
  chapterId: number | null
  sessionId: string | null
}

/** FR-MUR-6-3: attempts 1 and correct 0 = Isyarat Awal; ≥ 2 and 0 correct = Pemulihan; ≥ 2 and 0 < correct < attempts = Pengukuhan. */
export function categoryOf(attempts: number, correct: number): ItemMeCategory | null {
  if (correct === 0) return attempts === 1 ? 'isyarat_awal' : attempts >= 2 ? 'pemulihan' : null
  return attempts >= 2 && correct < attempts ? 'pengukuhan' : null
}

/** `tapis` filters the items only (decision 7): `ada_betul` correct ≥ 1; `selalu_salah` ≥ 2 attempts, every answer wrong. */
export function passesTapis(t: { attempts: number; correct: number }, tapis: ItemMeTapis): boolean {
  if (tapis === 'ada_betul') return t.correct >= 1
  if (tapis === 'selalu_salah') return t.attempts >= 2 && t.correct === 0
  return true
}

export function itemAnalysisMe(
  userId: number,
  subjectCode: string | null,
  tapis: ItemMeTapis,
): ItemAnalysisMe {
  const rows = practice.answers(userId)
  const byQuestion = new Map<number, MeTally>()
  const subjectIds = new Set<number>()
  for (const a of rows) {
    const q = questions.get(a.questionId)
    // FR-MUR-6-5: an archived question no longer appears.
    if (q?.status === 'archived') continue
    const t = byQuestion.get(a.questionId) ?? {
      questionId: a.questionId,
      attempts: 0,
      correct: 0,
      lastAt: a.answeredAt,
      lastMs: a.answeredAtMs,
      subjectId: a.subjectId,
      chapterId: a.chapterId,
      sessionId: a.sessionId,
    }
    t.attempts++
    if (a.isCorrect) t.correct++
    if (a.answeredAtMs >= t.lastMs) {
      t.lastAt = a.answeredAt
      t.lastMs = a.answeredAtMs
      t.sessionId = a.sessionId
    }
    byQuestion.set(a.questionId, t)
    if (a.subjectId !== null) subjectIds.add(a.subjectId)
  }

  // Subject cards: every subject of the pupil, ascending accuracy (Subjek Perlu Perhatian).
  const subjects: ItemMeSubject[] = []
  for (const sid of subjectIds) {
    const subject = curriculum.subject(sid)
    if (!subject) continue
    let attempts = 0
    let correct = 0
    let weakRepeated = 0
    let earlySignalWeak = 0
    let uniqueQuestions = 0
    for (const t of byQuestion.values()) {
      if (t.subjectId !== sid) continue
      uniqueQuestions++
      attempts += t.attempts
      correct += t.correct
      const c = categoryOf(t.attempts, t.correct)
      if (c === 'pemulihan' || c === 'pengukuhan') weakRepeated++
      else if (c === 'isyarat_awal') earlySignalWeak++
    }
    subjects.push({
      code: subject.code,
      name: subject.name,
      attempts,
      uniqueQuestions,
      accuracy: attempts === 0 ? null : round(capPercent(pct(correct, attempts)), 1),
      wrongAnswers: attempts - correct,
      weakRepeated,
      earlySignalWeak,
    })
  }
  subjects.sort(
    (a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || a.code.localeCompare(b.code),
  )

  const scopeId = subjectCode === null ? null : (curriculum.subjectByCode(subjectCode)?.id ?? -1)
  const scoped = [...byQuestion.values()].filter((t) => scopeId === null || t.subjectId === scopeId)
  let answered = 0
  let correctAll = 0
  const counts = { isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 }
  const items: ItemMeItem[] = []
  for (const t of scoped) {
    answered += t.attempts
    correctAll += t.correct
    const category = categoryOf(t.attempts, t.correct)
    if (category === null) continue
    if (category === 'isyarat_awal') counts.isyaratAwal++
    else if (category === 'pemulihan') counts.pemulihan++
    else counts.pengukuhan++
    if (!passesTapis(t, tapis)) continue
    const q = questions.get(t.questionId)
    if (!q) continue
    const mode = t.sessionId === null ? undefined : practice.session(t.sessionId)?.mode
    items.push({
      questionId: t.questionId,
      category,
      attempts: t.attempts,
      correct: t.correct,
      wrongTimes: t.attempts - t.correct,
      lastAnsweredAt: t.lastAt,
      subject: t.subjectId === null ? '' : (curriculum.subject(t.subjectId)?.name ?? ''),
      chapter: t.chapterId === null ? null : (curriculum.chapter(t.chapterId)?.name ?? null),
      source: mode === undefined ? 'Latih Tubi' : (SOURCE_LABEL[mode] ?? 'Latih Tubi'),
      question: {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        language: q.language,
        textDirection: q.textDirection,
        scriptType: q.scriptType,
        pointsValue: q.pointsValue,
      },
      stimulusGroup: null,
      explanation: q.explanation && q.explanation.trim() !== '' ? q.explanation : null,
    })
  }
  // Inside a list: attempts descending, then the last attempt descending (R1-MUR-6).
  items.sort(
    (a, b) =>
      b.attempts - a.attempts ||
      b.lastAnsweredAt.localeCompare(a.lastAnsweredAt) ||
      Number(a.questionId) - Number(b.questionId),
  )

  return {
    tiles: {
      answered,
      needRemedial: counts.pemulihan,
      needStrengthen: counts.pengukuhan,
      mastery: answered === 0 ? null : round(capPercent(pct(correctAll, answered)), 1),
    },
    subjects,
    counts,
    items,
  }
}
