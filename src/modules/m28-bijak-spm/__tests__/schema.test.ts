import { describe, expect, it } from 'vitest'

import { BANK, PAPERS } from '../data/registry'
import { ecfExpected, gradePart } from '../domain/grading'
import { effectiveMarks, leavesOf } from '../domain/paper-model'
import type { PartAnswer, PointDef, SchemeDef } from '../domain/types'
import { BijakServer, MemoryStorage } from '../server/store'

function grade(
  partId: string,
  kind: Parameters<typeof gradePart>[0]['part']['kind'],
  answer: PartAnswer | undefined,
  scheme: SchemeDef = BANK.schemes.get(partId)!,
  finals: Record<string, number | null> = {},
) {
  return gradePart({
    part: { id: partId, label: '(a)', prompt: '', marks: scheme.marks, kind },
    scheme,
    answer,
    ctx: { previousFinals: finals },
  })
}

const questionMarks = (qid: string): number => {
  const q = BANK.questions.get(qid)!
  return q.mcq
    ? (BANK.schemes.get(q.id)?.marks ?? 1)
    : leavesOf(q.parts ?? []).reduce((n, l) => n + l.marks, 0)
}

describe('paper sections follow the approved blueprint model', () => {
  it('every section declares its mark budget and question count, and they match the content', () => {
    for (const p of PAPERS) {
      for (const s of p.sections) {
        expect(s.questionCount, `${p.id} ${s.label} count`).toBe(s.questionIds.length)
        const effective = effectiveMarks(s.rule, s.questionIds.map(questionMarks))
        expect(s.markBudget, `${p.id} ${s.label} budget`).toBe(effective)
        if (s.rule.type === 'choose') expect(s.rule.n).toBeLessThanOrEqual(s.questionCount)
      }
      expect(p.durationMin).toBeGreaterThan(0)
    }
  })

  it('Matematik K2 has Bahagian A, B and C, with "choose 1 of 2" of equal marks in C', () => {
    const k2 = PAPERS.find((p) => p.id === 'mat-k2-2025-a')!
    expect(k2.sections.map((s) => [s.label, s.rule.type])).toEqual([
      ['Bahagian A', 'all'],
      ['Bahagian B', 'all'],
      ['Bahagian C', 'choose'],
    ])
    const c = k2.sections[2]!
    expect(c.rule).toEqual({ type: 'choose', n: 1 })
    expect(c.questionCount).toBe(2)
    expect(new Set(c.questionIds.map(questionMarks)).size).toBe(1)
  })

  it('shows the section rule on the cover, with the question count', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const cover = await server.getCover(5, 'mat-k2-2025-a')
    const c = cover.sections[2]!
    expect(c).toMatchObject({
      label: 'Bahagian C',
      instruction: 'Jawab 1 daripada 2 soalan.',
      questionCount: 2,
      chooseN: 1,
      compulsory: false,
    })
  })

  it('every question carries a curriculum tag (no free-text topic); T1-T3 Matematik has unit null', () => {
    for (const q of BANK.questions.values()) {
      expect(q.curriculum.subject).toBeTruthy()
      expect(q.curriculum.tp).toBeGreaterThanOrEqual(1)
      expect('topic' in q).toBe(false)
      if (q.curriculum.formOrigin === 'T1-T3') expect(q.curriculum.unit).toBeNull()
    }
    expect(BANK.questions.get('mat1-pecahan-v1')!.curriculum).toMatchObject({
      subject: 'MAT',
      formOrigin: 'T1-T3',
      unit: null,
    })
    expect(BANK.questions.get('mat1-kebarangkalian-v1')!.curriculum.formOrigin).toBe('T5')
  })
})

