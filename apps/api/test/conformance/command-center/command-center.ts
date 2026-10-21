import type { Scenario } from '@pp/contract-tests'

import { commandCenterBoardScenarios } from './board'
import { drillScenarios } from './drill'
import { commandCenterGuruScenarios } from './guru'

/** BE-22: every Command Center scenario (board, drill-down, teacher view). */
export const commandCenterScenarios: Scenario[] = [
  ...commandCenterBoardScenarios,
  ...drillScenarios,
  ...commandCenterGuruScenarios,
]
