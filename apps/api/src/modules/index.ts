import type { Type } from '@nestjs/common'

import { AccountModule } from './account'
import { AuthModule } from './auth'
import { ContentArticlesModule } from './content/articles'
import { AudioKbatModule } from './content/audio'
import { SupportModule } from './support'
import { PerutusanModule } from './content/perutusan'
import { VideosModule } from './content/videos'
import { ParentsModule } from './parents'
import { FilesModule } from './files'
import { NotificationsModule } from './notifications'
import { SchoolsModule } from './schools'
import { SubscriptionsModule } from './subscriptions'
import { UsersModule } from './users'
import { CurriculumModule } from './curriculum'
import { QuestionsModule } from './questions'
import { WalletModule } from './wallet'
import { QuestionWorkflowModule } from './questions/workflow'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 *
 * Exception: `QuestionWorkflowModule` (BE-10) sits BEFORE `QuestionsModule` (BE-09) on purpose. Routes are
 * registered in module order, and BE-09's `GET /guru/questions/:id` would otherwise shadow BE-10's static
 * `GET /guru/questions/template` (404). `test/questions-workflow/wired-bank.spec.ts` guards the order.
 */
export const featureModules: Type<unknown>[] = [AuthModule, SchoolsModule, UsersModule, FilesModule, ParentsModule, SubscriptionsModule, NotificationsModule, AccountModule, CurriculumModule, QuestionWorkflowModule, QuestionsModule, WalletModule, AudioKbatModule, SupportModule, VideosModule, PerutusanModule, ContentArticlesModule]
