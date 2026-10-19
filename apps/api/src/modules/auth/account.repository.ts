import { Inject, Injectable } from '@nestjs/common'

import type { School, User, UserScope } from '../../db/generated/client'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { MAX_LOGIN_CANDIDATES } from './auth.constants'

/** The account rows the session is built from (always the CURRENT rows, BE-NFR-39). */
export interface AccountRecord {
  user: User
  school: School | null
  roles: string[]
  scopes: UserScope[]
  /** Schools referenced by scope rows, by decimal id (includes `school` when present). */
  schools: Map<string, School>
  /** `/api/files/<token>` of the newest avatar file, or null (same rule as `GET /me`). */
  avatarUrl: string | null
}

export interface LoginCandidate {
  id: bigint
  passwordHash: string | null
  schoolId: bigint | null
  schoolName: string | null
}

/** The only place the auth module reads `users`, `user_roles`, `user_scopes` and `schools`. */
@Injectable()
export class AccountRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Accounts a login identifier can refer to. An identifier with `@` is an e-mail (unique, one row);
   * anything else is a username, optionally narrowed to one school. Case-insensitive through the
   * `lower()` unique indexes; values are bound parameters.
   */
  async findLoginCandidates(identifier: string, schoolId?: string): Promise<LoginCandidate[]> {
    let ids: { id: bigint }[]
    if (identifier.includes('@')) {
      ids = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM users WHERE lower(email) = lower(${identifier}) LIMIT 1`
    } else if (schoolId !== undefined) {
      let school: bigint
      try {
        school = idFromString(schoolId)
      } catch {
        return []
      }
      ids = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM users
         WHERE lower(username) = lower(${identifier}) AND school_id = ${school}
         ORDER BY id LIMIT ${MAX_LOGIN_CANDIDATES}`
    } else {
      ids = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM users WHERE lower(username) = lower(${identifier})
         ORDER BY id LIMIT ${MAX_LOGIN_CANDIDATES}`
    }
    if (ids.length === 0) return []
    const rows = await this.prisma.client.user.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      select: { id: true, passwordHash: true, schoolId: true, school: { select: { name: true } } },
      orderBy: { id: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      passwordHash: r.passwordHash,
      schoolId: r.schoolId,
      schoolName: r.school?.name ?? null,
    }))
  }

  async loadAccount(userId: bigint): Promise<AccountRecord | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { school: true, roles: true, scopes: true },
    })
    if (!user) return null
    const { school, roles, scopes, ...plain } = user
    const schools = new Map<string, School>()
    if (school) schools.set(school.id.toString(), school)
    const missing = [
      ...new Set(scopes.map((s) => s.schoolId).filter((id): id is bigint => id !== null && !schools.has(id.toString()))),
    ]
    if (missing.length > 0) {
      for (const s of await this.prisma.client.school.findMany({ where: { id: { in: missing } } })) {
        schools.set(s.id.toString(), s)
      }
    }
    const avatar = await this.prisma.client.file.findFirst({
      where: { ownerUserId: userId, purpose: 'avatar' },
      select: { publicId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return {
      user: plain as User,
      school,
      roles: roles.map((r) => r.role),
      scopes,
      schools,
      avatarUrl: avatar ? `/api/files/${avatar.publicId}` : null,
    }
  }

  /**
   * Success bookkeeping (BR-25): `last_login_at`, and the argon2id replacement of a legacy hash.
   * `updated_at` is kept as it was (a login is not a profile edit).
   */
  async recordLogin(user: User, at: Date, newPasswordHash: string | null): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: at,
        ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}),
        updatedAt: user.updatedAt,
      },
    })
  }
}
