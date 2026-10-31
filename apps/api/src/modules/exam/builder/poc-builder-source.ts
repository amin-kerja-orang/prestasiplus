/**
 * PoC question source of the paper builder (BE-39): serves the PoC bank of BE-15 under its reserved
 * decimal question ids until the BE-09/BE-10 question bank provides the real source. All PoC
 * questions are published at version 1 (a requested `versionNo` is ignored). Group, part, option and
 * stimulus ids stay the PoC keys. Helpers are ports of the prototype `admin.ts` (`kindOf`, `marksOf`,
 * `kertasOf`, `previewOf`, `describeScheme`, `reviewQuestion`, `previewQuestions`).
 */
import {
  BIJAK_BUILDER_SCHEME_LINES as SCHEME_LINES,
  type BijakAttemptOption,
  type BijakAttemptStimulus,
  type BijakBuilderQuestionKind,
  type BijakBuilderReviewQuestion,
} from '@pp/contract'

import { POC_BANK, pocQuestionId, pocQuestionKey, pocQuestionMarks } from '../../bijak/papers/poc'
import type { PocPart, PocQuestion } from '../../bijak/papers/poc'
import { leavesOf, type SchemeDef } from './exam-core.adapter'
import type {
  BuilderCandidateScope,
  BuilderGroupInfo,
  BuilderPreview,
  BuilderQuestionInfo,
  BuilderQuestionRef,
  BuilderQuestionSource,
} from './ports'

type SchemeLine = { tag?: string; text: string; marks?: number }
type ReviewScheme = BijakBuilderReviewQuestion['scheme']

const QUESTIONS = new Map<string, PocQuestion>(POC_BANK.questions.map((q) => [q.id, q]))
const SCHEMES = new Map<string, SchemeDef>(
  POC_BANK.schemes.map((s) => [s.id, s.scheme as unknown as SchemeDef]),
)
const GROUPS = new Map(POC_BANK.groups.map((g) => [g.id, g]))
const STIMULI = new Map(POC_BANK.stimuli.map((s) => [s.id, s]))

/** PoC parts carry `answer.kind` as a loose string; the domain types it as `LeafKind`. */
const leaves = (parts: readonly PocPart[]): ReturnType<typeof leavesOf> =>
  leavesOf(parts as unknown as Parameters<typeof leavesOf>[0])

const wireId = (key: string): string => pocQuestionId(key).toString()
const schemeOf = (id: string): SchemeDef | undefined => SCHEMES.get(id)

function stimulusOf(raw: { id: string; kind: string; label: string; [k: string]: unknown }): BijakAttemptStimulus {
  const out: Record<string, unknown> = { id: raw.id, kind: raw.kind, label: raw.label }
  for (const k of ['caption', 'alt', 'svg', 'text', 'table'] as const) if (raw[k] !== undefined) out[k] = raw[k]
  return out as unknown as BijakAttemptStimulus
}

function stimulusOfGroup(groupId: string): BijakAttemptStimulus | undefined {
  const g = GROUPS.get(groupId)
  const st = g ? STIMULI.get(g.stimulusId) : undefined
  return st ? stimulusOf(st) : undefined
}

function kindOf(q: PocQuestion): BijakBuilderQuestionKind {
  if (q.mcq) return 'objektif'
  const rubric = leaves(q.parts ?? []).some((l) => schemeOf(l.id)?.kind === 'rubric')
  return rubric ? 'esei' : 'berstruktur'
}

function kertasOf(key: string): number {
  const pool = POC_BANK.pool.find((p) => p.questionId === key)?.pool
  const m = pool ? /^[A-Z]+(\d)-/.exec(pool) : null
  if (m) return Number(m[1])
  return POC_BANK.papers.find((p) => p.sections.some((s) => s.questionIds.includes(key)))?.kertas ?? 2
}

function previewOf(q: PocQuestion): string {
  const p = q.parts?.[0]
  return p && !p.children?.length ? `${q.stem} ${p.label} ${p.prompt}` : q.stem
}

