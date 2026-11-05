/**
 * The cross-screen measures XS-1 to XS-8 (R1 card S6-T03). One named query per measure; every screen that shows one of these
 * numbers reads it from here (AC-XS-1 to AC-XS-3, D11/D12). Nothing in this file is a display constant: every figure is computed.
 *
 * The rows below are quoted verbatim from `docs/prd/r1/20-guru-admin-sekolah.md` section 5 (lines 2703-2710), the one source:
 *
 * | XS-1 Pelajar berdaftar | Count of pupil accounts (`role = student`) of the scope, Tingkatan 1-5 (Darjah hidden, D72/D96). XS-1 counts active accounts only; pending accounts are excluded (an imported or self-registered pupil waiting for Admin Pusat approval is not counted until approved, AC-CHAIN-8), and a deactivated account is not counted either. Senarai Pelajar still lists every pupil with its status chip, and shows the number of pupils not counted as a separate figure. A screen that shows a Tingkatan subset names the subset ("Tingkatan 4") and equals XS-1 filtered to it. | M02 users, M10 enrolment | AS: Senarai Pelajar, Dashboard, Command Center, Prestasi, Analisa Item, Amaran Awal, Statistik Penggunaan, Laporan Bulanan, Laporan Aktiviti, Analitik Adaptif, Monitoring, Kirkpatrick. Guru: Dashboard Guru, Pelajar Saya, Kelas Saya, Command Center, Prestasi, Laporan, Analitik Adaptif, Analisa Item, Laporan Mingguan, Kirkpatrick, Headcount |
 * | XS-2 Pelajar aktif | Distinct pupils of XS-1 with at least one answer row in the stated window (default "pernah menjawab" = all time). Logging in is not activity. "Aktif 30h" = at least one answer in the last 30 days and says so. | M05 answer log | Command Center ("aktif menjawab"), Monitoring "Pernah Aktif", Kirkpatrick Tahap 3, Statistik Penggunaan, Laporan Bulanan, Laporan Mingguan, Laporan Aktiviti "Murid Buat Latihan", Prestasi class "Aktif 7 Hari" |
 * | XS-3 Guru | Teacher accounts (`role = teacher`) of the school, approved and not deleted; pending teachers ("Guru Menunggu") and school-admin accounts are excluded. | M02 | AS: Senarai Guru, Dashboard "Jumlah Guru", Prestasi "Guru", Statistik Penggunaan, Monitoring "Guru Berdaftar" (also for the Guru), Laporan Aktiviti "Guru (n)", Kirkpatrick "Guru Aktif" |
 * | XS-4 Soalan dijawab | Count of answer rows in `practice_answers` (M05, **all modes**, XS-8) of the scope's pupils within the window; default all time, labelled "sepanjang masa"; windowed figures carry the window ("7 hari", "bulan ini"). XS-4b "Soalan" on Dashboard Guru and Sumbang Soalan = questions contributed by the teacher (M04); it is never labelled "Soalan Dijawab". | M05 (M04 for 4b) | Command Center, Prestasi, Analisa Item "Jawapan", Statistik Penggunaan, Laporan Aktiviti, Monitoring, Kirkpatrick Tahap 2, Laporan, Laporan Mingguan, Laporan Bulanan; pupil Prestasi and Penguasaan Subjek; Admin Pusat Command Center, Monitoring, Analitik, Laporan, Kirkpatrick (`30-admin-pusat.md` M-02..M-06) |
 * | XS-5 Ketepatan | Pooled accuracy = correct answers ÷ answered × 100 over the same rows as XS-4, displayed as a whole-number percent on every screen (the only exception is a Manual headcount AR keyed by the teacher, which may show 1 decimal); a self-marked part counts as correct only at full marks; "—" when there are 0 answers (never 0%, never above 100%). Per-session accuracy appears only inside session tables. "Ketepatan", "Ketepatan Purata" and "Purata Ketepatan" all mean this number. "Skor Purata" (Kirkpatrick Tahap 2, Laporan) is a different, separately named measure: the mean of per-session accuracies; it is never labelled "Ketepatan". | M05 | all screens of XS-4 plus the Amaran Awal "Ketepatan" column, the pupil Analisa Item, Remedial and Analitik cards, and the Admin Pusat screens of XS-4. Display precision follows the precision list of `40-cross-cutting.md` (FR-X4): one precision per metric on every screen |
 * | XS-6 Scope, windows, headcount | (a) The scope comes from the session, never from the request. (b) Every number names its window or says "sepanjang masa". (c) Seed/UAT dates are relative to now (FR-AS-0-3). (d) "{n} entri headcount" on Dashboard, Prestasi and the Headcount list is one count. (e) Guru "Kelas Aktif" = the teacher's rows of Kelas Sekolah. (f) Headcount status On Track = AR >= OTR target (HC-4, GUR-3) on every screen, pupil view included. | all | all |
 * | XS-7 Soalan Diuji | Count of **distinct** `question_id` answered by the scope's pupils in the window (from `practice_answers`, all modes). It is not the number of answer rows (that is XS-4). | M05 | Analisa Item (class and school), Admin Pusat Analisa Item views, the pupil Analisa Item |
 * | XS-8 Answer source | Every pupil answering activity writes its answers to the single answer store `practice_answers` with a mode value: Latih Tubi, Soalan by Chapter, SPM Databank (`databank`), Kuiz (`kuiz`), Bijak sittings including Tracking A (`simulasi`, `tracking_a`), Soalan Berstruktur (`structured`) and Kertas Subjektif (`subjektif`) self-mark results, Set Soalan Guru (`question_set`), Simulasi, Misi, remedial and question-based games (D-A1); the stored value of each is the master table "Pupil activity → stored `mode`" in 40 (X11). Every report reads that one store and includes all modes: Prestasi, Analisa Item, Analitik, Laporan, Laporan Mingguan, Headcount AR, AS reports, Command Center, Monitoring, Kirkpatrick, Admin Pusat monitoring and reports. A report that excludes a mode says so in its own caption. | M05 | all screens of XS-4, XS-5 and XS-7 |
 *
 * The data-term rules are in `docs/prd/r1/50-data-model-erd.md` section 5.3 (XS-1: `users.grade` 7..11, `is_active = true and
 * is_suspended = false`; XS-2/XS-4/XS-7 exclude `is_test` rows; XS-7 also rows without `question_id`; XS-3: `school_id` set, not
 * `pending_school_id`, no school-admin account).
 *
 * How the rows are implemented:
 * - XS-8 is the rule of every answer query below: they read `practice_answers` only, with no `mode` filter and no join to
 *   `practice_sessions` (so an answer of an unfinished session, or of a non-latihan mode, is counted).
 * - Windows are `{ from, to }` with `null` = unbounded (all time). BOTH bounds are INCLUSIVE on `practice_answers.answered_at`
 *   (`>= from`, `<= to`), the convention of `school-admin/reports/windows.ts` (`usageWindow` ends at `now`, `monthEnd` is the last
 *   millisecond of the month) and of the Command Center repository. Day and month grouping is Asia/Kuala_Lumpur.
 * - The scope is explicit (XS-6a: the caller takes it from the session): `school`, `teacher` ("kelas anda") or `platform`.
 *   Teacher scope = an active, non-test enrolment in an active classroom of the teacher AND an active, non-suspended account.
 *   Platform scope also leaves out pupils of primary schools (`PRIMARY_SCHOOL_TYPES`, D72), as the Command Center always did.
 * - XS-5 is a pooled figure (correct and answered are summed first, never an average of rounded values), sent as a number with
 *   ONE decimal (half up), `null` with 0 answers, never above 100 (R1-START-HERE section 11).
 * - XS-3 counts ACTIVE approved teachers only (PO decision 2026-11-05, #503 batch 3): role teacher, `school_id` set,
 *   `pending_school_id` null, `is_active` and not suspended, no school-admin role. The predicate lives in one place, `isXs3Teacher`.
 */
