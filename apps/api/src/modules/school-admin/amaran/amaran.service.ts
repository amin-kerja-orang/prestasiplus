import { Inject, Injectable } from '@nestjs/common'
import {
  AMARAN_MESSAGES,
  AMARAN_SCOPES,
  PRACTICE_MODES,
  type AmaranEffectivenessResult,
  type AmaranScope,
  type AmaranSchoolRisk,
  type AmaranSubjectRisk,
  type AmaranSummary,
  type AmaranSummarySchoolRow,
} from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import { isOverloadError } from '../../auth/auth.errors'
import { ClassesRepository, slugOfGrade } from '../../classes'
import { PracticeRepository } from '../../practice'
import { KirkpatrickRepository } from '../../reports/kirkpatrick'
import { SchoolsRepository, type SchoolRow } from '../../schools'
import { UsersRepository } from '../../users'
import { K_COHORT, SCHOOL_ADMIN_AUDIT } from '../school-admin.constants'
import { canReadSchool, schoolIdOf, type AmaranCaller } from './amaran.access'
import { amaranCsv } from './amaran.csv'
import {
  type ClassFact,
  type InterventionFact,
  type PupilFacts,
  type ScoredPupil,
  type SubjectCounter,
  DAY_MS,
  compareIds,
  effectivenessReport,
  inTingkatan,
  masteryLevelOf,
  parseTingkatan,
  pupilView,
  rankOrder,
  round1,
  scorePupils,
  tallyOf,
  weaknessOf,
  yyyymmdd,
} from './risk.rules'

/** Rows per `IN (...)` list sent to the database. */
const IN_CHUNK = 1000
/** Pupils read from the practice owner at the same time (one pupil is three small reads). */
const PUPIL_PARALLEL = 8
/** Schools are read in pages of this size when a district or state is rolled up. */
const SCHOOL_PAGE = 500
/** Reserved fixture schools (BR-M18-02) are left out of district and state roll-ups. */
const FIXTURE_MIN = 900_001n
const FIXTURE_MAX = 900_099n
/** Practice-mode sessions only (BR-M18-23): every stored mode except the PKSK test mode. */
const PRACTICE_SESSION_MODES = PRACTICE_MODES.filter((m) => m !== 'pksk')
const MYT_OFFSET_MS = 8 * 3_600_000

const notFound = (): ApiError => ApiError.of('NOT_FOUND')
const refuse422 = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

async function each<T>(ids: readonly string[], fn: (part: string[]) => Promise<T>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(await fn(ids.slice(i, i + IN_CHUNK)))
  return out
}

/** Runs `fn` over `items` with at most `size` calls in flight, keeping the order of the results. */
async function pool<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

const isFixture = (id: string): boolean => {
  const n = BigInt(id)
  return n >= FIXTURE_MIN && n <= FIXTURE_MAX
}

interface SchoolData {
  school: SchoolRow
  scored: ScoredPupil[]
  counters: SubjectCounter[][]
}

export interface AmaranCsvFile {
  csv: string
  fileName: string
}

type SummaryScope = { kind: 'school'; schoolId: string } | { kind: 'district'; district: string; state: string } | { kind: 'state'; state: string }

/**
 * Amaran Awal (BE-21 Part C): the school risk page, the executive summary, the effectiveness report and the school CSV.
 * Nothing is stored: the risk of every pupil is computed at request time from the owners' reads (users, classes, practice,
 * Kirkpatrick interventions). Every read is for one school (the id is checked against the caller first) and every `IN` list
 * is cut at 1000 ids. Access order: role (the `@Roles` guard, 403), then the school lookup and the scope check, which answer
 * the SAME 404 for an unknown and an out-of-scope school.
 */
