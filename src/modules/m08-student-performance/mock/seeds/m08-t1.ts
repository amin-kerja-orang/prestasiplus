/**
 * M08-T1 seed (SRS M08 v1.11 §6.10; overview §6.9). Three phases:
 *
 * - `seedM08(ctx)` (seed phase; no dataset reads): resets the read caches, contributes the 51 fixture
 *   questions to M04 and the designed sessions H01–H14 with their 83 answers to M05 (owners'
 *   contracts only), and writes the M08-owned stores that need no other module: SchoolSpmHistory, the
 *   admin's SpRecords, the designed pupils' SpRecords (derived from their designed answers), the class
 *   2001 risk profiles, the timeline posts, the ranking entries and the leaderboard display rows.
 * - `finaliseM08(ctx)` (after every dataset compiled): the rows that need users and classes: the
 *   class-4 risk profiles, the LearnerActivityStats, and the ItemStatistic sets with their pupils.
 */

import type { SeedContext } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import {
  ANSWER_ID_START,
  CLASS_KIMIA,
  designedSessions,
  fixtureQuestions,
  KIMIA,
} from '../data/designed'
import { DESIGNED_SP_PERFORMANCE } from '../data/dskp-performance'
import { CRITICAL_QUESTIONS, ITEM_SEED_SETS } from '../data/item-statistics'
import {
  ADMIN_GENERATED,
  ADMIN_WEAK_CARDS,
  CLASS4_BM,
  CLASS4_SEJ_RISK,
  ADMIN_GENERATED_SP,
  PLATFORM_SPM,
  RANKING_ENTRIES,
  RISK_2001,
  SCHOOL_SPM,
} from '../data/observed'
import {
  GENERATED_STANDINGS,
  OBSERVED_STANDINGS,
  SCHOOL_ITEM_SUMMARIES,
} from '../constants/display'
import { resetHookState } from '../hooks'
import { resetReadCache } from '../repository/reads'
import { projection, round } from '../repository/rules'
import {
  activityRepo,
  itemStatisticsRepo,
  rankingsRepo,
  schoolSpmHistoryRepo,
  spRecordsRepo,
  standingsRepo,
  timelineRepo,
} from '../repository/stores'
import type {
  ActivityRow,
  ItemStatisticRow,
  RiskProfileRow,
  SpRecordRow,
  StandingRow,
} from '../repository/types'

const ADMIN = 1

const spId = (userId: number, subjectId: number, sp: number) =>
  `${String(userId)}:${String(subjectId)}:${String(sp)}`

// ---------------------------------------------------------------------------------------------
// Seed phase
// ---------------------------------------------------------------------------------------------

function contributeQuestions(ctx: SeedContext): void {
  const rows = fixtureQuestions().map((q) =>
    questions.anchorRow({
      id: q.id,
      subjectId: q.subjectId,
      educationLevelId: q.levelId,
      spmPool: q.spmPool,
      dskpSpId: q.dskpSpId,
      ...(q.difficultyLevel !== undefined ? { difficultyLevel: q.difficultyLevel } : {}),
      complianceStatus: 'verified',
      sourceType: 'textbook',
      questionText: q.text,
      options: q.options,
      correctAnswer: q.correct,
      sourceSet: 'm08_fixture',
      createdAt: '2026-01-06T09:00:00+08:00',
    }),
  )
  questions.contributeAnchors(ctx, rows)
}

function contributeSessions(ctx: SeedContext): void {
  const fx = new Map(fixtureQuestions().map((q) => [q.id, q]))
  const sessions = designedSessions()
  let nextAnswer = ANSWER_ID_START
  const answers: Parameters<typeof practice.contributeAnswers>[1][number][] = []
  for (const s of sessions) {
    const end = Date.parse(s.completedAt)
    const start = end - s.seconds * 1000
    s.questionIds.forEach((questionId, i) => {
      const q = fx.get(questionId)
      const correct = s.correct[i] as boolean
      const at =
        start + Math.round(((i + 1) * s.seconds * 1000) / s.questionIds.length / 1000) * 1000
      answers.push({
        id: nextAnswer++,
        userId: s.userId,
        questionId,
        isCorrect: correct,
        answeredAt: new Date(Math.min(at, end)).toISOString(),
        sessionId: s.id,
        ...(q ? { selectedOptionId: correct ? q.correct : (q.correct + 1) % 4 } : {}),
      })
    })
  }
  practice.contributeAnswers(ctx, answers)
  practice.contributeSessions(
    ctx,
    sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      mode: 'random' as const,
      completedAt: s.completedAt,
      questionCount: s.questionIds.length,
      correctCount: s.correct.filter(Boolean).length,
      subjectId: s.subjectId,
      levelId: s.levelId,
      timeSpent: s.seconds,
      questionIds: s.questionIds,
    })),
  )
}

