import { Inject, Injectable } from '@nestjs/common'
import { PERFORMANCE_TIMELINE_MESSAGES } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { PrismaService } from '../../../../db/prisma.service'
import { FilesService, type StoredFile } from '../../../files'
import { SESSION_MODES } from '../domain/constants'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort, type TimelinePostView } from '../ports'
import type { Ctx, PerformanceTimelineEntry, PerformanceTimelinePost } from '../services/types'
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

/** The feed shows at most this many rows: the latest of each source, merged, then cut (DOC DEFECT 5). */
export const TIMELINE_FEED_LIMIT = 100

const KIND_ORDER = { badge: 0, post: 1, session: 2 } as const

/** Newest first; a tie goes to the kind (badge, post, session), then to the id, so the order never depends on the source. */
export function compareEntries(a: PerformanceTimelineEntry, b: PerformanceTimelineEntry): number {
  const t = Date.parse(b.at) - Date.parse(a.at)
  if (t !== 0) return t
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

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
    @Inject(PerformancePorts) private readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) private readonly directory: DirectoryPort,
  ) {}

  /**
   * The caller's own feed (R1-MUR-39): finished practice sessions (game modes never), badges earned and own manual posts.
   * Everything is read for `ctx.userId` only; there is no id parameter. The latest 100 of each source are merged newest
   * first and cut at 100. A post is placed by its `createdAt` (a back-dated event date is shown on the card, not used for order).
   */
  async mine(ctx: Ctx): Promise<{ profileUrl: string; posts: PerformanceTimelinePost[]; entries: PerformanceTimelineEntry[] }> {
    const [posts, sessions, badges] = await Promise.all([
      this.repo.postsOf(ctx.userId, TIMELINE_POST_CAP),
      this.ports.answerFacts.sessionFacts({ userIds: [ctx.userId], modes: SESSION_MODES, limit: TIMELINE_FEED_LIMIT }),
      this.ports.gamification.badges(ctx.userId),
    ])
    const subjects = await this.directory.subjectsOfIds([...new Set(sessions.map((s) => s.subjectId))])
    const wirePosts = posts.map(toWireTimelinePost)
    const entries: PerformanceTimelineEntry[] = [
      ...sessions
        .filter((s) => s.userId === ctx.userId && s.answered > 0)
        .map((s): PerformanceTimelineEntry => ({
          kind: 'session',
          id: s.sessionKey,
          at: toMytTimestamp(s.finishedAt),
          subjectName: subjects.get(s.subjectId)?.name ?? '',
          correct: s.correct,
          answered: s.answered,
          accuracy: Math.round((s.correct / s.answered) * 100),
        })),
      ...[...badges]
        .sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
        .slice(0, TIMELINE_FEED_LIMIT)
        .map((b): PerformanceTimelineEntry => ({ kind: 'badge', id: `b:${b.key}`, at: toMytTimestamp(b.earnedAt), name: b.name, icon: b.icon })),
      ...[...wirePosts]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, TIMELINE_FEED_LIMIT)
        .map((post): PerformanceTimelineEntry => ({ kind: 'post', id: post.id, at: post.createdAt, post })),
    ]
    entries.sort(compareEntries)
    return { profileUrl: `/pelajar/${ctx.userId}`, posts: wirePosts, entries: entries.slice(0, TIMELINE_FEED_LIMIT) }
  }

  /**
   * Deletes the caller's own post (API-RPT-15). Another user's post, a test/real mismatch and an unknown id are the same
   * 404. The photo files are discarded after the commit (a failed discard never fails the delete: the file service logs it).
   */
  async remove(ctx: Ctx, id: string): Promise<{ deleted: 1 }> {
    if (!mayPost(ctx)) throw ApiError.of('FORBIDDEN')
    const removed = await this.prisma.transaction(async () => this.repo.remove(ctx.userId, id, ctx.isTest))
    if (!removed) throw ApiError.of('NOT_FOUND')
    await Promise.all(removed.filePublicIds.map((publicId) => this.files.discard(publicId, TIMELINE_PHOTO_PURPOSE)))
    return { deleted: 1 }
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
