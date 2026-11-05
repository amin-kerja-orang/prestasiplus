import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_MESSAGES as MESSAGES,
  BIJAK_NEGERI_ORDER,
  bijakNegeriSlug,
  BijakBuilderPaperSourceApplySchema,
  QUESTION_MESSAGES,
  type BijakBuilderPaperSourceApplyResult,
  type BijakBuilderPaperSourceUploadResult,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../../db/clock'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { bijakCodeOf } from '../../bijak/papers/subject-codes'
import { IntakeFilesService, type CallerInfo } from '../../intake/files/intake-files.service'
import { IntakeUploadService, type UploadedPart } from '../../intake/files/intake-upload.service'
import type { AuditActor } from './actor'
import { PAPER_SOURCE_MAX_BYTES } from './builder.constants'
import { BuilderRepository, type PaperTree } from './builder.repository'
import { BijakBuilderPorts } from './ports'
import { addUnit } from './paper-check'

/** An item the reviewer has not decided yet (the `OPEN` set of `intake/workflow/review.service.ts`). */
const OPEN_ITEM_STATES = ['generated', 'needs_review', 'duplicate']
/** Intake items carry no Bahagian of their own, so every accepted item goes to this one (reused when the paper already has it). */
const DEFAULT_SECTION = 'Bahagian A'

const unprocessable = (fields: Record<string, string>, message?: string): ApiError => ApiError.of('VALIDATION_ERROR', { ...(message ? { message } : {}), fields })
const conflict = (message: string): ApiError => ApiError.of('CONFLICT', { message })
const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: MESSAGES.paperNotFound })
const sameLabel = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

function parseId(text: string): bigint | null {
  return /^[1-9]\d{0,17}$/.test(text) ? BigInt(text) : null
}

/** Multipart parts of the source upload: `paper` (required) and `scheme` (optional). */
export interface SourceParts {
  paper?: UploadedPart
  scheme?: UploadedPart
}

/**
 * API-BIJAK-14 (S3-T06): the source PDF of a Kertas Subjektif. `upload` creates the intake batch for THIS paper through the S1 services
 * (`IntakeFilesService.createBatch`, `IntakeUploadService.upload`), edits no S1 file, and links it in `papers.source_batch_id`. `apply` appends the
 * `accepted` items of that batch as placements of the same paper (no new paper, no API-Q-25). Paper, section and placement rows go through
 * `BuilderRepository`.
 */
