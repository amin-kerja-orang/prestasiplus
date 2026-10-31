/**
 * The paper builder's question source when `BIJAK_POC_QUESTIONS` is on (staging/demo): the PoC fixture
 * (reserved PoC id block) PLUS the BE-09 question bank. Mirrors `CompositePaperQuestionSource` of the
 * question bridge: ids in the reserved PoC block go to the PoC source, every other id to the bank.
 * With the flag off the module registers the bank alone (this class is not used).
 *
 * Why: the seed loads no PoC questions into the `questions` table, so a bank-only builder lists nothing
 * and cannot re-publish a withdrawn seeded paper (its PoC placements read as "not Terbit").
 */
import type { BijakAttemptStimulus } from '@pp/contract'

import { isPocReservedId } from './composite'
import type {
  BuilderCandidateScope,
  BuilderGroupInfo,
  BuilderPreview,
  BuilderQuestionInfo,
  BuilderQuestionRef,
  BuilderQuestionSource,
} from '../../../src/modules/exam/builder/ports'

async function mergedMaps<V>(parts: Promise<ReadonlyMap<string, V>>[]): Promise<ReadonlyMap<string, V>> {
  const out = new Map<string, V>()
  for (const m of await Promise.all(parts)) for (const [k, v] of m) out.set(k, v)
  return out
}

export class CompositeBuilderQuestionSource implements BuilderQuestionSource {
  constructor(
    private readonly poc: BuilderQuestionSource,
    private readonly bank: BuilderQuestionSource,
  ) {}

  describe(refs: readonly BuilderQuestionRef[]): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    const pocRefs = refs.filter((r) => isPocReservedId(r.id))
    const bankRefs = refs.filter((r) => !isPocReservedId(r.id))
    return mergedMaps([
      pocRefs.length ? this.poc.describe(pocRefs) : Promise.resolve(new Map()),
      bankRefs.length ? this.bank.describe(bankRefs) : Promise.resolve(new Map()),
    ])
  }

  async candidates(scope: BuilderCandidateScope): Promise<string[]> {
    const [poc, bank] = await Promise.all([this.poc.candidates(scope), this.bank.candidates(scope)])
    // PoC first (the demo bank), then the bank in its own order; ids cannot collide (reserved block).
    return [...new Set([...poc, ...bank])]
  }

  async groups(groupIds: readonly string[]): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    // PoC group ids are PoC keys, bank group ids are decimal strings; each side ignores the other's.
    return mergedMaps([this.poc.groups(groupIds), this.bank.groups(groupIds)])
  }

  async review(ids: readonly string[]): Promise<BuilderPreview> {
    const pocIds = ids.filter(isPocReservedId)
    const bankIds = ids.filter((id) => !isPocReservedId(id))
    const [p, b] = await Promise.all([
      pocIds.length ? this.poc.review(pocIds) : Promise.resolve(null),
      bankIds.length ? this.bank.review(bankIds) : Promise.resolve(null),
    ])
    const byId = new Map([...(p?.questions ?? []), ...(b?.questions ?? [])].map((q) => [q.id, q]))
    return {
      questions: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      stimuli: { ...(p?.stimuli ?? {}), ...(b?.stimuli ?? {}) } as Record<string, BijakAttemptStimulus>,
      optionBanks: { ...(p?.optionBanks ?? {}), ...(b?.optionBanks ?? {}) },
    }
  }
}
