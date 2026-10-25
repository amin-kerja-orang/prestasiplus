/**
 * SRS M08 v1.11 §7 #9 school item analysis (S9), #10 class list (S10), #11 class analysis (S11).
 *
 * - #9 `/api/item-analysis/school` = the viewer's school; `/school/:schoolId`: admin any school, PPD /
 *   JPN officers schools of their district / state, other roles their own school, else 403 (BR-M08-17,
 *   INFERRED). An unknown id is the empty by-id payload (FR-M08-143); parents and sponsors have no access (403).
 * - #10: the admin lists every class, a teacher the own classes (BR-M08-26); pelajar and school admin
 *   are 403 (§9). Order BR-M08-30 (`createdAt` descending, the same batch by id ascending).
 * - #11: FR-M08-08 replicates the observed live page: an unknown class id or a class the viewer may not
 *   open is the 403 page ("Akses Ditolak"), so #11 answers 403 for both (documented exception to the
 *   module-wide "unknown id → 404" rule; SRS FR-M08-08).
 */

import { forbidden, int, notFound, ok, requireAuth, route, type RouteDef } from '@/mock/define'
import { queryString } from '@/mock/define'
import { classrooms } from '@/modules/m10-teacher-class/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import type { ClassCard, SchoolItemAnalysis } from '../../api/types'
import { classCard } from '../repository/performance'
import { classItemAnalysis, schoolItemAnalysis } from '../repository/item-analysis'
import {
  mayOpenClass,
  officerCovers,
  ownClasses,
  subjectColorOf,
  subjectNameOf,
  viewerOf,
  type Viewer,
} from './common'

const SCHOOL_ROLES: readonly string[] = [
  'admin',
  'teacher',
  'school_admin',
  'ppd_officer',
  'jpn_officer',
]

function tingkatanOf(value: string | undefined): 'T4' | 'T5' | null {
  return value === 'T4' || value === 'T5' ? value : null
}

/** The by-id payload of an id that is no school: no pupils, no name (the page shows the empty state only). */
function unknownSchoolPayload(id: number, tingkatan: 'T4' | 'T5' | null): SchoolItemAnalysis {
  return {
    school: { id, name: '', code: null, type: '', district: null, state: '' },
    variant: 'byId',
    tingkatan,
    students: 0,
    answers: 0,
    correct: 0,
    accuracy: 0,
    difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
    gps: { value: null, band: null, entries: 0, years: [] },
    subjects: [],
    questions: [],
  }
}

function schoolHandler(
  viewer: Viewer,
  schoolId: number | null,
  tingkatan: string | undefined,
  byId: boolean,
) {
  if (!SCHOOL_ROLES.includes(viewer.role)) return forbidden()
  if (schoolId === null) return notFound()
  const known = schools.get(schoolId) !== undefined
  if (!known && !byId) return notFound()
  if (byId && viewer.role !== 'admin' && schoolId !== viewer.schoolId) {
    const officer = viewer.role === 'ppd_officer' || viewer.role === 'jpn_officer'
    if (!officer || !officerCovers(viewer.user, schoolId)) return forbidden()
  }
  // FR-M08-143: an unknown id is the empty by-id state ("Tiada Data Pelajar"), not a 404.
  if (!known) return ok(unknownSchoolPayload(schoolId, tingkatanOf(tingkatan)))
  const out = schoolItemAnalysis(schoolId, tingkatanOf(tingkatan), byId ? 'byId' : 'own')
  return out ? ok(out) : notFound()
}

export const itemAnalysisRoutes: RouteDef[] = [
  route('GET', '/api/item-analysis/school', [requireAuth()], (req) => {
    const viewer = viewerOf(req)
    return schoolHandler(viewer, viewer.schoolId, queryString(req.query, 'tingkatan'), false)
  }),

  route(
    'GET',
    '/api/item-analysis/school/:schoolId',
    [requireAuth()],
    (req) =>
      schoolHandler(
        viewerOf(req),
        req.params.schoolId as number,
        queryString(req.query, 'tingkatan'),
        true,
      ),
    { params: { schoolId: int() } },
  ),

  route('GET', '/api/item-analysis/classes', [requireAuth()], (req) => {
    const viewer = viewerOf(req)
    let list = ownClasses(viewer)
    if (viewer.role === 'admin') {
      list = classrooms
        .list({ kind: 'classroom' })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.classId - b.classId)
    } else if (viewer.role !== 'teacher') return forbidden()
    // ownClasses lists active classes only; the S10 list shows every class with its `isActive` flag.
    if (viewer.role === 'teacher') {
      list = classrooms.forTeacher(viewer.id).filter((c) => c.kind === 'classroom')
    }
    const cards: ClassCard[] = list.map((c) =>
      classCard(c, subjectNameOf(c.subjectId), subjectColorOf(c.subjectId)),
    )
    return ok(cards)
  }),

  route(
    'GET',
    '/api/item-analysis/classes/:id',
    [requireAuth()],
    (req) => {
      const cls = classrooms.get('classroom', req.params.id as number)
      if (!cls || !mayOpenClass(viewerOf(req), cls)) return forbidden()
      return ok(classItemAnalysis(cls))
    },
    { params: { id: int() } },
  ),
]
