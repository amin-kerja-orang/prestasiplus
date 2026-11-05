/**
 * SRS M08 v1.12 §7 #12 list, #13 dashboard, #14 form options, #15 create, #16 auto-setup, #17 pupil
 * sections (S15), #24 summary (S22), #25 detail (S23), #26 reset, #27 delete, #28 drop / restore, #29
 * CSV export (M08-T1b).
 *
 * Access (§9, OD-R3): admin, guru and school admin only; pelajar, ibu bapa, penaja and the PPD / JPN
 * officers get 403 on every route (the headcount pages are not theirs). Admin: any config by URL, own
 * configs = none (S12 empty). Guru: own configs only. School admin: the same as admin scoped to the own
 * school (a config, class or pupil of another school → 403). An unknown id is a 404 (checked before the
 * 403); validation errors are the standard 422 with `fields`; a duplicate mode is a 409 CONFLICT.
 * Flash copy comes from the API `status`. The copy of the messages below is PROPOSED (SRS §8.2).
 */

import { toIsoMyt } from '@/lib/time'
import {
  blob,
  conflict,
  created,
  int,
  ok,
  queryString,
  requireRole,
  route,
  validationError,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { HeadcountFormOptions, HeadcountMode, HeadcountSort } from '../../api/headcount-types'
import { PERFORMANCE_HEADCOUNT_MESSAGES } from '@pp/contract'

import { MARK_RANGE_ERROR } from '../../lib/headcount/otr'
import { headcountRepo } from '../repository/headcount'
import {
  configSchoolId,
  csvOf,
  ownConfigsOf,
  ownListItem,
  ownStudentOf,
  dashboardItem,
  detailOf,
  levelNameOf,
  listItem,
  rosterOf,
  studentOf,
  summaryOf,
} from '../repository/headcount-views'
import type { HeadcountConfigRow } from '../repository/headcount-types'
import { FORBIDDEN, NOT_FOUND, ownClasses, viewerOf, type Viewer } from './common'

const guard = requireRole('admin', 'teacher', 'school_admin')
/** API-RPT-08 (S10-T09): the pupil's own views; staff get 403. */
const pupilGuard = requireRole('student')

/** §9: may the viewer open / change this config? */
function mayUse(viewer: Viewer, c: HeadcountConfigRow): boolean {
  switch (viewer.role) {
    case 'admin':
      return true
    case 'teacher':
      return c.teacherId === viewer.id
    case 'school_admin':
      return viewer.schoolId !== null && configSchoolId(c) === viewer.schoolId
    default:
      return false
  }
}

/** Ch1: the configs the viewer lists: own (teacher), own school (school admin), every one (admin). */
function listedConfigs(viewer: Viewer): HeadcountConfigRow[] {
  switch (viewer.role) {
    case 'admin':
      return headcountRepo.configs()
    case 'school_admin':
      return headcountRepo
        .configs()
        .filter((c) => viewer.schoolId !== null && configSchoolId(c) === viewer.schoolId)
    default:
      return headcountRepo.configsOfTeacher(viewer.id)
  }
}

/**
 * A write (AC-AS-3-3, decision 7): the owning teacher only. Unknown id and another teacher's config
 * are 404; school admin and admin read but never write: 403 when the config is visible to them, 404
 * when it is not (like the API, which never confirms a config the viewer cannot see).
 */
function writeConfigOf(viewer: Viewer, id: number): HeadcountConfigRow | MockResponse {
  const c = headcountRepo.config(id)
  if (!c) return NOT_FOUND()
  if (viewer.role === 'teacher') return c.teacherId === viewer.id ? c : NOT_FOUND()
  return mayUse(viewer, c) ? FORBIDDEN() : NOT_FOUND()
}

/** True when `YYYY-MM-DD` is a real calendar day (parsed as a MYT date and re-formatted it equals the input, no rollover). */
function isRealIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = new Date(`${value}T00:00:00+08:00`).getTime()
  return Number.isFinite(t) && new Date(t + 8 * 3_600_000).toISOString().slice(0, 10) === value
}

/** The config of `:id` for the viewer: the config, or the 404 / 403 response. */
function configOf(viewer: Viewer, id: number): HeadcountConfigRow | MockResponse {
  const c = headcountRepo.config(id)
  if (!c) return NOT_FOUND()
  return mayUse(viewer, c) ? c : FORBIDDEN()
}

