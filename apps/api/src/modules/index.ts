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
import { ClassesModule } from './classes'
import { BijakPapersModule } from './bijak/papers'
import { BijakAttemptsModule } from './bijak/attempts'
import { PracticeModule } from './practice'
import { BijakIntegrationModule } from './bijak/integration'
import { MissionsModule } from './classes/missions'
import { QuestionSetsModule } from './classes/question-sets'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 */
export const featureModules: Type<unknown>[] = [AuthModule, SchoolsModule, UsersModule, FilesModule, ParentsModule, SubscriptionsModule, NotificationsModule, AccountModule, CurriculumModule, QuestionsModule, WalletModule, AudioKbatModule, SupportModule, VideosModule, PerutusanModule, ContentArticlesModule, ClassesModule, BijakPapersModule, BijakAttemptsModule, PracticeModule, BijakIntegrationModule, QuestionSetsModule, MissionsModule]
