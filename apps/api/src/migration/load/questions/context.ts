/**
 * Shared state of one `migrate:questions` run (QLOAD): options, report notes (counts only, never values) and the
 * curriculum lookups, read once per run (a few thousand ids at most: curriculum, not questions).
 */
import type pg from 'pg'

import type { LegacySource } from '../../kit/types'
import type { Curriculum } from '../../transform/question-bank'
import { CoreNotes } from '../context'

export interface QuestionsOptions {
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  source: Extract<LegacySource, 'cloud'>
  /** Only for the `migrate:core` preflight (the date core ran with). */
  asOf: string
  /** Rows read per keyset page, also the batch size; default 1,000. */
  pageSize?: number
  /** Progress line (counts only) every 50 batches. */
  progress?: (line: string) => void
}

export class QuestionsContext {
  readonly notes = new CoreNotes()
  private cache: Promise<Curriculum> | null = null

  constructor(readonly options: QuestionsOptions) {}

  get pool(): pg.Pool {
    return this.options.pool
  }

  get source(): LegacySource {
    return this.options.source
  }

  get pageSize(): number {
    return this.options.pageSize ?? 1000
  }

  /** Id maps of `migrate:core` (subjects, levels, chapters, topics), level codes and the topic -> chapter link. */
  curriculum(): Promise<Curriculum> {
    this.cache ??= this.readCurriculum()
    return this.cache
  }

  private async readCurriculum(): Promise<Curriculum> {
    const map = async (entity: string): Promise<Map<string, string>> => {
      const res = await this.pool.query<{ legacy_id: string; new_id: string }>(
        `SELECT legacy_id, new_id FROM etl_id_map WHERE legacy_source = $1 AND entity = $2`,
        [this.source, entity],
      )
      return new Map(res.rows.map((r) => [r.legacy_id, r.new_id]))
    }
    const [subjects, levels, chapters, topics] = await Promise.all([map('subjects'), map('education_levels'), map('chapters'), map('topics')])
    const codes = await this.pool.query<{ id: string; code: string }>(`SELECT id::text AS id, code FROM education_levels`)
    const links = await this.pool.query<{ id: string; chapter_id: string }>(
      `SELECT id::text AS id, chapter_id::text AS chapter_id FROM topics WHERE chapter_id IS NOT NULL`,
    )
    return {
      subjects,
      levels,
      chapters,
      topics,
      levelCodes: new Map(codes.rows.map((r) => [r.id, r.code])),
      topicChapter: new Map(links.rows.map((r) => [r.id, r.chapter_id])),
    }
  }
}
