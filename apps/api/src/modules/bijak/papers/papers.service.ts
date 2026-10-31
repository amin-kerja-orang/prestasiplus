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
import type { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { toStandard } from '../../exam/blueprints/blueprint-standard'
import { shortageToWire } from '../../exam/builder/standard'
import { composeStandardPaper, describeQuestion, effectiveMarks } from './exam-core.adapter'
import { generateLimit, noBlueprint, paperNotFound, shortage } from './errors'
import { BijakPapersPorts, type BijakQuestionInfo } from './ports'
import { PapersRepository, type PaperWithTree, type SubjectRef } from './papers.repository'
import { generationSeed, mytYear, referencePanels, ruleOf, sectionInstruction, sourceToWire } from './rules'
import { bijakCodeOf, curriculumCodeOf } from './subject-codes'

type Info = ReadonlyMap<string, BijakQuestionInfo>

/** Who generates: the signed-in user; `isTest` is true in Mod Pelajar (rows are flagged as test data). */
export interface PaperActor {
  userId: string
  isTest: boolean
  /** Admin Pusat acting in Mod Pelajar: may generate from a Spec head (D76, O-6). Admin Sekolah follows the student rule. */
  canUseSpec?: boolean
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

/** Most times a refused question is dropped and the paper composed again before the request answers 503 GENERATE_LIMIT. */
const MAX_BRIDGE_ROUNDS = 8

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
    // A published paper missing a printed code or a section would break the contract (code min 1,
    // sections min 1): it is not listed (BE-39 may create such rows; they stay out of the hub).
    const papers = (await this.repo.listPublishedPilihan()).filter((p) => p.paperCode && p.sections.length > 0)
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
    // N1: `canGenerate` is exactly "findServingBlueprint finds a row" (the same predicate generate uses), so an
    // older Disahkan version still serving while a Spec head is edited stays generable, and the list never
    // offers a pair that generate would answer NO_BLUEPRINT.
    const serving = new Set((await this.repo.listServingBlueprints()).map((r) => `${r.subjectId.toString()}:${String(r.kertas)}`))
    const out: BijakBlueprintContract[] = []
    for (const b of blueprints) {
      const subject = subjects.get(b.subjectId.toString())
      if (!subject || b.sections.length === 0) continue
      const canGenerate = serving.has(`${b.subjectId.toString()}:${String(b.kertas)}`)
      out.push({
        subject: bijakCodeOf(subject.code),
        subjectName: subject.name,
        kertas: b.kertas,
        source: sourceToWire(b.source),
        code: b.code,
        durationMin: b.durationMin,
        sections: b.sections.map((s) => ({ label: s.label, take: s.questionCount })),
        canGenerate,
        ...(canGenerate ? {} : { unavailableReason: 'NO_BLUEPRINT' as const }),
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
    // AC-R1-15.3 / D76: a pupil generates from the serving (Disahkan) version only, which may be a retired row while
    // a Spec head is being edited. Admin Pusat in Mod Pelajar (test data) may also use a Spec head (O-6).
    let row = subject ? await this.repo.findServingBlueprint(subject.id, body.kertas) : null
    if (subject && actor.canUseSpec) {
      const head = await this.repo.findActiveBlueprint(subject.id, body.kertas)
      if (head && head.source !== 'draft') row = head
    }
    // A missing pair, an unverified one and a Draf blueprint are the same answer; no paper row is created (AC 3).
    if (!subject || !row) throw noBlueprint()

    // D75 / D78: the paper follows the exam standard exactly or is refused. The candidates are the question facts of
    // the subject (the bank, not a tag-filtered pool); a stimulus group is selected and placed as one unit (D90).
    const std = toStandard(row, bijakCodeOf(subject.code))
    const poolSource = this.ports.poolSource
    const scope = { subjectId: subject.id.toString(), subjectCode: subject.code, kertas: body.kertas }
    const userId = idFromString(actor.userId)
    const [pool, seen, previous] = await Promise.all([
      poolSource.candidates(scope),
      poolSource.seen(actor.userId),
      this.repo.countJanaPapers(userId),
    ])
    const now = this.clock.now()
    const seed = generationSeed(now, actor.userId, row.code, previous)
    // The pool facts say what the exam standard needs; the BE-09 bridge says what a pupil can actually be served (it refuses an
    // option image, a group without exactly one stimulus, an unreadable reveal, a missing file). A paper the pupil cannot start
    // is never numbered, so every composed question is checked through the bridge BEFORE the write; a refused one leaves the
    // candidates (a group missing a member becomes incomplete and is not used) and the paper is composed again: exact or refuse.
    let candidates = pool
    let outcome = composeStandardPaper(std, candidates, { seed, seen })
    for (let round = 0; outcome.ok && round < MAX_BRIDGE_ROUNDS; round++) {
      const composedIds = outcome.sections.flatMap((c) => c.questionIds)
      const servable = await this.ports.questionSource.getMany(composedIds)
      const refused = new Set(composedIds.filter((id) => !servable.has(id)))
      if (refused.size === 0) break
      candidates = candidates.filter((f) => !refused.has(f.id))
      outcome = composeStandardPaper(std, candidates, { seed, seen })
      if (round === MAX_BRIDGE_ROUNDS - 1 && outcome.ok) throw generateLimit()
    }
    if (!outcome.ok) {
      if (outcome.reason === 'shortage') throw shortage(outcome.shortages.map(shortageToWire))
      if (outcome.reason === 'limit') throw generateLimit()
      throw new Error('bijak generate: the independent re-check found a violation')
    }

    // Marks and the pinned version come from the same facts the composer used, so a composed question is always known.
    const factsById = new Map(candidates.map((f) => [f.id, f]))
    const marksOf = (qid: string): number => {
      const facts = factsById.get(qid)
      return facts ? describeQuestion(facts).marks : 0
    }
    const blueprintSections = [...row.sections].sort((a, b) => a.position - b.position)
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
      standardReport: outcome.report as unknown as Prisma.InputJsonValue,
      sections: outcome.sections.map((composed) => {
        const bs = blueprintSections.find((x) => x.position === composed.position)
        if (!bs) throw new Error('bijak generate: a composed section has no blueprint section')
        const rule = ruleOf(bs.ruleType, bs.ruleN)
        return {
          label: bs.label,
          instruction: bs.instruction ?? null,
          ruleType: rule.type,
          ruleN: rule.type === 'choose' ? rule.n : null,
          questionCount: composed.questionIds.length,
          markBudget: effectiveMarks(rule, composed.questionIds.map(marksOf)),
          compulsory: bs.compulsory,
          placements: composed.questionIds.map((qid) => ({ questionId: BigInt(qid), pinnedVersionNo: factsById.get(qid)?.versionNo ?? 1 })),
        }
      }),
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
