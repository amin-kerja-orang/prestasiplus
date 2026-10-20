import { Inject, Injectable } from '@nestjs/common'

import { type QuestionFilter, type QuestionRecord, QuestionsRepository } from '../../questions'

const CHUNK = 200

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

  /** Ascending ids of the eligible `mcq` questions that satisfy `filter` and `keep` (checked on the live record). */
  async ids(filter: QuestionFilter, keep?: (r: QuestionRecord) => boolean): Promise<string[]> {
    const ids = await this.questions.eligibleIds({ ...filter, type: 'mcq' })
    if (!keep) return ids
    const out: string[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const records = await this.questions.getMany(ids.slice(i, i + CHUNK), 'live')
      for (const r of records) if (keep(r)) out.push(r.id)
    }
    return out.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0))
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
