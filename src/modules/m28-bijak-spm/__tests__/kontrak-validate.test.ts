import { describe, expect, it } from 'vitest'

import {
  emptyForm,
  emptyGroup,
  offeredMarks,
  structuralKey,
  toInput,
  type ContractForm,
  type FormSection,
} from '../admin/kontrak/domain/form'
import { derivedShare, errorsOf, incompleteOf, quotaSum, validateForm } from '../admin/kontrak/domain/validate'

const unit = (level: 'T4' | 'T5', n: number) =>
  ({ kind: 'unit', nodeId: `u-${level}-${n}`, level, code: `${n}.0`, title: `Unit ${n}` }) as const

function section(over: Partial<FormSection> = {}): FormSection {
  return {
    ...emptyForm().sections[0]!,
    label: 'Bahagian A',
    questionCount: 5,
    markBudget: 45,
    ...over,
  }
}
function form(sections: FormSection[], over: Partial<ContractForm> = {}): ContractForm {
  const total = sections.reduce((n, s) => n + (s.markBudget ?? 0), 0)
  return { ...emptyForm(), code: '1449/2', durationMin: 150, totalMarks: total, sections, ...over }
}
const codes = (f: ContractForm, level: 'error' | 'incomplete' | 'warning' = 'error'): string[] =>
  validateForm(f)
    .filter((i) => i.level === level)
    .map((i) => i.code)

describe('Semakan Kontrak: paper totals', () => {
  it('flags section budgets that do not add up to the paper total', () => {
    const f = form([section()], { totalMarks: 100 })
    const e = errorsOf(validateForm(f)).find((i) => i.code === 'TOTAL_MISMATCH')
    expect(e?.message).toBe('Jumlah markah bahagian (45) tidak sama dengan jumlah markah kertas (100).')
  })

  it('accepts a matching total and keeps Save open (only incompleteness is left)', () => {
    const f = form([section()])
    expect(errorsOf(validateForm(f))).toEqual([])
    expect(incompleteOf(validateForm(f)).map((i) => i.code).sort()).toEqual(['NO_KBAT', 'NO_PROFILE', 'NO_QUOTA'])
  })

  it('flags M < N for choose-N', () => {
    const f = form([section({ ruleType: 'choose', chooseN: 3, questionCount: 2, markBudget: 10 })])
    expect(codes(f)).toContain('CHOOSE_N_RANGE')
  })
})

describe('Semakan Kontrak: quota sums (basis and choose-N)', () => {
  const lines = (a: number | null, b: number | null) => [
    { unit: unit('T4', 7), value: a, reviewed: true },
    { unit: unit('T5', 5), value: b, reviewed: true },
  ]

  it('counts the sum against the question count when the basis is questions', () => {
    const s = section({ quotaLines: lines(3, 1) })
    expect(quotaSum(s)).toEqual({ sum: 4, target: 5, basis: 'questions' })
    const msg = errorsOf(validateForm(form([s]))).find((i) => i.code === 'QUOTA_SUM')?.message
    expect(msg).toBe('Bahagian A: jumlah kuota topik (4) tidak sama dengan 5 soalan bahagian ini.')
  })

  it('counts against the offered marks when the basis is marks', () => {
    const s = section({ quotaBasis: 'marks', quotaLines: lines(36, 9) })
    expect(quotaSum(s).target).toBe(45)
    expect(codes(form([s]))).not.toContain('QUOTA_SUM')
    const short = section({ quotaBasis: 'marks', quotaLines: lines(36, 7) })
    expect(codes(form([short]))).toContain('QUOTA_SUM')
  })

  it('uses budget / N x M as the offered marks of an equal-mark choose-N section', () => {
    const s = section({ ruleType: 'choose', chooseN: 1, questionCount: 2, markBudget: 10, quotaBasis: 'marks', quotaLines: lines(10, 10) })
    expect(offeredMarks(s)).toBe(20)
    expect(codes(form([s]))).not.toContain('QUOTA_SUM')
  })

  it('refuses the marks basis when the offered marks are not defined (D-7)', () => {
    const s = section({ ruleType: 'choose', chooseN: 2, questionCount: 3, markBudget: 5, quotaBasis: 'marks', quotaLines: lines(2, 3) })
    expect(offeredMarks(s)).toBeNull()
    const e = errorsOf(validateForm(form([s]))).find((i) => i.code === 'QUOTA_BASIS')
    expect(e?.message).toContain('Tetapkan markah mengikut slot atau kira dalam soalan.')
  })

  it('lists an empty quota value and a stated T4 : T5 contradiction', () => {
    const empty = section({ quotaLines: lines(null, 5) })
    expect(codes(form([empty]))).toContain('QUOTA_EMPTY')
    const s = section({ quotaLines: lines(3, 2), levelShare: { t4: 1, t5: 1 } })
    expect(derivedShare(s)).toEqual({ t4: 3, t5: 2 })
    expect(errorsOf(validateForm(form([s]))).find((i) => i.code === 'LEVEL_SHARE')?.message).toBe(
      'Bahagian A: nisbah Tingkatan 4 : 5 daripada nilai unit (3 : 2) bercanggah dengan nisbah ditetapkan (1 : 1).',
    )
    expect(codes(form([section({ quotaLines: lines(4, 2), levelShare: { t4: 2, t5: 1 } })]))).not.toContain('LEVEL_SHARE')
  })

  it('treats a section without quota lines as Belum lengkap, not an error', () => {
    const f = form([section()])
    expect(codes(f)).not.toContain('QUOTA_SUM')
    expect(codes(f, 'incomplete')).toContain('NO_QUOTA')
  })
})

