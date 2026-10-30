import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ACCOUNT_AUTH_MESSAGES, AccountRegisterRequestSchema, V } from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import type { RequestInfo, SessionGrant } from '../auth/auth.service'
import { PasswordService } from '../auth/password.service'
import { AuthPorts } from '../auth/ports'
import { SchoolsRepository } from '../schools'
import { IcService } from '../users/credentials'
import { UsersRepository, uniqueField } from '../users'
import { ApiError } from '../../common/errors/api-error'
import { setFieldOnce, strictFieldsOf } from '../../common/validation/strict-body'
import { ACCOUNT_AUDIT, ACCOUNT_TX } from './account.constants'
import { overloadTo429 } from './helpers'
import { invalid, registrationClosed } from './account.errors'
import { AccountPorts } from './registration-ports'
import { SessionIssuer } from './session-issuer.service'

const FIELD_ORDER = ['name', 'email', 'phone', 'role', 'grade', 'icNumber', 'schoolId', 'password', 'passwordConfirmation', 'referralCode']
const IC_FORMAT = 'The ic number field format is invalid.'

/**
 * The register body in STRICT mode (BE-33 AC1c, #99): an unknown key such as `isAdmin` or `status` is a 422 naming it,
 * listed with the other field errors, never bound. The contract refinements (confirmation, student grade) still apply.
 */
const StrictAccountRegisterRequestSchema = AccountRegisterRequestSchema.strict()

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const asRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * Self-registration (mock `register()`, BR-04, BR-05). The role is limited to student, teacher and
 * parent by the contract schema. Rate limit (LEAD 2026-10-20): per client address through the common `RateLimit`
 * guard only, bucket `account.register`, `THROTTLE_REGISTER_PER_MINUTE` (default 30), so a school behind one NAT is
 * not refused and the login throttle is neither shared nor weakened. A `referralCode` is handed to the plugged-in M14
 * registration hook (`AccountPorts`) inside the creating transaction.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name)
  /** REG-CLOSE: read once at start (`REGISTRATION_OPEN`, default open; only `false`/`0` close). */
  private readonly open: boolean

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
    @Inject(AuthPorts) private readonly ports: AuthPorts,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AccountPorts) private readonly accountPorts: AccountPorts,
    @Inject(ConfigService) config: Pick<ConfigService, 'get'>,
  ) {
    const flag = String(config.get<unknown>('REGISTRATION_OPEN') ?? 'true').trim().toLowerCase()
    this.open = flag !== 'false' && flag !== '0'
  }

  /** The rate limit is the `RateLimit` guard of the controller (own bucket, own env key); nothing is shared with the login throttle. */
  async register(raw: unknown, info: RequestInfo): Promise<SessionGrant | 'pending'> {
    // REG-CLOSE: refused before the body is read or the database touched.
    if (!this.open) throw registrationClosed()
    return overloadTo429(() => this.create(raw, info))
  }

  private async create(raw: unknown, info: RequestInfo): Promise<SessionGrant | 'pending'> {
    const parsed = StrictAccountRegisterRequestSchema.safeParse(raw)
    const fields: Record<string, string> = parsed.success ? {} : strictFieldsOf(parsed.error.issues)
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
        if (!(await this.schools.existsSecondary(schoolId))) fields.schoolId = ACCOUNT_AUTH_MESSAGES.schoolInvalid
      } else if (roleText === 'teacher') {
        // A teacher's scope is its school: without one the account could never open a session.
        fields.schoolId = V.requiredWhen('school id', 'role is teacher')
      }
    }
    // Secondary-only (2026-10-29): a new student cannot register in Darjah 1 to 6 (grades 7..11 = Tingkatan 1 to 5).
    if (fields.grade === undefined && isStudent && typeof body.grade === 'number' && body.grade < 7) fields.grade = ACCOUNT_AUTH_MESSAGES.gradeInvalid
    const icText = isStudent ? text(body.icNumber) : null
    const icParts = icText !== null ? this.ic.parts(icText) : null
    if (fields.icNumber === undefined && icText !== null && icParts === null) fields.icNumber = IC_FORMAT

    if (Object.keys(fields).length > 0 || !parsed.success) {
      const ordered: Record<string, string> = {}
      for (const key of [...FIELD_ORDER, ...Object.keys(fields)]) {
        const message = Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined
        if (message !== undefined) setFieldOnce(ordered, key, message)
      }
      throw invalid(ordered)
    }
    const data = parsed.data
    const role = data.role ?? 'student'
    const pending = role === 'teacher'

    const passwordHash = await this.passwords.hash(data.password, 'high')
    const now = this.clock.now()
    let outcome: SessionGrant | 'pending'
    try {
      outcome = await this.prisma.transaction(async (tx) => {
        const id = await this.users.create({
          name: data.name,
          email: data.email,
          username: null,
          phone: text(data.phone),
          // A teacher is created UNVERIFIED: inactive, no school scope, the asked-for school kept as pending (LEAD 2026-10-20).
          schoolId: pending ? null : (data.schoolId ?? null),
          pendingSchoolId: pending ? (data.schoolId ?? null) : null,
          grade: isStudent ? (data.grade ?? null) : null,
          passwordHash,
          mustChangePassword: false,
          icHash: icParts?.hash ?? null,
          icMasked: icParts?.masked ?? null,
          isActive: !pending,
          createdById: null,
          now,
        })
        await this.users.setRoles(id, [role], now)
        const grant = pending ? ('pending' as const) : await this.issuer.issue(id, info)
        await this.audit.record({
          action: ACCOUNT_AUDIT.REGISTERED,
          actorUserId: id,
          actorRole: role,
          targetType: 'user',
          targetId: id,
          schoolId: pending ? null : (data.schoolId ?? null),
          requestId: info.requestId,
          ip: info.ip,
          details: { role, pending },
        })
        // XR-M14-02(b) / BR-M14-19: the referral is applied once the user row exists, in this same transaction (a rollback
        // undoes both). The hook must not throw: an unknown, own, empty or used code is a no-op, and M14 runs the referral in a
        // savepoint, so a failure skips the referral and never the registration (the response never changes).
        await this.accountPorts.registrationHook?.onRegistered({ userId: id, role, pending, referralCode: text(data.referralCode), at: now, tx })
        return grant
      }, ACCOUNT_TX)
    } catch (err) {
      // Two sign-ups with one e-mail raced past the pre-check: the unique index decides.
      if (!(err instanceof ApiError) && uniqueField(err) === 'email') {
        throw invalid({ email: ACCOUNT_AUTH_MESSAGES.emailTaken })
      }
      throw err
    }
    // FR-M01-69: the auto-login of a pupil fires the login hook AFTER the commit (never inside the transaction), bounded and
    // swallowed. A pending teacher got no session, so no login and no hook.
    if (outcome !== 'pending') {
      await this.ports.fireLoginHook({ userId: outcome.session.user.id, role: outcome.session.active.role, at: this.clock.now() }, info.requestId)
    }
    return outcome
  }
}
