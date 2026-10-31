import type { BijakPool, BijakQuestionInfo, BijakQuestionSource } from './ports'
import { POC_BANK, pocQuestionId, pocQuestionMarks, type PocPart } from './poc'

/**
 * Default `BijakQuestionSource` until BE-09 provides the question bank: serves the PoC questions
 * (reserved ids, see `poc/index.ts`) from the bundled export. All PoC questions are published. It
 * returns structure only (marks, group, pool membership), never content or keys.
 */
/** Scheme kinds a person marks (the same two the self-mark accepts). */
const MANUAL_KINDS: ReadonlySet<string> = new Set(['points', 'rubric'])
const schemeKinds = new Map(POC_BANK.schemes.map((s) => [s.id, s.scheme.kind]))
const leafIds = (parts: readonly PocPart[]): string[] => parts.flatMap((p) => (p.children?.length ? leafIds(p.children) : [p.id]))

export class PocQuestionSource implements BijakQuestionSource {
  private readonly info = new Map<string, BijakQuestionInfo>()
  private readonly groupIdByKey = new Map<string, string>()
  private readonly groupMembers = new Map<string, string[]>()

  constructor() {
    for (const g of POC_BANK.groups) this.groupMembers.set(g.id, g.questionIds)
    for (const q of POC_BANK.questions) {
      const id = pocQuestionId(q.id).toString()
      const manual = [q.id, ...leafIds(q.parts ?? [])].some((k) => MANUAL_KINDS.has(schemeKinds.get(k) ?? ''))
      this.info.set(id, { id, marks: pocQuestionMarks(q), groupId: q.groupId ?? null, versionNo: 1, ...(manual ? { manual: true as const } : {}) })
      if (q.groupId) this.groupIdByKey.set(q.id, q.groupId)
    }
  }

  async getMany(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>> {
    const out = new Map<string, BijakQuestionInfo>()
    for (const id of ids) {
      const found = this.info.get(id)
      if (found) out.set(id, found)
    }
    return out
  }

  async pool(pool: string): Promise<BijakPool> {
    const entries: BijakPool['entries'] = []
    for (const e of POC_BANK.pool) {
      if (e.pool !== pool) continue
      const groupId = this.groupIdByKey.get(e.questionId)
      entries.push({ questionId: pocQuestionId(e.questionId).toString(), ...(groupId ? { groupId } : {}) })
    }
    const groups = new Map<string, string[]>()
    for (const e of entries) {
      if (e.groupId && !groups.has(e.groupId)) {
        groups.set(
          e.groupId,
          (this.groupMembers.get(e.groupId) ?? []).map((key) => pocQuestionId(key).toString()),
        )
      }
    }
    return { entries, groups }
  }
}
