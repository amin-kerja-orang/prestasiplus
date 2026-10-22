import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url))
/** PostgreSQL keeps 63 bytes of an identifier (NAMEDATALEN - 1) and silently truncates the rest (NOTICE only). */
const MAX_IDENTIFIER = 63
/** Known over-long names, each renamed by a later migration (never edit an applied migration). */
const RENAMED_LATER: Readonly<Record<string, string>> = {
  // AZ-22 (#61 m4): renamed by 0041_aggregate_school_index_name.
  ix_practice_attempt_aggregates_school_id_subject_code_submitted_at: '0018_aggregate_school_id',
}

/** Every quoted identifier longer than the limit in a migration, comments ignored. */
function overLong(sql: string): string[] {
  const code = sql.replace(/--.*$/gm, '')
  return [...code.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string).filter((id) => Buffer.byteLength(id, 'utf8') > MAX_IDENTIFIER)
}

describe('migration identifiers (AZ-22)', () => {
  const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  it('no migration names a table, column, index or constraint longer than 63 bytes, except the ones renamed later', () => {
    const found: string[] = []
    for (const m of migrations) {
      for (const id of overLong(readFileSync(join(MIGRATIONS_DIR, m, 'migration.sql'), 'utf8'))) {
        if (RENAMED_LATER[id] !== m) found.push(`${m}: ${id} (${String(Buffer.byteLength(id, 'utf8'))} bytes)`)
      }
    }
    expect(found).toEqual([])
  })

  it('every allowed over-long name exists in its migration and is renamed by a later one', () => {
    for (const [id, m] of Object.entries(RENAMED_LATER)) {
      expect(overLong(readFileSync(join(MIGRATIONS_DIR, m, 'migration.sql'), 'utf8')), m).toContain(id)
      const truncated = id.slice(0, MAX_IDENTIFIER)
      const later = migrations.filter((x) => x > m && readFileSync(join(MIGRATIONS_DIR, x, 'migration.sql'), 'utf8').includes(`ALTER INDEX "${truncated}" RENAME TO`))
      expect(later.length, id).toBeGreaterThan(0)
    }
  })
})
