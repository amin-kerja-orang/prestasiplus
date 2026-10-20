import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { SchoolsModule } from '../schools'
import { UsersModule } from '../users'
import { BoardReads } from './board/reads'
import { BoardController } from './board/board.controller'
import { BoardService } from './board/board.service'
import { nodeProbe, OS_PROBE, ServerStatusService } from './board/server-status.service'
import { DrillController } from './drill/drill.controller'
import { DrillReads } from './drill/reads'
import { DrillService } from './drill/drill.service'
import { GuruController } from './guru/guru.controller'
import { GuruService } from './guru/guru.service'
import { CommandCenterRepository } from './shared/command-center.repository'
import { BADGE_READ_PORT, FEEDBACK_PORT, HEADCOUNT_PORT, MOOD_PORT, NoBadges, NoFeedback, NoHeadcount, NoMood, NoQuizSets, QUIZ_SET_PORT } from './shared/ports'
import { ScopeService } from './shared/scope.service'

/**
 * BE-22: the Command Center (admin/school board, drill-down, teacher view) and the server-status pill. No tables of its own and no
 * migration: the cross-user tallies are read-only SQL in three DI
 * providers (`CommandCenterRepository`, `BoardReads`, `DrillReads`); simple user and school lookups use the owner repositories. Data owned by cards not merged yet (mood,
 * Kirkpatrick T1 feedback, headcount/GPS, learner badges, question sets) comes through fail-closed ports whose defaults answer
 * empty/zero/null, so every route keeps a valid shape; the owner binds a real adapter with `{ provide: X_PORT, useClass: ... }`.
 */
@Module({
  imports: [ThrottleModule, UsersModule, SchoolsModule],
  controllers: [BoardController, DrillController, GuruController],
  providers: [
    CommandCenterRepository,
    BoardReads,
    DrillReads,
    ScopeService,
    { provide: OS_PROBE, useValue: nodeProbe },
    ServerStatusService,
    BoardService,
    DrillService,
    GuruService,
    { provide: MOOD_PORT, useClass: NoMood },
    { provide: FEEDBACK_PORT, useClass: NoFeedback },
    { provide: HEADCOUNT_PORT, useClass: NoHeadcount },
    { provide: BADGE_READ_PORT, useClass: NoBadges },
    { provide: QUIZ_SET_PORT, useClass: NoQuizSets },
  ],
})
export class CommandCenterModule {}
