/**
 * The `kirkpatrick` repository (owner **M05**; D12, overview §6.7; SRS M05 v1.17 §6.14.4, FR-M05-147;
 * M12 v1.5 §6.5): the only doorway to the KirkpatrickSessionAggregate (DATA-M05-12), the M12 practice
 * segment. Its 20,991 completed sessions are aggregates of T4/T5 students at the non-fixture schools;
 * they are **not** rows of the practice-session dataset or of the answer log, and no query of
 * `practice` / `practiceAnswers` counts them.
 *
 * **Scope.** Every read takes `scope = { schoolIds?: readonly number[] | null }` (M12 BR-M12-01):
 * `null` / omitted = every school; a list = those schools (M12 resolves `school_id` and `state` to
 * school ids through the M02 schools repository, an empty list gives the zero state). An "active"
 * student is a student with ≥ 1 answered question (BR-M12-02); the "served" variants count a
 * served question (Q-M12-TBL-AKTIF).
 *
 * Reads (synchronous; each scans the ≈ 21,000 aggregates once, from a snapshot kept per dataset
 * version): `sessions`, `totals`, `students`, `schools`, `subjects`, `months`, `month`, `heat`,
 * `student`, `schoolIds`. The plan (about a second) and the slot → user prime are built on the first read, not at boot. Write: `addSession` (the M12 hook `mock.addSegmentStudent`, dev and test
 * builds). Named queries: Q-M12-SESSIONS and its school, subject and month variants.
 */

import { toIsoMyt } from '@/lib/time'
import { checkNamedQueries, defineNamedQueries } from '@/mock/dataset'
import { defineRepository, RepositoryError } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

import { kaHeat, type HeatGrid } from '../datasets/kirkpatrick-heat'
import { KA_SESSIONS, monthKey, monthOfMs } from '../datasets/kirkpatrick-plan'
import {
  kirkpatrickDataset,
  ensureKirkpatrickPrimed,
  kirkpatrickPrimeOrNull,
  primeKirkpatrick,
  type KaSessionRow,
} from '../datasets/kirkpatrick'
import { FIXTURE_SCHOOLS } from './facets'

export type { KaSessionRow }

export interface KaScope {
  schoolIds?: readonly number[] | null
}

export interface KaTotals {
  /** Sessions of the segment (all completed, BR-M12-05). */
  sessions: number
  /** Σ served questions (`questionCount`). */
  served: number
  /** Σ `answeredCount`. */
  answered: number
  /** Σ `correctCount`. */
  correct: number
  /** Sessions with `answeredCount` ≥ 1 and the sum of their `scorePct` (BR-M12-04). */
  scoredSessions: number
  scoreSum: number
  /** Students with ≥ 1 answered question / ≥ 1 served question / ≥ 1 session. */
  activeStudents: number
  servedStudents: number
  sessionStudents: number
}

export interface KaStudentAgg {
  userId: number
  schoolId: number
  sessions: number
  served: number
  answered: number
  correct: number
  scoredSessions: number
  scoreSum: number
  /** Distinct MYT dates (`YYYY-MM-DD`) of the completed sessions, ascending. */
  days: string[]
  lastAtMs: number
}

export interface KaSchoolAgg extends KaTotals {
  schoolId: number
}

export interface KaSubjectAgg {
  subjectId: number
  sessions: number
  answered: number
  correct: number
}

export interface KaMonthAgg {
  month: string
  sessions: number
  answered: number
  correct: number
  /** Answers of every student with ≥ 1 answer in the month (the M12 panels count "active" and "Champion" from these). */
  students: { userId: number; answered: number }[]
}

export interface KaStudentDetail extends KaStudentAgg {
  /** Consecutive active days ending at the last active day (BR-M12-28). */
  streak: number
  subjects: KaSubjectAgg[]
}

export interface KaSessionInput {
  userId: number
  subjectId: number | null
  /** ISO 8601 or epoch ms. */
  completedAt: string | number
  questionCount: number
  answeredCount: number
  correctCount: number
  scorePct?: number
}

export const kaQueries = defineNamedQueries(kirkpatrickDataset, {
  'Q-M12-SESSIONS': {
    expected: KA_SESSIONS,
    source: 'M12 §6.5 (S1 "Sesi Selesai", 25 Sep; 20,998 on 26 Sep)',
  },
  /** (schoolId): sessions of one school. */
  'Q-M12-SESSIONS-SCHOOL': {
    where: (schoolId: number) => ({ schoolId }),
    expected: [{ args: [8080], value: 1002 }],
    source: 'M12 §6.5 (8080: 1,002)',
  },
  /** (subjectId): sessions in one subject. */
  'Q-M12-SESSIONS-SUBJECT': {
    where: (subjectId: number) => ({ subjectId }),
    source: 'M12 §6.5 Q-M12-SUBJECTS',
  },
  /** (month `YYYY-MM`): sessions completed in a month. */
  'Q-M12-SESSIONS-MONTH': {
    where: (month: string) => ({ month }),
    source:
      'M12 §6.5 Q-M12-MONTH (sessions completed in the month; the M12 panels count answers from `month()`)',
  },
})

