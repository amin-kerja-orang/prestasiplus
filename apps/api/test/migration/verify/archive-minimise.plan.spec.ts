/**
 * The minimisation plan (PDPA) names only columns that exist in the archive spec, and every person column of the
 * archive spec is in the plan. A renamed source column therefore fails here instead of silently leaving person data.
 */
import { describe, expect, it } from 'vitest'

import { ARCHIVE_SCHEMA, findTable, TABLES } from '../../../src/migration/ddl/spec'
import { MINIMISE_PLAN } from '../../../src/migration/export/archive-minimise'

describe('MINIMISE_PLAN against the staging spec', () => {
  it('names only archive tables and columns that the spec has', () => {
    expect(ARCHIVE_SCHEMA).toBe('archive_cloud')
    for (const p of MINIMISE_PLAN) {
      const t = findTable(p.table)
      expect(t?.group, p.table).toBe('archive')
      for (const c of p.columns) expect(t?.columns.map((x) => x.name), `${p.table}.${c}`).toContain(c)
    }
  })

  it('covers every archive column that is a foreign key to users (the person columns)', () => {
    const planned = new Set(MINIMISE_PLAN.flatMap((p) => p.columns.map((c) => `${p.table}.${c}`)))
    const persons = TABLES.filter((t) => t.group === 'archive').flatMap((t) => t.columns.filter((c) => c.fk === 'users').map((c) => `${t.name}.${c.name}`))
    expect(persons.length).toBeGreaterThan(0)
    for (const x of persons) expect(planned.has(x), x).toBe(true)
  })
})
