// Unit tests of the E2E trace parser and rules (`scripts/lib/e2e-trace.mjs`), fed by the SRS
// fixtures in `./fixtures` (one per §12 table form).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { checkTrace, isApprovedStatus, parseSrs, splitRow } from '../e2e-trace.mjs'

const fixture = (name) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')

const parse = (name) => parseSrs(fixture(name), { file: name, module: name.slice(1, 3) })

const levels = (parsed) => Object.fromEntries(parsed.ids.map((r) => [r.id, r.provisional]))

describe('isApprovedStatus', () => {
  it.each([
    ['| Status | Approved (G1) |', true],
    ['| Status | **Approved (G1)** — v1.2 |', true],
    ['| Status | Approved (G1). v1.2 = alignment |', true],
    ['| Status | Not approved — draft for G1 |', false],
    ['| Status | Draft — for independent audit (AUD) and G1 |', false],
    ['| Status | Pending; will be Approved later |', false],
    ['| Version | 1.0 |', false],
  ])('%s → %s', (line, expected) => {
    expect(isApprovedStatus(`# Doc\n\n${line}\n`)).toBe(expected)
  })
})

describe('splitRow', () => {
  it('trims cells and keeps escaped pipes', () => {
    expect(splitRow('| a | b \\| c |  |')).toEqual(['a', 'b \\| c', ''])
  })
})

describe('parseSrs: table without a provisional column (scenario markers)', () => {
  const parsed = parse('M91-marker.md')

  it('reads the ids of the §12 scenario table only', () => {
    expect(parsed.approved).toBe(true)
    expect(parsed.ids.map((r) => r.id)).toEqual([
      'E2E-M91-01',
      'E2E-M91-02',
      'E2E-M91-03',
      'E2E-M91-04',
      'E2E-M91-05',
    ])
    expect(parsed.errors).toEqual([])
  })

  it('classifies full, partial and none from the scenario text', () => {
    expect(levels(parsed)).toEqual({
      'E2E-M91-01': 'none',
      'E2E-M91-02': 'full',
      'E2E-M91-03': 'full',
      'E2E-M91-04': 'partial',
      'E2E-M91-05': 'none',
    })
  })

  it('records the SRS line of each id', () => {
    const lines = fixture('M91-marker.md').split(/\r?\n/)
    for (const row of parsed.ids) expect(lines[row.line - 1]).toContain(row.id)
  })
})

describe('parseSrs: "Provisional" column', () => {
  const parsed = parse('M92-column.md')

  it('uses the column: "yes…" is full, empty or "no" is none, the text marker is ignored', () => {
    expect(levels(parsed)).toEqual({
      'E2E-M92-01': 'none',
      'E2E-M92-02': 'full',
      'E2E-M92-03': 'none',
      'E2E-M92-04': 'full',
      'E2E-M92-05': 'none',
      'E2E-M92-06': 'full',
      'E2E-M92-07': 'none',
    })
  })

  it('warns on an unrecognised provisional cell', () => {
    expect(parsed.warnings).toEqual([expect.stringMatching(/^S4 .*E2E-M92-07.*"maybe"/)])
    expect(parsed.errors).toEqual([])
  })
})

describe('parseSrs: "E2E" id header and "Prov." column', () => {
  it('finds the short column name', () => {
    const parsed = parse('M93-prov-short.md')
    expect(levels(parsed)).toEqual({ 'E2E-M93-01': 'none', 'E2E-M93-02': 'full' })
    expect(parsed.errors).toEqual([])
  })
})

describe('parseSrs: id-cell suffixes and bad id cells', () => {
  const parsed = parse('M94-id-suffix.md')

  it('does not treat "Not approved" as approved', () => {
    expect(parsed.approved).toBe(false)
    expect(parsed.ids.every((r) => r.approved === false)).toBe(true)
  })

  it('reads ids with a suffix; an @provisional or "provisional" suffix is full', () => {
    expect(levels(parsed)).toEqual({
      'E2E-M94-01': 'none',
      'E2E-M94-02': 'full',
      'E2E-M94-03': 'full',
    })
  })

  it('reports unparsable id cells, duplicates and foreign ids', () => {
    expect(parsed.errors).toEqual([
      expect.stringMatching(/^S2 .*"E2E-M94 -04"/),
      expect.stringMatching(/^S2 .*"see E2E-M94-05"/),
      expect.stringMatching(/^S1 .*E2E-M94-01 is defined twice/),
    ])
    expect(parsed.warnings).toEqual([expect.stringMatching(/^S3 .*E2E-M95-01/)])
  })
})

describe('checkTrace', () => {
  const srs = new Map(
    [...parse('M91-marker.md').ids, ...parse('M92-column.md').ids].map((r) => [r.id, r]),
  )
  const test = (title, tags = [], provisionalReason = null) => ({
    key: title,
    title,
    file: 'm91/x.spec.ts',
    line: 1,
    tags: new Set(tags),
    provisionalReason,
  })
  const codes = (list) => list.map((e) => e.slice(0, 2)).sort()

  it('passes with no traced tests and counts every module as not started', () => {
    const result = checkTrace({ srs, tests: [test('smoke without ids', ['smoke'])] })
    expect(result.errors).toEqual([])
    expect(result.started.size).toBe(0)
    expect(result.notStarted).toBe(srs.size)
  })

  it('starts a module only when one of its ids is traced, and then requires all of them', () => {
    const result = checkTrace({ srs, tests: [test('E2E-M91-01 ok', ['m91'])] })
    expect([...result.started]).toEqual(['91'])
    expect(result.missing).toBe(4)
    expect(result.notStarted).toBe(7)
    expect(codes(result.errors)).toEqual(['T3', 'T3', 'T3', 'T3'])
  })

  it('--all checks every approved module', () => {
    const result = checkTrace({ srs, tests: [], all: true })
    expect(result.missing).toBe(srs.size)
  })

  it('reports T1, T2, T4, P1, P2, P3 and W1', () => {
    const result = checkTrace({
      srs,
      all: false,
      tests: [
        test('E2E-M91-99 unknown', ['m91']),
        test('E2E-M91-01 first', ['m91']),
        test('E2E-M91-01 second', ['m91']),
        test('E2E-M92-01 no module tag', []),
        test('E2E-M92-02 provisional row untagged', ['m92']),
        test('E2E-M92-03 tagged without reason', ['m92', 'provisional']),
        test('E2E-M91-04 partial untagged', ['m91']),
        test('E2E-M91-02 provisional ok', ['m91', 'provisional'], 'pending LS-1'),
      ],
    })
    const nonMissing = result.errors.filter((e) => !e.startsWith('T3'))
    expect(codes(nonMissing)).toEqual(['P1', 'P2', 'P3', 'T1', 'T2', 'T4'])
    expect(codes(result.warnings)).toEqual(['W1'])
  })
})
