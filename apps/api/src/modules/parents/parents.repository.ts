import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../db/generated/client'
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
/** Which links a caller may touch: by the two ends and, for a school_admin, by the student's school. */
export interface LinkScope {
  parentId?: string
  studentId?: string
  schoolId?: string
}

export interface LinkDetail extends LinkRow {
  parentName: string
  parentEmail: string | null
  studentName: string
  studentSchoolId: string | null
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

  /**
   * Makes the links of one parent exactly `studentIds` (admin edit, AC-M02-15.4): missing pairs are added
   * (an existing row keeps its id and relationship), the others are removed. With `schoolId` only links whose
   * student is in that school are removed, so a school_admin never touches a link it cannot see.
   * Call inside the caller's transaction together with the user write.
   */
  async replaceLinksOfParent(parentId: string, studentIds: readonly string[], schoolId: string | null = null): Promise<void> {
    const parent = idFromString(parentId)
    const wanted = [...new Set(studentIds)].map(idFromString)
    await this.prisma.client.parentLink.deleteMany({
      where: {
        parentId: parent,
        ...(wanted.length > 0 ? { studentId: { notIn: wanted } } : {}),
        ...(schoolId !== null ? { student: { schoolId: idFromString(schoolId) } } : {}),
      },
    })
    if (wanted.length === 0) return
    await this.prisma.client.parentLink.createMany({
      data: wanted.map((studentId) => ({ parentId: parent, studentId, relationship: null })),
      skipDuplicates: true,
    })
  }

  private linkWhere(scope: LinkScope): Prisma.ParentLinkWhereInput | null {
    const ids = [scope.parentId, scope.studentId, scope.schoolId]
    if (ids.some((i) => i !== undefined && !isIdString(i))) return null // a malformed id matches nothing
    return {
      ...(scope.parentId !== undefined ? { parentId: idFromString(scope.parentId) } : {}),
      ...(scope.studentId !== undefined ? { studentId: idFromString(scope.studentId) } : {}),
      ...(scope.schoolId !== undefined ? { student: { schoolId: idFromString(scope.schoolId) } } : {}),
    }
  }

  /**
   * Links inside the scope, oldest first, with both ends joined. Only parents that still hold the parent
   * role are listed (one rule for every list); `findLink` has no such filter, so a stale link can still be removed.
   */
  async listLinks(scope: LinkScope, skip: number, take: number): Promise<{ rows: LinkDetail[]; total: number }> {
    const where = this.linkWhere(scope)
    if (where === null) return { rows: [], total: 0 }
    const listed: Prisma.ParentLinkWhereInput = { AND: [where, { parent: { roles: { some: { role: 'parent' } } } }] }
    const [rows, total] = await Promise.all([
      this.prisma.client.parentLink.findMany({ where: listed, include: LINK_INCLUDE, orderBy: { id: 'asc' }, skip, take }),
      this.prisma.client.parentLink.count({ where: listed }),
    ])
    return { rows: rows.map(toDetail), total }
  }

  /** One link when it is inside the scope, else null (an out-of-scope link is "not found"). */
  async findLink(id: string, scope: LinkScope): Promise<LinkDetail | null> {
    const where = this.linkWhere(scope)
    if (where === null || !isIdString(id)) return null
    const row = await this.prisma.client.parentLink.findFirst({ where: { AND: [{ id: idFromString(id) }, where] }, include: LINK_INCLUDE })
    return row ? toDetail(row) : null
  }

  /** Deletes the link only while it is still inside the scope (the statement re-checks it); false = 0 rows. */
  async removeLink(id: string, scope: LinkScope): Promise<boolean> {
    const where = this.linkWhere(scope)
    if (where === null || !isIdString(id)) return false
    return (await this.prisma.client.parentLink.deleteMany({ where: { AND: [{ id: idFromString(id) }, where] } })).count === 1
  }

  /** Links of a student, oldest first (the service joins and sorts the parents). */
  async linksOfStudent(studentId: string): Promise<LinkRow[]> {
    if (!isIdString(studentId)) return []
    const rows = await this.prisma.client.parentLink.findMany({ where: { studentId: idFromString(studentId) }, orderBy: { id: 'asc' } })
    return rows.map(toLink)
  }
}

const LINK_INCLUDE = {
  parent: { select: { name: true, email: true } },
  student: { select: { name: true, schoolId: true } },
} satisfies Prisma.ParentLinkInclude
type LinkJoined = Prisma.ParentLinkGetPayload<{ include: typeof LINK_INCLUDE }>
const toDetail = (r: LinkJoined): LinkDetail => ({
  ...toLink(r),
  parentName: r.parent.name,
  parentEmail: r.parent.email,
  studentName: r.student.name,
  studentSchoolId: r.student.schoolId === null ? null : idToString(r.student.schoolId),
})

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
