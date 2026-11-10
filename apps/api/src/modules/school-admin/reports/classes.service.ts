import { Inject, Injectable } from '@nestjs/common'
import { SCHOOL_ADMIN_PAGE_SIZE, type AdminClass, type AdminClassListQuery, type AdminClassListResponse, type SchoolAdminClassListResponse, type SchoolAdminClassRow } from '@pp/contract'

import { listMeta } from '../../../common/http'
import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { Prisma } from '../../../db/generated/client'
import { ClassesRepository, slugOfGrade, type ClassRecord } from '../../classes'
import { gradeOfLevel } from '../../classes/classes.mapper'
import { compareIds } from '../../reports/analytics/domain/rules'
import { XS_PUPIL_SQL, XsQueries } from '../xs-queries'
import { pageOf } from './windows'

const nameOrder = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.name.localeCompare(b.name) || compareIds(a.id, b.id)

/** "Tingkatan n" or "Darjah n" (grades 1 to 6 are Darjah, 7 to 11 are Tingkatan 1 to 5). */
const levelLabelOf = (grade: number): string => (grade <= 6 ? `Darjah ${grade}` : `Tingkatan ${grade - 6}`)

/** The classes of one read with their level facts: the first half of the list core shared by the school and the central class lists. */
interface ClassSet {
  all: ClassRecord[]
  levelsById: Awaited<ReturnType<ClassesRepository['levelGrades']>>
  gradeOf: (c: ClassRecord) => number | null
  /** Levels present in the classes, Darjah before Tingkatan (grade order). */
  levels: { code: string; label: string }[]
}

