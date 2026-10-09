/** Multiplier for the explicit per-test budgets; raise it (E2E_TIMEOUT_FACTOR=4) on an overloaded machine. */
export const TIMEOUT_FACTOR = Number(process.env.E2E_TIMEOUT_FACTOR) || 1