/** SpRecords: the admin's observed weak cards plus the generated records, and the designed pupils'. */
function spRecords(): SpRecordRow[] {
  type Draft = Omit<SpRecordRow, 'seq' | 'origin'>
  const out: Draft[] = []
  for (const [sp, subjectId, answered] of ADMIN_WEAK_CARDS) {
    out.push({
      id: spId(ADMIN, subjectId, sp),
      userId: ADMIN,
      subjectId,
      dskpSpId: sp,
      answered,
      correct: 0,
    })
  }
  for (const [subject, list] of Object.entries(ADMIN_GENERATED)) {
    const subjectId = Number(subject)
    list.forEach(([answered, correct], i) => {
      const sp = (ADMIN_GENERATED_SP[subjectId] as readonly number[])[i]
      if (sp === undefined)
        throw new Error(`M08 admin SP records: no SP id for ${String(subjectId)}/${String(i)}`)
      out.push({
        id: spId(ADMIN, subjectId, sp),
        userId: ADMIN,
        subjectId,
        dskpSpId: sp,
        answered,
        correct,
      })
    })
  }
  // Designed pupils: derived from their answers on the fixture questions that carry a dskpSpId.
  const spOf = new Map(fixtureQuestions().map((q) => [q.id, q.dskpSpId]))
  const by = new Map<string, Draft>()
  for (const s of designedSessions()) {
    s.questionIds.forEach((qid, i) => {
      const sp = spOf.get(qid)
      if (sp === null || sp === undefined) return
      const id = spId(s.userId, s.subjectId, sp)
      const row = by.get(id) ?? {
        id,
        userId: s.userId,
        subjectId: s.subjectId,
        dskpSpId: sp,
        answered: 0,
        correct: 0,
      }
      row.answered++
      if (s.correct[i]) row.correct++
      by.set(id, row)
    })
  }
  out.push(...by.values())
  const derived = out.map((r, seq): SpRecordRow => ({
    ...r,
    seq,
    origin: r.userId === ADMIN ? 'anchor' : 'log',
  }))
  // Designed DSKP performance of the SMK DEMO pupils on the Tingkatan 4–5 demo standards (S-52): not
  // derived from answers, so `anchor` (S6 weak topics read `log` only).
  const designed = DESIGNED_SP_PERFORMANCE.map((r, i): SpRecordRow => ({
    ...r,
    id: spId(r.userId, r.subjectId, r.dskpSpId),
    seq: derived.length + i,
    origin: 'anchor',
  }))
  return [...derived, ...designed]
}

/** Class 2001 risk profiles (§6.10): per-pupil Kimia accuracy, stable trend, risk by pupil. */
function riskProfiles2001(): RiskProfileRow[] {
  const acc = new Map<number, { n: number; c: number }>()
  for (const s of designedSessions()) {
    if (s.subjectId !== KIMIA.subjectId) continue
    const a = acc.get(s.userId) ?? { n: 0, c: 0 }
    a.n += s.correct.length
    a.c += s.correct.filter(Boolean).length
    acc.set(s.userId, a)
  }
  return [...acc.entries()].map(([userId, a]) => {
    const accuracy = round((a.c / a.n) * 100, 1)
    const range = projection(accuracy)
    return {
      id: `${String(userId)}:${String(CLASS_KIMIA)}:${String(KIMIA.subjectId)}`,
      userId,
      classroomId: CLASS_KIMIA,
      subjectId: KIMIA.subjectId,
      accuracy,
      answered: a.n,
      trend: 'stable' as const,
      gradeLow: range.low,
      gradeHigh: range.high,
      riskLevel: RISK_2001[userId] ?? 'medium',
    }
  })
}

