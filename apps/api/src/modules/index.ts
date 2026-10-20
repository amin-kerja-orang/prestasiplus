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
import { BijakPapersModule } from './bijak/papers'
import { WalletModule } from './wallet'
import { BijakAttemptsModule } from './bijak/attempts'
import { PracticeModule } from './practice'
import { BijakIntegrationModule } from './bijak/integration'
import { QuestionWorkflowModule } from './questions/workflow'
import { ClassesModule } from './classes'
import { PerformanceModule } from './reports/performance'
import { SchoolAdminModule } from './school-admin'
import { ExamBuilderModule } from './exam/builder'
import { ExamBlueprintsModule } from './exam/blueprints'
import { GamificationModule } from './gamification'
import { ShopModule } from './shop'
import { IntakeFilesModule } from './intake/files'
import { MissionsModule } from './classes/missions'
import { QuestionSetsModule } from './classes/question-sets'
import { PracticeReadsModule } from './practice/reads'
import { KirkpatrickModule } from './reports/kirkpatrick'
import { AnalyticsReportsModule } from './reports/analytics'
import { HeatmapModule } from './heatmap'
import { IntakeDashboardModule } from './intake/dashboard'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 * ORDER NOTE: `QuestionWorkflowModule` is listed BEFORE `QuestionsModule` on purpose: routes register in
 * module order, and BE-09's `GET /guru/questions/:id` would otherwise capture BE-10's
 * `GET /guru/questions/template`. Keep it there.
 */
export const featureModules: Type<unknown>[] = [AuthModule, SchoolsModule, UsersModule, FilesModule, ParentsModule, SubscriptionsModule, NotificationsModule, AccountModule, CurriculumModule, QuestionWorkflowModule, QuestionsModule, WalletModule, AudioKbatModule, SupportModule, VideosModule, PerutusanModule, ContentArticlesModule, BijakPapersModule, BijakAttemptsModule, PracticeModule, BijakIntegrationModule, ClassesModule, PerformanceModule, SchoolAdminModule, ExamBuilderModule, ExamBlueprintsModule, GamificationModule, ShopModule, IntakeFilesModule, QuestionSetsModule, MissionsModule, PracticeReadsModule, KirkpatrickModule, AnalyticsReportsModule, HeatmapModule, IntakeDashboardModule]
