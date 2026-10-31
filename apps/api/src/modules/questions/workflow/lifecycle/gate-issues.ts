import type { QuestionGateIssue } from '@pp/contract'

import type { GateFields } from './gates'

/**
 * `{ path, code, message, step }` of a gate failure (R1-B05). The gates return a `fields` map (path -> BM message, the 422 shape);
 * this adds the stable code and the wizard step (1 Kertas, 2 Rangsangan, 3 Sub-bahagian, 4 Tag & pengelasan) the Studio needs.
 */
const BY_KEY: Readonly<Record<string, { code: string; step: 1 | 2 | 3 | 4 }>> = {
  kertas: { code: 'KERTAS_MISSING', step: 1 },
  stem: { code: 'REQUIRED_FIELD', step: 1 },
  media: { code: 'MEDIA_UNRESOLVED', step: 2 },
  marks: { code: 'MARKS_MISMATCH', step: 3 },
  subjectId: { code: 'SUBJECT_MISSING', step: 4 },
  educationLevelId: { code: 'LEVEL_MISSING', step: 4 },
  chapterId: { code: 'CHAPTER_MISSING', step: 4 },
  unitId: { code: 'UNIT_MISSING', step: 4 },
  spIds: { code: 'SP_MISSING', step: 4 },
  tp: { code: 'TP_MISSING', step: 4 },
  rightsStatus: { code: 'RIGHTS_MISSING', step: 4 },
  duplicate: { code: 'DUPLICATE_OPEN', step: 4 },
  source: { code: 'SOURCE_MISSING', step: 4 },
  reviewer: { code: 'REVIEWER_IS_AI', step: 4 },
  year: { code: 'LOW_CONFIDENCE', step: 4 },
}

function describe(path: string): { code: string; step: 1 | 2 | 3 | 4 } {
  const known = BY_KEY[path]
  if (known) return known
  if (/^parts\..+\.cognitiveLevel$/.test(path)) return { code: 'LEAF_COGNITIVE_LEVEL_MISSING', step: 3 }
  if (/^parts\..+\.difficultyTp$/.test(path)) return { code: 'LEAF_TP_MISSING', step: 3 }
  if (/^parts\..+\.key$/.test(path)) return { code: 'KEY_MARKS_MISMATCH', step: 3 }
  if (path.startsWith('parts')) return { code: 'PART_INVALID', step: 3 }
  return { code: 'GATE_FAILED', step: 3 }
}

export function gateIssuesOf(fields: GateFields): QuestionGateIssue[] {
  return Object.entries(fields).map(([path, message]) => ({ path, message, ...describe(path) }))
}
