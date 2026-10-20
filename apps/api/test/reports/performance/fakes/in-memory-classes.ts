import type { ClassInfo, ClassesReadPort } from '../../../../src/modules/reports/performance/ports'

/** In-memory `ClassesReadPort`. `studentCount` is recomputed from the roster. */
export class InMemoryClasses implements ClassesReadPort {
  private readonly classes: ClassInfo[] = []
  private readonly rosters = new Map<string, string[]>()

  add(info: Partial<ClassInfo> & Pick<ClassInfo, 'id' | 'schoolId'>, members: readonly string[] = []): this {
    this.classes.push({
      kind: 'classroom',
      name: `Kelas ${info.id}`,
      teacherId: null,
      teacherName: null,
      subjectId: null,
      subjectName: null,
      color: null,
      levelSlug: 't4',
      year: 2026,
      joinCode: `JC${info.id}`,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00+08:00'),
      studentCount: members.length,
      ...info,
    })
    this.rosters.set(info.id, [...members])
    return this
  }

  private fresh(c: ClassInfo): ClassInfo {
    return { ...c, studentCount: (this.rosters.get(c.id) ?? []).length }
  }

  async classesForTeacher(teacherId: string, opts: { includeInactive?: boolean } = {}): Promise<ClassInfo[]> {
    return this.classes.filter((c) => c.teacherId === teacherId && (opts.includeInactive === true || c.isActive)).map((c) => this.fresh(c))
  }
  async classesOfSchool(schoolId: string): Promise<ClassInfo[]> {
    return this.classes.filter((c) => c.schoolId === schoolId).map((c) => this.fresh(c))
  }
  async allClasses(): Promise<ClassInfo[]> {
    return this.classes.map((c) => this.fresh(c))
  }
  async classById(id: string): Promise<ClassInfo | null> {
    const c = this.classes.find((x) => x.id === id)
    return c ? this.fresh(c) : null
  }
  async memberIds(classId: string): Promise<string[]> {
    return [...(this.rosters.get(classId) ?? [])]
  }
  async classIdsOfStudent(userId: string): Promise<string[]> {
    return this.classes.filter((c) => (this.rosters.get(c.id) ?? []).includes(userId)).map((c) => c.id)
  }
  async classIdsOfStudents(userIds: readonly string[]): Promise<Map<string, string[]>> {
    return new Map(await Promise.all(userIds.map(async (id) => [id, await this.classIdsOfStudent(id)] as const)))
  }
  async membersOf(classIds: readonly string[]): Promise<Map<string, string[]>> {
    return new Map(classIds.map((id) => [id, [...(this.rosters.get(id) ?? [])]]))
  }
  async classesByIds(ids: readonly string[]): Promise<ClassInfo[]> {
    return this.classes.filter((c) => ids.includes(c.id)).map((c) => this.fresh(c))
  }
  async isMemberOfTeacher(teacherId: string, pupilId: string): Promise<boolean> {
    return this.classes.some((c) => c.teacherId === teacherId && c.isActive && (this.rosters.get(c.id) ?? []).includes(pupilId))
  }
}
