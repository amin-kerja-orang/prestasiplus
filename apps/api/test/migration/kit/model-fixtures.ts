/**
 * Column values for tables whose required columns cannot be generated from their types alone
 * (foreign keys to rows that must exist, check constraints). Keyed by TABLE name (the format of
 * `migratable-models.json`), values by snake_case column. A fixture is a plain record, or a function
 * that may first insert the parent rows it needs. A table card adds an entry here only when
 * `migratable-double-upsert.spec.ts` asks for it. Append-only; keep alphabetical. Fictitious data only.
 */
export type FixtureQuery = <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
export type Fixture = Record<string, unknown> | ((query: FixtureQuery) => Promise<Record<string, unknown>>)

async function parentUser(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(`insert into users (name) values ('Pengguna Contoh') returning id::text as id`)
  return (rows[0] as { id: string }).id
}

export const MODEL_FIXTURES: Record<string, Fixture> = {
  // schools: name (text) is generated; nothing else is required.
  user_roles: async (query) => ({ user_id: await parentUser(query), role: 'student' }),
  user_scopes: async (query) => ({ user_id: await parentUser(query), role: 'student', level: 'self' }),
  // users: name (text) is generated; nothing else is required.
}
