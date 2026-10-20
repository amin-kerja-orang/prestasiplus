/**
 * Composite question source of the paper builder (demo fix B4, QA #61). Mirrors the Bijak
 * `CompositePaperQuestionSource` / `CompositeBijakQuestionSource` (`bijak/question-bridge/composite.ts`):
 * ids in the reserved PoC block go to the PoC fixture, every other id goes to the BE-09 bank, and each
 * source only ever sees its own ids.
 *
 * Registered only when `BIJAK_POC_QUESTIONS` is on (staging / demo; `ExamBuilderModule`). Off (production
 * default) the bank is registered unwrapped, so reserved PoC ids are never described: a PUT that places
 * them is refused and a paper that holds them cannot be published, as before. On, the PoC questions are
 * described as Terbit at version 1, are picker candidates, and their groups and review content are
 * served, so a seeded PoC paper can be withdrawn and re-published and a new paper can be filled with them.
 */
import type { BijakAttemptOption, BijakAttemptStimulus, BijakBuilderReviewQuestion } from '@pp/contract'

import { isPocReservedId } from '../../bijak/question-bridge/composite'
import type {
  BuilderCandidateScope,
  BuilderGroupInfo,
  BuilderPreview,
  BuilderQuestionInfo,
  BuilderQuestionRef,
  BuilderQuestionSource,
} from './ports'

async function mergedMaps<V>(loads: Promise<ReadonlyMap<string, V>>[]): Promise<ReadonlyMap<string, V>> {
  const out = new Map<string, V>()
  for (const m of await Promise.all(loads)) for (const [k, v] of m) out.set(k, v)
  return out
}

export class CompositeBuilderQuestionSource implements BuilderQuestionSource {
  constructor(
    private readonly poc: BuilderQuestionSource,
    private readonly bank: BuilderQuestionSource,
  ) {}

  describe(refs: readonly BuilderQuestionRef[]): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    const poc: BuilderQuestionRef[] = []
    const bank: BuilderQuestionRef[] = []
    for (const ref of refs) (isPocReservedId(ref.id) ? poc : bank).push(ref)
    const loads: Promise<ReadonlyMap<string, BuilderQuestionInfo>>[] = []
    if (poc.length) loads.push(this.poc.describe(poc))
    if (bank.length) loads.push(this.bank.describe(bank))
    return mergedMaps(loads)
  }

  /** PoC candidates first (the seeded demo questions), then the bank's; an id appears once. */
  async candidates(scope: BuilderCandidateScope): Promise<string[]> {
    const [poc, bank] = await Promise.all([
      this.poc.candidates(scope),
      this.bank.candidates(scope),
    ])
    return [...new Set([...poc.filter(isPocReservedId), ...bank.filter((id) => !isPocReservedId(id))])]
  }

  /**
   * Group ids are not partitioned by number: PoC groups keep their PoC keys and bank groups are decimal
   * ids, and each source answers only for its own groups, so both are asked and the answers merged.
   */
  groups(groupIds: readonly string[]): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    if (groupIds.length === 0) return Promise.resolve(new Map())
    return mergedMaps([this.poc.groups(groupIds), this.bank.groups(groupIds)])
  }

  async review(ids: readonly string[]): Promise<BuilderPreview> {
    const unique = [...new Set(ids)]
    const pocIds = unique.filter(isPocReservedId)
    const bankIds = unique.filter((id) => !isPocReservedId(id))
    const [poc, bank] = await Promise.all([
      pocIds.length ? this.poc.review(pocIds) : Promise.resolve(null),
      bankIds.length ? this.bank.review(bankIds) : Promise.resolve(null),
    ])
    const byId = new Map<string, BijakBuilderReviewQuestion>()
    const stimuli: Record<string, BijakAttemptStimulus> = {}
    const optionBanks: Record<string, BijakAttemptOption[]> = {}
    for (const part of [poc, bank]) {
      if (!part) continue
      for (const q of part.questions) byId.set(q.id, q)
      Object.assign(stimuli, part.stimuli)
      Object.assign(optionBanks, part.optionBanks)
    }
    // Keep the caller's order (the paper order), as a single source would.
    const questions = unique.flatMap((id) => {
      const q = byId.get(id)
      return q ? [q] : []
    })
    return { questions, stimuli, optionBanks }
  }
}