/** A config row has `teacherId`; a responder result has `headers` (a config also has a `status`). */
const isResponse = (v: HeadcountConfigRow | MockResponse): v is MockResponse => 'headers' in v

const clockYear = (now: number): number => new Date(now + 8 * 3_600_000).getUTCFullYear()

/** A form integer: a number or a digit string (the S14 form posts strings), else undefined. */
function toInt(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isInteger(v) ? v : undefined
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim())
  return undefined
}

const MODES: readonly HeadcountMode[] = ['auto', 'manual']
const OTR_VALUES = [2, 3, 4, 5]

const DUPLICATE_COPY: Readonly<Record<HeadcountMode, string>> = {
  auto: 'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
  manual: 'Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud.',
}

/** BR-M08-21: a level id 1–11, "D1"–"D6" (1–6) or "T1"–"T5" (7–11). */
function levelIdOf(v: unknown): number | undefined {
  const n = toInt(v)
  if (n !== undefined) return n >= 1 && n <= 11 ? n : undefined
  if (typeof v !== 'string') return undefined
  const m = /^([DT])([1-6])$/i.exec(v.trim())
  if (!m) return undefined
  const k = Number(m[2])
  if ((m[1] as string).toUpperCase() === 'D') return k
  return k <= 5 ? 6 + k : undefined
}

/** A mark: null / '' = empty, a number 0…100, else undefined (invalid). */
function markOf(v: unknown): number | null | undefined {
  if (v === null || v === '') return null
  const n = typeof v === 'string' ? Number(v.trim()) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined
}

const sortOf = (raw: string | undefined): HeadcountSort => (raw === 'name' ? 'name' : 'ranking')

