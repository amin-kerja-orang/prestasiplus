import { Inject, Injectable } from '@nestjs/common'
import {
  CONTENT_MESSAGES,
  VIDEO_CATEGORIES,
  VIDEO_MESSAGES,
  VIDEO_PAGE_SIZE_MAX,
  isYoutubeVideoUrl,
  VideoCreateRequestSchema,
  VideoDetailSchema,
  VideoFormContextSchema,
  VideoUpdateRequestSchema,
  type VideoCard,
} from '@pp/contract'
import type { z } from 'zod'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import type { TxClient } from '../../../db/client'
import { isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { SchoolsRepository } from '../../schools'
import { UsersRepository, type UserRecord } from '../../users'
import { FIELD_INVALID, pageOf, queryString, validateBody } from './form-fields'
import { SUBJECT_LOOKUP, type SubjectLookup } from './subject-lookup'
import { parseVideoUrl } from './video-url'
import { VideosRepository, type VideoFilter, type VideoRow, type VideoViewer, type VideoWrite } from './videos.repository'
import {
  CONTENT_FLASH,
  PLATFORM_LABELS,
  ROLE_LABELS,
  SEARCH_MAX,
  UNKNOWN_UPLOADER,
  VIDEO_AUDIT,
  VIDEO_CATEGORY_LABELS,
  VIDEO_PAGE_SIZE,
  WRITE_TX,
} from './videos.constants'

type VideoDetail = z.infer<typeof VideoDetailSchema>
type VideoFormContext = z.infer<typeof VideoFormContextSchema>

/** The signed-in caller and the request facts the audit row needs. */
export interface VideoActor {
  userId: string
  /** The ACTIVE role (Mod Pelajar makes it `student`). */
  role: string
  sessionRowId: string
  scopeLevel: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

export interface VideoListQuery {
  search?: unknown
  category?: unknown
  subject?: unknown
  page?: unknown
  pageSize?: unknown
}

const ALLOWED_HOSTS: ReadonlySet<string> = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com'])

/** https on a known host AND a recognised YouTube or Vimeo link (the parser patterns alone are not anchored to the host). */
export function isAllowedHost(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.username !== '' || u.password !== '' || !ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return false
  } catch {
    return false
  }
  const platform = parseVideoUrl(url).platform
  return platform === 'Youtube' || platform === 'Vimeo'
}

const REQUIRED = ['videoUrl', 'title', 'category'] as const
const TITLE_MAX = 150

const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

/** Exact BM copy of the video form (20 R1-GUR-7) for title, link and category; the teacher link must be a YouTube video link. */
function presetMessages(role: string): (body: Record<string, unknown>) => Record<string, string> {
  return (body) => {
    const fields: Record<string, string> = {}
    if (isBlank(body.title)) fields.title = VIDEO_MESSAGES.titleRequired
    else if (typeof body.title === 'string' && body.title.trim().length > TITLE_MAX) fields.title = VIDEO_MESSAGES.titleTooLong
    if (isBlank(body.videoUrl)) fields.videoUrl = VIDEO_MESSAGES.urlRequired
    else if (role === 'teacher' && (typeof body.videoUrl !== 'string' || !isYoutubeVideoUrl(body.videoUrl))) fields.videoUrl = VIDEO_MESSAGES.urlInvalid
    if (isBlank(body.category)) fields.category = VIDEO_MESSAGES.categoryRequired
    return fields
  }
}


/** A blank optional id is "none"; a number is its decimal text (the mock accepted both). */
function prepareBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body }
  if (typeof out.videoUrl === 'string') out.videoUrl = out.videoUrl.trim()
  const s = out.subjectId
  if (s === '' || (typeof s === 'string' && s.trim() === '')) out.subjectId = null
  else if (typeof s === 'number' && Number.isSafeInteger(s) && s >= 0) out.subjectId = String(s)
  return out
}

/** `pageSize`: a whole number 1..50, anything else is the default page size (never rejected, like `page`). */
function pageSizeOf(raw: string | undefined): number {
  const t = raw?.trim() ?? ''
  const n = /^\d+$/.test(t) ? Number(t) : 0
  return n >= 1 && n <= VIDEO_PAGE_SIZE_MAX ? n : VIDEO_PAGE_SIZE
}

const fieldError = (field: string, message: string): ApiError =>
  ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

