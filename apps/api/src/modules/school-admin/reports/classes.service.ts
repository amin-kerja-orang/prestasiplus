import { Inject, Injectable } from '@nestjs/common'
import { SCHOOL_ADMIN_PAGE_SIZE, type SchoolAdminClassListResponse, type SchoolAdminClassRow } from '@pp/contract'

import { listMeta } from '../../../common/http'
import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { Prisma } from '../../../db/generated/client'
import { ClassesRepository, slugOfGrade, type ClassRecord } from '../../classes'
import { gradeOfLevel } from '../../classes/classes.mapper'
import { compareIds } from '../../reports/analytics/domain/rules'
import { XS_PUPIL_SQL } from '../xs-queries'
import { pageOf } from './windows'

const nameOrder = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.name.localeCompare(b.name) || compareIds(a.id, b.id)

/** "Tingkatan n" or "Darjah n" (grades 1 to 6 are Darjah, 7 to 11 are Tingkatan 1 to 5). */
const levelLabelOf = (grade: number): string => (grade <= 6 ? `Darjah ${grade}` : `Tingkatan ${grade - 6}`)

/**
 * S8 class list (R1-AS-53): the ACTIVE classroom-kind classes of the school (FR-AS-53-1: "Kelas Aktif" = the rows listed), name A to Z,
 * 25 per page. Classes are read through BE-17's `ClassesRepository`, always for the session school. `members` (FR-AS-53-2) is XS-1
 * for that class: the school's pupils (active, not suspended, Tingkatan 1-5) with an active, non-test enrolment in it, counted with
 * `XS_PUPIL_SQL`. No join code is returned (FR-AS-53-5).
 */
@Injectable()
export class ClassesService {
  constructor(
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** XS-1 pupils of the school per class (only classes with at least one are in the map). */
  private async xsMembers(schoolId: string, classIds: readonly string[]): Promise<Map<string, number>> {
    const ids = classIds.filter(isIdString).map(idFromString)
    if (ids.length === 0 || !isIdString(schoolId)) return new Map()
    const rows = await this.prisma.client.$queryRaw<{ classroom_id: bigint; n: number }[]>(Prisma.sql`
      SELECT e.classroom_id, count(DISTINCT e.student_id)::int AS n
        FROM enrolments e JOIN users u ON u.id = e.student_id
       WHERE e.classroom_id = ANY(${ids}::bigint[]) AND e.status = 'active' AND e.is_test = false
         AND u.school_id = ${idFromString(schoolId)} AND ${XS_PUPIL_SQL('u')}
       GROUP BY e.classroom_id`)
    return new Map(rows.map((r) => [String(r.classroom_id), r.n]))
  }

  async list(schoolId: string, query: { level?: string | undefined; search?: string | undefined; page?: string | undefined }): Promise<SchoolAdminClassListResponse> {
    // The explicit school filter is repeated here on purpose: the repository call is by school, and this guards a wrong implementation.
    const all = (await this.classes.schoolClasses(schoolId)).filter((c) => c.kind === 'classroom' && c.isActive && c.schoolId === schoolId)
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
      this.xsMembers(schoolId, slice.map((c) => c.id)),
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
        isActive: c.isActive,
        link: `/prestasi/kelas/${c.id}`,
      }
    })

    return {
      data,
      meta: { ...listMeta(page, SCHOOL_ADMIN_PAGE_SIZE, matched.length), displayed: matched.length },
      tiles: { activeClasses: all.length },
      levels,
    }
  }
}
