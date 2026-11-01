/**
 * The three quality gates of v2-question-bank 4.8 as pure functions over the port's gate data.
 * Each returns the `fields` map of failures (empty = the gate holds). One rule per named block, in the
 * order of `QUESTION_WORKFLOW_GATE_RULES`. A field the bank reports as satisfied passes.
 *
 * "No bypass": the same functions run for single transitions, bulk actions,
 * imports and direct creation as review / approved.
 */
import type { QuestionGateData } from '../ports'
import { checkDskpGate } from '../../dskp-gate'
import { checkKeysGate, checkTagGate, leavesOf } from './keys-gate'

export type GateName = 'submit' | 'approve'
export type GateFields = Record<string, string>

export const GATE_MESSAGES = {
  requiredField: 'Medan wajib belum diisi.',
  lowConfidence: 'Sila sahkan atau sunting medan ini.',
  subjectId: 'Sila pilih subjek.',
  educationLevelId: 'Sila pilih tahap pendidikan.',
  chapterId: 'Sila pilih bab.',
  duplicate: 'Soalan ini ditandakan pendua. Selesaikan atau tandakan "Bukan pendua".',
  source: 'Sila nyatakan sumber soalan.',
  reviewerAi: 'Penyemak tidak boleh perkhidmatan AI.',
  marksTotal: 'Jumlah markah soalan tidak sama dengan jumlah markah bahagian.',
  media: 'Rujukan stimulus atau gambar rajah belum dipadankan dengan fail yang dimuat naik.',
  rights: 'Sila isi pengisytiharan hak cipta (bukan "belum jelas").',
} as const

export const GATE_SUMMARY: Record<GateName, string> = {
  submit: 'Soalan belum memenuhi syarat untuk dihantar semakan.',
  approve: 'Soalan belum memenuhi syarat untuk diterbitkan.',
}

/** Submit gate (draft to review). */
export function submitGate(d: QuestionGateData): GateFields {
  const f: GateFields = {}
  for (const name of d.missingRequiredFields) f[name] = GATE_MESSAGES.requiredField // required fields of the type
  for (const name of d.unconfirmedLowConfidenceFields) f[name] ??= GATE_MESSAGES.lowConfidence // low-confidence confirmed
  if (d.subjectId === null) f.subjectId = GATE_MESSAGES.subjectId // subject, level, chapter set
  if (d.educationLevelId === null) f.educationLevelId = GATE_MESSAGES.educationLevelId
  if (d.chapterId === null) f.chapterId = GATE_MESSAGES.chapterId
  if (d.hasOpenDuplicateFlag) f.duplicate = GATE_MESSAGES.duplicate // duplicate resolved
  if (!d.hasSourceDeclaration) f.source = GATE_MESSAGES.source // source declaration
  return f
}

/** Approve gate part 1 (review to approved, run first by the merged `approve` gate). `reviewerIsAi` is true only when the AI service is the actor. */
export function approveGate(d: QuestionGateData, reviewerIsAi = false): GateFields {
  const f: GateFields = {}
  if (reviewerIsAi || d.lastEditedByAi) f.reviewer = GATE_MESSAGES.reviewerAi // reviewer is not the AI service
  Object.assign(f, checkTagGate(d)) // tags valid against the taxonomy
  if (d.marks !== null) {
    const sum = leavesOf(d.parts).reduce((s, { leaf }) => s + leaf.marks, 0)
    if (sum !== d.marks) f.marks = GATE_MESSAGES.marksTotal // marks total = sum of part marks
  }
  if (!d.mediaResolved) f.media = GATE_MESSAGES.media // media resolves
  return f
}

/** Approve gate part 2 (formerly the publish gate, merged by ADR-0027): keys, difficulty, DSKP topic, rights, duplicates. */
export function publishGate(d: QuestionGateData): GateFields {
  const f: GateFields = {}
  Object.assign(f, checkKeysGate(d.parts)) // answer key / mark scheme (marks agree with the scheme)
  Object.assign(f, checkTagGate(d)) // difficulty TP, DSKP unit and SP chosen from the curriculum
  if (d.rightsStatus === null || d.rightsStatus === 'unclear') f.rightsStatus = GATE_MESSAGES.rights // not "belum jelas"
  if (d.hasOpenDuplicateFlag) f.duplicate = GATE_MESSAGES.duplicate // no open duplicate flag
  // R1-B05 (ADR-0031): DSKP complete for a NEW approval of an SPM-bound question: a cognitive level on every leaf, and the kertas.
  Object.assign(f, checkDskpGate({ parts: d.parts, tp: d.tp, unitId: d.unitId, spIds: d.spIds, paperCode: d.paperCode ?? null, spmBound: d.spmBound ?? false }))
  return f
}

export const GATES: Record<GateName, (d: QuestionGateData) => GateFields> = {
  submit: submitGate,
  // ADR-0027: one merged gate, review to approved ("Terbitkan"): the former approve rules, then the former publish rules.
  approve: (d) => ({ ...approveGate(d), ...publishGate(d) }),
}
