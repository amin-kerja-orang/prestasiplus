/**
 * Intake question <-> m28 question (exam schema D1-D4). The intake editor works on a flat
 * `IntakeQuestion`; the bank and the student side use `QuestionDef` with a separate scheme map.
 * Three jobs:
 *  - `intakeToDef`   an edited question becomes a bank question plus its schemes;
 *  - `defToIntake`   a bank question is opened in the same editor ("Sunting" in Bank Soalan SPM);
 *  - `batchToSeeds`  a submitted batch becomes review-queue units (a stimulus group is one unit).
 * Nothing here touches storage.
 */
import type { ReviewSeed } from '../../../domain/admin-types'
import type {
  GroupDef,
  McqOption,
  PartDef,
  QuestionDef,
  SchemeDef,
  StimulusDef,
} from '../../../domain/types'
import type { IntakeBatch, IntakePart, IntakeQuestion, IntakeStimulus } from '../types'
import { groupsOf } from './grouping'
import { lowToConfirm } from './validation'

const LETTERS = 'ABCDEFGH'

export interface QuestionContent {
  question: QuestionDef
  schemes: Record<string, SchemeDef>
}

/** Stable option id of the n-th option of a bank question. */
export const optionId = (qid: string, index: number): string => `${qid}-o${index + 1}`

/** Plain stimulus (the cropped page number is an intake detail and is dropped). */
export function stimulusDef(s: IntakeStimulus, id = s.id): StimulusDef {
  const { page: _page, ...rest } = s
  void _page
  return { ...rest, id }
}

/* ---------------------------------------------------------------------------- intake to def */

export interface ToDefOptions {
  /** Id of the new bank question. */
  qid: string
  groupId?: string
  /** Id for a part that has no id of this question yet. */
  newPartId: (index: number) => string
}

function placePart(
  roots: PartDef[],
  nodes: Map<string, PartDef>,
  p: IntakePart,
  leaf: PartDef,
): void {
  let siblings = roots
  for (const a of p.lead ?? []) {
    let node = nodes.get(a.id)
    if (!node) {
      node = { id: a.id, label: a.label, prompt: a.prompt, marks: 0, children: [] }
      nodes.set(a.id, node)
      siblings.push(node)
    }
    siblings = node.children!
  }
  siblings.push(leaf)
}

export function intakeToDef(q: IntakeQuestion, o: ToDefOptions): QuestionContent {
  const schemes: Record<string, SchemeDef> = {}
  const base = { id: o.qid, curriculum: { ...q.tag, spIds: [...q.tag.spIds] }, stem: q.stem.trim() }
  const def: QuestionDef = { ...base, ...(o.groupId ? { groupId: o.groupId } : {}) }

  if (q.type === 'mcq') {
    def.mcq = { options: q.options.map((x, i) => ({ id: optionId(o.qid, i), text: x.text })) }
    const key = q.scheme?.kind === 'option' ? q.scheme : undefined
    const at = key ? q.options.findIndex((x) => x.id === key.correct) : -1
    if (key && at >= 0)
      schemes[o.qid] = {
        kind: 'option',
        marks: q.marks,
        correct: optionId(o.qid, at),
        reason: key.reason,
      }
    return { question: def, schemes }
  }

  if (q.parts.length > 0) {
    const roots: PartDef[] = []
    const nodes = new Map<string, PartDef>()
    q.parts.forEach((p, j) => {
      const id = p.id.startsWith(`${o.qid}-`) ? p.id : o.newPartId(j)
      const prefix = (p.lead ?? []).map((l) => l.label).join('')
      const label = prefix && p.label.startsWith(prefix) ? p.label.slice(prefix.length) : p.label
      const leaf: PartDef = {
        id,
        label,
        prompt: p.prompt.trim(),
        marks: p.marks,
        answer: {
          kind: p.mode,
          ...(p.unit ? { unit: p.unit } : {}),
          ...(p.wordRange ? { wordRange: p.wordRange } : {}),
        },
      }
      placePart(roots, nodes, p, leaf)
      if (p.scheme) schemes[id] = { ...p.scheme, marks: p.marks }
    })
    def.parts = roots
    return { question: def, schemes }
  }

  // Short answer / essay without parts: one unlabelled leaf under the stem.
  const id = `${o.qid}-ans`
  def.parts = [
    {
      id,
      label: '',
      prompt: '',
      marks: q.marks,
      answer: {
        kind: q.mode,
        ...(q.unit ? { unit: q.unit } : {}),
        ...(q.wordRange ? { wordRange: q.wordRange } : {}),
      },
    },
  ]
  if (q.scheme) schemes[id] = { ...q.scheme, marks: q.marks }
  return { question: def, schemes }
}

/* ---------------------------------------------------------------------------- def to intake */

function flatten(
  parts: readonly PartDef[],
  schemeOf: (id: string) => SchemeDef | undefined,
  lead: NonNullable<IntakePart['lead']>,
  out: IntakePart[],
): void {
  for (const p of parts) {
    if (p.children?.length) {
      flatten(p.children, schemeOf, [...lead, { id: p.id, label: p.label, prompt: p.prompt }], out)
      continue
    }
    const sc = schemeOf(p.id)
    out.push({
      id: p.id,
      label: `${lead.map((l) => l.label).join('')}${p.label}`,
      prompt: p.prompt,
      marks: p.marks,
      mode: p.answer?.kind ?? 'short_text',
      ...(sc ? { scheme: sc } : {}),
      ...(p.answer?.unit ? { unit: p.answer.unit } : {}),
      ...(p.answer?.wordRange ? { wordRange: p.answer.wordRange } : {}),
      ...(lead.length > 0 ? { lead } : {}),
    })
  }
}