import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import { idFromString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { PRIMARY_SCHOOL_TYPES } from '../schools/schools.constants'

// --- types -----------------------------------------------------------------------------------------------------------------

/** `null` = unbounded (all time). Both bounds are inclusive on `practice_answers.answered_at`. */
export interface XsWindow {
  from: Date | null
  to: Date | null
}

/** All time, labelled "sepanjang masa". */
export const XS_ALL_TIME: XsWindow = Object.freeze({ from: null, to: null })

export type XsScope =
  | { kind: 'school'; schoolId: string }
  | { kind: 'teacher'; teacherId: string; schoolId?: string }
  | { kind: 'platform'; schoolIds?: readonly string[] }

export interface XsPupils {
  count: number
  /** Ascending decimal ids. */
  ids: string[]
}

export interface XsAnswerTotals {
  /** XS-4. */
  answered: number
  correct: number
  /** XS-5: one decimal, `null` without answers. */
  accuracy: number | null
}

export interface XsSummary {
  /** XS-1. */
  pupils: number
  /** XS-2. */
  activePupils: number
  /** XS-4. */
  answers: number
  correct: number
  /** XS-5. */
  accuracy: number | null
  /** XS-7. */
  questionsTested: number
}

export interface XsPupilTally {
  answered: number
  correct: number
}

export interface XsMonthTally extends XsPupilTally {
  /** Distinct XS-1 pupils with an answer in the month (XS-2 of that month). */
  pupils: number
}

// --- pure helpers ----------------------------------------------------------------------------------------------------------

/**
 * XS-5: `correct / answered x 100`, rounded HALF UP to one decimal with integer arithmetic (no floating-point drift on exact
 * halves), never above 100, `null` (shown "—") with 0 answers. A whole result carries no fraction (74, not 74.0) because it is
 * a JSON number.
 */
export function xsAccuracy(correct: number, answered: number): number | null {
  if (!(answered > 0)) return null
  const tenths = Math.floor((2000 * Math.max(0, correct) + answered) / (2 * answered))
  return Math.min(100, tenths / 10)
}

/** The lead's name for the same pooled helper (decision 11): `xsAccuracy` stays the one implementation. */
export const pooledAccuracy = xsAccuracy

// --- SQL fragments ---------------------------------------------------------------------------------------------------------

const ALIAS = /^[a-z_][a-z0-9_]*$/i

function alias(name: string): Prisma.Sql {
  if (!ALIAS.test(name)) throw new Error(`Invalid SQL alias: ${name}`)
  return Prisma.raw(name)
}

/**
 * XS-1 as a condition on the users table `alias` (default `u`): a pupil account, active and not suspended, Tingkatan 1-5
 * (`grade` 7..11; a pupil without a grade is not counted). Pending (`is_active = false`, not suspended) and deactivated accounts
 * are out. The scope (school, class) is added by the caller. Raw-SQL callers embed this fragment.
 */
export function XS_PUPIL_SQL(userAlias = 'u'): Prisma.Sql {
  const u = alias(userAlias)
  return Prisma.sql`(EXISTS (SELECT 1 FROM user_roles xsr WHERE xsr.user_id = ${u}.id AND xsr.role = 'student')
    AND ${u}.is_active = true AND ${u}.is_suspended = false AND ${u}.grade BETWEEN 7 AND 11)`
}

/**
 * `isXs3Teacher`, the one XS-3 predicate, as a condition on the users table `alias` (default `u`): a teacher account, approved
 * (`pending_school_id` is null), active and not suspended, with no school-admin role (PO decision 2026-11-05, #503 batch 3). The
 * school (`school_id = ...`, set) is added by the caller; `XsQueries.teachers`, `teacherCount` and the Command Center use this.
 */
export function isXs3Teacher(userAlias = 'u'): Prisma.Sql {
  const u = alias(userAlias)
  return Prisma.sql`(${u}.pending_school_id IS NULL AND ${u}.is_active = true AND ${u}.is_suspended = false
    AND EXISTS (SELECT 1 FROM user_roles xtr WHERE xtr.user_id = ${u}.id AND xtr.role = 'teacher')
    AND NOT EXISTS (SELECT 1 FROM user_roles xar WHERE xar.user_id = ${u}.id AND xar.role = 'school_admin'))`
}

/** Same predicate under the name the raw-SQL callers already use. */
export const XS_TEACHER_SQL = isXs3Teacher

const idOrNull = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)

