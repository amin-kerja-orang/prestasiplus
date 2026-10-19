import { Inject, Injectable } from '@nestjs/common'
import type { SchoolPackage, SubscriptionDetail, SubscriptionListItem, SubscriptionRenewalInvoice, SubscriptionStudent } from './subscriptions.types'
import {
  SubscriptionCreateRequestSchema,
  SUBSCRIPTION_DEFAULT_PER_PAGE,
  SUBSCRIPTION_MESSAGES,
  SUBSCRIPTION_PER_PAGE_OPTIONS,
  V,
} from '@pp/contract'
import type { z } from 'zod'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import type { TxClient } from '../../db/client'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { SchoolsRepository, type SchoolRow } from '../schools'
import type { Caller } from '../users/caller'
import { classLevelOfGrade } from '../users/class-level'
import { UsersRepository } from '../users/users.repository'
import { addDaysDay, addMonthsDay, compactDay, dayTimestamp, formatMytDateTime, mytDay } from './dates'
import { BASIC_QUESTION_LIMIT, PAGE_NUMBER_MAX, RENEWAL_MONTHS, SUBSCRIPTION_AUDIT, TERM_MONTHS, WRITE_TX } from './subscriptions.constants'
import { invalid, notFound } from './subscriptions.errors'
import { toDetail, toListItem, toPackageWire, toSchool } from './subscriptions.mapper'
import {
  SubscriptionsRepository,
  type PackageRow,
  type SubscriptionPatch,
  type SubscriptionRecord,
} from './subscriptions.repository'
import { parseStrict } from './strict-body'

export type CreateBody = z.output<typeof SubscriptionCreateRequestSchema>

export interface QuotaBody {
  studentQuota: number | string
  notes?: string | null | undefined
}
export interface ExtendBody {
  days: number | string
  reason?: string | null | undefined
}
export interface UpgradeBody {
  paymentReference?: string | null | undefined
  paymentNotes?: string | null | undefined
}

export interface SubscriptionListQuery {
  search?: string | undefined
  status?: string | undefined
  formLevel?: string | undefined
}

/** Text as the mock reads it: trimmed, and blank means absent. */
export const textOrNull = (v: string | null | undefined): string | null => {
  const t = v?.trim() ?? ''
  return t === '' ? null : t
}

/** A page number: anything that is not a positive whole number is page 1 (never rejected). */
export function pageOf(raw: unknown): number {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d{1,9}$/.test(t)) return 1
  const n = Number(t)
  return n >= 1 ? Math.min(n, PAGE_NUMBER_MAX) : 1
}

const SORT_LOCALE = 'ms'
const byNameThenId = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, SORT_LOCALE) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1)

/** Integer cents of a decimal string ("30.00" is 3000). */
export function toCents(price: string): number {
  const [whole = '0', frac = '0'] = price.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))
}

export function fromCents(cents: number): string {
  return `${String(Math.trunc(cents / 100))}.${String(cents % 100).padStart(2, '0')}`
}

const appendNote = (current: string | null, line: string): string => (current === null || current === '' ? line : `${current}\n${line}`)
const reasonLine = (prefix: string, reason: string | null): string | null => (reason === null ? null : `[${prefix}] ${reason}`)

/**
 * School subscriptions (BE-25 part A): the mock rules of `handlers/subscriptions.ts` (BR-22 to BR-31)
 * on top of the repositories. Every write is one transaction with its audit row.
 * Status is stored, as in the mock: nothing here expires a subscription by the clock.
 */
