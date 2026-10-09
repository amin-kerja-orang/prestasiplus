/**
 * Q-M27-CLASSES (SRS §18.3; BR-M27-35; FR-M27-111 to 116), screen S8.
 *
 * Rows are the M10 `classroom` classes of the school (`school_class` rows carry no school today, DV-M27-20),
 * active or not; "Kelas Aktif" is the active count of the same call S0 uses (BR-M27-37).
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
    members: classrooms.memberCount('classroom', c.classId),
    joinCode: c.joinCode === '' ? null : c.joinCode,
    isActive: c.isActive,
    link: `/prestasi/kelas/${String(c.classId)}`,
  }
}

export function listSchoolClasses(
  viewer: SchoolViewer,
  query: { level?: string | undefined; search?: string | undefined; page?: string | undefined },
): SchoolClassList {
  const all = classrooms.list({ schoolId: viewer.schoolId, kind: 'classroom' })

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
      activeClasses: classrooms.list({
        isActive: true,
        schoolId: viewer.schoolId,
        kind: 'classroom',
      }).length,
    },
    levels,
  }
}
