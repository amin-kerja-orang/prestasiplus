import type {
  BijakQuestionBundle,
  BijakQuestionSource as AttemptQuestionSource,
} from '../../../src/modules/bijak/attempts/ports'
import { POC_QUESTION_ID_BASE } from '../../../prisma/seed/poc/export'
import type {
  BijakPool,
  BijakPoolScope,
  BijakQuestionInfo,
  BijakQuestionSource as PaperQuestionSource,
} from '../../../src/modules/bijak/papers/ports'

/**
 * Size of the reserved PoC id block: `[POC_QUESTION_ID_BASE, POC_QUESTION_ID_BASE + POC_ID_BLOCK)`.
 * BE-09's identity column never reaches 9e9 on this system, so the block cannot hold a bank question.
 */
export const POC_ID_BLOCK = 1_000_000_000n

/** True for a decimal id inside the reserved PoC block (`papers/poc/index.ts`). */
export function isPocReservedId(id: string): boolean {
  if (!/^[1-9]\d{0,18}$/.test(id)) return false
  const n = BigInt(id)
  return n >= POC_QUESTION_ID_BASE && n < POC_QUESTION_ID_BASE + POC_ID_BLOCK
}

function split(ids: readonly string[]): { poc: string[]; bank: string[] } {
  const poc: string[] = []
  const bank: string[] = []
  for (const id of new Set(ids)) (isPocReservedId(id) ? poc : bank).push(id)
  return { poc, bank }
}

async function merged<V>(
  parts: { ids: string[]; load: (ids: string[]) => Promise<ReadonlyMap<string, V>> }[],
): Promise<ReadonlyMap<string, V>> {
  const maps = await Promise.all(parts.filter((p) => p.ids.length > 0).map((p) => p.load(p.ids)))
  const out = new Map<string, V>()
  for (const m of maps) for (const [k, v] of m) out.set(k, v)
  return out
}

/**
 * BE-16 attempts: ids in the reserved PoC block go to the PoC fixture (the seeded PoC papers keep
 * working after BE-09), every other id goes to the BE-09 bank. Each source only ever sees its own ids.
 *
 * `poc` is null when `BIJAK_POC_QUESTIONS` is off (production; LEAD decision 2026-10-20: PoC questions are
 * staging only). Ids in the reserved block are then never served (absent from the map, never sent to BE-09).
 */
export class CompositeBijakQuestionSource implements AttemptQuestionSource {
  constructor(
    private readonly poc: AttemptQuestionSource | null,
    private readonly bank: AttemptQuestionSource,
  ) {}

  loadQuestions(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const { poc, bank } = split(questionIds)
    const pocSource = this.poc
    return merged([
      { ids: pocSource ? poc : [], load: (ids) => pocSource!.loadQuestions(ids) },
      { ids: bank, load: (ids) => this.bank.loadQuestions(ids) },
    ])
  }
}

/**
 * BE-15 papers: `getMany` routes like the attempts composite (eligibility and marks of a paper that
 * places BE-09 ids). `pool` stays on the PoC fixture: BE-09 has only the flat `pool=spm` tag and no
 * mapping to blueprint pool tags such as `MAT1-A` exists yet (#45 M8), so Jana keeps drawing from the
 * PoC pool.
 *
 * `poc` is null when `BIJAK_POC_QUESTIONS` is off (production): reserved PoC ids are absent from `getMany`
 * (a paper that places them is "not eligible", 403 on start) and `pool` is empty (Jana answers its usual
 * 422 SHORTAGE).
 */
export class CompositePaperQuestionSource implements PaperQuestionSource {
  constructor(
    private readonly poc: PaperQuestionSource | null,
    private readonly bank: Pick<PaperQuestionSource, 'getMany'>,
  ) {}

  getMany(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>> {
    const { poc, bank } = split(questionIds)
    const pocSource = this.poc
    return merged([
      { ids: pocSource ? poc : [], load: (ids) => pocSource!.getMany(ids) },
      { ids: bank, load: (ids) => this.bank.getMany(ids) },
    ])
  }

  pool(pool: string, scope: BijakPoolScope): Promise<BijakPool> {
    if (!this.poc) return Promise.resolve({ entries: [], groups: new Map() })
    return this.poc.pool(pool, scope)
  }
}
