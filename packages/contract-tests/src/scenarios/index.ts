import type { ContractIndex } from '../contract-index'
import type { Scenario } from '../runner'
import { authScenarios } from './auth'
import { smokeScenarios } from './smoke'

/**
 * Every scenario of the suite. Every later BE card adds its scenario file here (one file per
 * domain next to this one, spread into the array below).
 */
export function allScenarios(contract: ContractIndex): Scenario[] {
  return [...authScenarios, ...smokeScenarios(contract)]
}

export { authScenarios, smokeScenarios }
