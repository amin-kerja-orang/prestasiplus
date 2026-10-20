import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { VIDEO_PAGE_SIZE, VIDEO_RELATED_LIMIT } from './videos.constants'
import type { VideoPlatform } from './video-url'

export type VideoVisibility = 'global' | 'school'

export interface VideoRow {
  id: string
  videoUrl: string
  platform: VideoPlatform
  externalId: string | null
  thumbnailUrl: string | null
  title: string
  description: string | null
  category: string
  subjectId: string | null
  visibility: VideoVisibility
  schoolId: string | null
  uploaderId: string
  views: number
  createdAt: Date
}

/** Who is looking: a guest has no `userId`; `schoolId` is the school of the account (the mock's video-form school). */
export interface VideoViewer {
  userId: string | null
  isAdmin: boolean
  schoolId: string | null
}

export interface VideoFilter {
  search: string
  category: string
  subjectId: string | null
}

export interface VideoFacetRows {
  total: number
  categories: { category: string; count: number }[]
  subjects: { subjectId: string; count: number }[]
}

export interface VideoWrite {
  videoUrl: string
  platform: VideoPlatform
  externalId: string | null
  thumbnailUrl: string | null
  title: string
  description: string | null
  category: string
  subjectId: string | null
  visibility: VideoVisibility
  schoolId: string | null
}

type Row = Prisma.VideoGetPayload<object>

function toRow(r: Row): VideoRow {
  return {
    id: idToString(r.id),
    videoUrl: r.videoUrl,
    platform: r.platform as VideoPlatform,
    externalId: r.externalId,
    thumbnailUrl: r.thumbnailUrl,
    title: r.title,
    description: r.description,
    category: r.category,
    subjectId: r.subjectId === null ? null : idToString(r.subjectId),
    visibility: r.visibility as VideoVisibility,
    schoolId: r.schoolId === null ? null : idToString(r.schoolId),
    uploaderId: idToString(r.uploaderId),
    views: r.views,
    createdAt: r.createdAt,
  }
}

/** Prisma does not escape the LIKE wildcards of `contains`, so the search term is escaped here: a literal text match. */
const likeEscape = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

const NEWEST: Prisma.VideoOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }]

/**
 * The only doorway to `videos` and `video_schools`. Methods use `prisma.client`, so they join the caller's
 * transaction when there is one. Every read that serves a viewer applies `visibleWhere` (AC 5): an admin sees
 * all; everyone else sees `global` videos, their own, and `school` videos shared with their school.
 */