/** Leaderboard display rows of the observed and generated learners (BR-M08-28; INFERRED names / sessions). */
function standingRows(): StandingRow[] {
  const out: StandingRow[] = []
  for (const period of ['week', 'month', 'all'] as const) {
    let seq = 0
    OBSERVED_STANDINGS[period].forEach(([accuracy, coins], i) => {
      out.push({
        id: `${period}:o${String(i + 1)}`,
        period,
        seq: seq++,
        userId: null,
        name: `Pelajar Demo ${String.fromCharCode(65 + i)}`,
        coins,
        sessions: Math.max(1, Math.round(coins / 12)),
        accuracy,
        source: 'observed',
      })
    })
    const g = GENERATED_STANDINGS[period]
    for (let i = 0; i < g.count; i++) {
      const coins = g.start - g.step * i
      out.push({
        id: `${period}:g${String(i + 1)}`,
        period,
        seq: seq++,
        userId: null,
        name: `Pelajar Demo G${String(i + 1).padStart(4, '0')}`,
        coins,
        sessions: Math.max(1, Math.round(coins / 14)),
        // A deterministic spread 55–95 % (INFERRED; the generated rows are unobserved).
        accuracy: 55 + ((i * 37) % 41),
        source: 'generated',
      })
    }
  }
  return out
}

export function seedM08(ctx: SeedContext): void {
  resetReadCache()
  resetHookState()
  contributeQuestions(ctx)
  contributeSessions(ctx)

  schoolSpmHistoryRepo.seed([
    ...PLATFORM_SPM.map((r) => ({
      id: `platform:${String(r.year)}`,
      schoolId: null,
      year: r.year,
      gps: r.gps,
      candidates: r.candidates,
      source: 'SPM Sebenar',
      gradeCounts: r.gradeCounts,
      subjects: [],
    })),
    ...SCHOOL_SPM.map((r) => ({
      id: `${String(r.schoolId)}:${String(r.year)}`,
      schoolId: r.schoolId,
      year: r.year,
      gps: r.gps,
      candidates: r.candidates,
      source: 'SPM Sebenar',
      gradeCounts: r.gradeCounts,
      subjects: r.subjects,
    })),
  ])
  spRecordsRepo.seed(spRecords(), riskProfiles2001())
  // No timeline posts are seeded: none were observed on live (L-5) and no photo may be generated.
  timelineRepo.seed([])
  rankingsRepo.seed(
    RANKING_ENTRIES.map((r) => ({
      userId: null,
      name: r.name,
      schoolName: 'SMK DEMO',
      state: 'Selangor',
      district: 'PPD PETALING UTAMA',
      levelId: 11,
      figures: {
        all: { tahap: r.all[0], correct: r.all[1], accuracy: r.all[2] },
        '3': { tahap: r.math[0], correct: r.math[1], accuracy: r.math[2] },
      },
    })),
  )
  standingsRepo.seed(standingRows())
}

// ---------------------------------------------------------------------------------------------
// Finalise phase
// ---------------------------------------------------------------------------------------------

function classLabelOf(userId: number): string {
  const c = classrooms
    .forStudent(userId)
    .filter((k) => k.kind === 'classroom' && k.schoolId === 8880)
    .sort((a, b) => a.classId - b.classId)[0]
  return c ? c.name : 'Tiada Kelas'
}

/** Pupil references of the item sets: `t{n}` = observed 8880 person token, `a{n}` = answering 8765 pupil. */
function pupilResolver(): (ref: string) => number {
  // T4 tokens (OBSERVED in the T4 variant) → class-516 pupils 3201–3213; T5 tokens → class-517 members
  // that answer (INFERRED mapping; the live tokens are pseudonyms).
  const t4Tokens = [115, 116, 117, 119, 121, 122, 123, 124, 125, 127, 128, 129, 136]
  const t5Tokens = [118, 120, 126, 130, 131, 132, 133, 134, 135]
  const t5Pupils = classrooms
    .memberIds('classroom', 517)
    .filter((id) => users.get(id)?.schoolId === 8880)
  const map = new Map<string, number>()
  t4Tokens.forEach((t, i) => map.set(`t${String(t)}`, 3201 + i))
  t5Tokens.forEach((t, i) => {
    const id = t5Pupils[i]
    if (id === undefined) {
      throw new Error(
        `M08 item statistics: class 517 has no 8880 pupil ${String(i + 1)} for token ${String(t)}`,
      )
    }
    map.set(`t${String(t)}`, id)
  })
  const answering = classrooms.designation().answering8765
  answering.forEach((id, i) => map.set(`a${String(i + 1)}`, id))
  return (ref) => {
    const id = map.get(ref)
    if (id === undefined) throw new Error(`M08 item statistics: unknown pupil reference ${ref}`)
    return id
  }
}

