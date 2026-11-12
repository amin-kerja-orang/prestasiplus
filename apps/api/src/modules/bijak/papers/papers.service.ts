import { Inject, Injectable } from '@nestjs/common'
import type {
  BijakBlueprintContract,
  BijakCoverUnavailableReason,
  BijakPaperCover,
  BijakPaperSummary,
  BijakPaperSurface,
  BijakSubject,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import { effectiveMarks } from './exam-core.adapter'
import { paperNotFound } from './errors'
import { BijakPapersPorts, type BijakQuestionInfo, type PinRef, placesUnservable } from './ports'
import { PapersRepository, type PaperWithTree, type SubjectRef } from './papers.repository'
import { levelScopeAllows, mytYear, paperCodeOf, referencePanels, ruleOf, sectionInstruction, sourceToWire } from './rules'
import { bijakCodeOf } from './subject-codes'

type Info = ReadonlyMap<string, BijakQuestionInfo>

/**
 * A paper a user may sit, with the placed question ids in order: what the attempts card (BE-16)
 * snapshots when an attempt starts. No content and no keys.
 */
export interface SittablePaper {
  id: string
  kind: 'pilihan' | 'jana'
  title: string
  subject: string
  subjectName: string
  kertas: number
  year: number
  code: string
  durationMin: number
  instructions: string[]
  reference: { title: string; items: string[] }[]
  sections: {
    id: string
    label: string
    title?: string
    instruction?: string
    compulsory: boolean
    markBudget: number
    rule: { type: 'all' } | { type: 'choose'; n: number }
    questionIds: string[]
  }[]
}

/**
 * Bijak SPM papers (M28, BE-15): Kertas Pilihan list and cover, the Kontrak list, and the subject hub.
 * Marks are derived from the placements on every read (Q-S6). No answer key,
 * mark scheme, accepted equivalent, explanation or question id is returned from here (US-15).
 */
@Injectable()
export class PapersService {
  constructor(
    @Inject(PapersRepository) private readonly repo: PapersRepository,
    @Inject(BijakPapersPorts) private readonly ports: BijakPapersPorts,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /* ------------------------------------------------------------------------------ reads */

  async listPapers(userId: string, surface: BijakPaperSurface = 'simulasi'): Promise<BijakPaperSummary[]> {
    // A published paper missing a printed code or a section would break the contract (code min 1,
    // sections min 1): it is not listed (BE-39 may create such rows; they stay out of the hub).
    // A Kertas Subjektif paper has no printed-code field on its form (Q-18): it is listed with the code `K{kertas}` (paperCodeOf).
    // S3-T07: a paper is listed when its `level_scope` includes the pupil's form (see `levelScopeAllows`; no resolvable form = NULL-scoped
    // only), or when the pupil already has a sitting on it (kept so the result and Semakan stay reachable after a re-scope or promotion).
    // Both surfaces: the cover and start apply the same level rule to every `pilihan` paper.
    const grade = await this.repo.gradeOf(userId)
    const all = (await this.repo.listPublishedPilihan(surface)).filter((p) => paperCodeOf(p) !== '' && p.sections.length > 0)
    const sat = await this.ports.progressSource.progressFor(userId, all.map((p) => idToString(p.id)))
    const papers = all.filter((p) => levelScopeAllows(p.levelScope, grade) || sat.has(idToString(p.id)))
    if (papers.length === 0) return []
    const progress = sat
    const [subjects, info] = await Promise.all([this.repo.subjectsByIds(papers.map((p) => p.subjectId)), this.infoFor(papers)])
    // H-A13: a published paper that places a question the bank no longer serves (archived) cannot start a new sitting
    // (the attempt source answers 403 with a BM line), so it is not offered, like a paper without a code or a section.
    // Lead decision: a pupil who has ANY sitting on it, open or submitted, keeps the card, so the result and Semakan stay reachable.
    // REQ-B-058: a pinned version that is taken down refuses a new sitting too, so the paper is not offered either (one read for the whole list).
    const down = await this.takenDownOf(papers)
    const listed = papers.filter((p) => progress.has(idToString(p.id)) || !placesUnservable(this.pinsOf(p), info, down))
    const marked = await this.withPinned(info, listed)
    return listed.map((p) => this.summary(p, subjects, marked, progress))
  }

  async getCover(userId: string, paperId: string): Promise<BijakPaperCover> {
    const paper = await this.visiblePaper(userId, paperId)
    const [subjects, info, progress, down] = await Promise.all([
      this.repo.subjectsByIds([paper.subjectId]),
      this.infoFor([paper]),
      this.ports.progressSource.progressFor(userId, [idToString(paper.id)]),
      this.takenDownOf([paper]),
    ])
    const marked = await this.withPinned(info, [paper])
    // S3-T07: the paper Kuiz is refused (404) for an out-of-scope curated paper unless the pupil has an own open sitting (`kuiz.service.ts`
    // `visiblePaper`); the cover then omits the action. Sent only when false so every other cover is unchanged.
    const inScope = paper.kind !== 'pilihan' || levelScopeAllows(paper.levelScope, await this.repo.gradeOf(userId))
    const kuizAvailable = inScope || progress.get(idToString(paper.id))?.attemptId !== undefined
    const unavailableReason = this.coverUnavailableReason(paper, info, down)
    return {
      ...this.summary(paper, subjects, marked, progress),
      ...(kuizAvailable ? {} : { kuizAvailable: false }),
      instructions: paper.instructions,
      reference: referencePanels(paper.referenceSheets),
      // AC-20.3: "Untuk Kegunaan Pemeriksa" is printed only when the paper holds a part a person marks. Read from `marked` (live and pinned) so a question archived after Terbit keeps the grid.
      examinerGrid: paper.sections.some((s) => s.placements.some((pl) => marked.get(idToString(pl.questionId))?.manual === true)),
      sections: paper.sections.map((s) => {
        const rule = ruleOf(s.ruleType, s.ruleN)
        return {
          label: s.label,
          marks: this.sectionMarks(s, marked),
          instruction: sectionInstruction(s.instruction, rule, s.placements.length),
          questionCount: s.placements.length,
          compulsory: s.compulsory,
          ...(rule.type === 'choose' ? { chooseN: rule.n } : {}),
        }
      }),
      unavailable: unavailableReason !== null,
      ...(unavailableReason ? { unavailableReason } : {}),
    }
  }

  async listContracts(): Promise<BijakBlueprintContract[]> {
    // S3-T01 (D76): a pupil sees Disahkan contracts only. The rows are the serving Disahkan blueprints (`serves_students`, N1), so an older Disahkan
    // version still serving while a Spec head is edited is the row shown, and a Spec head is never listed.
    const blueprints = await this.repo.listServingBlueprints()
    const subjects = await this.repo.subjectsByIds(blueprints.map((b) => b.subjectId))
    const out: BijakBlueprintContract[] = []
    for (const b of blueprints) {
      const subject = subjects.get(b.subjectId.toString())
      if (!subject || b.sections.length === 0) continue
      out.push({
        subject: bijakCodeOf(subject.code),
        subjectName: subject.name,
        kertas: b.kertas,
        source: sourceToWire(b.source),
        code: b.code,
        durationMin: b.durationMin,
        sections: b.sections.map((s) => ({ label: s.label, take: s.questionCount })),
        canGenerate: true,
      })
    }
    return out
  }

  async subjects(userId: string): Promise<BijakSubject[]> {
    return (await this.repo.hubSubjects(await this.repo.gradeOf(userId))).map((s) => ({ code: bijakCodeOf(s.code), name: s.name }))
  }

  /** For BE-16: the paper a user may sit (curated and published, or the user's own generated paper), else 404. */
  async getSittablePaper(userId: string, paperId: string): Promise<SittablePaper> {
    const paper = await this.visiblePaper(userId, paperId)
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const code = subject ? bijakCodeOf(subject.code) : ''
    return {
      id: idToString(paper.id),
      kind: paper.kind === 'jana' ? 'jana' : 'pilihan',
      title: paper.title,
      subject: code,
      subjectName: subject?.name ?? code,
      kertas: paper.kertas,
      year: this.yearOf(paper),
      code: paperCodeOf(paper),
      durationMin: paper.printedDurationMin,
      instructions: paper.instructions,
      reference: referencePanels(paper.referenceSheets),
      sections: paper.sections.map((s) => ({
        id: idToString(s.id),
        label: s.label,
        ...(s.title ? { title: s.title } : {}),
        ...(s.instruction ? { instruction: s.instruction } : {}),
        compulsory: s.compulsory,
        markBudget: s.markBudget,
        rule: ruleOf(s.ruleType, s.ruleN),
        questionIds: s.placements.map((p) => idToString(p.questionId)),
      })),
    }
  }

  /* ------------------------------------------------------------------------------ helpers */

  /** Curated and published, or generated for this user; anything else is 404 (no hint which). */
  private async visiblePaper(userId: string, paperId: string): Promise<PaperWithTree> {
    let id: bigint
    try {
      id = idFromString(paperId)
    } catch {
      throw paperNotFound()
    }
    const paper = await this.repo.findPaper(id)
    if (!paper || paper.status !== 'published') throw paperNotFound()
    if (paper.kind === 'jana' && paper.generatedForUserId?.toString() !== userId) throw paperNotFound()
    // S3-T07: a curated paper outside the pupil's form is hidden from the list, so its URL (cover, start) answers 404 too.
    // A pupil who already sat on it keeps the cover (result and Semakan stay reachable); a NEW start is refused in `attempt-source.ts`.
    if (paper.kind === 'pilihan' && !levelScopeAllows(paper.levelScope, await this.repo.gradeOf(userId))) {
      if (!(await this.ports.progressSource.progressFor(userId, [paperId])).has(idToString(paper.id))) throw paperNotFound()
    }
    return paper
  }

  private pinsOf(paper: PaperWithTree): PinRef[] {
    return paper.sections.flatMap((s) => s.placements.map((pl) => ({ questionId: idToString(pl.questionId), versionNo: pl.pinnedVersionNo })))
  }

  /** Null when a new sitting can start: the same answer `BijakPapersAttemptSource.resolveForAttempt` gives (`not_eligible`), before any click. */
  private coverUnavailableReason(paper: PaperWithTree, info: Info, down: ReadonlySet<string>): BijakCoverUnavailableReason | null {
    const pins = this.pinsOf(paper)
    if (pins.length === 0) return 'NO_QUESTIONS'
    return placesUnservable(pins, info, down) ? 'QUESTION_WITHDRAWN' : null
  }

  private async takenDownOf(papers: readonly PaperWithTree[]): Promise<ReadonlySet<string>> {
    const pins = papers.flatMap((p) => this.pinsOf(p))
    return pins.length === 0 ? new Set() : this.ports.questionSource.takenDownPins(pins)
  }

  private async infoFor(papers: readonly PaperWithTree[]): Promise<Info> {
    const ids = new Set<string>()
    for (const p of papers) for (const s of p.sections) for (const pl of s.placements) ids.add(idToString(pl.questionId))
    // KP-15: one batched read for the whole list, with the pins, so a question missing only a picture file does not hide its paper
    // (the start reads the same way, `attempt-source.ts`). A generated (jana) paper is an automatic draw: it keeps hiding the question.
    return ids.size === 0 ? new Map() : this.ports.questionSource.getMany([...ids], papers.filter((p) => p.kind !== 'jana').flatMap((p) => this.pinsOf(p)))
  }

  /**
   * `info` (the live, servable questions) plus the pinned info of every placed question the bank no longer serves, so the marks of a
   * paper do not drop to 0 after "Arkib" (H-A13). Eligibility is still decided on `info` alone.
   */
  private async withPinned(info: Info, papers: readonly PaperWithTree[]): Promise<Info> {
    const missing = new Set<string>()
    for (const p of papers) for (const s of p.sections) for (const pl of s.placements) if (!info.has(idToString(pl.questionId))) missing.add(idToString(pl.questionId))
    const getPinned = this.ports.questionSource.getPinned
    if (missing.size === 0 || !getPinned) return info
    const pinned = await getPinned.call(this.ports.questionSource, [...missing])
    return new Map([...pinned, ...info])
  }

  private sectionMarks(section: PaperWithTree['sections'][number], info: Info): number {
    return effectiveMarks(
      ruleOf(section.ruleType, section.ruleN),
      section.placements.map((pl) => pl.marksOverride ?? info.get(idToString(pl.questionId))?.marks ?? 0),
    )
  }

  private yearOf(paper: PaperWithTree): number {
    return paper.year ?? mytYear(paper.publishedAt ?? paper.createdAt)
  }

  private summary(
    paper: PaperWithTree,
    subjects: ReadonlyMap<string, SubjectRef>,
    info: Info,
    progress: ReadonlyMap<string, { attemptId?: string; lastScore?: { score: number; max: number } }>,
  ): BijakPaperSummary {
    const subject = subjects.get(paper.subjectId.toString())
    const code = subject ? bijakCodeOf(subject.code) : ''
    const mine = progress.get(idToString(paper.id))
    return {
      id: idToString(paper.id),
      title: paper.title,
      subject: code,
      subjectName: subject?.name ?? code,
      kertas: paper.kertas,
      year: this.yearOf(paper),
      code: paperCodeOf(paper),
      durationMin: paper.printedDurationMin,
      questionCount: paper.sections.reduce((n, s) => n + s.placements.length, 0),
      // A Kertas Subjektif paper shows the Jumlah Markah the admin typed ("{marks_total} markah", DM-23, INV-17).
      marks: paper.surface === 'subjektif' && paper.totalMarks !== null ? paper.totalMarks : paper.sections.reduce((n, s) => n + this.sectionMarks(s, info), 0),
      kind: paper.kind === 'jana' ? 'jana' : 'pilihan',
      ...(paper.surface === 'subjektif' ? { surface: 'subjektif' as const, ...(paper.examBoard ? { examBoard: paper.examBoard } : {}) } : {}),
      status: mine?.attemptId ? 'sedang' : mine?.lastScore ? 'selesai' : 'belum',
      ...(mine?.lastScore ? { lastScore: { score: mine.lastScore.score, max: mine.lastScore.max } } : {}),
      ...(mine?.attemptId ? { attemptId: mine.attemptId } : {}),
    }
  }
}
