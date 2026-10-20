import { reduceFacts } from '../../../../src/modules/reports/performance/domain/reduce'
import type {
  BijakAggregatePort,
  BijakGroupBy,
  BijakItemFact,
  BijakItemQuery,
  BijakSittingFact,
  BijakSittingQuery,
  BijakTotals,
  SchoolRef,
} from '../../../../src/modules/reports/performance/ports'

export interface StoredSitting {
  fact: BijakSittingFact
  /** A Mod Pelajar sitting: the port must never return it. */
  isTest?: boolean
  /** 'abandoned' | 'in_progress' rows exist in the store but are never returned. */
  state?: 'submitted' | 'abandoned' | 'in_progress'
}

/** In-memory `BijakAggregatePort` applying the rules the real adapter must: no test rows, no unfinished sittings. */
export class InMemoryBijakAggregate implements BijakAggregatePort {
  private readonly sittingRows: StoredSitting[] = []
  private readonly itemRows: BijakItemFact[] = []

  constructor(private readonly schools: readonly SchoolRef[] = []) {}

  addSitting(fact: BijakSittingFact, extra: Omit<StoredSitting, 'fact'> = {}): this {
    this.sittingRows.push({ fact, ...extra })
    return this
  }

  addItem(item: BijakItemFact): this {
    this.itemRows.push(item)
    return this
  }

  private visible(q: BijakSittingQuery): StoredSitting[] {
    const coverage = new Set(
      this.schools
        .filter((s) => (q.state === undefined || s.state === q.state) && (q.district === undefined || s.district === q.district))
        .map((s) => s.id),
    )
    return this.sittingRows.filter((r) => {
      const f = r.fact
      if (r.isTest === true) return false
      if ((r.state ?? 'submitted') !== 'submitted') return false
      if (q.userIds && !q.userIds.includes(f.userId)) return false
      if (q.schoolIds && (f.schoolId === null || !q.schoolIds.includes(f.schoolId))) return false
      if ((q.state !== undefined || q.district !== undefined) && (f.schoolId === null || !coverage.has(f.schoolId))) return false
      if (q.subjectId !== undefined && f.subjectId !== q.subjectId) return false
      if (q.modes && !q.modes.includes(f.mode)) return false
      if (q.submittedFrom && f.submittedAt < q.submittedFrom) return false
      if (q.submittedTo && f.submittedAt >= q.submittedTo) return false
      return true
    })
  }

  async sittings(q: BijakSittingQuery): Promise<BijakSittingFact[]> {
    return this.visible(q).map((r) => r.fact)
  }

  async totals(q: BijakSittingQuery, groupBy: BijakGroupBy): Promise<BijakTotals[]> {
    return reduceFacts(
      this.visible(q).map((r) => r.fact),
      groupBy,
    )
  }

  async items(q: BijakItemQuery): Promise<BijakItemFact[]> {
    const { questionIds, ...sittingQuery } = q
    const attempts = new Set(this.visible(sittingQuery).map((r) => r.fact.attemptId))
    return this.itemRows.filter((i) => attempts.has(i.attemptId) && (questionIds === undefined || questionIds.includes(i.questionId)))
  }
}
