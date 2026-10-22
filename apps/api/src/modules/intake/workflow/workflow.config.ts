import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { INTAKE_CONFIDENCE_BANDS, type IntakeConfidenceBand } from '@pp/contract'

function intOr(value: unknown, fallback: number, min = 1): number {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isInteger(n) && n >= min ? n : fallback
}

/**
 * Settings of the intake workflow (BE-38), read untyped so the env schema does not have to list them:
 *  - `INTAKE_BULK_ACCEPT_MIN_BAND` (`high`): the lowest confidence band a bulk accept takes (card open question 2);
 *  - `INTAKE_EXTRACT_BUDGET_RECHECK_SECONDS` (300): how often a run that waits for the AI budget looks again;
 *  - `INTAKE_DUPLICATE_SCAN_LIMIT` (5000): bank questions of the subject read for the duplicate check;
 *  - `INTAKE_MAX_ITEMS_PER_BATCH` (500).
 */
@Injectable()
export class IntakeWorkflowConfig {
  readonly bulkAcceptMinBand: IntakeConfidenceBand
  readonly budgetRecheckSeconds: number
  readonly duplicateScanLimit: number
  readonly maxItemsPerBatch: number

  constructor(@Inject(ConfigService) config: ConfigService) {
    const band = String(config.get('INTAKE_BULK_ACCEPT_MIN_BAND') ?? '').trim().toLowerCase()
    this.bulkAcceptMinBand = (INTAKE_CONFIDENCE_BANDS as readonly string[]).includes(band) ? (band as IntakeConfidenceBand) : 'high'
    this.budgetRecheckSeconds = intOr(config.get('INTAKE_EXTRACT_BUDGET_RECHECK_SECONDS'), 300)
    this.duplicateScanLimit = intOr(config.get('INTAKE_DUPLICATE_SCAN_LIMIT'), 5000)
    this.maxItemsPerBatch = intOr(config.get('INTAKE_MAX_ITEMS_PER_BATCH'), 500)
  }
}

const RANK: Record<IntakeConfidenceBand, number> = { low: 1, medium: 2, high: 3 }

/** True when `band` is at or above `floor`. */
export function bandReaches(band: IntakeConfidenceBand, floor: IntakeConfidenceBand): boolean {
  return RANK[band] >= RANK[floor]
}