describe('answer-key kinds', () => {
  it('option: MCQ by option identity', () => {
    const s = BANK.schemes.get('mat1-pecahan-v1')!
    expect(s.kind).toBe('option')
  })

  it('accepted: a numeric one-mark part', () => {
    const id = 'mat2-garis-v1-a'
    expect(BANK.schemes.get(id)!.kind).toBe('accepted')
    expect(grade(id, 'numeric', { final: '2' }).awarded).toBe(1)
    expect(grade(id, 'numeric', { final: '4/2' }).awarded).toBe(1)
    expect(grade(id, 'numeric', { final: '3' }).awarded).toBe(0)
    expect(grade(id, 'numeric', { final: 'sangat banyak' }).status).toBe('belum_dimarkah')
    expect(grade(id, 'numeric', undefined).status).toBe('kosong')
  })

  it('accepted: short text compares normalised words and tolerance and unit', () => {
    const scheme: SchemeDef = { kind: 'accepted', marks: 1, values: [{ v: 'Benar' }] }
    expect(grade('t', 'short_text', { text: ' benar ' }, scheme).awarded).toBe(1)
    expect(grade('t', 'short_text', { text: 'salah' }, scheme).awarded).toBe(0)
    const num: SchemeDef = {
      kind: 'accepted',
      marks: 1,
      values: [{ v: '5.3', tol: 0.05, unit: 'cm' }],
    }
    expect(grade('n', 'numeric', { final: '5.32', unit: 'cm' }, num).awarded).toBe(1)
    expect(grade('n', 'numeric', { final: '5.32', unit: 'm' }, num).awarded).toBe(0)
    expect(grade('n', 'numeric', { final: '5.5', unit: 'cm' }, num).awarded).toBe(0)
  })

  it('mapping: match_letter items share one bank and score per item', () => {
    expect(BANK.groups.get('sej2-bahan2')!.optionBank).toHaveLength(5)
    expect(grade('sej2-q2-a', 'match_letter', { choice: 'B' }).awarded).toBe(1)
    expect(grade('sej2-q2-a', 'match_letter', { choice: 'A' }).awarded).toBe(0)
    expect(grade('sej2-q2-c', 'match_letter', { choice: 'D' }).awarded).toBe(1)
    const r = grade('sej2-q2-b', 'match_letter', { choice: 'E' })
    expect(r.scheme.correctLetter).toBe('C')
    expect(r.status).toBe('salah')
  })

  it('rubric: an essay is never auto-marked and reveals the bands only in the result', () => {
    const r = grade('sej2-q3-a', 'essay', {
      text: 'Perlembagaan menjadi asas undang-undang negara.',
    })
    expect(r.awarded).toBe(0)
    expect(r.status).toBe('belum_dimarkah')
    expect(r.confidence).toBe('low')
    expect(r.scheme.rubric!.bands.map((b) => b.name)).toEqual([
      'Cemerlang',
      'Baik',
      'Sederhana',
      'Lemah',
    ])
    expect(grade('sej2-q3-a', 'essay', undefined).status).toBe('kosong')
  })

  it('points: a drawing is a photo plus a teacher checklist (manual points)', () => {
    const points: PointDef[] = [
      { id: 'd1', code: 'P', marks: 1, label: 'Garis lurus dilukis', match: { type: 'manual' } },
      {
        id: 'd2',
        code: 'P',
        marks: 1,
        label: 'Lengkung melalui titik diberi',
        match: { type: 'manual' },
      },
    ]
    const scheme: SchemeDef = { kind: 'points', marks: 2, points }
    const r = grade(
      'draw',
      'drawing',
      { photos: [{ key: 'k', name: 'graf.jpg', size: 10 }] },
      scheme,
    )
    expect(r.status).toBe('belum_dimarkah')
    expect(r.points.every((p) => p.manual && !p.hit)).toBe(true)
    expect(r.points.map((p) => p.tag)).toEqual(['P1', 'P2'])
    expect(grade('draw', 'drawing', undefined, scheme).status).toBe('kosong')
  })
})

