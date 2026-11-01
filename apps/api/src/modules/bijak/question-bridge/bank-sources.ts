import type { QuestionFacts } from '../papers/exam-core.adapter'
import type { BijakPoolSource } from '../papers/pool-source'
import type {
  BijakPool,
  BijakPoolScope,
  BijakQuestionInfo,
  BijakQuestionSource as PaperQuestionSource,
  BijakServedSource,
} from '../papers/ports'

/**
 * R1-B07: the question bank is the ONLY source of Bijak questions. These two adapters replace the PoC/bank composites that split
 * the reserved PoC id block (`BIJAK_POC_QUESTIONS`) from the bank; the PoC fixture itself now lives under `test/support/poc`.
 */

/**
 * BE-15 papers: `getMany` (eligibility, marks and group of a placed question) reads the bank. The legacy `pool(...)` of this port
 * is the pre-BJS-07 generator's pool, which had no bank mapping (the blueprint pool tags such as `MAT2-B` are read through
 * `BankBijakPoolSource` and the standard generator); it stays empty.
 */
export class BankPaperQuestionSource implements PaperQuestionSource {
  constructor(private readonly bank: Pick<PaperQuestionSource, 'getMany'> & Partial<Pick<PaperQuestionSource, 'getPinned'>>) {}

  getMany(questionIds: readonly string[]): ReturnType<PaperQuestionSource['getMany']> {
    return this.bank.getMany(questionIds) as Promise<ReadonlyMap<string, BijakQuestionInfo>>
  }

  /** Pinned info for a question a paper froze (H-A13): the cover and card keep their marks after "Arkib". A bank without it gives an empty map. */
  getPinned(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>> {
    const pinned = this.bank.getPinned
    return questionIds.length === 0 || !pinned ? Promise.resolve(new Map()) : pinned.call(this.bank, questionIds)
  }

  pool(): Promise<BijakPool> {
    return Promise.resolve({ entries: [], groups: new Map() })
  }
}

/**
 * `BijakPoolSource` of the running API (BJS-07): candidate facts from the bank (M04, `QuestionsBijakPoolSource.candidatesOf`);
 * `seen` is the attempts-side served port (Jana's "prefer unseen").
 */
export class BankBijakPoolSource implements BijakPoolSource {
  constructor(
    private readonly bank: { candidatesOf(subjectId: string): Promise<QuestionFacts[]> },
    private readonly served: BijakServedSource,
  ) {}

  candidates(scope: BijakPoolScope): Promise<QuestionFacts[]> {
    return this.bank.candidatesOf(scope.subjectId)
  }

  seen(userId: string): Promise<ReadonlySet<string>> {
    return this.served.servedQuestionIds(userId)
  }
}
