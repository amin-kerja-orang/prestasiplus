/**
 * Pure parts of `migrate:verify` and the rollback: the delete order of the foreign-key graph, the generated SQL, and the
 * report rendering. No database.
 */
import { describe, expect, it } from 'vitest'

import { orphanSql } from '../../../src/migration/verify/checks'
import { deleteOrder, readMigratableList, type ForeignKey } from '../../../src/migration/verify/fk-graph'
import { renderVerifyMarkdown, stampOf } from '../../../src/migration/verify/render'
import { pinnedPredicate } from '../../../src/migration/verify/rollback'
import type { VerifyReport } from '../../../src/migration/verify'

const fk = (child: string, parent: string, cols = ['x_id'], parentCols = ['id']): ForeignKey => ({
  name: `fk_${child}_${parent}`,
  child,
  parent,
  childCols: cols,
  parentCols,
  onDelete: 'c',
  deferrable: false,
})

describe('deleteOrder', () => {
  it('puts every child before its parents', () => {
    const { order, cyclic } = deleteOrder(
      ['users', 'schools', 'enrolments', 'classrooms', 'jpns'],
      [fk('users', 'schools'), fk('enrolments', 'classrooms'), fk('enrolments', 'users'), fk('classrooms', 'schools'), fk('schools', 'jpns')],
    )
    expect(cyclic).toEqual([])
    expect(order).toHaveLength(5)
    const at = (t: string) => order.indexOf(t)
    expect(at('enrolments')).toBeLessThan(at('classrooms'))
    expect(at('enrolments')).toBeLessThan(at('users'))
    expect(at('users')).toBeLessThan(at('schools'))
    expect(at('classrooms')).toBeLessThan(at('schools'))
    expect(at('schools')).toBeLessThan(at('jpns'))
  })

  it('is deterministic whatever the input order', () => {
    const fks = [fk('b', 'a'), fk('c', 'a'), fk('d', 'b')]
    expect(deleteOrder(['a', 'b', 'c', 'd'], fks)).toEqual(deleteOrder(['d', 'c', 'b', 'a'], [...fks].reverse()))
  })

  it('reports a self-reference as cyclic and still orders the table against its parent', () => {
    const self = fk('users', 'users', ['created_by_id'])
    const { order, cyclic } = deleteOrder(['users', 'user_roles'], [self, fk('user_roles', 'users')])
    expect(cyclic).toEqual([self])
    expect(order).toEqual(['user_roles', 'users'])
  })

  it('groups a loop between tables and orders the groups around it', () => {
    const { order, cyclic } = deleteOrder(['a', 'b', 'leaf', 'root'], [fk('a', 'b'), fk('b', 'a'), fk('leaf', 'a'), fk('b', 'root')])
    expect(cyclic.map((f) => f.name).sort()).toEqual(['fk_a_b', 'fk_b_a'])
    expect(order.indexOf('leaf')).toBeLessThan(order.indexOf('a'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('root'))
  })

  it('ignores foreign keys that leave the set', () => {
    const { order, cyclic } = deleteOrder(['a', 'b'], [fk('a', 'outside'), fk('outside', 'b')])
    expect(order).toEqual(['a', 'b'])
    expect(cyclic).toEqual([])
  })
})

describe('generated SQL', () => {
  it('orphanSql tests every column of a composite key and skips a NULL reference', () => {
    const sql = orphanSql(fk('child', 'parent', ['p_a', 'p_b'], ['a', 'b']))
    expect(sql).toContain('c.legacy_source = $1')
    expect(sql).toContain('c."p_a" IS NOT NULL AND c."p_b" IS NOT NULL')
    expect(sql).toContain('p."a" = c."p_a" AND p."b" = c."p_b"')
    expect(sql).toContain('NOT EXISTS')
  })

  it('pinnedPredicate looks only at migrated parents and the given child rows', () => {
    const sql = pinnedPredicate(fk('child', 'parent'), 'c.legacy_source IS DISTINCT FROM $1')
    expect(sql).toContain('p.legacy_source = $1')
    expect(sql).toContain('c.legacy_source IS DISTINCT FROM $1')
    expect(sql).toContain('c."x_id" = p."id"')
  })

  it('refuses an identifier that is not lower-case snake_case', () => {
    expect(() => orphanSql(fk('child; drop table x', 'parent'))).toThrow(/Invalid SQL identifier/)
  })
})

describe('migratable list', () => {
  it('reads the real list, sorted', () => {
    const list = readMigratableList()
    expect(list).toContain('users')
    expect(list).toContain('practice_answers')
    expect([...list].sort()).toEqual(list)
  })
})

describe('report rendering', () => {
  const report: VerifyReport = {
    generatedAt: '2026-06-01T10:15:30.123Z',
    source: 'cloud',
    runIds: ['2', '4'],
    status: 'fail',
    entities: [
      { entity: 'users', stagingTable: 'users', targetTable: 'users', sourceCount: 3, eligibleCount: 3, loaded: 2, rejected: 1, expectedDelta: 0, targetCount: 2, deletedAtSource: 1, status: 'ok' },
      { entity: 'x', stagingTable: null, targetTable: 'x', sourceCount: 0, eligibleCount: 0, loaded: 0, rejected: 0, expectedDelta: 0, targetCount: null, status: 'not-run', note: 'a | b\nc' },
    ],
    checks: [{ name: 'a|b', kind: 'counts', expected: 1, actual: 2, status: 'mismatch' }],
  }

  it('has the entity table with the card columns and keeps a pipe from breaking a row', () => {
    const md = renderVerifyMarkdown(report)
    expect(md).toContain('| Entity | Staging table | Target | Source | Eligible | Loaded | Rejected | Expected delta | Target count | Deleted at source | Status |')
    expect(md).toContain('| users | users | users | 3 | 3 | 2 | 1 | 0 | 2 | 1 | ok |')
    expect(md).toContain('Status: FAIL')
    expect(md).toMatch(/- x: a\s+b c/)
    expect(md).toContain('| a b | counts | 1 | 2 | mismatch |')
  })

  it('stamps the file name yyyymmddHHMMss', () => {
    expect(stampOf(report.generatedAt)).toBe('20260601101530')
  })
})
