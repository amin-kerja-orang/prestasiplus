/**
 * SRS M05 v1.17 §7 #18 `GET /api/spm-targets` and #19 `PUT /api/spm-targets` (S15, BR-22, BR-26,
 * BR-27). Any session (A); every target is the viewer's own (SEC-M05-06).
 *
 * #18 lists the 20 SPM subjects of BR-22 in order with the viewer's target and, only when the
 * test fixture `mock.setSpmProgress` set progress for the subject (BR-27, LS-10: the live source is
 * UNVERIFIED), `answered`, `accuracyPct`, `band` and `predictedGrade`; otherwise those four are
 * `0` / `null` and the row reads "Belum mula".
 *
 * #19 replaces all 20 values (BR-26): a missing subject or `''` clears its target. A subject outside
 * the 20 or a grade outside the nine accepted ones is `422 VALIDATION_ERROR` "Gred target tidak
 * sah." and nothing is saved.
 */

import { ok, requireAuth, route, validationError, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { SpmGrade } from '../datasets/types'
import { fixtures } from '../hooks/fixtures'
import { practiceRepo } from '../repository/practice'
import {
  SPM_TARGET_SUBJECT_IDS,
  band,
  isSpmGrade,
  predictedGrade,
} from '../repository/structured-rules'
import { round, userIdOf } from './common'

/** §8.3 success flash (UNVERIFIED COPY). */
export const TARGETS_SAVED = 'Target berjaya disimpan.'
/** §5 server message (UNVERIFIED COPY). */
export const TARGETS_INVALID = 'Gred target tidak sah.'

export const targetRoutes: RouteDef[] = [
  route('GET', '/api/spm-targets', [requireAuth()], (req) => {
    const userId = userIdOf(req)
    const targets = new Map(
      practiceRepo.spmTargets(userId).map((t) => [t.subjectId, t.targetGrade]),
    )
    const subjects = SPM_TARGET_SUBJECT_IDS.map((id) => {
      const progress = fixtures.spmProgress(userId, id)
      const started = progress !== undefined && progress.answered > 0
      // BR-27: band and grade use the unrounded accuracy; only the shown figure is rounded.
      const raw = started ? (progress.correct / progress.answered) * 100 : null
      return {
        id,
        name: curriculum.subject(id)?.name ?? '',
        target: targets.get(id) ?? null,
        answered: started ? progress.answered : 0,
        accuracyPct: raw === null ? null : round(raw, 1),
        band: raw === null ? null : band(raw),
        predictedGrade: raw === null ? null : predictedGrade(raw),
      }
    })
    return ok({ subjects })
  }),

  route('PUT', '/api/spm-targets', [requireAuth()], (req, ctx) => {
    const body =
      typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
    const given = body.targets
    if (typeof given !== 'object' || given === null || Array.isArray(given)) {
      return validationError({ targets: TARGETS_INVALID }, TARGETS_INVALID)
    }
    const known = new Set<number>(SPM_TARGET_SUBJECT_IDS)
    const errors: Record<string, string> = {}
    const grades = new Map<number, SpmGrade | null>(SPM_TARGET_SUBJECT_IDS.map((id) => [id, null]))
    for (const [key, value] of Object.entries(given)) {
      // Canonical keys only: "01" is not subject 1.
      const id = /^\d+$/.test(key) && String(Number(key)) === key ? Number(key) : NaN
      if (!known.has(id) || (value !== '' && !isSpmGrade(value))) {
        errors[`targets.${key}`] = TARGETS_INVALID
        continue
      }
      grades.set(id, value === '' ? null : (value as SpmGrade))
    }
    if (Object.keys(errors).length > 0) return validationError(errors, TARGETS_INVALID)
    practiceRepo.saveSpmTargets(userIdOf(req), grades, ctx.clock.now())
    return ok({ saved: SPM_TARGET_SUBJECT_IDS.length }, { status: TARGETS_SAVED })
  }),
]
