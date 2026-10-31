/**
 * Demo seed guard (leaf module, no imports, so seed modules can use it without a circular import
 * of the registry). Re-exported from `index.ts`.
 *
 * Demo seeds create accounts with a published password. They must never run against production
 * unless the operator says so explicitly with `ALLOW_DEMO_SEED=true` (or `1`).
 *
 * Fail-closed: only an explicitly non-production `NODE_ENV` (`development` or `test`, compared
 * case-insensitively) lets demo data in without the flag. Anything else (unset, empty,
 * `production`, `Production`, `prod`, `staging`, a typo) counts as production. Local dev gets
 * `NODE_ENV=development` from `.env.api` (see `.env.api.example`), and vitest sets `NODE_ENV=test`.
 */
const NON_PRODUCTION_ENVS: ReadonlySet<string> = new Set(['development', 'test'])

/** True only for an explicitly non-production NODE_ENV; unset or unknown values are production. */
function isExplicitNonProduction(nodeEnv: string | undefined): boolean {
  return typeof nodeEnv === 'string' && NON_PRODUCTION_ENVS.has(nodeEnv.toLowerCase())
}

export function assertSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (isExplicitNonProduction(env.NODE_ENV)) return
  if (env.ALLOW_DEMO_SEED === '1' || env.ALLOW_DEMO_SEED === 'true') return
  throw new Error(
    'Refusing to seed demo data: NODE_ENV is not development or test, so this run counts as production. Set ALLOW_DEMO_SEED=true (or 1) only if you really mean it. The database was not touched.',
  )
}

/**
 * True when the demo guard counts `env` as production, i.e. `assertSeedAllowed` would refuse it with no ALLOW_DEMO_SEED key.
 * Uses the guard itself, so it follows the guard's own definition of production. Lives here (a leaf) so a seed module can use
 * it without importing the registry; re-exported from `index.ts`.
 */
export function countsAsProduction(env: Record<string, string | undefined> = process.env): boolean {
  try {
    assertSeedAllowed({ ...env, ALLOW_DEMO_SEED: undefined })
    return false
  } catch {
    return true
  }
}
