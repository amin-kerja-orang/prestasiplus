import type { INestApplication } from '@nestjs/common'

import { PocBijakQuestionSource } from '../../../prisma/seed/poc/export/attempt-source'
import { BijakAttemptPorts, type BijakQuestionSource as AttemptSource } from '../../../src/modules/bijak/attempts/ports'
import type { BijakPoolSource } from '../../../src/modules/bijak/papers/pool-source'
import { BijakPapersPorts, type BijakQuestionSource as PaperSource } from '../../../src/modules/bijak/papers/ports'
import { BijakBuilderPorts, type BuilderQuestionSource } from '../../../src/modules/exam/builder/ports'
import { CompositeBuilderQuestionSource } from './builder-composite'
import { PocBuilderQuestionSource } from './builder-source'
import { CompositeBijakQuestionSource, CompositePaperQuestionSource } from './composite'
import { PocQuestionSource } from './paper-source'
import { PocPoolSource } from './pool-source'

/**
 * TEST ONLY (R1-B07). The PoC question fixture is gone from `src`: the API serves the question bank only. A test that needs the
 * seeded PoC papers (reserved ids, loaded into no table) calls these AFTER `app.init()`. They wrap the sources the modules have
 * registered so the reserved PoC id block goes to the fixture and every other id to the bank, exactly as the removed
 * `BIJAK_POC_QUESTIONS` composites did. The ports are replaced through their fields because a port can be set once.
 */

/** BE-16 attempts: PoC ids from the fixture, the rest from the registered (bank) source. */
export function plugPocAttempts(app: INestApplication): void {
  const attempt = app.get(BijakAttemptPorts) as unknown as { questions: AttemptSource }
  attempt.questions = new CompositeBijakQuestionSource(new PocBijakQuestionSource(), attempt.questions)
}

/** BE-15 papers: `getMany` and the legacy pool (`questions`, default on) and Jana's PoC pool facts. */
export function plugPocPapers(app: INestApplication, opts: { questions?: boolean } = {}): void {
  const papers = app.get(BijakPapersPorts) as unknown as { questions: PaperSource; pools: BijakPoolSource }
  if (opts.questions !== false) papers.questions = new CompositePaperQuestionSource(new PocQuestionSource(), papers.questions)
  const bankPool = papers.pools
  const pocPool = new PocPoolSource()
  papers.pools = {
    candidates: async (scope) => [...(await bankPool.candidates(scope)), ...(await pocPool.candidates(scope))],
    seen: (userId) => bankPool.seen(userId),
  }
}

/** The paper builder: PoC candidates plus the registered (bank) source. */
export function plugPocBuilder(app: INestApplication): void {
  let holder: BijakBuilderPorts
  try {
    holder = app.get(BijakBuilderPorts, { strict: false })
  } catch {
    return // an app without the builder module
  }
  const builder = holder as unknown as { questions: BuilderQuestionSource }
  builder.questions = new CompositeBuilderQuestionSource(new PocBuilderQuestionSource(), builder.questions)
}

/** All of them (the integrated API). */
export function plugPocFixture(app: INestApplication): void {
  plugPocAttempts(app)
  plugPocPapers(app)
  plugPocBuilder(app)
}
