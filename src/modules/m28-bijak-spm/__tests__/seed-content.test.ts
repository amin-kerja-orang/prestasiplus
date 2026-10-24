import { describe, expect, it } from 'vitest'

import { BANK, BLUEPRINTS, PAPERS } from '../data/registry'

/** FB-053: the seed text must agree with the paper it describes (D11: counts are computed). */
describe('seed content', () => {
  it('the cover of every curated paper names the number of objective questions it really has', () => {
    for (const p of PAPERS) {
      const line = p.instructions.find((l) => /soalan objektif/.test(l))
      if (!line) continue
      const total = p.sections.reduce((n, s) => n + s.questionIds.length, 0)
      expect(line, p.id).toBe(`Kertas ini mengandungi ${total} soalan objektif.`)
    }
  })
  it('the Mat K1 contract says the same as the curated paper that was built from it', () => {
    const paper = PAPERS.find((p) => p.id === 'mat-k1-2025-a')!
    const bp = BLUEPRINTS.find((b) => b.subject === 'MAT' && b.kertas === 1)!
    expect(bp.instructions).toEqual(paper.instructions)
    const take = bp.sections.reduce((n, s) => n + s.take, 0)
    expect(take).toBe(paper.sections.reduce((n, s) => n + s.questionIds.length, 0))
  })
  it('no multiple-choice option shows an unrounded decimal (7.333333333333333)', () => {
    const offenders: string[] = []
    for (const q of BANK.questions.values()) {
      for (const o of q.mcq?.options ?? [])
        if (/\d+\.\d{5,}/.test(o.text)) offenders.push(`${q.id}: ${o.text}`)
    }
    expect(offenders).toEqual([])
  })
  it('Mat K1 "persamaan" wrong option is a fraction, not a float', () => {
    const q = BANK.questions.get('mat1-persamaan-v1')!
    const texts = (q.mcq?.options ?? []).map((o) => o.text)
    expect(texts).toContain('$x = \\frac{22}{3}$')
  })
})
