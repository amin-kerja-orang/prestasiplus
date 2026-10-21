import { Inject, Injectable } from '@nestjs/common'

import type { TimelinePostView, TimelineReadPort } from '../ports'
import { TIMELINE_POST_CAP, TimelineRepository } from './timeline.repository'

/**
 * The real `TimelineReadPort` (Part A's public profile reads it): the pupil's own non-test posts, newest first,
 * capped at the per-pupil post limit. It adds no rule of its own; who may see the posts is decided by the caller
 * (the profile lists them only to a signed-in viewer) and by the file read rule of the photos.
 */
@Injectable()
export class TimelineReadAdapter implements TimelineReadPort {
  constructor(@Inject(TimelineRepository) private readonly repo: TimelineRepository) {}

  postsOf(userId: string): Promise<TimelinePostView[]> {
    return this.repo.postsOf(userId, TIMELINE_POST_CAP)
  }
}