function itemStatisticRows(): ItemStatisticRow[] {
  const resolve = pupilResolver()
  const out: ItemStatisticRow[] = []
  const known = new Set(CRITICAL_QUESTIONS.map((q) => q.id))
  for (const set of ITEM_SEED_SETS) {
    set.rows.forEach((r, i) => {
      if (!known.has(r.q)) throw new Error(`M08 item statistics: unknown question ${String(r.q)}`)
      out.push({
        id: `${set.scopeKind}:${String(set.scopeId)}:${set.tingkatan ?? 'all'}:${String(r.q)}`,
        scopeKind: set.scopeKind,
        scopeId: set.scopeId,
        tingkatan: set.tingkatan,
        questionId: r.q,
        rank: i + 1,
        attempts: r.attempts,
        pupils: r.pupils,
        wrong: r.wrong,
        wrongPupils: r.wp.map(([ref, wrongOption]) => {
          const userId = resolve(ref)
          return { userId, classLabel: classLabelOf(userId), wrongOption: wrongOption }
        }),
        popularWrongOption: r.pop,
        popularWrongCount: r.popN,
      })
    })
  }
  return out
}

/** Class-4 risk profiles (subjects 1 and 5 observed; six pupils each, accuracy 0.0). */
function classFourProfiles(): RiskProfileRow[] {
  const members = classrooms.memberIds('classroom', 4).slice(0, 6)
  const out: RiskProfileRow[] = []
  members.forEach((userId, i) => {
    const bm = CLASS4_BM[i]
    if (bm) {
      out.push({
        id: `${String(userId)}:4:1`,
        userId,
        classroomId: 4,
        subjectId: 1,
        accuracy: 0,
        answered: 0,
        trend: 'stable',
        gradeLow: bm.low,
        gradeHigh: bm.high,
        riskLevel: bm.risk,
      })
    }
    const sej = CLASS4_SEJ_RISK[i]
    if (sej) {
      const range = projection(0)
      out.push({
        id: `${String(userId)}:4:5`,
        userId,
        classroomId: 4,
        subjectId: 5,
        accuracy: 0,
        answered: 0,
        trend: 'stable',
        gradeLow: range.low,
        gradeHigh: range.high,
        riskLevel: sej,
      })
    }
  })
  return out
}

/** LearnerActivityStats (DATA-M08-10): the admin's observed values and the designed / fixture pupils'. */
function activityRows(): ActivityRow[] {
  const rows: ActivityRow[] = [
    {
      id: ADMIN,
      userId: ADMIN,
      practiceDays: 13,
      lastPracticeAt: '2026-05-21T20:00:00+08:00',
      joinedAt: '2025-10-25T20:00:00+08:00',
      profileLevelId: 6,
    },
  ]
  const ids = [
    2,
    3,
    4,
    ...Array.from({ length: 8 }, (_, i) => 3001 + i),
    ...Array.from({ length: 15 }, (_, i) => 3201 + i),
  ]
  for (const userId of ids) {
    const u = users.get(userId)
    if (!u) continue
    const sessions = practice.history(userId).filter((s) => PRACTICE.has(s.mode))
    const days = new Set(sessions.map((s) => s.completedAt?.slice(0, 10)))
    rows.push({
      id: userId,
      userId,
      practiceDays: days.size,
      lastPracticeAt: sessions[0]?.completedAt ?? null,
      joinedAt: u.createdAt,
      profileLevelId: u.grade ?? 6,
    })
  }
  return rows
}

const PRACTICE: ReadonlySet<string> = new Set([
  'random',
  'chapter',
  'revision',
  'mission',
  'remedial',
  'question_set',
  'pksk',
])

export function finaliseM08(): void {
  spRecordsRepo.seed([], classFourProfiles())
  itemStatisticsRepo.seed(
    itemStatisticRows(),
    SCHOOL_ITEM_SUMMARIES.map((r) => ({
      id: `${String(r.schoolId)}:${r.tingkatan ?? 'all'}`,
      schoolId: r.schoolId,
      tingkatan: r.tingkatan,
      students: r.students,
      answers: r.answers,
      accuracy: r.accuracy,
      subjects: r.subjects.map(([name, pupils, questions, accuracy, wrong]) => ({
        name,
        pupils,
        questions,
        accuracy,
        wrong,
      })),
    })),
  )
  activityRepo.seed(activityRows())
}
