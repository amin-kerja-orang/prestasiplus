import { Inject, Injectable } from '@nestjs/common'
import type {
  CommandCenterGuruAchievements,
  CommandCenterGuruBadgeHolders,
  CommandCenterGuruDrill,
  CommandCenterGuruEvaluation,
  CommandCenterGuruLiveData,
  CommandCenterGuruPredictive,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { notImplemented } from '../http/errors'
import type { CommandCenterGuruDrillType } from '../http/request'
import type { Viewer } from '../http/viewer'
import { CommandCenterRepository } from '../shared/command-center.repository'
import { BADGE_READ_PORT, type BadgeReadPort, FEEDBACK_PORT, type FeedbackReadPort, HEADCOUNT_PORT, type HeadcountReadPort, MOOD_PORT, type MoodReadPort } from '../shared/ports'
import { ScopeService } from '../shared/scope.service'

/**
 * GURU slice (routes 12 to 17). OWNER: guru implementer. The viewer set S is `repo.teacherStudentIds(viewer.userId)`
 * (active non-test members of the viewer's active classrooms). Windows: `guruWindows(clock.now())` from `shared/windows.ts`
 * (week = 7 calendar days). Bodies are bare (no `{ data }`). Add builders as `guru/*.builder.ts`.
 */
@Injectable()
export class GuruService {
  constructor(
    @Inject(CommandCenterRepository) readonly repo: CommandCenterRepository,
    @Inject(ScopeService) readonly scopes: ScopeService,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(MOOD_PORT) readonly mood: MoodReadPort,
    @Inject(FEEDBACK_PORT) readonly feedback: FeedbackReadPort,
    @Inject(HEADCOUNT_PORT) readonly headcount: HeadcountReadPort,
    @Inject(BADGE_READ_PORT) readonly badges: BadgeReadPort,
  ) {}

  async liveData(viewer: Viewer): Promise<CommandCenterGuruLiveData> {
    void viewer
    return notImplemented('GET /guru/command-center/live-data')
  }

  /** `type` and `filter` are already validated by `guruDrillQueryOf` (422 texts). */
  async drill(viewer: Viewer, type: CommandCenterGuruDrillType, filter: string): Promise<CommandCenterGuruDrill> {
    void viewer
    void type
    void filter
    return notImplemented('GET /guru/command-center/drill')
  }

  async evaluate(viewer: Viewer): Promise<CommandCenterGuruEvaluation> {
    void viewer
    return notImplemented('GET /guru/command-center/evaluate')
  }

  async predictive(viewer: Viewer): Promise<CommandCenterGuruPredictive> {
    void viewer
    return notImplemented('GET /guru/command-center/predictive')
  }

  async achievements(viewer: Viewer): Promise<CommandCenterGuruAchievements> {
    void viewer
    return notImplemented('GET /guru/command-center/achievements')
  }

  /** `badgeId` is already validated (422 "Lencana tidak sah."); an unknown badge is 404 with the message "Lencana tidak dijumpai.". */
  async badgeHolders(viewer: Viewer, badgeId: string): Promise<CommandCenterGuruBadgeHolders> {
    void viewer
    void badgeId
    return notImplemented('GET /guru/command-center/badge-holders')
  }
}
