/** Authoring helpers for the seed bank. All content is fictitious (no real papers or people). */
import type {
  CurriculumTag,
  GroupDef,
  LeafKind,
  McqOption,
  PartDef,
  PoolEntry,
  QuestionDef,
  SchemeDef,
  StimulusDef,
} from '../domain/types'

/**
 * Placeholder tag for a seed question. The seed unit labels were free text, not catalogue nodes, so
 * the real tag (tingkatan, unit, SP, TP, or the review flag) is not authored here: `seed-tags.ts`
 * holds one row per seed question and `applySeedTags` replaces this placeholder at load.
 */
export function untagged(subject: string): CurriculumTag {
  return {
    subject,
    formOrigin: null,
    unitId: null,
    spIds: [],
    tp: null,
    kbat: null,
    catalogueVersion: null,
  }
}

export class Bank {
  readonly questions = new Map<string, QuestionDef>()
  readonly schemes = new Map<string, SchemeDef>()
  readonly stimuli = new Map<string, StimulusDef>()
  readonly groups = new Map<string, GroupDef>()
  readonly pool: PoolEntry[] = []

  addQuestion(q: QuestionDef, pool?: string): void {
    this.questions.set(q.id, q)
    if (pool) this.pool.push({ questionId: q.id, pool })
  }

  addGroup(group: GroupDef, stimulus: StimulusDef): void {
    this.stimuli.set(stimulus.id, stimulus)
    this.groups.set(group.id, group)
    for (const id of group.questionIds) {
      const q = this.questions.get(id)
      if (q) q.groupId = group.id
    }
  }
}

/** Small deterministic hash so the correct MCQ option is not always the same letter. */
function slot(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 4
}

/** Three distinct wrong answers, none equal to the correct one. */
export function distinct(
  correct: string,
  candidates: string[],
  fallback: (i: number) => string,
): string[] {
  const seen = new Set([correct])
  const out: string[] = []
  for (const c of candidates) {
    if (!seen.has(c)) {
      seen.add(c)
      out.push(c)
    }
    if (out.length === 3) return out
  }
  for (let i = 1; out.length < 3; i++) {
    const c = fallback(i)
    if (!seen.has(c)) {
      seen.add(c)
      out.push(c)
    }
  }
  return out
}

export function mcqQuestion(
  bank: Bank,
  args: {
    id: string
    subject?: string
    stem: string
    correct: string
    wrong: string[]
    reason: string
    pool?: string
    marks?: number
  },
): QuestionDef {
  const wrong = args.wrong.slice(0, 3)
  const options: McqOption[] = []
  const at = slot(args.id)
  let w = 0
  for (let i = 0; i < 4; i++) {
    const id = `${args.id}-o${i + 1}`
    options.push({ id, text: i === at ? args.correct : (wrong[w++] ?? '') })
  }
  const q: QuestionDef = {
    id: args.id,
    curriculum: untagged(args.subject ?? 'MAT'),
    stem: args.stem,
    mcq: { options },
  }
  bank.addQuestion(q, args.pool)
  bank.schemes.set(args.id, {
    kind: 'option',
    marks: args.marks ?? 1,
    correct: options[at]!.id,
    reason: args.reason,
  })
  return q
}

export const leaf = (
  id: string,
  label: string,
  prompt: string,
  marks: number,
  kind: LeafKind,
  unit?: string,
): PartDef => ({ id, label, prompt, marks, answer: { kind, ...(unit ? { unit } : {}) } })

export const branch = (
  id: string,
  label: string,
  prompt: string,
  children: PartDef[],
): PartDef => ({
  id,
  label,
  prompt,
  marks: 0,
  children,
})
