import { createHash } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'
import { INTAKE_DAILY_PAGE_QUOTA_CODE, INTAKE_FILE_MESSAGES, type IntakeUploadResult } from '@pp/contract'

import { AUDIT_ACTIONS } from '../../../common/audit'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import type { TxClient } from '../../../db/client'
import { CLOCK, type Clock, startOfMytDay } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FILE_STORAGE, type FileStorage } from '../../files'
import { detectOffice, inspectUpload, type OfficeMime } from '../../files/content-inspect'
import { FilesConfig } from '../../files/files.config'
import { FilesService, type StoredFile } from '../../files'
import { ScannerUnavailableError, VirusScanService } from '../../files/virus-scan'
import { JobsService } from '../../jobs'
import { OcrConfig, OcrError, PDF_ENGINE, type PdfEngine } from '../../ocr'
import { Semaphore } from '../../ocr/semaphore'
import { isAdmin, parseId, visibleBatches } from './intake-access'
import { INTAKE_JOB_ENTITY, INTAKE_JOB_TYPES, IntakeFilesConfig } from './intake-files.config'
import { type CallerInfo, IntakeFilesService } from './intake-files.service'
import { decodeUploadName, sanitizeOriginalName } from './intake-names'
import { discardStored } from './intake-storage'

export interface UploadedPart {
  buffer: Buffer
  originalname?: string
}

interface Checked {
  part: UploadedPart
  bytes: Buffer
  name: string
  sha256: string
  pages: number
  /** Set for a teacher's DOCX/XLSX (guru path only): stored as is, no pages, no job. */
  office?: OfficeMime
}

/** Narrow switches only the guru paper adapter passes; the admin route never does. */
export interface UploadOptions {
  acceptOffice?: boolean
}

const OPEN = ['submitted', 'processing']

/** Backlog #78. Local on purpose (the contract package is shared with the frontend). */
export const INTAKE_SCAN_UNAVAILABLE_CODE = 'UPLOAD_SCAN_UNAVAILABLE'
export const INTAKE_SCAN_MESSAGES = {
  infected: 'Fail ini mengandungi perisian berbahaya (virus) dan telah ditolak. Muat naik tidak diterima.',
  tooLarge: (mb: number) => `Fail terlalu besar untuk diimbas (had ${String(mb)} MB). Kecilkan fail dan cuba lagi.`,
  encrypted: 'Fail dilindungi kata laluan dan tidak dapat diimbas, jadi ditolak. Buka kunci fail dan cuba lagi.',
  tooComplex: 'Fail terlalu kompleks untuk diimbas sepenuhnya, jadi ditolak. Ringkaskan fail atau pecahkannya dan cuba lagi.',
  unavailable: 'Pengimbasan keselamatan fail tidak tersedia buat masa ini. Sila cuba lagi sebentar nanti.',
} as const

/**
 * clamd with AlertEncrypted* / AlertExceedsMax answers FOUND for encrypted content and for archives it could not fully scan: not malware, but not accepted.
 * Each has its own message and its own audit event (never the virus message, never `intake.file_infected`).
 */
export type ScanVerdictKind = 'malware' | 'encrypted' | 'limits_exceeded'
export function classifySignature(signature: string): ScanVerdictKind {
  if (/^Heuristics.Encrypted./i.test(signature)) return 'encrypted'
  if (/^Heuristics.Limits.Exceeded/i.test(signature)) return 'limits_exceeded'
  return 'malware'
}

function invalid(message: string): ApiError {
  return ApiError.of('VALIDATION_ERROR', { fields: { files: message } })
}

/**
 * The upload pipeline (BE-37, DESIGN.md). Runs in the request, before any job, and is ALL-OR-NOTHING: if one
 * file is refused nothing is stored. Order per request: batch (404/409), file count, then per file magic bytes
 * (PDF only), size, `pdfEngine.inspect` (encrypted, corrupt, bomb), page limit, hash duplicates, and the daily
 * page quota. The checks are repeated under a row lock just before the rows are written, so two parallel
 * uploads cannot both pass.
 */
