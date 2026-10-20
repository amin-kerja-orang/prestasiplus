import type { DirectoryPort, PupilRef, SchoolRef } from '../../../../src/modules/reports/performance/ports'

/** In-memory `DirectoryPort`. All names are fictitious. */
export class InMemoryDirectory implements DirectoryPort {
  private readonly pupils = new Map<string, PupilRef>()
  private readonly schoolRows = new Map<string, SchoolRef>()
  private readonly teachers = new Map<string, { id: string; name: string; schoolId: string }>()

  addSchool(s: Partial<SchoolRef> & Pick<SchoolRef, 'id'>): this {
    this.schoolRows.set(s.id, { name: `Sekolah ${s.id}`, code: null, type: 'SMK', district: 'Daerah A', state: 'Negeri A', ...s })
    return this
  }

  addPupil(p: Partial<PupilRef> & Pick<PupilRef, 'id'>): this {
    this.pupils.set(p.id, { name: `Murid ${p.id}`, grade: 10, levelSlug: 't4', levelId: '10', schoolId: null, isActive: true, isStudent: true, ...p })
    return this
  }

  addTeacher(id: string, name: string, schoolId: string): this {
    this.teachers.set(id, { id, name, schoolId })
    return this
  }

  get schoolList(): SchoolRef[] {
    return [...this.schoolRows.values()]
  }

  async users(ids: readonly string[]): Promise<Map<string, PupilRef>> {
    const out = new Map<string, PupilRef>()
    for (const id of ids) {
      const p = this.pupils.get(id)
      if (p) out.set(id, p)
    }
    return out
  }
  async school(id: string): Promise<SchoolRef | null> {
    return this.schoolRows.get(id) ?? null
  }
  async schoolsInScope(scope: { state?: string; district?: string }): Promise<SchoolRef[]> {
    if (scope.district !== undefined && scope.state === undefined) return []
    return this.schoolList.filter(
      (s) => (scope.state === undefined || s.state === scope.state) && (scope.district === undefined || s.district === scope.district),
    )
  }
  async teachersOfSchool(schoolId: string): Promise<{ id: string; name: string }[]> {
    return [...this.teachers.values()].filter((t) => t.schoolId === schoolId).map(({ id, name }) => ({ id, name }))
  }
  async pupilIdsOfSchool(schoolId: string): Promise<string[]> {
    return [...this.pupils.values()].filter((p) => p.schoolId === schoolId).map((p) => p.id)
  }
  async countPupils(schoolIds: readonly string[]): Promise<Map<string, number>> {
    return new Map(schoolIds.map((id) => [id, [...this.pupils.values()].filter((p) => p.schoolId === id).length]))
  }
  async countTeachers(schoolIds: readonly string[]): Promise<Map<string, number>> {
    return new Map(schoolIds.map((id) => [id, [...this.teachers.values()].filter((t) => t.schoolId === id).length]))
  }
}
