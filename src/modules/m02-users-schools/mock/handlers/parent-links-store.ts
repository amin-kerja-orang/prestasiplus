/**
 * The `users.parentLinks` table and the `parentLinks` repository (owner M02; DATA-M02-02, BR-10).
 *
 * Parent↔student links are many-to-many (a parent has several children, a student may have several
 * parents, INFERRED). Only `parent` users own links. S2 creates the set; S3 replaces the whole set with
 * the submitted chips (duplicates ignored). Seed rows 1–2 keep their fixed ids (canonical parent 6 →
 * students 2 and 4); runtime rows take ids from 1000 (`sequence`, overview §6.5).
 *
 * The file lives under `handlers/` (build-plan §S.3: a module mock task writes `mock/handlers/**`).
 */

import { toIsoMyt } from '@/lib/time'
import { defineTable, ID_RANGES, sequence } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

export interface ParentLinkRow {
  id: number
  /** A `parent` user. */
  parentId: number
  /** A `student` user; the pair is unique. */
  studentId: number
  /** ISO 8601 (+08:00). */
  createdAt: string
}

export const parentLinksTable = defineTable<ParentLinkRow>({
  name: 'users.parentLinks',
  ids: sequence({ runtimeStart: ID_RANGES.sequenceRuntimeStart }),
  indexes: ['parentId', 'studentId'],
})

const byId = (a: ParentLinkRow, b: ParentLinkRow): number => a.id - b.id

export const parentLinksRepo = defineRepository({
  owner: 'M02',
  name: 'parentLinks',
  store: parentLinksTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: rows with their fixed ids. */
    seedRows(rows: readonly ParentLinkRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    /** Every link, by id. */
    all(): ParentLinkRow[] {
      return store.query({ sort: 'id' }).rows
    },

    /** The student ids linked to `parentId`, in link order. */
    studentIdsOf(parentId: number): number[] {
      return store
        .query({ where: { parentId } })
        .rows.sort(byId)
        .map((r) => r.studentId)
    },

    /** The parent ids linked to `studentId`, in link order. */
    parentIdsOf(studentId: number): number[] {
      return store
        .query({ where: { studentId } })
        .rows.sort(byId)
        .map((r) => r.parentId)
    },

    /**
     * BR-10 / BR-11: the parent's links become exactly `studentIds` (duplicates ignored). Links that
     * stay keep their id and date; removed ones are deleted; new ones are inserted at `now`.
     */
    replaceFor(parentId: number, studentIds: readonly number[], now: number): ParentLinkRow[] {
      const wanted = [...new Set(studentIds)]
      return transaction(() => {
        const existing = store.query({ where: { parentId } }).rows
        for (const row of existing) {
          if (!wanted.includes(row.studentId)) store.remove(row.id)
        }
        const kept = new Set(existing.map((r) => r.studentId))
        const at = toIsoMyt(now)
        for (const studentId of wanted) {
          if (!kept.has(studentId)) store.insert({ parentId, studentId, createdAt: at })
        }
        return store.query({ where: { parentId } }).rows.sort(byId)
      })
    },

    /**
     * L45 BR-L45-05 (XR-L45-01/02): creates the link of the pair unless it exists (BR-10 unique pair).
     * `created` is `false` when it already existed (the old row, its id and date, are kept).
     */
    createIfAbsent(
      parentId: number,
      studentId: number,
      now: number,
    ): { row: ParentLinkRow; created: boolean } {
      return transaction(() => {
        const existing = store.query({ where: { parentId, studentId } }).rows[0]
        if (existing) return { row: existing, created: false }
        const row = store.insert({ parentId, studentId, createdAt: toIsoMyt(now) })
        return { row, created: true }
      })
    },

    /** L45 BR-L45-08: every link row of `studentId`, in link order (the caller joins the parents). */
    listParentsOfStudent(studentId: number): ParentLinkRow[] {
      return store.query({ where: { studentId } }).rows.sort(byId)
    },

    /** BR-06: a deleted user's links go with it, whether it was the parent or the student. Returns how many. */
    removeForUser(userId: number): number {
      return transaction(() => {
        const rows = [
          ...store.query({ where: { parentId: userId } }).rows,
          ...store.query({ where: { studentId: userId } }).rows,
        ]
        for (const row of rows) store.remove(row.id)
        return rows.length
      })
    },
  }),
})

export type ParentLinksRepository = typeof parentLinksRepo
