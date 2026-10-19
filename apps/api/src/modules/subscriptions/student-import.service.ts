import { Inject, Injectable } from '@nestjs/common'
import type { StudentImportResult } from './subscriptions.types'
import type { z } from 'zod'
import {
  STUDENT_IMPORT_MAX_BYTES,
  STUDENT_IMPORT_MAX_ROWS,
  STUDENT_IMPORT_MESSAGES,
  StudentImportMultipartSchema,
  StudentImportRequestSchema,
  studentsImportedText,
  V,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { PasswordService } from '../auth/password.service'
import { SchoolsRepository } from '../schools'
import type { Caller } from '../users/caller'
import { gradeOfClassLevel } from '../users/class-level'
import { IcService } from '../users/credentials'
import { ImportJobsRepository } from '../users/import'
import { UsersRepository, uniqueField, type NewUserRow } from '../users/users.repository'
import { AccountFlagsRepository } from './account-flags.repository'
import { QuotaService } from './quota.service'
import { parseStrict } from './strict-body'
import { IMPORT_TX, SUBSCRIPTION_AUDIT } from './subscriptions.constants'
import { invalid, tooLarge } from './subscriptions.errors'
import { planStudentImport, studentRecords, type StudentImportMode } from './student-import.plan'

export type StudentImportBody = z.output<typeof StudentImportRequestSchema>

export interface StudentImportOutcome {
  result: StudentImportResult
  status: string
  jobId: string
}

/** Longest text field the import accepts, in bytes (413 past it, v2 limit). */
const overBytes = (v: unknown): boolean => typeof v === 'string' && Buffer.byteLength(v, 'utf8') > STUDENT_IMPORT_MAX_BYTES

/**
 * `POST /admin/students/import` (mock S5, BR-15; v2 caps from the contract):
 * 1. field checks (school, class level, mode, data) give 422 `fields`;
 * 2. a school with no active subscription is refused, and so is an import whose NEW students exceed
 *    the remaining quota (the whole import is refused);
 * 3. the DELIMa passwords are hashed BEFORE the transaction (argon2id is slow and the process allows
 *    2 hashes at once); the transaction then takes a per-school lock, reads the quota AGAIN, inserts
 *    the students, the `import_jobs` row and the audit row, so two parallel imports cannot overshoot.
 * The result never echoes a row or a password. An imported account must change its password at the
 * first login (D55c / D59b); the DELIMa password in the file is known to the importing admin.
 */
@Injectable()
export class StudentImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(ImportJobsRepository) private readonly jobs: ImportJobsRepository,
    @Inject(AccountFlagsRepository) private readonly flags: AccountFlagsRepository,
    @Inject(QuotaService) private readonly quota: QuotaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async run(caller: Caller, raw: unknown, multipart: boolean): Promise<StudentImportOutcome> {
    const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    // Size first: an oversized text is 413 whatever else is wrong with the request.
    if (overBytes(src.csvFile) || overBytes(src.pasteContent)) throw tooLarge(STUDENT_IMPORT_MESSAGES.tooLarge)

    const { body, fields } = this.shape(raw, multipart)
    // State checks run on the raw values too, so every failing field is reported together (as the mock).
    if (fields.schoolId === undefined && typeof src.schoolId === 'string' && !(await this.schools.exists(src.schoolId))) {
      fields.schoolId = V.invalid('school id')
    }
    const mode: StudentImportMode | undefined = src.importMode === 'csv' || src.importMode === 'paste' ? src.importMode : undefined
    const field = mode === 'csv' ? 'csvFile' : 'pasteContent'
    const typed = mode === undefined ? undefined : src[field]
    const records = mode === undefined ? [] : studentRecords(typeof typed === 'string' ? typed : '', mode)
    if (mode !== undefined && records.length === 0 && fields[field] === undefined) fields[field] = STUDENT_IMPORT_MESSAGES.noData
    if (Object.keys(fields).length > 0 || !body) throw invalid(fields)
    if (records.length > STUDENT_IMPORT_MAX_ROWS) throw tooLarge(STUDENT_IMPORT_MESSAGES.tooLarge)

    const schoolId = body.schoolId
    const grade = gradeOfClassLevel(body.classLevel)

    // BR-15 (cheap, unlocked): refuse before spending hashing time.
    const before = await this.quota.figures(schoolId)
    if (!before) throw invalid({ schoolId: STUDENT_IMPORT_MESSAGES.noSubscription })

    const existing = await this.users.existingEmails(records.map((r) => r.cells[1] ?? ''))
    const plan = planStudentImport(records, (email) => existing.has(email.toLowerCase()))
    if (plan.planned.length > before.remaining) throw invalid({ schoolId: STUDENT_IMPORT_MESSAGES.quotaShort })

    const hashes = await Promise.all(plan.planned.map((p) => this.passwords.hash(p.password)))
    const now = this.clock.now()
    const rows: NewUserRow[] = plan.planned.map((p, i) => {
      const ic = p.ic === null ? null : this.ic.parts(p.ic)
      return {
        name: p.name,
        email: p.email,
        username: null,
        phone: null,
        schoolId,
        grade,
        passwordHash: hashes[i] as string,
        mustChangePassword: true,
        icHash: ic?.hash ?? null,
        icMasked: ic?.masked ?? null,
        isActive: true,
        createdById: caller.userId,
        now,
      }
    })

    let jobId: string
    try {
      jobId = await this.prisma.transaction(async (tx) => {
        await this.flags.lockSchoolImports(schoolId)
        const locked = await this.quota.figures(schoolId)
        if (!locked) throw invalid({ schoolId: STUDENT_IMPORT_MESSAGES.noSubscription })
        if (rows.length > locked.remaining) throw invalid({ schoolId: STUDENT_IMPORT_MESSAGES.quotaShort })
        const ids = await this.users.createManyWithRole(rows, 'student')
        if (ids.length !== rows.length) throw ApiError.of('CONFLICT')
        await this.flags.setIdDelima(ids, plan.planned.map((p) => p.email))
        const job = await this.jobs.create({
          kind: 'students',
          mode: body.importMode as StudentImportMode,
          createdById: caller.userId,
          schoolId,
          totalRows: records.length,
          importedCount: plan.planned.length,
          failedCount: plan.failed,
          failures: plan.errors,
          now,
        })
        await this.audit.record({
          tx,
          action: SUBSCRIPTION_AUDIT.STUDENTS_IMPORTED,
          actorUserId: caller.userId,
          actorRole: caller.role,
          sessionRowId: caller.auth.sessionRowId,
          targetType: 'import_job',
          targetId: job,
          schoolId,
          scopeLevel: caller.auth.active.scope.level,
          requestId: caller.requestId,
          ip: caller.ip,
          details: {
            mode: body.importMode,
            classLevel: body.classLevel,
            rows: records.length,
            created: plan.planned.length,
            skipped: plan.skipped,
            failed: plan.failed,
            quota: locked.quota,
          },
        })
        return job
      }, IMPORT_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      // A parallel request created one of the e-mails between the check and the insert.
      if (uniqueField(err) !== null) throw ApiError.of('CONFLICT')
      throw err
    }

    const result: StudentImportResult = { created: plan.planned.length, skipped: plan.skipped, failed: plan.failed, errors: plan.errors }
    return { result, status: studentsImportedText(result), jobId }
  }

  /** Strict contract parse; a failure becomes `fields` so the state checks can add to them. */
  private shape(raw: unknown, multipart: boolean): { body: StudentImportBody | undefined; fields: Record<string, string> } {
    try {
      const schema = multipart ? StudentImportMultipartSchema : StudentImportRequestSchema
      return { body: parseStrict(schema, raw) as StudentImportBody, fields: {} }
    } catch (err) {
      if (err instanceof ApiError && err.fields) return { body: undefined, fields: { ...err.fields } }
      throw err
    }
  }
}
