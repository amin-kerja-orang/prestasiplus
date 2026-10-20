import { Inject, Injectable } from '@nestjs/common'

import { CurriculumRepository } from '../../../curriculum/curriculum.repository'
import { SchoolsRepository, type SchoolRow } from '../../../schools'
import { UsersRepository } from '../../../users'
import type { DirectoryPort, PupilRef, SchoolRef } from '../ports'

/** Ids per batched user read. */
export const USER_CHUNK = 1000
const PAGE = 500
const TEACHER_LIMIT = 5000

const toSchoolRef = (s: SchoolRow): SchoolRef => ({
  id: s.id,
  name: s.name,
  code: s.code === '' ? null : s.code,
  type: s.type ?? '',
  district: s.district,
  state: s.state ?? '',
})

/**
 * Real `DirectoryPort` on BE-05 (`UsersRepository`, `SchoolsRepository`, ADR-0014: no direct user
 * queries) and BE-08 (`CurriculumRepository.levelForGrade`, for the pupil's tingkatan).
 */
@Injectable()
export class UsersDirectoryAdapter implements DirectoryPort {
  constructor(
    @Inject(UsersRepository) private readonly userRepo: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  /** Overridden by tests; production uses USER_CHUNK. */
  chunk = USER_CHUNK

  /** One batched user read; one level lookup per distinct grade. */
  async users(ids: readonly string[]): Promise<Map<string, PupilRef>> {
    const out = new Map<string, PupilRef>()
    const unique = [...new Set(ids)]
    const records = []
    for (let i = 0; i < unique.length; i += this.chunk) records.push(...(await this.userRepo.getMany(unique.slice(i, i + this.chunk))))
    const levels = new Map<number, { id: string; slug: string } | null>()
    for (const u of records) {
      let level: { id: string; slug: string } | null = null
      if (u.grade !== null) {
        if (!levels.has(u.grade)) {
          const l = await this.curriculum.levelForGrade(u.grade)
          levels.set(u.grade, l ? { id: l.id.toString(), slug: l.code.toLowerCase() } : null)
        }
        level = levels.get(u.grade) ?? null
      }
      out.set(u.id, {
        id: u.id,
        name: u.name,
        grade: u.grade,
        levelSlug: level?.slug ?? null,
        levelId: level?.id ?? null,
        schoolId: u.schoolId,
        isActive: u.isActive,
        isStudent: u.roles.includes('student'),
      })
    }
    return out
  }

  async school(id: string): Promise<SchoolRef | null> {
    const s = await this.schools.get(id)
    return s ? toSchoolRef(s) : null
  }

  /**
   * Schools of a state, or of a district inside a state. Fail closed: a district without its state
   * matches nothing, and a scope with neither matches nothing. Names are compared exactly. An empty
   * scope (`{}`) is the platform and returns every school (admin only; callers decide).
   */
  async schoolsInScope(scope: { state?: string; district?: string }): Promise<SchoolRef[]> {
    if (scope.district !== undefined && scope.state === undefined) return []
    const out: SchoolRef[] = []
    for (let page = 1; ; page++) {
      const { rows, total } = await this.schools.list({
        ...(scope.state !== undefined ? { state: scope.state } : {}),
        page,
        pageSize: PAGE,
      })
      out.push(...rows.filter((r) => scope.district === undefined || r.district === scope.district).map(toSchoolRef))
      if (rows.length === 0 || page * PAGE >= total) break
    }
    return out
  }

  async teachersOfSchool(schoolId: string): Promise<{ id: string; name: string }[]> {
    const rows = await this.userRepo.search({ q: '', role: 'teacher', schoolId, limit: TEACHER_LIMIT })
    return rows.map((r) => ({ id: r.id, name: r.name }))
  }

  async pupilIdsOfSchool(schoolId: string): Promise<string[]> {
    const rows = await this.userRepo.studentsOfSchool(schoolId, '', '')
    return rows.map((r) => r.id)
  }

  async countPupils(schoolIds: readonly string[]): Promise<Map<string, number>> {
    const counts = await this.schools.memberCounts(schoolIds)
    return new Map([...counts].map(([id, c]) => [id, c.studentCount]))
  }

  async countTeachers(schoolIds: readonly string[]): Promise<Map<string, number>> {
    const counts = await this.schools.memberCounts(schoolIds)
    return new Map([...counts].map(([id, c]) => [id, c.teacherCount]))
  }
}