function schoolSql(userAlias: string, schoolId: string): Prisma.Sql {
  const sid = idOrNull(schoolId)
  return sid === null ? Prisma.sql`false` : Prisma.sql`${alias(userAlias)}.school_id = ${sid}`
}

/** The scope part of the pupil population (without XS-1): school, the teacher's classes, or the platform. */
function scopeSql(scope: XsScope, userAlias: string): Prisma.Sql {
  const u = alias(userAlias)
  if (scope.kind === 'school') return schoolSql(userAlias, scope.schoolId)
  if (scope.kind === 'teacher') {
    const tid = idOrNull(scope.teacherId)
    if (tid === null) return Prisma.sql`false`
    const own = Prisma.sql`EXISTS (SELECT 1 FROM enrolments xe JOIN classrooms xc ON xc.id = xe.classroom_id
      WHERE xe.student_id = ${u}.id AND xe.status = 'active' AND xe.is_test = false
        AND xc.teacher_id = ${tid} AND xc.is_active = true AND xc.kind = 'classroom')`
    return scope.schoolId === undefined ? own : Prisma.sql`${own} AND ${schoolSql(userAlias, scope.schoolId)}`
  }
  // platform: no primary-school pupils (D72); optionally limited to some schools.
  const hidden = Prisma.sql`NOT EXISTS (SELECT 1 FROM schools xp WHERE xp.id = ${u}.school_id AND xp.type IN (${Prisma.join([...PRIMARY_SCHOOL_TYPES])}))`
  if (scope.schoolIds === undefined) return hidden
  const ids = scope.schoolIds.flatMap((s) => idOrNull(s) ?? [])
  return ids.length === 0 ? Prisma.sql`false` : Prisma.sql`${hidden} AND ${u}.school_id = ANY(${ids}::bigint[])`
}

