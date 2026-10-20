import { describe, expect, it } from 'vitest'

import {
  AiCurriculumTagSchema,
  AiDraftPartSchema,
  AiEcfRuleSchema,
  AiFinalDefSchema,
  AiLeafKindSchema,
  AiMcqOptionSchema,
  AiPointCodeSchema,
  AiPointDefSchema,
  AiPointGroupSchema,
  AiPointMatchSchema,
  AiRegionSchema,
  AiRubricBandSchema,
  AiSchemeDefSchema,
  AiStimulusDefSchema,
  AiWordRangeSchema,
  AI_MESSAGES,
} from '../../ai/schema'
import {
  INTAKE_MESSAGES,
  IntakeCurriculumTagSchema,
  IntakeEcfRuleSchema,
  IntakeFinalSchema,
  IntakeLeafKindSchema,
  IntakeMcqOptionSchema,
  IntakePartSchema,
  IntakePointCodeSchema,
  IntakePointGroupSchema,
  IntakePointMatchSchema,
  IntakePointSchema,
  IntakeRegionSchema,
  IntakeRubricBandSchema,
  IntakeSchemeSchema,
  IntakeStimulusSchema,
  IntakeWordRangeSchema,
} from '../schema'

/**
 * The intake shapes repeat the merged BE-36 (`ai/schema.ts`) shapes on purpose (stable component names,
 * a few intentional extras; see the header of question.ts). This file is what keeps them from drifting:
 * for every shared shape the same values must be accepted or refused by both, boundary values included.
 */
type Parser = { safeParse: (v: unknown) => { success: boolean } }
const same = (intake: Parser, ai: Parser, values: readonly unknown[]) => {
  for (const v of values) expect(intake.safeParse(v).success, JSON.stringify(v)).toBe(ai.safeParse(v).success)
}
const text = (n: number) => 'x'.repeat(n)

