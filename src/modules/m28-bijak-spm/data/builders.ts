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

/** Matematik topics whose content belongs to Tingkatan 1-3 (Q-S2: formOrigin T1-T3, unit null). */
const MAT_T1_T3 = new Set([
  'Pecahan',
  'Peratusan',
  'Bentuk piawai',
  'Persamaan linear',
  'Ungkapan algebra',
  'Pemfaktoran',
  'Indeks',
  'Statistik',
  'Laju, jarak dan masa',
  'Poligon',
  'Teorem Pythagoras',
  'Bulatan',
  'Perimeter',
  'Luas',
])
const T5_TOPICS = new Set(['Kebarangkalian'])

/**
 * Curriculum tag for a seed question (exam schema D9). The DSKP unit codes are not loaded in this
 * prototype, so `unit` stays null (always for T1-T3 content) and `unitLabel` names the topic.
 */
export function curr(subject: string, unitLabel: string, tp = 2): CurriculumTag {
  const t13 = subject === 'MAT' && MAT_T1_T3.has(unitLabel)
  return {
    subject,
    level: 'T4+T5',
    unit: null,
    unitLabel,
    sp: [],
    tp,
    formOrigin: t13 ? 'T1-T3' : T5_TOPICS.has(unitLabel) ? 'T5' : 'T4',
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
    topic: string
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
    curriculum: curr(args.subject ?? 'MAT', args.topic),
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
