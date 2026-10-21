import { allScenarios, type ContractIndex, type Scenario } from '@pp/contract-tests'

import { accountScenarios } from './account/account'
import { authSessionScenarios } from './auth/session'
import { bijakAttemptsScenarios } from './bijak/attempts'
import { bijakIntegrationScenarios } from './bijak/integration'
import { bijakBuilderScenarios } from './bijak-builder/builder'
import { articleScenarios } from './content/articles'
import { audioScenarios } from './content/audio'
import { perutusanScenarios } from './content/perutusan'
import { videosScenarios } from './content/videos'
import { bijakPapersScenarios } from './bijak/papers'
import { classesScenarios } from './classes/classes'
import { filesScenarios } from './files/files'
import { intakeScenarios } from './intake/intake'
import { missionsScenarios } from './missions/missions'
import { questionSetsScenarios } from './missions/question-sets'
import { notificationsScenarios } from './notifications/notifications'
import { practiceScenarios } from './practice/practice'
import { questionsScenarios } from './questions/questions'
import { performanceScenarios } from './performance/performance'
import { schoolAdminScenarios } from './school-admin/school-admin'
import { schoolsScenarios } from './schools/schools'
import { supportTicketScenarios } from './support/tickets'
import { usersScenarios } from './users/users'
import { walletScenarios } from './wallet/wallet'
import { questionsWorkflowScenarios } from './questions-workflow/questions-workflow'
import { gamificationScenarios } from './gamification/gamification'
import { shopScenarios } from './gamification/shop'
import { practiceReadsScenarios } from './practice-reads'
import { kirkpatrickScenarios } from './analytics/kirkpatrick'
import { analyticsScenarios } from './analytics/analytics'
import { heatmapScenarios } from './heatmap/heatmap'
import { intakeDashboardScenarios } from './intake/dashboard'
import { cikguScenarios } from './cikgu/cikgu'
import { commandCenterScenarios } from './command-center/command-center'
import { securityScenarios } from './security/security'

/**
 * Every scenario the API run executes: the shared scenarios of `@pp/contract-tests` (the same ones
 * the mock runs) plus the API-only deep scenarios of each domain. A domain card adds one import and
 * one spread line here and its scenario file in `./<domain>/`.
 */
export function apiScenarios(contract: ContractIndex): Scenario[] {
  return [
    ...allScenarios(contract),
    ...authSessionScenarios,
    ...usersScenarios,
    ...schoolsScenarios,
    ...filesScenarios,
    ...accountScenarios,
    ...notificationsScenarios,
    ...questionsScenarios,
    ...walletScenarios,
    ...audioScenarios,
    ...articleScenarios,
    ...supportTicketScenarios,
    ...videosScenarios,
    ...perutusanScenarios,
    ...bijakPapersScenarios,
    ...bijakAttemptsScenarios,
    ...practiceScenarios,
    ...bijakIntegrationScenarios,
    ...questionsWorkflowScenarios,
    ...classesScenarios,
    ...performanceScenarios,
    ...schoolAdminScenarios,
    ...bijakBuilderScenarios,
    ...gamificationScenarios,
    ...shopScenarios,
    ...intakeScenarios,
    ...missionsScenarios,
    ...questionSetsScenarios,
    ...practiceReadsScenarios,
    ...kirkpatrickScenarios,
    ...analyticsScenarios,
    ...heatmapScenarios,
    ...intakeDashboardScenarios,
    ...cikguScenarios,
    ...commandCenterScenarios,
    ...securityScenarios,
  ]
}
