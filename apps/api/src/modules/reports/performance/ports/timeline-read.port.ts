/**
 * Read port over the pupil timeline (tables owned by BE-19, Part C: `timeline_posts`, `timeline_post_photos`).
 * The real adapter is bound in `PerformanceModule` by Part C; until then no pupil has a post.
 * Test posts (`is_test`) are never returned.
 */
export type TimelineCategory = 'sijil' | 'pencapaian' | 'aktiviti' | 'cerita' | 'lain'

export interface TimelinePostView {
  id: string
  userId: string
  title: string
  category: TimelineCategory
  /** yyyy-mm-dd or null. */
  eventDate: string | null
  story: string | null
  /** `url` is `/api/files/{publicId}`. */
  photos: { url: string; caption: string | null }[]
  createdAt: Date
}

export interface TimelineReadPort {
  /** Newest first, capped by the adapter. */
  postsOf(userId: string): Promise<TimelinePostView[]>
}

export const TIMELINE_READ_PORT = Symbol('TIMELINE_READ_PORT')

export class EmptyTimelineRead implements TimelineReadPort {
  async postsOf(): Promise<TimelinePostView[]> {
    return []
  }
}