describe('Semakan Kontrak: difficulty profile', () => {
  const profile = (groups: ReturnType<typeof emptyGroup>[], kind: 'ladder' | 'bahagian' = 'ladder') =>
    section({ profileKind: kind, groups })
  const g = (from: number, to: number, tpMin = 1, tpMax = 3) => ({ ...emptyGroup(from, to), tpMin, tpMax })

  it('accepts groups that tile 1..M', () => {
    expect(codes(form([profile([g(1, 2), g(3, 5, 2, 4)])]))).toEqual([])
  })

  it('lists a gap and an overlap with the exact slots', () => {
    const gap = errorsOf(validateForm(form([profile([g(1, 2), g(4, 5)])]))).find((i) => i.code === 'SLOT_GAP')
    expect(gap?.message).toBe('Bahagian A: slot 3 - 3 belum dilitupi oleh mana-mana kumpulan.')
    const over = errorsOf(validateForm(form([profile([g(1, 3), g(3, 5)])]))).find((i) => i.code === 'SLOT_OVERLAP')
    expect(over?.message).toBe('Bahagian A: kumpulan slot bertindih pada slot 3 - 3.')
  })

  it('rejects a ladder that goes down and TP min above max', () => {
    expect(codes(form([profile([g(1, 2, 3, 4), g(3, 5, 1, 2)])]))).toContain('LADDER_DOWN')
    expect(codes(form([profile([g(1, 5, 4, 2)])]))).toContain('TP_ORDER')
  })

  it('requires exact TP counts to add up to the group size', () => {
    const grp = { ...g(1, 5, 3, 5), tpCounts: { 3: 2, 4: 2 } }
    expect(errorsOf(validateForm(form([profile([grp])]))).find((i) => i.code === 'TP_COUNTS')?.message).toBe(
      'Bahagian A slot 1 - 5: jumlah kiraan TP (4) tidak sama dengan bilangan slot (5).',
    )
    expect(codes(form([profile([{ ...grp, tpCounts: { 3: 2, 4: 2, 5: 1 } }])]))).not.toContain('TP_COUNTS')
  })

  it('forces one group for choose-N and for Mengikut Bahagian', () => {
    const choose = section({ ruleType: 'choose', chooseN: 1, questionCount: 5, markBudget: 9, profileKind: 'ladder', groups: [g(1, 2), g(3, 5)] })
    expect(codes(form([choose]))).toContain('PROFILE_SHAPE')
    expect(codes(form([profile([g(1, 2), g(3, 5)], 'bahagian')]))).toContain('PROFILE_SINGLE')
  })

  it('checks per-slot marks against the budget (equal marks x N for choose-N)', () => {
    const ok = section({ perSlotMarks: true, profileKind: 'ladder', groups: [{ ...g(1, 2), marks: 8 }, { ...g(3, 5), marks: 10 }], markBudget: 46 })
    expect(codes(form([ok]))).not.toContain('MARKS_BAND')
    const bad = section({ perSlotMarks: true, profileKind: 'ladder', groups: [{ ...g(1, 2), marks: 8 }, { ...g(3, 5), marks: 10 }], markBudget: 45 })
    expect(errorsOf(validateForm(form([bad]))).find((i) => i.code === 'MARKS_BAND')?.message).toBe(
      'Bahagian A: jumlah markah slot (46) tidak sama dengan belanjawan bahagian (45).',
    )
    const choose = section({ ruleType: 'choose', chooseN: 2, questionCount: 3, markBudget: 10, perSlotMarks: true, profileKind: 'bahagian', groups: [{ ...g(1, 3), marks: 5 }] })
    expect(codes(form([choose]))).not.toContain('MARKS_BAND')
  })
})

