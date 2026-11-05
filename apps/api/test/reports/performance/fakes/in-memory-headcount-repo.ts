import type { HeadcountConfigRecord, HeadcountEntryRecord, HeadcountRepository } from '../../../../src/modules/reports/performance/headcount/headcount.repository'
import { blankSlots, resolveMarks } from '../../../../src/modules/reports/performance/headcount/headcount.rules'

interface StoredEntry {
  configId: string
  studentId: string
  tov: number | null
  etr: number | null
  rs: number | null
  rsRecordedAt: Date | null
  dropped: boolean
  /** checkpoint -> AR (stored). */
  actuals: Map<number, number>
  /** A stored OTR target a reader must never use (the legacy column). */
  legacyTargets: Map<number, number>
}

/**
 * In-memory stand-in of `HeadcountRepository` for the service unit specs: the same resolution (`resolveMarks`) and the same
 * write semantics as the SQL repository, no database. Cast with `asRepo()`.
 */
export class InMemoryHeadcountRepo {
  readonly configs: HeadcountConfigRecord[] = []
  readonly entries: StoredEntry[] = []
  /** config id -> school id (the class's school). */
  readonly schools = new Map<string, string>()
  private seq = 100

  addConfig(over: Partial<HeadcountConfigRecord> & Pick<HeadcountConfigRecord, 'teacherId' | 'classroomId'>, schoolId = 's1'): HeadcountConfigRecord {
    const c: HeadcountConfigRecord = {
      id: String(++this.seq),
      subjectId: '1',
      educationLevelId: '10',
      academicYear: 2026,
      activeOtrs: 3,
      mode: 'manual',
      defaultTov: null,
      defaultEtr: null,
      createdAt: new Date('2026-01-01T00:00:00+08:00'),
      updatedAt: new Date('2026-01-01T00:00:00+08:00'),
      ...over,
    }
    this.configs.push(c)
    this.schools.set(c.id, schoolId)
    return c
  }

  addEntry(configId: string, studentId: string, over: Partial<Omit<StoredEntry, 'configId' | 'studentId'>> = {}): StoredEntry {
    const e: StoredEntry = { configId, studentId, tov: null, etr: null, rs: null, rsRecordedAt: null, dropped: false, actuals: new Map(), legacyTargets: new Map(), ...over }
    this.entries.push(e)
    return e
  }

  entry(configId: string, studentId: string): StoredEntry | undefined {
    return this.entries.find((e) => e.configId === configId && e.studentId === studentId)
  }

  asRepo(): HeadcountRepository {
    return this as unknown as HeadcountRepository
  }

