import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_MESSAGES as MESSAGES,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderGroupLabelSchema,
  servabilityReasonMs,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPublishRequestSchema,
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
  type BijakAttemptStimulus,
  type ServabilityReport,
  type ListMeta,
} from '@pp/contract'
import type { z } from 'zod'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import type { Prisma } from '../../../db/generated/client'
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
import { ServabilityService, StimuliService } from '../../questions'
import { blueprintView } from '../blueprints/blueprint-view'
import { toStandard } from '../blueprints/blueprint-standard'
import type { AuditActor } from './actor'
import {
  attemptRefusalLine,
  BIJAK_BUILDER_PAGE_SIZE,
  contractNotVerifiedLine,
  DESCRIBE_CHUNK,
  GROUP_MIN_MEMBERS_MESSAGE,
  isServableStatus,
  MAX_EDITOR_CANDIDATES,
  MIN_GROUP_MEMBERS,
  POOL_PAGE_SIZE,
} from './builder.constants'
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
import { checkPaperDetailed, normalizeUnits, reorderUnits, unitsOf, addUnit, removeUnit, type CheckIssue, type PaperCheck } from './paper-check'
import { blockerView, toBlockers, type BlockerDraft } from './blockers'
import { shortageToWire, standardForPaper, violationLines } from './standard'
import { BijakBuilderPorts, type BuilderGroupInfo, type BuilderQuestionInfo, type BuilderQuestionRef } from './ports'

type Info = ReadonlyMap<string, BuilderQuestionInfo>

const MAX_KERTAS = 32767

const DEFAULT_TITLE = (subjectName: string, kertas: number) => `Percubaan SPM ${subjectName} Kertas ${String(kertas)} (draf)`

const statusOf = (dbStatus: string): BijakBuilderPaperStatus => (dbStatus === 'published' ? 'terbit' : 'draf')

/** `stimuli` of a group on the wire: the port's list, else the single stimulus, else none (a group with nothing displayable, D90). */
const stimuliOfGroup = (g: BuilderGroupInfo): BijakAttemptStimulus[] => g.stimuli ?? (g.stimulus ? [g.stimulus] : [])

