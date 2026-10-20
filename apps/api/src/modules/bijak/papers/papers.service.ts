import { Inject, Injectable } from '@nestjs/common'
import type {
  BijakBlueprintContract,
  BijakGenerateRequest,
  BijakGenerateResult,
  BijakPaperCover,
  BijakPaperSummary,
  BijakSubject,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import {
  composeFromBlueprint,
  effectiveMarks,
  type GroupDef,
  type PoolEntry,
  type PoolUnit,
  poolUnits,
} from './exam-core.adapter'
import { noBlueprint, paperNotFound, shortage } from './errors'
import { BijakPapersPorts, type BijakQuestionInfo } from './ports'
import { PapersRepository, type PaperWithTree, type SubjectRef } from './papers.repository'
import { generationSeed, mytYear, referencePanels, ruleOf, sectionInstruction, sourceToWire, toComposerBlueprint } from './rules'
import { bijakCodeOf, curriculumCodeOf } from './subject-codes'

type Info = ReadonlyMap<string, BijakQuestionInfo>

/** Who generates: the signed-in user; `isTest` is true in Mod Pelajar (rows are flagged as test data). */
export interface PaperActor {
  userId: string
  isTest: boolean
}

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
 * Bijak SPM papers (M28, BE-15): Kertas Pilihan list and cover, the Kontrak list, the subject hub
 * and "Jana Kertas". Marks are derived from the placements on every read (Q-S6). No answer key,
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

  async listPapers(userId: string): Promise<BijakPaperSummary[]> {
    const papers = await this.repo.listPublishedPilihan()
    if (papers.length === 0) return []
    const [subjects, info, progress] = await Promise.all([
      this.repo.subjectsByIds(papers.map((p) => p.subjectId)),
      this.infoFor(papers),
      this.ports.progressSource.progressFor(userId, papers.map((p) => idToString(p.id))),
    ])
    return papers.map((p) => this.summary(p, subjects, info, progress))
  }

  async getCover(userId: string, paperId: string): Promise<BijakPaperCover> {
    const paper = await this.visiblePaper(userId, paperId)
    const [subjects, info, progress] = await Promise.all([
      this.repo.subjectsByIds([paper.subjectId]),
      this.infoFor([paper]),
      this.ports.progressSource.progressFor(userId, [idToString(paper.id)]),
    ])
    return {
      ...this.summary(paper, subjects, info, progress),
      instructions: paper.instructions,
      reference: referencePanels(paper.referenceSheets),
      sections: paper.sections.map((s) => {
        const rule = ruleOf(s.ruleType, s.ruleN)
        return {
          label: s.label,
          marks: this.sectionMarks(s, info),
          instruction: sectionInstruction(s.instruction, rule, s.placements.length),
          questionCount: s.placements.length,
          compulsory: s.compulsory,
          ...(rule.type === 'choose' ? { chooseN: rule.n } : {}),
        }
      }),
    }
  }

  async listContracts(): Promise<BijakBlueprintContract[]> {
    const blueprints = await this.repo.listActiveBlueprints()
    const subjects = await this.repo.subjectsByIds(blueprints.map((b) => b.subjectId))
    const out: BijakBlueprintContract[] = []
    for (const b of blueprints) {
      const subject = subjects.get(b.subjectId.toString())
      if (!subject) continue
      out.push({
        subject: bijakCodeOf(subject.code),
        subjectName: subject.name,
        kertas: b.kertas,
        source: sourceToWire(b.source),
        code: b.code,
        durationMin: b.durationMin,
        sections: b.sections.map((s) => ({ label: s.label, take: s.questionCount })),
      })
    }
    return out
  }

  async subjects(): Promise<BijakSubject[]> {
    return (await this.repo.hubSubjects()).map((s) => ({ code: bijakCodeOf(s.code), name: s.name }))
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
      code: paper.paperCode ?? '',
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

  /* -------------------------------------------------------------------------- Jana Kertas */

  async generate(actor: PaperActor, body: BijakGenerateRequest): Promise<BijakGenerateResult> {
    const subject = await this.repo.subjectByCode(curriculumCodeOf(body.subject))
    const row = subject ? await this.repo.findActiveBlueprint(subject.id, body.kertas) : null
    // A missing pair and a Draf blueprint are the same answer, and no paper row is created (AC 3).
    if (!subject || !row || row.source === 'draft') throw noBlueprint()

    const blueprint = toComposerBlueprint(bijakCodeOf(subject.code), body.kertas, row)
    const source = this.ports.questionSource
    const entries: PoolEntry[] = []
    const groups = new Map<string, GroupDef>()
    const groupOfQuestion = new Map<string, string>()
    const unitsByPool = new Map<string, PoolUnit[]>()
    for (const pool of new Set(blueprint.sections.map((s) => s.pool))) {
      const loaded = await source.pool(pool, { subjectId: subject.id.toString(), subjectCode: subject.code, kertas: body.kertas })
      const poolEntries = loaded.entries.map((e): PoolEntry => ({ questionId: e.questionId, pool }))
      for (const e of loaded.entries) if (e.groupId) groupOfQuestion.set(e.questionId, e.groupId)
      for (const [id, questionIds] of loaded.groups) groups.set(id, { id, questionIds: [...questionIds] })
      entries.push(...poolEntries)
      unitsByPool.set(pool, poolUnits(pool, poolEntries, groups, (qid) => groupOfQuestion.get(qid)))
    }

    const userId = idFromString(actor.userId)
    const [seen, previous] = await Promise.all([
      this.ports.servedSource.servedQuestionIds(actor.userId),
      this.repo.countJanaPapers(userId),
    ])
    const now = this.clock.now()
    const outcome = composeFromBlueprint(blueprint, unitsByPool, {
      seed: generationSeed(now, actor.userId, row.code, previous),
      seen,
    })
    if (!outcome.ok) throw shortage(outcome.shortages)

    const info = await source.getMany(outcome.sections.flatMap((s) => s.questionIds))
    const marksOf = (qid: string): number => info.get(qid)?.marks ?? 0
    const paperId = await this.repo.createJanaPaper({
      title: `Kertas Jana ${subject.name} Kertas ${String(body.kertas)} (#${String(previous + 1)})`,
      subjectId: subject.id,
      kertas: body.kertas,
      year: mytYear(now),
      paperCode: row.code,
      printedDurationMin: row.durationMin,
      instructions: row.instructions,
      referenceSheets: referencePanels(row.referenceSheets),
      blueprintId: row.id,
      userId,
      isTest: actor.isTest,
      publishedAt: now,
      sections: outcome.sections.map((s, i) => ({
        label: s.label,
        instruction: s.instruction ?? null,
        ruleType: s.rule.type,
        ruleN: s.rule.type === 'choose' ? s.rule.n : null,
        questionCount: s.questionIds.length,
        markBudget: effectiveMarks(s.rule, s.questionIds.map(marksOf)),
        compulsory: row.sections[i]?.compulsory ?? false,
        placements: s.questionIds.map((qid) => ({ questionId: BigInt(qid), pinnedVersionNo: info.get(qid)?.versionNo ?? 1 })),
      })),
    })
    return { paperId: idToString(paperId) }
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
    return paper
  }

  private async infoFor(papers: readonly PaperWithTree[]): Promise<Info> {
    const ids = new Set<string>()
    for (const p of papers) for (const s of p.sections) for (const pl of s.placements) ids.add(idToString(pl.questionId))
    return ids.size === 0 ? new Map() : this.ports.questionSource.getMany([...ids])
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
      code: paper.paperCode ?? '',
      durationMin: paper.printedDurationMin,
      questionCount: paper.sections.reduce((n, s) => n + s.placements.length, 0),
      marks: paper.sections.reduce((n, s) => n + this.sectionMarks(s, info), 0),
      kind: paper.kind === 'jana' ? 'jana' : 'pilihan',
      status: mine?.attemptId ? 'sedang' : mine?.lastScore ? 'selesai' : 'belum',
      ...(mine?.lastScore ? { lastScore: { score: mine.lastScore.score, max: mine.lastScore.max } } : {}),
      ...(mine?.attemptId ? { attemptId: mine.attemptId } : {}),
    }
  }
}
