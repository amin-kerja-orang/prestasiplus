import { Inject, Injectable } from '@nestjs/common'
import type { PerutusanReactionType, PerutusanStatus } from '@pp/contract'

import type { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FEED_LIMIT, REACTION_ORDER } from './perutusan.constants'
import type { AttachmentKind, StoredAttachment } from './perutusan.files'

export type PerutusanScope = 'national' | 'school'

export interface PostRow {
  id: string
  title: string
  body: string
  youtubeUrl: string | null
  isPinned: boolean
  isPublic: boolean
  status: PerutusanStatus
  scheduledAt: Date | null
  scope: PerutusanScope
  schoolId: string | null
  authorId: string
  createdAt: Date
}

export interface PerutusanViewer {
  userId: string
  isAdmin: boolean
  schoolId: string | null
}

export type ReactionCounts = Record<PerutusanReactionType, number>

export interface PostStats {
  reactions: ReactionCounts
  comments: number
  reads: number
}

export interface AttachmentRow {
  kind: AttachmentKind
  position: number
  size: number
  mime: string
}

export interface NewPost {
  title: string
  body: string
  youtubeUrl: string | null
  isPinned: boolean
  isPublic: boolean
  status: PerutusanStatus
  scheduledAt: Date | null
  scope: PerutusanScope
  schoolId: string | null
  authorId: string
}

type Row = Prisma.PerutusanGetPayload<object>

const emptyCounts = (): ReactionCounts => ({ like: 0, love: 0, thanks: 0 })

function toRow(r: Row): PostRow {
  return {
    id: idToString(r.id),
    title: r.title,
    body: r.body,
    youtubeUrl: r.youtubeUrl,
    isPinned: r.isPinned,
    isPublic: r.isPublic,
    status: r.status as PerutusanStatus,
    scheduledAt: r.scheduledAt,
    scope: r.scope as PerutusanScope,
    schoolId: r.schoolId === null ? null : idToString(r.schoolId),
    authorId: idToString(r.authorId),
    createdAt: r.createdAt,
  }
}

/** Effective publish time (BR-M09-24): the scheduled time, else the creation time. */
export const publishMs = (p: Pick<PostRow, 'scheduledAt' | 'createdAt'>): number => (p.scheduledAt ?? p.createdAt).getTime()

/** BR-M09-24 order: pinned first, then the newest effective time, then the lowest id. */
export function feedOrder(a: PostRow, b: PostRow): number {
  return Number(b.isPinned) - Number(a.isPinned) || publishMs(b) - publishMs(a) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1)
}

/**
 * The only doorway to `perutusan`, `perutusan_files`, `perutusan_comments`, `perutusan_reactions` and `perutusan_reads`.
 * Methods use `prisma.client`, so they join the caller's transaction when there is one.
 */
