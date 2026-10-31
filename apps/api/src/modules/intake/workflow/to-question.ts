import type { IntakePart, IntakeQuestion, IntakeScheme, QuestionPart } from '@pp/contract'

import type { QuestionCreateInput } from '../../questions'

/** Mark scheme or answer mode that the question bank cannot hold; the message is shown as a gate issue. */
export class ConvertError extends Error {
  constructor(
    message: string,
    readonly where: string,
  ) {
    super(message)
    this.name = 'ConvertError'
  }
}

export const CONVERT_MESSAGES = {
  schemeKind: 'Jenis skema tidak sepadan dengan mod jawapan.',
  schemeEmpty: 'Skema pemarkahan tiada.',
  mappingLetters: 'Skema padanan mesti menggunakan huruf pilihan A hingga H.',
  numericValue: 'Jawapan berangka mesti nombor.',
  mcqOptions: 'Soalan objektif perlu 3 hingga 8 pilihan.',
} as const

const LETTERS = 'ABCDEFGH'
type Leaf = Extract<QuestionPart, { mode: string }>
type Rich = { ms: string }
const rich = (ms: string): Rich => ({ ms })

/** Resolved curriculum ids (BE-08) of an item's tag. */
export interface TagIds {
  subjectId: string
  educationLevelId: string
  unitId: string | null
  spIds: string[]
  tp: number
}

function num(text: string, where: string): number {
  const n = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n)) throw new ConvertError(CONVERT_MESSAGES.numericValue, where)
  return n
}

