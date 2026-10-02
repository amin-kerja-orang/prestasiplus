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
import { headcountRepo } from '../repository/headcount'
import {
  configSchoolId,
  csvOf,
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

const sortOf = (raw: string | undefined): HeadcountSort => (raw === 'name' ? 'name' : 'ranking')

export const headcountRoutes: RouteDef[] = [
  route('GET', '/api/headcounts', [guard], (req) => {
    const viewer = viewerOf(req)
    return ok(headcountRepo.configsOfTeacher(viewer.id).map(listItem))
  }),

  route('GET', '/api/headcounts/dashboard', [guard], (req) => {
    const viewer = viewerOf(req)
    return ok({ configs: headcountRepo.configsOfTeacher(viewer.id).map(dashboardItem) })
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
      const c = configOf(viewerOf(req), req.params.id as number)
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
      const c = configOf(viewerOf(req), req.params.id as number)
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
      const c = configOf(viewerOf(req), req.params.id as number)
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
]
