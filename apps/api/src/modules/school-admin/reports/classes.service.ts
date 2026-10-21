import { Inject, Injectable } from '@nestjs/common'
import { SCHOOL_ADMIN_PAGE_SIZE, type SchoolAdminClassListResponse, type SchoolAdminClassRow } from '@pp/contract'

import { listMeta } from '../../../common/http'
import { ClassesRepository, slugOfGrade, type ClassRecord } from '../../classes'
import { gradeOfLevel } from '../../classes/classes.mapper'
import { compareIds } from '../../reports/analytics/domain/rules'
import { pageOf } from './windows'

const nameOrder = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.name.localeCompare(b.name) || compareIds(a.id, b.id)

/** "Tingkatan n" or "Darjah n" (grades 1 to 6 are Darjah, 7 to 11 are Tingkatan 1 to 5). */
const levelLabelOf = (grade: number): string => (grade <= 6 ? `Darjah ${grade}` : `Tingkatan ${grade - 6}`)

/**
 * S8 class list (mock `classes`): the classroom-kind classes of the school, active and inactive, name A to Z, 25 per page.
 * Read through BE-17's `ClassesRepository` only, always for the session school. `members` is the repository's active enrolment
 * count (it may include pupils of another school, as the contract says). Join codes are shown to the school admin of the same school.
 */
@Injectable()
export class ClassesService {
  constructor(@Inject(ClassesRepository) private readonly classes: ClassesRepository) {}

  async list(schoolId: string, query: { level?: string | undefined; search?: string | undefined; page?: string | undefined }): Promise<SchoolAdminClassListResponse> {
    // The explicit school filter is repeated here on purpose: the repository call is by school, and this guards a wrong implementation.
    const all = (await this.classes.schoolClasses(schoolId)).filter((c) => c.kind === 'classroom' && c.schoolId === schoolId)
    const levelsById = await this.classes.levelGrades([...new Set(all.map((c) => c.educationLevelId))])
    const gradeOf = (c: ClassRecord): number | null => gradeOfLevel(levelsById.get(c.educationLevelId))

    // Levels present in the school classes, Darjah before Tingkatan (grade order).
    const present = new Map<number, { code: string; label: string }>()
    for (const c of all) {
      const grade = gradeOf(c)
      const slug = slugOfGrade(grade)
      if (grade !== null && slug !== null) present.set(grade, { code: slug, label: levelLabelOf(grade) })
    }
    const levels = [...present.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)

    const level = query.level !== undefined && levels.some((l) => l.code === query.level) ? query.level : null
    const term = (query.search ?? '').trim().toLowerCase()
    const matched = all
      .filter((c) => level === null || slugOfGrade(gradeOf(c)) === level)
      .filter((c) => term === '' || c.name.toLowerCase().includes(term))
      .sort(nameOrder)

    const totalPages = Math.max(1, Math.ceil(matched.length / SCHOOL_ADMIN_PAGE_SIZE))
    const page = pageOf(query.page, totalPages)
    const slice = matched.slice((page - 1) * SCHOOL_ADMIN_PAGE_SIZE, page * SCHOOL_ADMIN_PAGE_SIZE)

    const [counts, subjects, teachers] = await Promise.all([
      this.classes.memberCounts(slice.map((c) => c.id)),
      this.classes.subjectNames(slice.map((c) => c.subjectId)),
      this.classes.userNames(slice.map((c) => c.teacherId)),
    ])
    const data: SchoolAdminClassRow[] = slice.map((c) => {
      const grade = gradeOf(c)
      return {
        key: `classroom:${c.id}`,
        kind: 'classroom',
        id: c.id,
        name: c.name,
        subject: c.subjectId === null ? null : { id: c.subjectId, name: subjects.get(c.subjectId) ?? '' },
        levelLabel: grade === null ? (levelsById.get(c.educationLevelId)?.code ?? '') : levelLabelOf(grade),
        teacherName: c.teacherId === null ? null : (teachers.get(c.teacherId) ?? null),
        members: counts.get(c.id) ?? 0,
        joinCode: c.joinCode === null || c.joinCode.trim() === '' ? null : c.joinCode,
        isActive: c.isActive,
        link: `/prestasi/kelas/${c.id}`,
      }
    })

    return {
      data,
      meta: { ...listMeta(page, SCHOOL_ADMIN_PAGE_SIZE, matched.length), displayed: matched.length },
      tiles: { activeClasses: all.filter((c) => c.isActive).length },
      levels,
    }
  }
}
