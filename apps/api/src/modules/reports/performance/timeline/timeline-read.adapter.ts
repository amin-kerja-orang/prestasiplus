import { Inject, Injectable } from '@nestjs/common'

import type { TimelinePostView, TimelineReadPort } from '../ports'
import { TIMELINE_POST_CAP, TimelineRepository } from './timeline.repository'

/**
 * The real `TimelineReadPort` (Part A's public profile reads it): the pupil's own non-test posts, newest first,
 * capped at the per-pupil post limit. It adds no rule of its own. The anonymous public profile never lists posts
 * (`posts` is always empty there, FR-MUR-39-4, OQ-API-04); a post is visible to its owner on the timeline only, and its
 * photos follow the file read rule.
 */
@Injectable()
export class TimelineReadAdapter implements TimelineReadPort {
  constructor(@Inject(TimelineRepository) private readonly repo: TimelineRepository) {}

  postsOf(userId: string): Promise<TimelinePostView[]> {
    return this.repo.postsOf(userId, TIMELINE_POST_CAP)
  }
}
