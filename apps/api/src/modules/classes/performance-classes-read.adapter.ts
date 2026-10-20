import { Inject, Injectable } from '@nestjs/common'

import type { ClassInfo, ClassesReadPort } from '../reports/performance/ports'
import { UsersRepository } from '../users'
import { ClassesRepository, type ClassRecord } from './classes.repository'

/** Ids per batched read of users. */
const USER_CHUNK = 1000
/** The class colour has no column yet; the report applies its default. */
const NO_COLOR = null

/**
 * The real `ClassesReadPort` of BE-19 (Prestasi, Analitik, Analisa Item) over BE-17 classes. Read-only. Class rows,
 * rosters and counts come from `ClassesRepository`; owner names from `UsersRepository.getMany` (ADR-0014); subject
 * names and level codes through the repository's display lookups. Each method issues a fixed number of set-based
 * queries whatever the number of classes (no per-class query), chunked at 1000 ids.
 *
 * Mapping: `levelSlug` is the lower-cased M03 level code (`t4`, `t5`, ...), the same slug the directory port gives a pupil;
 * `studentCount` counts ACTIVE, real (not Mod Pelajar) enrolments; a class without a school has `schoolId` `''` and one
 * without a join code has `joinCode` `''` (the port types are not nullable); `color` is null.
 */
@Injectable()
export class PerformanceClassesReadAdapter implements ClassesReadPort {
  constructor(
    @Inject(ClassesRepository) private readonly repo: ClassesRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  async classesForTeacher(teacherId: string, opts: { includeInactive?: boolean } = {}): Promise<ClassInfo[]> {
    const rows = await this.repo.forTeacher(teacherId)
    return this.describe(opts.includeInactive === true ? rows : rows.filter((r) => r.isActive))
  }

  async classesOfSchool(schoolId: string): Promise<ClassInfo[]> {
    return this.describe(await this.repo.schoolClasses(schoolId))
  }

  async allClasses(): Promise<ClassInfo[]> {
    return this.describe(await this.repo.all())
  }

  async classById(id: string): Promise<ClassInfo | null> {
    const row = await this.repo.byId(id)
    return row ? ((await this.describe([row]))[0] ?? null) : null
  }

  async classesByIds(ids: readonly string[]): Promise<ClassInfo[]> {
    return this.describe(await this.repo.byIds(ids))
  }

  async memberIds(classId: string): Promise<string[]> {
    return this.repo.memberIds(classId)
  }

  async membersOf(classIds: readonly string[]): Promise<Map<string, string[]>> {
    return this.repo.memberIdsOf(classIds)
  }

  async classIdsOfStudent(userId: string): Promise<string[]> {
    return (await this.repo.classIdsOfStudents([userId])).get(userId) ?? []
  }

  async classIdsOfStudents(userIds: readonly string[]): Promise<Map<string, string[]>> {
    return this.repo.classIdsOfStudents(userIds)
  }

  async isMemberOfTeacher(teacherId: string, pupilId: string): Promise<boolean> {
    return this.repo.isMemberOfTeacher(teacherId, pupilId)
  }

  /** Four lookups for the whole set: counts, level codes, subject names and owner names. */
  private async describe(rows: readonly ClassRecord[]): Promise<ClassInfo[]> {
    if (rows.length === 0) return []
    const teacherIds = [...new Set(rows.flatMap((r) => (r.teacherId === null ? [] : [r.teacherId])))]
    const [counts, levels, subjects, teachers] = await Promise.all([
      this.repo.memberCounts(rows.map((r) => r.id)),
      this.repo.levelGrades([...new Set(rows.map((r) => r.educationLevelId))]),
      this.repo.subjectNames(rows.map((r) => r.subjectId)),
      this.teacherNames(teacherIds),
    ])
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      schoolId: r.schoolId ?? '',
      teacherId: r.teacherId,
      teacherName: r.teacherId === null ? null : (teachers.get(r.teacherId) ?? null),
      subjectId: r.subjectId,
      subjectName: r.subjectId === null ? null : (subjects.get(r.subjectId) ?? null),
      color: NO_COLOR,
      levelSlug: levels.get(r.educationLevelId)?.code.toLowerCase() ?? '',
      year: r.academicYear,
      joinCode: r.joinCode ?? '',
      isActive: r.isActive,
      createdAt: r.createdAt,
      studentCount: counts.get(r.id) ?? 0,
    }))
  }

  private async teacherNames(ids: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (let i = 0; i < ids.length; i += USER_CHUNK) {
      for (const u of await this.users.getMany(ids.slice(i, i + USER_CHUNK))) out.set(u.id, u.name)
    }
    return out
  }
}
