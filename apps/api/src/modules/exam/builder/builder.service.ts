import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_MESSAGES as MESSAGES,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPreviewRequestSchema,
  type BijakBlueprintView,
  BIJAK_BUILDER_PLACEMENT_LINES as PLACE,
  BIJAK_BUILDER_INELIGIBLE_TEXT as INELIGIBLE_TEXT,
  BijakBuilderPlacementAddSchema,
  BijakBuilderSectionOrderSchema,
  BijakBuilderSectionPoolQuerySchema,
  BijakBuilderPoolPreviewQuerySchema,
  BijakDraftGenerateRequestSchema,
  type BijakBuilderPlacementResult,
  type BijakBuilderPoolUnit,
  type BijakBuilderReview,
  type BijakBuilderStudentView,
  type BijakPoolPreview,
  type BijakBuilderEditor,
  type BijakBuilderPaper,
  type BijakBuilderPaperStatus,
  type BijakBuilderPaperSummary,
  type BijakBuilderPreview,
  type BijakBuilderPublishResult,
  type BijakBuilderQuestion,
  type ListMeta,
} from '@pp/contract'
import type { z } from 'zod'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { fnv1a32 } from '../../../db/prng'
import { generateLimit, noBlueprint, shortage } from '../../bijak/papers/errors'
import { BijakPapersPorts } from '../../bijak/papers/ports'
import { bijakCodeOf, curriculumCodeOf } from '../../bijak/papers/subject-codes'
import { mytYear, referencePanels, ruleOf, sectionInstruction } from '../../bijak/papers/rules'
import { blueprintView } from '../blueprints/blueprint-view'
import { toStandard } from '../blueprints/blueprint-standard'
import type { AuditActor } from './actor'
import { BIJAK_BUILDER_PAGE_SIZE, isServableStatus, MAX_EDITOR_CANDIDATES, POOL_PAGE_SIZE } from './builder.constants'
import { BuilderRepository, type PaperTree, type SubjectRef } from './builder.repository'
import { excludedBankQuery } from '../../bijak/papers/pool-source'
import { sourceToWire } from '../../bijak/papers/rules'
import {
  buildStandardReport,
  composeStandardPaper,
  describeQuestion,
  effectiveMarks,
  eligibilityOf,
  previewStandard,
  SOLVER_VERSION,
  verifyComposition,
  type QuestionFacts,
} from './exam-core.adapter'
import { checkPaper, normalizeUnits, publishErrors, reorderUnits, unitsOf, addUnit, removeUnit, type PaperCheck } from './paper-check'
import { shortageToWire, standardForPaper, violationLines } from './standard'
import { BijakBuilderPorts, type BuilderGroupInfo, type BuilderQuestionInfo, type BuilderQuestionRef } from './ports'

type Info = ReadonlyMap<string, BuilderQuestionInfo>

const MAX_KERTAS = 32767

const DEFAULT_TITLE = (subjectName: string, kertas: number) => `Percubaan SPM ${subjectName} Kertas ${String(kertas)} (draf)`

const statusOf = (dbStatus: string): BijakBuilderPaperStatus => (dbStatus === 'published' ? 'terbit' : 'draf')

const notFound = () => ApiError.of('NOT_FOUND', { message: MESSAGES.paperNotFound })
const invalid = (message: string) => ApiError.of('VALIDATION_ERROR', { message })

function parseId(text: string): bigint | null {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

/** Parses a raw body or query with a contract schema; failure is 422 VALIDATION_ERROR with `fields`. */
function parseWith<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return new ZodValidationPipe(schema).transform(value)
}

interface Evaluation {
  info: Info
  groups: ReadonlyMap<string, BuilderGroupInfo>
  check: PaperCheck
}

/**
 * Paper builder (BE-39): drafts, placements, conformance, publish and withdraw of curated papers.
 * Every paper write runs in one transaction that locks the paper row first and records one audit row.
 * Questions are read only through `BijakBuilderPorts` (M04 owns them).
 */
