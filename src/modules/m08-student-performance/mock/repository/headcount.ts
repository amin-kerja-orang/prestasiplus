/**
 * The `headcount` repository (owner **M08**; D12; SRS M08 v1.12 §6.4, §7 #12–#17, #24–#29; M08-T1b).
 * Owns HeadcountConfig (primary store) and HeadcountEntry. Only these methods write the stores.
 *
 * Contract for the other modules:
 * - M12: `entriesForStudent(studentId, year)` (also exported as `headcountEntries(studentId, year)`);
 * - M17: `get(configId)` (config with its entries and their grades);
 * - M18: `entries({pupilSchoolIds | classSchoolIds, graded?})` (XR-M18-06 scoping, §6.4);
 * - M08 itself: `views()`, the reader behind the headcount port (S1, S3, S6, S9).
 *
 * INFERRED: a dropped entry (FR-M08-140 "Gugurkan") leaves every aggregate, so `views()` skips it; the
 * entry stays in the store so "Kembalikan" restores it. Creating a config creates no entry (config 506
 * is the observed "no entry yet" state).
 */

import { toIsoMyt } from '@/lib/time'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { headcountConfigsTable, headcountEntriesTable } from '../tables/headcount'
import { otrTargets } from '../../lib/headcount/otr'
import { latestAr, type HeadcountEntryView } from './headcount-port'
import type { HeadcountConfigRow, HeadcountEntryRow, HeadcountMode } from './headcount-types'
import { gradeOfPercent, type Grade } from './rules'

export interface HeadcountConfigInput {
  teacherId: number
  classroomId: number
  subjectId: number
  educationLevelId: number
  academicYear: number
  activeOtrs: number
  mode: HeadcountMode
}

/** An entry as the other modules read it (M17 modal, M18 coverage). */
export interface HeadcountEntryDetail {
  studentId: number
  tov: number | null
  etr: number | null
  rs: number | null
  /** Grade of the latest AR (BR-M08-01), null when the entry has no AR. */
  grade: Grade | null
}

export interface HeadcountConfigDetail {
  config: HeadcountConfigRow
  entries: HeadcountEntryDetail[]
}

/** An entry view with the schools M18 scopes by (§6.4). */
export interface HeadcountScopedEntry extends HeadcountEntryView {
  pupilSchoolId: number | null
  classSchoolId: number | null
  grade: Grade | null
}

export interface HeadcountScopeFilter {
  pupilSchoolIds?: readonly number[]
  classSchoolIds?: readonly number[]
  /** true = graded entries only (an AR exists). */
  graded?: boolean
}

const blankSlots = (n: number): (number | null)[] => Array.from({ length: n }, () => null)

const blankEntry = (c: HeadcountConfigRow, studentId: number): Omit<HeadcountEntryRow, 'id'> => ({
  configId: c.id,
  studentId,
  tov: null,
  targets: blankSlots(c.activeOtrs),
  actuals: blankSlots(c.activeOtrs),
  etr: null,
  rs: null,
  rsRecordedAt: null,
  dropped: false,
})

const gradeOfEntry = (e: HeadcountEntryView): Grade | null => {
  const l = latestAr(e)
  return l === null ? null : gradeOfPercent(l.ar)
}

/** A config and one of its entries as the headcount port reads them. */
export function entryView(c: HeadcountConfigRow, e: HeadcountEntryRow): HeadcountEntryView {
  // HC-1 / HC-2: an entry without its own TOV / ETR reads the config default; the OTR targets are
  // computed from them, never read from the stored slots (the stored values are ignored).
  const tov = e.tov ?? c.defaultTov ?? null
  const etr = e.etr ?? c.defaultEtr ?? null
  return {
    configId: c.id,
    studentId: e.studentId,
    classroomKind: 'classroom',
    classroomId: c.classroomId,
    subjectId: c.subjectId,
    levelId: c.educationLevelId,
    configUpdatedAt: c.updatedAt,
    academicYear: c.academicYear,
    activeOtrs: c.activeOtrs,
    tov,
    targets: otrTargets(tov, etr, c.activeOtrs),
    // HC-3: an Auto AR is a whole number (round(correct / answered × 100)).
    actuals: c.mode === 'auto' ? e.actuals.map((v) => (v === null ? null : Math.round(v))) : e.actuals,
    etr,
    rs: e.rs,
    dropped: e.dropped,
  }
}