@Injectable()
export class AmaranService {
  constructor(
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(KirkpatrickRepository) private readonly interventions: KirkpatrickRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- GET /amaran/schools/:id ----------------------------------------------------------------

  async schoolRisk(caller: AmaranCaller, rawId: string, rawTingkatan: string | undefined): Promise<AmaranSchoolRisk> {
    return this.guard(async () => {
      const school = await this.readableSchool(caller, rawId)
      const now = this.clock.now().getTime()
      const t = parseTingkatan(rawTingkatan)
      const data = await this.load(school, now)
      const kept = t === undefined ? data.scored : data.scored.filter((p) => inTingkatan(p.facts.classes, t))
      const ranked = [...kept].sort(rankOrder)
      return {
        school: { id: school.id, name: school.name, code: school.code ?? '', district: school.district, state: school.state ?? '' },
        levelFilter: t === undefined ? null : t === 4 ? 'T4' : 'T5',
        levelSuffix: t === undefined ? '' : ` — Tingkatan ${t}`,
        tally: tallyOf(kept),
        weakness: await this.weakness(data.counters),
        pupils: ranked.map((p, i) => pupilView(p, i + 1)),
      }
    })
  }

  // --- GET /amaran/summary --------------------------------------------------------------------

  async summary(caller: AmaranCaller, query: { scope?: string; schoolId?: string; district?: string; state?: string }): Promise<AmaranSummary> {
    return this.guard(async () => {
      const scope = this.scopeOf(caller, query)
      // The 422 rules ran inside scopeOf; now 403 (district and state are admin only), then 404.
      if (scope.kind !== 'school' && caller.role !== 'admin') throw ApiError.of('FORBIDDEN')
      const now = this.clock.now().getTime()

      if (scope.kind === 'school') {
        const school = await this.readableSchool(caller, scope.schoolId)
        const data = await this.load(school, now)
        return {
          scope: 'school',
          title: school.name,
          subtitle: `${school.district ?? ''}${school.district ? ', ' : ''}${school.state ?? ''}`,
          pupilsLine: `${data.scored.length} pelajar`,
          generatedAt: now,
          tally: tallyOf(data.scored),
          kombo: this.kombo(data.scored, now),
          weakness: await this.weakness(data.counters),
        }
      }

      const { state } = scope
      const district = scope.kind === 'district' ? scope.district.toLowerCase() : null
      const chosen = (await this.schoolsOfState(state)).filter((s) => !isFixture(s.id) && (district === null || (s.district ?? '').trim().toLowerCase() === district))
      if (chosen.length === 0) throw notFound()

      const scored: ScoredPupil[] = []
      const rows: AmaranSummarySchoolRow[] = []
      for (const school of chosen) {
        const data = await this.load(school, now)
        if (data.scored.length === 0) continue
        scored.push(...data.scored)
        const t = tallyOf(data.scored)
        rows.push({
          schoolId: school.id,
          school: school.name,
          pupils: t.total,
          avgScore: round1(data.scored.reduce((a, p) => a + p.risk.score, 0) / t.total),
          green: t.green,
          yellow: t.yellow,
          red: t.red,
        })
      }
      rows.sort((a, b) => b.avgScore - a.avgScore || compareIds(a.schoolId, b.schoolId))
      const tally = tallyOf(scored)
      const kombo = this.kombo(scored, now)
      if (scope.kind === 'district') {
        return {
          scope: 'district',
          title: chosen[0]?.district?.trim() || scope.district,
          subtitle: `${state} — Ringkasan Eksekutif`,
          pupilsLine: `${tally.total} pelajar`,
          generatedAt: now,
          tally,
          kombo,
          schools: rows,
        }
      }
      return {
        scope: 'state',
        title: `Negeri ${state}`,
        subtitle: 'Ringkasan Eksekutif Seluruh Negeri',
        pupilsLine: null,
        generatedAt: now,
        tally,
        kombo,
        schools: rows,
      }
    })
  }

  // --- GET /amaran/effectiveness --------------------------------------------------------------

  async effectiveness(caller: AmaranCaller): Promise<AmaranEffectivenessResult> {
    return this.guard(async () => {
      if (caller.schoolId === null) throw ApiError.of('FORBIDDEN')
      const school = await this.schools.get(caller.schoolId)
      if (!school) throw ApiError.of('FORBIDDEN')
      const now = this.clock.now().getTime()
      // A teacher sees the interventions of the own pupils only (as BE-20); a school admin those of the whole school.
      const records = await this.interventions.interventions(
        caller.role === 'teacher' ? { kind: 'students', ids: await this.classes.teacherStudentIds(caller.userId) } : { kind: 'school', schoolId: school.id },
      )
      const names = await this.classes.userNames(records.map((r) => r.createdBy))
      const facts: InterventionFact[] = records.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.studentName ?? `Pelajar ${r.studentId}`,
        teacherId: r.createdBy,
        date: r.actionDate,
        beforeAccuracy: r.beforeAccuracy,
        afterAccuracy: r.afterAccuracy,
      }))
      return { school: { id: school.id, name: school.name }, report: effectivenessReport(facts, now, { id: school.id, name: school.name }, names) }
    })
  }

  // --- GET /amaran/export/school/:id ----------------------------------------------------------

  /**
   * The CSV. The role was checked by the guard; here the school is resolved (404 for unknown and out of scope alike), the rows
   * are built, and ONE audit row (ids, file name and row count; never names or cells) is written BEFORE the file is returned,
   * so a failed audit gives no file.
   */
  async exportCsv(caller: AmaranCaller, rawId: string): Promise<AmaranCsvFile> {
    return this.guard(async () => {
      const school = await this.readableSchool(caller, rawId)
      const now = this.clock.now().getTime()
      const data = await this.load(school, now)
      const pupils = [...data.scored].sort(rankOrder).map((p, i) => pupilView(p, i + 1))
      const fileName = `amaran-sekolah-${school.id}-${yyyymmdd(now)}.csv`
      await this.audit.record({
        action: SCHOOL_ADMIN_AUDIT.AMARAN_EXPORTED,
        actorUserId: caller.userId,
        actorRole: caller.role,
        sessionRowId: caller.sessionRowId,
        scopeLevel: caller.scopeLevel,
        schoolId: school.id,
        requestId: caller.requestId,
        ip: caller.ip,
        isTest: caller.isTest,
        targetType: 'school',
        targetId: school.id,
        details: { fileName, rowCount: pupils.length },
      })
      return { csv: amaranCsv(pupils), fileName }
    })
  }

  // --- internals ------------------------------------------------------------------------------

  /** The 422 rules of the summary query, then the resolved scope. Admin without a scope has no default (403). */
  private scopeOf(caller: AmaranCaller, q: { scope?: string; schoolId?: string; district?: string; state?: string }): SummaryScope {
    const raw = (q.scope ?? '').trim()
    if (raw === '') {
      if (caller.role === 'admin' || caller.schoolId === null) throw ApiError.of('FORBIDDEN')
      return { kind: 'school', schoolId: caller.schoolId }
    }
    if (!(AMARAN_SCOPES as readonly string[]).includes(raw)) throw refuse422('scope', AMARAN_MESSAGES.scopeInvalid)
    const scope = raw as AmaranScope
    if (scope === 'school') {
      const id = schoolIdOf(q.schoolId)
      if (id === null) throw refuse422('schoolId', AMARAN_MESSAGES.schoolIdRequired)
      return { kind: 'school', schoolId: id }
    }
    const state = (q.state ?? '').trim()
    if (scope === 'district') {
      const district = (q.district ?? '').trim()
      if (district === '' || state === '') throw refuse422('district', AMARAN_MESSAGES.districtStateRequired)
      return { kind: 'district', district, state }
    }
    if (state === '') throw refuse422('state', AMARAN_MESSAGES.stateRequired)
    return { kind: 'state', state }
  }

  /** The school when it exists AND the caller may read it; otherwise the one 404 (no way to tell the two cases apart). */
  private async readableSchool(caller: AmaranCaller, rawId: string): Promise<SchoolRow> {
    const id = schoolIdOf(rawId)
    if (id === null) throw notFound()
    const school = await this.schools.get(id)
    if (!school || !(await canReadSchool(caller, id, this.classes))) throw notFound()
    return school
  }

  private async schoolsOfState(state: string): Promise<SchoolRow[]> {
    const out: SchoolRow[] = []
    for (let page = 1; ; page++) {
      const { rows } = await this.schools.list({ state, page, pageSize: SCHOOL_PAGE })
      out.push(...rows)
      if (rows.length < SCHOOL_PAGE) return out
    }
  }

  /** Pupils of one school (active and inactive), their classes and their practice facts. */
  private async load(school: SchoolRow, now: number): Promise<SchoolData> {
    const students = (await this.users.studentsOfSchool(school.id, '', '')).filter((s) => s.schoolId === school.id)
    const classOf = await this.classesOf(
      school.id,
      students.map((s) => s.id),
    )
    const facts = await pool(students, PUPIL_PARALLEL, async (s) => {
      const stats = await this.practice.historyStats(s.id, { modes: PRACTICE_SESSION_MODES })
      const newest = await this.practice.history(s.id, { modes: PRACTICE_SESSION_MODES, take: 1 })
      const mastery = (await this.practice.mastery(s.id)).filter((m) => m.answered > 0)
      const stamps = [newest[0]?.completedAt ?? null, ...mastery.map((m) => m.lastAnsweredAt)].filter((d): d is Date => d !== null).map((d) => d.getTime())
      const pupil: PupilFacts = {
        userId: s.id,
        name: s.name,
        grade: s.grade,
        classes: classOf.get(s.id) ?? [],
        accuracy: stats.sessions > 0 ? stats.avgAccuracyPct : null,
        sessions: stats.sessions,
        lastActiveAt: stamps.length === 0 ? null : Math.max(...stamps),
        masteryLevels: mastery.map((m) => masteryLevelOf(m.correct)),
      }
      const counters: SubjectCounter[] = mastery.map((m) => ({ subjectId: m.subjectId, correct: m.correct, answered: m.answered }))
      return { pupil, counters }
    })
    return { school, scored: scorePupils(facts.map((f) => f.pupil), now), counters: facts.map((f) => f.counters) }
  }

  /** Active classes (of this school) per pupil, by class id; with the level slug of each class. */
  private async classesOf(schoolId: string, pupilIds: readonly string[]): Promise<Map<string, ClassFact[]>> {
    const rows = (await each(pupilIds, (c) => this.classes.enrolmentsOfStudents(c)))
      .flat()
      .filter((e) => e.status === 'active' && e.classroom.isActive && e.classroom.schoolId === schoolId)
    const levels = await this.classes.levelGrades([...new Set(rows.map((e) => e.classroom.educationLevelId))])
    const out = new Map<string, { id: string; fact: ClassFact }[]>()
    for (const e of rows) {
      const list = out.get(e.studentId) ?? []
      list.push({ id: e.classroom.id, fact: { name: e.classroom.name, slug: slugOfGrade(levels.get(e.classroom.educationLevelId)?.grade) } })
      out.set(e.studentId, list)
    }
    return new Map([...out.entries()].map(([k, v]) => [k, v.sort((a, b) => compareIds(a.id, b.id)).map((x) => x.fact)]))
  }

  private async weakness(counters: readonly (readonly SubjectCounter[])[]): Promise<AmaranSubjectRisk[]> {
    const rows = weaknessOf(counters, K_COHORT)
    const names = await this.classes.subjectNames(rows.map((r) => r.subjectId))
    return rows.map((r) => ({ subjectId: r.subjectId, subjectName: names.get(r.subjectId) ?? `Subjek ${r.subjectId}`, weak: r.weak, total: r.total, pct: r.pct }))
  }

  /**
   * The streak figures have no public reader in the gamification owner (it exports no batch or per-user streak read), so
   * `active`, `avg` and `max` are 0; `pupils` and `today` (pupils with practice activity since 00:00 MYT) are real.
   */
  private kombo(scored: readonly ScoredPupil[], now: number): AmaranSummary['kombo'] {
    const dayStart = Math.floor((now + MYT_OFFSET_MS) / DAY_MS) * DAY_MS - MYT_OFFSET_MS
    return { active: 0, pupils: scored.length, avg: 0, max: 0, today: scored.filter((p) => p.facts.lastActiveAt !== null && p.facts.lastActiveAt >= dayStart).length }
  }

  /** An overloaded database or pool is retryable: 429 with Retry-After, never a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof ApiError) && isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
