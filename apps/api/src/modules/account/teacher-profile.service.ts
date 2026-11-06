import { Inject, Injectable } from '@nestjs/common'
import {
  ACCOUNT_TEACHER_PROFILE_MESSAGES,
  AccountTeacherProfileUpdateRequestSchema,
  type AccountTeacherProfile,
  type AccountTeacherPublic,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import type { AuthContext } from '../../common/scope/auth-context'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import type { RequestInfo } from '../auth/auth.service'
import { ClassesRepository, type TeacherProfilePatch } from '../classes'
import { SchoolsRepository } from '../schools'
import { IcService } from '../users/credentials'
import { UsersRepository, type UserRecord } from '../users'
import { ACCOUNT_AUDIT, ACCOUNT_TX } from './account.constants'
import { fieldsOf, invalid } from './account.errors'
import { AccountDataRepository } from './account-data.repository'
import { overloadTo429 } from './helpers'

const blankToNull = (v: string | null | undefined): string | null => (v === undefined || v === null || v.trim() === '' ? null : v.trim())

/** Roles that may open another teacher's card (V2 shares it "dengan guru-guru lain"). */
const CARD_READERS: readonly string[] = ['teacher', 'admin', 'school_admin']

/**
 * The teacher's own profile and the read-only teacher card (API-GUR-22). Own routes act on `auth.userId` only.
 * The school is read-only here (FR-GUR-A1-6), the e-mail and the phone are not part of the profile, and the IC is
 * written only as `users.ic_hash` + `users.ic_masked` and read back only masked. Teaching details live in
 * `teacher_profiles`, reached through `ClassesRepository` (the owner of that table).
 */
@Injectable()
export class TeacherProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(AccountDataRepository) private readonly data: AccountDataRepository,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private requireTeacher(auth: AuthContext): void {
    if (auth.active.role !== 'teacher') throw ApiError.of('FORBIDDEN')
  }

  /** `GET /account/teacher-profile`. */
  async get(auth: AuthContext): Promise<AccountTeacherProfile> {
    this.requireTeacher(auth)
    const user = await this.users.get(auth.userId)
    if (!user) throw ApiError.of('UNAUTHORIZED')
    return this.project(user)
  }

  private async project(user: UserRecord): Promise<AccountTeacherProfile> {
    const [teaching, school] = await Promise.all([this.classes.teacherProfile(user.id), user.schoolId === null ? null : this.schools.get(user.schoolId)])
    return {
      name: user.name,
      bio: user.bio,
      icMasked: user.icMasked,
      subject: teaching?.subject ?? null,
      qualification: teaching?.qualification ?? null,
      experienceYears: teaching?.experienceYears ?? 0,
      school: school ? { name: school.name } : null,
    }
  }

  /** `PUT /account/teacher-profile`. */
  async save(auth: AuthContext, raw: unknown, info: RequestInfo): Promise<AccountTeacherProfile> {
    this.requireTeacher(auth)
    return overloadTo429(async () => {
      const parsed = AccountTeacherProfileUpdateRequestSchema.safeParse(raw)
      const fields: Record<string, string> = parsed.success ? {} : fieldsOf(parsed.error)
      if (!parsed.success) {
        const ordered: Record<string, string> = {}
        for (const key of ['name', 'bio', 'ic', 'subject', 'qualification', 'experienceYears']) {
          const message = fields[key]
          if (message !== undefined) ordered[key] = message
        }
        throw invalid(ordered)
      }
      const data = parsed.data
      const user = await this.users.get(auth.userId)
      if (!user) throw ApiError.of('UNAUTHORIZED')

      const icText = blankToNull(data.ic)
      const icParts = icText === null ? null : this.ic.parts(icText)
      if (icText !== null && icParts === null) throw invalid({ ic: ACCOUNT_TEACHER_PROFILE_MESSAGES.icFormat })
      if (icParts !== null && (await this.data.icHashTakenByOther(user.id, icParts.hash))) throw invalid({ ic: ACCOUNT_TEACHER_PROFILE_MESSAGES.icTaken })

      const teaching: TeacherProfilePatch = {
        ...(data.subject !== undefined ? { subject: blankToNull(data.subject) } : {}),
        ...(data.qualification !== undefined ? { qualification: blankToNull(data.qualification) } : {}),
        ...(data.experienceYears !== undefined ? { experienceYears: data.experienceYears } : {}),
      }
      const now = this.clock.now()
      await this.prisma.transaction(async () => {
        await this.users.update(user.id, {
          name: data.name,
          ...(data.bio !== undefined ? { bio: blankToNull(data.bio) } : {}),
          ...(icParts !== null ? { icHash: icParts.hash, icMasked: icParts.masked } : {}),
          now,
        })
        await this.classes.saveTeacherProfile(user.id, teaching, now)
        await this.audit.record({
          action: ACCOUNT_AUDIT.TEACHER_PROFILE_UPDATED,
          actorUserId: auth.userId,
          actorRole: auth.active.role,
          targetType: 'user',
          targetId: auth.userId,
          requestId: info.requestId,
          ip: info.ip,
          isTest: auth.mode !== null,
          // Field names only, never the values (the IC least of all).
          details: { fields: (['name', 'bio', 'ic', 'subject', 'qualification', 'experienceYears'] as const).filter((k) => data[k] !== undefined && (k !== 'ic' || icParts !== null)) },
        })
      }, ACCOUNT_TX)
      const fresh = await this.users.get(auth.userId)
      if (!fresh) throw ApiError.of('UNAUTHORIZED')
      return this.project(fresh)
    })
  }

  /**
   * `GET /public/teachers/:id`: the card of an active teacher for a signed-in teacher, admin or school admin. Any other role, an unknown id
   * and a user who is not an active teacher answer the same `404` (no existence leak, 60 section 1.7).
   */
  async card(auth: AuthContext, id: string): Promise<AccountTeacherPublic> {
    if (!CARD_READERS.includes(auth.active.role)) throw ApiError.of('NOT_FOUND')
    const user = await this.users.get(id)
    if (!user || !user.isActive || user.isSuspended || !user.roles.includes('teacher')) throw ApiError.of('NOT_FOUND')
    const teaching = await this.classes.teacherProfile(user.id)
    return {
      name: user.name,
      subject: teaching?.subject ?? null,
      bio: user.bio,
      qualification: teaching?.qualification ?? null,
      experienceYears: teaching?.experienceYears ?? 0,
    }
  }
}
