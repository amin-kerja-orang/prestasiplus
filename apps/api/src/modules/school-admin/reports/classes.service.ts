import { Inject, Injectable } from '@nestjs/common'
import { SCHOOL_ADMIN_PAGE_SIZE, type AdminClass, type AdminClassListQuery, type AdminClassListResponse, type SchoolAdminClassListResponse, type SchoolAdminClassRow } from '@pp/contract'

import { listMeta } from '../../../common/http'
import { ClassesRepository, slugOfGrade, type ClassRecord } from '../../classes'
import { gradeOfLevel } from '../../classes/classes.mapper'
import { compareIds } from '../../reports/analytics/domain/rules'
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
    const set = await classSetOf(this.classes, all)
    const level = query.level !== undefined && set.levels.some((l) => l.code === query.level) ? query.level : null
    const { matched, page, items } = await classPageOf(this.classes, set, {
      level,
      search: query.search,
      pageOfTotal: (totalPages) => pageOf(query.page, totalPages),
      pageSize: SCHOOL_ADMIN_PAGE_SIZE,
    })

    const data: SchoolAdminClassRow[] = items.map(({ record: c, levelLabel, subject, teacher, members }) => ({
      key: `classroom:${c.id}`,
      kind: 'classroom',
      id: c.id,
      name: c.name,
      subject,
      levelLabel,
      teacherName: teacher === null ? null : teacher.name,
      members,
      joinCode: c.joinCode === null || c.joinCode.trim() === '' ? null : c.joinCode,
      isActive: c.isActive,
      link: `/prestasi/kelas/${c.id}`,
    }))

    return {
      data,
      meta: { ...listMeta(page, SCHOOL_ADMIN_PAGE_SIZE, matched), displayed: matched },
      tiles: { activeClasses: all.filter((c) => c.isActive).length },
      levels: set.levels,
    }
  }
}

/**
 * API-ADM-05: the class list of Admin Pusat across all schools (S6-T11). The same list core as the school list; the school and teacher
 * filters narrow the repository read, the level filter is the slug of the contract query (already validated), 20 per page by default.
 * `pupils` is the repository's active member count; the XS-1 query of S6-T03 is not merged yet (replace it there when it is).
 */
@Injectable()
export class AdminClassesService {
  constructor(@Inject(ClassesRepository) private readonly classes: ClassesRepository) {}

  async list(query: AdminClassListQuery): Promise<AdminClassListResponse> {
    const all = await this.classes.classroomsOf({ schoolId: query.schoolId, teacherId: query.teacherId })
    const set = await classSetOf(this.classes, all)
    const { matched, page, items } = await classPageOf(this.classes, set, {
      level: query.level ?? null,
      search: query.search,
      pageOfTotal: (totalPages) => Math.min(query.page, totalPages),
      pageSize: query.pageSize,
    })
    const schools = await this.classes.schoolNames(items.map((i) => i.record.schoolId))
    const data: AdminClass[] = items.map(({ record: c, levelLabel, teacher, members }) => ({
      id: c.id,
      name: c.name,
      level: levelLabel,
      teacher: teacher === null ? null : { id: teacher.id, name: teacher.name ?? '' },
      school: c.schoolId === null ? null : { id: c.schoolId, name: schools.get(c.schoolId) ?? '' },
      pupils: members,
      joinCode: c.joinCode === null || c.joinCode.trim() === '' ? null : c.joinCode,
      isActive: c.isActive,
    }))
    return { data, meta: listMeta(page, query.pageSize, matched) }
  }
}
