/**
 * X-4 / M-3: the explained-reject list in docs/ops/sql/smoke-readonly.sql (block X3, `rej_explained`) mirrors what migrate:verify explains.
 * The tuples between the EXPLAINED-KEYS markers must equal EXPLAINED_REJECT_KEYS (bank-checks.ts) plus the explicit extras below. Pure text test,
 * no database.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { EXPLAINED_REJECT_KEYS } from '../../../src/migration/verify/bank-checks'

const SQL_PATH = resolve(__dirname, '../../../../../docs/ops/sql/smoke-readonly.sql')

/**
 * Keys inside the marked tuple list that are NOT bank-checks reasons. Each one needs a reason. Empty today: the other explained rejects of X3
 * (DUPLICATE_KEY, ORPHAN_PARENT on a person column, coin_ledger INVALID_VALUE on amount) are rule clauses outside the markers, pinned below.
 */
const EXTRA_NON_BANK_KEYS: readonly string[] = []

function markedKeys(sql: string): string[] {
  const m = /--\s*EXPLAINED-KEYS-BEGIN\r?\n([\s\S]*?)--\s*EXPLAINED-KEYS-END/.exec(sql)
  if (m === null) throw new Error('smoke-readonly.sql has no EXPLAINED-KEYS-BEGIN / EXPLAINED-KEYS-END markers')
  const body = m[1]!
  const keys = [...body.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([A-Z_]+)'\s*,\s*'([A-Za-z_.]*)'\s*\)/g)].map((t) => `${t[1]}|${t[2]}|${t[3]}`)
  // Nothing but tuples, commas and blanks may sit between the markers (a malformed tuple must not be skipped silently).
  const rest = body.replace(/\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*\)/g, '').replace(/[\s,]/g, '')
  if (rest !== '') throw new Error(`unparsed text between the markers: ${rest}`)
  return keys
}

describe('smoke-readonly.sql X3 explained reject keys', () => {
  const sql = readFileSync(SQL_PATH, 'utf8')

  it('equals EXPLAINED_REJECT_KEYS plus the explicit extras, with no duplicates', () => {
    const keys = markedKeys(sql)
    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual([...EXPLAINED_REJECT_KEYS, ...EXTRA_NON_BANK_KEYS].sort())
  })

  it('has no wildcard key in verify and none in the SQL', () => {
    expect(EXPLAINED_REJECT_KEYS.filter((k) => k.includes('*'))).toEqual([])
    expect(markedKeys(sql).filter((k) => k.includes('*'))).toEqual([])
  })

  it('still carries the rule clauses outside the markers', () => {
    expect(sql).toContain("reason = 'DUPLICATE_KEY'")
    expect(sql).toContain("reason = 'ORPHAN_PARENT'")
    expect(sql).toContain("entity = 'coin_ledger' AND reason = 'INVALID_VALUE' AND col = 'amount'")
  })
})
