/**
 * Loose types of the PoC export (`poc-bank.ts`). Only the parts the papers module reads are typed
 * strictly (papers, blueprints, pools, groups, question structure for marks); question content and
 * mark schemes are carried as data for the future question loader.
 */
export type PocRule = { type: 'all' } | { type: 'choose'; n: number }

export interface PocPart {
  id: string
  label: string
  prompt: string
  /** Marks of a leaf part; 0 on a part that only holds children. */
  marks: number
  answer?: { kind: string; unit?: string; wordRange?: { min: number; max: number } }
  children?: PocPart[]
}

export interface PocQuestion {
  id: string
  curriculum: {
    subject: string
    level: string
    unit: string | null
    unitLabel: string
    sp: string[]
    tp: number
    formOrigin: string
  }
  groupId?: string
  stem: string
  mcq?: { options: { id: string; text: string }[] }
  parts?: PocPart[]
}

export interface PocSection {
  id: string
  label: string
  title?: string
  markBudget: number
  questionCount: number
  compulsory?: boolean
  instruction?: string
  rule: PocRule
  questionIds: string[]
}

export type PocReferencePanel = { title: string; items: string[] }

export interface PocPaper {
  id: string
  title: string
  subject: string
  kertas: number
  year: number
  code: string
  durationMin: number
  instructions: string[]
  reference?: PocReferencePanel[]
  sections: PocSection[]
}

export interface PocBlueprintSection {
  label: string
  markBudget?: number
  compulsory?: boolean
  instruction?: string
  rule: PocRule
  pool: string
  take: number
}

export interface PocBlueprint {
  subject: string
  kertas: number
  source: 'Disahkan' | 'Spec' | 'Draf'
  code: string
  durationMin: number
  instructions: string[]
  reference?: PocReferencePanel[]
  sections: PocBlueprintSection[]
}

export interface PocBank {
  subjects: { code: string; name: string }[]
  papers: PocPaper[]
  blueprints: PocBlueprint[]
  pool: { questionId: string; pool: string }[]
  groups: { id: string; stimulusId: string; optionBank?: { id: string; text: string }[]; questionIds: string[] }[]
  stimuli: { id: string; kind: string; label: string; [k: string]: unknown }[]
  questions: PocQuestion[]
  /** Answer keys / mark schemes, keyed by question id (MCQ) or part id. Never returned by BE-15. */
  schemes: { id: string; scheme: { kind: string; marks: number; [k: string]: unknown } }[]
}