  // --- the methods the service uses -----------------------------------------------------
  async configById(id: string) {
    // A snapshot, as the SQL repository returns.
    const c = this.configs.find((x) => x.id === id)
    return c ? { ...c } : null
  }
  async configsOfTeacher(teacherId: string) {
    return this.configs.filter((c) => c.teacherId === teacherId).map((c) => ({ ...c }))
  }
  async configsOfSchool(schoolId: string) {
    return this.configs.filter((c) => this.schools.get(c.id) === schoolId).map((c) => ({ ...c }))
  }
  async allConfigs() {
    return this.configs.map((c) => ({ ...c }))
  }
  async configsByIds(ids: readonly string[]) {
    return this.configs.filter((c) => ids.includes(c.id)).map((c) => ({ ...c }))
  }
  async configsOfClassrooms(ids: readonly string[]) {
    return this.configs.filter((c) => ids.includes(c.classroomId)).map((c) => ({ ...c }))
  }
  async schoolOfConfigs(configs: readonly HeadcountConfigRecord[]) {
    return new Map(configs.flatMap((c) => (this.schools.has(c.id) ? [[c.id, this.schools.get(c.id) as string] as const] : [])))
  }
  async subjectNames(ids: readonly string[]) {
    return new Map(ids.map((i) => [i, `Subjek ${i}`]))
  }
  async levelNames(ids: readonly string[]) {
    return new Map(ids.map((i) => [i, `Tingkatan ${i}`]))
  }
  async entriesOf(configs: readonly HeadcountConfigRecord[]): Promise<HeadcountEntryRecord[]> {
    return this.entries
      .filter((e) => configs.some((c) => c.id === e.configId))
      .map((e) => {
        const c = configs.find((x) => x.id === e.configId) as HeadcountConfigRecord
        const actuals = blankSlots(c.activeOtrs)
        for (const [k, v] of e.actuals) if (k >= 1 && k <= c.activeOtrs) actuals[k - 1] = v
        return {
          configId: e.configId,
          studentId: e.studentId,
          marks: resolveMarks({ tov: e.tov, etr: e.etr, rs: e.rs, actuals }, c),
          rsRecordedAt: e.rsRecordedAt,
          dropped: e.dropped,
          own: { tov: e.tov, etr: e.etr },
        }
      })
  }
  async entriesOfStudent(studentId: string, configs: readonly HeadcountConfigRecord[]) {
    return (await this.entriesOf(configs)).filter((e) => e.studentId === studentId)
  }
  async configIdsOfStudent(studentId: string) {
    return this.entries.filter((e) => e.studentId === studentId).map((e) => e.configId)
  }
  async setDropped(configId: string, studentIds: readonly string[], dropped: boolean) {
    let n = 0
    for (const s of studentIds) {
      const e = this.entry(configId, s) ?? (dropped ? this.addEntry(configId, s) : undefined)
      if (e && e.dropped !== dropped) {
        e.dropped = dropped
        n++
      }
    }
    return n
  }
  async resetMarks(configId: string) {
    const list = this.entries.filter((e) => e.configId === configId)
    for (const e of list) Object.assign(e, { tov: null, etr: null, rs: null, rsRecordedAt: null, actuals: new Map() })
    return list.length
  }
  async deleteConfig(id: string) {
    const i = this.configs.findIndex((c) => c.id === id)
    if (i >= 0) this.configs.splice(i, 1)
    return i >= 0
  }
  async saveActuals(configId: string, checkpoint: number, marks: readonly { studentId: string; value: number | null }[]) {
    for (const m of marks) {
      const e = this.entry(configId, m.studentId) ?? this.addEntry(configId, m.studentId)
      if (m.value === null) e.actuals.delete(checkpoint)
      else e.actuals.set(checkpoint, m.value)
    }
    return marks.length
  }
  async saveEntryValues(configId: string, rows: readonly { studentId: string; tov?: number | null; etr?: number | null; rs?: number | null; rsRecordedAt?: Date | null }[]) {
    for (const r of rows) {
      const e = this.entry(configId, r.studentId) ?? this.addEntry(configId, r.studentId)
      if (r.tov !== undefined) e.tov = r.tov
      if (r.etr !== undefined) e.etr = r.etr
      if (r.rs !== undefined) e.rs = r.rs
      if (r.rsRecordedAt !== undefined) e.rsRecordedAt = r.rsRecordedAt
    }
  }
  async rsOf(configId: string, studentIds: readonly string[]) {
    return new Map(studentIds.flatMap((s) => {
      const e = this.entry(configId, s)
      return e ? [[s, { rs: e.rs, rsRecordedAt: e.rsRecordedAt }] as const] : []
    }))
  }
  async firstCheckpointAbove(configId: string, n: number) {
    const ks = this.entries.filter((e) => e.configId === configId).flatMap((e) => [...e.actuals.keys()]).filter((k) => k > n)
    return ks.length === 0 ? null : Math.min(...ks)
  }
  async setActiveOtrs(configId: string, n: number) {
    let deleted = 0
    for (const e of this.entries.filter((x) => x.configId === configId)) {
      for (const k of [...e.actuals.keys()]) if (k > n) {
        e.actuals.delete(k)
        deleted++
      }
    }
    const c = this.configs.find((x) => x.id === configId)
    if (c) c.activeOtrs = n
    return deleted
  }
  async setDefaults(configId: string, d: { defaultTov: number | null; defaultEtr: number | null }) {
    const c = this.configs.find((x) => x.id === configId)
    if (c) Object.assign(c, d)
  }
}
