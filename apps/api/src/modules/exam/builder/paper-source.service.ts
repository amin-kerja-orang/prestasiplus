import { Inject, Injectable, Logger } from '@nestjs/common'
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

/** An item the reviewer has not decided yet (the `OPEN` set of `intake/workflow/review.service.ts`). */
const OPEN_ITEM_STATES = ['generated', 'needs_review', 'duplicate']
/**
 * DEPENDENCY on S1-T03 / migration 0123 (`intake_items.section_label`): the column is not on this branch, so an item has no Bahagian of its own yet and
 * every accepted item goes to "Bahagian A". When 0123 lands, this ONE function reads `item.sectionLabel` (trimmed, falling back to the default).
 */
const DEFAULT_SECTION = 'Bahagian A'
function sectionOf(item: { id: bigint }): string {
  void item
  return DEFAULT_SECTION
}

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
  private readonly log = new Logger(PaperSourceService.name)

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

  /** Pre-flight of the multipart branch (route guard, before the body is buffered): 404 / 422 / 409, same texts as `upload`. Reads no body. */
  async assertUploadable(rawId: string): Promise<void> {
    const paper = await this.subjektifDraft(rawId)
    if (paper.sourceBatchId !== null) throw conflict(MESSAGES.sourceBatchExists)
  }

  /**
   * Intake refuses a file on `fields.files` (encrypted, corrupt, too many pages, duplicate, ...). The source route has no such part: the message moves to
   * `fields.paper`. The refusal cannot be tied to one file (intake stops at the first and does not say which), so it is always `paper`. Text unchanged.
   */
  private static asSourceRefusal(err: unknown): unknown {
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.fields && 'files' in err.fields) {
      const message = String(err.fields.files)
      return unprocessable({ paper: message }, message)
    }
    return err
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
    // The declaration is reported first (the tick comes before the file in the form), then the PDFs.
    if (declaration !== 'true') throw unprocessable({ declaration: MESSAGES.declarationRequired }, MESSAGES.declarationRequired)
    if (!parts.paper) throw unprocessable({ paper: MESSAGES.sourcePdfInvalid }, MESSAGES.sourcePdfInvalid)
    this.checkPdf(parts.paper, 'paper')
    if (parts.scheme) this.checkPdf(parts.scheme, 'scheme')

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
      try {
        await this.uploads.upload(auth, batch.id, files, who)
      } catch (err) {
        throw PaperSourceService.asSourceRefusal(err)
      }
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
      await this.abandon(auth, batch.id, who)
      throw err
    }
    return { batchId: batch.id }
  }

  /** The upload path failed after the batch was created: intake cancels it and removes its files (its own store; never throws). */
  private abandon(auth: AuthContext, batchId: string, who: CallerInfo): Promise<void> {
    return this.uploads.discardBatch(auth, batchId, who)
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

      const batch = await this.prisma.client.intakeBatch.findUnique({ where: { id: paper.sourceBatchId }, select: { status: true } })
      if (!batch || batch.status === 'processing' || batch.status === 'cancelled') throw conflict(MESSAGES.sourceBatchNotReady)

      const items = await this.prisma.client.intakeItem.findMany({
        where: { batchId: paper.sourceBatchId, reviewState: 'accepted' },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true, questionId: true },
      })
      const source = this.ports.questionSource
      const wanted = [...new Set(items.flatMap((i) => (i.questionId === null ? [] : [idToString(i.questionId)])))]
      const info = await source.describe(wanted.map((q) => ({ id: q })))
      // An accepted item whose question is gone (the FK nulls it) or has no version cannot be placed: refuse, write nothing (never pin a guessed version).
      const gone = items.find((i) => i.questionId === null || !info.has(idToString(i.questionId)))
      if (gone) throw conflict(MESSAGES.sourceItemQuestionMissing.replace('{id}', idToString(gone.id)))

      // Where each question already sits on the paper (any Bahagian): never placed a second time.
      const placedIn = new Map<string, bigint>()
      for (const sec of paper.sections) for (const pl of sec.placements) placedIn.set(idToString(pl.questionId), sec.id)
      const fresh = wanted.filter((q) => !placedIn.has(q))
      if (fresh.length === 0) return { placements: 0 }

      const groupIds = [...new Set([...info.values()].flatMap((i) => (i.groupId ? [i.groupId] : [])))]
      const groups = groupIds.length ? await source.groups(groupIds) : new Map()
      const groupOf = (q: string): string | undefined => {
        const g = info.get(q)?.groupId
        return g && groups.has(g) ? g : undefined
      }
      const accepted = new Set(wanted)

      // One Bahagian per distinct label, in order of first appearance; an existing one with the same label is reused.
      const labelOf = new Map<string, string>()
      for (const it of items) labelOf.set(idToString(it.questionId!), sectionOf(it))
      const labels = [...new Map([...labelOf.values()].map((l) => [l.trim().toLowerCase(), l] as const)).values()]
      let tree = paper
      let position = Math.max(0, ...paper.sections.map((x) => x.position))
      for (const label of labels) {
        if (tree.sections.some((x) => sameLabel(x.label, label))) continue
        position += 1
        await this.repo.addSection(paper.id, position, label)
        tree = (await this.repo.findPilihan(paper.id))!
      }

      let added = 0
      for (const label of labels) {
        const section = tree.sections.find((x) => sameLabel(x.label, label))!
        const next = section.placements.map((pl) => idToString(pl.questionId))
        const mine = fresh.filter((q) => sameLabel(labelOf.get(q) ?? '', label))
        for (const q of mine) {
          if (next.includes(q)) continue
          const g = groupOf(q)
          // Only the members that are accepted or already placed are placed; a rejected member is left out and a group with no accepted member never arrives here.
          const unit = g ? (groups.get(g)!.questionIds as string[]).filter((m) => (accepted.has(m) || placedIn.has(m)) && !next.includes(m)) : [q]
          if (g) {
            const members = groups.get(g)!.questionIds as string[]
            const elsewhere = members.some((m) => placedIn.has(m) && placedIn.get(m) !== section.id)
            const alsoElsewhere = unit.some((m) => labelOf.has(m) && !sameLabel(labelOf.get(m) ?? '', label))
            if (elsewhere || alsoElsewhere) throw ApiError.of('VALIDATION_ERROR', { message: QUESTION_MESSAGES.groupSplit, fields: { items: QUESTION_MESSAGES.groupSplit }, details: { group: g } })
          }
          // New members follow the last member of the group that is already in this Bahagian; otherwise they go to the end. No existing placement moves relative to another.
          const at = g ? Math.max(-1, ...next.map((m, i) => ((groups.get(g)!.questionIds as string[]).includes(m) ? i : -1))) : -1
          if (at >= 0) next.splice(at + 1, 0, ...unit)
          else next.push(...unit)
          added += unit.filter((m) => !placedIn.has(m)).length
        }
        const pins = new Map(section.placements.map((pl) => [idToString(pl.questionId), pl.pinnedVersionNo]))
        await this.repo.replacePlacements(
          section.id,
          next.map((q) => ({ questionId: BigInt(q), pinnedVersionNo: pins.get(q) ?? info.get(q)!.versionNo })),
        )
      }
      await this.repo.updatePaper(paper.id, { updatedAt: this.clock.now() })
      await this.record(actor, paper.id, { from: 'draf', to: 'draf', op: 'source_apply', added })
      return { placements: added }
    })
  }
}
