import { describe, expect, it } from 'vitest'

import type { SpMapPort, SpTagRow } from '../../../../src/modules/reports/performance/ports'

/**
 * The shared `SpMapPort` contract (#924, S10-T04 part 3): run against `InMemorySpMap` (sp-map-in-memory.spec.ts)
 * and the real `CurriculumSpMapAdapter` (sp-map.prisma.spec.ts). Ids are the seed's own; a real-DB factory maps them
 * in and back out. Row order of `spOf` is not part of the contract (the consumer groups tags), so it is compared sorted.
 */
export interface SpMapSeedNode {
  id: string
  subjectId: string
  levelId: string
  kind: 'grouping' | 'unit' | 'sk' | 'sp'
  code: string
  title: string
  parentId: string | null
  sortOrder: number
}
export interface SpMapSeed {
  subjects: { id: string; code: string; name: string; sortOrder: number; isActive: boolean }[]
  /** Levels the factory must know: the contract queries each of them. */
  levels: string[]
  nodes: SpMapSeedNode[]
  /** Versions in `versionNo` order (1, 2, ...); status of the question_versions row. */
  questions: { id: string; versions: { status: 'draft' | 'review' | 'approved' | 'archived'; spIds: string[] }[] }[]
}

const node = (id: string, subjectId: string, levelId: string, kind: SpMapSeedNode['kind'], code: string, title: string, parentId: string | null, sortOrder: number): SpMapSeedNode => ({
  id,
  subjectId,
  levelId,
  kind,
  code,
  title,
  parentId,
  sortOrder,
})

/**
 * Subject A (sort 2) at L5: grouping > unit "Tajuk Satu" > SK 1.1 > SP 1.1.2 (sort 2) and 1.1.1 (sort 1); SK 1.2 > SP 1.2.1;
 * unit "Tajuk Dua" > SP 2.0.1 (no SK); a root SK "SK Tanpa Unit" > SP 3.1.1; a root SP 9.9.9 (no parent). Subject B
 * (sort 1) at L5: unit "Bab B" > SP 1.1.1. Subject C (inactive) has an SP at L5. Subject D has only a unit at L5.
 * L1 has a unit of A only (Bab level, no SP). L0 has nothing.
 */
export const SP_MAP_SEED: SpMapSeed = {
  subjects: [
    { id: '1', code: 'SPA', name: 'Subjek A', sortOrder: 2, isActive: true },
    { id: '2', code: 'SPB', name: 'Subjek B', sortOrder: 1, isActive: true },
    { id: '3', code: 'SPC', name: 'Subjek C', sortOrder: 0, isActive: false },
    { id: '4', code: 'SPD', name: 'Subjek D', sortOrder: 3, isActive: true },
  ],
  levels: ['L5', 'L1', 'L0'],
  nodes: [
    node('10', '1', 'L5', 'grouping', 'kumpulan-1', 'Kumpulan 1', null, 1),
    node('11', '1', 'L5', 'unit', '1.0', 'Tajuk Satu', '10', 1),
    node('12', '1', 'L5', 'sk', '1.1', 'SK 1.1', '11', 1),
    node('14', '1', 'L5', 'sp', '1.1.2', 'SP 1.1.2', '12', 2),
    node('13', '1', 'L5', 'sp', '1.1.1', 'SP 1.1.1', '12', 1),
    node('15', '1', 'L5', 'sk', '1.2', 'SK 1.2', '11', 2),
    node('16', '1', 'L5', 'sp', '1.2.1', 'SP 1.2.1', '15', 1),
    node('17', '1', 'L5', 'unit', '2.0', 'Tajuk Dua', '10', 2),
    node('18', '1', 'L5', 'sp', '2.0.1', 'SP 2.0.1', '17', 1),
    node('19', '1', 'L5', 'sk', '3.1', 'SK Tanpa Unit', null, 3),
    node('20', '1', 'L5', 'sp', '3.1.1', 'SP 3.1.1', '19', 1),
    node('21', '1', 'L5', 'sp', '9.9.9', 'SP 9.9.9', null, 4),
    node('30', '2', 'L5', 'unit', '1.0', 'Bab B', null, 1),
    node('31', '2', 'L5', 'sp', '1.1.1', 'SP B 1.1.1', '30', 1),
    node('40', '3', 'L5', 'sp', '1.1.1', 'SP C', null, 1),
    node('50', '4', 'L5', 'unit', '1.0', 'Bab D', null, 1),
    node('60', '1', 'L1', 'unit', '1.0', 'Bab T1', null, 1),
  ],
  questions: [
    { id: '101', versions: [{ status: 'approved', spIds: ['13', '14'] }] },
    { id: '102', versions: [{ status: 'approved', spIds: [] }] },
    { id: '103', versions: [{ status: 'draft', spIds: ['13'] }] },
    { id: '104', versions: [{ status: 'approved', spIds: ['16'] }, { status: 'draft', spIds: ['18'] }] },
    { id: '105', versions: [{ status: 'archived', spIds: ['13'] }, { status: 'approved', spIds: ['20'] }] },
  ],
}

