import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../db/ids'
import { PapersRepository } from './papers.repository'
import { BijakPapersPorts } from './ports'
import { ruleOf } from './rules'
import { bijakCodeOf } from './subject-codes'
import type { AttemptPaper, BijakPaperSource, PaperResolution } from '../attempts/ports'

/*
 * The attempt-side types are BE-16's own (`bijak/attempts/ports.ts`); they used to be mirrored here
 * while the two cards lived on separate branches. Importing them (type-only) means a drift is now
 * a compile error instead of a silent mismatch.
 */
export type { AttemptPaper, BijakPaperSource, PaperResolution }
export type AttemptSectionSnapshot = AttemptPaper['sections'][number]

/**
 * Attempt eligibility for BE-16 (`BijakPaperSource`).
 *
 * - `not_found`: unknown or malformed id, a paper that is not `published`, or a generated (Jana)
 *   paper of another user. No hint which of the three (the same 404 as the cover).
 * - `not_eligible`: the paper exists for this user but cannot be sat now: it has no placed question,
 *   or a placed question is not (or no longer) published in the question bank (checked through the
 *   `BijakQuestionSource` port; a question the source does not return is not eligible).
 *
 * `isTest` is the caller's Mod Pelajar flag. It does not widen access: test data is flagged on the
 * rows the caller writes, never used to see another user's paper. No answer key is read here.
 *
 * Registered with `BijakAttemptPorts.providePaperSource` by `BijakIntegrationModule`
 * (`bijak/integration`), which imports both cards.
 */
@Injectable()
export class BijakPapersAttemptSource implements BijakPaperSource {
  constructor(
    @Inject(PapersRepository) private readonly repo: PapersRepository,
    @Inject(BijakPapersPorts) private readonly ports: BijakPapersPorts,
  ) {}

  async resolveForAttempt(input: { userId: string; paperId: string; isTest: boolean }): Promise<PaperResolution> {
    let id: bigint
    try {
      id = idFromString(input.paperId)
    } catch {
      return { ok: false, reason: 'not_found' }
    }
    const paper = await this.repo.findPaper(id)
    if (!paper || paper.status !== 'published') return { ok: false, reason: 'not_found' }
    if (paper.kind === 'jana' && paper.generatedForUserId?.toString() !== input.userId) return { ok: false, reason: 'not_found' }

    const questionIds = paper.sections.flatMap((s) => s.placements.map((p) => idToString(p.questionId)))
    if (questionIds.length === 0) return { ok: false, reason: 'not_eligible' }
    const info = await this.ports.questionSource.getMany([...new Set(questionIds)])
    if (questionIds.some((q) => !info.has(q))) return { ok: false, reason: 'not_eligible' }

    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const code = subject ? bijakCodeOf(subject.code) : ''
    return {
      ok: true,
      paper: {
        id: idToString(paper.id),
        kind: paper.kind === 'jana' ? 'jana' : 'pilihan',
        title: paper.title,
        subject: code,
        subjectName: subject?.name ?? code,
        kertas: paper.kertas,
        code: paper.paperCode ?? '',
        durationMin: paper.printedDurationMin,
        sections: paper.sections.map((s) => ({
          id: idToString(s.id),
          label: s.label,
          ...(s.compulsory ? { compulsory: true } : {}),
          ...(s.instruction ? { instruction: s.instruction } : {}),
          rule: ruleOf(s.ruleType, s.ruleN),
          questionIds: s.placements.map((p) => idToString(p.questionId)),
        })),
      },
    }
  }
}
