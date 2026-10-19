import { randomBytes } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  PARENT_INVITE_MESSAGES,
  PARENT_INVITE_TTL_DAYS,
  ParentInviteAcceptResultSchema,
  ParentInviteGeneratedSchema,
  ParentInvitePreviewSchema,
  ParentInviteStatusSchema,
} from '@pp/contract'
import type { z } from 'zod'

import { AuditService } from '../../common/audit/audit.service'
import type { Env } from '../../common/config/env.schema'
import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import type { TxClient } from '../../db/client'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { hmacHex } from '../auth/tokens'
import { SchoolsRepository } from '../schools'
import { UsersRepository, type UserRecord } from '../users'
import { NO_EMAIL_MASK, PARENT_AUDIT, PARENT_INVITE_HASH_LABEL, PARENT_INVITE_TOKEN_BYTES, WRITE_TX } from './parents.constants'
import { ParentsRepository, type InviteRow } from './parents.repository'

type ParentInviteAcceptResult = z.infer<typeof ParentInviteAcceptResultSchema>
type ParentInviteGenerated = z.infer<typeof ParentInviteGeneratedSchema>
type ParentInvitePreview = z.infer<typeof ParentInvitePreviewSchema>
type ParentInviteStatus = z.infer<typeof ParentInviteStatusSchema>

const DAY_MS = 24 * 60 * 60 * 1000
const SORT_LOCALE = 'ms'

/** Who is acting: the signed-in user and the request facts the audit row needs. */
export interface Actor {
  userId: string
  role: string
  sessionRowId: string
  scopeLevel: string
  requestId: string | null
  ip: string | null
}

/** `a***@domain`: first character, three stars, the domain (contract `ParentEmailMasked`). */
export function maskEmail(email: string | null): string {
  if (email === null) return NO_EMAIL_MASK
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return NO_EMAIL_MASK
  return `${Array.from(email)[0] ?? '-'}***${email.slice(at)}`
}

/** First given name (the preview shows no more of a minor's name). */
export function firstNameOf(name: string): string {
  const trimmed = name.trim()
  return trimmed.split(/\s+/)[0] || trimmed || '?'
}

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

