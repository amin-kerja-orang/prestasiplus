import { Inject, Injectable } from '@nestjs/common'
import {
  KERTAS_DOKUMEN_MESSAGES,
  KertasDokumenAdminQuerySchema,
  type KertasDokumen,
  type KertasDokumenAdminDetail,
  type KertasDokumenAdminList,
  type KertasDokumenAdminRow,
  type KertasDokumenPage,
  type KertasDokumenSummary,
  type KertasDokumenToggleResult,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { AUDIT_ACTIONS } from '../../../common/audit/audit-actions'
import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import type { PaperDocument } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { AuditActor } from '../builder/actor'
import { DocumentsRepository, type DocumentWithPages, type SubjectRef } from './documents.repository'

const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: KERTAS_DOKUMEN_MESSAGES.notFound })
const fill = (text: string, title: string): string => text.replace('{title}', title)

/** A decimal id string, or null (a bad id is 404 like an unknown one: no oracle). */
function parseId(raw: string): bigint | null {
  try {
    return idFromString(raw)
  } catch {
    return null
  }
}

function summaryOf(d: PaperDocument, subject: SubjectRef | undefined): KertasDokumenSummary {
  return {
    id: idToString(d.id),
    title: d.title,
    subject: subject?.code ?? null,
    subjectName: subject?.name ?? null,
    kertas: d.kertas,
    negeri: d.negeri,
    year: d.year,
    pageCount: d.pageCount,
    schemePageCount: d.schemePageCount,
    marks: d.marksTotal,
    durationMinutes: d.durationMinutes,
  }
}

const pageOf = (p: { position: number; width: number | null; height: number | null; file: { publicId: string } }): KertasDokumenPage => ({
  position: p.position,
  url: `/api/files/${p.file.publicId}`,
  width: p.width,
  height: p.height,
})

/**
 * Kertas Subjektif page-image documents (V2 parity, 0265): the V2 `PaperDocumentController` (pupil list and view) and the V2 admin
 * controller (list, Pratonton, Terbit/Sembunyi). A pupil reads published documents only; an unpublished one is 404.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository) private readonly repo: DocumentsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Pupil list: published documents only. */
  async listPublished(): Promise<KertasDokumenSummary[]> {
    const rows = await this.repo.listPublished()
    const subjects = await this.repo.subjectsByIds(rows.flatMap((r) => (r.subjectId === null ? [] : [r.subjectId])))
    return rows.map((r) => summaryOf(r, r.subjectId === null ? undefined : subjects.get(r.subjectId.toString())))
  }

  private async view(doc: DocumentWithPages): Promise<KertasDokumen> {
    const subjects = await this.repo.subjectsByIds(doc.subjectId === null ? [] : [doc.subjectId])
    return {
      ...summaryOf(doc, doc.subjectId === null ? undefined : subjects.get(doc.subjectId.toString())),
      paperPages: doc.pages.filter((p) => p.kind === 'paper').map(pageOf),
      schemePages: doc.pages.filter((p) => p.kind === 'scheme').map(pageOf),
    }
  }

  /** Pupil view: the published document with its pages; 404 for an unknown or unpublished one. */
  async getPublished(rawId: string): Promise<KertasDokumen> {
    const id = parseId(rawId)
    const doc = id === null ? null : await this.repo.findWithPages(id)
    if (!doc || doc.publishedAt === null) throw notFound()
    return this.view(doc)
  }

  /** Admin preview: any status. */
  async getForAdmin(rawId: string): Promise<KertasDokumenAdminDetail> {
    const id = parseId(rawId)
    const doc = id === null ? null : await this.repo.findWithPages(id)
    if (!doc) throw notFound()
    return { ...(await this.view(doc)), status: doc.publishedAt === null ? 'draf' : 'terbit' }
  }

  /** Admin list with the three tiles (the tiles ignore the filters). */
  async listForAdmin(rawQuery: unknown): Promise<KertasDokumenAdminList> {
    const parsed = KertasDokumenAdminQuerySchema.safeParse(rawQuery ?? {})
    if (!parsed.success) throw ApiError.of('VALIDATION_ERROR')
    const q = parsed.data
    let subjectId: bigint | undefined
    if (q.subject !== undefined) {
      const subject = await this.repo.subjectByCode(q.subject)
      // An unknown subject code matches nothing.
      if (!subject) return { rows: [], total: 0, counts: await this.repo.counts() }
      subjectId = subject.id
    }
    const { rows, total } = await this.repo.listAdmin({ subjectId, kertas: q.kertas, status: q.status }, (q.page - 1) * q.pageSize, q.pageSize)
    const subjects = await this.repo.subjectsByIds(rows.flatMap((r) => (r.subjectId === null ? [] : [r.subjectId])))
    const out: KertasDokumenAdminRow[] = rows.map((r) => ({
      ...summaryOf(r, r.subjectId === null ? undefined : subjects.get(r.subjectId.toString())),
      status: r.publishedAt === null ? 'draf' : 'terbit',
    }))
    return { rows: out, total, counts: await this.repo.counts() }
  }

  /**
   * V2 `togglePublish`: a published document is hidden; a Draf one is published only with at least one paper page (422 otherwise).
   * Same transaction as the audit row.
   */
  async toggle(actor: AuditActor, rawId: string): Promise<KertasDokumenToggleResult> {
    const id = parseId(rawId)
    if (id === null) throw notFound()
    return this.prisma.transaction(async () => {
      const doc = await this.repo.lock(id)
      if (!doc) throw notFound()
      const wasPublished = doc.publishedAt !== null
      if (!wasPublished && doc.pageCount <= 0) {
        const message = fill(KERTAS_DOKUMEN_MESSAGES.noPages, doc.title)
        throw ApiError.of('VALIDATION_ERROR', { message, fields: { id: message } })
      }
      const now = this.clock.now()
      const updated = await this.repo.setPublished(id, wasPublished ? null : now, now)
      await this.audit.record({
        action: wasPublished ? AUDIT_ACTIONS.KERTAS_DOKUMEN_HIDDEN : AUDIT_ACTIONS.KERTAS_DOKUMEN_PUBLISHED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetType: 'kertas_dokumen',
        targetId: idToString(id),
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        details: { from: wasPublished ? 'terbit' : 'draf', to: wasPublished ? 'draf' : 'terbit' },
      })
      return { id: idToString(id), title: updated.title, status: wasPublished ? 'draf' : 'terbit' }
    })
  }
}
