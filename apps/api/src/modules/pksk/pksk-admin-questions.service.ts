import { Inject, Injectable } from '@nestjs/common'
import {
  PKSK_ADMIN_FLASH,
  PKSK_ADMIN_MESSAGES,
  PKSK_ADMIN_PAGE_SIZE,
  PKSK_BAHAGIAN,
  PkskAdminBulkRequestSchema,
  PkskAdminQuestionCreateSchema,
  PkskAdminQuestionListQuerySchema,
  PkskAdminQuestionUpdateSchema,
  pkskAdminFieldErrors,
  PKSK_QUESTION_STATUSES,
  type PkskAdminQuestionDetail,
  type PkskAdminQuestionListItem,
  type PkskAdminQuestionStats,
  type PkskBahagian,
  type PkskDomainCode,
  type PkskQuestionStatus,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import type { Caller } from '../users/caller'
import { invalid } from './errors'
import { PkskDomainsRepository, type DomainRecord } from './pksk-domains.repository'
import { PKSK_AUDIT, WRITE_TX } from './pksk.constants'
import { PKSK_QUESTIONS_PORT, type PkskQuestionInput, type PkskQuestionRecord, type PkskQuestionsPort } from './ports'
import { isLevel } from './rules'

const M = PKSK_ADMIN_MESSAGES

/** Removes control characters (kept: tab and newline) and trims: the text is plain text, stored sanitised, never HTML (SEC-M07-09). */
export function plainText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
}

/**
 * PKSK question bank screens (M07-10 to M07-16). Every read and write goes through the questions port, which only ever
 * sees PKSK-tagged questions, so the id of a non-PKSK question is "not found" (404 on the single routes, 422 `ids` on
 * the bulk route) and is never changed or deleted (SEC-M07-12, BR-M07-21). Admin only (the controller).
 */
