import { assertSurrogateLegacyId } from './sql'
import { assertLegacySource, type LegacySource, type SqlExecutor } from './types'

/**
 * Lookup `(legacy_source, entity, legacy_id) -> new_id` over `etl_id_map` (plan 14.4). Loaders use
 * it to resolve foreign keys; the `legacy_*` columns of the target table stay the authority for
 * "is this row already loaded". Entries are cached in memory for the life of the instance.
 *
 * Bind it to the executor of the current batch (the transaction client), so a dry-run's entries
 * roll back with the rest of the dry-run.
 */
export class IdMap {
  private readonly cache = new Map<string, string>()

  constructor(
    private readonly db: SqlExecutor,
    readonly source: LegacySource,
  ) {
    assertLegacySource(source)
  }

  private key(entity: string, legacyId: string): string {
    return `${entity}\u0000${legacyId}`
  }

  /**
   * Registers `legacyId -> newId`. Registering the same pair again is a no-op; registering a
   * different `newId` for a known key throws (no guessing: that is a loader bug or source drift).
   */
  async register(entity: string, legacyId: string, newId: string | bigint | number): Promise<void> {
    await this.registerMany(entity, [[legacyId, newId]])
  }

  async registerMany(
    entity: string,
    pairs: Iterable<readonly [legacyId: string, newId: string | bigint | number]>,
  ): Promise<void> {
    const legacyIds: string[] = []
    const newIds: string[] = []
    for (const [legacyId, newId] of pairs) {
      assertSurrogateLegacyId(legacyId, 'IdMap.register')
      legacyIds.push(legacyId)
      newIds.push(String(newId))
    }
    if (legacyIds.length === 0) return
    const res = await this.db.query<{ legacy_id: string; new_id: string }>(
      `INSERT INTO etl_id_map (legacy_source, entity, legacy_id, new_id)
       SELECT $1::text, $2::text, v.legacy_id, v.new_id FROM unnest($3::text[], $4::text[]) AS v(legacy_id, new_id)
       ON CONFLICT (legacy_source, entity, legacy_id) DO UPDATE SET new_id = etl_id_map.new_id
       RETURNING legacy_id, new_id`,
      [this.source, entity, legacyIds, newIds],
    )
    const wanted = new Map<string, string>()
    legacyIds.forEach((id, i) => wanted.set(id, newIds[i] as string))
    for (const row of res.rows) {
      const expected = wanted.get(row.legacy_id)
      if (expected !== undefined && expected !== row.new_id) {
        throw new Error(
          `IdMap conflict for ${this.source}/${entity}/${row.legacy_id}: already mapped to a different id.`,
        )
      }
      this.cache.set(this.key(entity, row.legacy_id), row.new_id)
    }
  }

  /** The new id (text) or `null` when the parent was never loaded (the caller rejects ORPHAN_PARENT). */
  async resolve(entity: string, legacyId: string): Promise<string | null> {
    return (await this.resolveMany(entity, [legacyId])).get(legacyId) ?? null
  }

  /** Resolves many ids with one query; ids that are unknown are absent from the result. */
  async resolveMany(entity: string, legacyIds: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const missing: string[] = []
    for (const id of new Set(legacyIds)) {
      const hit = this.cache.get(this.key(entity, id))
      if (hit !== undefined) out.set(id, hit)
      else missing.push(id)
    }
    if (missing.length > 0) {
      const res = await this.db.query<{ legacy_id: string; new_id: string }>(
        `SELECT legacy_id, new_id FROM etl_id_map WHERE legacy_source = $1 AND entity = $2 AND legacy_id = ANY($3::text[])`,
        [this.source, entity, missing],
      )
      for (const row of res.rows) {
        this.cache.set(this.key(entity, row.legacy_id), row.new_id)
        out.set(row.legacy_id, row.new_id)
      }
    }
    return out
  }
}
