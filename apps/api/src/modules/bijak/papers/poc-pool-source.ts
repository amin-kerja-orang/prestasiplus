import type { FormOrigin, LeafFact, QuestionFacts, UnitFact } from './exam-core.adapter'
import { POC_BANK, pocQuestionId, type PocPart, type PocQuestion } from './poc'
import type { BijakPoolSource } from './pool-source'
import type { BijakPoolScope } from './ports'
import { bijakCodeOf } from './subject-codes'

/**
 * Staging `BijakPoolSource` over the PoC fixture (BJS-07). The fixture has no curriculum node ids, no KBAT tag and no
 * review flag, so the mapping is fixture-only:
 * - `kbat` is false on every leaf, `tagReview` false;
 * - a Tingkatan 4 or 5 question gets a SYNTHETIC unit `poc:<unitLabel>` (level from `formOrigin`); a T1-T3 question
 *   has no unit and sits in the T1-T3 bucket (the fixture's own `unit` is always null);
 * - mode is the part's answer kind (`mcq` for an option question), a key exists when the fixture holds a scheme for
 *   the question (MCQ) or the part id;
 * - the pool tags are the fixture's `pool` entries; the group id is the fixture group key.
 * It never returns content or keys. `seen` is empty: the integration wiring uses the served-question port instead.
 */
export class PocPoolSource implements BijakPoolSource {
  private readonly schemes = new Map(POC_BANK.schemes.map((s) => [s.id, s.scheme]))
  private readonly pools = new Map<string, string[]>()
  private readonly groups = new Map(POC_BANK.groups.map((g) => [g.id, g.questionIds]))

  constructor() {
    for (const e of POC_BANK.pool) {
      const list = this.pools.get(e.questionId)
      if (list) list.push(e.pool)
      else this.pools.set(e.questionId, [e.pool])
    }
  }

  async candidates(scope: BijakPoolScope): Promise<QuestionFacts[]> {
    const subject = bijakCodeOf(scope.subjectCode)
    return POC_BANK.questions.filter((q) => q.curriculum.subject === subject && this.pools.has(q.id)).map((q) => this.factsOf(q))
  }

  async seen(): Promise<ReadonlySet<string>> {
    return new Set()
  }

  private factsOf(q: PocQuestion): QuestionFacts {
    const origin: FormOrigin = q.curriculum.formOrigin === 'T4' ? 't4' : q.curriculum.formOrigin === 'T5' ? 't5' : 't1_t3'
    const unit: UnitFact | null =
      origin === 't1_t3' ? null : { nodeId: `poc:${q.curriculum.unitLabel}`, level: origin === 't4' ? 'T4' : 'T5', code: q.curriculum.unitLabel }
    const members = q.groupId ? (this.groups.get(q.groupId) ?? []) : []
    return {
      id: pocQuestionId(q.id).toString(),
      groupId: q.groupId ?? null,
      groupPosition: q.groupId ? members.indexOf(q.id) + 1 || null : null,
      ...(q.groupId ? { groupSize: members.length } : {}),
      versionNo: 1,
      tagReview: false,
      unit,
      formOrigin: origin,
      pools: this.pools.get(q.id) ?? [],
      leaves: this.leavesOf(q),
    }
  }

  private leavesOf(q: PocQuestion): LeafFact[] {
    const tp = q.curriculum.tp
    if (q.mcq) {
      const scheme = this.schemes.get(q.id)
      return [{ marks: scheme?.marks ?? 1, mode: 'mcq', tp, kbat: false, hasKey: scheme !== undefined }]
    }
    const out: LeafFact[] = []
    const walk = (parts: readonly PocPart[]): void => {
      for (const p of parts) {
        if (p.children?.length) walk(p.children)
        else out.push({ marks: p.marks, mode: p.answer?.kind ?? null, tp, kbat: false, hasKey: this.schemes.has(p.id) })
      }
    }
    walk(q.parts ?? [])
    return out
  }
}
