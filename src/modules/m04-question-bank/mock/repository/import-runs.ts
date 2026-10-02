/**
 * The `importRuns` repository (owner M04; SRS v1.11 §6.6 DATA-M04-07, §6.13.5, BR-M04-38): the S5
 * CSV import runs behind S5h "Sejarah Import" (DV-M04-01) and the M17 S10 import tiles.
 *
 * The seed is a deterministic D11 set: **1,123** runs (ids 1–1,123), Σ `importedCount` = **31,101**,
 * none created in August or September 2026; the observed-style anchor run "soalan-bm-d3.csv"
 * (12 imported, 1 failed) is the newest, dated 2026-07-20. PROPOSED: per-run counts (largest
 * remainder), `failedCount` 0–3, file names, dates from 2025-11-01 to 2026-07-19. A small set, so it
 * is a materialised table (every count is computed from its rows). Runtime runs take ids from 1,124.
 *
 * Override `importRuns: []` (M04 E2E) seeds no run (S5h empty state).
 */

import { toIsoMyt } from '@/lib/time'
import { hashKey, split, defineNamedQueries } from '@/mock/dataset'
import { defineTable, maxPlusOne, type Where } from '@/mock/define'
import { defineRepository, RepositoryError } from '@/mock/repository'

import { IMPORT_RUNS } from '../data/tables'
import type { ImportRun } from './types'

export const importRunsTable = defineTable<ImportRun>({
  name: 'questionImportRuns',
  ids: maxPlusOne(),
  indexes: ['createdMonth'],
})

export const importRunQueries = defineNamedQueries(importRunsTable, {
  'Q-IMPORT-RUNS': {
    where: (): Where<ImportRun> => ({}),
    source: 'M04 §4.1 (M17 S10 "Jumlah Import")',
  },
  'Q-IMPORT-MONTH': {
    where: (month: string): Where<ImportRun> => ({ createdMonth: month }),
    source: 'M04 §4.1 (M17 S10 "Import Bulan Ini" / "Import Lepas")',
  },
})

const START = Date.parse('2025-11-01T09:00:00+08:00')
const END = Date.parse('2026-07-19T17:00:00+08:00')
const CODES = ['bm', 'bi', 'mate', 'sains', 'sejarah', 'pi', 'pm', 'geo'] as const
const month = (iso: string) => iso.slice(0, 7)

/** The default runs (pure; recomputed per seed). */
export function defaultImportRuns(): ImportRun[] {
  const generated = IMPORT_RUNS.total - 1
  const counts = split(
    IMPORT_RUNS.imported - IMPORT_RUNS.anchor.importedCount,
    Array.from({ length: generated }, (_, i) => [i + 1, 5 + (hashKey(i + 1, 91) % 50)] as const),
  )
  const rows: ImportRun[] = counts.map(([id, importedCount]) => {
    const createdAt = toIsoMyt(
      START + Math.floor(((id - 1) * (END - START)) / (generated - 1) / 60_000) * 60_000,
    )
    const failedCount = hashKey(id, 92) % 4
    const code = CODES[hashKey(id, 93) % CODES.length] as string
    return {
      id,
      fileName: `soalan-${code}-${String(1 + (hashKey(id, 94) % 11))}-${String(id)}.csv`,
      importedCount,
      failedCount,
      failures: Array.from({ length: failedCount }, (_, k) => ({
        row: 2 + k,
        message: 'Baris tidak lengkap.',
      })),
      defaults: { subjectId: null, educationLevelId: null, difficultyLevel: 2 },
      createdBy: 1,
      createdAt,
      createdMonth: month(createdAt),
    }
  })
  const a = IMPORT_RUNS.anchor
  rows.push({
    id: IMPORT_RUNS.total,
    fileName: a.fileName,
    importedCount: a.importedCount,
    failedCount: a.failedCount,
    failures: [{ row: 7, message: 'Jawapan betul mesti A, B, C atau D.' }],
    defaults: { subjectId: 1, educationLevelId: 3, difficultyLevel: 2 },
    createdBy: 1,
    createdAt: a.createdAt,
    createdMonth: month(a.createdAt),
  })
  return rows
}

export const importRunsRepo = defineRepository({
  name: 'importRuns',
  owner: 'M04',
  store: importRunsTable,
  queries: importRunQueries,
  methods: ({ store, transaction }) => ({
    get: (id: number): ImportRun | null => store.get(id) ?? null,
    /** S5h (#10): newest first, 20 per page. */
    list: (page = 1, pageSize = 20) =>
      store.query({
        sort: [
          { field: 'createdAt', dir: 'desc' },
          { field: 'id', dir: 'desc' },
        ],
        page,
        pageSize,
      }),
    /** Q-IMPORTED: Σ `importedCount` (M17 "Soalan Diimport"). */
    importedTotal: (): number => store.query().rows.reduce((a, r) => a + r.importedCount, 0),
    /** Runs created in `month` (`YYYY-MM`). */
    countByMonth: (m: string): number => store.count({ createdMonth: m }),
    /** #9: one import run (the handler parses the CSV and creates the questions). */
    create: (
      input: Omit<ImportRun, 'id' | 'createdAt' | 'createdMonth'>,
      now: number,
    ): ImportRun => {
      if (input.importedCount < 0 || input.failedCount < 0) {
        throw new RepositoryError('CONTRACT', 'importRuns: counts must be ≥ 0')
      }
      const createdAt = toIsoMyt(now)
      return transaction(() =>
        store.insert({ ...input, createdAt, createdMonth: month(createdAt) }),
      )
    },
    /** Seed (`override`: `[]` = the empty state); seed phase, through the repository. */
    seedDefault: (override?: unknown): void => {
      if (override !== undefined && !(Array.isArray(override) && override.length === 0)) {
        throw new RepositoryError('CONTRACT', 'importRuns override: only [] (no runs) is accepted')
      }
      if (override !== undefined) return
      for (const r of defaultImportRuns()) store.insert(r)
    },
  }),
})