const sorted = (rows: SpTagRow[]): SpTagRow[] =>
  [...rows].sort((a, b) => Number(a.questionId) - Number(b.questionId) || Number(a.spNodeId) - Number(b.spNodeId))

export function describeSpMapPort(name: string, make: (seed: SpMapSeed) => Promise<SpMapPort>): void {
  describe(`SpMapPort: ${name}`, () => {
    it('spTree: a null level, an unknown level, a level with no nodes and a Bab-only level give no subject', async () => {
      const port = await make(SP_MAP_SEED)
      expect(await port.spTree({ levelId: null })).toEqual([])
      expect(await port.spTree({ levelId: 'abc' })).toEqual([])
      expect(await port.spTree({ levelId: 'L0' })).toEqual([])
      expect(await port.spTree({ levelId: 'L1' })).toEqual([])
    })

    it('spTree: only active subjects with SP nodes, in the curriculum order (sort order, then id)', async () => {
      const port = await make(SP_MAP_SEED)
      const tree = await port.spTree({ levelId: 'L5' })
      expect(tree.map((s) => [s.subjectId, s.subjectCode, s.subjectName])).toEqual([
        ['2', 'SPB', 'Subjek B'],
        ['1', 'SPA', 'Subjek A'],
      ])
    })

    it('spTree: SP nodes only, in DSKP (depth-first) order, sortOrder 1..n, strand = nearest unit, else sk, else null', async () => {
      const port = await make(SP_MAP_SEED)
      const a = (await port.spTree({ levelId: 'L5' })).find((s) => s.subjectId === '1')
      expect(a?.nodes).toEqual([
        { spNodeId: '13', code: '1.1.1', title: 'SP 1.1.1', strand: 'Tajuk Satu', sortOrder: 1 },
        { spNodeId: '14', code: '1.1.2', title: 'SP 1.1.2', strand: 'Tajuk Satu', sortOrder: 2 },
        { spNodeId: '16', code: '1.2.1', title: 'SP 1.2.1', strand: 'Tajuk Satu', sortOrder: 3 },
        { spNodeId: '18', code: '2.0.1', title: 'SP 2.0.1', strand: 'Tajuk Dua', sortOrder: 4 },
        { spNodeId: '20', code: '3.1.1', title: 'SP 3.1.1', strand: 'SK Tanpa Unit', sortOrder: 5 },
        { spNodeId: '21', code: '9.9.9', title: 'SP 9.9.9', strand: null, sortOrder: 6 },
      ])
      const b = (await port.spTree({ levelId: 'L5' })).find((s) => s.subjectId === '2')
      expect(b?.nodes).toEqual([{ spNodeId: '31', code: '1.1.1', title: 'SP B 1.1.1', strand: 'Bab B', sortOrder: 1 }])
    })

    it('spOf: one row per SP tag of the latest approved version; Bab-only, draft-only, unknown and malformed ids give none', async () => {
      const port = await make(SP_MAP_SEED)
      expect(sorted(await port.spOf(['101']))).toEqual([
        { questionId: '101', spNodeId: '13' },
        { questionId: '101', spNodeId: '14' },
      ])
      expect(await port.spOf(['102', '103', '987654321', 'abc'])).toEqual([])
      expect(await port.spOf([])).toEqual([])
    })

    it('spOf: approved v1 + draft v2 gives v1 tags; archived v1 + approved v2 gives v2 tags', async () => {
      const port = await make(SP_MAP_SEED)
      expect(await port.spOf(['104'])).toEqual([{ questionId: '104', spNodeId: '16' }])
      expect(await port.spOf(['105'])).toEqual([{ questionId: '105', spNodeId: '20' }])
    })

    it('spOf: one read for many questions; duplicate input ids give no duplicate rows', async () => {
      const port = await make(SP_MAP_SEED)
      expect(sorted(await port.spOf(['105', '101', '102', '101', '104', 'abc', '105']))).toEqual([
        { questionId: '101', spNodeId: '13' },
        { questionId: '101', spNodeId: '14' },
        { questionId: '104', spNodeId: '16' },
        { questionId: '105', spNodeId: '20' },
      ])
    })
  })
}