/** The XS-1 pupils of the scope as a condition on the users table `alias`. */
export function xsPupilScopeSql(scope: XsScope, userAlias = 'u'): Prisma.Sql {
  return Prisma.sql`${XS_PUPIL_SQL(userAlias)} AND ${scopeSql(scope, userAlias)}`
}

function windowSql(w: XsWindow, column = 'a.answered_at'): Prisma.Sql {
  const col = Prisma.raw(column)
  const parts: Prisma.Sql[] = []
  if (w.from) parts.push(Prisma.sql`${col} >= ${w.from}`)
  if (w.to) parts.push(Prisma.sql`${col} <= ${w.to}`)
  return parts.length === 0 ? Prisma.sql`true` : Prisma.join(parts, ' AND ')
}

/** `FROM ... WHERE ...` over the answer rows of the scope's XS-1 pupils in the window (XS-4 and XS-8: `practice_answers` only). */
function answerRows(scope: XsScope, w: XsWindow): Prisma.Sql {
  return Prisma.sql`FROM practice_answers a JOIN users u ON u.id = a.user_id
    WHERE NOT a.is_test AND ${windowSql(w)} AND ${xsPupilScopeSql(scope, 'u')}`
}

const KL = 'Asia/Kuala_Lumpur'

type Row = Record<string, unknown>
const num = (v: unknown): number => Number(v ?? 0)

// --- queries ---------------------------------------------------------------------------------------------------------------

@Injectable()
export class XsQueries {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private q(query: Prisma.Sql): Promise<Row[]> {
    return this.prisma.client.$queryRaw<Row[]>(query)
  }

  /** XS-1: the pupils of the scope (count and ids). */
  async pupils(scope: XsScope): Promise<XsPupils> {
    const rows = await this.q(Prisma.sql`SELECT u.id::text AS id FROM users u WHERE ${xsPupilScopeSql(scope)} ORDER BY u.id`)
    const ids = rows.map((r) => String(r.id))
    return { count: ids.length, ids }
  }

  /** XS-1 as a number only (a platform scope can be large). */
  async pupilCount(scope: XsScope): Promise<number> {
    const [r] = await this.q(Prisma.sql`SELECT count(*)::int AS c FROM users u WHERE ${xsPupilScopeSql(scope)}`)
    return num(r?.c)
  }

