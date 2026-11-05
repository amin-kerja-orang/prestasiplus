import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  SCHOOL_ADMIN_FLASH,
  SCHOOL_ADMIN_PUPIL_IMPORT_MAX_ROWS,
  SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES as IMPORT_MSG,
  SchoolAdminPupilImportLevelSchema,
  SchoolAdminPupilImportQuerySchema,
  V,
  type SchoolAdminPupilImportResult,
  type SchoolAdminPupilCreatedResult,
  type SchoolAdminPupilFormOptions,
  type SchoolAdminPupilListResponse,
  type SchoolAdminResetResult,
  type SchoolAdminUserWriteResult,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import type { Env } from '../../../common/config/env.schema'
import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { PasswordService } from '../../auth/password.service'
import { ClassesRepository } from '../../classes'
import { QuotaService, SubscriptionsRepository } from '../../subscriptions'
import { generatePassword, ImportJobsRepository, UsersRepository, uniqueField, type UserRecord } from '../../users'
import { gradeOfClassLevel } from '../../users/class-level'
import type { NewUserRow } from '../../users/users.repository'
import { IMPORT_TX, SCHOOL_ADMIN_AUDIT } from '../school-admin.constants'
import { ManagedUsersService, PUPIL_KIND, type PeopleCtx } from './managed-users.service'
import { invalidFields, parsePupilCreate } from './people.input'
import { importResultOf, parsePupilFile, planPupilImport } from './pupil-import.plan'
import { toPupilRow } from './people.mapper'
import { parseExportQuery, parseListQuery } from './people.query'

const byName = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, 'ms') || (BigInt(a.id) < BigInt(b.id) ? -1 : 1)

