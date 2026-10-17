import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { gradePart } from '../domain/grading'
import type { PartAnswer } from '../domain/types'

function grade(
  partId: string,
  answer: PartAnswer | undefined,
  finals: Record<string, number | null> = {},
) {
  const scheme = BANK.schemes.get(partId)!
  const marks = scheme.marks
  const kind =
    scheme.kind === 'option'
      ? 'mcq'
      : partId.startsWith('sn2') && !partId.includes('laju')
        ? 'short_text'
        : 'working'
  return gradePart({
    part: { id: partId, label: '(a)', prompt: '', marks, kind },
    scheme,
    answer,
    ctx: { previousFinals: finals },
  })
}

describe('MCQ', () => {
  it('awards the mark by option identity', () => {
    const scheme = BANK.schemes.get('mat1-pecahan-v1')!
    if (scheme.kind !== 'option') throw new Error('mcq expected')
    expect(grade('mat1-pecahan-v1', { choice: scheme.correct }).awarded).toBe(1)
    const wrong = grade('mat1-pecahan-v1', { choice: 'mat1-pecahan-v1-oX' })
    expect(wrong.awarded).toBe(0)
    expect(wrong.status).toBe('salah')
    expect(grade('mat1-pecahan-v1', undefined).status).toBe('kosong')
  })
})

describe('structured working: K1 / N1 / P1 per point', () => {
  it('gives K1 and N1 for a correct method and answer', () => {
    const r = grade('mat2-segitiga-v1-q1-a', {
      steps: ['AC^2 = 12^2 + 5^2'],
      final: '13',
      unit: 'cm',
    })
    expect(r.points.map((p) => [p.code, p.hit])).toEqual([
      ['K', true],
      ['N', true],
    ])
    expect(r.awarded).toBe(2)
    expect(r.status).toBe('betul')
  })
  it('gives K1 only for a right method with an arithmetic slip', () => {
    const r = grade('mat2-segitiga-v1-q1-a', {
      steps: ['12^2 + 5^2 = 149'],
      final: '12.2',
      unit: 'cm',
    })
    expect(r.points.map((p) => p.hit)).toEqual([true, false])
    expect(r.awarded).toBe(1)
    expect(r.status).toBe('separa')
  })
  it('gives N1 for a bare correct answer without working', () => {
    const r = grade('mat2-segitiga-v1-q1-a', { final: '13' })
    expect(r.points[1]!.hit).toBe(true)
  })
  it('accepts equivalent factorised forms but not an expanded answer', () => {
    expect(grade('mat2-algebra-v1-a', { final: '3(x+2)(x-2)' }).awarded).toBe(2)
    const expanded = grade('mat2-algebra-v1-a', { final: '3x^2-12' })
    expect(expanded.points[1]!.hit).toBe(false)
    expect(expanded.points[1]!.reason).toContain('bentuk faktor')
  })
  it('accepts decimal / fraction / percent forms of the same number', () => {
    expect(grade('mat2-segitiga-v1-q2-b', { final: '0.923' }).points[1]!.hit).toBe(true)
    expect(grade('mat2-segitiga-v1-q2-b', { final: '\\frac{12}{13}' }).points[1]!.hit).toBe(true)
  })
  it('checks the unit as its own point (M3 in the Sains calculation)', () => {
    const ok = grade('sn2-laju-v1-a', { steps: ['600/40'], final: '15', unit: 'm/s' })
    expect(ok.awarded).toBe(3)
    const noUnit = grade('sn2-laju-v1-a', { steps: ['600/40'], final: '15' })
    expect(noUnit.awarded).toBe(2)
    expect(noUnit.points.find((p) => p.tag === 'M3')!.reason).toBe('Unit tidak ditulis.')
    const wrongUnit = grade('sn2-laju-v1-a', { final: '15', unit: 'km/j' })
    expect(wrongUnit.points.find((p) => p.tag === 'M3')!.reason).toBe('Unit tidak betul.')
  })
  it('carries the own figure forward (ECF) from an earlier part', () => {
    // (a) gave 10 instead of 12, so the sale price 80 - 10 = 70 is accepted for (b)
    const r = grade('mat2-diskaun-v1-b', { final: '70' }, { 'mat2-diskaun-v1-a': 10 })
    expect(r.awarded).toBe(1)
    expect(r.ecf).toContain('ECF')
    // without a matching earlier figure it stays wrong
    expect(grade('mat2-diskaun-v1-b', { final: '70' }, { 'mat2-diskaun-v1-a': 12 }).awarded).toBe(0)
    expect(grade('mat2-diskaun-v1-b', { final: '68' }, { 'mat2-diskaun-v1-a': 12 }).awarded).toBe(1)
  })
  it('never invents a mark for an empty answer', () => {
    const r = grade('mat2-diskaun-v1-a', undefined)
    expect(r.awarded).toBe(0)
    expect(r.status).toBe('kosong')
    expect(r.confidence).toBe('high')
  })
})

describe('low confidence is not an automatic zero', () => {
  it('flags an unreadable final answer for review', () => {
    const r = grade('mat2-segitiga-v1-q1-a', { final: 'lebih kurang tiga belas' })
    expect(r.status).toBe('belum_dimarkah')
    expect(r.confidence).toBe('low')
  })
  it('flags a photo-only answer for review', () => {
    const r = grade('mat2-segitiga-v1-q1-a', {
      photos: [{ key: 'k', name: 'kerja.jpg', size: 100 }],
    })
    expect(r.status).toBe('belum_dimarkah')
  })
  it('flags a long unmatched sentence for keyword parts, but a short wrong word is just wrong', () => {
    expect(
      grade('sn2-sel-q1-a', { text: 'Ia ialah bahagian yang mengawal semua aktiviti sel itu' })
        .status,
    ).toBe('belum_dimarkah')
    expect(grade('sn2-sel-q1-a', { text: 'ribosom' }).status).toBe('salah')
  })
  it('marks keyword points one by one', () => {
    const r = grade('sn2-osmosis-a', {
      text: 'Air melalui membran separa telap ke dalam sel hingga sel menjadi turgid.',
    })
    expect(r.points.filter((p) => p.hit).length).toBe(2)
    expect(r.awarded).toBe(2)
    expect(r.status).toBe('separa')
  })
})
