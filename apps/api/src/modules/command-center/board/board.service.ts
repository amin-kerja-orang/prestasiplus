import { Inject, Injectable } from '@nestjs/common'
import type { CommandCenterDailyActivity, CommandCenterLiveData, CommandCenterSchoolDrill, ServerStatus } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { notImplemented } from '../http/errors'
import type { Viewer } from '../http/viewer'
import { CommandCenterRepository } from '../shared/command-center.repository'
import { ScopeService } from '../shared/scope.service'
import { ServerStatusService } from './server-status.service'

/**
 * BOARD slice (routes 1, 2, 3, 18). OWNER: board implementer. Everything shared is injected (repository, scope, clock, ports);
 * add builders as `board/*.builder.ts` files rather than editing `shared/*`.
 */
@Injectable()
export class BoardService {
  constructor(
    @Inject(CommandCenterRepository) readonly repo: CommandCenterRepository,
    @Inject(ScopeService) readonly scope: ScopeService,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(ServerStatusService) private readonly host: ServerStatusService,
  ) {}

  /** GET /admin/command-center/live-data. `viewer.role` is admin (platform) or school_admin (viewer.schoolId, from the session). */
  async liveData(viewer: Viewer): Promise<CommandCenterLiveData> {
    void viewer
    return notImplemented('GET /admin/command-center/live-data')
  }

  /** GET /command-center/daily-activity. `period` is the raw query text (any text; unknown = today; echo the raw value). */
  async dailyActivity(viewer: Viewer, period: string | undefined): Promise<CommandCenterDailyActivity> {
    void viewer
    void period
    return notImplemented('GET /command-center/daily-activity')
  }

  /** GET /command-center/daily-activity/school/:id (admin only; unknown school 404). */
  async schoolDrill(viewer: Viewer, schoolId: string, period: string | undefined): Promise<CommandCenterSchoolDrill> {
    void viewer
    void schoolId
    void period
    return notImplemented('GET /command-center/daily-activity/school/:id')
  }

  /** GET /admin/server-status (implemented by the skeleton). */
  serverStatus(): Promise<ServerStatus> {
    return this.host.status()
  }
}