/** Pupils of the school (BE-21 Part A, 7 routes). The rules live in `ManagedUsersService`; this adds classes and the form options. */
@Injectable()
export class PupilsService {
  constructor(
    @Inject(ManagedUsersService) private readonly managed: ManagedUsersService,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(ImportJobsRepository) private readonly jobs: ImportJobsRepository,
    @Inject(QuotaService) private readonly quota: QuotaService,
    @Inject(SubscriptionsRepository) private readonly subscriptions: SubscriptionsRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** Names of the ACTIVE classes (both kinds) each pupil is actively enrolled in: two batch reads, however many pupils. */
  private async classNamesOf(users: readonly UserRecord[]): Promise<Map<string, string[]>> {
    const ids = users.map((u) => u.id)
    const classIdsByPupil = await this.classes.classIdsOfStudents(ids)
    const all = [...new Set([...classIdsByPupil.values()].flat())]
    const active = new Map((await this.classes.byIds(all)).filter((c) => c.isActive).map((c) => [c.id, c]))
    return new Map(
      ids.map((id) => [
        id,
        (classIdsByPupil.get(id) ?? [])
          .flatMap((cid) => {
            const c = active.get(cid)
            return c ? [c] : []
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'ms') || (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
          .map((c) => c.name),
      ]),
    )
  }

  async list(ctx: PeopleCtx, query: Record<string, unknown>): Promise<SchoolAdminPupilListResponse> {
    const page = await this.managed.list(ctx, PUPIL_KIND, parseListQuery(query))
    const names = await this.classNamesOf(page.rows)
    return { data: page.rows.map((u) => toPupilRow(u, names.get(u.id) ?? [])), ...this.managed.listEnvelope(page) }
  }

  /** The school and its active classrooms A to Z: the valid targets of `classId`. No password field exists. */
  async formOptions(ctx: PeopleCtx): Promise<SchoolAdminPupilFormOptions> {
    const school = await this.managed.schoolOf(ctx)
    const classes = (await this.classes.schoolClasses(ctx.actor.schoolId))
      .filter((c) => c.kind === 'classroom' && c.isActive)
      .sort(byName)
      .map((c) => ({ id: c.id, name: c.name }))
    return { school: this.managed.schoolInfo(school), classes }
  }

  async exportCsv(ctx: PeopleCtx, query: Record<string, unknown>): Promise<{ csv: string; fileName: string }> {
    const { users, school, fileName } = await this.managed.exportRows(ctx, PUPIL_KIND, parseExportQuery(query))
    const names = await this.classNamesOf(users)
    return { csv: this.managed.csvOf(PUPIL_KIND, users, school.name, (u) => (names.get(u.id) ?? []).join(', ')), fileName }
  }

  detail(ctx: PeopleCtx, id: string) {
    return this.managed.detail(ctx, PUPIL_KIND, id)
  }

  async create(ctx: PeopleCtx, body: unknown): Promise<SchoolAdminPupilCreatedResult> {
    const parsed = parsePupilCreate(body)
    const created = await this.managed.create(
      ctx,
      PUPIL_KIND,
      { fields: parsed.fields, value: parsed.value ? { name: parsed.value.name, email: parsed.value.email, phone: null } : null },
      parsed.value?.classId ?? null,
    )
    return { ...created, status: SCHOOL_ADMIN_FLASH.pupilCreated(created.credential.name) }
  }

  async update(ctx: PeopleCtx, id: string, body: unknown): Promise<SchoolAdminUserWriteResult> {
    return { data: await this.managed.update(ctx, PUPIL_KIND, id, body), status: SCHOOL_ADMIN_FLASH.updated }
  }

  resetPassword(ctx: PeopleCtx, id: string, body: unknown): Promise<SchoolAdminResetResult> {
    return this.managed.resetPassword(ctx, PUPIL_KIND, id, body)
  }

  /**
   * API-AS-06 `POST /admin-sekolah/pelajar/import` (R1-AS-51). The school is `ctx.actor.schoolId` (the session). Order:
   * level and file checks (422/413), the header and row count, the quota (409, the whole file is refused, nothing is hashed yet),
   * the row plan, `dryRun` stops here with the first 10 rows; then ONE password is hashed (every imported pupil shares it and
   * nobody is told it), and one transaction takes the per-school lock, reads the quota AGAIN, creates the PENDING pupils
   * (`is_active = false`), their class enrolments, the `import_jobs` row and the audit row (counts only, no name or e-mail).
   */
  async importPupils(ctx: PeopleCtx, input: { text: string | undefined; level: unknown; query: Record<string, unknown> }): Promise<{ data: SchoolAdminPupilImportResult }> {
    const fields: Record<string, string> = {}
    const q = SchoolAdminPupilImportQuerySchema.safeParse(input.query)
    if (!q.success) fields.dryRun = V.invalid('dry run')
    const dryRun = q.success && q.data.dryRun === 'true'
    const rawLevel = typeof input.level === 'string' && input.level.trim() !== '' ? input.level.trim() : undefined
    const level = rawLevel === undefined ? undefined : SchoolAdminPupilImportLevelSchema.safeParse(rawLevel)
    if (level && !level.success) fields.level = V.invalid('level')
    if (input.text === undefined) fields.csvFile = IMPORT_MSG.noFile
    if (Object.keys(fields).length > 0) throw invalidFields(fields)

    const parsed = parsePupilFile(input.text as string)
    if ('missing' in parsed) throw invalidFields({ csvFile: IMPORT_MSG.missingColumn(parsed.missing) })
    if (parsed.rows.length === 0) throw invalidFields({ csvFile: IMPORT_MSG.noData })
    if (parsed.rows.length > SCHOOL_ADMIN_PUPIL_IMPORT_MAX_ROWS) throw new ApiError({ code: 'PAYLOAD_TOO_LARGE', status: 413, message: IMPORT_MSG.tooManyRows })

    const schoolId = ctx.actor.schoolId
    const levelCode = level?.success ? level.data : undefined
    const grade = levelCode === undefined ? null : gradeOfClassLevel(levelCode)
    try {
      // Cheap and unlocked: refuse before any hashing.
      const before = await this.quota.figures(schoolId)
      if (!before) throw noSubscription()
      const classByName = new Map<string, string>()
      for (const c of (await this.classes.schoolClasses(schoolId)).filter((c) => c.kind === 'classroom' && c.isActive && c.schoolId === schoolId).sort(byName)) {
        if (!classByName.has(c.name.trim().toLowerCase())) classByName.set(c.name.trim().toLowerCase(), c.id)
      }
      const existing = await this.users.existingEmails(parsed.rows.map((r) => r.email))
      const plan = planPupilImport(parsed.rows, { classByName, hasLevel: levelCode !== undefined, emailExists: (e) => existing.has(e.toLowerCase()) })
      if (plan.planned.length > before.remaining) throw quotaFull()
      if (dryRun) return { data: importResultOf(parsed.rows, plan, { dryRun: true, created: 0 }) }

      // One shared initial password, hashed once: never returned, shown or logged (D59b stays: no password reaches the client).
      const passwordHash = await this.passwords.hash(this.config.get('PUPIL_IMPORT_DEFAULT_PASSWORD', { infer: true }) ?? generatePassword())
      const now = this.clock.now()
      const rows: NewUserRow[] = plan.planned.map((p) => ({
        name: p.name,
        email: p.email,
        username: null,
        phone: null,
        schoolId,
        grade,
        passwordHash,
        mustChangePassword: false, // R39
        icHash: null,
        icMasked: null,
        isActive: false, // pending Admin Pusat approval
        createdById: ctx.actor.userId,
        now,
      }))
      await this.prisma.transaction(async (tx) => {
        await this.subscriptions.lockSchoolImports(schoolId)
        const locked = await this.quota.figures(schoolId)
        if (!locked) throw noSubscription()
        if (rows.length > locked.remaining) throw quotaFull()
        const ids = await this.users.createManyWithRole(rows, 'student')
        if (ids.length !== rows.length) throw ApiError.of('CONFLICT')
        const byClass = new Map<string, string[]>()
        plan.planned.forEach((p, i) => {
          if (p.classId !== null) byClass.set(p.classId, [...(byClass.get(p.classId) ?? []), ids[i] as string])
        })
        for (const [classId, pupilIds] of byClass) await this.classes.enrolMany(classId, pupilIds, 'school_admin', now)
        const job = await this.jobs.create({
          kind: 'students',
          mode: 'csv',
          createdById: ctx.actor.userId,
          schoolId,
          totalRows: parsed.rows.length,
          importedCount: plan.planned.length,
          failedCount: plan.errors.length,
          failures: plan.errors,
          now,
        })
        await this.audit.record({
          tx,
          ...this.managed.auditBase(ctx, SCHOOL_ADMIN_AUDIT.PUPILS_IMPORTED),
          targetType: 'import_job',
          targetId: job,
          details: { schoolId, rows: parsed.rows.length, created: plan.planned.length, skipped: plan.skipped, failed: plan.errors.length, level: levelCode ?? null, enrolled: [...byClass.values()].flat().length, quota: locked.quota },
        })
      }, IMPORT_TX)
      return { data: importResultOf(parsed.rows, plan, { dryRun: false, created: plan.planned.length }) }
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      // A parallel request created one of the e-mails between the check and the insert.
      if (uniqueField(err) !== null) throw ApiError.of('CONFLICT')
      throw err
    }
  }
}

const quotaFull = (): ApiError => new ApiError({ code: 'QUOTA_FULL', status: 409, message: IMPORT_MSG.quotaFull })
const noSubscription = (): ApiError => new ApiError({ code: 'NO_SUBSCRIPTION', status: 409, message: IMPORT_MSG.noSubscription })
