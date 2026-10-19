/**
 * Demo seed guard (leaf module, no imports, so seed modules can use it without a circular import
 * of the registry). Re-exported from `index.ts`.
 *
 * Demo seeds create accounts with a published password. They must never run against production
 * unless the operator says so explicitly with `ALLOW_DEMO_SEED=true` (or `1`).
 */
export function assertSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO_SEED !== '1' && env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Refusing to seed demo data: NODE_ENV=production. Set ALLOW_DEMO_SEED=true (or 1) only if you really mean it. The database was not touched.',
    )
  }
}
