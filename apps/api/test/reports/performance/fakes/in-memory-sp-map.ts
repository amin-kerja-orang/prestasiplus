import type { SpMapPort, SpNodeRef, SpSubjectTree, SpTagRow } from '../../../../src/modules/reports/performance/ports'

/**
 * In-memory `SpMapPort`: the SP tree per level and the question-to-SP tags, with the semantics the SQL adapter
 * (cross-sector follow-up, S4/S1) must have: a question with no SP tag has no row, a level with no nodes has no subject.
 */
export class InMemorySpMap implements SpMapPort {
  private readonly trees = new Map<string, SpSubjectTree[]>()
  private readonly tags: SpTagRow[] = []

  /** Subjects with SP nodes at `levelId`, in the order given. */
  setTree(levelId: string, subjects: readonly SpSubjectTree[]): this {
    this.trees.set(levelId, [...subjects])
    return this
  }
  /** Tags `questionId` to the SP nodes. */
  tag(questionId: string, ...spNodeIds: string[]): this {
    for (const spNodeId of spNodeIds) this.tags.push({ questionId, spNodeId })
    return this
  }

  async spTree(query: { levelId: string | null }): Promise<SpSubjectTree[]> {
    return query.levelId === null ? [] : (this.trees.get(query.levelId) ?? [])
  }
  /** Like the SQL adapter: duplicate input ids give no duplicate rows; rows sorted by question, then SP (numeric ids). */
  async spOf(questionIds: readonly string[]): Promise<SpTagRow[]> {
    const wanted = new Set(questionIds)
    const seen = new Set<string>()
    return this.tags
      .filter((t) => wanted.has(t.questionId) && !seen.has(`${t.questionId}:${t.spNodeId}`) && seen.add(`${t.questionId}:${t.spNodeId}`))
      .sort((a, b) => Number(a.questionId) - Number(b.questionId) || Number(a.spNodeId) - Number(b.spNodeId))
  }
}

export const spNode = (spNodeId: string, code: string, over: Partial<SpNodeRef> = {}): SpNodeRef => ({
  spNodeId,
  code,
  title: `Standard ${code}`,
  strand: null,
  sortOrder: Number(spNodeId.replace(/\D/g, '')) || 0,
  ...over,
})
