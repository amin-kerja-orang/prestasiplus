import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString, isIdString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import type { HeadcountMode } from '../domain/headcount'
import { blankSlots, toNum, type HeadcountMarks } from './headcount.rules'

/** A config as the service sees it: decimal-string ids. */
export interface HeadcountConfigRecord {
  id: string
  teacherId: string
  classroomId: string
  subjectId: string
  educationLevelId: string
  academicYear: number
  activeOtrs: number
  mode: HeadcountMode
  createdAt: Date
  updatedAt: Date
}

/** An entry with its marks sized to the config's `activeOtrs` (blank slots for missing checkpoints). */
export interface HeadcountEntryRecord {
  configId: string
  studentId: string
  marks: HeadcountMarks
  rsRecordedAt: Date | null
  dropped: boolean
}

export interface NewHeadcountConfig {
  teacherId: string
  classroomId: string
  subjectId: string
  educationLevelId: string
  academicYear: number
  activeOtrs: number
  mode: HeadcountMode
  now: Date
}

export interface SubjectOption {
  id: string
  name: string
  code: string
}

export interface LevelOption {
  id: string
  code: string
  name: string
}

/** The two levels a headcount can be set for (BR-M08-22). */
export const HEADCOUNT_LEVEL_CODES = ['T4', 'T5'] as const

/** A decimal-string id as bigint, or null when it is not a canonical id (an unknown id, never an error). */
const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)
const idsOf = (ids: readonly string[]): bigint[] => [...new Set(ids)].flatMap((i) => (isIdString(i) ? [idFromString(i)] : []))

const toConfig = (r: {
  id: bigint
  teacherId: bigint
  classroomId: bigint
  subjectId: bigint
  educationLevelId: bigint
  academicYear: number
  activeOtrs: number
  mode: string
  createdAt: Date
  updatedAt: Date
}): HeadcountConfigRecord => ({
  id: idToString(r.id),
  teacherId: idToString(r.teacherId),
  classroomId: idToString(r.classroomId),
  subjectId: idToString(r.subjectId),
  educationLevelId: idToString(r.educationLevelId),
  academicYear: r.academicYear,
  activeOtrs: r.activeOtrs,
  mode: r.mode as HeadcountMode,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
})

/** Newest first, ties by id descending (S12 order). */
const NEWEST_FIRST = [{ updatedAt: 'desc' as const }, { id: 'desc' as const }]

/** Ids per `IN (...)` list of the batch reads. */
const READ_CHUNK = 1000

/**
 * Owner of `headcount_configs`, `headcount_entries` and `headcount_entry_marks` (BE-19). Every method uses
 * `prisma.client`, so it joins the transaction a service opened with `prisma.transaction(...)`. Parameterised only.
 * The lookups at the end read `subjects` and `education_levels` for names (read-only).
 */