export const headcountRoutes: RouteDef[] = [
  // API-RPT-08, declared before `:id` and `students/:userId`.
  route('GET', '/api/headcounts/me', [pupilGuard], (req) => {
    const viewer = viewerOf(req)
    return ok(ownConfigsOf(viewer.id).map((c) => ownListItem(c, viewer.id)))
  }),

  route('GET', '/api/headcounts/me/detail', [pupilGuard], (req) => {
    const viewer = viewerOf(req)
    const raw = queryString(req.query, 'configId')
    let config: HeadcountConfigRow | undefined
    if (raw !== undefined && raw !== '') {
      const id = toInt(raw)
      config = id === undefined ? undefined : ownConfigsOf(viewer.id).find((c) => c.id === id)
      // A foreign or unknown config is one outcome (404), never a 403: existence does not leak.
      if (!config) return NOT_FOUND()
    } else {
      config = ownConfigsOf(viewer.id)[0]
    }
    const out = ownStudentOf(viewer.id, config)
    return out ? ok(out) : NOT_FOUND()
  }),

  route('GET', '/api/headcounts', [guard], (req) => {
    const viewer = viewerOf(req)
    return ok(listedConfigs(viewer).map(listItem))
  }),

  route('GET', '/api/headcounts/dashboard', [guard], (req) => {
    const viewer = viewerOf(req)
    return ok({ configs: listedConfigs(viewer).map(dashboardItem) })
  }),

  route('GET', '/api/headcounts/form-options', [guard], (req, ctx) => {
    const viewer = viewerOf(req)
    const body: HeadcountFormOptions = {
      classes: ownClasses(viewer).map((c) => ({ id: c.classId, name: c.name })),
      subjects: curriculum
        .subjects({ active: true })
        .map((s) => ({ id: s.id, name: s.name, code: s.code }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
      levels: [10, 11].map((id) => ({ id, name: levelNameOf(id) })),
      defaultYear: clockYear(ctx.clock.now()),
    }
    return ok(body)
  }),

  route('POST', '/api/headcounts', [guard], (req, ctx) => {
    const viewer = viewerOf(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const fields: Record<string, string> = {}
    const classroomId = toInt(body.classroomId)
    const subjectId = toInt(body.subjectId)
    const educationLevelId = toInt(body.educationLevelId)
    const academicYear = toInt(body.academicYear)
    const activeOtrs = toInt(body.activeOtrs)
    const mode = body.mode
    if (classroomId === undefined) fields.classroomId = 'Kelas diperlukan.'
    else if (!ownClasses(viewer).some((c) => c.classId === classroomId)) {
      fields.classroomId = 'Kelas tidak sah.'
    }
    if (subjectId === undefined || curriculum.subject(subjectId) === undefined) {
      fields.subjectId = 'Subjek tidak sah.'
    }
    if (educationLevelId !== 10 && educationLevelId !== 11) {
      fields.educationLevelId = 'Tingkatan tidak sah.'
    }
    if (academicYear === undefined || academicYear < 2020 || academicYear > 2100) {
      fields.academicYear = 'Tahun akademik mesti antara 2020 dan 2100.'
    }
    if (activeOtrs === undefined || !OTR_VALUES.includes(activeOtrs)) {
      fields.activeOtrs = 'Bilangan OTR mesti 2, 3, 4 atau 5.'
    }
    if (typeof mode !== 'string' || !MODES.includes(mode as HeadcountMode)) {
      fields.mode = 'Mod pengiraan tidak sah.'
    }
    if (Object.keys(fields).length > 0) return validationError(fields)

    const input = {
      classroomId: classroomId as number,
      subjectId: subjectId as number,
      academicYear: academicYear as number,
      mode: mode as HeadcountMode,
    }
    if (headcountRepo.duplicateOf(input)) return conflict(DUPLICATE_COPY[input.mode])
    const row = headcountRepo.create(
      {
        ...input,
        teacherId: viewer.id,
        educationLevelId: educationLevelId as number,
        activeOtrs: activeOtrs as number,
      },
      ctx.clock.now(),
    )
    return created({ id: row.id })
  }),

  route('POST', '/api/headcounts/auto-setup', [guard], (req, ctx) => {
    const viewer = viewerOf(req)
    const raw = (req.body as { levels?: unknown } | undefined)?.levels
    if (!Array.isArray(raw) || raw.length === 0) {
      return validationError({ levels: 'Pilih sekurang-kurangnya satu tingkatan.' })
    }
    const levels = new Set<number>()
    for (const v of raw) {
      const id = levelIdOf(v)
      if (id === undefined) return validationError({ levels: 'Tingkatan tidak sah.' })
      levels.add(id)
    }
    const now = ctx.clock.now()
    const year = clockYear(now)
    let createdCount = 0
    for (const cls of ownClasses(viewer)) {
      // INFERRED: a class without a subject has nothing to track, so it gets no config.
      if (!levels.has(cls.levelId) || cls.subjectId === null) continue
      if (headcountRepo.existsForClass(cls.classId, cls.subjectId, year)) continue
      headcountRepo.create(
        {
          teacherId: viewer.id,
          classroomId: cls.classId,
          subjectId: cls.subjectId,
          educationLevelId: cls.levelId,
          academicYear: year,
          activeOtrs: 3,
          mode: 'auto',
        },
        now,
      )
      createdCount++
    }
    return ok({ created: createdCount })
  }),

  route(
    'GET',
    '/api/headcounts/students/:userId',
    [guard],
    (req) => {
      const viewer = viewerOf(req)
      const userId = req.params.userId as number
      const pupil = users.get(userId)
      if (!pupil || pupil.role !== 'student') return NOT_FOUND()
      let visible: (c: HeadcountConfigRow) => boolean
      if (viewer.role === 'admin') {
        visible = () => true
      } else if (viewer.role === 'school_admin') {
        if (viewer.schoolId === null || pupil.schoolId !== viewer.schoolId) return FORBIDDEN()
        visible = (c) => configSchoolId(c) === viewer.schoolId
      } else {
        // Guru: pupils of the own classes, through the own configs only (INFERRED).
        const own = (c: HeadcountConfigRow) => c.teacherId === viewer.id
        const related =
          classrooms.teacherStudentIds(viewer.id).includes(userId) ||
          headcountRepo.entriesOfStudent(userId).some((e) => {
            const c = headcountRepo.config(e.configId)
            return c !== undefined && own(c)
          })
        if (!related) return FORBIDDEN()
        visible = own
      }
      const out = studentOf(userId, visible)
      return out ? ok(out) : NOT_FOUND()
    },
    { params: { userId: int() } },
  ),

  route(
    'GET',
    '/api/headcounts/:id/summary',
    [guard],
    (req) => {
      const c = configOf(viewerOf(req), req.params.id as number)
      return isResponse(c) ? c : ok(summaryOf(c))
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/headcounts/:id/export',
    [guard],
    (req) => {
      const c = configOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      const csv = csvOf(c, sortOf(queryString(req.query, 'sort')))
      return blob(new Blob([csv], { type: 'text/csv' }), `headcount-${String(c.id)}.csv`)
    },
    { params: { id: int() } },
  ),

  route(
    'GET',
    '/api/headcounts/:id',
    [guard],
    (req) => {
      const c = configOf(viewerOf(req), req.params.id as number)
      return isResponse(c) ? c : ok(detailOf(c, sortOf(queryString(req.query, 'sort'))))
    },
    { params: { id: int() } },
  ),

  route(
    'POST',
    '/api/headcounts/:id/reset',
    [guard],
    (req, ctx) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      headcountRepo.resetMarks(c.id, ctx.clock.now())
      return ok({ reset: true })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/headcounts/:id',
    [guard],
    (req) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      headcountRepo.remove(c.id)
      return ok({ deleted: true })
    },
    { params: { id: int() } },
  ),

  route(
    'POST',
    '/api/headcounts/:id/drop-students',
    [guard],
    (req, ctx) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      const body = (req.body ?? {}) as Record<string, unknown>
      const fields: Record<string, string> = {}
      const action = body.action
      if (action !== 'drop' && action !== 'restore') fields.action = 'Tindakan tidak sah.'
      const ids = Array.isArray(body.studentIds) ? body.studentIds.map(toInt) : []
      const roster = new Set(rosterOf(c).map((l) => l.studentId))
      if (ids.length === 0) fields.studentIds = 'Pilih sekurang-kurangnya seorang murid.'
      else if (ids.some((id) => id === undefined || !roster.has(id))) {
        fields.studentIds = 'Murid tidak sah.'
      }
      if (Object.keys(fields).length > 0) return validationError(fields)
      const updated = headcountRepo.setDropped(
        c.id,
        [...new Set(ids as number[])],
        action === 'drop',
        ctx.clock.now(),
      )
      return ok({ updated })
    },
    { params: { id: int() } },
  ),
  route(
    'PUT',
    '/api/headcounts/:id/ar',
    [guard],
    (req, ctx) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      const body = (req.body ?? {}) as Record<string, unknown>
      const n = body.checkpoint
      // AC-GUR-3-5: no key-in on an Auto config; a checkpoint outside 1..activeOtrs does not exist.
      if (c.mode !== 'manual') return NOT_FOUND()
      if (typeof n === 'number' && Number.isInteger(n) && (n < 1 || n > c.activeOtrs)) return NOT_FOUND()
      // Like the API contract: the checkpoint is a whole number, else 422.
      if (typeof n !== 'number' || !Number.isInteger(n)) {
        return validationError({ checkpoint: PERFORMANCE_HEADCOUNT_MESSAGES.checkpointInvalid })
      }
      const roster = new Set(rosterOf(c).map((l) => l.studentId))
      const raw = Array.isArray(body.marks) ? (body.marks as Record<string, unknown>[]) : []
      const fields: Record<string, string> = {}
      const marks: { studentId: number; value: number | null }[] = []
      raw.forEach((m, i) => {
        const studentId = toInt(m?.userId)
        const value = markOf(m?.value)
        if (studentId === undefined || !roster.has(studentId)) fields[`marks.${String(i)}.userId`] = 'Murid tidak sah.'
        else if (value === undefined) fields[`marks.${String(i)}.value`] = MARK_RANGE_ERROR
        else marks.push({ studentId, value })
      })
      if (Object.keys(fields).length > 0) return validationError(fields)
      headcountRepo.setAr(c.id, n, marks, ctx.clock.now())
      return ok(detailOf(c, 'ranking'))
    },
    { params: { id: int() } },
  ),

  route(
    'PUT',
    '/api/headcounts/:id/tov',
    [guard],
    (req, ctx) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      const body = (req.body ?? {}) as Record<string, unknown>
      const roster = new Set(rosterOf(c).map((l) => l.studentId))
      const raw = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : []
      const today = toIsoMyt(ctx.clock.now()).slice(0, 10)
      const storedRs = new Map(headcountRepo.entriesOf(c.id).map((e) => [e.studentId, e.rs]))
      const fields: Record<string, string> = {}
      const rows: Parameters<typeof headcountRepo.setTov>[1][number][] = []
      raw.forEach((r, i) => {
        const key = (f: string): string => `rows.${String(i)}.${f}`
        const studentId = toInt(r?.userId)
        if (studentId === undefined || !roster.has(studentId)) {
          fields[key('userId')] = 'Murid tidak sah.'
          return
        }
        const out: (typeof rows)[number] = { studentId }
        for (const f of ['tov', 'etr', 'rs'] as const) {
          if (r[f] === undefined) continue
          const v = markOf(r[f])
          if (v === undefined) fields[key(f)] = MARK_RANGE_ERROR
          else out[f] = v
        }
        if (r.rsRecordedAt !== undefined) {
          const d = r.rsRecordedAt
          if (d === null) out.rsRecordedAt = null
          else if (typeof d !== 'string' || !isRealIsoDay(d)) {
            fields[key('rsRecordedAt')] = PERFORMANCE_HEADCOUNT_MESSAGES.rsDateInvalid
          } else if (d > today) {
            fields[key('rsRecordedAt')] = PERFORMANCE_HEADCOUNT_MESSAGES.rsDateFuture
          } else {
            // A date needs an RS: the one sent, else the stored one.
            const effectiveRs = out.rs !== undefined ? out.rs : (storedRs.get(studentId) ?? null)
            if (effectiveRs === null) fields[key('rsRecordedAt')] = PERFORMANCE_HEADCOUNT_MESSAGES.rsDateNeedsRs
            else out.rsRecordedAt = d
          }
        }
        rows.push(out)
      })
      if (Object.keys(fields).length > 0) return validationError(fields)
      headcountRepo.setTov(c.id, rows, today, ctx.clock.now())
      return ok(detailOf(c, 'ranking'))
    },
    { params: { id: int() } },
  ),

  route(
    'PUT',
    '/api/headcounts/:id/settings',
    [guard],
    (req, ctx) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      const body = (req.body ?? {}) as Record<string, unknown>
      const n = toInt(body.activeOtrs)
      if (n === undefined || !OTR_VALUES.includes(n)) {
        return validationError({ activeOtrs: PERFORMANCE_HEADCOUNT_MESSAGES.otrInvalid })
      }
      // CF-05: lowering the count over keyed AR asks first; "Ya, Padam" repeats the call with `confirm`.
      // An Auto config has no keyed AR to protect (its AR is derived): trimmed without the prompt.
      if (c.mode !== 'auto' && n < c.activeOtrs && body.confirm !== true && headcountRepo.marksAbove(c.id, n) !== null) {
        return conflict(PERFORMANCE_HEADCOUNT_MESSAGES.otrLoweringConfirm(n + 1))
      }
      headcountRepo.setActiveOtrs(c.id, n, ctx.clock.now())
      return ok(detailOf(headcountRepo.config(c.id) as HeadcountConfigRow, 'ranking'))
    },
    { params: { id: int() } },
  ),

  route(
    'PUT',
    '/api/headcounts/:id/defaults',
    [guard],
    (req, ctx) => {
      const c = writeConfigOf(viewerOf(req), req.params.id as number)
      if (isResponse(c)) return c
      const body = (req.body ?? {}) as Record<string, unknown>
      const defaultTov = body.defaultTov === undefined ? undefined : markOf(body.defaultTov)
      const defaultEtr = body.defaultEtr === undefined ? undefined : markOf(body.defaultEtr)
      const fields: Record<string, string> = {}
      if (defaultTov === undefined) fields.defaultTov = MARK_RANGE_ERROR
      if (defaultEtr === undefined) fields.defaultEtr = MARK_RANGE_ERROR
      if (Object.keys(fields).length > 0) return validationError(fields)
      headcountRepo.setDefaults(
        c.id,
        { defaultTov: defaultTov as number | null, defaultEtr: defaultEtr as number | null },
        ctx.clock.now(),
      )
      return ok(detailOf(headcountRepo.config(c.id) as HeadcountConfigRow, 'ranking'))
    },
    { params: { id: int() } },
  ),
]