@Injectable()
export class IntakeUploadService {
  /** Uploads being checked, stored and written at the same time in this process (the rest wait, F3). */
  private readonly slots: Semaphore
  private readonly log = new Logger(IntakeUploadService.name)
  /** Buffers that passed the scan in this process (weakly held), so a pre-parse scan is not repeated by the upload. */
  private readonly scanned = new WeakSet<Buffer>()

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(FilesConfig) private readonly filesConfig: FilesConfig,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(IntakeFilesConfig) private readonly config: IntakeFilesConfig,
    @Inject(OcrConfig) private readonly ocr: OcrConfig,
    @Inject(PDF_ENGINE) private readonly pdf: PdfEngine,
    @Inject(IntakeFilesService) private readonly batches: IntakeFilesService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(VirusScanService) private readonly scanner: VirusScanService,
  ) {
    this.slots = new Semaphore(config.uploadConcurrency)
  }

  /**
   * Undo of a batch whose upload the caller could not use (S3-T06: the paper source upload lost a race or could not link the batch). Cancels it (when not
   * already cancelled), deletes its file rows (pages cascade) and the stored objects. A batch that could not be cancelled is left whole. Never throws: a
   * partial failure is logged. Intake has no retention job for the files of a cancelled batch, so this is the only clean-up.
   */
  async discardBatch(auth: AuthContext, idText: string, who: CallerInfo): Promise<void> {
    const id = parseId(idText)
    if (id === null) return
    try {
      const rows = await this.prisma.client.intakeFile.findMany({ where: { batchId: id }, select: { fileId: true } })
      await this.batches.cancelBatch(auth, idText, who)
      if (rows.length === 0) return
      await this.prisma.client.intakeFile.deleteMany({ where: { batchId: id } })
      await discardStored(this.prisma, this.storage, rows.map((r) => idToString(r.fileId)))
    } catch (e) {
      this.log.error(`intake batch ${idText} could not be discarded: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** Cheap pre-flight (route guard): 404 for an unknown or out-of-scope batch, 409 for one that no longer takes files. Reads no body. */
  async assertOpen(auth: AuthContext, idText: string): Promise<void> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const batch = await this.prisma.client.intakeBatch.findFirst({ where: { id, ...visibleBatches(auth) }, select: { status: true } })
    if (!batch) throw ApiError.of('NOT_FOUND')
    if (!OPEN.includes(batch.status)) throw ApiError.of('CONFLICT', { message: INTAKE_FILE_MESSAGES.batchClosed })
  }

  async upload(auth: AuthContext, idText: string, parts: UploadedPart[], who: CallerInfo, signal?: AbortSignal, opts: UploadOptions = {}): Promise<IntakeUploadResult> {
    await this.assertOpen(auth, idText)
    // Excess requests wait here (their bodies are already buffered, which multer bounds per request).
    const release = await this.slots.acquire(signal)
    try {
      return await this.uploadLocked(auth, idText, parts, who, signal, opts)
    } finally {
      release()
    }
  }

  private async uploadLocked(auth: AuthContext, idText: string, parts: UploadedPart[], who: CallerInfo, signal: AbortSignal | undefined, opts: UploadOptions): Promise<IntakeUploadResult> {
    // The batch may have been closed while this request waited for a slot.
    await this.assertOpen(auth, idText)
    const batchId = idFromString(idText)
    if (parts.length === 0) throw invalid(INTAKE_FILE_MESSAGES.type)
    const max = this.config.maxFilesPerBatch
    if (parts.length > max) throw invalid(INTAKE_FILE_MESSAGES.tooManyFiles(max))

    const checked = await this.validate(auth, who, batchId, parts, signal, opts)
    await this.admit(this.prisma.client, auth, batchId, checked)

    // Store the bytes (outside the transaction), then write the rows and the jobs in one transaction.
    const stored: StoredFile[] = []
    try {
      for (const c of checked) {
        stored.push(
          c.office
            ? await this.files.storeIntakeOffice({ ownerUserId: auth.userId, bytes: c.bytes, isTest: auth.mode !== null })
            : await this.files.storeDerived({ ownerUserId: auth.userId, purpose: 'intake_original', bytes: c.bytes, isTest: auth.mode !== null }),
        )
      }
      return await this.prisma.transaction(
        async (tx) => {
          await this.lock(tx, auth, batchId, checked)
          await this.admit(tx, auth, batchId, checked)
          return this.write(tx, auth, batchId, checked, stored, who)
        },
        { maxWait: 10_000, timeout: 30_000 },
      )
    } catch (err) {
      await this.discard(stored)
      throw err
    }
  }

  // ---- validation (no storage) -----------------------------------------------------------------

  /** One file after the other, stopping at the first refusal, so a bad request costs at most one worker. */
  private async validate(auth: AuthContext, who: CallerInfo, batchId: bigint, parts: UploadedPart[], signal: AbortSignal | undefined, opts: UploadOptions): Promise<Checked[]> {
    const limit = this.filesConfig.intakeMaxBytes
    const checked: Checked[] = []
    const seen = new Set<string>()
    for (const part of parts) {
      const result = await this.checkOne(auth, who, batchId, seen, part, limit, signal, opts)
      if ('error' in result) throw result.error
      if (seen.has(result.sha256)) throw invalid(INTAKE_FILE_MESSAGES.duplicate)
      seen.add(result.sha256)
      checked.push(result)
    }
    return checked
  }

  private async checkOne(auth: AuthContext, who: CallerInfo, batchId: bigint, seen: ReadonlySet<string>, part: UploadedPart, limit: number, signal: AbortSignal | undefined, opts: UploadOptions): Promise<Checked | { error: ApiError }> {
    const buffer = part.buffer
    if (buffer.length > limit) return { error: invalid(INTAKE_FILE_MESSAGES.size(Math.floor(limit / (1024 * 1024)))) }
    if (opts.acceptOffice) {
      const office = detectOffice(buffer)
      if (office) {
        // Cheap refusals (a duplicate) come before the scan, which is the slow step (backlog #78, Z-5).
        if (await this.isDuplicate(auth, batchId, seen, createHash('sha256').update(buffer).digest('hex'))) return { error: invalid(INTAKE_FILE_MESSAGES.duplicate) }
        const refused = await this.scan(auth, who, part)
        if (refused) return { error: refused }
        return {
          part,
          bytes: buffer,
          name: sanitizeOriginalName(decodeUploadName(part.originalname)),
          sha256: createHash('sha256').update(buffer).digest('hex'),
          pages: 0,
          office,
        }
      }
    }
    const inspected = inspectUpload(buffer)
    if (!inspected || inspected.mime !== 'application/pdf') return { error: invalid(INTAKE_FILE_MESSAGES.type) }
    if (await this.isDuplicate(auth, batchId, seen, createHash('sha256').update(buffer).digest('hex'))) return { error: invalid(INTAKE_FILE_MESSAGES.duplicate) }
    // Scan before the PDF is opened by the inspection worker: a malicious file is never parsed.
    const refused = await this.scan(auth, who, part)
    if (refused) return { error: refused }
    let pages: number
    try {
      const info = await this.pdf.inspect(buffer, signal)
      if (info.encrypted) return { error: invalid(INTAKE_FILE_MESSAGES.encrypted) }
      pages = info.pageCount
    } catch (err) {
      if (err instanceof OcrError) return { error: invalid(this.messageFor(err.code)) }
      throw err
    }
    if (!Number.isInteger(pages) || pages < 1) return { error: invalid(INTAKE_FILE_MESSAGES.corrupt) }
    if (pages > this.ocr.maxPages) return { error: invalid(INTAKE_FILE_MESSAGES.pages(this.ocr.maxPages)) }
    return {
      part,
      bytes: inspected.bytes,
      name: sanitizeOriginalName(decodeUploadName(part.originalname)),
      sha256: createHash('sha256').update(inspected.bytes).digest('hex'),
      pages,
    }
  }

  /**
   * Backlog #78: the virus scan of one accepted-type file. Returns the refusal, or null when the file is clean or scanning is not required.
   * FAIL CLOSED: when scanning is required and the scanner is unset, unreachable, slow or answers badly, the upload is refused.
   * An infected file is refused with an audit event; nothing is stored (this runs before any storage write).
   */
  private async scan(auth: AuthContext, who: CallerInfo, part: UploadedPart): Promise<ApiError | null> {
    if (!this.scanner.required || this.scanned.has(part.buffer)) return null
    // A file over the clamd stream limit can never be scanned: say so (422), a retry would not help.
    if (part.buffer.length > this.scanner.maxBytes) return invalid(INTAKE_SCAN_MESSAGES.tooLarge(Math.floor(this.scanner.maxBytes / (1024 * 1024))))
    try {
      const outcome = await this.scanner.scan(part.buffer)
      if (outcome.status === 'clean') {
        this.scanned.add(part.buffer)
        return null
      }
      const kind = classifySignature(outcome.signature)
      await this.auditRefusedScan(auth, who, part, outcome.signature, kind)
      return invalid(kind === 'encrypted' ? INTAKE_SCAN_MESSAGES.encrypted : kind === 'limits_exceeded' ? INTAKE_SCAN_MESSAGES.tooComplex : INTAKE_SCAN_MESSAGES.infected)
    } catch (err) {
      if (err instanceof ScannerUnavailableError && err.reason === 'size_limit') return invalid(INTAKE_SCAN_MESSAGES.tooLarge(Math.floor(this.scanner.maxBytes / (1024 * 1024))))
      if (!(err instanceof ScannerUnavailableError)) this.log.error(`virus scan failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`)
      else this.log.error(err.message)
      return new ApiError({ code: INTAKE_SCAN_UNAVAILABLE_CODE, status: 503, message: INTAKE_SCAN_MESSAGES.unavailable, fields: { files: INTAKE_SCAN_MESSAGES.unavailable }, retryAfter: 30 })
    }
  }

  /**
   * Scans a file BEFORE the caller parses it (the guru adapter opens PDFs to look for a text layer). Throws the refusal (422 infected or too large,
   * 503 fail closed); a clean buffer is remembered so the later `upload` does not scan it twice. Does nothing when scanning is not required.
   */
  async scanBeforeParse(auth: AuthContext, who: CallerInfo, part: UploadedPart): Promise<void> {
    const refused = await this.scan(auth, who, part)
    if (refused) throw refused
  }

  /** Same content already in this request or in another live batch (the cheap check that runs before the scan). */
  private async isDuplicate(auth: AuthContext, batchId: bigint, seen: ReadonlySet<string>, sha256: string): Promise<boolean> {
    if (seen.has(sha256)) return true
    const dup = await this.prisma.client.intakeFile.findFirst({
      // A non-admin only matches this batch and their OWN live batches here, so the pre-scan check cannot be used to probe other people's uploads
      // (the transactional admit() keeps the global rule and its message).
      where: { sha256, OR: [{ batchId }, { batch: { status: { notIn: ['failed', 'cancelled'] }, ...visibleBatches(auth) } }] },
      select: { id: true },
    })
    return dup !== null
  }

  private async auditRefusedScan(auth: AuthContext, who: CallerInfo, part: UploadedPart, signature: string, kind: ScanVerdictKind): Promise<void> {
    try {
      await this.audit.record({
        action: kind === 'malware' ? AUDIT_ACTIONS.INTAKE_FILE_INFECTED : AUDIT_ACTIONS.INTAKE_FILE_UNSCANNABLE,
        actorUserId: auth.userId,
        actorRole: auth.active.role,
        scopeLevel: auth.active.scope.level,
        schoolId: auth.active.scope.schoolId ?? null,
        targetType: 'intake_batch',
        targetId: null,
        requestId: who.requestId,
        ip: who.ip,
        isTest: auth.mode !== null,
        details: { signature, kind, sha256: createHash('sha256').update(part.buffer).digest('hex'), name: sanitizeOriginalName(decodeUploadName(part.originalname)), bytes: part.buffer.length },
      })
    } catch (e) {
      this.log.error(`infected-file audit event could not be written: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** BM message of a PDF inspection failure. */
  private messageFor(code: OcrError['code']): string {
    switch (code) {
      case 'ENCRYPTED':
        return INTAKE_FILE_MESSAGES.encrypted
      case 'TOO_COMPLEX':
      case 'OCR_TIMEOUT':
        return INTAKE_FILE_MESSAGES.tooComplex
      case 'TOO_MANY_PAGES':
        return INTAKE_FILE_MESSAGES.pages(this.ocr.maxPages)
      default:
        return INTAKE_FILE_MESSAGES.corrupt
    }
  }

  // ---- admission (state-dependent rules) -------------------------------------------------------

  /** Serialises uploads of one batch, of one user (daily quota) and of the same content (duplicates). */
  private async lock(tx: TxClient, auth: AuthContext, batchId: bigint, checked: Checked[]): Promise<void> {
    await tx.$queryRaw`SELECT id FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:user:${auth.userId}`}, 0))`
    for (const sha of checked.map((c) => c.sha256).sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:sha:${sha}`}, 0))`
    }
  }

  private async admit(db: Pick<TxClient, 'intakeBatch' | 'intakeFile'>, auth: AuthContext, batchId: bigint, checked: Checked[]): Promise<void> {
    const batch = await db.intakeBatch.findUnique({ where: { id: batchId }, select: { status: true } })
    if (!batch) throw ApiError.of('NOT_FOUND')
    if (!OPEN.includes(batch.status)) throw ApiError.of('CONFLICT', { message: INTAKE_FILE_MESSAGES.batchClosed })

    const max = this.config.maxFilesPerBatch
    const existing = await db.intakeFile.count({ where: { batchId } })
    if (existing + checked.length > max) throw invalid(INTAKE_FILE_MESSAGES.tooManyFiles(max))

    const shas = checked.map((c) => c.sha256)
    const dup = await db.intakeFile.findFirst({
      where: { sha256: { in: shas }, OR: [{ batchId }, { batch: { status: { notIn: ['failed', 'cancelled'] } } }] },
      select: { id: true },
    })
    if (dup) throw invalid(INTAKE_FILE_MESSAGES.duplicate)

    if (!isAdmin(auth)) {
      const today = startOfMytDay(this.clock.now())
      const used = await db.intakeFile.aggregate({
        _sum: { pageCount: true },
        where: { batch: { ownerUserId: idFromString(auth.userId) }, createdAt: { gte: today, lt: new Date(today.getTime() + 24 * 3600 * 1000) } },
      })
      const adding = checked.reduce((n, c) => n + c.pages, 0)
      if ((used._sum.pageCount ?? 0) + adding > this.config.dailyPageQuota) {
        throw new ApiError({ code: INTAKE_DAILY_PAGE_QUOTA_CODE, status: 429, message: INTAKE_FILE_MESSAGES.dailyPageQuota(this.config.dailyPageQuota), retryAfter: 3600 })
      }
    }
  }

  // ---- writes ----------------------------------------------------------------------------------

  private async write(
    tx: TxClient,
    auth: AuthContext,
    batchId: bigint,
    checked: Checked[],
    stored: StoredFile[],
    who: CallerInfo,
  ): Promise<IntakeUploadResult> {
    const now = this.clock.now()
    const created: bigint[] = []
    for (const [i, c] of checked.entries()) {
      const file = await tx.intakeFile.create({
        data: {
          batchId,
          fileId: idFromString((stored[i] as StoredFile).id),
          originalName: c.name,
          sha256: c.sha256,
          sizeBytes: BigInt(c.bytes.length),
          pageCount: c.office ? null : c.pages,
          status: c.office ? 'done' : 'uploaded',
          createdAt: now,
        },
      })
      if (c.office) {
        // DOCX/XLSX: stored for the admin to download; nothing to read, so no pages and no job.
        created.push(file.id)
        continue
      }
      await tx.intakePage.createMany({ data: Array.from({ length: c.pages }, (_, n) => ({ intakeFileId: file.id, pageNo: n + 1 })) })
      await this.jobs.enqueue(
        {
          type: INTAKE_JOB_TYPES.processFile,
          idempotencyKey: `${INTAKE_JOB_TYPES.processFile}:${c.sha256}:${idToString(file.id)}`,
          entityType: INTAKE_JOB_ENTITY,
          entityId: idToString(file.id),
          payload: { intakeFileId: idToString(file.id) },
        },
        tx,
      )
      created.push(file.id)
    }
    const batch = await tx.intakeBatch.findUniqueOrThrow({ where: { id: batchId }, select: { submittedAt: true } })
    await tx.intakeBatch.update({
      where: { id: batchId },
      // An office-only batch has no job to finish it: it goes straight to review so the admin sees (and can download) the files.
      data: { status: checked.every((c) => c.office) ? 'ready_for_review' : 'processing', submittedAt: batch.submittedAt ?? now },
    })
    await this.audit.record({
      action: AUDIT_ACTIONS.INTAKE_FILES_UPLOADED,
      actorUserId: auth.userId,
      actorRole: auth.active.role,
      scopeLevel: auth.active.scope.level,
      schoolId: auth.active.scope.schoolId ?? null,
      targetType: 'intake_batch',
      targetId: idToString(batchId),
      requestId: who.requestId,
      ip: who.ip,
      isTest: auth.mode !== null,
      details: { files: checked.length, pages: checked.reduce((n, c) => n + c.pages, 0) },
      tx,
    })
    const detail = await this.batches.detail(auth, batchId)
    const ids = new Set(created.map((id) => idToString(id)))
    return { files: detail.files.filter((f) => ids.has(f.id)) }
  }

  /** Removes objects stored for a request that did not commit. Never throws. */
  private discard(stored: StoredFile[]): Promise<void> {
    return discardStored(this.prisma, this.storage, stored.map((s) => s.id))
  }
}