export function defToIntake(
  q: QuestionDef,
  schemeOf: (id: string) => SchemeDef | undefined,
  label = '1',
  stimulusId?: string,
): IntakeQuestion {
  const common = {
    id: q.id,
    label,
    stem: q.stem,
    tag: { ...q.curriculum, spIds: [...q.curriculum.spIds] },
    page: 1,
    lowFields: [] as string[],
    confirmed: [] as string[],
    ...(stimulusId ? { stimulusId } : {}),
  }

  if (q.mcq) {
    const options: McqOption[] = q.mcq.options.map((o, i) => ({
      id: LETTERS[i] ?? String(i + 1),
      text: o.text,
    }))
    const sc = schemeOf(q.id)
    const at = sc?.kind === 'option' ? q.mcq.options.findIndex((o) => o.id === sc.correct) : -1
    return {
      ...common,
      type: 'mcq',
      options,
      marks: sc?.marks ?? 1,
      mode: 'short_text',
      parts: [],
      ...(sc?.kind === 'option' && at >= 0
        ? { scheme: { ...sc, correct: options[at]!.id } }
        : {}),
    }
  }

  const parts = q.parts ?? []
  const only = parts[0]
  if (parts.length === 1 && only && !only.children?.length && !only.label && !only.prompt) {
    const sc = schemeOf(only.id)
    return {
      ...common,
      type: sc?.kind === 'rubric' || only.answer?.kind === 'essay' ? 'essay' : 'short',
      options: [],
      marks: only.marks,
      mode: (only.answer?.kind ?? 'short_text'),
      ...(only.answer?.unit ? { unit: only.answer.unit } : {}),
      ...(only.answer?.wordRange ? { wordRange: only.answer.wordRange } : {}),
      parts: [],
      ...(sc ? { scheme: sc } : {}),
    }
  }

  const flat: IntakePart[] = []
  flatten(parts, schemeOf, [], flat)
  return {
    ...common,
    type: 'structured',
    options: [],
    marks: flat.reduce((n, p) => n + p.marks, 0),
    mode: 'short_text',
    parts: flat,
  }
}

/* ---------------------------------------------------------------------- batch to queue units */

/** Bank id of the question at 0-based `index` of batch `batchId` once it is submitted. */
export const seedQuestionId = (batchId: string, index: number): string => `${batchId}-q${index + 1}`

/**
 * A submitted batch as review-queue units: each stimulus group is one unit (decided together),
 * every other question is its own unit. Ids are derived from the batch id so they are stable and
 * never clash with the seed bank.
 */
export function batchToSeeds(batch: IntakeBatch): ReviewSeed[] {
  const manual = batch.sourceKind === 'manual'
  const qid = (i: number): string => seedQuestionId(batch.id, i)
  const source = manual
    ? `Manual: ${batch.source} (${batch.paperType} ${batch.year})`
    : `${batch.source} (${batch.paperType} ${batch.year})`
  const lows = batch.questions.reduce((n, q) => n + lowToConfirm(q).length, 0)
  const meta = {
    subject: batch.subject,
    kertas: batch.kertas,
    source,
    uploader: 'Admin Pusat',
    confidence: manual ? ('tinggi' as const) : lows > 0 ? ('sederhana' as const) : ('tinggi' as const),
    ageDays: 0,
    status: 'semakan' as const,
  }

  const index = new Map(batch.questions.map((q, i) => [q.id, i]))
  const groups = new Map(groupsOf(batch.questions).map((g) => [g.stimulusId, g]))
  const done = new Set<string>()
  const seeds: ReviewSeed[] = []

  for (const q of batch.questions) {
    if (done.has(q.id)) continue
    const g = q.stimulusId ? groups.get(q.stimulusId) : undefined
    const stim = g ? batch.stimuli.find((s) => s.id === g.stimulusId) : undefined

    if (g && stim) {
      const gid = `${batch.id}-g${g.stimulusId}`
      const stimulusId = `${batch.id}-${stim.id}`
      const members = g.questionIds.map((id) => batch.questions[index.get(id)!]!)
      const questions: QuestionDef[] = []
      const schemes: Record<string, SchemeDef> = {}
      for (const m of members) {
        done.add(m.id)
        const i = index.get(m.id)!
        const c = intakeToDef(m, {
          qid: qid(i),
          groupId: gid,
          newPartId: (j) => `${qid(i)}-p${j + 1}`,
        })
        questions.push(c.question)
        Object.assign(schemes, c.schemes)
      }
      const def: GroupDef = { id: gid, stimulusId, questionIds: questions.map((x) => x.id) }
      seeds.push({
        ...meta,
        key: gid,
        questions,
        schemes,
        group: { def, stimulus: stimulusDef(stim, stimulusId) },
        batchId: batch.id,
      })
      continue
    }

    done.add(q.id)
    const i = index.get(q.id)!
    const c = intakeToDef(q, { qid: qid(i), newPartId: (j) => `${qid(i)}-p${j + 1}` })
    seeds.push({
      ...meta,
      key: qid(i),
      questions: [c.question],
      schemes: c.schemes,
      batchId: batch.id,
    })
  }
  return seeds
}
