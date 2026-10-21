import { Inject, Injectable } from '@nestjs/common'
import { PERFORMANCE_TIMELINE_MESSAGES } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { PrismaService } from '../../../../db/prisma.service'
import { FilesService, type StoredFile } from '../../../files'
import type { TimelinePostView } from '../ports'
import type { Ctx, PerformanceTimelinePost } from '../services/types'
import { TIMELINE_PHOTO_PURPOSE, TIMELINE_POST_CAP, TimelineRepository } from './timeline.repository'
import { summarizeFields, validateTimelineInput, type RawPhoto } from './timeline.validation'

/** Shown when a pupil already holds the most posts allowed (no contract copy exists; deviation row). */
export const TIMELINE_CAP_MESSAGE = `Anda telah mencapai had ${String(TIMELINE_POST_CAP)} catatan garis masa.`

export const toWireTimelinePost = (p: TimelinePostView): PerformanceTimelinePost => ({
  id: p.id,
  userId: p.userId,
  title: p.title,
  category: p.category,
  eventDate: p.eventDate,
  story: p.story,
  photos: p.photos.map((x) => ({ url: x.url, caption: x.caption })),
  createdAt: toMytTimestamp(p.createdAt),
})

const invalid = (fields: Record<string, string>): ApiError =>
  ApiError.of('VALIDATION_ERROR', { fields, message: summarizeFields(fields) })

/** Who may write a post: a student, or an admin acting as a student in Mod Pelajar (OQ-6). */
export function mayPost(ctx: Pick<Ctx, 'role' | 'isTest'>): boolean {
  return ctx.role === 'student' || (ctx.role === 'admin' && ctx.isTest)
}

/**
 * The pupil timeline (S16, S17). A viewer sees only their OWN posts (there is no way to ask for another user's);
 * test posts are never listed. A post is written under the session's user id, never one from the body. Captions and
 * stories are personal content and are never logged. Photos are stored through the file service (type from the bytes,
 * EXIF removed) with the `timeline_photo` purpose; if the database write fails the stored files are removed again.
 */
@Injectable()
export class TimelineService {
  constructor(
    @Inject(TimelineRepository) private readonly repo: TimelineRepository,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async mine(ctx: Ctx): Promise<{ profileUrl: string; posts: PerformanceTimelinePost[] }> {
    const posts = await this.repo.postsOf(ctx.userId, TIMELINE_POST_CAP)
    return { profileUrl: `/pelajar/${ctx.userId}`, posts: posts.map(toWireTimelinePost) }
  }

  async create(ctx: Ctx, body: unknown, photos: readonly RawPhoto[]): Promise<PerformanceTimelinePost> {
    if (!mayPost(ctx)) throw ApiError.of('FORBIDDEN')
    const checked = validateTimelineInput(body, photos)
    if (!checked.ok) throw invalid(checked.fields)
    const input = checked.value
    // Cheap early refusal before any file is stored; the locked re-check below is the one that holds.
    if ((await this.repo.countOf(ctx.userId)) >= TIMELINE_POST_CAP) throw invalid({ posts: TIMELINE_CAP_MESSAGE })

    const stored: StoredFile[] = []
    try {
      for (const photo of input.photos) {
        try {
          stored.push(
            await this.files.storeManaged({ ownerUserId: ctx.userId, purpose: 'timeline_photo', bytes: photo.bytes, isTest: ctx.isTest }),
          )
        } catch (err) {
          // The file service refuses a container that does not parse with 422 `fields.file`: same answer as a wrong type.
          if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') throw invalid({ photos: PERFORMANCE_TIMELINE_MESSAGES.photoInvalid })
          throw err
        }
      }
      const view = await this.prisma.transaction(async () => {
        await this.repo.lockPupil(ctx.userId)
        if ((await this.repo.countOf(ctx.userId)) >= TIMELINE_POST_CAP) throw invalid({ posts: TIMELINE_CAP_MESSAGE })
        return this.repo.create({
          userId: ctx.userId,
          title: input.title,
          category: input.category,
          eventDate: input.eventDate,
          story: input.story,
          isTest: ctx.isTest,
          now: this.clock.now(),
          photos: stored.map((s, i) => ({ fileId: s.id, caption: input.photos[i]?.caption ?? null })),
        })
      })
      return toWireTimelinePost(view)
    } catch (err) {
      await Promise.all(stored.map((s) => this.files.discard(s.publicId, TIMELINE_PHOTO_PURPOSE)))
      throw err
    }
  }
}