const DAY = 86_400_000
const MYT = 8 * 3_600_000
const dateOf = (ms: number) => new Date(ms + MYT).toISOString().slice(0, 10)

let snapshot: { version: number; rows: readonly KaSessionRow[] } | null = null

export const kirkpatrickRepo = defineRepository({
  name: 'kirkpatrick',
  owner: 'M05',
  store: kirkpatrickDataset,
  queries: kaQueries,
  methods: () => {
    const all = (): readonly KaSessionRow[] => {
      ensureKirkpatrickPrimed()
      if (!snapshot || snapshot.version !== kirkpatrickDataset.version) {
        snapshot = { version: kirkpatrickDataset.version, rows: kirkpatrickDataset.query({}).rows }
      }
      return snapshot.rows
    }
    const inScope = (scope: KaScope | undefined): readonly KaSessionRow[] => {
      const ids = scope?.schoolIds
      if (ids === null || ids === undefined) return all()
      const set = new Set(ids)
      return all().filter((r) => set.has(r.schoolId))
    }

    const totalsOf = (rows: readonly KaSessionRow[]): KaTotals => {
      const t: KaTotals = {
        sessions: rows.length,
        served: 0,
        answered: 0,
        correct: 0,
        scoredSessions: 0,
        scoreSum: 0,
        activeStudents: 0,
        servedStudents: 0,
        sessionStudents: 0,
      }
      const answered = new Map<number, number>()
      const served = new Map<number, number>()
      for (const r of rows) {
        t.served += r.questionCount
        t.answered += r.answeredCount
        t.correct += r.correctCount
        if (r.answeredCount >= 1) {
          t.scoredSessions++
          t.scoreSum += r.scorePct
        }
        answered.set(r.userId, (answered.get(r.userId) ?? 0) + r.answeredCount)
        served.set(r.userId, (served.get(r.userId) ?? 0) + r.questionCount)
      }
      t.sessionStudents = answered.size
      for (const v of answered.values()) if (v > 0) t.activeStudents++
      for (const v of served.values()) if (v > 0) t.servedStudents++
      return t
    }

    const studentsOf = (rows: readonly KaSessionRow[]): KaStudentAgg[] => {
      const by = new Map<number, KaStudentAgg>()
      const days = new Map<number, Set<string>>()
      for (const r of rows) {
        let s = by.get(r.userId)
        if (!s) {
          s = {
            userId: r.userId,
            schoolId: r.schoolId,
            sessions: 0,
            served: 0,
            answered: 0,
            correct: 0,
            scoredSessions: 0,
            scoreSum: 0,
            days: [],
            lastAtMs: 0,
          }
          by.set(r.userId, s)
          days.set(r.userId, new Set())
        }
        s.sessions++
        s.served += r.questionCount
        s.answered += r.answeredCount
        s.correct += r.correctCount
        if (r.answeredCount >= 1) {
          s.scoredSessions++
          s.scoreSum += r.scorePct
        }
        if (r.completedAtMs > s.lastAtMs) s.lastAtMs = r.completedAtMs
        ;(days.get(r.userId) as Set<string>).add(dateOf(r.completedAtMs))
      }
      for (const s of by.values()) s.days = [...(days.get(s.userId) as Set<string>)].sort()
      return [...by.values()].sort((a, b) => a.userId - b.userId)
    }

    return {
      /** Q-M12-SESSIONS in scope. */
      sessions(scope?: KaScope): number {
        return inScope(scope).length
      },

      /** Q-M12-SESSIONS / -ANSWERS / -CORRECT / -ACTIVE / -TBL-* in one pass. */
      totals(scope?: KaScope): KaTotals {
        return totalsOf(inScope(scope))
      },

      /**
       * One row per student with ≥ 1 session in scope, by user id: the source of Q-M12-ACTIVE,
       * Q-M12-BANDS, Q-M12-PRED, Q-M12-SESSION-STUDENTS and the S4/S5 "Aktif" columns.
       */
      students(scope?: KaScope): KaStudentAgg[] {
        return studentsOf(inScope(scope))
      },

      /** One row per school with ≥ 1 session (the S3 / S4 / S5 tables), by school id. */
      schools(scope?: KaScope): KaSchoolAgg[] {
        const by = new Map<number, KaSessionRow[]>()
        for (const r of inScope(scope)) {
          const list = by.get(r.schoolId) ?? []
          list.push(r)
          by.set(r.schoolId, list)
        }
        return [...by.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([schoolId, rows]) => ({ schoolId, ...totalsOf(rows) }))
      },

      /** Per subject (Q-M12-SUBJECTS): answers and correct, by subject id; sessions without a subject are skipped. */
      subjects(scope?: KaScope): KaSubjectAgg[] {
        const by = new Map<number, KaSubjectAgg>()
        for (const r of inScope(scope)) {
          if (r.subjectId === null) continue
          const s = by.get(r.subjectId) ?? {
            subjectId: r.subjectId,
            sessions: 0,
            answered: 0,
            correct: 0,
          }
          s.sessions++
          s.answered += r.answeredCount
          s.correct += r.correctCount
          by.set(r.subjectId, s)
        }
        return [...by.values()].sort((a, b) => a.subjectId - b.subjectId)
      },

      /** The months (`YYYY-MM`, ascending) with ≥ 1 answered question in scope (BR-M12-08 "SEBELUM" = the first). */
      months(scope?: KaScope): string[] {
        const set = new Set<string>()
        for (const r of inScope(scope)) if (r.answeredCount > 0) set.add(r.month)
        return [...set].sort()
      },

      /** Q-M12-MONTH(m): the sessions of one calendar month (MYT) in scope. */
      month(month: string, scope?: KaScope): KaMonthAgg {
        const agg: KaMonthAgg = { month, sessions: 0, answered: 0, correct: 0, students: [] }
        const by = new Map<number, number>()
        for (const r of inScope(scope)) {
          if (r.month !== month) continue
          agg.sessions++
          agg.answered += r.answeredCount
          agg.correct += r.correctCount
          by.set(r.userId, (by.get(r.userId) ?? 0) + r.answeredCount)
        }
        agg.students = [...by.entries()]
          .filter(([, n]) => n > 0)
          .map(([userId, answered]) => ({ userId, answered }))
          .sort((a, b) => a.userId - b.userId)
        return agg
      },

      /** Q-M12-HEAT: the stored weekday (Isnin…Ahad) × hour (06…23) grid of the scope, 7 × 18. */
      heat(scope?: KaScope): HeatGrid {
        const ids = scope?.schoolIds
        return kaHeat(ids === null || ids === undefined ? null : ids)
      },

      /** The student's own aggregates for the S8 page (BR-M12-28); null when the user has no session. */
      student(userId: number): KaStudentDetail | null {
        const rows = all().filter((r) => r.userId === userId)
        if (rows.length === 0) return null
        const agg = studentsOf(rows)[0] as KaStudentAgg
        const dayNumbers = agg.days.map((d) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY))
        let streak = 1
        for (let i = dayNumbers.length - 1; i > 0; i--) {
          if ((dayNumbers[i] as number) - (dayNumbers[i - 1] as number) === 1) streak++
          else break
        }
        const by = new Map<number, KaSubjectAgg>()
        for (const r of rows) {
          if (r.subjectId === null) continue
          const s = by.get(r.subjectId) ?? {
            subjectId: r.subjectId,
            sessions: 0,
            answered: 0,
            correct: 0,
          }
          s.sessions++
          s.answered += r.answeredCount
          s.correct += r.correctCount
          by.set(r.subjectId, s)
        }
        return {
          ...agg,
          streak,
          subjects: [...by.values()].sort((a, b) => a.subjectId - b.subjectId),
        }
      },

      /** The ids of the schools that have ≥ 1 session. */
      schoolIds(): number[] {
        return [...new Set(all().map((r) => r.schoolId))].sort((a, b) => a - b)
      },

      /**
       * Writes one runtime aggregate (M12 test hook `mock.addSegmentStudent`, dev and test builds):
       * the user must be a T4/T5 student of a non-fixture school (BR-M12-01).
       */
      addSession(input: KaSessionInput): KaSessionRow {
        const u = users.get(input.userId)
        if (
          !u ||
          u.role !== 'student' ||
          u.schoolId === null ||
          (u.grade !== 10 && u.grade !== 11) ||
          (u.schoolId >= FIXTURE_SCHOOLS.min && u.schoolId <= FIXTURE_SCHOOLS.max)
        ) {
          throw new RepositoryError(
            'CONTRACT',
            `kirkpatrick.addSession: user ${String(input.userId)} is not a T4/T5 student of a school outside the fixtures`,
          )
        }
        if (
          input.answeredCount > input.questionCount ||
          input.correctCount > input.answeredCount ||
          input.answeredCount < 0 ||
          input.correctCount < 0
        ) {
          throw new RepositoryError('CONTRACT', 'kirkpatrick.addSession: inconsistent counts')
        }
        const ms =
          typeof input.completedAt === 'number' ? input.completedAt : Date.parse(input.completedAt)
        const score =
          input.scorePct ??
          (input.answeredCount > 0
            ? Math.round((1000 * input.correctCount) / input.answeredCount) / 10
            : 0)
        return kirkpatrickDataset.insert({
          schoolId: u.schoolId,
          subjectId: input.subjectId,
          month: monthKey(monthOfMs(ms)),
          userId: input.userId,
          completedAt: toIsoMyt(ms),
          completedAtMs: ms,
          questionCount: input.questionCount,
          answeredCount: input.answeredCount,
          correctCount: input.correctCount,
          scorePct: score,
        })
      },

      /** Whether the plan has been built in this runtime (it is built lazily, on the first read). */
      ready: (): boolean => kirkpatrickPrimeOrNull() !== null,

      /** Builds the prime now (it is otherwise built on the first read) and returns the problems found, the named queries included. */
      check(): string[] {
        const issues = kirkpatrickPrimeOrNull() ? [] : primeKirkpatrick()
        for (const i of checkNamedQueries(kaQueries)) issues.push(i.message)
        return issues
      },
    }
  },
})