  /** XS-2: the distinct XS-1 pupils with at least one answer row in the window. */
  async activePupils(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<XsPupils> {
    const rows = await this.q(Prisma.sql`SELECT DISTINCT u.id::text AS id, u.id AS sort_id ${answerRows(scope, window)} ORDER BY sort_id`)
    const ids = rows.map((r) => String(r.id))
    return { count: ids.length, ids }
  }

  /** XS-2 as a number only. */
  async activePupilCount(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<number> {
    const [r] = await this.q(Prisma.sql`SELECT count(DISTINCT a.user_id)::int AS c ${answerRows(scope, window)}`)
    return num(r?.c)
  }

  /** XS-3: the teachers of a school (count and ids). Active approved teachers only (see the header). */
  async teachers(schoolId: string): Promise<XsPupils> {
    const rows = await this.q(Prisma.sql`SELECT u.id::text AS id FROM users u WHERE ${schoolSql('u', schoolId)} AND ${isXs3Teacher()} ORDER BY u.id`)
    const ids = rows.map((r) => String(r.id))
    return { count: ids.length, ids }
  }

  /** XS-3 as a number only. */
  async teacherCount(schoolId: string): Promise<number> {
    const [r] = await this.q(Prisma.sql`SELECT count(*)::int AS c FROM users u WHERE ${schoolSql('u', schoolId)} AND ${isXs3Teacher()}`)
    return num(r?.c)
  }

  /** XS-4: answer rows of the scope's pupils in the window (all modes, XS-8). */
  async answers(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<number> {
    return (await this.answerTotals(scope, window)).answered
  }

  /** XS-4 and XS-5 over the same rows. */
  async answerTotals(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<XsAnswerTotals> {
    const [r] = await this.q(Prisma.sql`
      SELECT count(*)::int AS answered, count(*) FILTER (WHERE a.is_correct)::int AS correct ${answerRows(scope, window)}`)
    const answered = num(r?.answered)
    const correct = num(r?.correct)
    return { answered, correct, accuracy: xsAccuracy(correct, answered) }
  }

  /** XS-7: distinct `question_id` over the XS-4 rows (rows without a question are not counted). */
  async questionsTested(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<number> {
    const [r] = await this.q(Prisma.sql`SELECT count(DISTINCT a.question_id)::int AS c ${answerRows(scope, window)}`)
    return num(r?.c)
  }

  /** XS-1, XS-2, XS-4, XS-5 and XS-7 of one scope and window in two statements. */
  async summary(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<XsSummary> {
    const [pupils, rows] = await Promise.all([
      this.pupilCount(scope),
      this.q(Prisma.sql`
        SELECT count(*)::int AS answered, count(*) FILTER (WHERE a.is_correct)::int AS correct,
               count(DISTINCT a.user_id)::int AS active, count(DISTINCT a.question_id)::int AS tested ${answerRows(scope, window)}`),
    ])
    const r = rows[0]
    const answers = num(r?.answered)
    const correct = num(r?.correct)
    return { pupils, activePupils: num(r?.active), answers, correct, accuracy: xsAccuracy(correct, answers), questionsTested: num(r?.tested) }
  }

  /** XS-4 per pupil (only pupils with answers) in the window; the sums over the map equal `answerTotals`. */
  async tallyByPupil(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<Map<string, XsPupilTally>> {
    const rows = await this.q(Prisma.sql`
      SELECT a.user_id::text AS user_id, count(*)::int AS answered, count(*) FILTER (WHERE a.is_correct)::int AS correct
        ${answerRows(scope, window)} GROUP BY a.user_id`)
    return new Map(rows.map((r) => [String(r.user_id), { answered: num(r.answered), correct: num(r.correct) }]))
  }

  /** XS-4 and XS-2 per MYT calendar month (`YYYY-MM`; only months with answers). */
  async tallyByMonth(scope: XsScope, window: XsWindow): Promise<Map<string, XsMonthTally>> {
    const rows = await this.q(Prisma.sql`
      SELECT to_char(a.answered_at AT TIME ZONE ${KL}, 'YYYY-MM') AS month, count(*)::int AS answered,
             count(*) FILTER (WHERE a.is_correct)::int AS correct, count(DISTINCT a.user_id)::int AS pupils
        ${answerRows(scope, window)} GROUP BY 1`)
    return new Map(rows.map((r) => [String(r.month), { answered: num(r.answered), correct: num(r.correct), pupils: num(r.pupils) }]))
  }

  /** XS-4 and XS-2 per subject (`practice_answers.subject_id`; rows without a subject are left out), all modes, no session join. */
  async tallyBySubject(scope: XsScope, window: XsWindow = XS_ALL_TIME): Promise<Map<string, XsMonthTally>> {
    const rows = await this.q(Prisma.sql`
      SELECT a.subject_id::text AS subject_id, count(*)::int AS answered, count(*) FILTER (WHERE a.is_correct)::int AS correct,
             count(DISTINCT a.user_id)::int AS pupils
        ${answerRows(scope, window)} AND a.subject_id IS NOT NULL GROUP BY a.subject_id`)
    return new Map(rows.map((r) => [String(r.subject_id), { answered: num(r.answered), correct: num(r.correct), pupils: num(r.pupils) }]))
  }
}
