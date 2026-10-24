import { Inject, Injectable } from '@nestjs/common'
import {
  IMPORT_ROLE_FORBIDDEN_MESSAGE,
  SCHOOL_REQUIRED_IMPORT_ROLES,
  USER_MESSAGES,
  usersImportedText,
  V,
  type ImportResult,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { PasswordService } from '../../auth/password.service'
import { SchoolsRepository } from '../../schools'
import type { Caller } from '../caller'
import { generatePassword } from '../credentials'
import { FIELD_MESSAGES, forbidden, invalid } from '../users.errors'
import { IMPORT_TX, USER_AUDIT } from '../users.constants'
import { UsersRepository, uniqueField, type NewUserRow } from '../users.repository'
import type { BulkImportBody } from '../users.types'
import { ImportJobsRepository } from './import-jobs.repository'
import { planUserImport, userImportRecords } from './plan'

export interface ImportOutcome {
  result: ImportResult
  status: string
  jobId: string
}

/**
 * Bulk user import (mock BR-14, v2 caps and D58/D59). The whole import is one transaction with its
 * `import_jobs` row and its audit row: a failure rolls everything back. Passwords are hashed BEFORE
 * the transaction (argon2id is slow; `PasswordService` allows 2 hashes at once process-wide), so the transaction only inserts.
 */
@Injectable()
export class UserImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(ImportJobsRepository) private readonly jobs: ImportJobsRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async run(caller: Caller, body: BulkImportBody): Promise<ImportOutcome> {
    // D58: a school_admin imports teachers only; the schema cannot see the caller.
    if (!caller.isAdmin && body.role !== 'teacher') throw forbidden(IMPORT_ROLE_FORBIDDEN_MESSAGE)

    const fields: Record<string, string> = {}
    let schoolId = body.schoolId?.trim() ? body.schoolId.trim() : null
    if (caller.isAdmin) {
      if (schoolId !== null && !(await this.schools.exists(schoolId))) fields.schoolId = FIELD_MESSAGES.schoolInvalid
    } else {
      // A school_admin imports into its own school only (another school is rejected, never followed).
      if (schoolId !== null && schoolId !== caller.schoolId) fields.schoolId = FIELD_MESSAGES.schoolInvalid
      schoolId = caller.schoolId
    }
    if (schoolId === null && (SCHOOL_REQUIRED_IMPORT_ROLES as readonly string[]).includes(body.role)) {
      fields.schoolId = V.required('school id')
    }

    const field = body.importMode === 'csv' ? 'csvFile' : 'pasteContent'
    const text = (body.importMode === 'csv' ? body.csvFile : body.pasteContent) ?? ''
    const records = userImportRecords(text)
    if (records.length === 0) fields[field] = USER_MESSAGES.noData
    if (Object.keys(fields).length > 0) throw invalid(fields)

    const existing = await this.users.existingEmails(records.map((r) => r.cells[1] ?? ''))
    const plan = planUserImport(records, (email) => existing.has(email.toLowerCase()))

    // One random password per created account, hashed before the transaction opens.
    const passwords = plan.planned.map(() => generatePassword())
    const hashes = await Promise.all(passwords.map((p) => this.passwords.hash(p)))

    const now = this.clock.now()
    const rows: NewUserRow[] = plan.planned.map((p, i) => ({
      name: p.name,
      email: p.email,
      username: null,
      phone: p.phone,
      schoolId,
      grade: null,
      passwordHash: hashes[i] as string,
      mustChangePassword: false, // R39: an imported account is not forced to change its password
      icHash: null,
      icMasked: null,
      isActive: true,
      createdById: caller.userId,
      now,
    }))

    let jobId: string
    try {
      jobId = await this.prisma.transaction(
        async (tx) => {
          const ids = await this.users.createManyWithRole(rows, body.role)
          if (ids.length !== rows.length) throw ApiError.of('CONFLICT')
          const job = await this.jobs.create({
            kind: 'users',
            mode: body.importMode,
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
            action: USER_AUDIT.IMPORTED,
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
              role: body.role,
              mode: body.importMode,
              rows: records.length,
              created: plan.planned.length,
              skipped: plan.skipped,
              failed: plan.failed,
            },
          })
          return job
        },
        IMPORT_TX,
      )
    } catch (err) {
      // A parallel request created one of the e-mails between the check and the insert.
      if (uniqueField(err) !== null) throw ApiError.of('CONFLICT')
      throw err
    }

    const result: ImportResult = {
      created: plan.planned.length,
      skipped: plan.skipped,
      failed: plan.failed,
      errors: plan.errors,
      credentials: plan.planned.map((p, i) => ({
        line: p.line,
        email: p.email,
        generatedPassword: passwords[i] as string,
        mustChangePassword: false as const,
      })),
    }
    return { result, status: usersImportedText(result), jobId }
  }
}
