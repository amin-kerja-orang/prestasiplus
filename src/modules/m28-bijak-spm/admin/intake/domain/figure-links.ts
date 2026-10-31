/**
 * One figure, every question that names it (D90). The same reading as the API (`apps/api/.../figure-links.ts`), so the
 * mock and the real server link alike: "Rajah 1", "Figure 1", "Jadual 2" in a question's text point at the stimulus whose
 * label is that name. Pure.
 */
import type { IntakeQuestion, IntakeStimulus } from '../types'

const WORDS: Readonly<Record<string, string>> = {
  rajah: 'rajah', figure: 'rajah', diagram: 'rajah', gambar: 'rajah',
  jadual: 'jadual', table: 'jadual', graf: 'graf', graph: 'graf',
  petikan: 'petikan', passage: 'petikan', peta: 'peta', map: 'peta', carta: 'carta', chart: 'carta',
}
const REF = /(?<![\p{L}\p{N}])(rajah|figure|diagram|gambar|jadual|table|graf|graph|petikan|passage|peta|map|carta|chart)\s*(\d{1,3}(?:\.\d{1,2})?)(?![\p{N}])/giu

export function figureKeys(text: string): string[] {
  const keys: string[] = []
  for (const m of text.matchAll(REF)) {
    const word = WORDS[(m[1] as string).toLowerCase()]
    if (word === undefined) continue
    const key = `${word}${m[2] as string}`
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

export const stimulusKey = (label: string): string | null => figureKeys(label)[0] ?? null

/** Stem, options and part prompts. */
export const questionText = (q: IntakeQuestion): string =>
  [q.stem, ...q.options.map((o) => o.text), ...q.parts.map((p) => p.prompt)].join(' \n ')

/** Ids of the questions without a stimulus whose text names this stimulus. */
export function referencingQuestionIds(questions: readonly IntakeQuestion[], stimulus: Pick<IntakeStimulus, 'label'>): string[] {
  const key = stimulusKey(stimulus.label)
  if (key === null) return []
  return questions.filter((q) => !q.stimulusId && figureKeys(questionText(q)).includes(key)).map((q) => q.id)
}
