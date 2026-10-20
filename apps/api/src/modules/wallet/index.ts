export { WalletModule } from './wallet.module'
export { WalletService } from './wallet.service'
export { StreakService } from './streak.service'
export { amountCeiling, balanceLimit, idempotencyConflict, insufficientBalance, sessionCreditOwnerConflict } from './errors'
export { walletLockOrder } from './rules'
export type {
  CreditInput,
  DebitInput,
  LedgerOutcome,
  MovementKey,
  SessionCreditInput,
  SessionCreditResult,
  StreakView,
  TokenInput,
} from './wallet.types'
export { isTestActor } from './wallet.types'
export { CREDIT_TYPES, DEBIT_TYPES, LOCK_ORDER, MAX_AMOUNT_PER_CALL, STREAK_MULTIPLIER, type CreditType, type DebitType } from './wallet.constants'
