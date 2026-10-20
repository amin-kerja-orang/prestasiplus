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
import { QuestionWorkflowModule } from './questions/workflow'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 */
export const featureModules: Type<unknown>[] = [AuthModule, SchoolsModule, UsersModule, FilesModule, ParentsModule, SubscriptionsModule, NotificationsModule, AccountModule, CurriculumModule, AudioKbatModule, SupportModule, VideosModule, PerutusanModule, ContentArticlesModule, QuestionWorkflowModule]
