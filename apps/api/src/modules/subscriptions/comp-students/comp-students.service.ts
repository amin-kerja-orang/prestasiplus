import { randomBytes } from 'node:crypto'

import type { CompBulkAction, CompIcMasked, CompStudentDetail, CompStudentListItem, StudentImportResult } from '../subscriptions.types'
import { Inject, Injectable } from '@nestjs/common'
import {
  COMP_BULK_MAX_IDS,
  COMP_STUDENT_MESSAGES,
  COMP_STUDENTS_PAGE_SIZE,
  COMP_USERNAME_DOMAIN,
  CompBulkActionRequestSchema,
  CompStudentRegisterRequestSchema,
  STUDENT_IMPORT_MAX_ROWS,
  STUDENT_IMPORT_MESSAGES,
  V,
  compStudentsCreatedText,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { CLOCK, type Clock } from '../../../db/clock'
import type { TxClient } from '../../../db/client'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { PasswordService } from '../../auth/password.service'
import type { Caller } from '../../users/caller'
import { classLevelOfGrade } from '../../users/class-level'
import { generatePassword, IcService } from '../../users/credentials'
import { UsersRepository, uniqueField, type NewUserRow } from '../../users/users.repository'
import { parseStrict } from '../strict-body'
import { SUBSCRIPTION_AUDIT, PAGE_NUMBER_MAX, WRITE_TX, IMPORT_TX } from '../subscriptions.constants'
import { invalid, notFound, tooLarge } from '../subscriptions.errors'
import { pageOf } from '../subscriptions.service'
import { COMP_CLASSROOM_PORT, type CompClassroomPort } from './classroom.port'
import { compLineError, parseCompLines } from './comp-lines'
import { CompStudentsRepository, type CompRow } from './comp-students.repository'

/** Read-only here: the wallet owner is another card (mock `complimentaryRepo.wallet`, 0 / 0 until it exists). */
const NO_BALANCE = 0

/** Only the masked form `xxxxxx-xx-xxNN` leaves the API; anything else stored is not shown. */
const maskedOrNull = (v: string | null): CompIcMasked | null => (v !== null && /^xxxxxx-xx-xx\d{2}$/.test(v) ? v : null)

/** Complimentary students (mock S6 to S8, BR-18, BR-19). Central admin only; every state change is audited with the actor. */
@Injectable()
export class CompStudentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CompStudentsRepository) private readonly repo: CompStudentsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(COMP_CLASSROOM_PORT) private readonly classrooms: CompClassroomPort,
  ) {}

  // --- reads ------------------------------------------------------------------------------------------

  async list(q: { page?: unknown }) {
    const page = pageOf(q.page)
    const { rows, total, coinsOff } = await this.repo.list((page - 1) * COMP_STUDENTS_PAGE_SIZE, COMP_STUDENTS_PAGE_SIZE)
    const views = await this.classrooms.describe(rows.map((r) => r.id))
    const data: CompStudentListItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.email ?? r.username ?? '-',
      icMasked: maskedOrNull(r.icMasked),
      schoolName: r.schoolName,
      classLabel: views.get(r.id)?.classLabel ?? '',
      teacherName: views.get(r.id)?.teacherName ?? '',
      isActive: r.isActive,
      coinsEnabled: r.coinsEnabled,
      packageExpiresAt: r.packageExpiresOn,
    }))
    return { data, meta: { ...listMeta(Math.min(page, PAGE_NUMBER_MAX), COMP_STUDENTS_PAGE_SIZE, total), counts: { coinsOff, total } } }
  }

  async detail(id: string): Promise<CompStudentDetail> {
    const r = await this.repo.get(id)
    if (!r) throw notFound()
    const view = (await this.classrooms.describe([r.id])).get(r.id)
    return {
      userId: r.id,
      username: r.email ?? r.username ?? '-',
      name: r.name,
      icMasked: maskedOrNull(r.icMasked),
      classLevel: classLevelOfGrade(r.grade),
      isActive: r.isActive,
      coinsEnabled: r.coinsEnabled,
      packageExpiresAt: r.packageExpiresOn,
      originalSchoolName: r.originalSchoolName ?? r.schoolName,
      classLabel: view?.classLabel ?? '',
      teacherName: view?.teacherName ?? '',
      syilingBalance: NO_BALANCE,
      coinBalance: NO_BALANCE,
      classes: view?.classes ?? [],
    }
  }

  // --- register -------------------------------------------------------------------------------------

  async register(caller: Caller, raw: unknown): Promise<{ data: StudentImportResult; status: string }> {
    const { body, fields } = this.shape(raw)
    const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const classroom =
      fields.classroomId === undefined && typeof src.classroomId === 'string' ? await this.classrooms.find(src.classroomId) : null
    if (fields.classroomId === undefined && !classroom) fields.classroomId = V.invalid('classroom id')
    if (Object.keys(fields).length > 0 || !body || !classroom) throw invalid(fields)

    const lines = parseCompLines(body.students)
    if (lines.length > STUDENT_IMPORT_MAX_ROWS) throw tooLarge(STUDENT_IMPORT_MESSAGES.tooLarge)

    const result: StudentImportResult = { created: 0, skipped: 0, failed: 0, errors: [] }
    const valid: { name: string; digits: string; hash: string; masked: string }[] = []
    for (const l of lines) {
      const bad = compLineError(l)
      if (bad !== null) {
        result.failed++
        result.errors.push({ line: l.line, message: bad })
        continue
      }
      valid.push({ name: l.name, digits: l.ic, hash: this.ic.hash(l.ic), masked: this.ic.mask(l.ic) })
    }

    // A person who already has an account (same IC) or repeats in the paste is skipped.
    const known = await this.users.existingIcHashes(valid.map((v) => v.hash))
    const seen = new Set<string>()
    const planned = valid.filter((v) => {
      if (known.has(v.hash) || seen.has(v.hash)) {
        result.skipped++
        return false
      }
      seen.add(v.hash)
      return true
    })

    // Initial passwords are random and hashed before the transaction; nobody is shown one (the
    // contract has no credential field): the pupil signs in after the IC-based reset.
    const hashes = await Promise.all(planned.map(() => this.passwords.hash(generatePassword())))
    const now = this.clock.now()
    const rows: NewUserRow[] = planned.map((p, i) => ({
      name: p.name,
      email: `komp-${randomBytes(9).toString('hex')}${COMP_USERNAME_DOMAIN}`,
      username: null,
      phone: null,
      schoolId: classroom.schoolId,
      grade: classroom.grade,
      passwordHash: hashes[i] as string,
      mustChangePassword: false, // R39: no forced change; the pupil signs in after the IC-based reset
      isComplimentary: true,
      icHash: p.hash,
      icMasked: p.masked,
      isActive: true,
      createdById: caller.userId,
      now,
    }))

    let created = 0
    try {
      await this.prisma.transaction(async (tx) => {
        // Lock, then re-check the IC hashes: a parallel register of the same IC may have committed since the first check.
        await this.repo.lockRegister()
        const taken = await this.users.existingIcHashes(rows.map((r) => r.icHash ?? ''))
        const fresh = rows.filter((r) => !taken.has(r.icHash ?? ''))
        result.skipped += rows.length - fresh.length
        const ids = await this.users.createManyWithRole(fresh, 'student')
        if (ids.length !== fresh.length) throw ApiError.of('CONFLICT')
        created = ids.length
        await this.repo.createMany(
          ids.map((userId) => ({ userId, packageExpiresOn: body.packageExpiresAt, originalSchoolName: classroom.schoolName })),
          now,
        )
        await this.classrooms.enrol(classroom.id, ids)
        await this.audit.record({
          tx,
          action: SUBSCRIPTION_AUDIT.COMP_REGISTERED,
          actorUserId: caller.userId,
          actorRole: caller.role,
          sessionRowId: caller.auth.sessionRowId,
          targetType: 'classroom',
          targetId: classroom.id,
          schoolId: classroom.schoolId,
          scopeLevel: caller.auth.active.scope.level,
          requestId: caller.requestId,
          ip: caller.ip,
          details: { lines: lines.length, created: ids.length, skipped: result.skipped, failed: result.failed, packageExpiresAt: body.packageExpiresAt },
        })
      }, IMPORT_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      if (uniqueField(err) !== null) throw ApiError.of('CONFLICT')
      throw err
    }
    result.created = created
    return { data: result, status: compStudentsCreatedText(result.created) }
  }

  // --- toggles and bulk ----------------------------------------------------------------------------

  async toggleCoins(caller: Caller, id: string) {
    const now = this.clock.now()
    const coinsEnabled = await this.write(async (tx) => {
      await this.repo.lockUsers([id])
      const row = await this.repo.get(id)
      if (!row) throw notFound()
      const next = !row.coinsEnabled
      await this.repo.setCoins([id], next, now)
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.COMP_COINS_TOGGLED, row, { coinsEnabled: next })
      return next
    })
    return { data: { coinsEnabled }, status: COMP_STUDENT_MESSAGES.actionDone }
  }

  async toggleActive(caller: Caller, id: string) {
    const now = this.clock.now()
    const isActive = await this.write(async (tx) => {
      await this.repo.lockUsers([id])
      const row = await this.repo.get(id)
      if (!row) throw notFound()
      const next = !row.isActive
      await this.setActive(row.id, next, now)
      await this.record(tx, caller, SUBSCRIPTION_AUDIT.COMP_ACTIVE_TOGGLED, row, { isActive: next })
      return next
    })
    return { data: { isActive }, status: COMP_STUDENT_MESSAGES.actionDone }
  }

  /** `ids` that are not complimentary students are ignored; `updated` counts the ones applied (mock BR-19). */
  async bulk(caller: Caller, raw: unknown) {
    const body = parseStrict(CompBulkActionRequestSchema, raw)
    const action: CompBulkAction = body.action
    const ids = [...new Set(body.ids)].slice(0, COMP_BULK_MAX_IDS)
    const now = this.clock.now()
    const updated = await this.write(async (tx) => {
      await this.repo.lockUsers(ids)
      const rows = await this.repo.getMany(ids)
      if (action === 'coins_on' || action === 'coins_off') {
        await this.repo.setCoins(rows.map((r) => r.id), action === 'coins_on', now)
      } else {
        for (const r of rows) await this.setActive(r.id, action === 'activate', now)
      }
      // One audit row per student, so each change names its target and the actor.
      for (const r of rows) await this.record(tx, caller, SUBSCRIPTION_AUDIT.COMP_BULK_ACTION, r, { action })
      return rows.length
    })
    return { data: { updated }, status: COMP_STUDENT_MESSAGES.actionDone }
  }

  // --- helpers -------------------------------------------------------------------------------------

  /** Activates or deactivates the account; a deactivated account loses its sessions (BE-NFR-39). */
  private async setActive(userId: string, active: boolean, now: Date): Promise<void> {
    await this.users.update(userId, { isActive: active, now })
    if (!active) await this.users.revokeSessions([userId])
  }

  private shape(raw: unknown): { body: ReturnType<typeof parseStrict<typeof CompStudentRegisterRequestSchema>> | undefined; fields: Record<string, string> } {
    try {
      return { body: parseStrict(CompStudentRegisterRequestSchema, raw), fields: {} }
    } catch (err) {
      if (err instanceof ApiError && err.fields) return { body: undefined, fields: { ...err.fields } }
      throw err
    }
  }

  private record(tx: TxClient, caller: Caller, action: string, row: CompRow, details: Record<string, unknown>): Promise<void> {
    return this.audit.record({
      tx,
      action,
      actorUserId: caller.userId,
      actorRole: caller.role,
      sessionRowId: caller.auth.sessionRowId,
      targetType: 'user',
      targetId: row.id,
      schoolId: row.schoolId,
      scopeLevel: caller.auth.active.scope.level,
      requestId: caller.requestId,
      ip: caller.ip,
      details,
    })
  }

  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
