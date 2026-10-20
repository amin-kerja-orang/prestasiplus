import type { BijakAttemptPartAnswer, BijakAttemptSavePayload, BijakAttemptSubmitPayload } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { PAYLOAD_LIMITS as L, PAYLOAD_MESSAGES as M } from './attempts.constants'

function answerTooBig(a: BijakAttemptPartAnswer): boolean {
  if (a.steps && (a.steps.length > L.steps || a.steps.some((s) => s.length > L.stepChars))) return true
  if (a.final !== undefined && a.final.length > L.finalChars) return true
  if (a.unit !== undefined && a.unit.length > L.unitChars) return true
  if (a.text !== undefined && a.text.length > L.textChars) return true
  if (a.choice !== undefined && a.choice.length > 64) return true
  if (a.photos && a.photos.length > 3) return true
  if (a.photos?.some((p) => p.name.length > L.photoNameChars)) return true
  if (a.plain && (a.plain.final.length > L.plainChars || a.plain.steps.length > L.steps || a.plain.steps.some((s) => s.length > L.plainChars))) {
    return true
  }
  return false
}

function fail(fields: Record<string, string>): never {
  throw ApiError.of('VALIDATION_ERROR', { fields })
}

/** Caps beyond the contract schema (422 `fields`). Throws on the first violation; no side effects. */
export function assertAttemptPayload(payload: BijakAttemptSavePayload | BijakAttemptSubmitPayload): void {
  if (payload.changes.length > L.changes) fail({ changes: M.tooMany })
  payload.changes.forEach((c, i) => {
    if (c.rev > L.rev) fail({ [`changes.${i}.rev`]: M.revRange })
    if (answerTooBig(c.answer)) fail({ [`changes.${i}.answer`]: M.tooLong })
  })
  if (payload.flags && payload.flags.length > L.flags) fail({ flags: M.tooMany })
  if (payload.picks) {
    const entries = Object.entries(payload.picks)
    if (entries.length > L.picksSections || entries.some(([, ids]) => ids.length > L.picksPerSection)) fail({ picks: M.tooMany })
  }
  if (payload.position !== undefined && payload.position > L.position) fail({ position: M.revRange })
  if ('answers' in payload && payload.answers) {
    const entries = Object.entries(payload.answers)
    if (entries.length > L.carriedAnswers) fail({ answers: M.tooMany })
    for (const [partId, v] of entries) {
      if (v.rev > L.rev) fail({ [`answers.${partId}.rev`]: M.revRange })
      if (answerTooBig(v.answer)) fail({ [`answers.${partId}.answer`]: M.tooLong })
    }
  }
}
