import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface InviteRow {
  id: string
  studentId: string
  createdAt: Date
  expiresAt: Date
  usedAt: Date | null
}

export interface LinkRow {
  id: string
  parentId: string
  studentId: string
  relationship: string | null
  createdAt: Date
}

/**
 * The only doorway to `parent_invites` and `parent_links`. Methods use `prisma.client`, so they join
 * the caller's transaction when there is one. The raw token never reaches this class: callers pass
 * its keyed hash.
 */
@Injectable()
export class ParentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async inviteOfStudent(studentId: string): Promise<InviteRow | null> {
    if (!isIdString(studentId)) return null
    const row = await this.prisma.client.parentInvite.findUnique({ where: { studentId: idFromString(studentId) } })
    return row ? toInvite(row) : null
  }

  async inviteByHash(tokenHash: string): Promise<InviteRow | null> {
    const row = await this.prisma.client.parentInvite.findUnique({ where: { tokenHash } })
    return row ? toInvite(row) : null
  }

  /**
   * One live invite per student: inserts, or replaces the token of the existing row (the old hash is
   * gone at once) and clears `used_at`. One atomic statement, so two regenerations cannot collide.
   */
  async replaceInvite(studentId: string, tokenHash: string, now: Date, expiresAt: Date): Promise<void> {
    await this.prisma.client.$executeRaw`
      INSERT INTO parent_invites (student_id, token_hash, expires_at, used_at, accepted_by_id, created_at, updated_at)
      VALUES (${idFromString(studentId)}, ${tokenHash}, ${expiresAt}, NULL, NULL, ${now}, ${now})
      ON CONFLICT (student_id) DO UPDATE
        SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, used_at = NULL,
            accepted_by_id = NULL, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`
  }

  /** Marks a live invite used (single use). False when it was already used, expired or replaced. */
  async consumeInvite(id: string, parentId: string, now: Date): Promise<boolean> {
    const res = await this.prisma.client.parentInvite.updateMany({
      where: { id: idFromString(id), usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, acceptedById: idFromString(parentId), updatedAt: now },
    })
    return res.count === 1
  }

  /** Creates the link unless the pair exists (the old row and its relationship are kept). */
  async linkIfAbsent(parentId: string, studentId: string, relationship: string | null): Promise<{ link: LinkRow; created: boolean }> {
    const where = { parentId: idFromString(parentId), studentId: idFromString(studentId) }
    const made = await this.prisma.client.parentLink.createMany({ data: [{ ...where, relationship }], skipDuplicates: true })
    const row = await this.prisma.client.parentLink.findUniqueOrThrow({ where: { parentId_studentId: where } })
    return { link: toLink(row), created: made.count === 1 }
  }

  /** Links of a student, oldest first (the service joins and sorts the parents). */
  async linksOfStudent(studentId: string): Promise<LinkRow[]> {
    if (!isIdString(studentId)) return []
    const rows = await this.prisma.client.parentLink.findMany({ where: { studentId: idFromString(studentId) }, orderBy: { id: 'asc' } })
    return rows.map(toLink)
  }
}

type InviteDb = { id: bigint; studentId: bigint; createdAt: Date; expiresAt: Date; usedAt: Date | null }
const toInvite = (r: InviteDb): InviteRow => ({
  id: idToString(r.id),
  studentId: idToString(r.studentId),
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
  usedAt: r.usedAt,
})

type LinkDb = { id: bigint; parentId: bigint; studentId: bigint; relationship: string | null; createdAt: Date }
const toLink = (r: LinkDb): LinkRow => ({
  id: idToString(r.id),
  parentId: idToString(r.parentId),
  studentId: idToString(r.studentId),
  relationship: r.relationship,
  createdAt: r.createdAt,
})