/** The stimulus fields of a group unit: `stimulus` only when there is one; `stimuli` is always present for a group. */
const groupStimulusFields = (g: BuilderGroupInfo | undefined): { stimulus?: BijakAttemptStimulus; stimuli: BijakAttemptStimulus[] } =>
  g ? { ...(g.stimulus ? { stimulus: g.stimulus } : {}), stimuli: stimuliOfGroup(g) } : { stimuli: [] }

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
  /** The blocking lines of `check` with their codes (same order as `publishErrors(check)`). */
  issues: CheckIssue[]
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
    @Inject(ServabilityService) private readonly servability: ServabilityService,
    @Inject(StimuliService) private readonly stimuli: StimuliService,
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
      const { check, issues } = checkPaperDetailed({
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
        // D93 is about stimulus groups: a group the bank emits without a stimulus is still a unit (D90) but stays outside the minimum.
        isStimulusGroup: (g) => groups.get(g)?.stimulus !== undefined,
      })
      return { info, groups, check, issues }
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
        return g ? [{ id: g.id, ...(g.stimulus ? { stimulus: g.stimulus } : {}), stimuli: stimuliOfGroup(g), questionIds: g.questionIds }] : []
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

  /** R1-T34: every reference-panel image must be a stored question image (public token or decimal id). */
  private async checkReferenceImages(refs: readonly string[]): Promise<void> {
    if (refs.length === 0) return
    const known = await this.repo.existingImages(refs)
    if (refs.some((r) => !known.has(r))) {
      throw ApiError.of('VALIDATION_ERROR', { message: MESSAGES.referenceImageInvalid, fields: { reference: MESSAGES.referenceImageInvalid } })
    }
  }

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
      for (const patch of sections) for (const qid of patch.questionIds ?? []) if (parseId(qid) !== null) wanted.add(qid)
      const st = await this.structure([...wanted])
      const plans: { sectionId: bigint; placements: { questionId: bigint; pinnedVersionNo: number }[] }[] = []
      const edits: { sectionId: bigint; data: Prisma.PaperSectionUncheckedUpdateInput }[] = []
      const resulting = new Map<bigint, string[]>(paper.sections.map((s) => [s.id, s.placements.map((pl) => idToString(pl.questionId))]))
      for (const patch of sections) {
        const sectionId = parseId(patch.id)
        const section = sectionId === null ? undefined : paper.sections.find((s) => s.id === sectionId)
        if (!section) throw invalid(MESSAGES.invalidSection)
        // R1-T34 "Sunting bahagian": the printed name, the authored instruction and "mesti dijawab"; the rule and the budget stay the Kontrak's.
        const data: Prisma.PaperSectionUncheckedUpdateInput = {
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.instruction !== undefined ? { instruction: patch.instruction === null || patch.instruction === '' ? null : patch.instruction } : {}),
          ...(patch.compulsory !== undefined ? { compulsory: patch.compulsory } : {}),
        }
        if (Object.keys(data).length > 0) edits.push({ sectionId: section.id, data })
        if (patch.questionIds === undefined) continue
        for (const qid of patch.questionIds) {
          const q = parseId(qid) === null ? undefined : st.info.get(qid)
          if (!q || q.subject !== bijakSubject) throw invalid(MESSAGES.invalidQuestion)
        }
        const dups = patch.questionIds.filter((qid, i) => patch.questionIds!.indexOf(qid) !== i)
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
      // R1-T34 "Bahan rujukan": every panel image must be a stored file (public token or id), never a free string.
      if (body.reference !== undefined) await this.checkReferenceImages(body.reference.flatMap((p) => (p.imageFileId ? [p.imageFileId] : [])))
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
        ...(body.reference !== undefined ? { referenceSheets: body.reference as unknown as Prisma.InputJsonValue } : {}),
        updatedAt: this.clock.now(),
      })
      for (const edit of edits) await this.repo.updateSection(edit.sectionId, edit.data)
      for (const plan of plans) await this.repo.replacePlacements(plan.sectionId, plan.placements)
      const status = statusOf(paper.status)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, {
        from: status,
        to: status,
        sections: plans.length,
        ...(edits.length > 0 ? { sectionEdits: edits.length } : {}),
        ...(body.reference !== undefined ? { reference: body.reference.length } : {}),
      })
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

  async publish(actor: AuditActor, rawId: string, rawBody?: unknown): Promise<BijakBuilderPublishResult> {
    const id = parseId(rawId)
    return this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      // The body is optional (no body = the plain Terbit); a bad body is 422 only after the paper is known to exist.
      const request = parseWith(BijakBuilderPublishRequestSchema, rawBody ?? {})
      const ev = await this.evaluate(paper)
      const structural = await this.structuralCheck(paper)
      const reports = await this.servability.reports(paper.sections.flatMap((s) => s.placements.map((pl) => idToString(pl.questionId))))
      // ONE rule for the review and for publish: `collectBlockers` (hard = the paper's own checks incl. D93 groups, a question missing from the
      // pool, a question pupils cannot be served; overridable = the Kontrak line, which a paper that is already Terbit keeps (overridden), plus the structural blueprint lines).
      const blockers = this.collectBlockers(paper, ev, structural, reports)
      const errors = blockers.map((b) => b.message)
      const overridable = blockers.filter((b) => b.overridable).map((b) => b.message)
      const view = blockerView(blockers)
      const review = structural.notes.length > 0 ? { notes: structural.notes, blueprintNeedsReview: true } : {}
      // R1-T34 (V2 `studio.paper.published_override`): only the blueprint-conformance blockers (incl. a contract that is not Disahkan) can be overridden, with a reason, audited.
      const override = request.override === true && view.canOverride
      if (errors.length > 0 && !override) return { ok: false, errors, ...view, ...review }
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
        ...(override ? { override: true } : {}),
      })
      if (override) {
        await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_PUBLISHED_OVERRIDE, paper.id, {
          reason: request.reason,
          overridden: overridable.slice(0, 50),
          count: overridable.length,
        })
        return { ok: true, errors: [], overridden: overridable, ...review }
      }
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
   * semakan" (D78 O-2). A placed question that is missing from the candidate pool raises ONE blocker with its id
   * (`fixed`: the audited override never lifts it) and every other check still runs. AC-R1-16.2 (R1E2E-07): a
   * contract that is not Disahkan is a blocker (`blockers`, so the audited override applies).
   */
  private async structuralCheck(paper: PaperTree): Promise<{ blockers: BlockerDraft[]; contract: BlockerDraft[]; fixed: BlockerDraft[]; notes: string[]; report: unknown | null }> {
    const none = { blockers: [] as BlockerDraft[], contract: [] as BlockerDraft[], fixed: [] as BlockerDraft[], notes: [] as string[], report: null }
    if (paper.blueprintId === null) return none
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const blueprint = await this.repo.blueprintById(paper.blueprintId)
    if (!subject || !blueprint) return none
    const contract: BlockerDraft[] = blueprint.source === 'verified' ? [] : [{ code: 'BLUEPRINT_NOT_VERIFIED', message: contractNotVerifiedLine(blueprint.code, blueprint.version, sourceToWire(blueprint.source)) }]
    const std = standardForPaper(paper, blueprint, bijakCodeOf(subject.code))
    if (!std) return { ...none, contract }
    const composed = paper.sections.map((s, i) => ({ position: i + 1, questionIds: s.placements.map((pl) => idToString(pl.questionId)) }))
    if (composed.every((c) => c.questionIds.length === 0)) return { ...none, contract }
    const facts = await this.factsFor(subject, paper.kertas)
    const labelOf = (pos: number) => std.sections.find((s) => s.position === pos)?.label ?? `Bahagian ${String(pos)}`
    const lines = violationLines(verifyComposition(std, composed, facts), labelOf)
    // The frozen report needs a clean composition; the contract line alone does not stop it (an override publishes with it).
    const report = lines.blockerIssues.length === 0 && lines.fixedIssues.length === 0 ? buildStandardReport(std, composed, facts, { seed: 0, solverVersion: SOLVER_VERSION }) : null
    return { blockers: lines.blockerIssues, contract, fixed: lines.fixedIssues, notes: lines.notes, report }
  }

  /**
   * The Terbit blockers of a paper, in display order, with the single `overridable` rule (contract `BIJAK_BUILDER_BLOCKER_OVERRIDABLE`). Used by
   * `review` AND `publish`, so the two always agree. Hard (never overridable): the paper's own checks (incl. D93 groups), a placed question missing
   * from the pool, a question pupils cannot be served. Overridable: the Kontrak is not Disahkan (not for a paper that is already Terbit) and the
   * structural blueprint blockers.
   */
  private collectBlockers(
    paper: PaperTree,
    ev: Evaluation,
    structural: { blockers: BlockerDraft[]; contract: BlockerDraft[]; fixed: BlockerDraft[] },
    reports: ReadonlyMap<string, ServabilityReport>,
  ) {
    return toBlockers([
      ...ev.issues,
      ...structural.fixed,
      ...this.attemptBlockers(paper, ev, reports),
      ...(paper.status === 'published' ? [] : structural.contract),
      ...structural.blockers,
    ])
  }

  /**
   * R1E2E-06: every placed question the attempt path would refuse (`resolveForAttempt` + the BE-09 bridge) blocks Terbit. The verdict is the
   * ServabilityService `simulasi_paper` one; "not on a published paper" is the paper's own business, and a question that is not approved is
   * already counted by `checkPaper` ("n soalan belum Terbit"). Never overridable.
   */
  private attemptBlockers(paper: PaperTree, ev: Evaluation, reports: ReadonlyMap<string, ServabilityReport>): BlockerDraft[] {
    const out: BlockerDraft[] = []
    const seen = new Set<string>()
    for (const s of paper.sections)
      for (const pl of s.placements) {
        const id = idToString(pl.questionId)
        if (seen.has(id)) continue
        seen.add(id)
        const q = ev.info.get(id)
        if (!q || !isServableStatus(q.status)) continue
        const sim = reports.get(id)?.activities.find((a) => a.activity === 'simulasi_paper')
        const reason = (sim?.reasons ?? []).find((r) => r.code !== 'not_on_published_paper')
        if (reason) out.push({ code: 'NOT_SERVABLE', message: attemptRefusalLine(id, reason.message), questionId: id })
      }
    return out
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
    // R1-T34 (B09a, "Dilihat murid di"): the per-row verdict comes from ServabilityService (one batch); the paper is the authority for
    // "not on a published paper", so that one reason is left out. A question the service does not know keeps the status-only reason.
    const placed = paper.sections.flatMap((s) => s.placements.map((pl) => idToString(pl.questionId)))
    const reports = await this.servability.reports(placed)
    const blockerList = this.collectBlockers(paper, ev, structural, reports)
    const blockers = blockerList.map((b) => b.message)
    const rows = paper.sections.flatMap((s) =>
      s.placements.map((pl) => {
        const id = idToString(pl.questionId)
        const q = ev.info.get(id)
        const report = reports.get(id)
        const sim = report?.activities.find((a) => a.activity === 'simulasi_paper')
        const fromReport = (sim?.reasons ?? []).filter((r) => r.code !== 'not_on_published_paper')
        const legacy = !q ? PLACE.notFound : isServableStatus(q.status) ? null : this.statusText(q.status)
        // The builder places approved questions only (D54a): a status that is not servable is reported with the same cause and fix copy
        // as "Dilihat murid di", even where a published paper would keep serving an archived version.
        const reasons: { code: string; message: string; detail?: string }[] =
          legacy !== null && fromReport.length === 0 && q
            ? [{ code: q.status === 'archived' ? 'archived' : 'not_approved', message: servabilityReasonMs(q.status === 'archived' ? 'archived' : 'not_approved', 'simulasi_paper') }]
            : fromReport
        const reason = legacy ?? (reasons[0] ? reasons[0].message : null)
        const ok = reason === null
        return {
          questionId: id,
          ...(q?.groupId ? { groupId: q.groupId } : {}),
          section: s.label,
          ok,
          ...(reason ? { reason: legacy ? `Tidak disajikan: ${legacy}` : `Tidak disajikan: ${reason}` } : {}),
          ...(reasons.length > 0 ? { reasons: reasons.map((r) => ({ code: r.code, message: r.message, ...(r.detail ? { detail: r.detail } : {}) })) } : {}),
          ...(report ? { seenIn: { served: report.servedCount, total: report.total } } : {}),
        }
      }),
    )
    return {
      paperId: idToString(paper.id),
      status: statusOf(paper.status),
      ok: blockers.length === 0,
      blockers,
      ...blockerView(blockerList),
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
        ...(u.groupId ? { groupId: u.groupId, ...groupStimulusFields(ev.groups.get(u.groupId)) } : {}),
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
      // D90: a group stays a group (groupId + stimulus) even with one member; D93 then marks it not placeable below.
      units.push({ ids: sorted.map((m) => m.id), ...(f.groupId ? { groupId: f.groupId } : {}), facts: sorted })
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
      // The whole filtered candidate set is searched (chunked), then paged: nothing is truncated before the filter.
      const all = filtered.flatMap((u) => u.ids)
      const got = new Map<string, BuilderQuestionInfo>()
      for (let i = 0; i < all.length; i += DESCRIBE_CHUNK) {
        for (const [id, info] of await this.questions.describe(all.slice(i, i + DESCRIBE_CHUNK).map((id) => ({ id })))) got.set(id, info)
      }
      described = got
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
      // D93: a stimulus group with fewer than two members cannot be placed (only a group the bank knows has a stimulus).
      if (group?.stimulus && u.ids.length < MIN_GROUP_MEMBERS) reasons.push(GROUP_MIN_MEMBERS_MESSAGE)
      return {
        ...(u.groupId ? { groupId: u.groupId } : {}),
        ...(group ? groupStimulusFields(group) : {}),
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

  /**
   * Jana set: a DRAFT curated paper filled by `composeStandardPaper` (exact or refuse). The blueprint row is locked FIRST, the head is
   * re-read under the lock, and only then are the candidates read and the paper composed, all in one transaction, so a concurrent
   * retire / new version / edit of the Kontrak cannot slip in between composing and writing.
   */
  async generateDraft(actor: AuditActor, rawBody: unknown): Promise<{ paperId: string }> {
    const body = parseWith(BijakDraftGenerateRequestSchema, rawBody)
    const first = await this.generationBlueprint(body.subject, body.kertas)
    if (!first.subject || !first.blueprint) throw noBlueprint()
    const subject = first.subject
    const id = await this.prisma.transaction(async () => {
      await this.repo.lockBlueprint(first.blueprint!.id)
      const { blueprint } = await this.generationBlueprint(body.subject, body.kertas)
      if (!blueprint) throw noBlueprint()
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
      // A curated paper always conforms to a blueprint; a row without one cannot be copied (no cast, no null written).
      if (source.blueprintId === null) throw invalid(MESSAGES.noBlueprint)
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
        blueprintId: source.blueprintId,
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

  /** R1-T34 "Sunting petikan": the title of a stimulus group placed on a draft paper (the group is shared by the bank, D90). */
  async setGroupLabel(actor: AuditActor, rawId: string, groupId: string, rawBody: unknown): Promise<BijakBuilderEditor> {
    const pid = parseId(rawId)
    const paperId = await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(pid)
      if (paper.status === 'published') throw invalid(MESSAGES.paperLocked)
      const body = parseWith(BijakBuilderGroupLabelSchema, rawBody)
      const placed = paper.sections.flatMap((s) => s.placements.map((pl) => idToString(pl.questionId)))
      const st = await this.structure(placed)
      const onPaper = new Set(placed.flatMap((qid) => (st.groupOf(qid) ? [st.groupOf(qid)!] : [])))
      if (!onPaper.has(groupId)) throw invalid(MESSAGES.groupNotOnPaper)
      await this.stimuli.updateGroup(groupId, { label: body.label })
      await this.repo.updatePaper(paper.id, { updatedAt: this.clock.now() })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, { from: 'draf', to: 'draf', op: 'group_label', groupId })
      return paper.id
    })
    const fresh = await this.repo.findPilihan(paperId)
    if (!fresh) throw notFound()
    return this.editorOf(fresh)
  }

  async preview(rawBody: unknown): Promise<BijakBuilderPreview> {
    const body = parseWith(BijakBuilderPreviewRequestSchema, rawBody)
    return this.questions.review(body.ids)
  }
}
