/**
 * M07 seed (SRS M07 v1.7 §6.8), written through the M07 repositories and the M04 contribution
 * contract (overview §3 rule 3a):
 *
 * - the 15 domains, the 3 packages (provisional, owner M19), the 3 live access rows, Pelajar Demo's
 *   two T1 exam attempts and seven T1 mastery values;
 * - the 763 PKSK rows (ids 177698-178460) as M04 anchors through `questions.anchorRow` and
 *   `questions.contributeAnchors`; M04 owns the counts (Q-PKSK, Q-PKSK-DIFFICULTY) and the anchors
 *   fit them (rows with a fixed difficulty are completed first, so the seed-assigned rows cannot
 *   take their room).
 */

import type { SeedContext } from '@/mock/define'
import { questions, type Question } from '@/modules/m04-question-bank/mock'

import { SEED_DOMAINS, SEED_PACKAGES } from '../data/domains'
import { SEED_ACCESS, SEED_ATTEMPTS, SEED_MASTERY } from '../data/designed'
import {
  assignDomainsAndLevels,
  createdAtMsOf,
  OBSERVED_QUESTIONS,
  PKSK_FIRST_ID,
  PKSK_LAST_ID,
} from '../data/questions'
import {
  pkskAccessRepo,
  pkskDomainsRepo,
  pkskPackagesRepo,
  pkskProgressRepo,
} from '../repository/stores'
import { toIsoMyt } from '@/lib/time'

export function buildPkskAnchors(): Question[] {
  const where = assignDomainsAndLevels()
  const observed = new Map(OBSERVED_QUESTIONS.map((o) => [o.id, o]))
  const row = (id: number): Question => {
    const place = where.get(id) as { domainId: number; level: 'T1' | 'T4' }
    const o = observed.get(id)
    return questions.anchorRow({
      id,
      pkskDomainId: place.domainId,
      pkskTargetLevel: place.level,
      ...(o?.difficulty !== undefined ? { difficultyLevel: o.difficulty } : {}),
      ...(o ? { questionText: o.text } : {}),
      ...(o?.explanation !== undefined ? { explanation: o.explanation, hasExplanation: true } : {}),
      ...(o?.options ? { pkskOptions: o.options.map((x) => ({ ...x })) } : {}),
      createdAt: toIsoMyt(createdAtMsOf(id)),
    })
  }
  const fixed = OBSERVED_QUESTIONS.filter((o) => o.difficulty !== undefined).map((o) => o.id)
  const out = new Map<number, Question>()
  for (const id of fixed) out.set(id, row(id))
  for (let id = PKSK_FIRST_ID; id <= PKSK_LAST_ID; id++) if (!out.has(id)) out.set(id, row(id))
  return [...out.values()].sort((a, b) => a.id - b.id)
}

export function seedPksk(ctx: SeedContext): void {
  pkskDomainsRepo.seed(SEED_DOMAINS)
  pkskPackagesRepo.seed(SEED_PACKAGES)
  pkskAccessRepo.seed(SEED_ACCESS)
  pkskProgressRepo.seedAttempts(SEED_ATTEMPTS)
  pkskProgressRepo.seedMastery(SEED_MASTERY)
  questions.contributeAnchors(ctx, buildPkskAnchors())
}