@Injectable()
export class ParentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(ParentsRepository) private readonly repo: ParentsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Keyed hash of a token (HMAC-SHA-256 under the server secret). The mock matched case-insensitively. */
  private hashOf(token: string): string {
    const secret = this.config.get('SESSION_SECRET', { infer: true }) as string
    return hmacHex(secret, PARENT_INVITE_HASH_LABEL, token.toLowerCase())
  }

  private isLive(invite: InviteRow | null, now: Date): invite is InviteRow {
    return invite !== null && invite.usedAt === null && invite.expiresAt.getTime() > now.getTime()
  }

  /** GET /me/parent-invite: whether a live token exists (never the token) and the linked parents. */
  async status(student: Actor): Promise<ParentInviteStatus> {
    const now = this.clock.now()
    const invite = await this.repo.inviteOfStudent(student.userId)
    const live = this.isLive(invite, now) ? invite : null
    return {
      hasToken: live !== null,
      createdAt: live ? toMytTimestamp(live.createdAt) : null,
      expiresAt: live ? toMytTimestamp(live.expiresAt) : null,
      parents: await this.linkedParents(student.userId),
    }
  }

  /** POST /me/parent-invite: a new token replaces the old one at once. The clear token is returned once. */
  async generate(student: Actor): Promise<ParentInviteGenerated> {
    const now = this.clock.now()
    const expiresAt = new Date(now.getTime() + PARENT_INVITE_TTL_DAYS * DAY_MS)
    const token = randomBytes(PARENT_INVITE_TOKEN_BYTES).toString('hex')
    await this.write(async (tx) => {
      await this.repo.replaceInvite(student.userId, this.hashOf(token), now, expiresAt)
      await this.audit.record({
        tx,
        ...this.auditBase(student, PARENT_AUDIT.INVITE_ISSUED),
        targetType: 'user',
        targetId: student.userId,
        details: { expiresAt: toMytTimestamp(expiresAt) },
      })
    })
    return { token, createdAt: toMytTimestamp(now), expiresAt: toMytTimestamp(expiresAt), status: PARENT_INVITE_MESSAGES.regenerated }
  }

  /** GET /parent-invites/:token (public): the child's first name and school only. One 404 for every refusal. */
  async preview(token: string, viewerRole: string | null): Promise<ParentInvitePreview> {
    const { student } = await this.resolve(token)
    return {
      valid: true,
      student: { firstName: firstNameOf(student.name), schoolName: await this.schoolName(student) },
      viewer: viewerRole === null ? 'guest' : viewerRole === 'parent' ? 'parent' : 'other',
    }
  }

  /** POST /parent-invites/:token/accept: consume the token and link the signed-in parent, in one transaction. */
  async accept(parent: Actor, token: string, relationship: string | undefined): Promise<ParentInviteAcceptResult> {
    const { invite, student } = await this.resolve(token)
    // A mixed-role account cannot be linked to itself.
    if (student.id === parent.userId) throw notFound()
    const parentUser = await this.users.get(parent.userId)
    if (!parentUser?.isActive || !parentUser.roles.includes('parent')) throw ApiError.of('FORBIDDEN')

    const now = this.clock.now()
    const out = await this.write(async (tx) => {
      // Single use: only one concurrent accept can flip used_at; the others see 0 rows and get 404.
      if (!(await this.repo.consumeInvite(invite.id, parent.userId, now))) throw notFound()
      const { link, created } = await this.repo.linkIfAbsent(parent.userId, student.id, relationship ?? null)
      await this.audit.record({
        tx,
        ...this.auditBase(parent, PARENT_AUDIT.INVITE_ACCEPTED),
        targetType: 'parent_link',
        targetId: link.id,
        schoolId: student.schoolId,
        details: { studentId: student.id, created },
      })
      return { link, created }
    })
    return {
      linked: true,
      created: out.created,
      linkId: out.link.id,
      student: { id: student.id, name: student.name, schoolName: await this.schoolName(student) },
      parent: { name: parentUser.name },
      relationship: out.link.relationship,
      acceptedAt: toMytTimestamp(now),
    }
  }

  // --- helpers ------------------------------------------------------------------------------------

  /**
   * The live invite behind `token` and its student. A token that is unknown, used, expired, or whose
   * student is not an active student (BR-L45-04) is one indistinguishable 404.
   */
  private async resolve(token: string): Promise<{ invite: InviteRow; student: UserRecord }> {
    const now = this.clock.now()
    const invite = await this.repo.inviteByHash(this.hashOf(token))
    if (!this.isLive(invite, now)) throw notFound()
    const student = await this.users.get(invite.studentId)
    if (!student || !student.isActive || !student.roles.includes('student')) throw notFound()
    return { invite, student }
  }

  private async schoolName(student: UserRecord): Promise<string | null> {
    return student.schoolId === null ? null : ((await this.schools.get(student.schoolId))?.name ?? null)
  }

  /** The student's parents by name (`ms`), only accounts that still hold the parent role. E-mail masked. */
  private async linkedParents(studentId: string): Promise<ParentInviteStatus['parents']> {
    const out: ParentInviteStatus['parents'] = []
    for (const link of await this.repo.linksOfStudent(studentId)) {
      const parent = await this.users.get(link.parentId)
      if (!parent?.roles.includes('parent')) continue
      out.push({
        linkId: link.id,
        id: parent.id,
        name: parent.name,
        emailMasked: maskEmail(parent.email),
        relationship: link.relationship,
        linkedAt: toMytTimestamp(link.createdAt),
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, SORT_LOCALE, { sensitivity: 'base' }) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
  }

  /** One transaction with its audit row; an overloaded database is a retryable 429, never a 500. */
  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }

  private auditBase(who: Actor, action: string) {
    return {
      action,
      actorUserId: who.userId,
      actorRole: who.role,
      sessionRowId: who.sessionRowId,
      scopeLevel: who.scopeLevel,
      requestId: who.requestId,
      ip: who.ip,
    }
  }
}