describe('Semakan Kontrak: KBAT', () => {
  it('treats 0 as filled, flags KBAT above the offered marks, warns on a low TP band', () => {
    expect(codes(form([section({ kbatMarks: 0 })]), 'incomplete')).not.toContain('NO_KBAT')
    expect(codes(form([section({ kbatMarks: 50 })]))).toContain('KBAT_RANGE')
    const low = section({ kbatMarks: 6, profileKind: 'bahagian', groups: [{ ...emptyGroup(1, 5), tpMin: 1, tpMax: 2 }] })
    const warn = validateForm(form([low])).find((i) => i.level === 'warning')
    expect(warn?.code).toBe('KBAT_TP_BAND')
  })

  it('requires the paper-level KBAT to equal the Bahagian sum when both are set', () => {
    const f = form([section({ kbatMarks: 6 }), section({ label: 'Bahagian B', kbatMarks: 4 })], { kbatMarks: 12 })
    expect(codes(f)).toContain('KBAT_TOTAL')
    expect(codes({ ...f, kbatMarks: 10 })).not.toContain('KBAT_TOTAL')
  })
})

describe('write body', () => {
  it('is built field by field: no read-only view fields reach the server', () => {
    const s = section({
      profileKind: 'bahagian',
      groups: [{ ...emptyGroup(1, 5), tpMin: 2, tpMax: 4, tpCounts: { 2: 1, 3: 2, 4: 2 } }],
      quotaLines: [{ unit: unit('T4', 7), value: 5, reviewed: false, tag: 'observed' }],
      kbatMarks: 3,
      kbatReviewed: false,
    })
    const body = toInput(form([s]))
    const text = JSON.stringify(body)
    for (const banned of ['reviewed', 'kbatReviewed', 'position', 'servesStudents', '"title"', '"level"', '"7.0"'])
      expect(text).not.toContain(banned)
    expect(body.sections[0]!.quota!.lines[0]).toEqual({ tag: 'observed', unit: { kind: 'unit', nodeId: 'u-T4-7' }, value: 5 })
    expect(body.sections[0]!.profile!.groups[0]!.tpCounts).toEqual([
      { tp: 2, count: 1 },
      { tp: 3, count: 2 },
      { tp: 4, count: 2 },
    ])
    expect(body.source).toBe('Draf')
  })

  it('leaves source out for a Disahkan head and never writes Disahkan', () => {
    const body = toInput(form([section()], { source: 'Disahkan' }))
    expect('source' in body).toBe(false)
  })

  it('tells a cosmetic edit from a structural one (AC-39.4)', () => {
    const base = form([section()])
    const cosmetic = form([section({ label: 'Lain', instruction: 'Arahan baharu' })], { notes: 'nota', instructions: 'a' })
    expect(structuralKey(toInput(cosmetic))).toBe(structuralKey(toInput(base)))
    const structural = form([section({ markBudget: 40 })], { totalMarks: 45 })
    expect(structuralKey(toInput(structural))).not.toBe(structuralKey(toInput(base)))
  })
})
