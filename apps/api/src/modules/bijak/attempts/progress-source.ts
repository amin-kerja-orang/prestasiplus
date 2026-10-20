import { Inject, Injectable } from '@nestjs/common'

import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

/**
 * Structural mirrors of `bijak/papers/ports.ts` (BE-15), the same way BE-15 mirrors BE-16's types:
 * neither module imports the other. Ids are decimal strings. A paper missing from the map was never started.
 */
export interface PaperProgress {
  attemptId?: string
  lastScore?: { score: number; max: number }
}

export interface BijakProgressSource {
  progressFor(userId: string, paperIds: readonly string[]): Promise<ReadonlyMap<string, PaperProgress>>
}

export interface BijakServedSource {
  servedQuestionIds(userId: string): Promise<ReadonlySet<string>>
}

/**
 * Student progress read from `exam_attempts` and `attempt_results`. Implements BE-15's two ports; it is
 * not bound to anything here (a later integration PR binds it).
 *
 * - "Latest attempt" of a paper: `started_at desc, id desc`. If that attempt is `in_progress`, its id is `attemptId`.
 * - `lastScore` comes from the latest attempt that HAS a result (submitted or graded), which may be an
 *   earlier attempt than the latest one (the port: "score of the latest submitted attempt"). No result, no `lastScore`.
 * - `is_test` attempts count: a user only ever reads their own rows, and a Mod Pelajar (is_test) user must see their own progress.
 * - Served questions: the question ids in the `composition` snapshot of every attempt of the user, any status.
 */
@Injectable()
export class BijakAttemptProgress implements BijakProgressSource, BijakServedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async progressFor(userId: string, paperIds: readonly string[]): Promise<ReadonlyMap<string, PaperProgress>> {
    const out = new Map<string, PaperProgress>()
    if (!isIdString(userId)) return out
    const ids = [...new Set(paperIds.filter(isIdString))]
    if (ids.length === 0) return out
    const uid = idFromString(userId)
    const pids = ids.map(idFromString)

    const [latest, scored] = await Promise.all([
      this.prisma.client.$queryRaw<{ paper_id: string; id: string; status: string }[]>`
        select distinct on (paper_id) paper_id::text as paper_id, id::text as id, status
          from exam_attempts
         where user_id = ${uid} and paper_id = any(${pids}::bigint[])
         order by paper_id, started_at desc, id desc`,
      this.prisma.client.$queryRaw<{ paper_id: string; score: string; max_score: string }[]>`
        select distinct on (a.paper_id) a.paper_id::text as paper_id, r.score::text as score, r.max_score::text as max_score
          from exam_attempts a
          join attempt_results r on r.attempt_id = a.id
         where a.user_id = ${uid} and a.paper_id = any(${pids}::bigint[])
         order by a.paper_id, a.started_at desc, a.id desc`,
    ])

    for (const row of latest) {
      out.set(row.paper_id, row.status === 'in_progress' ? { attemptId: row.id } : {})
    }
    for (const row of scored) {
      const score = Number(row.score)
      const max = Number(row.max_score)
      if (!Number.isFinite(score) || !Number.isFinite(max)) continue
      out.set(row.paper_id, { ...out.get(row.paper_id), lastScore: { score, max } })
    }
    return out
  }

  async servedQuestionIds(userId: string): Promise<ReadonlySet<string>> {
    if (!isIdString(userId)) return new Set()
    const rows = await this.prisma.client.$queryRaw<{ qid: string }[]>`
      select distinct q.qid
        from exam_attempts a
        cross join lateral jsonb_array_elements(case when jsonb_typeof(a.composition) = 'array' then a.composition else '[]'::jsonb end) s
        cross join lateral jsonb_array_elements_text(case when jsonb_typeof(s -> 'questionIds') = 'array' then s -> 'questionIds' else '[]'::jsonb end) as q(qid)
       where a.user_id = ${idFromString(userId)}`
    return new Set(rows.map((r) => r.qid))
  }
}