function describeScheme(sc: SchemeDef): SchemeLine[] {
  switch (sc.kind) {
    case 'option':
      return [{ text: sc.reason }]
    case 'accepted':
      return sc.values.map((v) => ({ text: SCHEME_LINES.accepted(v.v, v.unit) }))
    case 'mapping':
      return Object.entries(sc.map).map(([k, v]) => ({ text: SCHEME_LINES.mapping(k, v) }))
    case 'rubric':
      return [
        ...sc.bands.map((b) => ({ text: SCHEME_LINES.rubricBand(b.name, b.range[0], b.range[1], b.descriptor) })),
        ...(sc.notes ?? []).map((n) => ({ text: n })),
      ]
    case 'points': {
      const count = new Map<string, number>()
      const lines: SchemeLine[] = sc.points.map((p) => {
        const n = (count.get(p.code) ?? 0) + 1
        count.set(p.code, n)
        return { tag: SCHEME_LINES.pointTag(p.code, n), text: p.label, marks: p.marks }
      })
      if (sc.final) lines.push({ text: SCHEME_LINES.finalAnswer(sc.final.display) })
      return lines
    }
  }
}

function reviewQuestion(q: PocQuestion): BijakBuilderReviewQuestion {
  const id = wireId(q.id)
  const scheme: ReviewScheme = {}
  let correct: string | undefined
  if (q.mcq) {
    const sc = schemeOf(q.id)
    if (sc?.kind === 'option') {
      correct = sc.correct
      scheme[id] = {
        marks: sc.marks,
        lines: [
          { text: SCHEME_LINES.correctOption(q.mcq.options.findIndex((o) => o.id === sc.correct)) },
          ...describeScheme(sc),
        ],
      }
    } else scheme[id] = null
  } else {
    for (const l of leaves(q.parts ?? [])) {
      const sc = schemeOf(l.id)
      scheme[l.id] = sc ? { marks: sc.marks, lines: describeScheme(sc) } : null
    }
  }
  return {
    id,
    stem: q.stem,
    marks: pocQuestionMarks(q),
    curriculum: q.curriculum as BijakBuilderReviewQuestion['curriculum'],
    ...(q.mcq ? { mcq: { options: q.mcq.options, ...(correct ? { correct } : {}) } } : {}),
    ...(q.parts ? { parts: q.parts as BijakBuilderReviewQuestion['parts'] } : {}),
    scheme,
  }
}

function infoOf(q: PocQuestion): BuilderQuestionInfo {
  const stimulus = q.groupId ? stimulusOfGroup(q.groupId) : undefined
  return {
    id: wireId(q.id),
    versionNo: 1,
    status: 'approved',
    subject: q.curriculum.subject,
    kertas: kertasOf(q.id),
    groupId: q.groupId ?? null,
    ...(stimulus ? { stimulusLabel: stimulus.label } : {}),
    preview: previewOf(q),
    marks: pocQuestionMarks(q),
    kind: kindOf(q),
    topic: q.curriculum.unitLabel,
  }
}

const questionOfWire = (id: string): PocQuestion | undefined => {
  const key = pocQuestionKey(id)
  return key ? QUESTIONS.get(key) : undefined
}

export class PocBuilderQuestionSource implements BuilderQuestionSource {
  async describe(refs: readonly BuilderQuestionRef[]): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    const out = new Map<string, BuilderQuestionInfo>()
    for (const ref of refs) {
      const q = questionOfWire(ref.id)
      if (q) out.set(ref.id, infoOf(q))
    }
    return out
  }

  async candidates(scope: BuilderCandidateScope): Promise<string[]> {
    return POC_BANK.questions
      .filter((q) => q.curriculum.subject === scope.subject && kertasOf(q.id) === scope.kertas)
      .map((q) => wireId(q.id))
  }

  async groups(groupIds: readonly string[]): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    const out = new Map<string, BuilderGroupInfo>()
    for (const id of groupIds) {
      const g = GROUPS.get(id)
      const stimulus = g ? stimulusOfGroup(id) : undefined
      if (g && stimulus) out.set(id, { id, stimulus, questionIds: g.questionIds.map(wireId) })
    }
    return out
  }

  async review(ids: readonly string[]): Promise<BuilderPreview> {
    const questions: BijakBuilderReviewQuestion[] = []
    const stimuli: Record<string, BijakAttemptStimulus> = {}
    const optionBanks: Record<string, BijakAttemptOption[]> = {}
    for (const id of ids) {
      const q = questionOfWire(id)
      if (!q) continue
      questions.push(reviewQuestion(q))
      if (q.groupId) {
        const st = stimulusOfGroup(q.groupId)
        if (st) stimuli[q.groupId] = st
        const ob = GROUPS.get(q.groupId)?.optionBank
        if (ob) optionBanks[q.groupId] = ob
      }
    }
    return { questions, stimuli, optionBanks }
  }
}