@Injectable()
export class VideosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(VideosRepository) private readonly repo: VideosRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SUBJECT_LOOKUP) private readonly subjects: SubjectLookup,
  ) {}

  // --- reads ----------------------------------------------------------------------------------------

  /** GET /videos: public. A guest sees `global`; a signed-in user also their school's videos; admin all. */
  async list(actor: VideoActor | null, q: VideoListQuery) {
    const viewer = await this.viewerOf(actor)
    const search = (queryString(q.search) ?? '').trim().slice(0, SEARCH_MAX)
    const subjectRaw = queryString(q.subject)?.trim()
    const filter: VideoFilter = {
      search,
      category: queryString(q.category)?.trim() ?? '',
      subjectId: subjectRaw !== undefined && isIdString(subjectRaw) ? subjectRaw : null,
    }
    const page = pageOf(queryString(q.page))
    const pageSize = pageSizeOf(queryString(q.pageSize))
    const [{ rows, total }, facets] = await Promise.all([this.repo.list(viewer, filter, page, pageSize), this.repo.facets(viewer, filter)])
    const names = await this.subjects.names(facets.subjects.map((s) => s.subjectId))
    const counts = new Map(facets.categories.map((c) => [c.category, c.count]))
    return {
      data: await this.cards(rows),
      meta: {
        ...listMeta(page, pageSize, total),
        facets: {
          total: facets.total,
          categories: VIDEO_CATEGORIES.map((code) => ({ code, label: VIDEO_CATEGORY_LABELS[code], count: counts.get(code) ?? 0 })),
          subjects: facets.subjects.map((s) => ({ id: s.subjectId, name: names.get(s.subjectId) ?? '', count: s.count })),
        },
      },
    }
  }

  /** GET /videos/:id: the page; `forEdit` returns the same body without counting a view. */
  async detail(actor: VideoActor | null, id: string, forEdit: boolean): Promise<VideoDetail> {
    const viewer = await this.viewerOf(actor)
    const row = await this.repo.findVisible(viewer, id)
    if (!row) throw ApiError.of('NOT_FOUND')
    // BR-M09-07: the response shows the count before this open; the view is counted after it is built.
    const body = await this.detailOf(row, viewer, actor)
    // `for=edit` (the form load) is not counted, but only for someone who can manage the video; anyone else is a normal view.
    if (!(forEdit && body.canManage)) await this.repo.countView(row.id).catch(() => undefined)
    return body
  }

  /** GET /videos/form-context: the uploader and the school the form shows (the account school). */
  async formContext(actor: VideoActor): Promise<VideoFormContext> {
    const user = await this.users.get(actor.userId)
    const school = user?.schoolId ? await this.schools.get(user.schoolId) : null
    return { uploader: this.uploaderOf(user), school: school ? { id: school.id, name: school.name } : null }
  }

  // --- writes ---------------------------------------------------------------------------------------

  /** POST /videos: admin and teacher only (the controller refuses every other role); published at once. */
  async create(actor: VideoActor, raw: unknown): Promise<{ data: VideoDetail; status: string }> {
    const body = validateBody(VideoCreateRequestSchema, raw, REQUIRED, prepareBody, presetMessages(actor.role))
    const data = await this.writeOf(actor, actor.userId, body, null)
    const now = this.clock.now()
    const row = await this.write(async (tx) => {
      const created = await this.repo.create(actor.userId, data, now)
      await this.audit.record({
        tx,
        ...this.auditBase(actor, VIDEO_AUDIT.CREATED),
        targetType: 'video',
        targetId: created.id,
        schoolId: data.schoolId,
        details: { visibility: data.visibility, category: data.category, platform: data.platform },
      })
      return created
    })
    return { data: await this.detailOf(row, await this.viewerOf(actor), actor), status: CONTENT_FLASH.video.created }
  }

  /** PUT /videos/:id: the uploader or an admin. Order as the mock: 404 (invisible), 403, then 422. */
  async update(actor: VideoActor, id: string, raw: unknown): Promise<{ data: VideoDetail; status: string }> {
    const viewer = await this.viewerOf(actor)
    const existing = await this.manageable(viewer, actor, id)
    const body = validateBody(VideoUpdateRequestSchema, raw, REQUIRED, prepareBody, presetMessages(actor.role))
    // BR-M09-21: the school of a shared video is the UPLOADER's, also when an admin edits it.
    const data = await this.writeOf(actor, existing.uploaderId, body, existing)
    const now = this.clock.now()
    const row = await this.write(async (tx) => {
      const updated = await this.repo.update(existing.id, data, now)
      if (!updated) throw ApiError.of('NOT_FOUND')
      await this.audit.record({
        tx,
        ...this.auditBase(actor, VIDEO_AUDIT.UPDATED),
        targetType: 'video',
        targetId: existing.id,
        schoolId: data.schoolId,
        details: { visibility: data.visibility, category: data.category, platform: data.platform, byOwner: existing.uploaderId === actor.userId },
      })
      return updated
    })
    return { data: await this.detailOf(row, viewer, actor), status: CONTENT_FLASH.video.updated }
  }

  /** DELETE /videos/:id: the uploader or an admin; a hard delete. */
  async remove(actor: VideoActor, id: string): Promise<{ data: { deleted: 1 }; status: string }> {
    const viewer = await this.viewerOf(actor)
    const existing = await this.manageable(viewer, actor, id)
    await this.write(async (tx) => {
      if (!(await this.repo.remove(existing.id))) throw ApiError.of('NOT_FOUND')
      await this.audit.record({
        tx,
        ...this.auditBase(actor, VIDEO_AUDIT.DELETED),
        targetType: 'video',
        targetId: existing.id,
        schoolId: existing.schoolId,
        details: { visibility: existing.visibility, byOwner: existing.uploaderId === actor.userId },
      })
    })
    return { data: { deleted: 1 }, status: CONTENT_FLASH.video.deleted }
  }

  // --- helpers --------------------------------------------------------------------------------------

  /** The video when the caller may see it (else 404) and may manage it (else 403). */
  private async manageable(viewer: VideoViewer, actor: VideoActor, id: string): Promise<VideoRow> {
    const row = await this.repo.findVisible(viewer, id)
    if (!row) throw ApiError.of('NOT_FOUND')
    if (!viewer.isAdmin && row.uploaderId !== actor.userId) throw ApiError.of('FORBIDDEN')
    return row
  }

  /**
   * The columns to store. The server decides the visibility by role and ignores any `visibility` in the body: a teacher's video is
   * `school` with the uploader's school (422 under `visibility` when there is none, fail closed); an admin's new video is `global`
   * with no school, and an admin who edits an existing video keeps its stored visibility and school.
   */
  private async writeOf(
    actor: VideoActor,
    uploaderId: string,
    body: z.output<typeof VideoCreateRequestSchema>,
    existing: VideoRow | null,
  ): Promise<VideoWrite> {
    const subjectId = body.subjectId ?? null
    if (subjectId !== null && (!isIdString(subjectId) || !(await this.subjects.exists(subjectId)))) throw fieldError('subjectId', FIELD_INVALID)
    let visibility: VideoWrite['visibility'] = 'global'
    let schoolId: string | null = null
    if (actor.role === 'admin' && existing !== null) {
      visibility = existing.visibility
      schoolId = existing.visibility === 'school' ? existing.schoolId : null
    } else if (actor.role !== 'admin') {
      schoolId = (await this.users.get(uploaderId))?.schoolId ?? null
      if (schoolId === null) throw fieldError('visibility', CONTENT_MESSAGES.videoNoSchool)
      visibility = 'school'
    }
    const parsed = parseVideoUrl(body.videoUrl)
    const description = body.description?.trim() ? body.description : null
    return {
      videoUrl: body.videoUrl,
      platform: parsed.platform,
      externalId: parsed.externalId,
      thumbnailUrl: parsed.thumbnailUrl,
      title: body.title,
      description,
      category: body.category,
      subjectId,
      visibility,
      schoolId,
    }
  }

  private async viewerOf(actor: VideoActor | null): Promise<VideoViewer> {
    if (!actor) return { userId: null, isAdmin: false, schoolId: null }
    const user = await this.users.get(actor.userId)
    return { userId: actor.userId, isAdmin: actor.role === 'admin', schoolId: user?.schoolId ?? null }
  }

  private uploaderOf(user: UserRecord | null) {
    const name = user?.name?.trim() || UNKNOWN_UPLOADER
    return { name, initial: name.charAt(0).toUpperCase(), roleLabel: ROLE_LABELS[user?.roles[0] ?? ''] ?? '' }
  }

  private async cards(rows: readonly VideoRow[]): Promise<VideoCard[]> {
    const uploaders = new Map<string, UserRecord | null>()
    for (const id of new Set(rows.map((r) => r.uploaderId))) uploaders.set(id, await this.users.get(id))
    return rows.map((v) => ({
      id: v.id,
      title: v.title,
      platformLabel: PLATFORM_LABELS[v.platform] ?? v.platform,
      thumbnailUrl: v.thumbnailUrl,
      views: v.views,
      createdAt: toMytTimestamp(v.createdAt),
      uploader: this.uploaderOf(uploaders.get(v.uploaderId) ?? null),
    }))
  }

  private async detailOf(v: VideoRow, viewer: VideoViewer, actor: VideoActor | null): Promise<VideoDetail> {
    const [[card], related, names] = await Promise.all([
      this.cards([v]),
      this.repo.related(viewer, v).then((rows) => this.cards(rows)),
      v.subjectId === null ? Promise.resolve(new Map<string, string>()) : this.subjects.names([v.subjectId]),
    ])
    const name = v.subjectId === null ? undefined : names.get(v.subjectId)
    return {
      ...(card as VideoCard),
      videoUrl: v.videoUrl,
      embedUrl: parseVideoUrl(v.videoUrl).embedUrl,
      platform: v.platform,
      description: v.description,
      category: v.category as VideoDetail['category'],
      categoryLabel: VIDEO_CATEGORY_LABELS[v.category as keyof typeof VIDEO_CATEGORY_LABELS] ?? v.category,
      subject: v.subjectId !== null && name !== undefined ? { id: v.subjectId, name } : null,
      visibility: v.visibility,
      canManage: actor !== null && (viewer.isAdmin || v.uploaderId === actor.userId),
      related,
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

  private auditBase(who: VideoActor, action: string) {
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
