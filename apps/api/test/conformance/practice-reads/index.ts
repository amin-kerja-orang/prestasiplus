import type { Scenario } from '@pp/contract-tests'

import { practiceReadsAnalyticsScenarios } from './analytics'
import { practiceReadsOverviewScenarios } from './overview'
import { practiceReadsWritesScenarios } from './writes'

/** BE-13 practice read models: every route of `packages/contract/src/practice/reads`. */
export const practiceReadsScenarios: Scenario[] = [
  ...practiceReadsOverviewScenarios,
  ...practiceReadsAnalyticsScenarios,
  ...practiceReadsWritesScenarios,
]