@Injectable()
export class HeadcountRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- configs -----------------------------------------------------------------------------

  async configById(id: string): Promise<HeadcountConfigRecord | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.headcountConfig.findUnique({ where: { id: key } })
    return row ? toConfig(row) : null
  }

  async configsOfTeacher(teacherId: string): Promise<HeadcountConfigRecord[]> {
    const key = idOf(teacherId)
    if (key === null) return []
    const rows = await this.db.headcountConfig.findMany({ where: { teacherId: key }, orderBy: NEWEST_FIRST })
    return rows.map(toConfig)
  }

  async configsByIds(ids: readonly string[]): Promise<HeadcountConfigRecord[]> {
    const keys = idsOf(ids)
    const out: HeadcountConfigRecord[] = []
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const rows = await this.db.headcountConfig.findMany({ where: { id: { in: keys.slice(i, i + READ_CHUNK) } } })
      out.push(...rows.map(toConfig))
    }
    return out
  }

  async configsOfClassrooms(classroomIds: readonly string[]): Promise<HeadcountConfigRecord[]> {
    const keys = idsOf(classroomIds)
    const out: HeadcountConfigRecord[] = []
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const rows = await this.db.headcountConfig.findMany({ where: { classroomId: { in: keys.slice(i, i + READ_CHUNK) } } })
      out.push(...rows.map(toConfig))
    }
    return out
  }

  async allConfigs(): Promise<HeadcountConfigRecord[]> {
    return (await this.db.headcountConfig.findMany({ orderBy: NEWEST_FIRST })).map(toConfig)
  }

  /**
   * Configs of a school: the class's school, else the teacher's school when the class has none (the same rule as the
   * detail routes). One set-based statement.
   */
  async configsOfSchool(schoolId: string): Promise<HeadcountConfigRecord[]> {
    const key = idOf(schoolId)
    if (key === null) return []
    const ids = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT c.id
      FROM headcount_configs c
      JOIN classrooms k ON k.id = c.classroom_id
      JOIN users t ON t.id = c.teacher_id
      WHERE COALESCE(k.school_id, t.school_id) = ${key}::bigint
      ORDER BY c.updated_at DESC, c.id DESC`
    return this.configsByIds(ids.map((r) => idToString(r.id)))
  }

  /** The config of the same class, subject, year and mode (BR-M08-22 uniqueness). */
  async duplicateOf(input: { classroomId: string; subjectId: string; academicYear: number; mode: HeadcountMode }): Promise<boolean> {
    const c = idOf(input.classroomId)
    const s = idOf(input.subjectId)
    if (c === null || s === null) return false
    return (await this.db.headcountConfig.count({ where: { classroomId: c, subjectId: s, academicYear: input.academicYear, mode: input.mode } })) > 0
  }

  /**
   * Transaction-scoped advisory lock on (class, subject, year), any mode. Taken by the create and auto-setup paths before
   * their existence checks, so a manual create and an auto-setup of the same key run one after the other (a read check alone
   * lets both pass). Must be called inside `prisma.transaction`; callers lock several keys in sorted order (no deadlock).
   */
  async lockConfigKey(classroomId: string, subjectId: string, academicYear: number): Promise<void> {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`headcount-config:${classroomId}:${subjectId}:${String(academicYear)}`}, 0))`
  }

  /** Same class, subject and year in any mode (auto-setup, BR-M08-21). */
  async existsForClass(classroomId: string, subjectId: string, academicYear: number): Promise<boolean> {
    const c = idOf(classroomId)
    const s = idOf(subjectId)
    if (c === null || s === null) return false
    return (await this.db.headcountConfig.count({ where: { classroomId: c, subjectId: s, academicYear } })) > 0
  }

  /** Creates one config; a concurrent twin makes the unique index throw (P2002), which the service maps to 409. */
  async createConfig(input: NewHeadcountConfig): Promise<string> {
    const row = await this.db.headcountConfig.create({
      data: {
        teacherId: idFromString(input.teacherId),
        classroomId: idFromString(input.classroomId),
        subjectId: idFromString(input.subjectId),
        educationLevelId: idFromString(input.educationLevelId),
        academicYear: input.academicYear,
        activeOtrs: input.activeOtrs,
        mode: input.mode,
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: { id: true },
    })
    return idToString(row.id)
  }

  /** `INSERT ... ON CONFLICT DO NOTHING` of several configs; returns how many rows were really inserted. */
  async createConfigsIfAbsent(inputs: readonly NewHeadcountConfig[]): Promise<number> {
    if (inputs.length === 0) return 0
    const res = await this.db.headcountConfig.createMany({
      data: inputs.map((input) => ({
        teacherId: idFromString(input.teacherId),
        classroomId: idFromString(input.classroomId),
        subjectId: idFromString(input.subjectId),
        educationLevelId: idFromString(input.educationLevelId),
        academicYear: input.academicYear,
        activeOtrs: input.activeOtrs,
        mode: input.mode,
        createdAt: input.now,
        updatedAt: input.now,
      })),
      skipDuplicates: true,
    })
    return res.count
  }

  /** Deletes the config; entries and marks go with it (ON DELETE CASCADE). */
  async deleteConfig(id: string): Promise<boolean> {
    const key = idOf(id)
    if (key === null) return false
    const res = await this.db.headcountConfig.deleteMany({ where: { id: key } })
    return res.count > 0
  }

  async touch(id: string, now: Date): Promise<void> {
    const key = idOf(id)
    if (key === null) return
    await this.db.headcountConfig.updateMany({ where: { id: key }, data: { updatedAt: now } })
  }

  /** The school of each config: its class's school, else its teacher's. Configs without any school are absent. */
  async schoolOfConfigs(configs: readonly HeadcountConfigRecord[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (configs.length === 0) return out
    const classes = new Map<string, string | null>()
    const classKeys = idsOf(configs.map((c) => c.classroomId))
    const teacherKeys = idsOf(configs.map((c) => c.teacherId))
    for (let i = 0; i < classKeys.length; i += READ_CHUNK) {
      const rows = await this.db.classroom.findMany({ where: { id: { in: classKeys.slice(i, i + READ_CHUNK) } }, select: { id: true, schoolId: true } })
      for (const r of rows) classes.set(idToString(r.id), r.schoolId === null ? null : idToString(r.schoolId))
    }
    const teachers = new Map<string, string | null>()
    for (let i = 0; i < teacherKeys.length; i += READ_CHUNK) {
      const rows = await this.db.user.findMany({ where: { id: { in: teacherKeys.slice(i, i + READ_CHUNK) } }, select: { id: true, schoolId: true } })
      for (const r of rows) teachers.set(idToString(r.id), r.schoolId === null ? null : idToString(r.schoolId))
    }
    for (const c of configs) {
      const school = classes.get(c.classroomId) ?? teachers.get(c.teacherId) ?? null
      if (school !== null) out.set(c.id, school)
    }
    return out
  }

  // --- entries -----------------------------------------------------------------------------

  /** Entries of these configs with marks sized to each config's OTR count. Two statements per chunk. */
  async entriesOf(configs: readonly HeadcountConfigRecord[]): Promise<HeadcountEntryRecord[]> {
    return this.load(configs, (keys) => ({ configId: { in: keys } }))
  }

  /** The student's entries in the given configs (all configs when `configs` is omitted is NOT allowed: pass the visible set). */
  async entriesOfStudent(studentId: string, configs: readonly HeadcountConfigRecord[]): Promise<HeadcountEntryRecord[]> {
    const s = idOf(studentId)
    if (s === null) return []
    return this.load(configs, (keys) => ({ configId: { in: keys }, studentId: s }))
  }

  /** The config ids in which the student holds an entry (dropped or not). */
  async configIdsOfStudent(studentId: string): Promise<string[]> {
    const s = idOf(studentId)
    if (s === null) return []
    const rows = await this.db.headcountEntry.findMany({ where: { studentId: s }, select: { configId: true } })
    return rows.map((r) => idToString(r.configId))
  }

  private async load(
    configs: readonly HeadcountConfigRecord[],
    where: (configKeys: bigint[]) => { configId: { in: bigint[] }; studentId?: bigint },
  ): Promise<HeadcountEntryRecord[]> {
    if (configs.length === 0) return []
    const otrs = new Map(configs.map((c) => [c.id, c.activeOtrs]))
    const keys = idsOf(configs.map((c) => c.id))
    const out: HeadcountEntryRecord[] = []
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const entries = await this.db.headcountEntry.findMany({ where: where(keys.slice(i, i + READ_CHUNK)), orderBy: { id: 'asc' } })
      if (entries.length === 0) continue
      const marks = await this.db.headcountEntryMark.findMany({ where: { entryId: { in: entries.map((e) => e.id) } } })
      const byEntry = new Map<bigint, typeof marks>()
      for (const m of marks) {
        const list = byEntry.get(m.entryId)
        if (list) list.push(m)
        else byEntry.set(m.entryId, [m])
      }
      for (const e of entries) {
        const configId = idToString(e.configId)
        const n = otrs.get(configId) ?? 0
        const targets = blankSlots(n)
        const actuals = blankSlots(n)
        for (const m of byEntry.get(e.id) ?? []) {
          if (m.checkpoint >= 1 && m.checkpoint <= n) {
            targets[m.checkpoint - 1] = toNum(m.target)
            actuals[m.checkpoint - 1] = toNum(m.actual)
          }
        }
        out.push({
          configId,
          studentId: idToString(e.studentId),
          marks: { tov: toNum(e.tov), targets, actuals, etr: toNum(e.etr), rs: toNum(e.rs) },
          rsRecordedAt: e.rsRecordedAt,
          dropped: e.dropped,
        })
      }
    }
    return out
  }

  /** "Ya, Reset": clears TOV, ETR, RS and every mark of every entry; the roster stays. Returns the entries cleared. */
  async resetMarks(configId: string, now: Date): Promise<number> {
    const key = idOf(configId)
    if (key === null) return 0
    const entries = await this.db.headcountEntry.findMany({ where: { configId: key }, select: { id: true } })
    const ids = entries.map((e) => e.id)
    if (ids.length > 0) {
      await this.db.headcountEntryMark.deleteMany({ where: { entryId: { in: ids } } })
      await this.db.headcountEntry.updateMany({
        where: { id: { in: ids } },
        data: { tov: null, etr: null, rs: null, rsRecordedAt: null, updatedAt: now },
      })
    }
    await this.touch(configId, now)
    return ids.length
  }

  /**
   * "Gugurkan" / "Kembalikan": sets the dropped flag. A pupil without an entry gets an empty dropped one (dropping only).
   * Returns the pupils whose flag changed.
   */
  async setDropped(configId: string, studentIds: readonly string[], dropped: boolean, now: Date): Promise<number> {
    const key = idOf(configId)
    if (key === null) return 0
    const students = idsOf(studentIds)
    if (students.length === 0) return 0
    const existing = await this.db.headcountEntry.findMany({ where: { configId: key, studentId: { in: students } }, select: { id: true, studentId: true, dropped: true } })
    const have = new Set(existing.map((e) => e.studentId))
    const toFlip = existing.filter((e) => e.dropped !== dropped).map((e) => e.id)
    let changed = 0
    if (toFlip.length > 0) {
      const res = await this.db.headcountEntry.updateMany({ where: { id: { in: toFlip } }, data: { dropped, updatedAt: now } })
      changed += res.count
    }
    if (dropped) {
      const missing = students.filter((s) => !have.has(s))
      if (missing.length > 0) {
        const res = await this.db.headcountEntry.createMany({
          data: missing.map((studentId) => ({ configId: key, studentId, dropped: true, createdAt: now, updatedAt: now })),
          skipDuplicates: true,
        })
        changed += res.count
      }
    }
    await this.touch(configId, now)
    return changed
  }

  // --- display lookups (read-only) -----------------------------------------------------------

  async subjectNames(ids: readonly string[]): Promise<Map<string, string>> {
    const keys = idsOf(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.subject.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  async levelNames(ids: readonly string[]): Promise<Map<string, string>> {
    const keys = idsOf(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.educationLevel.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  /** Active subjects for the create form, by name then id. */
  async activeSubjects(): Promise<SubjectOption[]> {
    const rows = await this.db.subject.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } })
    return rows
      .map((r) => ({ id: idToString(r.id), name: r.name, code: r.code }))
      .sort((a, b) => a.name.localeCompare(b.name) || (a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
  }

  async subjectExists(id: string): Promise<boolean> {
    const key = idOf(id)
    if (key === null) return false
    return (await this.db.subject.count({ where: { id: key } })) > 0
  }

  /** Tingkatan 4 and 5 (codes T4, T5) as the create form offers them. */
  async headcountLevels(): Promise<LevelOption[]> {
    const rows = await this.db.educationLevel.findMany({
      where: { code: { in: [...HEADCOUNT_LEVEL_CODES] } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })
    return rows.map((r) => ({ id: idToString(r.id), code: r.code, name: r.name }))
  }

  /** Levels by id or by code (D1..D6, T1..T5), for auto-setup. Unknown values are absent. */
  async levelsByIdOrCode(ids: readonly string[], codes: readonly string[]): Promise<LevelOption[]> {
    const keys = idsOf(ids)
    if (keys.length === 0 && codes.length === 0) return []
    const rows = await this.db.educationLevel.findMany({
      where: { OR: [...(keys.length > 0 ? [{ id: { in: keys } }] : []), ...(codes.length > 0 ? [{ code: { in: [...codes] } }] : [])] },
      select: { id: true, code: true, name: true },
    })
    return rows.map((r) => ({ id: idToString(r.id), code: r.code, name: r.name }))
  }
}
