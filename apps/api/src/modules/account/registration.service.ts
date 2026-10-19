import { Inject, Injectable, Logger } from '@nestjs/common'
import { ACCOUNT_AUTH_MESSAGES, AccountRegisterRequestSchema, V } from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import type { RequestInfo, SessionGrant } from '../auth/auth.service'
import { isOverloadError, rateLimited } from '../auth/auth.errors'
import { LoginThrottle } from '../auth/login-throttle.service'
import { PasswordService } from '../auth/password.service'
import { SchoolsRepository } from '../schools'
import { IcService } from '../users/credentials'
import { UsersRepository, uniqueField } from '../users'
import { ApiError } from '../../common/errors/api-error'
import { ACCOUNT_AUDIT, ACCOUNT_TX } from './account.constants'
import { fieldsOf, invalid } from './account.errors'
import { SessionIssuer } from './session-issuer.service'

const FIELD_ORDER = ['name', 'email', 'phone', 'role', 'grade', 'icNumber', 'schoolId', 'password', 'passwordConfirmation', 'referralCode']
const IC_FORMAT = 'The ic number field format is invalid.'

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const asRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * Self-registration (mock `register()`, BR-04, BR-05). The role is limited to student, teacher and
 * parent by the contract schema. Rate limit (BE-06 AC6): the BE-03 login throttle component at its
 * default (5 refused attempts per minute per address, plus the per-address ceiling); an attempt that
 * ends in a created account gives its count back, so legitimate sign-ups are not slowed.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LoginThrottle) private readonly throttle: LoginThrottle,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async register(raw: unknown, info: RequestInfo): Promise<SessionGrant> {
    const keys = this.throttle.keys('register', info.ip)
    await this.throttle.begin(keys, this.clock.now())
    try {
      const grant = await this.create(raw, info)
      await this.throttle.clear(keys).catch(() => {
        this.logger.warn(`registration throttle reset failed (requestId=${info.requestId ?? '-'})`)
      })
      return grant
    } catch (err) {
      // Never tested anything: give the reserved unit back and ask the client to retry.
      if (isOverloadError(err)) {
        await this.throttle.refund(keys).catch(() => undefined)
        throw rateLimited(5)
      }
      throw err
    }
  }

  private async create(raw: unknown, info: RequestInfo): Promise<SessionGrant> {
    const parsed = AccountRegisterRequestSchema.safeParse(raw)
    const fields: Record<string, string> = parsed.success ? {} : fieldsOf(parsed.error)
    const body = asRecord(raw)
    const roleText = parsed.success ? (parsed.data.role ?? 'student') : (text(body.role) ?? 'student')
    const isStudent = roleText === 'student'

    // Checks that need the database, on every field that passed its own rules (one response lists every error).
    const email = text(body.email)
    if (fields.email === undefined && email !== null && (await this.users.emailTaken(email))) {
      fields.email = ACCOUNT_AUTH_MESSAGES.emailTaken
    }
    const schoolId = text(body.schoolId)
    if (fields.schoolId === undefined) {
      if (schoolId !== null) {
        if (!(await this.schools.exists(schoolId))) fields.schoolId = ACCOUNT_AUTH_MESSAGES.schoolInvalid
      } else if (roleText === 'teacher') {
        // A teacher's scope is its school: without one the account could never open a session.
        fields.schoolId = V.requiredWhen('school id', 'role is teacher')
      }
    }
    const icText = isStudent ? text(body.icNumber) : null
    const icParts = icText !== null ? this.ic.parts(icText) : null
    if (fields.icNumber === undefined && icText !== null && icParts === null) fields.icNumber = IC_FORMAT

    if (Object.keys(fields).length > 0 || !parsed.success) {
      const ordered: Record<string, string> = {}
      for (const key of [...FIELD_ORDER, ...Object.keys(fields)]) {
        const message = fields[key]
        if (message !== undefined) ordered[key] = message
      }
      throw invalid(ordered)
    }
    const data = parsed.data
    const role = data.role ?? 'student'

    const passwordHash = await this.passwords.hash(data.password, 'high')
    const now = this.clock.now()
    try {
      return await this.prisma.transaction(async () => {
        const id = await this.users.create({
          name: data.name,
          email: data.email,
          username: null,
          phone: text(data.phone),
          schoolId: data.schoolId ?? null,
          grade: isStudent ? (data.grade ?? null) : null,
          passwordHash,
          mustChangePassword: false,
          icHash: icParts?.hash ?? null,
          icMasked: icParts?.masked ?? null,
          isActive: true,
          createdById: null,
          now,
        })
        await this.users.setRoles(id, [role], now)
        const grant = await this.issuer.issue(id, info)
        await this.audit.record({
          action: ACCOUNT_AUDIT.REGISTERED,
          actorUserId: id,
          actorRole: role,
          targetType: 'user',
          targetId: id,
          schoolId: data.schoolId ?? null,
          requestId: info.requestId,
          ip: info.ip,
          details: { role },
        })
        return grant
      }, ACCOUNT_TX)
    } catch (err) {
      // Two sign-ups with one e-mail raced past the pre-check: the unique index decides.
      if (!(err instanceof ApiError) && uniqueField(err) === 'email') {
        throw invalid({ email: ACCOUNT_AUTH_MESSAGES.emailTaken })
      }
      throw err
    }
  }
}
