/**
 * The `dskp` repository (owner **M10**; SRS M10 v1.15 §6.9 DATA-M10-10; F-30): DSKP Bidang / SK /
 * SP. It replaces the provisional DSKP store of M04-T1: M04 `dskpSpId`, M08 S6 / S7 (weak topics,
 * map tiles) and M10 S18 / S28 read the SPs through it.
 *
 * Contract: `bidang({subjectId, educationLevelId})`, `sk(bidangId)`, `sp(skId)`, `getBidang`,
 * `getSk`, `getSp`, `spPath(spId)` (SP with its SK and Bidang), `hasSp`, `genericSpId(subjectId,
 * levelId)`, and the teacher writes `createBidang / createSk / createSp` (runtime ids ≥ 9,000,001,
 * `createdBy` = the teacher).
 */

import { defineRepository } from '@/mock/repository'
import type { Where } from '@/mock/define'

import { buildDskp, genericSpId } from '../data/dskp'
import { dskpBidangTable, dskpSkTable, dskpSpTable } from '../tables/tables'
import type { DskpBidangRow, DskpSkRow, DskpSpRow } from './types'

export interface SpPath {
  sp: DskpSpRow
  sk: DskpSkRow
  bidang: DskpBidangRow
}

/** Natural order of codes such as "1.0", "2.0", "1.1.10". `null` sorts first. */
export function compareCodes(a: string | null, b: string | null): number {
  const pa = (a ?? '').split('.')
  const pb = (b ?? '').split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i]
    const y = pb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = Number(x)
    const ny = Number(y)
    const d = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y)
    if (d !== 0) return d
  }
  return 0
}

export const dskpRepo = defineRepository({
  owner: 'M10',
  name: 'dskp',
  store: dskpBidangTable,
  stores: { sk: dskpSkTable, sp: dskpSpTable },
  methods: ({ store: bidang, stores, transaction }) => {
    const { sk, sp } = stores
    return {
      /** Seed phase: the seeded records of §6.9. */
      seed(): void {
        const seeded = buildDskp()
        transaction(() => {
          for (const r of seeded.bidang) bidang.insert(r)
          for (const r of seeded.sk) sk.insert(r)
          for (const r of seeded.sp) sp.insert(r)
        })
      },

      genericSpId,

      bidang(filter: { subjectId?: number; educationLevelId?: number } = {}): DskpBidangRow[] {
        const where: Where<DskpBidangRow> = {}
        if (filter.subjectId !== undefined) where.subjectId = filter.subjectId
        if (filter.educationLevelId !== undefined) where.educationLevelId = filter.educationLevelId
        return bidang
          .query({ where })
          .rows.sort((a, b) => compareCodes(a.code, b.code) || a.id - b.id)
      },

      sk(bidangId: number): DskpSkRow[] {
        return sk
          .query({ where: { bidangId } })
          .rows.sort((a, b) => compareCodes(a.code, b.code) || a.id - b.id)
      },

      sp(skId: number): DskpSpRow[] {
        return sp
          .query({ where: { skId } })
          .rows.sort((a, b) => compareCodes(a.code, b.code) || a.id - b.id)
      },

      getBidang: (id: number): DskpBidangRow | undefined => bidang.get(id),
      getSk: (id: number): DskpSkRow | undefined => sk.get(id),
      getSp: (id: number): DskpSpRow | undefined => sp.get(id),
      hasSp: (id: number): boolean => sp.get(id) !== undefined,

      spPath(spId: number): SpPath | undefined {
        const s = sp.get(spId)
        const k = s ? sk.get(s.skId) : undefined
        const b = k ? bidang.get(k.bidangId) : undefined
        return s && k && b ? { sp: s, sk: k, bidang: b } : undefined
      },

      /** Counts of the store (build check, S18 / S28 selects). */
      sizes: () => ({ bidang: bidang.count(), sk: sk.count(), sp: sp.count() }),

      createBidang(
        input: { subjectId: number; educationLevelId: number; code?: string | null; name: string },
        createdBy: number,
      ): DskpBidangRow {
        return transaction(() =>
          bidang.insert({
            subjectId: input.subjectId,
            educationLevelId: input.educationLevelId,
            code: input.code ?? null,
            name: input.name,
            createdBy,
          }),
        )
      },

      createSk(
        input: { bidangId: number; code: string; description: string },
        createdBy: number,
      ): DskpSkRow {
        if (!bidang.get(input.bidangId))
          throw new Error(`M10 dskp.createSk: no Bidang ${String(input.bidangId)}`)
        return transaction(() => sk.insert({ ...input, createdBy }))
      },

      createSp(
        input: { skId: number; code: string; description: string },
        createdBy: number,
      ): DskpSpRow {
        if (!sk.get(input.skId)) throw new Error(`M10 dskp.createSp: no SK ${String(input.skId)}`)
        return transaction(() => sp.insert({ ...input, createdBy }))
      },
    }
  },
})

export type DskpRepository = typeof dskpRepo