@Injectable()
export class PkskAdminQuestionsService {
  constructor(
    @Inject(PKSK_QUESTIONS_PORT) private readonly questions: PkskQuestionsPort,
    @Inject(PkskDomainsRepository) private readonly domains: PkskDomainsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** M07-10: filters are AND-combined and case-insensitive; an unknown value gives an empty page. */
  async list(query: unknown): Promise<{ data: PkskAdminQuestionListItem[]; meta: ReturnType<typeof listMeta> }> {
    const raw = typeof query === 'object' && query !== null ? (query as Record<string, unknown>) : {}
    const { page: rawPage, ...rest } = raw
  delete rest.pageSize // accepted and ignored: the page size is fixed at 20
    const parsed = PkskAdminQuestionListQuerySchema.omit({ page: true }).safeParse(rest)
    if (!parsed.success) throw invalid(pkskAdminFieldErrors(parsed.error))
    const pageNo = Number(rawPage)
    const page = Number.isInteger(pageNo) && pageNo >= 1 ? pageNo : 1
    const empty = { data: [], meta: listMeta(page, PKSK_ADMIN_PAGE_SIZE, 0) }

    const bahagian = (parsed.data.bahagian ?? '').trim().toUpperCase()
    const level = (parsed.data.level ?? '').trim().toUpperCase()
    const status = (parsed.data.status ?? '').trim().toLowerCase()
    if (bahagian !== '' && !(PKSK_BAHAGIAN as readonly string[]).includes(bahagian)) return empty
    if (level !== '' && !isLevel(level)) return empty
    if (status !== '' && !(PKSK_QUESTION_STATUSES as readonly string[]).includes(status)) return empty

    const domains = await this.domains.list()
    const byCode = new Map(domains.map((d) => [d.code, d]))
    const { rows, total } = await this.questions.list({
      ...(bahagian !== '' ? { domainCodes: domains.filter((d) => d.bahagian === bahagian).map((d) => d.code) } : {}),
      ...(level !== '' && isLevel(level) ? { level } : {}),
      ...(status !== '' ? { status: status as PkskQuestionStatus } : {}),
      search: (parsed.data.search ?? '').trim(),
      page,
      pageSize: PKSK_ADMIN_PAGE_SIZE,
    })
    const data: PkskAdminQuestionListItem[] = []
    for (const r of rows) {
      const d = byCode.get(r.domainCode)
      if (!d) continue
      data.push({
        id: r.id,
        questionText: r.questionText,
        bahagian: d.bahagian,
        domain: { id: d.id, code: d.code as PkskDomainCode, name: d.name, icon: d.icon, color: d.color },
        targetLevel: r.targetLevel,
        status: r.status,
      })
    }
    return { data, meta: listMeta(page, PKSK_ADMIN_PAGE_SIZE, total) }
  }

  /** M07-11. */
  stats(): Promise<PkskAdminQuestionStats> {
    return this.questions.stats()
  }

  /** M07-13. */
  async get(id: string): Promise<PkskAdminQuestionDetail> {
    return this.detail(await this.must(id)) // async: awaited by the caller
  }

  /** M07-14: saved `approved` (BR-M07-03). */
  async create(caller: Caller, body: unknown): Promise<{ data: PkskAdminQuestionDetail; status: string }> {
    const parsed = PkskAdminQuestionCreateSchema.safeParse(body)
    const fields = parsed.success ? {} : pkskAdminFieldErrors(parsed.error)
    const domain = await this.domainOf(body, fields)
    const bahagian = parsed.success ? parsed.data.bahagian : (rawString(body, 'bahagian') as PkskBahagian | null)
    if (!fields.pkskDomainId && (domain === null || (bahagian !== null && domain.bahagian !== bahagian))) fields.pkskDomainId = M.domain
    if (Object.keys(fields).length > 0 || !parsed.success || domain === null) throw invalid(fields)
    const d = parsed.data
    const input: PkskQuestionInput = {
      domainCode: domain.code,
      targetLevel: d.pkskTargetLevel,
      status: 'approved',
      questionText: plainText(d.questionText),
      difficultyLevel: d.difficultyLevel ?? null,
      explanation: cleanExplanation(d.explanation),
      options: domain.bahagian === 'C' ? [] : (d.options ?? []).map(cleanOption),
    }
    const saved = await this.questions.create(input, caller.userId)
    return { data: await this.detail(saved), status: PKSK_ADMIN_FLASH.questionCreated }
  }

  /** M07-15: any status may follow any other (BR-M07-02). 404 for an id that is not a PKSK question. */
  async update(caller: Caller, id: string, body: unknown): Promise<{ data: PkskAdminQuestionDetail; status: string }> {
    const current = await this.must(id)
    const parsed = PkskAdminQuestionUpdateSchema.safeParse(body)
    const fields = parsed.success ? {} : pkskAdminFieldErrors(parsed.error)
    const domain = await this.domainOf(body, fields)
    if (!fields.pkskDomainId && domain === null) fields.pkskDomainId = M.domain
    // Absent options keep the stored ones when they still fit an A or B domain; otherwise the count rule applies.
    let options: { text: string; isCorrect: boolean }[] = []
    if (parsed.success && domain !== null && domain.bahagian !== 'C') {
      if (parsed.data.options !== undefined) options = parsed.data.options.map(cleanOption)
      else if (current.options.length >= 2) options = current.options.map((o) => ({ ...o }))
      else fields.options = M.optionsCount
    }
    if (Object.keys(fields).length > 0 || !parsed.success || domain === null) throw invalid(fields)
    const d = parsed.data
    const input: PkskQuestionInput = {
      domainCode: domain.code,
      targetLevel: d.pkskTargetLevel,
      status: d.status,
      questionText: plainText(d.questionText),
      difficultyLevel: d.difficultyLevel ?? current.difficultyLevel ?? 3,
      explanation: 'explanation' in d ? cleanExplanation(d.explanation) : current.explanation,
      options,
    }
    const saved = await this.questions.update(current.id, input, caller.userId)
    if (!saved) throw ApiError.of('NOT_FOUND', { message: M.questionNotFound })
    return { data: await this.detail(saved), status: PKSK_ADMIN_FLASH.questionUpdated }
  }

  /** M07-16: hard delete (204). */
  async remove(caller: Caller, id: string): Promise<void> {
    const current = await this.must(id)
    await this.write(async () => {
      if ((await this.questions.remove([current.id])) !== 1) throw ApiError.of('NOT_FOUND', { message: M.questionNotFound })
      await this.record(caller, [current.id])
    })
  }

  /**
   * M07-12: every id must be a PKSK question, otherwise nothing changes (422 `fields.ids`). Duplicates count once.
   * `approve` sets approved, `reject` sets rejected, `delete` is a hard delete.
   */
  async bulk(caller: Caller, body: unknown): Promise<{ data: { affected: number }; status: string }> {
    const parsed = PkskAdminBulkRequestSchema.safeParse(body)
    if (!parsed.success) {
      const fields = pkskAdminFieldErrors(parsed.error)
      // The mock reports the action before the ids.
      throw invalid(fields.action ? { action: fields.action } : fields)
    }
    const ids = [...new Set(parsed.data.ids)]
    const known = new Set(await this.questions.pkskIds(ids))
    if (!ids.every((i) => known.has(i))) throw invalid({ ids: M.ids })
    const { action } = parsed.data
    const affected = await this.write(async () => {
      if (action === 'delete') {
        const n = await this.questions.remove(ids)
        await this.record(caller, ids)
        return n
      }
      return this.questions.setStatus(ids, action === 'approve' ? 'approved' : 'rejected', caller.userId)
    })
    const status =
      action === 'approve'
        ? PKSK_ADMIN_FLASH.bulkApproved(affected)
        : action === 'reject'
          ? PKSK_ADMIN_FLASH.bulkRejected(affected)
          : PKSK_ADMIN_FLASH.bulkDeleted(affected)
    return { data: { affected }, status }
  }

  private async must(id: string): Promise<PkskQuestionRecord> {
    const row = /^\d{1,19}$/.test(id) ? await this.questions.get(id) : null
    if (!row) throw ApiError.of('NOT_FOUND', { message: M.questionNotFound })
    return row
  }

  private async domainOf(body: unknown, fields: Record<string, string>): Promise<DomainRecord | null> {
    const id = rawString(body, 'pkskDomainId')
    if (id === null || fields.pkskDomainId || !/^\d{1,19}$/.test(id)) return null
    return this.domains.get(id)
  }

  private async detail(q: PkskQuestionRecord): Promise<PkskAdminQuestionDetail> {
    const domain = (await this.domains.list()).find((d) => d.code === q.domainCode)
    if (!domain) throw ApiError.of('NOT_FOUND', { message: M.questionNotFound })
    return {
      id: q.id,
      bahagian: domain.bahagian,
      pkskDomainId: domain.id,
      pkskTargetLevel: q.targetLevel,
      status: q.status,
      questionText: q.questionText,
      difficultyLevel: q.difficultyLevel,
      explanation: q.explanation,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    }
  }

  /** G-14: ids only. */
  private record(caller: Caller, ids: readonly string[]): Promise<unknown> {
    return this.audit.record({
      action: PKSK_AUDIT.QUESTIONS_DELETED,
      actorUserId: caller.userId,
      actorRole: caller.role,
      sessionRowId: caller.auth.sessionRowId,
      targetType: 'pksk_question',
      targetId: ids.length === 1 ? (ids[0] as string) : null,
      scopeLevel: caller.auth.active.scope.level,
      requestId: caller.requestId,
      ip: caller.ip,
      isTest: caller.auth.mode !== null,
      details: { ids: [...ids], count: ids.length },
    })
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}

function rawString(body: unknown, key: string): string | null {
  if (typeof body !== 'object' || body === null) return null
  const v = (body as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : null
}

const cleanOption = (o: { text: string; isCorrect: boolean }) => ({ text: plainText(o.text), isCorrect: o.isCorrect })

function cleanExplanation(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = plainText(v)
  return t === '' ? null : t
}
