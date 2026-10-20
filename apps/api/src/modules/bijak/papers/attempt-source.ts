import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../db/ids'
import { PapersRepository } from './papers.repository'
import { BijakPapersPorts } from './ports'
import { ruleOf } from './rules'
import { bijakCodeOf } from './subject-codes'

/*
 * The types below MIRROR `apps/api/src/modules/bijak/attempts/ports.ts` of BE-16 (`AttemptPaper`,
 * `PaperResolution`, `BijakPaperSource`) and `SectionSnapshot` of the prototype domain. They are
 * declared here, not imported, because BE-16 is not on this branch (it owns `bijak/attempts/**`).
 * TypeScript compares them structurally, so `BijakPapersAttemptSource` is assignable to BE-16's
 * `BijakPaperSource`. Keep them identical to BE-16 when either side changes.
 */
export interface AttemptSectionSnapshot {
  /** The section's wire id (`paper_sections.id` as a decimal string). */
  id: string
  label: string
  compulsory?: boolean
  instruction?: string
  rule: { type: 'all' } | { type: 'choose'; n: number }
  questionIds: string[]
}

export interface AttemptPaper {
  id: string
  kind: 'pilihan' | 'jana'
  title: string
  /**
   * The BIJAK subject code (MAT, SN, SEJ), never the curriculum code (MATH, SCI). BE-16 stores it as
   * `exam_attempts.subject` and BE-12 as the aggregate `subject_code`. A reader filtering by a curriculum
   * code (BE-19, BE-21) converts with `bijakCodeOf` / `curriculumCodeOf` from `bijak/papers` (#45 M6).
   */
  subject: string
  subjectName: string
  kertas: number
  code: string
  durationMin: number
  sections: AttemptSectionSnapshot[]
}

export type PaperResolution =
  | { ok: true; paper: AttemptPaper }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_eligible' }

export interface BijakPaperSource {
  resolveForAttempt(input: { userId: string; paperId: string; isTest: boolean }): Promise<PaperResolution>
}

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
 * WIRE-UP (main session, after BE-15 and BE-16 are both merged): in `BijakAttemptsModule`
 * (or an `onModuleInit` of a module that imports both), call
 * `attemptPorts.providePaperSource(inject(BijakPapersAttemptSource))`.
 * TODO(BE-15/BE-16): this module deliberately does NOT register itself, because
 * `BijakAttemptPorts` does not exist on this branch.
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