async function classSetOf(repo: ClassesRepository, all: ClassRecord[]): Promise<ClassSet> {
  const levelsById = await repo.levelGrades([...new Set(all.map((c) => c.educationLevelId))])
  const gradeOf = (c: ClassRecord): number | null => gradeOfLevel(levelsById.get(c.educationLevelId))
  const present = new Map<number, { code: string; label: string }>()
  for (const c of all) {
    const grade = gradeOf(c)
    const slug = slugOfGrade(grade)
    if (grade !== null && slug !== null) present.set(grade, { code: slug, label: levelLabelOf(grade) })
  }
  const levels = [...present.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  return { all, levelsById, gradeOf, levels }
}

/** One class of the page with the names and counts the two lists show. */
interface ClassPageItem {
  record: ClassRecord
  levelLabel: string
  subject: { id: string; name: string } | null
  teacher: { id: string; name: string | null } | null
  members: number
}

/**
 * The list core shared by `/admin-sekolah/kelas` and `/admin/classes`: level filter, name search, A to Z order, the page slice and the
 * names and member counts of that slice. `level` is already resolved (null = every level); `pageOfTotal` clamps the page.
 */
async function classPageOf(
  repo: ClassesRepository,
  set: ClassSet,
  query: { level: string | null; search: string | undefined; pageOfTotal: (totalPages: number) => number; pageSize: number },
): Promise<{ matched: number; page: number; items: ClassPageItem[] }> {
  const term = (query.search ?? '').trim().toLowerCase()
  const matched = set.all
    .filter((c) => query.level === null || slugOfGrade(set.gradeOf(c)) === query.level)
    .filter((c) => term === '' || c.name.toLowerCase().includes(term))
    .sort(nameOrder)

  const totalPages = Math.max(1, Math.ceil(matched.length / query.pageSize))
  const page = query.pageOfTotal(totalPages)
  const slice = matched.slice((page - 1) * query.pageSize, page * query.pageSize)

  const [counts, subjects, teachers] = await Promise.all([
    repo.memberCounts(slice.map((c) => c.id)),
    repo.subjectNames(slice.map((c) => c.subjectId)),
    repo.userNames(slice.map((c) => c.teacherId)),
  ])
  const items = slice.map((c): ClassPageItem => {
    const grade = set.gradeOf(c)
    return {
      record: c,
      levelLabel: grade === null ? (set.levelsById.get(c.educationLevelId)?.code ?? '') : levelLabelOf(grade),
      subject: c.subjectId === null ? null : { id: c.subjectId, name: subjects.get(c.subjectId) ?? '' },
      teacher: c.teacherId === null ? null : { id: c.teacherId, name: teachers.get(c.teacherId) ?? null },
      members: counts.get(c.id) ?? 0,
    }
  })
  return { matched: matched.length, page, items }
}

/**
 * S8 class list (R1-AS-53): the ACTIVE classes of the school, both kinds (classroom and school_class; FR-AS-53-1: "Kelas Aktif" = the rows
 * listed = the dashboard card), name A to Z, 25 per page. Classes are read through BE-17's `ClassesRepository`, always for the session
 * school. `members` (FR-AS-53-2) is XS-1 for that class: the school's pupils (active, not suspended, Tingkatan 1-5) with an active,
 * non-test enrolment in it, counted with `XS_PUPIL_SQL`. No join code is returned (FR-AS-53-5).
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
    const everyKind = (await this.classes.schoolClasses(schoolId)).filter((c) => c.schoolId === schoolId)
    // Rows = the Kelas Aktif tile (FR-AS-53-1): active classes of both kinds, inactive ones hidden.
    const all = everyKind.filter((c) => c.isActive)
    const set = await classSetOf(this.classes, all)
    const level = query.level !== undefined && set.levels.some((l) => l.code === query.level) ? query.level : null
    const { matched, page, items } = await classPageOf(this.classes, set, {
      level,
      search: query.search,
      pageOfTotal: (totalPages) => pageOf(query.page, totalPages),
      pageSize: SCHOOL_ADMIN_PAGE_SIZE,
    })

    // `members` is XS-1 for the class (FR-AS-53-2), not the repository's raw enrolment count.
    const xsCounts = await this.xsMembers(schoolId, items.map((i) => i.record.id))
    const data: SchoolAdminClassRow[] = items.map(({ record: c, levelLabel, subject, teacher }) => ({
      key: `${c.kind}:${c.id}`,
      kind: c.kind,
      id: c.id,
      name: c.name,
      subject,
      levelLabel,
      teacherName: teacher === null ? null : teacher.name,
      members: xsCounts.get(c.id) ?? 0,
      isActive: c.isActive,
      // Only a classroom has a class dashboard (canOpenClassDashboard); a school_class link would answer NOT_FOUND.
      link: c.kind === 'classroom' ? `/prestasi/kelas/${c.id}` : null,
    }))

    return {
      data,
      meta: { ...listMeta(page, SCHOOL_ADMIN_PAGE_SIZE, matched), displayed: matched },
      // Same count as the dashboard "Kelas Aktif" card (AC-AS-2-1): active classes of BOTH kinds (classroom and school_class).
      tiles: { activeClasses: all.length },
      levels: set.levels,
    }
  }
}

/**
 * API-ADM-05: the class list of Admin Pusat across all schools (S6-T11). The same list core as the school list; the school and teacher
 * filters narrow the repository read, the level filter is the slug of the contract query (already validated), 20 per page by default.
 * `pupils` is the XS-1 count of the class (`XsQueries.pupilCountsByClass`, S6-T03): active pupil accounts of Tingkatan 1-5 with an active enrolment.
 */
@Injectable()
export class AdminClassesService {
  constructor(
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(XsQueries) private readonly xs: XsQueries,
  ) {}

  async list(query: AdminClassListQuery): Promise<AdminClassListResponse> {
    const all = await this.classes.classroomsOf({ schoolId: query.schoolId, teacherId: query.teacherId })
    const set = await classSetOf(this.classes, all)
    const { matched, page, items } = await classPageOf(this.classes, set, {
      level: query.level ?? null,
      search: query.search,
      pageOfTotal: (totalPages) => Math.min(query.page, totalPages),
      pageSize: query.pageSize,
    })
    const [schools, pupils] = await Promise.all([
      this.classes.schoolNames(items.map((i) => i.record.schoolId)),
      this.xs.pupilCountsByClass(items.map((i) => i.record.id)),
    ])
    const data: AdminClass[] = items.map(({ record: c, levelLabel, teacher }) => ({
      id: c.id,
      name: c.name,
      level: levelLabel,
      teacher: teacher === null ? null : { id: teacher.id, name: teacher.name ?? '' },
      school: c.schoolId === null ? null : { id: c.schoolId, name: schools.get(c.schoolId) ?? '' },
      pupils: pupils.get(c.id) ?? 0,
      joinCode: c.joinCode === null || c.joinCode.trim() === '' ? null : c.joinCode,
      isActive: c.isActive,
    }))
    return { data, meta: listMeta(page, query.pageSize, matched) }
  }
}