@Injectable()
export class BuilderService {
  constructor(
    @Inject(BuilderRepository) private readonly repo: BuilderRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BijakBuilderPorts) private readonly ports: BijakBuilderPorts,
    @Inject(BijakPapersPorts) private readonly papersPorts: BijakPapersPorts,
  ) {}

  private get questions() {
    return this.ports.questionSource
  }

  // --- conformance -------------------------------------------------------------------------------

  /** Question refs of a paper: pinned versions once published, the current version while it is a draft. */
  private refsOf(paper: PaperTree): BuilderQuestionRef[] {
    const pinned = paper.status === 'published'
    const seen = new Map<string, BuilderQuestionRef>()
    for (const s of paper.sections)
      for (const pl of s.placements) {
        const id = idToString(pl.questionId)
        if (!seen.has(id)) seen.set(id, pinned ? { id, versionNo: pl.pinnedVersionNo } : { id })
      }
    return [...seen.values()]
  }

  /**
   * Evaluates papers against ONE `describe` call for the current refs of the drafts, one call per
   * "layer" of pinned refs of the published papers (normally one: a layer holds at most one version
   * per question id, because `describe` is keyed by id), and ONE `groups` call for all of them.
   */
  private async evaluateMany(papers: readonly PaperTree[]): Promise<Evaluation[]> {
    const current = new Set<string>()
    const pinned = new Map<string, number[]>()
    for (const paper of papers)
      for (const ref of this.refsOf(paper)) {
        if (ref.versionNo === undefined) current.add(ref.id)
        else {
          const versions = pinned.get(ref.id) ?? []
          if (!versions.includes(ref.versionNo)) versions.push(ref.versionNo)
          pinned.set(ref.id, versions)
        }
      }
    const described = new Map<string, BuilderQuestionInfo>() // key: `${id}@${versionNo | 'now'}`
    if (current.size) {
      const got = await this.questions.describe([...current].map((id) => ({ id })))
      for (const [id, info] of got) described.set(`${id}@now`, info)
    }
    const layers = Math.max(0, ...[...pinned.values()].map((v) => v.length))
    for (let i = 0; i < layers; i++) {
      const refs = [...pinned].flatMap(([id, versions]) => (versions[i] === undefined ? [] : [{ id, versionNo: versions[i]! }]))
      const got = await this.questions.describe(refs)
      for (const ref of refs) {
        const info = got.get(ref.id)
        if (info) described.set(`${ref.id}@${String(ref.versionNo)}`, info)
      }
    }
    const groupIds = [...new Set([...described.values()].flatMap((i) => (i.groupId ? [i.groupId] : [])))]
    const groups = groupIds.length ? await this.questions.groups(groupIds) : new Map<string, BuilderGroupInfo>()

    return papers.map((paper) => {
      const isPinned = paper.status === 'published'
      const info = new Map<string, BuilderQuestionInfo>()
      const marks = new Map<string, number>()
      for (const s of paper.sections)
        for (const pl of s.placements) {
          const id = idToString(pl.questionId)
          const found = described.get(`${id}@${isPinned ? String(pl.pinnedVersionNo) : 'now'}`)
          if (found && !info.has(id)) info.set(id, found)
          if (!marks.has(id)) marks.set(id, pl.marksOverride ?? found?.marks ?? 0)
        }
      const placed = [...marks.keys()]
      const check = checkPaper({
        specs: paper.sections.map((s) => ({
          label: s.label,
          markBudget: s.markBudget,
          questionCount: s.questionCount,
          rule: ruleOf(s.ruleType, s.ruleN),
        })),
        sections: paper.sections.map((s) => ({ questionIds: s.placements.map((pl) => idToString(pl.questionId)) })),
        marksOf: (id) => marks.get(id) ?? 0,
        groupOf: (id) => info.get(id)?.groupId ?? undefined,
        membersOf: (g) => groups.get(g)?.questionIds ?? placed.filter((id) => info.get(id)?.groupId === g),
        isLive: (id) => isServableStatus(info.get(id)?.status ?? ''),
      })
      return { info, groups, check }
    })
  }

  private async evaluate(paper: PaperTree): Promise<Evaluation> {
    return (await this.evaluateMany([paper]))[0]!
  }

  // --- wire shapes -------------------------------------------------------------------------------

  private paperWire(paper: PaperTree, subject: SubjectRef | undefined): BijakBuilderPaper {
    const reference = referencePanels(paper.referenceSheets)
    return {
      id: idToString(paper.id),
      title: paper.title,
      subject: subject ? bijakCodeOf(subject.code) : '',
      kertas: paper.kertas,
      year: paper.year ?? mytYear(paper.createdAt),
      code: paper.paperCode ?? '',
      durationMin: paper.printedDurationMin,
      instructions: paper.instructions,
      ...(reference.length ? { reference } : {}),
      sections: paper.sections.map((s) => {
        const rule = ruleOf(s.ruleType, s.ruleN)
        return {
          id: idToString(s.id),
          label: s.label,
          ...(s.title ? { title: s.title } : {}),
          markBudget: s.markBudget,
          questionCount: s.questionCount,
          ...(s.compulsory ? { compulsory: true as const } : {}),
          ...(s.instruction ? { instruction: sectionInstruction(s.instruction, rule, s.questionCount) } : {}),
          rule,
          questionIds: s.placements.map((pl) => idToString(pl.questionId)),
        }
      }),
      status: statusOf(paper.status),
      createdAt: toMytTimestamp(paper.createdAt),
      updatedAt: toMytTimestamp(paper.updatedAt),
      ...(paper.publishedAt ? { publishedAt: toMytTimestamp(paper.publishedAt) } : {}),
    }
  }

  private questionWire(info: BuilderQuestionInfo): BijakBuilderQuestion {
    return {
      id: info.id,
      ...(info.groupId ? { groupId: info.groupId } : {}),
      ...(info.stimulusLabel ? { stimulusLabel: info.stimulusLabel } : {}),
      preview: info.preview,
      marks: info.marks,
      kind: info.kind,
      topic: info.topic,
      status: info.status,
      kertas: info.kertas,
      subject: info.subject,
    }
  }

  private async editorOf(paper: PaperTree): Promise<BijakBuilderEditor> {
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const wire = this.paperWire(paper, subject)
    const used = this.refsOf(paper)
    const usedInfo = used.length ? await this.questions.describe(used) : new Map<string, BuilderQuestionInfo>()
    // The picker shows at most MAX_EDITOR_CANDIDATES candidates, so a large bank cannot make one editor read unbounded.
    const candidateIds = (await this.questions.candidates({ subject: wire.subject, kertas: paper.kertas }))
      .filter((id) => !usedInfo.has(id))
      .slice(0, MAX_EDITOR_CANDIDATES)
    const candInfo = candidateIds.length ? await this.questions.describe(candidateIds.map((id) => ({ id }))) : new Map<string, BuilderQuestionInfo>()
    const ordered: BuilderQuestionInfo[] = []
    const seen = new Set<string>()
    for (const id of [...used.map((r) => r.id), ...candidateIds]) {
      const info = usedInfo.get(id) ?? candInfo.get(id)
      if (info && !seen.has(id)) {
        seen.add(id)
        ordered.push(info)
      }
    }
    const groupIds = [...new Set(ordered.flatMap((q) => (q.groupId ? [q.groupId] : [])))]
    const groupMap = groupIds.length ? await this.questions.groups(groupIds) : new Map<string, BuilderGroupInfo>()
    const bp = subject ? await this.repo.activeBlueprint(subject.id, paper.kertas) : null
    const blueprint: BijakBlueprintView | null = bp && subject ? blueprintView(bp, subject) : null
    return {
      paper: wire,
      blueprint,
      questions: ordered.map((q) => this.questionWire(q)),
      groups: groupIds.flatMap((id) => {
        const g = groupMap.get(id)
        return g ? [{ id: g.id, stimulus: g.stimulus, questionIds: g.questionIds }] : []
      }),
    }
  }

  // --- audit -------------------------------------------------------------------------------------

  private record(actor: AuditActor, action: string, paperId: bigint, details: Record<string, unknown>) {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType: 'bijak_paper',
      targetId: idToString(paperId),
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }

  /** Locks, re-reads and returns a curated paper inside the open transaction, or 404. */
  private async lockedPaper(id: bigint | null): Promise<PaperTree> {
    if (id === null) throw notFound()
    await this.repo.lockPaper(id)
    const paper = await this.repo.findPilihan(id)
    if (!paper) throw notFound()
    return paper
  }

  // --- operations --------------------------------------------------------------------------------

  async list(rawQuery: unknown): Promise<{ data: BijakBuilderPaperSummary[]; meta: ListMeta }> {
    const query = parseWith(BijakBuilderPaperListQuerySchema, rawQuery)
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? BIJAK_BUILDER_PAGE_SIZE
    const statuses = query.status === undefined ? undefined : query.status === 'terbit' ? ['published'] : ['draft', 'ready', 'withdrawn']
    const [total, rows] = await Promise.all([
      this.repo.countPilihan(statuses),
      this.repo.listPilihan(statuses, (page - 1) * pageSize, pageSize),
    ])
    const subjects = await this.repo.subjectsByIds(rows.map((r) => r.subjectId))
    const evaluations = await this.evaluateMany(rows)
    const data = await Promise.all(
      rows.map(async (paper, i): Promise<BijakBuilderPaperSummary> => {
        const { check } = evaluations[i]!
        const subject = subjects.get(paper.subjectId.toString())
        const code = subject ? bijakCodeOf(subject.code) : ''
        return {
          id: idToString(paper.id),
          title: paper.title,
          subject: code,
          subjectName: subject?.name ?? code,
          kertas: paper.kertas,
          code: paper.paperCode ?? '',
          status: statusOf(paper.status),
          questionCount: paper.sections.reduce((n, s) => n + s.placements.length, 0),
          marks: check.totalMarks,
          budget: check.totalBudget,
          ok: check.ok,
          updatedAt: toMytTimestamp(paper.updatedAt),
        }
      }),
    )
    return { data, meta: listMeta(page, pageSize, total) }
  }

  async create(actor: AuditActor, rawBody: unknown): Promise<{ id: string }> {
    const body = parseWith(BijakBuilderPaperCreateSchema, rawBody)
    // kertas is a smallint column: a larger number can have no blueprint (and must not reach the query).
    if (body.kertas > MAX_KERTAS) throw invalid(MESSAGES.noBlueprint)
    const subject = await this.repo.subjectByCode(curriculumCodeOf(body.subject))
    if (!subject) throw invalid(MESSAGES.noBlueprint)
    const now = this.clock.now()
    const trimmed = body.title?.trim()
    const id = await this.prisma.transaction(async () => {
      // Lock the active blueprint row, then re-read it: a concurrent retire / new version / Draf edit is seen.
      const first = await this.repo.activeBlueprint(subject.id, body.kertas)
      if (!first) throw invalid(MESSAGES.noBlueprint)
      await this.repo.lockBlueprint(first.id)
      const blueprint = await this.repo.activeBlueprint(subject.id, body.kertas)
      if (!blueprint || blueprint.source === 'draft') throw invalid(MESSAGES.noBlueprint)
      const paperId = await this.repo.createPaper({
        title: trimmed ? trimmed : DEFAULT_TITLE(subject.name, body.kertas),
        subjectId: subject.id,
        kertas: body.kertas,
        year: mytYear(now),
        paperCode: blueprint.code,
        printedDurationMin: blueprint.durationMin,
        instructions: blueprint.instructions,
        referenceSheets: referencePanels(blueprint.referenceSheets),
        blueprintId: blueprint.id,
        createdById: BigInt(actor.userId),
        isTest: actor.isTest,
        sections: blueprint.sections.map((s) => ({
          label: s.label,
          instruction: s.instruction,
          ruleType: s.ruleType === 'choose' ? 'choose' : 'all',
          ruleN: s.ruleType === 'choose' ? s.ruleN : null,
          questionCount: s.questionCount,
          markBudget: s.markBudget ?? s.questionCount,
          compulsory: s.compulsory,
        })),
      })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_CREATED, paperId, { from: null, to: 'draf', sections: blueprint.sections.length })
      return paperId
    })
    return { id: idToString(id) }
  }

  async get(rawId: string): Promise<BijakBuilderEditor> {
    const id = parseId(rawId)
    const paper = id === null ? null : await this.repo.findPilihan(id)
    if (!paper) throw notFound()
    return this.editorOf(paper)
  }

  async update(actor: AuditActor, rawId: string, rawBody: unknown): Promise<BijakBuilderEditor> {
    const id = parseId(rawId)
    const paperId = await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      if (paper.status === 'published') throw invalid(MESSAGES.paperLocked)
      const body = parseWith(BijakBuilderPaperPatchSchema, rawBody)
      const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
      const bijakSubject = subject ? bijakCodeOf(subject.code) : ''

      // Resolve every section patch before anything is written (a refusal leaves the paper untouched).
      const sections = body.sections ?? []
      const wanted = new Set<string>()
      for (const patch of sections) for (const qid of patch.questionIds) if (parseId(qid) !== null) wanted.add(qid)
      const st = await this.structure([...wanted])
      const plans: { sectionId: bigint; placements: { questionId: bigint; pinnedVersionNo: number }[] }[] = []
      const resulting = new Map<bigint, string[]>(paper.sections.map((s) => [s.id, s.placements.map((pl) => idToString(pl.questionId))]))
      for (const patch of sections) {
        const sectionId = parseId(patch.id)
        const section = sectionId === null ? undefined : paper.sections.find((s) => s.id === sectionId)
        if (!section) throw invalid(MESSAGES.invalidSection)
        for (const qid of patch.questionIds) {
          const q = parseId(qid) === null ? undefined : st.info.get(qid)
          if (!q || q.subject !== bijakSubject) throw invalid(MESSAGES.invalidQuestion)
        }
        const dups = patch.questionIds.filter((qid, i) => patch.questionIds.indexOf(qid) !== i)
        if (dups.length) throw invalid(LINES.duplicateQuestion([...new Set(dups)]))
        // D90: a group is placed whole, contiguous and in published order; a lone member brings the group along.
        const ids = normalizeUnits(patch.questionIds, st.groupOf, st.membersOf)
        for (const id of ids) {
          const q = st.info.get(id)
          if (!q || q.subject !== bijakSubject) throw invalid(MESSAGES.invalidQuestion)
        }
        resulting.set(section.id, ids)
        plans.push({ sectionId: section.id, placements: ids.map((id) => ({ questionId: BigInt(id), pinnedVersionNo: st.info.get(id)!.versionNo })) })
      }
      const everywhere = [...resulting.values()].flat()
      // D90: a stimulus group lives in ONE section, so a group member twice on the paper is refused here. A plain
      // question repeated across sections stays accepted and is reported by the publish check (the mock's order).
      const repeated = everywhere.filter((id, i) => everywhere.indexOf(id) !== i && st.groupOf(id) !== undefined)
      if (repeated.length) throw invalid(LINES.duplicateQuestion([...new Set(repeated)]))

      await this.repo.updatePaper(paper.id, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.year !== undefined ? { year: body.year } : {}),
        ...(body.durationMin !== undefined ? { printedDurationMin: body.durationMin } : {}),
        ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
        updatedAt: this.clock.now(),
      })
      for (const plan of plans) await this.repo.replacePlacements(plan.sectionId, plan.placements)
      const status = statusOf(paper.status)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, { from: status, to: status, sections: plans.length })
      return paper.id
    })
    const fresh = await this.repo.findPilihan(paperId)
    if (!fresh) throw notFound()
    return this.editorOf(fresh)
  }

  async remove(actor: AuditActor, rawId: string): Promise<{ ok: true }> {
    const id = parseId(rawId)
    if (id === null) return { ok: true }
    await this.prisma.transaction(async () => {
      await this.repo.lockPaper(id)
      const paper = await this.repo.findPilihan(id)
      if (!paper) return
      if (paper.status === 'published') throw invalid(MESSAGES.deleteTerbit)
      await this.repo.deletePaper(paper.id)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_DELETED, paper.id, { from: statusOf(paper.status), to: null })
    })
    return { ok: true }
  }

  async publish(actor: AuditActor, rawId: string): Promise<BijakBuilderPublishResult> {
    const id = parseId(rawId)
    return this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      const ev = await this.evaluate(paper)
      const structural = await this.structuralCheck(paper)
      const errors = [...new Set([...publishErrors(ev.check), ...structural.blockers])]
      const review = structural.notes.length > 0 ? { notes: structural.notes, blueprintNeedsReview: true } : {}
      if (errors.length > 0) return { ok: false, errors, ...review }
      if (paper.status === 'published') return { ok: true, errors: [], ...review }
      // Pin every placed question (all members of a group) at the version in force and freeze its marks.
      for (const s of paper.sections)
        for (const pl of s.placements) {
          const q = ev.info.get(idToString(pl.questionId))
          if (q) await this.repo.pinPlacement(pl.id, q.versionNo, q.marks)
        }
      const now = this.clock.now()
      await this.repo.updatePaper(paper.id, {
        status: 'published',
        publishedAt: now,
        updatedAt: now,
        ...(structural.report ? { standardReport: structural.report as never } : {}),
        ...(paper.status === 'withdrawn' ? { version: paper.version + 1 } : {}),
      })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_PUBLISHED, paper.id, {
        from: 'draf',
        to: 'terbit',
        ...(structural.notes.length > 0 ? { blueprintNeedsReview: true, notes: structural.notes.length } : {}),
      })
      return { ok: true, errors: [], ...review }
    })
  }

  // --- R1-B09a: structure, standard check ---------------------------------------------------------

  /**
   * Describes ids plus every member of their stimulus groups (D90). `groupOf` answers only for a
   * group that has a stimulus (a group the port does not know is a plain single question).
   */
  private async structure(ids: readonly string[]) {
    const info = new Map<string, BuilderQuestionInfo>(ids.length ? await this.questions.describe(ids.map((id) => ({ id }))) : [])
    const groupIds = [...new Set([...info.values()].flatMap((i) => (i.groupId ? [i.groupId] : [])))]
    const groups = groupIds.length ? await this.questions.groups(groupIds) : new Map<string, BuilderGroupInfo>()
    const extra = [...groups.values()].flatMap((g) => g.questionIds).filter((id) => !info.has(id))
    if (extra.length) for (const [id, q] of await this.questions.describe(extra.map((id) => ({ id })))) info.set(id, q)
    const groupOf = (id: string): string | undefined => {
      const g = info.get(id)?.groupId
      return g && groups.has(g) ? g : undefined
    }
    const membersOf = (g: string): string[] => groups.get(g)?.questionIds ?? []
    return { info, groups, groupOf, membersOf }
  }

  private scopeOf(subject: SubjectRef, kertas: number) {
    return { subjectId: subject.id.toString(), subjectCode: subject.code, kertas }
  }

  /** Facts of every live candidate of the subject (bijak-pool), by question id. */
  private async factsFor(subject: SubjectRef, kertas: number): Promise<Map<string, QuestionFacts>> {
    const list = await this.papersPorts.poolSource.candidates(this.scopeOf(subject, kertas))
    return new Map(list.map((f) => [f.id, f]))
  }

  /**
   * Publish check of the standard domain. Curated papers use tier 'structural' of `verifyComposition`
   * for blockers; the standard tier (quota, profile, KBAT) only produces notes and "Blueprint perlu
   * semakan" (D78 O-2). Runs only when facts exist for EVERY placed question (a question missing from
   * the pool is not live, which `checkPaper` already blocks).
   */
  private async structuralCheck(paper: PaperTree): Promise<{ blockers: string[]; notes: string[]; report: unknown | null }> {
    const none = { blockers: [], notes: [], report: null }
    if (paper.blueprintId === null) return none
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const blueprint = await this.repo.blueprintById(paper.blueprintId)
    if (!subject || !blueprint) return none
    const std = standardForPaper(paper, blueprint, bijakCodeOf(subject.code))
    if (!std) return none
    const composed = paper.sections.map((s, i) => ({ position: i + 1, questionIds: s.placements.map((pl) => idToString(pl.questionId)) }))
    const placed = composed.flatMap((c) => c.questionIds)
    if (placed.length === 0) return none
    const facts = await this.factsFor(subject, paper.kertas)
    if (placed.some((id) => !facts.has(id))) return none
    const labelOf = (pos: number) => std.sections.find((s) => s.position === pos)?.label ?? `Bahagian ${String(pos)}`
    const { blockers, notes } = violationLines(verifyComposition(std, composed, facts), labelOf)
    const report = blockers.length === 0 ? buildStandardReport(std, composed, facts, { seed: 0, solverVersion: SOLVER_VERSION }) : null
    return { blockers, notes, report }
  }

  // --- R1-B09a: placements -------------------------------------------------------------------------

  private statusText(status: string): string {
    return status === 'draft' ? PLACE.statusDraft : status === 'review' ? PLACE.statusReview : status === 'archived' ? PLACE.statusArchived : 'belum Terbit'
  }

  private async editorResult(paperId: bigint, extra: { added?: string[]; removed?: string[] }): Promise<BijakBuilderPlacementResult> {
    const fresh = await this.repo.findPilihan(paperId)
    if (!fresh) throw notFound()
    return { editor: await this.editorOf(fresh), ...extra }
  }

  /** Locks the paper, refuses a Terbit one, finds the section. Call inside a transaction. */
  private async editableSection(rawId: string, sectionRaw: string) {
    const paper = await this.lockedPaper(parseId(rawId))
    if (paper.status === 'published') throw invalid(MESSAGES.paperLocked)
    const sid = parseId(sectionRaw)
    const section = sid === null ? undefined : paper.sections.find((s) => s.id === sid)
    if (!section) throw invalid(MESSAGES.invalidSection)
    return { paper, section }
  }

  private pinsOf(section: PaperTree['sections'][number]): Map<string, number> {
    return new Map(section.placements.map((pl) => [idToString(pl.questionId), pl.pinnedVersionNo]))
  }

  async addPlacement(actor: AuditActor, rawId: string, rawBody: unknown): Promise<BijakBuilderPlacementResult> {
    const paperId = parseId(rawId)
    const out = await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(paperId)
      if (paper.status === 'published') throw invalid(MESSAGES.paperLocked)
      const body = parseWith(BijakBuilderPlacementAddSchema, rawBody)
      const sid = parseId(body.sectionId)
      const section = sid === null ? undefined : paper.sections.find((s) => s.id === sid)
      if (!section) throw invalid(MESSAGES.invalidSection)
      const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
      const bijakSubject = subject ? bijakCodeOf(subject.code) : ''
      const st = await this.structure([body.questionId])
      const q = st.info.get(body.questionId)
      if (!q) throw invalid(MESSAGES.invalidQuestion)
      const g = st.groupOf(q.id)
      const members = g ? st.membersOf(g) : [q.id]
      const reasonOf = (id: string): string | null => {
        const m = st.info.get(id)
        if (!m) return PLACE.notFound
        if (m.subject !== bijakSubject) return PLACE.otherSubject
        return isServableStatus(m.status) ? null : this.statusText(m.status)
      }
      for (const id of members) {
        const reason = reasonOf(id)
        if (reason) throw invalid(g ? PLACE.groupNotServable(g, id, reason) : PLACE.notServable(id, reason))
      }
      const onPaper = new Set(paper.sections.flatMap((s) => s.placements.map((pl) => idToString(pl.questionId))))
      for (const id of members) if (onPaper.has(id)) throw invalid(PLACE.alreadyPlaced(id))
      const pins = this.pinsOf(section)
      const current = section.placements.map((pl) => idToString(pl.questionId))
      const next = addUnit(current, q.id, st.groupOf, st.membersOf)
      await this.repo.replacePlacements(
        section.id,
        next.map((id) => ({ questionId: BigInt(id), pinnedVersionNo: pins.get(id) ?? st.info.get(id)!.versionNo })),
      )
      await this.repo.updatePaper(paper.id, { updatedAt: this.clock.now() })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, { from: 'draf', to: 'draf', op: 'place', added: next.length - current.length })
      return { id: paper.id, added: next.filter((id) => !current.includes(id)) }
    })
    return this.editorResult(out.id, { added: out.added })
  }

  /** D90 decision: removing any member removes the whole stimulus group. */
  async removePlacement(actor: AuditActor, rawId: string, rawQuestionId: string): Promise<BijakBuilderPlacementResult> {
    const paperId = parseId(rawId)
    const out = await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(paperId)
      if (paper.status === 'published') throw invalid(MESSAGES.paperLocked)
      const section = paper.sections.find((s) => s.placements.some((pl) => idToString(pl.questionId) === rawQuestionId))
      if (!section) throw invalid(PLACE.notPlaced(rawQuestionId))
      const current = section.placements.map((pl) => idToString(pl.questionId))
      const st = await this.structure(current)
      const next = removeUnit(current, rawQuestionId, st.groupOf)
      const pins = this.pinsOf(section)
      await this.repo.replacePlacements(section.id, next.map((id) => ({ questionId: BigInt(id), pinnedVersionNo: pins.get(id) ?? 1 })))
      await this.repo.updatePaper(paper.id, { updatedAt: this.clock.now() })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, { from: 'draf', to: 'draf', op: 'remove', removed: current.length - next.length })
      return { id: paper.id, removed: current.filter((id) => !next.includes(id)) }
    })
    return this.editorResult(out.id, { removed: out.removed })
  }

  async reorderSection(actor: AuditActor, rawId: string, rawSection: string, rawBody: unknown): Promise<BijakBuilderPlacementResult> {
    const id = await this.prisma.transaction(async () => {
      const { paper, section } = await this.editableSection(rawId, rawSection)
      const body = parseWith(BijakBuilderSectionOrderSchema, rawBody)
      const current = section.placements.map((pl) => idToString(pl.questionId))
      const st = await this.structure(current)
      const next = reorderUnits(current, body.order, st.groupOf)
      if (!next) throw invalid(PLACE.orderMismatch)
      const pins = this.pinsOf(section)
      await this.repo.replacePlacements(section.id, next.map((qid) => ({ questionId: BigInt(qid), pinnedVersionNo: pins.get(qid) ?? 1 })))
      await this.repo.updatePaper(paper.id, { updatedAt: this.clock.now() })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, { from: 'draf', to: 'draf', op: 'order', units: body.order.length })
      return paper.id
    })
    return this.editorResult(id, {})
  }

  // --- R1-B09a: review, student view, pool, generate, copy -------------------------------------------

  async review(rawId: string): Promise<BijakBuilderReview> {
    const pid = parseId(rawId)
    const paper = pid === null ? null : await this.repo.findPilihan(pid)
    if (!paper) throw notFound()
    const ev = await this.evaluate(paper)
    const structural = await this.structuralCheck(paper)
    const blockers = [...new Set([...publishErrors(ev.check), ...structural.blockers])]
    const rows = paper.sections.flatMap((s) =>
      s.placements.map((pl) => {
        const id = idToString(pl.questionId)
        const q = ev.info.get(id)
        const reason = !q ? PLACE.notFound : isServableStatus(q.status) ? null : this.statusText(q.status)
        return {
          questionId: id,
          ...(q?.groupId ? { groupId: q.groupId } : {}),
          section: s.label,
          ok: reason === null,
          ...(reason ? { reason: `Tidak disajikan: ${reason}` } : {}),
        }
      }),
    )
    return {
      paperId: idToString(paper.id),
      status: statusOf(paper.status),
      ok: blockers.length === 0,
      blockers,
      notes: structural.notes,
      blueprintNeedsReview: structural.notes.length > 0,
      visibleToStudents: paper.status === 'published',
      totalMarks: ev.check.totalMarks,
      totalBudget: ev.check.totalBudget,
      rows,
    }
  }

  async studentView(rawId: string): Promise<BijakBuilderStudentView> {
    const pid = parseId(rawId)
    const paper = pid === null ? null : await this.repo.findPilihan(pid)
    if (!paper) throw notFound()
    const ev = await this.evaluate(paper)
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const groupOf = (id: string): string | undefined => {
      const g = ev.info.get(id)?.groupId
      return g && ev.groups.has(g) ? g : undefined
    }
    let number = 0
    let total = 0
    const sections = paper.sections.map((s) => {
      const rule = ruleOf(s.ruleType, s.ruleN)
      const ids = s.placements.map((pl) => idToString(pl.questionId))
      const marksOf = (id: string) => s.placements.find((pl) => idToString(pl.questionId) === id)?.marksOverride ?? ev.info.get(id)?.marks ?? 0
      const units = unitsOf(ids, groupOf).map((u) => ({
        ...(u.groupId ? { groupId: u.groupId, stimulus: ev.groups.get(u.groupId)!.stimulus } : {}),
        questions: u.ids.map((id) => ({ id, number: ++number, preview: ev.info.get(id)?.preview ?? '', marks: marksOf(id) })),
      }))
      const marks = this.sectionMarksOf(s, ev.info)
      total += marks
      return { label: s.label, instruction: sectionInstruction(s.instruction, rule, s.placements.length), compulsory: s.compulsory, marks, units }
    })
    const code = subject ? bijakCodeOf(subject.code) : ''
    return {
      title: paper.title,
      subject: code,
      subjectName: subject?.name ?? code,
      kertas: paper.kertas,
      year: paper.year ?? mytYear(paper.createdAt),
      code: paper.paperCode ?? '',
      durationMin: paper.printedDurationMin,
      instructions: paper.instructions,
      reference: referencePanels(paper.referenceSheets),
      questionCount: number,
      marks: total,
      sections,
    }
  }

  private sectionMarksOf(section: PaperTree['sections'][number], info: ReadonlyMap<string, BuilderQuestionInfo>): number {
    return effectiveMarks(
      ruleOf(section.ruleType, section.ruleN),
      section.placements.map((pl) => pl.marksOverride ?? info.get(idToString(pl.questionId))?.marks ?? 0),
    )
  }

  /** Candidate pool of one section: single questions and whole groups as units (D90). */
  async sectionPool(rawId: string, rawSection: string, rawQuery: unknown): Promise<{ data: BijakBuilderPoolUnit[]; meta: ListMeta }> {
    const query = parseWith(BijakBuilderSectionPoolQuerySchema, rawQuery)
    const pid = parseId(rawId)
    const paper = pid === null ? null : await this.repo.findPilihan(pid)
    if (!paper) throw notFound()
    const sid = parseId(rawSection)
    const index = sid === null ? -1 : paper.sections.findIndex((s) => s.id === sid)
    if (index < 0) throw invalid(MESSAGES.invalidSection)
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    if (!subject) throw notFound()
    const blueprint = paper.blueprintId === null ? null : await this.repo.blueprintById(paper.blueprintId)
    const std = standardForPaper(paper, blueprint, bijakCodeOf(subject.code))
    const stdSection = std?.sections[index]
    const facts = [...(await this.factsFor(subject, paper.kertas)).values()]
    const onPaper = new Set(paper.sections.flatMap((s) => s.placements.map((pl) => idToString(pl.questionId))))
    const section = { pool: stdSection?.pool ?? null, allowedModes: stdSection?.allowedModes ?? [], quota: null }

    // Units: a complete group is ONE unit; an incomplete group is not offered (D90).
    const byGroup = new Map<string, QuestionFacts[]>()
    for (const f of facts) if (f.groupId) byGroup.set(f.groupId, [...(byGroup.get(f.groupId) ?? []), f])
    const units: { ids: string[]; groupId?: string; facts: QuestionFacts[] }[] = []
    const seen = new Set<string>()
    for (const f of facts) {
      if (seen.has(f.id)) continue
      const members = f.groupId ? (byGroup.get(f.groupId) ?? [f]) : [f]
      const sorted = [...members].sort((a, b) => (a.groupPosition ?? 1e9) - (b.groupPosition ?? 1e9) || (a.id < b.id ? -1 : 1))
      if (f.groupId && Math.max(...sorted.map((m) => m.groupSize ?? 0), sorted.length) > sorted.length) {
        for (const m of sorted) seen.add(m.id)
        continue
      }
      for (const m of sorted) seen.add(m.id)
      units.push({ ids: sorted.map((m) => m.id), ...(f.groupId && sorted.length > 1 ? { groupId: f.groupId } : {}), facts: sorted })
    }
    const levelOf = (f: QuestionFacts) => (f.unit ? f.unit.level.toLowerCase() : f.formOrigin)
    const filtered = units.filter((u) => {
      if (query.level && !u.facts.some((f) => levelOf(f) === query.level)) return false
      if (query.unit && !u.facts.some((f) => f.unit?.nodeId === query.unit)) return false
      return true
    })
    const eligibilityOfUnit = (u: (typeof units)[number]): string[] => {
      const reasons = new Set<string>()
      for (const f of u.facts) for (const r of eligibilityOf(f, section, describeQuestion(f)).reasons) reasons.add((INELIGIBLE_TEXT as Record<string, string>)[r] ?? r)
      return [...reasons]
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? POOL_PAGE_SIZE
    // The text search needs the preview, so it is applied to the described units before paging.
    let candidates = filtered
    let described: ReadonlyMap<string, BuilderQuestionInfo> = new Map()
    if (query.q) {
      described = await this.questions.describe(filtered.flatMap((u) => u.ids).slice(0, MAX_EDITOR_CANDIDATES + 500).map((id) => ({ id })))
      const needle = query.q.toLowerCase()
      candidates = filtered.filter((u) => u.ids.some((id) => (described.get(id)?.preview ?? '').toLowerCase().includes(needle) || (described.get(id)?.topic ?? '').toLowerCase().includes(needle)))
    }
    const slice = candidates.slice((page - 1) * pageSize, page * pageSize)
    const info = new Map(described)
    const missing = slice.flatMap((u) => u.ids).filter((id) => !info.has(id))
    if (missing.length) for (const [id, q] of await this.questions.describe(missing.map((id) => ({ id })))) info.set(id, q)
    const gids = [...new Set(slice.flatMap((u) => (u.groupId ? [u.groupId] : [])))]
    const groups = gids.length ? await this.questions.groups(gids) : new Map<string, BuilderGroupInfo>()
    const data = slice.map((u): BijakBuilderPoolUnit => {
      const questions = u.ids.flatMap((id) => (info.get(id) ? [this.questionWire(info.get(id)!)] : []))
      const group = u.groupId ? groups.get(u.groupId) : undefined
      const reasons = eligibilityOfUnit(u)
      return {
        ...(u.groupId ? { groupId: u.groupId } : {}),
        ...(group ? { stimulus: group.stimulus } : {}),
        questionIds: u.ids,
        questions,
        marks: questions.reduce((n, q) => n + q.marks, 0),
        eligible: reasons.length === 0,
        reasons,
        placed: u.ids.some((id) => onPaper.has(id)),
      }
    })
    return { data, meta: listMeta(page, pageSize, candidates.length) }
  }

  /** Head blueprint (Spec or Disahkan) of a subject and kertas for admin generation, or null. */
  private async generationBlueprint(subjectCode: string, kertas: number) {
    const subject = await this.repo.subjectByCode(curriculumCodeOf(subjectCode))
    if (!subject || kertas > MAX_KERTAS) return { subject: null, blueprint: null }
    const blueprint = await this.repo.activeBlueprint(subject.id, kertas)
    return { subject, blueprint: blueprint && blueprint.source !== 'draft' ? blueprint : null }
  }

  /** Pratonton kolam: the pre-checks and the reference verdict over the same candidates as generation. */
  async poolPreview(rawQuery: unknown): Promise<BijakPoolPreview> {
    const query = parseWith(BijakBuilderPoolPreviewQuerySchema, rawQuery)
    const { subject, blueprint } = await this.generationBlueprint(query.subject, query.kertas)
    if (!subject || !blueprint) throw ApiError.of('NOT_FOUND', { message: MESSAGES.blueprintNotFound })
    const std = toStandard(blueprint, bijakCodeOf(subject.code))
    const candidates = [...(await this.factsFor(subject, query.kertas)).values()]
    const preview = previewStandard(std, candidates)
    const published = candidates.length
    return {
      blueprint: { version: blueprint.version, source: sourceToWire(blueprint.source) },
      publishedTotal: published,
      eligibleTotal: published - preview.excluded.total,
      verdict: preview.verdict,
      firstFailure: preview.firstFailure ? shortageToWire(preview.firstFailure) : null,
      excluded: {
        total: preview.excluded.total,
        byReason: preview.excluded.byReason.map((r) => ({ reason: r.reason, count: r.count, bankQuery: excludedBankQuery(r.reason, subject.id.toString()) })),
      },
      warnings: preview.warnings as BijakPoolPreview['warnings'],
      sections: preview.sections.map(({ minSlack: _m, failures: _f, marks, ...s }) => {
        void _m
        void _f
        return { ...s, marks: { needed: marks.needed, reachable: marks.reachable }, bankQuery: { subjectId: subject.id.toString(), status: 'approved' } }
      }),
    }
  }

  /** Jana set: a DRAFT curated paper filled by `composeStandardPaper` (exact or refuse). */
  async generateDraft(actor: AuditActor, rawBody: unknown): Promise<{ paperId: string }> {
    const body = parseWith(BijakDraftGenerateRequestSchema, rawBody)
    const { subject, blueprint } = await this.generationBlueprint(body.subject, body.kertas)
    if (!subject || !blueprint) throw noBlueprint()
    const std = toStandard(blueprint, bijakCodeOf(subject.code))
    const candidates = [...(await this.factsFor(subject, body.kertas)).values()]
    const now = this.clock.now()
    const [seen, previous] = await Promise.all([this.papersPorts.poolSource.seen(actor.userId), this.repo.countPilihan(undefined)])
    const seed = fnv1a32(`${now.toISOString()}|${actor.userId}|${blueprint.code}|${String(previous)}`)
    const outcome = composeStandardPaper(std, candidates, { seed, seen })
    if (!outcome.ok) {
      if (outcome.reason === 'shortage') throw shortage(outcome.shortages.map(shortageToWire))
      if (outcome.reason === 'limit') throw generateLimit()
      throw new Error('bijak draft generate: the independent re-check found a violation')
    }
    const factsById = new Map(candidates.map((f) => [f.id, f]))
    const id = await this.prisma.transaction(async () => {
      await this.repo.lockBlueprint(blueprint.id)
      const paperId = await this.repo.createPaper(this.newPaperFrom(blueprint, subject, body.kertas, actor, now, DEFAULT_TITLE(subject.name, body.kertas)))
      const fresh = await this.repo.findPilihan(paperId)
      for (const [i, section] of (fresh?.sections ?? []).entries()) {
        const ids = outcome.sections.find((c) => c.position === i + 1)?.questionIds ?? []
        await this.repo.replacePlacements(section.id, ids.map((qid) => ({ questionId: BigInt(qid), pinnedVersionNo: factsById.get(qid)?.versionNo ?? 1 })))
      }
      await this.repo.updatePaper(paperId, { standardReport: outcome.report as never })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_CREATED, paperId, { from: null, to: 'draf', mode: 'generate', sections: blueprint.sections.length })
      return paperId
    })
    return { paperId: idToString(id) }
  }

  private newPaperFrom(blueprint: NonNullable<Awaited<ReturnType<BuilderRepository['activeBlueprint']>>>, subject: SubjectRef, kertas: number, actor: AuditActor, now: Date, title: string) {
    return {
      title,
      subjectId: subject.id,
      kertas,
      year: mytYear(now),
      paperCode: blueprint.code,
      printedDurationMin: blueprint.durationMin,
      instructions: blueprint.instructions,
      referenceSheets: referencePanels(blueprint.referenceSheets),
      blueprintId: blueprint.id,
      createdById: BigInt(actor.userId),
      isTest: actor.isTest,
      sections: blueprint.sections.map((s) => ({
        label: s.label,
        instruction: s.instruction,
        ruleType: s.ruleType === 'choose' ? ('choose' as const) : ('all' as const),
        ruleN: s.ruleType === 'choose' ? s.ruleN : null,
        questionCount: s.questionCount,
        markBudget: s.markBudget ?? s.questionCount,
        compulsory: s.compulsory,
      })),
    }
  }

  /** "Salin set" (V2 `clonePaperToDraft`): a new draf with the same header, sections and placements. */
  async copy(actor: AuditActor, rawId: string): Promise<{ id: string }> {
    const sourceId = parseId(rawId)
    const id = await this.prisma.transaction(async () => {
      const source = await this.lockedPaper(sourceId)
      const now = this.clock.now()
      const newId = await this.repo.createPaper({
        title: `${source.title}${PLACE.copySuffix}`,
        subjectId: source.subjectId,
        kertas: source.kertas,
        year: source.year ?? mytYear(now),
        paperCode: source.paperCode ?? '',
        printedDurationMin: source.printedDurationMin,
        instructions: source.instructions,
        referenceSheets: referencePanels(source.referenceSheets),
        blueprintId: source.blueprintId as bigint,
        createdById: BigInt(actor.userId),
        isTest: actor.isTest,
        sections: source.sections.map((s) => ({
          label: s.label,
          instruction: s.instruction,
          ruleType: s.ruleType === 'choose' ? ('choose' as const) : ('all' as const),
          ruleN: s.ruleN,
          questionCount: s.questionCount,
          markBudget: s.markBudget,
          compulsory: s.compulsory,
        })),
      })
      const fresh = await this.repo.findPilihan(newId)
      const info = await this.questions.describe(source.sections.flatMap((s) => s.placements.map((pl) => ({ id: idToString(pl.questionId) }))))
      for (const [i, section] of (fresh?.sections ?? []).entries()) {
        const placements = source.sections[i]?.placements ?? []
        await this.repo.replacePlacements(
          section.id,
          placements.map((pl) => ({ questionId: pl.questionId, pinnedVersionNo: info.get(idToString(pl.questionId))?.versionNo ?? pl.pinnedVersionNo })),
        )
      }
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_CREATED, newId, { from: null, to: 'draf', copyOf: idToString(source.id) })
      return newId
    })
    return { id: idToString(id) }
  }

  async withdraw(actor: AuditActor, rawId: string): Promise<{ ok: true }> {
    const id = parseId(rawId)
    await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      if (paper.status !== 'published') return
      await this.repo.updatePaper(paper.id, { status: 'withdrawn', publishedAt: null, updatedAt: this.clock.now() })
      await this.repo.clearOverrides(paper.id)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_WITHDRAWN, paper.id, { from: 'terbit', to: 'draf' })
    })
    return { ok: true }
  }

  async preview(rawBody: unknown): Promise<BijakBuilderPreview> {
    const body = parseWith(BijakBuilderPreviewRequestSchema, rawBody)
    return this.questions.review(body.ids)
  }
}
