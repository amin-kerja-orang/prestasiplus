/**
 * Q-M27-CLASSES (SRS §18.3; BR-M27-35; FR-M27-111 to 116), screen S8.
 *
 * Rows are the M10 `classroom` classes of the school (`school_class` rows carry no school today, DV-M27-20),
 * that are active (R1-AS-53); "Kelas Aktif" is the same count. No join code (FR-AS-53-5).
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import type { SchoolClassList, SchoolClassRow } from '../../api/school-admin'
import { pageOf } from './users-list'
import type { SchoolViewer } from './school-scope'

/** "tingkatan-4" gives "Tingkatan 4", "tahun-3" gives "Darjah 3". */
export function levelLabelOf(slug: string): string {
  const m = /^(tingkatan|tahun)-(\d+)$/.exec(slug)
  if (!m) return slug
  return `${m[1] === 'tingkatan' ? 'Tingkatan' : 'Darjah'} ${m[2] as string}`
}

/** Sort key of a level slug: Darjah first, then Tingkatan, by number (the owner's `levelId`). */
const levelOrder = (c: ClassroomRow) => c.levelId

const byName = (a: ClassroomRow, b: ClassroomRow): number =>
  a.name.localeCompare(b.name, 'ms-MY', { sensitivity: 'base' }) || a.classId - b.classId

/** FR-AS-53-2: XS-1 pupils (active, Tingkatan 1-5) of the viewer's school with an active enrolment in the class. */
function xsMembers(c: ClassroomRow): number {
  return classrooms.memberIds('classroom', c.classId).filter((id) => {
    const u = users.get(id)
    return (
      u !== undefined &&
      u.schoolId === c.schoolId &&
      u.isActive &&
      u.grade !== null &&
      u.grade >= 7 &&
      u.grade <= 11
    )
  }).length
}

function rowOf(c: ClassroomRow): SchoolClassRow {
  const subject = c.subjectId === null ? undefined : curriculum.subject(c.subjectId)
  return {
    key: `classroom:${String(c.classId)}`,
    kind: 'classroom',
    id: c.classId,
    name: c.name,
    subject: subject ? { id: subject.id, name: subject.name } : null,
    levelLabel: levelLabelOf(c.educationLevel),
    teacherName: c.teacherId === null ? null : (users.get(c.teacherId)?.name ?? null),
    members: xsMembers(c),
    isActive: c.isActive,
    link: `/prestasi/kelas/${String(c.classId)}`,
  }
}

export function listSchoolClasses(
  viewer: SchoolViewer,
  query: { level?: string | undefined; search?: string | undefined; page?: string | undefined },
): SchoolClassList {
  // FR-AS-53-1: the active classes only ("Kelas Aktif" = the rows listed).
  const all = classrooms.list({ schoolId: viewer.schoolId, kind: 'classroom', isActive: true })

  // Level options = the levels present, in level order (BR-M27-35).
  const seen = new Map<string, number>()
  for (const c of all) seen.set(c.educationLevel, levelOrder(c))
  const levels = [...seen.entries()]
    .sort(([, a], [, b]) => a - b)
    .map(([code]) => ({ code, label: levelLabelOf(code) }))

  // FR-M27 §17: an unknown level means all.
  const level = levels.some((l) => l.code === query.level) ? query.level : undefined
  const term = query.search?.trim().toLocaleLowerCase('ms-MY') ?? ''
  const matching = all
    .filter((c) => level === undefined || c.educationLevel === level)
    .filter((c) => term === '' || c.name.toLocaleLowerCase('ms-MY').includes(term))
    .sort(byName)

  const slice = pageOf(matching, query.page)
  return {
    data: slice.rows.map(rowOf),
    meta: { ...slice.meta, displayed: matching.length },
    tiles: {
      activeClasses: all.length,
    },
    levels,
  }
}
