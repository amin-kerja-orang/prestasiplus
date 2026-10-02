/**
 * Synthetic stores for the F-10 tests (not a module spec): a small question-like virtual dataset
 * owned by "M04" and a wallet-like table.
 */

import { floor, maxPlusOne } from '../../db/id-strategies'
import { defineTable } from '../../db/table'
import { defineNamedQueries } from '../../dataset/named-queries'
import { defineVirtualDataset } from '../../dataset/dataset'

export interface Q {
  id: number
  subjectId: number
  status: 'approved' | 'draft'
  isActive: boolean
  text: string
}

export type QFacet = 'subjectId' | 'status' | 'isActive'

/** 3 subjects; subject 3 has no approved rows (to show `groupCount` omitting zeros). */
export const Q_CELLS = [
  { facets: { subjectId: 1, status: 'approved', isActive: true }, count: 40 },
  { facets: { subjectId: 1, status: 'draft', isActive: true }, count: 10 },
  { facets: { subjectId: 2, status: 'approved', isActive: true }, count: 25 },
  { facets: { subjectId: 2, status: 'approved', isActive: false }, count: 5 },
  { facets: { subjectId: 3, status: 'draft', isActive: true }, count: 20 },
] as const satisfies readonly { facets: Pick<Q, QFacet>; count: number }[]

export const Q_TOTAL = 100

export function makeQuestions(name = 'questions', anchors: Q[] = []) {
  return defineVirtualDataset<Q, QFacet>({
    name,
    owner: 'M04',
    total: Q_TOTAL,
    idRange: { min: 1, max: 1000 },
    reservedAnchorRanges: [[600_001, 600_999]],
    runtimeIds: floor({ start: 700_000 }),
    facets: ['subjectId', 'status', 'isActive'],
    distribution: Q_CELLS.map((c) => ({ facets: { ...c.facets }, count: c.count })),
    derive: (id) => ({ text: `Soalan ${String(id)}` }),
    anchors,
  })
}

export function questionQueries(store: ReturnType<typeof makeQuestions>) {
  return defineNamedQueries(store, {
    'Q-ALL': { expected: Q_TOTAL, source: 'test' },
    'Q-ELIGIBLE': {
      where: (subjectId?: number) => ({
        status: 'approved' as const,
        isActive: true,
        ...(subjectId === undefined ? {} : { subjectId }),
      }),
    },
    'Q-DRAFT': { where: { status: 'draft' } },
  })
}

export interface Wallet {
  id: number
  userId: number
  coins: number
  points: number
}

export function makeWalletTable(name = 'wallet') {
  return defineTable<Wallet>({ name, ids: maxPlusOne(), indexes: ['userId'] })
}

export function anchor(id: number, patch: Partial<Q> = {}): Q {
  return {
    id,
    subjectId: 1,
    status: 'approved',
    isActive: true,
    text: `Anchor ${String(id)}`,
    ...patch,
  }
}
