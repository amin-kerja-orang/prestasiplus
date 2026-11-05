import { INTAKE_GATE_MESSAGES, type QuestionGateIssue } from '@pp/contract'

import { PUBLISH_TAG_MESSAGES } from '../../errors'
import { GATE_MESSAGES, type GateFields } from './gates'

/**
 * `{ path, code, message, step }` of a gate failure (R1-B05). The gates return a `fields` map (path -> BM message, the 422 shape);
 * this adds the stable code and the wizard step (1 Kertas, 2 Rangsangan, 3 Sub-bahagian, 4 Tag & pengelasan) the Studio needs.
 */
const BY_KEY: Readonly<Record<string, { code: string; step: 1 | 2 | 3 | 4 }>> = {
  kertas: { code: 'NO_KERTAS', step: 1 },
  questionText: { code: 'REQUIRED_FIELD', step: 1 },
  parts: { code: 'REQUIRED_FIELD', step: 3 },
  // The low-confidence fields use the intake names; `gateIssuesOf` gives them the LOW_CONFIDENCE code, this only places them on a step.
  stem: { code: 'LOW_CONFIDENCE', step: 1 },
  options: { code: 'LOW_CONFIDENCE', step: 3 },
  media: { code: 'MEDIA_UNRESOLVED', step: 2 },
  marks: { code: 'MARKS_MISMATCH', step: 3 },
  subjectId: { code: 'NO_SUBJECT', step: 4 },
  educationLevelId: { code: 'NO_LEVEL', step: 4 },
  unitId: { code: 'NO_UNIT', step: 4 },
  spIds: { code: 'NO_SP', step: 4 },
  tp: { code: 'TP_MISSING', step: 4 },
  chapterId: { code: 'NO_CHAPTER', step: 4 },
  difficultyLevel: { code: 'NO_DIFFICULTY', step: 4 },
  duplicate: { code: 'DUPLICATE_OPEN', step: 4 },
  reviewer: { code: 'REVIEWER_IS_AI', step: 4 },
  year: { code: 'LOW_CONFIDENCE', step: 4 },
}

/** True for the text of `INTAKE_GATE_MESSAGES.spNotInTaxonomy(code)`, whatever the code. */
const isSpOutside = (message: string): boolean => {
  const [head, tail] = INTAKE_GATE_MESSAGES.spNotInTaxonomy('\u0000').split('\u0000') as [string, string]
  return message.startsWith(head) && message.endsWith(tail)
}

function describe(path: string): { code: string; step: 1 | 2 | 3 | 4 } {
  const known = BY_KEY[path]
  if (known) return known
  if (/^parts\..+\.cognitiveLevel$/.test(path)) return { code: 'LEAF_NO_ARAS', step: 3 }
  if (/^parts\..+\.difficultyTp$/.test(path)) return { code: 'LEAF_NO_TP', step: 3 }
  if (/^parts\..+\.key$/.test(path)) return { code: 'KEY_MARKS_MISMATCH', step: 3 }
  if (path.startsWith('parts')) return { code: 'PART_INVALID', step: 3 }
  return { code: 'GATE_FAILED', step: 3 }
}

export function gateIssuesOf(fields: GateFields): QuestionGateIssue[] {
  return Object.entries(fields).map(([path, message]) => {
    const found = describe(path)
    // A low-confidence field the reviewer has not confirmed (the submit gate) is its own kind of issue, on whatever step the field belongs to.
    if (message === GATE_MESSAGES.lowConfidence) return { path, message, code: 'LOW_CONFIDENCE', step: found.step }
    // Two paths carry a second kind of item, told apart by its text: STEM_SHORT on `questionText` (step 1), and an SP outside the unit on `spIds`.
    if (path === 'questionText' && message === PUBLISH_TAG_MESSAGES.stem) return { path, message, code: 'STEM_SHORT', step: 1 }
    if (path === 'spIds' && message !== PUBLISH_TAG_MESSAGES.spIds && isSpOutside(message)) return { path, message, code: 'SP_NOT_IN_TAXONOMY', step: 4 }
    return { path, message, ...found }
  })
}