@Injectable()
export class PaperSourceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BuilderRepository) private readonly repo: BuilderRepository,
    @Inject(BijakBuilderPorts) private readonly ports: BijakBuilderPorts,
    @Inject(IntakeFilesService) private readonly batches: IntakeFilesService,
    @Inject(IntakeUploadService) private readonly uploads: IntakeUploadService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private record(actor: AuditActor, paperId: bigint, details: Record<string, unknown>) {
    return this.audit.record({
      action: AUDIT_ACTIONS.BIJAK_PAPER_UPDATED,
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

  /** A Kertas Subjektif that is still a draft; 404 / 422 / 409 as the contract says. */
  private async subjektifDraft(rawId: string): Promise<PaperTree> {
    const id = parseId(rawId)
    const paper = id === null ? null : await this.repo.findPilihan(id)
    if (!paper) throw notFound()
    if (paper.surface !== 'subjektif') throw unprocessable({ surface: MESSAGES.subjektifOnly }, MESSAGES.subjektifOnly)
    if (paper.status === 'published') throw conflict(MESSAGES.paperPublishedWithdrawFirst)
    return paper
  }

  private checkPdf(part: UploadedPart, field: 'paper' | 'scheme'): void {
    const name = (part.originalname ?? '').toLowerCase()
    const pdf = part.buffer.subarray(0, 5).toString('latin1') === '%PDF-'
    if (!name.endsWith('.pdf') || !pdf) throw unprocessable({ [field]: MESSAGES.sourcePdfInvalid }, MESSAGES.sourcePdfInvalid)
    if (part.buffer.length > PAPER_SOURCE_MAX_BYTES) throw unprocessable({ [field]: MESSAGES.sourcePdfTooLarge }, MESSAGES.sourcePdfTooLarge)
  }

  /**
   * Upload. A paper that already has a source batch is refused with 409 (replacing a batch whose items may be half decided is out of scope).
   * The intake upload is all-or-nothing; when it refuses a file, the batch just created is cancelled so no empty batch is left behind.
   */
  async upload(auth: AuthContext, actor: AuditActor, rawId: string, parts: SourceParts, declaration: string | undefined, who: CallerInfo): Promise<BijakBuilderPaperSourceUploadResult> {
    const paper = await this.subjektifDraft(rawId)
    if (paper.sourceBatchId !== null) throw conflict(MESSAGES.sourceBatchExists)
    if (!parts.paper) throw unprocessable({ paper: MESSAGES.sourcePdfInvalid }, MESSAGES.sourcePdfInvalid)
    this.checkPdf(parts.paper, 'paper')
    if (parts.scheme) this.checkPdf(parts.scheme, 'scheme')
    if (declaration !== 'true') throw unprocessable({ declaration: MESSAGES.declarationRequired }, MESSAGES.declarationRequired)

    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const year = paper.year ?? this.clock.now().getUTCFullYear()
    const negeri = BIJAK_NEGERI_ORDER.find((n) => bijakNegeriSlug(n) === paper.examBoard) ?? paper.examBoard ?? ''
    const batch = await this.batches.createBatch(
      auth,
      {
        paperType: 'trial',
        subject: subject ? bijakCodeOf(subject.code) : '',
        kertas: paper.kertas as 1 | 2 | 3 | 4,
        year,
        source: `Muat naik Admin Pusat: ${negeri} ${String(year)}`.replace(/\s+/g, ' ').trim().slice(0, 200),
        copyright: 'pihak-ketiga',
        declaration: true,
      },
      who,
    )
    const files: UploadedPart[] = [parts.paper, ...(parts.scheme ? [parts.scheme] : [])]
    try {
      await this.uploads.upload(auth, batch.id, files, who)
      await this.prisma.transaction(async () => {
        await this.repo.lockPaper(paper.id)
        const fresh = await this.repo.findPilihan(paper.id)
        if (!fresh) throw notFound()
        if (fresh.status === 'published') throw conflict(MESSAGES.paperPublishedWithdrawFirst)
        if (fresh.sourceBatchId !== null) throw conflict(MESSAGES.sourceBatchExists)
        await this.repo.updatePaper(paper.id, { sourceBatchId: BigInt(batch.id), updatedAt: this.clock.now() })
        await this.record(actor, paper.id, { from: 'draf', to: 'draf', op: 'source_upload', batchId: batch.id })
      })
    } catch (err) {
      await this.batches.cancelBatch(auth, batch.id, who).catch(() => undefined)
      throw err
    }
    return { batchId: batch.id }
  }

  /**
   * Apply (`{ apply: true }`). Appends the questions of the batch's `accepted` items, in printed order, to the one Bahagian of this paper; a stimulus
   * group is placed whole and contiguous. A re-call appends only what is not on the paper yet and never removes or reorders. 422 / 409 refuse
   * before anything is written.
   */
  async apply(actor: AuditActor, rawId: string, rawBody: unknown): Promise<BijakBuilderPaperSourceApplyResult> {
    new ZodValidationPipe(BijakBuilderPaperSourceApplySchema).transform(rawBody)
    const id = parseId(rawId)
    if (id === null) throw notFound()
    return this.prisma.transaction(async () => {
      await this.repo.lockPaper(id)
      const paper = await this.repo.findPilihan(id)
      if (!paper) throw notFound()
      if (paper.surface !== 'subjektif') throw unprocessable({ surface: MESSAGES.subjektifOnly }, MESSAGES.subjektifOnly)
      if (paper.sourceBatchId === null) throw unprocessable({ source: MESSAGES.sourceBatchMissing }, MESSAGES.sourceBatchMissing)
      if (paper.status === 'published') throw conflict(MESSAGES.paperPublishedWithdrawFirst)
      const open = await this.prisma.client.intakeItem.count({ where: { batchId: paper.sourceBatchId, reviewState: { in: OPEN_ITEM_STATES } } })
      if (open > 0) throw conflict(MESSAGES.itemsUndecided.replace('{n}', String(open)))

      const items = await this.prisma.client.intakeItem.findMany({
        where: { batchId: paper.sourceBatchId, reviewState: 'accepted', questionId: { not: null } },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { questionId: true },
      })
      const onPaper = new Set(paper.sections.flatMap((s) => s.placements.map((pl) => idToString(pl.questionId))))
      const wanted = [...new Set(items.map((i) => idToString(i.questionId!)))]
      const fresh = wanted.filter((q) => !onPaper.has(q))
      if (fresh.length === 0) return { placements: 0 }

      const source = this.ports.questionSource
      const info = await source.describe(wanted.map((q) => ({ id: q })))
      const groupIds = [...new Set([...info.values()].flatMap((i) => (i.groupId ? [i.groupId] : [])))]
      const groups = groupIds.length ? await source.groups(groupIds) : new Map()
      const groupOf = (q: string): string | undefined => {
        const g = info.get(q)?.groupId
        return g && groups.has(g) ? g : undefined
      }
      const membersOf = (g: string): string[] => groups.get(g)?.questionIds ?? []

      // A Bahagian: reuse the one with the same label (trimmed, case-insensitive), else add it.
      let section = paper.sections.find((s) => sameLabel(s.label, DEFAULT_SECTION))
      const current = section ? section.placements.map((pl) => idToString(pl.questionId)) : []
      // A group is placed whole: every member must be accepted here or already in this Bahagian (ERR-QST-02).
      const reachable = new Set([...wanted, ...current])
      for (const q of fresh) {
        const g = groupOf(q)
        if (g && membersOf(g).some((m) => !reachable.has(m))) {
          throw ApiError.of('VALIDATION_ERROR', { message: QUESTION_MESSAGES.groupSplit, fields: { items: QUESTION_MESSAGES.groupSplit }, details: { group: g } })
        }
      }
      let next = [...current]
      for (const q of fresh) next = addUnit(next, q, groupOf, membersOf)
      if (!section) {
        await this.repo.addSection(paper.id, Math.max(0, ...paper.sections.map((s) => s.position)) + 1, DEFAULT_SECTION)
        section = (await this.repo.findPilihan(paper.id))!.sections.find((s) => sameLabel(s.label, DEFAULT_SECTION))!
      }
      const pins = new Map(section.placements.map((pl) => [idToString(pl.questionId), pl.pinnedVersionNo]))
      await this.repo.replacePlacements(
        section.id,
        next.map((q) => ({ questionId: BigInt(q), pinnedVersionNo: pins.get(q) ?? info.get(q)?.versionNo ?? 1 })),
      )
      await this.repo.updatePaper(paper.id, { updatedAt: this.clock.now() })
      const added = next.filter((q) => !onPaper.has(q)).length
      await this.record(actor, paper.id, { from: 'draf', to: 'draf', op: 'source_apply', added })
      return { placements: added }
    })
  }
}
