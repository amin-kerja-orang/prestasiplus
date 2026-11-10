/**
 * `inferKertas` / `kertasOfTitle` / `kertasOfCode` of the paper loader (rules `papers-3`, design 10.4a): the kertas of a V2 paper is never guessed.
 */
import { describe, expect, it } from 'vitest'

import { inferKertas, kertasOfCode, kertasOfTitle, type KertasEvidence } from '../../../src/migration/load/papers/plan'

const base: KertasEvidence = { raw: null, coverCode: null, title: 'Set Latihan', leafModes: ['mcq'], hasDocumentSection: false, objectiveK1: true, structuredKertas: [2] }
const ev = (over: Partial<KertasEvidence>): KertasEvidence => ({ ...base, ...over })

describe('kertasOfTitle', () => {
  it.each([
    ['Sejarah Kertas 2 Percubaan', 2],
    ['kertas 1', 1],
    ['SPM Paper 2', 2],
    ['Paper-3', 3],
    ['Matematik K1', 1],
    ['Fizik P2 2024', 2],
    ['Percubaan SPM 2024 Kertas 4', 4],
  ])('%s names kertas %i', (title, kertas) => {
    expect(kertasOfTitle(title)).toBe(kertas)
  })

  it.each([
    ['Kertas 1 dan 2'],
    ['Kertas 1 & 2'],
    ['K1/K2'],
    ['Paper 1 and Paper 2'],
    ['Kertas 1, 2'],
    ['Kertas 1 Kertas 2'],
  ])('%s names two kertas (many, never guessed)', (title) => {
    expect(kertasOfTitle(title)).toBe('many')
  })

  it.each([['Set Latihan Bab 3'], ['Kertas Percubaan'], ['1449/2'], ['Pak 2'], ['Kertas 12'], [''], [null], [undefined]])('%s names none', (title) => {
    expect(kertasOfTitle(title)).toBeNull()
  })
})

describe('kertasOfCode', () => {
  it('takes the last digit of a printed paper code', () => {
    expect(kertasOfCode('1449/2')).toBe(2)
    expect(kertasOfCode('1250 / 1')).toBe(1)
    expect(kertasOfCode('1449')).toBeNull()
    expect(kertasOfCode('1449/5')).toBeNull()
    expect(kertasOfCode(null)).toBeNull()
  })
})

describe('inferKertas', () => {
  it('uses the V2 kertas text first (`2`, `K2`, `Kertas 3`)', () => {
    expect(inferKertas(ev({ raw: '2' }))).toEqual({ kertas: 2, via: 'v2' })
    expect(inferKertas(ev({ raw: 'K3', title: 'Kertas 1' }))).toEqual({ kertas: 3, via: 'v2' })
    expect(inferKertas(ev({ raw: 'Kertas 4' }))).toEqual({ kertas: 4, via: 'v2' })
  })

  it('ignores a V2 kertas with no digit 1 to 4 and falls to the next rule', () => {
    expect(inferKertas(ev({ raw: 'khas', coverCode: '1449/2' }))).toEqual({ kertas: 2, via: 'cover_code' })
    expect(inferKertas(ev({ raw: '9', title: 'Kertas 2' }))).toEqual({ kertas: 2, via: 'title' })
  })

  it('reads the printed cover code (1449/2) when V2 has no kertas', () => {
    expect(inferKertas(ev({ coverCode: '1449/2' }))).toEqual({ kertas: 2, via: 'cover_code' })
    expect(inferKertas(ev({ coverCode: '1449/2', title: 'Sejarah Kertas 2' }))).toEqual({ kertas: 2, via: 'cover_code' })
  })

  it('a title that names another kertas than the cover code is a conflict', () => {
    expect(inferKertas(ev({ coverCode: '1449/2', title: 'Sejarah Kertas 1' }))).toEqual({ kertas: null, via: 'conflict' })
  })

  it('a title naming two kertas (Kertas 1 dan 2) is a conflict even with a cover code or a structure', () => {
    expect(inferKertas(ev({ title: 'Matematik Kertas 1 dan 2' }))).toEqual({ kertas: null, via: 'conflict' })
    expect(inferKertas(ev({ title: 'Kertas 1 dan 2', coverCode: '1449/2' }))).toEqual({ kertas: null, via: 'conflict' })
  })

  it('reads the title when it names exactly one kertas (K1, Paper 2)', () => {
    expect(inferKertas(ev({ title: 'Fizik K1' }))).toEqual({ kertas: 1, via: 'title' })
    expect(inferKertas(ev({ title: 'Biology Paper 2' }))).toEqual({ kertas: 2, via: 'title' })
  })

  it('a section with a Kertas Subjektif document makes a composite paper, undecided', () => {
    expect(inferKertas(ev({ hasDocumentSection: true }))).toEqual({ kertas: null, via: 'composite_document' })
    // the title still wins when it names a kertas
    expect(inferKertas(ev({ hasDocumentSection: true, title: 'Kertas 2' }))).toEqual({ kertas: 2, via: 'title' })
  })

  it('an MCQ-only paper is Kertas 1 when the subject Kertas 1 is objective', () => {
    expect(inferKertas(ev({ leafModes: ['mcq', 'mcq', 'mcq'], objectiveK1: true }))).toEqual({ kertas: 1, via: 'structure' })
    expect(inferKertas(ev({ leafModes: ['mcq'], objectiveK1: false }))).toEqual({ kertas: null, via: 'objective_k1_not_known' })
  })

  it('a paper with no questions, or a mix of MCQ and other modes, stays undecided', () => {
    expect(inferKertas(ev({ leafModes: [] }))).toEqual({ kertas: null, via: 'no_questions' })
    expect(inferKertas(ev({ leafModes: ['mcq', 'essay'] }))).toEqual({ kertas: null, via: 'mixed_modes' })
  })

  it('a structured or essay paper takes the one Kontrak kertas of the subject, else stays undecided', () => {
    expect(inferKertas(ev({ leafModes: ['essay', 'text'], structuredKertas: [2] }))).toEqual({ kertas: 2, via: 'structure' })
    expect(inferKertas(ev({ leafModes: ['essay'], structuredKertas: [2, 3] }))).toEqual({ kertas: null, via: 'structured_kertas_unclear' })
    expect(inferKertas(ev({ leafModes: ['essay'], structuredKertas: [] }))).toEqual({ kertas: null, via: 'structured_kertas_unclear' })
  })
})
