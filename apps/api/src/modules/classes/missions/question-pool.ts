import { Inject, Injectable } from '@nestjs/common'

import { type QuestionFilter, type QuestionRecord, QuestionsRepository } from '../../questions'

const CHUNK = 200
/** Upper bound of one pool read (eligible questions of a subject and level). */
export const POOL_CAP = 5000

export interface PoolEntry {
  id: string
  chapterId: string | null
  spmPool: boolean
}

/**
 * Eligible questions for assigned work, read through the question bank (BE-09, ADR-0014): published live
 * version and `is_active`, and only `mcq` (practice serves nothing else). A question the bank no longer
 * has, deactivated or unpublished is never returned.
 */
@Injectable()
export class QuestionPool {
  constructor(@Inject(QuestionsRepository) private readonly questions: QuestionsRepository) {}

  /** The LIVE record of each id that is eligible now; others are absent. */
  async eligible(ids: readonly string[]): Promise<Map<string, QuestionRecord>> {
    const out = new Map<string, QuestionRecord>()
    for (let i = 0; i < ids.length; i += CHUNK) {
      for (const r of await this.questions.getMany(ids.slice(i, i + CHUNK), 'live')) {
        if (r.isActive && r.version.status === 'published' && r.version.type === 'mcq') out.set(r.id, r)
      }
    }
    return out
  }

  /**
   * The eligible `mcq` questions of `filter` with the two facts the bank cannot filter on yet (chapter, SPM pool),
   * ascending by id and bounded to `POOL_CAP`. Read ONCE per mission start or remedial generation and reused for every
   * topic, so a start never scans the bank more than once. HOOK (BE-09): `chapterId` and `spmPool` in
   * `QuestionFilter` would push both down to SQL and remove the hydration.
   */
  async catalog(filter: QuestionFilter): Promise<PoolEntry[]> {
    const ids = (await this.questions.eligibleIds({ ...filter, type: 'mcq' })).slice(0, POOL_CAP)
    const out: PoolEntry[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      for (const r of await this.questions.getMany(ids.slice(i, i + CHUNK), 'live')) {
        out.push({ id: r.id, chapterId: r.version.chapterId, spmPool: r.spmPool })
      }
    }
    return out.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0))
  }

  /** The records of ids, live version first, else the latest one (a preview shows a withdrawn question too); absent ids are skipped. */
  async anyVersion(ids: readonly string[]): Promise<Map<string, QuestionRecord>> {
    const out = new Map<string, QuestionRecord>()
    for (const r of await this.questions.getMany(ids, 'live')) out.set(r.id, r)
    const rest = ids.filter((id) => !out.has(id))
    if (rest.length > 0) for (const r of await this.questions.getMany(rest, 'latest')) out.set(r.id, r)
    return out
  }
}
