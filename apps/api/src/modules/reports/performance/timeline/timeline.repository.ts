import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import type { TimelineCategory, TimelinePostView } from '../ports'

/** The purpose of the `files` rows a post points at (BE-04, read by any signed-in user, OQ-5). */
export const TIMELINE_PHOTO_PURPOSE = 'timeline_photo'

/** Most posts a pupil may keep. A pupil over it must delete older ones (a later card); the API refuses more. */
export const TIMELINE_POST_CAP = 200

export interface NewTimelinePost {
  userId: string
  title: string
  category: TimelineCategory
  /** yyyy-mm-dd or null. */
  eventDate: string | null
  story: string | null
  isTest: boolean
  now: Date
  /** Internal file ids (decimal strings), in display order, with their captions. */
  photos: { fileId: string; caption: string | null }[]
}

const dateOnly = (d: Date | null): string | null => (d === null ? null : d.toISOString().slice(0, 10))

/**
 * Tables `timeline_posts` and `timeline_post_photos` (migration 0030). Parameterised Prisma calls only; a
 * photo is shown only when its file really has the `timeline_photo` purpose (a foreign file id can never leak a
 * private file through a post). Test posts (`is_test`) are never listed. Runs on `prisma.client`, so it joins
 * the transaction a service opened.
 */
@Injectable()
export class TimelineRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The newest posts of `userId` (never test posts), newest first, with photo urls. Three statements. */
  async postsOf(userId: string, limit: number): Promise<TimelinePostView[]> {
    const db = this.prisma.client
    const posts = await db.timelinePost.findMany({
      where: { userId: idFromString(userId), isTest: false },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return this.withPhotos(posts)
  }

  /** Number of posts the pupil holds (test posts count too: they take rows). */
  async countOf(userId: string): Promise<number> {
    return this.prisma.client.timelinePost.count({ where: { userId: idFromString(userId) } })
  }

  /** Serialises the per-pupil cap check: one writer per pupil at a time inside the transaction. */
  async lockPupil(userId: string): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'timeline:' + userId}))`
  }

  /** Inserts the post and its photos (call inside a transaction). Returns the stored post. */
  async create(input: NewTimelinePost): Promise<TimelinePostView> {
    const db = this.prisma.client
    const row = await db.timelinePost.create({
      data: {
        userId: idFromString(input.userId),
        title: input.title,
        category: input.category,
        eventDate: input.eventDate === null ? null : new Date(`${input.eventDate}T00:00:00.000Z`),
        story: input.story,
        isTest: input.isTest,
        createdAt: input.now,
        updatedAt: input.now,
      },
    })
    if (input.photos.length > 0) {
      await db.timelinePostPhoto.createMany({
        data: input.photos.map((p, position) => ({
          postId: row.id,
          fileId: idFromString(p.fileId),
          caption: p.caption,
          position,
        })),
      })
    }
    const [view] = await this.withPhotos([row])
    return view as TimelinePostView
  }

  private async withPhotos(
    posts: readonly {
      id: bigint
      userId: bigint
      title: string
      category: string
      eventDate: Date | null
      story: string | null
      createdAt: Date
    }[],
  ): Promise<TimelinePostView[]> {
    if (posts.length === 0) return []
    const db = this.prisma.client
    const photos = await db.timelinePostPhoto.findMany({
      where: { postId: { in: posts.map((p) => p.id) } },
      orderBy: [{ postId: 'asc' }, { position: 'asc' }],
    })
    const files =
      photos.length === 0
        ? []
        : await db.file.findMany({
            where: { id: { in: [...new Set(photos.map((p) => p.fileId))] }, purpose: TIMELINE_PHOTO_PURPOSE },
            select: { id: true, publicId: true },
          })
    const publicOf = new Map(files.map((f) => [f.id, f.publicId]))
    const byPost = new Map<bigint, { url: string; caption: string | null }[]>()
    for (const p of photos) {
      const publicId = publicOf.get(p.fileId)
      if (publicId === undefined) continue
      const list = byPost.get(p.postId) ?? []
      list.push({ url: `/api/files/${publicId}`, caption: p.caption })
      byPost.set(p.postId, list)
    }
    return posts.map((p) => ({
      id: idToString(p.id),
      userId: idToString(p.userId),
      title: p.title,
      category: p.category as TimelineCategory,
      eventDate: dateOnly(p.eventDate),
      story: p.story,
      photos: byPost.get(p.id) ?? [],
      createdAt: p.createdAt,
    }))
  }
}
