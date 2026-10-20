import { allScenarios, type ContractIndex, type Scenario } from '@pp/contract-tests'

import { accountScenarios } from './account/account'
import { authSessionScenarios } from './auth/session'
import { classesScenarios } from './classes/classes'
import { filesScenarios } from './files/files'
import { notificationsScenarios } from './notifications/notifications'
import { schoolsScenarios } from './schools/schools'
import { usersScenarios } from './users/users'

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
    ...classesScenarios,
  ]
}