describe('mark-point letters follow the subject (Q-S3)', () => {
  it('Matematik uses K and N, Sains uses M, Sejarah uses F and C, with sequence tags', () => {
    const mat = grade('mat2-segitiga-v1-q1-a', 'working', { final: '13', unit: 'cm' })
    expect(mat.points.map((p) => p.tag)).toEqual(['K1', 'N1'])
    const sains = grade('sn2-laju-v1-a', 'working', { steps: ['600/40'], final: '15', unit: 'm/s' })
    expect(sains.points.map((p) => p.tag)).toEqual(['M1', 'M2', 'M3'])
    const f = grade('sej2-q1-a', 'short_text', { text: 'Ada rundingan dan pilihan raya.' })
    expect(f.points.map((p) => p.tag)).toEqual(['F1', 'F2', 'F3', 'F4'])
    const c = grade('sej2-q1-b', 'short_text', { text: 'x' })
    expect(c.points.map((p) => p.tag)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
  })

  it('explicit marks are independent of the tag digit', () => {
    const scheme: SchemeDef = {
      kind: 'points',
      marks: 3,
      points: [
        {
          id: 'a',
          code: 'M',
          marks: 2,
          label: 'gantian',
          match: { type: 'step', accept: ['2*3'] },
        },
        { id: 'b', code: 'M', marks: 1, label: 'jawapan', match: { type: 'final' } },
      ],
      final: { accept: ['6'], display: '6' },
    }
    const r = grade('m', 'working', { steps: ['2*3'], final: '6' }, scheme)
    expect(r.points.map((p) => [p.tag, p.marks, p.awarded])).toEqual([
      ['M1', 2, 2],
      ['M2', 1, 1],
    ])
  })
})

describe('"any N of M" groups', () => {
  it('counts only N of the hit points and says why the rest do not count', () => {
    const r = grade('sej2-q1-a', 'short_text', {
      text: 'Rundingan dengan British, pilihan raya umum dan perlembagaan digubal.',
    })
    expect(r.points.filter((p) => p.hit)).toHaveLength(2)
    expect(r.awarded).toBe(2)
    expect(r.points.find((p) => p.reason.startsWith('Tidak dikira'))!.reason).toContain(
      'mana-mana 2',
    )
    expect(r.status).toBe('betul')
  })

  it('Sains "any 4 of 6" factors', () => {
    const six = grade('sn2-fotosintesis-a', 'short_text', {
      text: 'cahaya suhu air klorofil stoma karbon dioksida',
    })
    expect(six.points.filter((p) => p.hit)).toHaveLength(4)
    expect(six.awarded).toBe(4)
    expect(grade('sn2-fotosintesis-a', 'short_text', { text: 'cahaya dan suhu' }).awarded).toBe(2)
  })
})

describe('richer point matching', () => {
  it('all_of ("&") needs every item', () => {
    const scheme: SchemeDef = {
      kind: 'points',
      marks: 1,
      points: [
        {
          id: 'p',
          code: 'K',
          marks: 1,
          label: 'dua langkah',
          match: { type: 'all_of', items: ['2x', 'x+3'] },
        },
      ],
    }
    expect(grade('a', 'working', { steps: ['2x', 'x+3=5'] }, scheme).awarded).toBe(1)
    expect(grade('a', 'working', { steps: ['2x'] }, scheme).awarded).toBe(0)
  })

  it('requires is a list: N needs both K points', () => {
    const scheme: SchemeDef = {
      kind: 'points',
      marks: 3,
      points: [
        { id: 'k1', code: 'K', marks: 1, label: 'a', match: { type: 'step', accept: ['3*4'] } },
        { id: 'k2', code: 'K', marks: 1, label: 'b', match: { type: 'step', accept: ['5*5'] } },
        {
          id: 'n1',
          code: 'N',
          marks: 1,
          label: 'c',
          match: { type: 'final' },
          requires: ['k1', 'k2'],
        },
      ],
      final: { accept: ['13'], display: '13' },
    }
    expect(grade('r', 'working', { steps: ['3*4', '5*5'], final: '13' }, scheme).awarded).toBe(3)
    const one = grade('r', 'working', { steps: ['3*4'], final: '13' }, scheme)
    expect(one.awarded).toBe(1)
    expect(one.points[2]!.reason).toContain('k2')
  })
})

describe('ECF is data, not a callback', () => {
  it('rules compute the expected value', () => {
    expect(ecfExpected({ op: 'sub_from', k: 80 }, 12)).toBe(68)
    expect(ecfExpected({ op: 'add', k: 3 }, 4)).toBe(7)
    expect(ecfExpected({ op: 'mul', k: 2 }, 4)).toBe(8)
    expect(ecfExpected({ op: 'same' }, 9)).toBe(9)
  })

  it('every scheme survives a JSON round trip unchanged (storable and loadable)', () => {
    for (const [id, scheme] of BANK.schemes) {
      expect(JSON.parse(JSON.stringify(scheme)), id).toEqual(scheme)
    }
    const ecfPoints = [...BANK.schemes.values()]
      .flatMap((s) => (s.kind === 'points' ? s.points : []))
      .filter((p) => p.ecf)
    expect(ecfPoints.length).toBeGreaterThan(0)
    for (const p of ecfPoints) expect(typeof p.ecf!.rule).toBe('object')
  })
})

describe('Sejarah K2 end to end', () => {
  it('scores facts, letters and leaves the essay waiting for a teacher', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const { attemptId } = await server.startAttempt(9, 'sej-k2-2025-a', 'exam')
    const view = await server.getAttemptView(9, attemptId)
    expect(view.questions.find((q) => q.id === 'sej2-q2')!.optionBank).toHaveLength(5)
    await server.submit(9, attemptId, {
      idempotencyKey: 'k',
      changes: [
        {
          partId: 'sej2-q1-a',
          answer: { text: 'Rundingan dan pilihan raya.' },
          rev: 1,
          savedAt: 1,
        },
        { partId: 'sej2-q2-a', answer: { choice: 'B' }, rev: 1, savedAt: 1 },
        { partId: 'sej2-q2-b', answer: { choice: 'C' }, rev: 1, savedAt: 1 },
        { partId: 'sej2-q2-c', answer: { choice: 'A' }, rev: 1, savedAt: 1 },
        {
          partId: 'sej2-q3-a',
          answer: { text: 'Perlembagaan melindungi hak rakyat.' },
          rev: 1,
          savedAt: 1,
        },
      ],
    })
    const { result } = await server.getResult(9, attemptId)
    expect(result.max).toBe(9 + 10)
    expect(result.score).toBe(2 + 2)
    expect(result.provisional).toBe(true)
    expect(result.pendingReview).toBe(1)
  })
})