function pointsKey(scheme: Extract<IntakeScheme, { kind: 'points' }>, marks: number, where: string) {
  if (scheme.points.length === 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
  return {
    kind: 'points' as const,
    marks,
    points: scheme.points.map((p) => ({
      id: p.id,
      code: p.code,
      label: p.label,
      marks: p.marks,
      ...(p.match.type === 'step' && p.match.accept.length > 0 ? { accept: p.match.accept } : {}),
      ...(p.match.type === 'keywords' && p.match.anyOf.length > 0 ? { accept: p.match.anyOf } : {}),
      ...(p.match.type === 'all_of' && p.match.items.length > 0 ? { allOf: p.match.items } : {}),
      ...(p.requires && p.requires.length > 0 ? { requires: p.requires } : {}),
      ...(p.ecf ? { ecf: { fromPart: p.ecf.fromPart, rule: p.ecf.rule } } : {}),
      ...(p.ecf?.note ? { note: p.ecf.note } : {}),
    })),
    ...(scheme.groups && scheme.groups.length > 0 ? { groups: scheme.groups.map((g) => ({ id: g.id, anyN: g.anyN, pointIds: g.pointIds })) } : {}),
    ...(scheme.final && scheme.final.accept.length > 0
      ? {
          final: {
            display: scheme.final.display,
            accept: scheme.final.accept,
            ...(scheme.final.tolerance === undefined ? {} : { tolerance: scheme.final.tolerance }),
            ...(scheme.final.unit ? { unit: scheme.final.unit } : {}),
            ...(scheme.final.mustContain ? { mustContain: scheme.final.mustContain } : {}),
          },
        }
      : {}),
    ...(scheme.model ? { modelText: scheme.model } : {}),
  }
}

/** One answer leaf of the bank from an intake leaf (mode, scheme, unit, word range). */
function leaf(label: string, prompt: string, marks: number, mode: IntakePart['mode'], scheme: IntakeScheme | undefined, o: { wordRange?: IntakePart['wordRange']; cognitiveLevel?: IntakePart['cognitiveLevel']; where: string }): Leaf {
  // R1-B05: the reviewer's cognitive level goes onto the bank leaf (the four upper levels are KBAT, settled when the leaf is stored).
  const base = { label, prompt: rich(prompt), marks, ...(o.cognitiveLevel ? { cognitiveLevel: o.cognitiveLevel } : {}) }
  const { where } = o
  if (!scheme) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
  switch (mode) {
    case 'short_text': {
      if (scheme.kind === 'accepted') {
        const values = scheme.values.map((v) => v.v).filter((v) => v.trim() !== '')
        if (values.length === 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
        return { ...base, mode, key: { kind: 'accepted', values, ...(scheme.caseSensitive === undefined ? {} : { caseSensitive: scheme.caseSensitive }) } }
      }
      if (scheme.kind === 'points' && scheme.final && scheme.final.accept.length > 0) {
        return { ...base, mode, key: { kind: 'accepted', values: scheme.final.accept } }
      }
      throw new ConvertError(CONVERT_MESSAGES.schemeKind, where)
    }
    case 'numeric': {
      if (scheme.kind === 'accepted') {
        const values = scheme.values.map((v) => ({
          v: num(v.v, where),
          ...(v.tol === undefined ? {} : { tol: v.tol }),
          ...(v.unit ? { unit: v.unit } : {}),
        }))
        if (values.length === 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
        return { ...base, mode, key: { kind: 'accepted', values } }
      }
      if (scheme.kind === 'points' && scheme.final && scheme.final.accept.length > 0) {
        const values = scheme.final.accept.map((a) => ({
          v: num(a, where),
          ...(scheme.final?.tolerance === undefined ? {} : { tol: scheme.final.tolerance }),
          ...(scheme.final?.unit ? { unit: scheme.final.unit } : {}),
        }))
        return { ...base, mode, key: { kind: 'accepted', values } }
      }
      throw new ConvertError(CONVERT_MESSAGES.schemeKind, where)
    }
    case 'match_letter': {
      if (scheme.kind !== 'mapping') throw new ConvertError(CONVERT_MESSAGES.schemeKind, where)
      const entries = Object.entries(scheme.map)
      if (entries.length === 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
      if (entries.some(([, v]) => !/^[A-H]$/.test(v))) throw new ConvertError(CONVERT_MESSAGES.mappingLetters, where)
      return { ...base, mode, key: { kind: 'mapping', map: Object.fromEntries(entries) as Record<string, string> } } as Leaf
    }
    case 'table_fill': {
      if (scheme.kind !== 'mapping') throw new ConvertError(CONVERT_MESSAGES.schemeKind, where)
      const entries = Object.entries(scheme.map)
      if (entries.length === 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
      return { ...base, mode, key: { kind: 'mapping', cells: Object.fromEntries(entries.map(([k, v]) => [k, [v]])) } }
    }
    case 'working':
    case 'drawing': {
      if (scheme.kind !== 'points') throw new ConvertError(CONVERT_MESSAGES.schemeKind, where)
      return { ...base, mode, key: pointsKey(scheme, marks, where) }
    }
    case 'essay': {
      const wordRange = o.wordRange ? { wordRange: { min: o.wordRange.min, max: o.wordRange.max } } : {}
      if (scheme.kind === 'points') return { ...base, mode, ...wordRange, key: pointsKey(scheme, marks, where) }
      if (scheme.kind === 'rubric') {
        if (scheme.criteria.length === 0 || scheme.bands.length === 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
        const first = scheme.criteria[0]?.id ?? 'general'
        return {
          ...base,
          mode,
          ...wordRange,
          key: {
            kind: 'rubric',
            marks,
            criteria: scheme.criteria.map((c) => ({ id: c.id, name: c.name })),
            bands: scheme.bands.map((b) => ({ name: b.name, range: [b.range[0], b.range[1]] as [number, number], ...(b.descriptor ? { descriptors: { [first]: b.descriptor } } : {}) })),
            ...(scheme.notes && scheme.notes.length > 0 ? { notes: scheme.notes } : {}),
          },
        }
      }
      throw new ConvertError(CONVERT_MESSAGES.schemeKind, where)
    }
  }
}

function mcqLeaf(q: IntakeQuestion, where: string): Leaf {
  const key = q.scheme?.kind === 'option' ? q.scheme.correct : ''
  const at = q.options.findIndex((o) => o.id === key)
  if (q.options.length < 3 || q.options.length > 8) throw new ConvertError(CONVERT_MESSAGES.mcqOptions, where)
  if (at < 0) throw new ConvertError(CONVERT_MESSAGES.schemeEmpty, where)
  return {
    label: '1',
    prompt: rich(q.stem.trim()),
    marks: q.marks,
    mode: 'mcq',
    ...(q.cognitiveLevel ? { cognitiveLevel: q.cognitiveLevel } : {}),
    options: q.options.map((o, i) => ({ label: LETTERS.charAt(i), body: rich(o.text.trim()) })),
    key: { kind: 'option', correct: LETTERS.charAt(at) },
  }
}

interface Branch {
  label: string
  prompt: Rich
  children: Array<Branch | Leaf>
}

/** The flat parts of an intake question as the bank's part tree (ancestors in `lead` become branches). */
function partTree(q: IntakeQuestion): QuestionPart[] {
  const roots: Array<Branch | Leaf> = []
  const nodes = new Map<string, Branch>()
  for (const p of q.parts) {
    let siblings = roots
    for (const a of p.lead ?? []) {
      let node = nodes.get(a.id)
      if (!node) {
        node = { label: a.label, prompt: rich(a.prompt.trim() || a.label), children: [] }
        nodes.set(a.id, node)
        siblings.push(node)
      }
      siblings = node.children
    }
    const prefix = (p.lead ?? []).map((l) => l.label).join('')
    const label = prefix && p.label.startsWith(prefix) ? p.label.slice(prefix.length) : p.label
    siblings.push(leaf(label, p.prompt.trim(), p.marks, p.mode, p.scheme, { wordRange: p.wordRange, cognitiveLevel: p.cognitiveLevel, where: `Soalan ${q.label}${p.label}` }))
  }
  return roots as QuestionPart[]
}

const FLAT_TYPE = { mcq: 'mcq', essay: 'essay', short: 'short_answer', structured: 'short_answer' } as const

/**
 * The prototype `intakeToDef` for the v2 bank: an intake question becomes the body of a Draf question (part tree with a
 * key per leaf, curriculum tag, optional stimulus group). Throws `ConvertError` for a scheme the bank cannot hold.
 */
export function toQuestionInput(q: IntakeQuestion, ids: TagIds, stimulusGroupId: string | null): QuestionCreateInput {
  const where = `Soalan ${q.label}`
  let parts: QuestionPart[]
  if (q.type === 'mcq') parts = [mcqLeaf(q, where)]
  else if (q.parts.length > 0) parts = partTree(q)
  else parts = [leaf('1', q.stem.trim(), q.marks, q.mode, q.scheme, { wordRange: q.wordRange, cognitiveLevel: q.cognitiveLevel, where })]
  return {
    questionType: FLAT_TYPE[q.type],
    subjectId: ids.subjectId,
    educationLevelId: ids.educationLevelId,
    difficultyLevel: Math.min(5, Math.max(1, ids.tp)),
    questionText: q.stem,
    parts,
    tag: { unitId: ids.unitId, spIds: ids.spIds, tp: ids.tp },
    language: 'bm',
    status: 'draft',
    ...(stimulusGroupId === null ? {} : { stimulusGroupId }),
  } as QuestionCreateInput
}
