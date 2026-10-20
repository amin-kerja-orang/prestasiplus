import { Inject, Injectable } from '@nestjs/common'
import {
  CONTENT_MESSAGES,
  contentFileRefused,
  PERUTUSAN_STATUSES,
  PerutusanCommentRequestSchema,
  PerutusanReactionRequestSchema,
  type PerutusanReactionType,
  type PerutusanStatus,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import type { TxClient } from '../../../db/client'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { SchoolsRepository } from '../../schools'
import { UsersRepository, type UserRecord } from '../../users'
import { HTML_SANITIZER, type HtmlSanitizer } from '../shared'
import type { VideoActor as Actor } from '../videos/videos.service'
import { FIELD_INVALID, FIELD_REQUIRED, isPlainObject, validateBody } from '../videos/form-fields'
import { parseVideoUrl } from '../videos/video-url'
import {
  AUTHOR_ROLE_LABELS,
  BODY_FIELD_BYTES,
  CONTENT_FLASH,
  EXCERPT_LENGTH,
  FILE_REFUSED_FALLBACK,
  MAX_DOCUMENTS,
  MAX_IMAGES,
  PERUTUSAN_AUDIT,
  PERUTUSAN_COMMENT_MAX,
  PERUTUSAN_MAX_PINNED,
  PERUTUSAN_NATIONAL_SCOPE_LABEL,
  PERUTUSAN_SCHOOL_SCOPE_LABEL,
  PERUTUSAN_STATUS_LABELS,
  REACTION_EMOJI,
  REACTION_ORDER,
  STATUS_FLASH,
  UNKNOWN_AUTHOR,
  WRITE_TX,
  YOUTUBE_URL_MAX,
} from './perutusan.constants'
import { inspectAttachment, PerutusanFileStore, type AttachmentKind, type InspectedAttachment } from './perutusan.files'
import {
  PerutusanRepository,
  type AttachmentRow,
  type PerutusanScope,
  type PerutusanViewer,
  type PostRow,
  type PostStats,
  type ReactionCounts,
} from './perutusan.repository'
import { parseScheduledAt } from './scheduled-at'

/** A file part of the multipart body (multer memory storage). */
export interface UploadedPart {
  originalname: string
  buffer: Buffer
}

export interface PerutusanFiles {
  images: readonly UploadedPart[]
  documents: readonly UploadedPart[]
}

const TEXT_FIELDS = ['title', 'body', 'status', 'scheduledAt', 'youtubeUrl', 'isPinned', 'isPublic'] as const
const ASSET_FIELDS = ['images', 'documents', 'images[]', 'documents[]']
const KNOWN_FIELDS: ReadonlySet<string> = new Set([...TEXT_FIELDS, ...ASSET_FIELDS])
const STATUS_SET: ReadonlySet<string> = new Set(PERUTUSAN_STATUSES)

/** BR-M09-27: HTML removed, whitespace collapsed, cut to 250 characters + "...". */
export function excerptOf(html: string): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}...` : text
}

/** First letters of the first two words (BR-M09-29). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

/** The mock reads any of these as true; anything else is false and never an error. */
export function asBool(value: unknown): boolean {
  return value === true || value === 1 || ['1', 'true', 'on', 'yes'].includes(String(value).toLowerCase())
}

const fieldError = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

const safeName = (name: string): string => {
  const cleaned = name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 100)
  return cleaned || FILE_REFUSED_FALLBACK
}

interface Authors {
  users: Map<string, UserRecord | null>
  schools: Map<string, string>
}

@Injectable()
export class PerutusanService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PerutusanRepository) private readonly repo: PerutusanRepository,
    @Inject(PerutusanFileStore) private readonly files: PerutusanFileStore,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HTML_SANITIZER) private readonly sanitizer: HtmlSanitizer,
  ) {}

  // --- reads ----------------------------------------------------------------------------------------

  /** GET /perutusan: the visible posts, pinned first then newest. */
  async list(actor: Actor) {
    const viewer = await this.viewerOf(actor)
    return this.cards(await this.repo.feed(viewer, this.clock.now()))
  }

  /** GET /perutusan/mine: the caller's own posts, every status. */
  async mine(actor: Actor) {
    const posts = await this.repo.mine(actor.userId)
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      statusLabel: PERUTUSAN_STATUS_LABELS[p.status],
      createdAt: toMytTimestamp(p.createdAt),
    }))
  }

  /** GET /perutusan/compose-context: admin writes nationally, school_admin for the own school, others cannot write. */
  async composeContext(actor: Actor) {
    if (actor.role === 'admin') return { scope: 'national' as const, scopeLabel: PERUTUSAN_NATIONAL_SCOPE_LABEL, canWrite: true }
    if (actor.role === 'school_admin') {
      const user = await this.users.get(actor.userId)
      const school = user?.schoolId ? await this.schools.get(user.schoolId) : null
      return { scope: 'school' as const, scopeLabel: school?.name ?? PERUTUSAN_SCHOOL_SCOPE_LABEL, canWrite: true }
    }
    return { scope: null, scopeLabel: '', canWrite: false }
  }

  /**
   * GET /perutusan/:id: a visible post, or a non-published post for its author and an admin; else 404 (never 403).
   * Records the read (once per user; the admin and the author count nothing) and returns `reads` including this open.
   */
  async detail(actor: Actor, id: string) {
    const viewer = await this.viewerOf(actor)
    const post = await this.repo.find(id)
    if (!post) throw ApiError.of('NOT_FOUND')
    const canWrite = post.authorId === viewer.userId || viewer.isAdmin
    if (!(post.status !== 'published' && canWrite) && !(await this.repo.findVisible(viewer, id, this.clock.now()))) throw ApiError.of('NOT_FOUND')
    const body = await this.detailOf(post, viewer, canWrite)
    if (!canWrite) body.reads = await this.repo.recordRead(post.id, viewer.userId, this.clock.now())
    return body
  }

  /** GET /public/perutusan/:id: only a public, published post. Counts no read. */
  async publicDetail(id: string) {
    const post = await this.repo.findPublic(id)
    if (!post) throw ApiError.of('NOT_FOUND')
    const [card] = await this.cards([post])
    const stats = (await this.repo.stats([post.id])).get(post.id)
    const reactions = stats?.reactions ?? { like: 0, love: 0, thanks: 0 }
    return {
      id: post.id,
      title: post.title,
      author: card?.author as NonNullable<typeof card>['author'],
      body: post.body,
      createdAt: toMytTimestamp(post.createdAt),
      youtubeEmbedUrl: post.youtubeUrl ? parseVideoUrl(post.youtubeUrl).embedUrl : null,
      scopeLabel: card?.scopeLabel ?? PERUTUSAN_SCHOOL_SCOPE_LABEL,
      reactionTotal: reactions.like + reactions.love + reactions.thanks,
      reads: stats?.reads ?? 0,
      commentCount: stats?.comments ?? 0,
    }
  }

  // --- writes ---------------------------------------------------------------------------------------

  /** POST /perutusan (multipart): admin (national) and school_admin (own school) only. */
  async create(actor: Actor, raw: unknown, parts: PerutusanFiles) {
    const scope = this.scopeOf(actor.role)
    if (scope === null) throw ApiError.of('FORBIDDEN')
    const fields: Record<string, string> = {}
    const input = isPlainObject(raw) ? raw : {}
    for (const key of Object.keys(input)) if (!KNOWN_FIELDS.has(key)) fields[key] = FIELD_INVALID

    const text = (key: string): string | undefined | null => {
      const v = input[key]
      if (v === undefined || v === null) return undefined
      if (typeof v !== 'string') {
        fields[key] = FIELD_INVALID
        return null
      }
      return v
    }
    const title = text('title')
    if (title === undefined || (title !== null && title.trim() === '')) fields.title ??= FIELD_REQUIRED
    else if (title !== null && title.trim().length > 255) fields.title = FIELD_INVALID
    const body = text('body') ?? ''
    if (Buffer.byteLength(body, 'utf8') > BODY_FIELD_BYTES) fields.body = FIELD_INVALID
    const status = text('status')
    if (status === undefined || status === '') fields.status ??= FIELD_REQUIRED
    else if (status !== null && !STATUS_SET.has(status)) fields.status = FIELD_INVALID
    const youtube = text('youtubeUrl')
    const youtubeUrl = typeof youtube === 'string' && youtube.trim() !== '' ? youtube.trim() : null
    if (youtubeUrl !== null && (youtubeUrl.length > YOUTUBE_URL_MAX || parseVideoUrl(youtubeUrl).platform !== 'Youtube')) fields.youtubeUrl = FIELD_INVALID

    // A scheduled time only counts for a scheduled post, and must lie in the future (a time without an offset is Malaysia time).
    let scheduledAt: Date | null = null
    const scheduledRaw = text('scheduledAt')
    if (status === 'scheduled') {
      if (typeof scheduledRaw !== 'string' || scheduledRaw.trim() === '') fields.scheduledAt ??= FIELD_REQUIRED
      else {
        scheduledAt = parseScheduledAt(scheduledRaw.trim())
        if (scheduledAt === null || scheduledAt.getTime() <= this.clock.now().getTime()) {
          fields.scheduledAt = FIELD_INVALID
          scheduledAt = null
        }
      }
    }

    const images = this.inspect('image', parts.images, MAX_IMAGES, fields, 'images')
    const documents = this.inspect('document', parts.documents, MAX_DOCUMENTS, fields, 'documents')
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })

    const user = await this.users.get(actor.userId)
    const schoolId = scope === 'school' ? (user?.schoolId ?? null) : null
    // The scope=school <=> school_id pair is checked here: the database has no CHECK for it (a school delete sets the id to null).
    if (scope === 'school' && schoolId === null) throw fieldError('form', CONTENT_MESSAGES.perutusanSchoolAdminNoSchool)

    const post = {
      title: String(title).trim(),
      body: this.sanitizer.sanitize(body),
      youtubeUrl,
      isPinned: asBool(input.isPinned),
      isPublic: asBool(input.isPublic),
      status: status as PerutusanStatus,
      scheduledAt,
      scope,
      schoolId,
      authorId: actor.userId,
    }

    const now = this.clock.now()
    const stored: string[] = []
    let committed = false
    try {
      const putAll = async (list: readonly InspectedAttachment[]) => {
        const keys: string[] = []
        for (const file of list) {
          const key = await this.files.putObject(file)
          stored.push(key)
          keys.push(key)
        }
        return keys
      }
      const imageKeys = await putAll(images)
      const documentKeys = await putAll(documents)
      const row = await this.write(async (tx) => {
        // BR-M09-28: at most 2 published-or-scheduled pins per scope; the lock makes the check and the insert one step.
        if (post.isPinned && post.status !== 'draft') {
          await this.repo.lockPinScope(scope, schoolId)
          if ((await this.repo.pinnedCount(scope, schoolId)) >= PERUTUSAN_MAX_PINNED) {
            throw fieldError('isPinned', CONTENT_MESSAGES.perutusanPinLimit)
          }
        }
        const rows = async (list: readonly InspectedAttachment[], keys: readonly string[]) => {
          const out = []
          for (const [i, file] of list.entries()) out.push(await this.files.createRow(actor.userId, file, keys[i] as string, actor.isTest))
          return out
        }
        const created = await this.repo.create(post, await rows(images, imageKeys), await rows(documents, documentKeys), now)
        await this.audit.record({
          tx,
          ...this.auditBase(actor, PERUTUSAN_AUDIT.CREATED),
          targetType: 'perutusan',
          targetId: created.id,
          schoolId,
          details: { status: post.status, scope, pinned: post.isPinned, public: post.isPublic, images: images.length, documents: documents.length },
        })
        return created
      })
      committed = true
      const viewer = await this.viewerOf(actor)
      return { data: await this.detailOf(row, viewer, true), status: STATUS_FLASH[post.status] }
    } catch (err) {
      // After the commit the rows exist: the objects must stay.
      if (!committed) await this.files.discard(stored)
      throw err
    }
  }

  /** POST /perutusan/:id/reactions: toggles the (user, post, kind) reaction on a post the caller can see. */
  async react(actor: Actor, id: string, raw: unknown) {
    const viewer = await this.viewerOf(actor)
    const post = await this.repo.findVisible(viewer, id, this.clock.now())
    if (!post) throw ApiError.of('NOT_FOUND')
    const { type } = validateBody(PerutusanReactionRequestSchema, raw, ['type'])
    const now = this.clock.now()
    await this.write(async (tx) => {
      const on = await this.repo.toggleReaction(post.id, actor.userId, type, now)
      await this.audit.record({
        tx,
        ...this.auditBase(actor, PERUTUSAN_AUDIT.REACTED),
        targetType: 'perutusan',
        targetId: post.id,
        schoolId: post.schoolId,
        details: { type, on },
      })
    })
    const stats = (await this.repo.stats([post.id])).get(post.id)
    return { reactions: stats?.reactions ?? { like: 0, love: 0, thanks: 0 }, myReactions: await this.repo.myReactions(post.id, actor.userId) }
  }

  /** POST /perutusan/:id/comments: stored `pending` and shown to nobody until approved. */
  async comment(actor: Actor, id: string, raw: unknown) {
    const viewer = await this.viewerOf(actor)
    const post = await this.repo.findVisible(viewer, id, this.clock.now())
    if (!post) throw ApiError.of('NOT_FOUND')
    const body = validateBody(PerutusanCommentRequestSchema, raw, ['body'])
    const text = body.body.trim()
    const length = [...text].length
    if (length < 1 || length > PERUTUSAN_COMMENT_MAX) throw fieldError('body', CONTENT_MESSAGES.commentLength)
    const now = this.clock.now()
    const commentId = await this.write(async (tx) => {
      const created = await this.repo.addComment(post.id, actor.userId, text, now)
      await this.audit.record({
        tx,
        ...this.auditBase(actor, PERUTUSAN_AUDIT.COMMENTED),
        targetType: 'perutusan',
        targetId: post.id,
        schoolId: post.schoolId,
        details: { commentId: created, length },
      })
      return created
    })
    return { data: { id: commentId, status: 'pending' as const }, status: CONTENT_FLASH.commentSent }
  }

  // --- helpers --------------------------------------------------------------------------------------

  private scopeOf(role: string): PerutusanScope | null {
    return role === 'admin' ? 'national' : role === 'school_admin' ? 'school' : null
  }

  /** Checks each file part by its content and size. The first refused file names its field, as the mock does. */
  private inspect(kind: AttachmentKind, list: readonly UploadedPart[], max: number, fields: Record<string, string>, field: string): InspectedAttachment[] {
    const out: InspectedAttachment[] = []
    for (const part of list) {
      const inspected = inspectAttachment(kind, part.buffer)
      if (!inspected) {
        fields[field] ??= contentFileRefused(safeName(part.originalname))
        return out
      }
      out.push(inspected)
    }
    if (out.length > max) fields[field] ??= contentFileRefused(FILE_REFUSED_FALLBACK)
    return out
  }

  private async viewerOf(actor: Actor): Promise<PerutusanViewer> {
    const user = await this.users.get(actor.userId)
    return { userId: actor.userId, isAdmin: actor.role === 'admin', schoolId: user?.schoolId ?? null }
  }

  private async authorsOf(posts: readonly PostRow[]): Promise<Authors> {
    const users = new Map<string, UserRecord | null>()
    for (const id of new Set(posts.map((p) => p.authorId))) users.set(id, await this.users.get(id))
    const schoolIds = [...new Set(posts.flatMap((p) => (p.schoolId === null ? [] : [p.schoolId])))]
    const schools = new Map((await this.schools.getMany(schoolIds)).map((s) => [s.id, s.name]))
    return { users, schools }
  }

  private topReaction(counts: ReactionCounts) {
    let best: PerutusanReactionType | null = null
    for (const type of REACTION_ORDER) if (counts[type] > 0 && (best === null || counts[type] > counts[best])) best = type
    return best === null ? null : { type: best, emoji: REACTION_EMOJI[best], count: counts[best] }
  }

  private cardOf(p: PostRow, stats: PostStats, authors: Authors) {
    const author = authors.users.get(p.authorId) ?? null
    const name = author?.name?.trim() || UNKNOWN_AUTHOR
    const role = author?.roles.find((r) => r in AUTHOR_ROLE_LABELS)
    return {
      id: p.id,
      title: p.title,
      excerpt: excerptOf(p.body),
      isPinned: p.isPinned,
      hasVideo: p.youtubeUrl !== null,
      scopeLabel: p.scope === 'national' ? PERUTUSAN_NATIONAL_SCOPE_LABEL : ((p.schoolId && authors.schools.get(p.schoolId)) || PERUTUSAN_SCHOOL_SCOPE_LABEL),
      createdAt: toMytTimestamp(p.createdAt),
      author: { name, initials: initialsOf(name), roleLabel: role ? (AUTHOR_ROLE_LABELS[role] as string) : '' },
      topReaction: this.topReaction(stats.reactions),
      commentCount: stats.comments,
      reads: stats.reads,
    }
  }

  private async cards(posts: readonly PostRow[]) {
    const [stats, authors] = await Promise.all([this.repo.stats(posts.map((p) => p.id)), this.authorsOf(posts)])
    return posts.map((p) => this.cardOf(p, stats.get(p.id) ?? { reactions: { like: 0, love: 0, thanks: 0 }, comments: 0, reads: 0 }, authors))
  }

  /** The post page. `images[]` and `documents[]` use a stable name per position: the original name is not stored (see the deviations log). */
  private async detailOf(post: PostRow, viewer: PerutusanViewer, canWrite: boolean) {
    const [[card], attachments, mine, stats] = await Promise.all([
      this.cards([post]),
      this.repo.attachments(post.id),
      this.repo.myReactions(post.id, viewer.userId),
      this.repo.stats([post.id]),
    ])
    const fileOf = (rows: AttachmentRow[], kind: AttachmentKind) =>
      rows.filter((r) => r.kind === kind).map((r, i) => ({ fileName: `${kind === 'image' ? 'gambar' : 'dokumen'}-${String(i + 1)}.${extensionOf(r.mime)}`, size: r.size }))
    return {
      ...(card as NonNullable<typeof card>),
      body: post.body,
      youtubeEmbedUrl: post.youtubeUrl ? parseVideoUrl(post.youtubeUrl).embedUrl : null,
      images: fileOf(attachments, 'image'),
      documents: fileOf(attachments, 'document'),
      isPublic: post.isPublic,
      // The client adds the origin; only a public published post has a public link.
      publicUrl: post.isPublic && post.status === 'published' ? `/perutusan/awam/${post.id}` : (null as string | null),
      reactions: stats.get(post.id)?.reactions ?? { like: 0, love: 0, thanks: 0 },
      myReactions: mine,
      canWrite,
    }
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
      isTest: who.isTest,
    }
  }
}

const EXTENSIONS: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'application/pdf': 'pdf' }
const extensionOf = (mime: string): string => EXTENSIONS[mime] ?? 'bin'