@Injectable()
export class PerutusanRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** BR-M09-23: published, or scheduled and due; and national, or of the viewer's school, or the viewer's own; admin sees all. */
  visibleWhere(viewer: PerutusanViewer, now: Date): Prisma.PerutusanWhereInput {
    const due: Prisma.PerutusanWhereInput = { OR: [{ status: 'published' }, { status: 'scheduled', scheduledAt: { lte: now } }] }
    if (viewer.isAdmin) return due
    const scope: Prisma.PerutusanWhereInput[] = [{ scope: 'national' }, { authorId: idFromString(viewer.userId) }]
    if (viewer.schoolId !== null && isIdString(viewer.schoolId)) scope.push({ schoolId: idFromString(viewer.schoolId) })
    return { AND: [due, { OR: scope }] }
  }

  async find(id: string): Promise<PostRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.perutusan.findUnique({ where: { id: idFromString(id) } })
    return row ? toRow(row) : null
  }

  /** The post when it is visible to the viewer by the list rule, else null. */
  async findVisible(viewer: PerutusanViewer, id: string, now: Date): Promise<PostRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.perutusan.findFirst({ where: { AND: [{ id: idFromString(id) }, this.visibleWhere(viewer, now)] } })
    return row ? toRow(row) : null
  }

  /** A public AND published post, else null (guests included). */
  async findPublic(id: string): Promise<PostRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.perutusan.findFirst({ where: { id: idFromString(id), isPublic: true, status: 'published' } })
    return row ? toRow(row) : null
  }

  /** S22: the visible posts in feed order (at most `FEED_LIMIT`). */
  async feed(viewer: PerutusanViewer, now: Date): Promise<PostRow[]> {
    const rows = await this.prisma.client.perutusan.findMany({ where: this.visibleWhere(viewer, now) })
    return rows.map(toRow).sort(feedOrder).slice(0, FEED_LIMIT)
  }

  /** S25: the user's own posts, every status, in feed order. */
  async mine(userId: string): Promise<PostRow[]> {
    const rows = await this.prisma.client.perutusan.findMany({ where: { authorId: idFromString(userId) } })
    return rows.map(toRow).sort(feedOrder).slice(0, FEED_LIMIT)
  }

  /** Reaction counts, approved comments and reads of several posts, computed from the tables. */
  async stats(ids: readonly string[]): Promise<Map<string, PostStats>> {
    const out = new Map<string, PostStats>()
    if (ids.length === 0) return out
    const perutusanId = { in: ids.map(idFromString) }
    for (const id of ids) out.set(id, { reactions: emptyCounts(), comments: 0, reads: 0 })
    const [reactions, comments, reads] = await Promise.all([
      this.prisma.client.perutusanReaction.groupBy({ by: ['perutusanId', 'kind'], where: { perutusanId }, _count: { _all: true } }),
      this.prisma.client.perutusanComment.groupBy({ by: ['perutusanId'], where: { perutusanId, status: 'approved' }, _count: { _all: true } }),
      this.prisma.client.perutusanRead.groupBy({ by: ['perutusanId'], where: { perutusanId }, _count: { _all: true } }),
    ])
    for (const r of reactions) {
      const stats = out.get(idToString(r.perutusanId))
      if (stats && (REACTION_ORDER as readonly string[]).includes(r.kind)) stats.reactions[r.kind as PerutusanReactionType] = r._count._all
    }
    for (const c of comments) {
      const stats = out.get(idToString(c.perutusanId))
      if (stats) stats.comments = c._count._all
    }
    for (const r of reads) {
      const stats = out.get(idToString(r.perutusanId))
      if (stats) stats.reads = r._count._all
    }
    return out
  }

  /** The reaction kinds one user holds on a post, in the order they were given. */
  async myReactions(id: string, userId: string): Promise<PerutusanReactionType[]> {
    const rows = await this.prisma.client.perutusanReaction.findMany({
      where: { perutusanId: idFromString(id), userId: idFromString(userId) },
      orderBy: { id: 'asc' },
      select: { kind: true },
    })
    return rows.map((r) => r.kind as PerutusanReactionType)
  }

  /** The stored attachments of a post: images first, then documents, each in upload order. */
  async attachments(id: string): Promise<AttachmentRow[]> {
    const rows = await this.prisma.client.perutusanFile.findMany({
      where: { perutusanId: idFromString(id) },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }, { id: 'asc' }],
      select: { kind: true, position: true, file: { select: { sizeBytes: true, mime: true } } },
    })
    return rows.map((r) => ({ kind: r.kind as AttachmentKind, position: r.position, size: Number(r.file.sizeBytes), mime: r.file.mime }))
  }

  /**
   * BR-M09-07 (INFERRED): a read counts once per user. The unique key makes a repeat open, or two at once, a no-op.
   * Returns the reads after the call.
   */
  async recordRead(id: string, userId: string, now: Date): Promise<number> {
    const perutusanId = idFromString(id)
    await this.prisma.client.perutusanRead.createMany({
      data: [{ perutusanId, userId: idFromString(userId), readAt: now, createdAt: now }],
      skipDuplicates: true,
    })
    return this.prisma.client.perutusanRead.count({ where: { perutusanId } })
  }

  /** BR-M09-25: removes the (user, post, kind) reaction when it exists, else adds it. True when it is now ON. */
  async toggleReaction(id: string, userId: string, kind: PerutusanReactionType, now: Date): Promise<boolean> {
    const where = { perutusanId: idFromString(id), userId: idFromString(userId), kind }
    const removed = await this.prisma.client.perutusanReaction.deleteMany({ where })
    if (removed.count > 0) return false
    await this.prisma.client.perutusanReaction.createMany({ data: [{ ...where, createdAt: now, updatedAt: now }], skipDuplicates: true })
    return true
  }

  /** BR-M09-26: stored `pending`; no read path returns it until a moderation route exists. */
  async addComment(id: string, userId: string, body: string, now: Date): Promise<string> {
    const row = await this.prisma.client.perutusanComment.create({
      data: { perutusanId: idFromString(id), userId: idFromString(userId), body, status: 'pending', createdAt: now, updatedAt: now },
      select: { id: true },
    })
    return idToString(row.id)
  }

  /** Serialises pin-limit checks of one scope (the check and the insert run in the same transaction). */
  async lockPinScope(scope: PerutusanScope, schoolId: string | null): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`perutusan-pin:${scope}:${schoolId ?? ''}`}))`
  }

  /** BR-M09-28 (INFERRED): published AND scheduled pinned posts of the scope count; drafts do not. */
  async pinnedCount(scope: PerutusanScope, schoolId: string | null): Promise<number> {
    return this.prisma.client.perutusan.count({
      where: { isPinned: true, status: { in: ['published', 'scheduled'] }, scope, schoolId: schoolId === null ? null : idFromString(schoolId) },
    })
  }

  /** Inserts the post and one `perutusan_files` row per attachment, in order. */
  async create(data: NewPost, images: readonly StoredAttachment[], documents: readonly StoredAttachment[], now: Date): Promise<PostRow> {
    const files = [
      ...images.map((f, position) => ({ kind: 'image', position, fileId: idFromString(f.fileId), createdAt: now, updatedAt: now })),
      ...documents.map((f, position) => ({ kind: 'document', position, fileId: idFromString(f.fileId), createdAt: now, updatedAt: now })),
    ]
    const row = await this.prisma.client.perutusan.create({
      data: {
        title: data.title,
        body: data.body,
        youtubeUrl: data.youtubeUrl,
        isPinned: data.isPinned,
        isPublic: data.isPublic,
        status: data.status,
        scheduledAt: data.scheduledAt,
        scope: data.scope,
        schoolId: data.schoolId === null ? null : idFromString(data.schoolId),
        authorId: idFromString(data.authorId),
        createdAt: now,
        updatedAt: now,
        ...(files.length > 0 ? { files: { create: files } } : {}),
      },
    })
    return toRow(row)
  }
}
