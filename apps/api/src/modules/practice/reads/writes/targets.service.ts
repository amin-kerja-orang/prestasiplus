import { Inject, Injectable } from '@nestjs/common'
import type { PracticeReadSpmTargets } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idToString } from '../../../../db/ids'
import { CurriculumRepository } from '../../../curriculum'
import { canonicalId, isSpmGrade, MESSAGES, SPM_TARGET_SUBJECT_CODES } from './rules'
import { SpmTargetsRepository } from './targets.repository'

export interface TargetsCaller {
  userId: string
  isTest: boolean
}

const invalid = (fields: Record<string, string>): ApiError =>
  ApiError.of('VALIDATION_ERROR', { message: MESSAGES.targetsInvalid, fields })

@Injectable()
export class SpmTargetsService {
  constructor(
    @Inject(SpmTargetsRepository) private readonly repo: SpmTargetsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The 20 SPM subjects (BR-22) as `[id, name]` in display order; a code missing from the catalogue is skipped. */
  private async subjects(): Promise<{ id: string; name: string }[]> {
    const all = await this.curriculum.subjects()
    const byCode = new Map(all.map((s) => [s.code, s]))
    return SPM_TARGET_SUBJECT_CODES.flatMap((code) => {
      const s = byCode.get(code)
      return s ? [{ id: idToString(s.id), name: s.name }] : []
    })
  }

  /**
   * #18. `answered`, `accuracyPct`, `band` and `predictedGrade` are 0 / null ("Belum mula"): the mock only
   * fills them from a test fixture (BR-27, LS-10), so the v2 source is an open question (BE-13 report).
   */
  async list(caller: TargetsCaller): Promise<PracticeReadSpmTargets> {
    const [subjects, targets] = await Promise.all([this.subjects(), this.repo.forUser(caller.userId)])
    return {
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        target: (targets.get(s.id) ?? null) as PracticeReadSpmTargets['subjects'][number]['target'],
        answered: 0,
        accuracyPct: null,
        band: null,
        predictedGrade: null,
      })),
    }
  }

  /**
   * #19: replaces all 20 values (BR-26). A key outside the 20 (or not canonical), a grade outside the nine,
   * or a body without a `targets` object is 422 "Gred target tidak sah." and nothing is saved.
   */
  async save(caller: TargetsCaller, body: unknown): Promise<{ saved: number }> {
    const given = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).targets : undefined
    if (typeof given !== 'object' || given === null || Array.isArray(given)) throw invalid({ targets: MESSAGES.targetsInvalid })
    const subjects = await this.subjects()
    const known = new Set(subjects.map((s) => s.id))
    const errors: Record<string, string> = {}
    const grades = new Map<string, string>()
    for (const [key, value] of Object.entries(given)) {
      const id = canonicalId(key)
      if (id === null || !known.has(id) || (value !== '' && !isSpmGrade(value))) {
        errors[`targets.${key}`] = MESSAGES.targetsInvalid
        continue
      }
      if (value !== '') grades.set(id, value as string)
    }
    if (Object.keys(errors).length > 0) throw invalid(errors)
    await this.repo.replace(caller.userId, [...known], grades, caller.isTest, this.clock.now())
    return { saved: subjects.length }
  }
}
