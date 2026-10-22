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
import type { CommandCenterGuruDrillType } from '../http/request'
import type { Viewer } from '../http/viewer'
import { CommandCenterRepository } from '../shared/command-center.repository'
import { BADGE_READ_PORT, type BadgeReadPort, FEEDBACK_PORT, type FeedbackReadPort, HEADCOUNT_PORT, type HeadcountReadPort, MOOD_PORT, type MoodReadPort } from '../shared/ports'
import { ScopeService } from '../shared/scope.service'
import { buildAchievements, buildBadgeHolders } from './achievements.builder'
import { buildEvaluation, buildPredictive } from './analysis.builder'
import { type GuruDeps, loadContext } from './context'
import { buildDrill } from './drill.builder'
import { buildLiveData } from './live-data.builder'

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

  private deps(): GuruDeps {
    return { repo: this.repo, mood: this.mood, feedback: this.feedback, headcount: this.headcount, badges: this.badges }
  }

  private async context(viewer: Viewer) {
    const deps = this.deps()
    return { deps, ctx: await loadContext(deps, viewer, this.clock.now()) }
  }

  async liveData(viewer: Viewer): Promise<CommandCenterGuruLiveData> {
    const { deps, ctx } = await this.context(viewer)
    return buildLiveData(deps, ctx)
  }

  /** `type` and `filter` are already validated by `guruDrillQueryOf` (422 texts). */
  async drill(viewer: Viewer, type: CommandCenterGuruDrillType, filter: string): Promise<CommandCenterGuruDrill> {
    const { deps, ctx } = await this.context(viewer)
    return buildDrill(deps, ctx, type, filter)
  }

  async evaluate(viewer: Viewer): Promise<CommandCenterGuruEvaluation> {
    const { deps, ctx } = await this.context(viewer)
    return buildEvaluation(deps, ctx)
  }

  async predictive(viewer: Viewer): Promise<CommandCenterGuruPredictive> {
    const { deps, ctx } = await this.context(viewer)
    return buildPredictive(deps, ctx)
  }

  async achievements(viewer: Viewer): Promise<CommandCenterGuruAchievements> {
    const { deps, ctx } = await this.context(viewer)
    return buildAchievements(deps, ctx)
  }

  /** `badgeId` is already validated (422 "Lencana tidak sah."); an unknown badge is 404 with the message "Lencana tidak dijumpai.". */
  async badgeHolders(viewer: Viewer, badgeId: string): Promise<CommandCenterGuruBadgeHolders> {
    const { deps, ctx } = await this.context(viewer)
    return buildBadgeHolders(deps, ctx, badgeId)
  }
}
