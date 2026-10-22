/**
 * Shared state of one `migrate:core` run: the options, the report notes (counts and ids only, never
 * values) and the cached read of the schools' geography.
 */
import type pg from 'pg'

import { STAGING_SCHEMA } from '../ddl/spec'
import type { LegacySource } from '../kit/types'
import { buildGeo, type Geo } from '../transform/reference'
import { IcHasher, parseDefaultHashes, type ResetReason } from '../transform/secrets'

export interface CoreOptions {
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  source: LegacySource
  /** The run date (`YYYY-MM-DD`) used to decide a subscription's status. */
  asOf: string
  /** Rows read per keyset page; also bounds memory of the extract. */
  pageSize?: number
}

/** Report extras of a run: counts and surrogate ids only (BE-NFR-11). */
export class CoreNotes {
  readonly counters = new Map<string, number>()
  readonly ids = new Map<string, string[]>()

  count(name: string, n = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + n)
  }

  /** Remembers a surrogate id (never a name, e-mail or IC). */
  addId(name: string, id: string): void {
    const list = this.ids.get(name) ?? []
    list.push(id)
    this.ids.set(name, list)
    this.count(name)
  }

  resetReason(reasons: readonly ResetReason[]): void {
    for (const r of reasons) if (r !== 'none') this.count(`must_reset.${r}`)
  }
}

export class CoreContext {
  readonly notes = new CoreNotes()
  readonly ic: IcHasher
  readonly defaultHashes: ReadonlySet<string>
  private geoCache: Promise<Geo> | null = null

  constructor(readonly options: CoreOptions) {
    this.ic = new IcHasher(options.env)
    this.defaultHashes = parseDefaultHashes(options.env.PP_MIGRATE_ROSTER_DEFAULT_HASHES)
  }

  get pool(): pg.Pool {
    return this.options.pool
  }

  get source(): LegacySource {
    return this.options.source
  }

  get pageSize(): number {
    return this.options.pageSize ?? 1000
  }

  /** JPN / PPD derived from the distinct (state, district) of the staged schools. Read once per run. */
  geo(): Promise<Geo> {
    this.geoCache ??= this.pool
      .query<{ state: string | null; district: string | null; n: number }>(
        `SELECT nullif(btrim(regexp_replace(state, '\\s+', ' ', 'g')), '') AS state,
                nullif(btrim(regexp_replace(district, '\\s+', ' ', 'g')), '') AS district,
                count(*)::int AS n
         FROM "${STAGING_SCHEMA}"."schools" GROUP BY 1, 2`,
      )
      .then((res) => buildGeo(res.rows))
    return this.geoCache
  }
}
