import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  ACCOUNT_AUTH_MESSAGES,
  ACCOUNT_PICTURE_MAX_KB,
  ACCOUNT_PICTURE_MESSAGES,
  ACCOUNT_PICTURE_MIME_TYPES,
  AccountPasswordChangeRequestSchema,
  AccountProfileUpdateRequestSchema,
  V,
  type AccountUserMe,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import type { AuthContext } from '../../common/scope/auth-context'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import type { RequestInfo, SessionGrant } from '../auth/auth.service'
import { PasswordService } from '../auth/password.service'
import { LANDING_PATHS } from '../auth/session-view'
import { FilesService } from '../files'
import { SchoolsRepository } from '../schools'
import { UsersRepository, type UserRecord } from '../users'
import { ACCOUNT_AUDIT, ACCOUNT_TX, STAFF_ROLES } from './account.constants'
import { fieldsOf, invalid } from './account.errors'
import { AccountDataRepository } from './account-data.repository'
import { AccountThrottle } from './account-throttle.service'
import { overloadTo429 } from './helpers'
import { SessionIssuer } from './session-issuer.service'

const blankToNull = (v: string | null | undefined): string | null => (v === undefined || v === null || v.trim() === '' ? null : v.trim())

/** The uploaded part as multer hands it over. */
export interface PictureUpload {
  buffer: Buffer
  mimetype: string
}