/** Write sections of the headcount stores since the module loaded (a data stamp of the M08 memos). */
let headcountRevision = 0
export const headcountRevisionOf = (): number => headcountRevision

export const headcountRepo = defineRepository({
  owner: 'M08',
  name: 'headcount',
  store: headcountConfigsTable,
  stores: { entries: headcountEntriesTable },
  methods: ({ store, stores, transaction: tx }) => {
    const entriesStore = stores.entries
    // Every write below runs inside `transaction`; counting those sections gives the S1 memo
    // (`schoolPerformance`) a revision of the headcount stores.
    const transaction: typeof tx = (fn) => {
      headcountRevision++
      return tx(fn)
    }

    const view = entryView

    const allViews = (): HeadcountEntryView[] => {
      const byId = new Map(store.query({}).rows.map((c) => [c.id, c]))
      const out: HeadcountEntryView[] = []
      for (const e of entriesStore.query({}).rows) {
        if (e.dropped) continue
        const c = byId.get(e.configId)
        if (c) out.push(view(c, e))
      }
      return out
    }

    const touch = (id: number, now: number): void => {
      store.update(id, { updatedAt: toIsoMyt(now) })
    }

    return {
      /** Seed / finalise: the baseline rows (explicit ids). */
      seed(configs: readonly HeadcountConfigRow[], entries: readonly HeadcountEntryRow[]): void {
        transaction(() => {
          configs.forEach((c) => store.insert(c))
          entries.forEach((e) => entriesStore.insert(e))
        })
      },

      config(id: number): HeadcountConfigRow | undefined {
        return store.get(id)
      },

      /** Every config, newest first (S12 order, FR-M08-81). */
      configs(): HeadcountConfigRow[] {
        return store
          .query({})
          .rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)
      },

      configsOfTeacher(teacherId: number): HeadcountConfigRow[] {
        return store
          .query({ where: { teacherId } })
          .rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)
      },

      configsOfClass(classroomId: number): HeadcountConfigRow[] {
        return store.query({ where: { classroomId } }).rows
      },

      /** The config of the same class + subject + year + mode (BR-M08-22 uniqueness). */
      duplicateOf(input: {
        classroomId: number
        subjectId: number
        academicYear: number
        mode: HeadcountMode
      }): HeadcountConfigRow | undefined {
        return store.query({
          where: {
            classroomId: input.classroomId,
            subjectId: input.subjectId,
            academicYear: input.academicYear,
            mode: input.mode,
          },
        }).rows[0]
      },

      /** Same class + subject + year in any mode (Auto-Setup, BR-M08-21). */
      existsForClass(classroomId: number, subjectId: number, academicYear: number): boolean {
        return store.count({ classroomId, subjectId, academicYear }) > 0
      },

      entriesOf(configId: number): HeadcountEntryRow[] {
        return entriesStore.query({ where: { configId } }).rows
      },

      entriesOfStudent(studentId: number): HeadcountEntryRow[] {
        return entriesStore.query({ where: { studentId } }).rows
      },

      /** S12 / S14 / auto-setup: a config without entries. */
      create(input: HeadcountConfigInput, now: number): HeadcountConfigRow {
        const at = toIsoMyt(now)
        return transaction(() =>
          store.insert({
            teacherId: input.teacherId,
            classroomId: input.classroomId,
            subjectId: input.subjectId,
            educationLevelId: input.educationLevelId,
            academicYear: input.academicYear,
            activeOtrs: input.activeOtrs,
            mode: input.mode,
            status: 'active',
            createdAt: at,
            updatedAt: at,
          }),
        )
      },

      /** "Ya, Reset" (#26): clears TOV, ETR, OTR targets, AR and RS of every entry; the roster stays. */
      resetMarks(configId: number, now: number): number {
        const config = store.get(configId)
        if (!config) return 0
        const rows = entriesStore.query({ where: { configId } }).rows
        transaction(() => {
          for (const e of rows) {
            entriesStore.update(e.id, {
              tov: null,
              targets: blankSlots(config.activeOtrs),
              actuals: blankSlots(config.activeOtrs),
              etr: null,
              rs: null,
              rsRecordedAt: null,
            })
          }
          touch(configId, now)
        })
        return rows.length
      },

      /** "Ya, Padam" (#27): the config and its entries. */
      remove(configId: number): boolean {
        if (!store.get(configId)) return false
        transaction(() => {
          for (const e of entriesStore.query({ where: { configId } }).rows)
            entriesStore.remove(e.id)
          store.remove(configId)
        })
        return true
      },

      /**
       * "Gugurkan" / "Kembalikan" (#28): sets the dropped flag of the given students; a student without an
       * entry gets an empty one when dropped (INFERRED). Returns the students whose flag changed.
       */
      setDropped(
        configId: number,
        studentIds: readonly number[],
        dropped: boolean,
        now: number,
      ): number {
        const config = store.get(configId)
        if (!config) return 0
        let changed = 0
        transaction(() => {
          for (const studentId of studentIds) {
            const entry = entriesStore.query({ where: { configId, studentId } }).rows[0]
            if (entry) {
              if (entry.dropped !== dropped) {
                entriesStore.update(entry.id, { dropped })
                changed++
              }
            } else if (dropped) {
              entriesStore.insert({
                configId,
                studentId,
                tov: null,
                targets: blankSlots(config.activeOtrs),
                actuals: blankSlots(config.activeOtrs),
                etr: null,
                rs: null,
                rsRecordedAt: null,
                dropped: true,
              })
              changed++
            }
          }
          touch(configId, now)
        })
        return changed
      },

      /** API-RPT-10 `PUT .../ar`: sets the AR of checkpoint `n` (1-based) of the given pupils (blank entry created). */
      setAr(
        configId: number,
        n: number,
        marks: readonly { studentId: number; value: number | null }[],
        now: number,
      ): void {
        const config = store.get(configId)
        if (!config) return
        transaction(() => {
          for (const m of marks) {
            const entry = entriesStore.query({ where: { configId, studentId: m.studentId } }).rows[0]
            const actuals = [...(entry?.actuals ?? blankSlots(config.activeOtrs))]
            while (actuals.length < config.activeOtrs) actuals.push(null)
            actuals[n - 1] = m.value
            if (entry) entriesStore.update(entry.id, { actuals })
            else entriesStore.insert({ ...blankEntry(config, m.studentId), actuals })
          }
          touch(configId, now)
        })
      },

      /** API-RPT-10 `PUT .../tov`: TOV / ETR / RS per pupil; an absent field stays, `null` clears it. */
      setTov(
        configId: number,
        rows: readonly {
          studentId: number
          tov?: number | null
          etr?: number | null
          rs?: number | null
          rsRecordedAt?: string | null
        }[],
        today: string,
        now: number,
      ): void {
        const config = store.get(configId)
        if (!config) return
        transaction(() => {
          for (const r of rows) {
            const entry = entriesStore.query({ where: { configId, studentId: r.studentId } }).rows[0]
            const base = entry ?? blankEntry(config, r.studentId)
            const patch: Partial<Omit<HeadcountEntryRow, 'id'>> = {}
            if (r.tov !== undefined) patch.tov = r.tov
            if (r.etr !== undefined) patch.etr = r.etr
            if (r.rs !== undefined) {
              patch.rs = r.rs
              // FR-GUR-3-12: the date defaults to the day RS is first saved; clearing RS clears it.
              patch.rsRecordedAt =
                r.rs === null ? null : (r.rsRecordedAt ?? base.rsRecordedAt ?? today)
            } else if (r.rsRecordedAt !== undefined && base.rs !== null) {
              patch.rsRecordedAt = r.rsRecordedAt
            }
            if (entry) entriesStore.update(entry.id, patch)
            else entriesStore.insert({ ...blankEntry(config, r.studentId), ...patch })
          }
          touch(configId, now)
        })
      },

      /** The highest checkpoint above `n` that holds an AR (CF-05), or null. */
      marksAbove(configId: number, n: number): number | null {
        let top: number | null = null
        for (const e of entriesStore.query({ where: { configId } }).rows) {
          e.actuals.forEach((v, i) => {
            if (v !== null && i + 1 > n && (top === null || i + 1 > top)) top = i + 1
          })
        }
        return top
      },

      /** API-RPT-10 `PUT .../settings`: the OTR count; the slots above it are deleted (CF-05). */
      setActiveOtrs(configId: number, n: number, now: number): void {
        if (!store.get(configId)) return
        transaction(() => {
          for (const e of entriesStore.query({ where: { configId } }).rows) {
            const fit = (v: readonly (number | null)[]): (number | null)[] =>
              Array.from({ length: n }, (_, i) => v[i] ?? null)
            entriesStore.update(e.id, { targets: fit(e.targets), actuals: fit(e.actuals) })
          }
          store.update(configId, { activeOtrs: n })
          touch(configId, now)
        })
      },

      /** API-RPT-16 `PUT .../defaults`: the subject-card TOV and ETR. */
      setDefaults(
        configId: number,
        defaults: { defaultTov: number | null; defaultEtr: number | null },
        now: number,
      ): void {
        if (!store.get(configId)) return
        transaction(() => {
          store.update(configId, defaults)
          touch(configId, now)
        })
      },

      /** M17 `GET /api/command-center/headcount/{configId}`: the config and its non-dropped entries. */
      get(configId: number): HeadcountConfigDetail | undefined {
        const config = store.get(configId)
        if (!config) return undefined
        return {
          config,
          entries: entriesStore
            .query({ where: { configId } })
            .rows.filter((e) => !e.dropped)
            .sort((a, b) => a.studentId - b.studentId)
            .map((e) => ({
              studentId: e.studentId,
              tov: e.tov,
              etr: e.etr,
              rs: e.rs,
              grade: gradeOfEntry(view(config, e)),
            })),
        }
      },

      /** M12 BR-M12-30: the student's entries of an academic year (dropped entries excluded). */
      entriesForStudent(studentId: number, year: number): HeadcountEntryView[] {
        const out: HeadcountEntryView[] = []
        for (const e of entriesStore.query({ where: { studentId } }).rows) {
          if (e.dropped) continue
          const c = store.get(e.configId)
          if (c && c.academicYear === year) out.push(view(c, e))
        }
        return out.sort((a, b) => a.configId - b.configId)
      },

      /** M18 XR-M18-06: entries scoped by the pupil's school and / or the class's school (§6.4). */
      entries(filter: HeadcountScopeFilter = {}): HeadcountScopedEntry[] {
        const pupils = filter.pupilSchoolIds ? new Set(filter.pupilSchoolIds) : null
        const owners = filter.classSchoolIds ? new Set(filter.classSchoolIds) : null
        const classSchool = new Map<number, number | null>()
        const out: HeadcountScopedEntry[] = []
        for (const v of allViews()) {
          let cs = classSchool.get(v.classroomId)
          if (cs === undefined) {
            cs =
              classrooms.get('classroom', v.classroomId)?.schoolId ??
              users.get(store.get(v.configId)?.teacherId ?? -1)?.schoolId ??
              null
            classSchool.set(v.classroomId, cs)
          }
          const pupilSchool = users.get(v.studentId)?.schoolId ?? null
          const grade = gradeOfEntry(v)
          if (filter.graded === true && grade === null) continue
          if (pupils && (pupilSchool === null || !pupils.has(pupilSchool))) continue
          if (owners && (cs === null || !owners.has(cs))) continue
          out.push({ ...v, pupilSchoolId: pupilSchool, classSchoolId: cs, grade })
        }
        return out
      },

      /** The reader behind the headcount port: every non-dropped entry with its config. */
      views(): HeadcountEntryView[] {
        return allViews()
      },
    }
  },
})
