import type { QuestionFacts } from '../papers/exam-core.adapter'
import type { BijakPoolSource } from '../papers/pool-source'
import type { BijakPoolScope, BijakServedSource } from '../papers/ports'

/**
 * `BijakPoolSource` of the running API (BJS-07): bank facts (M04, `QuestionsBijakPoolSource.candidatesOf`) plus, when
 * `BIJAK_POC_QUESTIONS` is on, the PoC fixture facts (reserved id block, so ids never collide). `seen` is the
 * attempts-side served port. Same switch as `CompositePaperQuestionSource`; production serves bank facts only.
 */
export class CompositeBijakPoolSource implements BijakPoolSource {
  constructor(
    private readonly poc: BijakPoolSource | null,
    private readonly bank: { candidatesOf(subjectId: string): Promise<QuestionFacts[]> },
    private readonly served: BijakServedSource,
  ) {}

  async candidates(scope: BijakPoolScope): Promise<QuestionFacts[]> {
    const [bank, poc] = await Promise.all([this.bank.candidatesOf(scope.subjectId), this.poc ? this.poc.candidates(scope) : []])
    return [...bank, ...poc]
  }

  seen(userId: string): Promise<ReadonlySet<string>> {
    return this.served.servedQuestionIds(userId)
  }
}