@Injectable()
export class VideosRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private visibleWhere(viewer: VideoViewer): Prisma.VideoWhereInput {
    if (viewer.isAdmin) return {}
    const or: Prisma.VideoWhereInput[] = [{ visibility: 'global' }]
    if (viewer.userId !== null) or.push({ uploaderId: idFromString(viewer.userId) })
    if (viewer.schoolId !== null && isIdString(viewer.schoolId)) {
      or.push({ visibility: 'school', schools: { some: { schoolId: idFromString(viewer.schoolId) } } })
    }
    return { OR: or }
  }

  private filterWhere(f: { search?: string; category?: string; subjectId?: string | null }): Prisma.VideoWhereInput {
    const and: Prisma.VideoWhereInput[] = []
    if (f.search) and.push({ title: { contains: likeEscape(f.search), mode: 'insensitive' } })
    if (f.category && f.category !== 'all') and.push({ category: f.category })
    if (f.subjectId) and.push({ subjectId: idFromString(f.subjectId) })
    return and.length > 0 ? { AND: and } : {}
  }

  /** One page of the library (24 per page, newest first). */
  async list(viewer: VideoViewer, f: VideoFilter, page: number): Promise<{ rows: VideoRow[]; total: number }> {
    const where: Prisma.VideoWhereInput = { AND: [this.visibleWhere(viewer), this.filterWhere(f)] }
    const [total, rows] = await Promise.all([
      this.prisma.client.video.count({ where }),
      this.prisma.client.video.findMany({ where, orderBy: NEWEST, skip: (page - 1) * VIDEO_PAGE_SIZE, take: VIDEO_PAGE_SIZE }),
    ])
    return { rows: rows.map(toRow), total }
  }

  /** BR-M09-18: "Semua (n)" and the category counts follow search and subject; the subject counts follow search and category. */
  async facets(viewer: VideoViewer, f: VideoFilter): Promise<VideoFacetRows> {
    const visible = this.visibleWhere(viewer)
    const searchOnly = this.filterWhere({ search: f.search })
    const bySubject: Prisma.VideoWhereInput = { AND: [visible, searchOnly, this.filterWhere({ subjectId: f.subjectId })] }
    const byCategory: Prisma.VideoWhereInput = { AND: [visible, searchOnly, this.filterWhere({ category: f.category })] }
    const [total, categories, subjects] = await Promise.all([
      this.prisma.client.video.count({ where: bySubject }),
      this.prisma.client.video.groupBy({ by: ['category'], where: bySubject, _count: { _all: true } }),
      this.prisma.client.video.groupBy({
        by: ['subjectId'],
        where: { AND: [byCategory, { subjectId: { not: null } }] },
        _count: { _all: true },
        orderBy: { subjectId: 'asc' },
      }),
    ])
    return {
      total,
      categories: categories.map((c) => ({ category: c.category, count: c._count._all })),
      subjects: subjects.flatMap((s) =>
        s.subjectId === null || s._count._all < 1 ? [] : [{ subjectId: idToString(s.subjectId), count: s._count._all }],
      ),
    }
  }

  /** The video when it exists AND the viewer may see it, else null (an invisible video is "not found"). */
  async findVisible(viewer: VideoViewer, id: string): Promise<VideoRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.video.findFirst({ where: { AND: [{ id: idFromString(id) }, this.visibleWhere(viewer)] } })
    return row ? toRow(row) : null
  }

  /** BR-M09-20: up to 6 other videos of the same subject, newest id first; a non-admin sees `global` ones only. */
  async related(viewer: VideoViewer, video: VideoRow): Promise<VideoRow[]> {
    if (video.subjectId === null) return []
    const rows = await this.prisma.client.video.findMany({
      where: {
        subjectId: idFromString(video.subjectId),
        id: { not: idFromString(video.id) },
        ...(viewer.isAdmin ? {} : { visibility: 'global' }),
      },
      orderBy: { id: 'desc' },
      take: VIDEO_RELATED_LIMIT,
    })
    return rows.map(toRow)
  }

  /** BR-M09-07: the view is counted after the response is built. A plain increment, so concurrent opens never lose a count. */
  async countView(id: string): Promise<void> {
    await this.prisma.client.$executeRaw`UPDATE videos SET views = views + 1 WHERE id = ${idFromString(id)}`
  }

  /** Inserts the video and, for `school` visibility, the share row of its school. */
  async create(uploaderId: string, data: VideoWrite, now: Date): Promise<VideoRow> {
    const shares =
      data.visibility === 'school' && data.schoolId !== null
        ? { schools: { create: [{ schoolId: idFromString(data.schoolId), createdAt: now, updatedAt: now }] } }
        : {}
    const row = await this.prisma.client.video.create({
      data: { ...this.columns(data), uploaderId: idFromString(uploaderId), views: 0, createdAt: now, updatedAt: now, ...shares },
    })
    return toRow(row)
  }

  /** Updates the video and makes `video_schools` match its visibility (`school`: one row of its school, `global`: none). */
  async update(id: string, data: VideoWrite, now: Date): Promise<VideoRow | null> {
    const videoId = idFromString(id)
    // updateMany: a delete that wins the race gives count 0 (the caller answers 404), not a P2025 error.
    const res = await this.prisma.client.video.updateMany({ where: { id: videoId }, data: { ...this.columns(data), updatedAt: now } })
    if (res.count !== 1) return null
    await this.prisma.client.videoSchool.deleteMany({ where: { videoId } })
    if (data.visibility === 'school' && data.schoolId !== null) {
      await this.prisma.client.videoSchool.create({ data: { videoId, schoolId: idFromString(data.schoolId), createdAt: now, updatedAt: now } })
    }
    const row = await this.prisma.client.video.findUnique({ where: { id: videoId } })
    return row ? toRow(row) : null
  }

  /** Hard delete; the share rows go with it (cascade). False when the video is already gone. */
  async remove(id: string): Promise<boolean> {
    const res = await this.prisma.client.video.deleteMany({ where: { id: idFromString(id) } })
    return res.count === 1
  }

  private columns(d: VideoWrite) {
    return {
      videoUrl: d.videoUrl,
      platform: d.platform,
      externalId: d.externalId,
      thumbnailUrl: d.thumbnailUrl,
      title: d.title,
      description: d.description,
      category: d.category,
      subjectId: d.subjectId === null ? null : idFromString(d.subjectId),
      visibility: d.visibility,
      schoolId: d.visibility === 'school' && d.schoolId !== null ? idFromString(d.schoolId) : null,
    }
  }
}