@Injectable()
export class SchoolSubscriptionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SubscriptionsRepository) private readonly repo: SubscriptionsRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // --- reads ----------------------------------------------------------------------------------------

  async packages(): Promise<SchoolPackage[]> {
    return (await this.repo.packages()).map(toPackageWire)
  }

  async list(caller: Caller, q: SubscriptionListQuery) {
    const counts = await this.repo.counts(caller)
    const { rows, packages } = await this.repo.list(caller, {
      ...(textOrNull(q.search) ? { search: textOrNull(q.search) as string } : {}),
      ...(textOrNull(q.status) ? { status: textOrNull(q.status) as string } : {}),
      ...(textOrNull(q.formLevel) ? { formLevel: textOrNull(q.formLevel) as string } : {}),
    })
    const schools = await this.schools.getMany(rows.map((r) => r.schoolId))
    const byId = new Map(schools.map((s) => [s.id, s]))
    const used = await this.schools.memberCounts([...byId.keys()])
    const data: SubscriptionListItem[] = rows.flatMap((r) => {
      const school = byId.get(r.schoolId)
      const pkg = packages.get(r.schoolPackageId)
      return school && pkg ? [toListItem(r, school, pkg, used.get(r.schoolId)?.studentCount ?? 0)] : []
    })
    const n = data.length
    return {
      data,
      // Not paginated (mock `unpaged`): one page that holds every row; pageSize is never 0.
      meta: { page: 1, pageSize: Math.max(1, n), totalItems: n, totalPages: 1, from: n > 0 ? 1 : null, to: n > 0 ? n : null, counts },
    }
  }

  async detail(caller: Caller, id: string): Promise<SubscriptionDetail> {
    const row = await this.repo.find(caller, id)
    if (!row) throw notFound()
    return this.present(row)
  }

  async students(caller: Caller, id: string, q: { perPage?: unknown; page?: unknown }) {
    const row = await this.repo.find(caller, id)
    if (!row) throw notFound()
    const asked = typeof q.perPage === 'string' && /^\d{1,9}$/.test(q.perPage.trim()) ? Number(q.perPage.trim()) : 0
    const perPage = (SUBSCRIPTION_PER_PAGE_OPTIONS as readonly number[]).includes(asked) ? asked : SUBSCRIPTION_DEFAULT_PER_PAGE
    const page = pageOf(q.page)
    const all = (await this.users.studentsOfSchool(row.schoolId, '', '')).sort(byNameThenId)
    const data: SubscriptionStudent[] = all.slice((page - 1) * perPage, page * perPage).map((s) => ({
      id: s.id,
      name: s.name,
      idDelima: s.idDelima,
      classLevel: classLevelOfGrade(s.grade),
    }))
    return { data, meta: listMeta(page, perPage, all.length) }
  }

  async renewalInvoice(caller: Caller, id: string): Promise<SubscriptionRenewalInvoice> {
    const row = await this.repo.find(caller, id)
    if (!row) throw notFound()
    const { school, pkg } = await this.parts(row)
    const now = this.clock.now()
    const count = (await this.schools.memberCounts([row.schoolId])).get(row.schoolId)?.studentCount ?? 0
    return {
      ref: `INV-${row.id}-${compactDay(now)}`,
      date: toMytTimestamp(now),
      school: toSchool(school),
      packageName: pkg.name,
      currentPeriod: { start: dayTimestamp(row.startsOn), end: dayTimestamp(row.endsOn) },
      renewalPeriod: { start: dayTimestamp(row.endsOn), end: dayTimestamp(addMonthsDay(row.endsOn, RENEWAL_MONTHS)) },
      studentCount: count,
      pricePerStudent: pkg.priceAnnual,
      // BR-30: the enrolled students, not the quota, in integer cents.
      total: fromCents(count * toCents(pkg.priceAnnual)),
    }
  }

  // --- writes ---------------------------------------------------------------------------------------

  async create(caller: Caller, raw: unknown): Promise<{ data: SubscriptionDetail; status: string }> {
    const body = await this.validateCreate(raw)
    const now = this.clock.now()
    const today = mytDay(now)
    const id = await this.write(async (tx) => {
      const row = await this.repo.create({
        schoolId: body.schoolId,
        schoolPackageId: body.schoolPackageId,
        packageTier: body.packageTier,
        studentQuota: Number(body.studentQuota),
        startsOn: today,
        endsOn: addMonthsDay(today, TERM_MONTHS[body.packageTier]),
        questionLimit: body.packageTier === 'basic' ? BASIC_QUESTION_LIMIT : null,
        paymentReference: textOrNull(body.paymentReference),
        paymentNotes: textOrNull(body.paymentNotes),
        now,
      })
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.CREATED, row, { tier: body.packageTier, studentQuota: row.studentQuota })
      return row.id
    })
    return { data: await this.detail(caller, id), status: SUBSCRIPTION_MESSAGES.created }
  }

  async updateQuota(caller: Caller, id: string, body: QuotaBody) {
    const now = this.clock.now()
    const quota = Number(body.studentQuota)
    const saved = await this.write(async (tx) => {
      const row = await this.repo.findForUpdate(caller, id)
      if (!row) throw notFound()
      const line = reasonLine(
        `Kuota ${String(row.studentQuota)} → ${String(quota)} pada ${formatMytDateTime(now)}`,
        textOrNull(body.notes),
      )
      const next = await this.repo.update(row.id, { studentQuota: quota, ...(line === null ? {} : { notes: appendNote(row.notes, line) }), now })
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.QUOTA_CHANGED, next, { from: row.studentQuota, to: quota })
      return next
    })
    return { data: await this.present(saved), status: SUBSCRIPTION_MESSAGES.quotaUpdated }
  }

  async extend(caller: Caller, id: string, body: ExtendBody) {
    const now = this.clock.now()
    const days = Number(body.days)
    const saved = await this.write(async (tx) => {
      const row = await this.repo.findForUpdate(caller, id)
      if (!row) throw notFound()
      const endsOn = addDaysDay(row.endsOn, days)
      // BR-28: an expired or grace subscription whose new end lies in the future becomes active again
      // (the end day counts as a day after today only when it is later than today); a cancelled one never does.
      const revive = (row.status === 'expired' || row.status === 'grace') && endsOn > mytDay(now)
      const line = reasonLine(`Dilanjutkan ${String(days)} hari pada ${formatMytDateTime(now)}`, textOrNull(body.reason))
      const patch: SubscriptionPatch = {
        endsOn,
        ...(revive ? { status: 'active' as const } : {}),
        ...(line === null ? {} : { notes: appendNote(row.notes, line) }),
        now,
      }
      const next = await this.repo.update(row.id, patch)
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.EXTENDED, next, { days, revived: revive })
      return next
    })
    return { data: await this.present(saved), status: SUBSCRIPTION_MESSAGES.extended }
  }

  async upgrade(caller: Caller, id: string, body: UpgradeBody) {
    const now = this.clock.now()
    const saved = await this.write(async (tx) => {
      const row = await this.repo.findForUpdate(caller, id)
      if (!row) throw notFound()
      if (row.packageTier !== 'basic') throw invalid({ packageTier: SUBSCRIPTION_MESSAGES.notBasic })
      const paymentReference = textOrNull(body.paymentReference)
      const paymentNotes = textOrNull(body.paymentNotes)
      const next = await this.repo.update(row.id, {
        packageTier: 'full',
        questionLimit: null,
        endsOn: addMonthsDay(mytDay(now), TERM_MONTHS.full),
        status: 'active',
        ...(paymentReference === null ? {} : { paymentReference }),
        ...(paymentNotes === null ? {} : { paymentNotes }),
        notes: appendNote(row.notes, `[Naik taraf Pemantauan → Penuh pada ${formatMytDateTime(now)}]`),
        now,
      })
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.UPGRADED, next, { fromStatus: row.status })
      return next
    })
    return { data: await this.present(saved), status: SUBSCRIPTION_MESSAGES.upgraded }
  }

  async cancel(caller: Caller, id: string) {
    const now = this.clock.now()
    const saved = await this.write(async (tx) => {
      const row = await this.repo.findForUpdate(caller, id)
      if (!row) throw notFound()
      if (row.status === 'cancelled') throw invalid({ status: SUBSCRIPTION_MESSAGES.alreadyCancelled })
      const next = await this.repo.update(row.id, { status: 'cancelled', now })
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.CANCELLED, next, { fromStatus: row.status })
      return next
    })
    return { data: await this.present(saved), status: SUBSCRIPTION_MESSAGES.cancelled }
  }

  // --- helpers ----------------------------------------------------------------------------------------

  /** Strict contract parse plus the two checks only the server can make (active school, known package). */
  private async validateCreate(raw: unknown): Promise<CreateBody> {
    let fields: Record<string, string> = {}
    let body: CreateBody | undefined
    try {
      body = parseStrict(SubscriptionCreateRequestSchema, raw)
    } catch (err) {
      if (!(err instanceof ApiError) || !err.fields) throw err
      fields = { ...err.fields }
    }
    const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const schoolId = typeof src.schoolId === 'string' ? src.schoolId : undefined
    if (fields.schoolId === undefined && schoolId !== undefined) {
      const school = await this.schools.get(schoolId)
      if (!school?.isActive) fields.schoolId = V.invalid('school id')
    }
    const packageId = typeof src.schoolPackageId === 'string' ? src.schoolPackageId : undefined
    if (fields.schoolPackageId === undefined && packageId !== undefined && !(await this.repo.packageById(packageId))) {
      fields.schoolPackageId = V.invalid('school package id')
    }
    if (Object.keys(fields).length > 0 || !body) throw invalid(fields)
    return body
  }

  private async parts(row: SubscriptionRecord): Promise<{ school: SchoolRow; pkg: PackageRow }> {
    const [school, pkg] = await Promise.all([this.schools.get(row.schoolId), this.repo.packageById(row.schoolPackageId)])
    // Foreign keys make both exist; a missing one is a data fault, not a client error.
    if (!school || !pkg) throw ApiError.of('SERVER_ERROR')
    return { school, pkg }
  }

  private async present(row: SubscriptionRecord): Promise<SubscriptionDetail> {
    const { school, pkg } = await this.parts(row)
    const used = (await this.schools.memberCounts([row.schoolId])).get(row.schoolId)?.studentCount ?? 0
    return toDetail(row, school, pkg, used)
  }

  private record(tx: TxClient, caller: Caller, action: string, row: SubscriptionRecord, details: Record<string, unknown>): Promise<void> {
    return this.audit.record({
      tx,
      action,
      actorUserId: caller.userId,
      actorRole: caller.role,
      sessionRowId: caller.auth.sessionRowId,
      targetType: 'school_subscription',
      targetId: row.id,
      schoolId: row.schoolId,
      scopeLevel: caller.auth.active.scope.level,
      requestId: caller.requestId,
      ip: caller.ip,
      details,
    })
  }

  /** One transaction per write; an overloaded database is retryable (429), never a 500. */
  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