/**
 * The signed-in user's own profile: `GET/PUT /me`, password change and the picture (mock
 * `auth-account.ts`, BR-13 to BR-16). Everything acts on `auth.userId` only; no id comes from the client.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(AccountDataRepository) private readonly data: AccountDataRepository,
    @Inject(AccountThrottle) private readonly throttle: AccountThrottle,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // --- GET /me -----------------------------------------------------------------------------------------

  /** The `UserMe` projection. role, roles and landing path come from the session context, so they always equal `GET /session`. */
  async me(auth: AuthContext): Promise<AccountUserMe> {
    const user = await this.users.get(auth.userId)
    if (!user) throw ApiError.of('UNAUTHORIZED')
    return this.project(auth, user)
  }

  private async project(auth: AuthContext, user: UserRecord): Promise<AccountUserMe> {
    const school = user.schoolId === null ? null : await this.schools.get(user.schoolId)
    const avatar = (await this.data.avatarTokens(user.id))[0]
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      phone: user.phone,
      bio: user.bio,
      avatarUrl: avatar ? `/api/files/${avatar}` : null,
      grade: user.grade,
      schoolId: school ? user.schoolId : null,
      school: school
        ? {
            id: school.id,
            name: school.name,
            code: school.code ?? '',
            type: school.type ?? '',
            state: school.state ?? '',
            district: school.district,
            city: school.city,
          }
        : null,
      role: auth.active.role,
      roles: auth.roles.map((g) => g.role),
      landingPath: LANDING_PATHS[auth.active.role],
      createdAt: toMytTimestamp(user.createdAt),
      updatedAt: toMytTimestamp(user.updatedAt),
      lastLoginAt: user.lastLoginAt ? toMytTimestamp(user.lastLoginAt) : null,
    }
  }

  // --- PUT /me -------------------------------------------------------------------------------------------

  async updateProfile(auth: AuthContext, raw: unknown, info: RequestInfo): Promise<AccountUserMe> {
    return overloadTo429(async () => {
      const parsed = AccountProfileUpdateRequestSchema.safeParse(raw)
      const fields: Record<string, string> = parsed.success ? {} : fieldsOf(parsed.error)
      const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
      const user = await this.users.get(auth.userId)
      if (!user) throw ApiError.of('UNAUTHORIZED')
      // A staff school is an admin-assigned scope (BR-13 note): the body value is ignored for those accounts.
      const staff = user.roles.some((r) => STAFF_ROLES.includes(r))
      const schoolId = typeof body.schoolId === 'string' ? body.schoolId : body.schoolId === null ? null : undefined

      if (fields.schoolId === undefined && typeof schoolId === 'string' && !(await this.schools.exists(schoolId))) {
        fields.schoolId = ACCOUNT_AUTH_MESSAGES.schoolInvalid
      }
      if (fields.schoolId === undefined && schoolId === null && !staff && user.roles.includes('teacher')) {
        // A teacher's scope is its school: clearing it would leave an account that cannot hold a session.
        fields.schoolId = V.requiredWhen('school id', 'role is teacher')
      }
      if (Object.keys(fields).length > 0 || !parsed.success) {
        const ordered: Record<string, string> = {}
        for (const key of ['name', 'phone', 'bio', 'grade', 'schoolId', ...Object.keys(fields)]) {
          const message = fields[key]
          if (message !== undefined) ordered[key] = message
        }
        throw invalid(ordered)
      }
      const data = parsed.data

      // BR-13: `email` (and any other key) in the body is not part of the schema and never reaches this patch.
      const now = this.clock.now()
      await this.prisma.transaction(async () => {
        await this.users.update(
          user.id,
          {
            name: data.name,
            ...(data.phone !== undefined ? { phone: blankToNull(data.phone) } : {}),
            ...(data.bio !== undefined ? { bio: blankToNull(data.bio) } : {}),
            ...(data.grade !== undefined ? { grade: data.grade } : {}),
            ...(data.schoolId !== undefined && !staff ? { schoolId: data.schoolId } : {}),
            now,
          },
        )
        await this.audit.record({
          action: ACCOUNT_AUDIT.PROFILE_UPDATED,
          actorUserId: auth.userId,
          actorRole: auth.active.role,
          targetType: 'user',
          targetId: auth.userId,
          requestId: info.requestId,
          ip: info.ip,
          isTest: auth.mode !== null,
          // Field names only, never the values.
          details: { fields: Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined) },
        })
      }, ACCOUNT_TX)
      return this.me(auth)
    })
  }

  // --- PUT /me/password --------------------------------------------------------------------------------

  /**
   * Requires the current password (a wrong one is counted: 5 per minute per user, then 429), re-hashes
   * with argon2id, clears `must_reset_password`, ends the user's OTHER sessions and ALWAYS rotates the caller's own
   * session (new cookie, old row deleted; OWASP, lead decision 2026-10-20). The CSRF token changes, so the client
   * must read `GET /session` afterwards. Returns the new grant.
   */
  async changePassword(auth: AuthContext, raw: unknown, info: RequestInfo): Promise<SessionGrant> {
    return overloadTo429(async () => {
      const parsed = AccountPasswordChangeRequestSchema.safeParse(raw)
      if (!parsed.success) throw invalid(fieldsOf(parsed.error))
      const data = parsed.data

      await this.throttle.passwordChangeGuard(auth.userId)
      const credentials = await this.users.getCredentials(auth.userId)
      if (!credentials) throw ApiError.of('UNAUTHORIZED')
      const check = await this.passwords.check(data.currentPassword, credentials.passwordHash)
      if (!check.ok) {
        await this.throttle.passwordChangeFailed(auth.userId)
        throw invalid({ currentPassword: ACCOUNT_AUTH_MESSAGES.currentPasswordWrong })
      }

      const passwordHash = await this.passwords.hash(data.password, 'high')
      const now = this.clock.now()
      const grant = await this.prisma.transaction(async () => {
        await this.users.update(auth.userId, { passwordHash, mustChangePassword: false, now })
        await this.data.revokeOtherSessions(auth.userId, auth.sessionRowId, now)
        const rotated = await this.issuer.rotate(auth.sessionRowId, info)
        await this.audit.record({
          action: ACCOUNT_AUDIT.PASSWORD_CHANGED,
          actorUserId: auth.userId,
          actorRole: auth.active.role,
          targetType: 'user',
          targetId: auth.userId,
          requestId: info.requestId,
          ip: info.ip,
          isTest: auth.mode !== null,
          details: { rotated: true, clearedMustChange: credentials.mustChangePassword },
        })
        return rotated
      }, ACCOUNT_TX)
      await this.throttle.passwordChangeSucceeded(auth.userId).catch(() => undefined)
      return grant
    })
  }

  // --- POST /me/picture --------------------------------------------------------------------------------

  /** The picture goes through the BE-04 files service (type decided from the bytes, metadata stripped). */
  async setPicture(auth: AuthContext, file: PictureUpload | undefined, info: RequestInfo): Promise<{ avatarUrl: string }> {
    if (!file || file.buffer.length === 0) throw invalid({ profilePicture: ACCOUNT_PICTURE_MESSAGES.required })
    if (!(ACCOUNT_PICTURE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw invalid({ profilePicture: ACCOUNT_PICTURE_MESSAGES.type })
    }
    if (file.buffer.length > ACCOUNT_PICTURE_MAX_KB * 1024) throw invalid({ profilePicture: ACCOUNT_PICTURE_MESSAGES.size })

    const who = { ip: info.ip, requestId: info.requestId }
    const before = await this.data.avatarTokens(auth.userId)
    let ref
    try {
      ref = await this.files.upload(auth, 'avatar', { buffer: file.buffer }, who)
    } catch (err) {
      // The files service words its 422 for `fields.file`; this route answers on `profilePicture` with the contract copy.
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.fields?.file !== undefined) {
        const tooBig = /greater than/.test(err.fields.file)
        throw invalid({ profilePicture: tooBig ? ACCOUNT_PICTURE_MESSAGES.size : ACCOUNT_PICTURE_MESSAGES.type })
      }
      throw err
    }
    // One picture per user: the earlier ones go (best effort; a leftover file is harmless, it is never linked).
    for (const token of before) {
      try {
        await this.files.remove(auth, token, who)
      } catch {
        this.logger.warn(`old avatar file not removed (requestId=${info.requestId ?? '-'})`)
      }
    }
    await this.audit
      .record({
        action: ACCOUNT_AUDIT.PICTURE_UPDATED,
        actorUserId: auth.userId,
        actorRole: auth.active.role,
        targetType: 'user',
        targetId: auth.userId,
        requestId: info.requestId,
        ip: info.ip,
        isTest: auth.mode !== null,
      })
      .catch(() => this.logger.warn(`picture audit write failed (requestId=${info.requestId ?? '-'})`))
    return { avatarUrl: ref.url }
  }
}
