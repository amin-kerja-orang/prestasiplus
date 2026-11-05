import { describe, expect, it } from 'vitest'

import { checkLevelRows, checkPicker, hardCodedLevelLines, parseArgs, type LevelRow } from '../../scripts/uat-ops/check-levels'

/** S4-T05 U-OP-03 check (DM-12 / DM-13): pure checks, in-memory fixtures (no DB row can hold an active Darjah any more). */
const level = (code: string, stage: LevelRow['stage'], isActive: boolean): LevelRow => ({ code, stage, is_active: isActive })
const tingkatan = [1, 2, 3].map((n) => level(`T${String(n)}`, 'lower_secondary', true)).concat([4, 5].map((n) => level(`T${String(n)}`, 'upper_secondary', true)))
const darjah = (active: boolean) => [1, 2, 3, 4, 5, 6].map((n) => level(`D${String(n)}`, 'primary', active))

describe('check-levels (S4-T05, U-OP-03)', () => {
  it('the 11-level UAT shape fails both checks and names the Darjah codes', () => {
    const lines = checkLevelRows([...darjah(true), ...tingkatan])
    expect(lines.map((l) => l.status)).toEqual(['FAIL', 'PASS'])
    expect(lines[0]!.text).toContain('D1, D2, D3, D4, D5, D6')
  })

  it('after U-OP-03 (Darjah inactive) both checks pass; an inactive Tingkatan makes the count fail', () => {
    expect(checkLevelRows([...darjah(false), ...tingkatan]).map((l) => l.status)).toEqual(['PASS', 'PASS'])
    const t5Off = [...darjah(false), ...tingkatan.map((l) => (l.code === 'T5' ? { ...l, is_active: false } : l))]
    expect(checkLevelRows(t5Off)[1]).toEqual({ status: 'FAIL', text: 'public Tahap count = 4, expected 5' })
  })

  it('the picker check fails on a primary level or a body without data', () => {
    expect(checkPicker({ data: [{ code: 'T1', stage: 'lower_secondary' }] }).status).toBe('PASS')
    expect(checkPicker({ data: [{ code: 'D1', stage: 'primary' }] })).toEqual({ status: 'FAIL', text: 'GET /api/education-levels returns primary levels: D1' })
    expect(checkPicker({}).status).toBe('FAIL')
  })

  it('reports the frozen level lists as INFO only, never FAIL', () => {
    const lines = hardCodedLevelLines(new URL('../../../..', import.meta.url).pathname)
    expect(lines).toHaveLength(4)
    expect(lines.every((l) => l.status === 'INFO')).toBe(true)
  })

  it('is read-only: --apply and unknown arguments are refused', () => {
    expect(parseArgs([])).toEqual({ apiUrl: null })
    expect(parseArgs(['--api-url', 'https://contoh.invalid/'])).toEqual({ apiUrl: 'https://contoh.invalid' })
    expect(() => parseArgs(['--apply'])).toThrow(/read-only/)
    expect(() => parseArgs(['--x'])).toThrow(/unknown/)
  })
})