describe('intake shapes behave exactly like the merged BE-36 shapes', () => {
  it('McqOption: id 1..16, text up to 5000, strict', () => {
    same(IntakeMcqOptionSchema, AiMcqOptionSchema, [
      { id: 'A', text: '5' },
      { id: '', text: '5' },
      { id: text(16), text: '' },
      { id: text(17), text: '' },
      { id: 'A', text: text(5000) },
      { id: 'A', text: text(5001) },
      { id: 'A' },
      { id: 'A', text: 'x', extra: 1 },
    ])
  })

  it('CurriculumTag: tp 1..6 integer, sp up to 20, unit nullable, level and formOrigin enums', () => {
    const t = { subject: 'MAT', level: 'T4', unit: 'MAT-T4-08', unitLabel: 'x', sp: ['8.1'], tp: 3, formOrigin: 'T4' }
    same(IntakeCurriculumTagSchema, AiCurriculumTagSchema, [
      t,
      { ...t, tp: 0 },
      { ...t, tp: 1 },
      { ...t, tp: 6 },
      { ...t, tp: 7 },
      { ...t, tp: 2.5 },
      { ...t, sp: Array.from({ length: 20 }, (_, i) => `s${i}`) },
      { ...t, sp: Array.from({ length: 21 }, (_, i) => `s${i}`) },
      { ...t, sp: [''] },
      { ...t, unit: null },
      { ...t, unit: '' },
      { ...t, unit: text(64) },
      { ...t, unit: text(65) },
      { ...t, unitLabel: text(200) },
      { ...t, unitLabel: text(201) },
      { ...t, subject: '' },
      { ...t, subject: text(32) },
      { ...t, subject: text(33) },
      { ...t, level: 'T3' },
      { ...t, level: 'T4+T5' },
      { ...t, formOrigin: 'T1-T3' },
      { ...t, formOrigin: 'T6' },
      { ...t, extra: 1 },
    ])
  })

  it('WordRange: 0..5000 integers and min <= max', () => {
    same(IntakeWordRangeSchema, AiWordRangeSchema, [
      { min: 0, max: 0 },
      { min: 120, max: 200 },
      { min: 200, max: 120 },
      { min: 0, max: 5000 },
      { min: 0, max: 5001 },
      { min: -1, max: 10 },
      { min: 1.5, max: 10 },
      { min: 1 },
    ])
  })

  it('Region: page fractions inside the page', () => {
    same(IntakeRegionSchema, AiRegionSchema, [
      { page: 1, x: 0, y: 0, w: 1, h: 1 },
      { page: 2, x: 0.05, y: 0.4, w: 0.9, h: 0.25 },
      { page: 2, x: 0.5, y: 0, w: 0.6, h: 0.1 },
      { page: 2, x: 0, y: 0.5, w: 0.1, h: 0.6 },
      { page: 0, x: 0, y: 0, w: 1, h: 1 },
      { page: 1.5, x: 0, y: 0, w: 1, h: 1 },
      { page: 1, x: -0.1, y: 0, w: 0.5, h: 0.5 },
      { page: 1, x: 0, y: 0, w: 1.1, h: 0.5 },
      { page: 1, x: 0, y: 0, w: 0.5, h: 0.5, extra: 1 },
    ])
  })

  it('LeafKind and PointCode enums', () => {
    same(IntakeLeafKindSchema, AiLeafKindSchema, ['working', 'numeric', 'short_text', 'match_letter', 'essay', 'drawing', 'table_fill', 'mcq', '', 'Working'])
    same(IntakePointCodeSchema, AiPointCodeSchema, ['K', 'N', 'P', 'B', 'M', 'F', 'C', 'Z', 'k', ''])
  })

  it('PointMatch and EcfRule', () => {
    same(IntakePointMatchSchema, AiPointMatchSchema, [
      { type: 'step', accept: [] },
      { type: 'step', accept: Array.from({ length: 50 }, () => 'a') },
      { type: 'step', accept: Array.from({ length: 51 }, () => 'a') },
      { type: 'step', accept: [text(2000)] },
      { type: 'step', accept: [text(2001)] },
      { type: 'all_of', items: ['6', '8'] },
      { type: 'all_of' },
      { type: 'final' },
      { type: 'final', extra: 1 },
      { type: 'unit' },
      { type: 'keywords', anyOf: ['a'] },
      { type: 'keywords', anyOf: Array.from({ length: 51 }, () => 'a') },
      { type: 'manual' },
      { type: 'regex', pattern: '.*' },
    ])
    same(IntakeEcfRuleSchema, AiEcfRuleSchema, [
      { op: 'same' },
      { op: 'sub_from', k: 1 },
      { op: 'add', k: 1_000_000 },
      { op: 'mul', k: 1_000_001 },
      { op: 'mul', k: -1_000_000 },
      { op: 'mul', k: -1_000_001 },
      { op: 'add' },
      { op: 'pow', k: 2 },
    ])
  })

  it('PointDef, PointGroup, FinalDef and RubricBand', () => {
    const p = { id: 'p1', code: 'K', marks: 1, label: 'x', match: { type: 'final' } }
    same(IntakePointSchema, AiPointDefSchema, [
      p,
      { ...p, marks: 100 },
      { ...p, marks: 101 },
      { ...p, marks: 0.5 },
      { ...p, id: '' },
      { ...p, id: text(64) },
      { ...p, id: text(65) },
      { ...p, label: text(2000) },
      { ...p, label: text(2001) },
      { ...p, requires: ['p0'] },
      { ...p, requires: Array.from({ length: 51 }, (_, i) => `r${i}`) },
      { ...p, ecf: { fromPart: 'a', rule: { op: 'same' }, note: '' } },
      { ...p, ecf: { fromPart: 'a', rule: { op: 'same' }, note: text(201) } },
      { ...p, ecf: { fromPart: 'a', rule: { op: 'same' } } },
      { ...p, code: 'Z' },
    ])
    same(IntakePointGroupSchema, AiPointGroupSchema, [
      { id: 'g', anyN: 1, pointIds: ['p'] },
      { id: 'g', anyN: 0, pointIds: [] },
      { id: 'g', anyN: 50, pointIds: [] },
      { id: 'g', anyN: 51, pointIds: [] },
      { id: 'g', anyN: 1, pointIds: Array.from({ length: 51 }, (_, i) => `p${i}`) },
    ])
    same(IntakeFinalSchema, AiFinalDefSchema, [
      { accept: ['24'], display: '24' },
      { accept: [], display: '' },
      { accept: ['24'], display: '24', tolerance: 0, unit: 'cm', mustContain: 'x', formHint: 'y' },
      { accept: ['24'], display: '24', tolerance: -1 },
      { accept: ['24'], display: '24', unit: text(33) },
      { accept: ['24'], display: '24', mustContain: text(201) },
      { accept: ['24'], display: '24', formHint: text(501) },
      { accept: ['24'] },
    ])
    same(IntakeRubricBandSchema, AiRubricBandSchema, [
      { name: 'Cemerlang', range: [8, 10], descriptor: 'x' },
      { name: text(100), range: [0, 1000], descriptor: '' },
      { name: text(101), range: [0, 1], descriptor: '' },
      { name: 'x', range: [0, 1001], descriptor: '' },
      { name: 'x', range: [-1, 1], descriptor: '' },
      { name: 'x', range: [1], descriptor: '' },
      { name: 'x', range: [1, 2, 3], descriptor: '' },
      { name: 'x', range: [1, 2], descriptor: text(2001) },
    ])
  })

  it('SchemeDef: the five kinds and their bounds', () => {
    const point = { id: 'p', code: 'K', marks: 1, label: 'x', match: { type: 'manual' } }
    same(IntakeSchemeSchema, AiSchemeDefSchema, [
      { kind: 'option', marks: 1, correct: 'B', reason: '' },
      { kind: 'option', marks: 1, correct: '', reason: '' },
      { kind: 'option', marks: 1, correct: text(16), reason: text(2000) },
      { kind: 'option', marks: 1, correct: text(17), reason: '' },
      { kind: 'option', marks: 1, correct: 'A', reason: text(2001) },
      { kind: 'option', marks: 1000, correct: 'A', reason: '' },
      { kind: 'option', marks: 1001, correct: 'A', reason: '' },
      { kind: 'option', marks: -1, correct: 'A', reason: '' },
      { kind: 'option', marks: 1.5, correct: 'A', reason: '' },
      { kind: 'mapping', marks: 2, map: { '1': 'A' } },
      { kind: 'mapping', marks: 2, map: { [text(64)]: text(500) } },
      { kind: 'mapping', marks: 2, map: { [text(65)]: 'A' } },
      { kind: 'mapping', marks: 2, map: { '1': text(501) } },
      { kind: 'accepted', marks: 1, values: [{ v: '5', tol: 0.1, unit: 'cm' }], caseSensitive: false },
      { kind: 'accepted', marks: 1, values: [{ v: text(501) }] },
      { kind: 'accepted', marks: 1, values: [{ v: '5', tol: -1 }] },
      { kind: 'accepted', marks: 1, values: [{ v: '5', unit: text(33) }] },
      { kind: 'accepted', marks: 1, values: Array.from({ length: 51 }, () => ({ v: '1' })) },
      { kind: 'points', marks: 1, points: [] },
      { kind: 'points', marks: 1, points: [point] },
      { kind: 'points', marks: 1, points: Array.from({ length: 51 }, (_, i) => ({ ...point, id: `p${i}` })) },
      { kind: 'points', marks: 1, points: [], groups: Array.from({ length: 21 }, (_, i) => ({ id: `g${i}`, anyN: 1, pointIds: [] })) },
      { kind: 'points', marks: 1, points: [], model: text(5000) },
      { kind: 'points', marks: 1, points: [], model: text(5001) },
      { kind: 'rubric', marks: 4, criteria: [], bands: [] },
      { kind: 'rubric', marks: 4, criteria: Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, name: 'x' })), bands: [] },
      { kind: 'rubric', marks: 4, criteria: [{ id: '', name: 'x' }], bands: [] },
      { kind: 'rubric', marks: 4, criteria: [], bands: [], notes: Array.from({ length: 21 }, () => 'n') },
      { kind: 'rubric', marks: 4, criteria: [], bands: [], notes: [text(2001)] },
      { kind: 'free', marks: 1 },
    ])
  })

  it('Part: the same bounds; the intake part also accepts the ancestor list `lead`', () => {
    const part = { id: 'q1-a', label: '(a)', prompt: 'x', marks: 2, mode: 'working' }
    same(IntakePartSchema, AiDraftPartSchema, [
      part,
      { ...part, marks: 100 },
      { ...part, marks: 101 },
      { ...part, marks: 0 },
      { ...part, id: '' },
      { ...part, id: text(64) },
      { ...part, id: text(65) },
      { ...part, label: '' },
      { ...part, label: text(16) },
      { ...part, label: text(17) },
      { ...part, prompt: text(10_000) },
      { ...part, prompt: text(10_001) },
      { ...part, mode: 'mcq' },
      { ...part, unit: text(32) },
      { ...part, unit: text(33) },
      { ...part, wordRange: { min: 1, max: 2 } },
      { ...part, wordRange: { min: 2, max: 1 } },
      { ...part, scheme: { kind: 'free', marks: 1 } },
    ])
    expect(IntakePartSchema.safeParse({ ...part, lead: [{ id: 'q1', label: '(a)', prompt: 'x' }] }).success).toBe(true)
    expect(AiDraftPartSchema.safeParse({ ...part, lead: [{ id: 'q1', label: '(a)', prompt: 'x' }] }).success).toBe(false)
  })

  it('Stimulus: the same bounds; the intake stimulus adds figureId, a nullable region and a page cap', () => {
    const s = { id: '31', kind: 'diagram', label: 'Rajah 1', alt: 'x' }
    same(IntakeStimulusSchema, AiStimulusDefSchema, [
      s,
      { ...s, kind: 'passage', text: 'x' },
      { ...s, label: text(100) },
      { ...s, label: text(101) },
      { ...s, caption: text(300) },
      { ...s, caption: text(301) },
      { ...s, alt: text(1000) },
      { ...s, alt: text(1001) },
      { ...s, kind: 'video' },
      { ...s, table: { head: ['a'], rows: [['1']] } },
      { ...s, table: { head: Array.from({ length: 51 }, () => 'a'), rows: [] } },
      { ...s, table: { head: [], rows: [[text(501)]] } },
      { ...s, table: { head: [], rows: Array.from({ length: 501 }, () => []) } },
    ])
    expect(IntakeStimulusSchema.safeParse({ ...s, figureId: '77', region: null }).success).toBe(true)
    expect(AiStimulusDefSchema.safeParse({ ...s, figureId: '77' }).success).toBe(false)
  })

  it('shares the merged AI service sentences instead of repeating them', () => {
    expect(INTAKE_MESSAGES.extractionFailed).toBe(AI_MESSAGES.extractionFailed)
    expect(INTAKE_MESSAGES.budgetExhausted).toBe(AI_MESSAGES.budgetExhausted)
    expect(INTAKE_MESSAGES.unavailable).toBe(AI_MESSAGES.unavailable)
  })

  it('the one intentional difference is the key cap of a mapping scheme (50), which BE-36 does not have', () => {
    const map = (n: number) => ({ kind: 'mapping', marks: 1, map: Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 'A'])) })
    expect(IntakeSchemeSchema.safeParse(map(50)).success).toBe(true)
    expect(IntakeSchemeSchema.safeParse(map(51)).success).toBe(false)
    expect(AiSchemeDefSchema.safeParse(map(51)).success).toBe(true)
  })
})
