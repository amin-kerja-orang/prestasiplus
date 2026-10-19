/**
 * Column values for models whose required columns cannot be generated from their types alone
 * (foreign keys to rows that must exist, check constraints). Keyed by Prisma model name, values by
 * snake_case column. A table card adds an entry here only when `migratable-double-upsert.spec.ts`
 * asks for it. Append-only; keep alphabetical. Fictitious data only.
 */
export const MODEL_FIXTURES: Record<string, Record<string, unknown>> = {}
