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

async function parentSchool(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(`insert into schools (name) values ('Sekolah Contoh') returning id::text as id`)
  return (rows[0] as { id: string }).id
}

async function parentPackage(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into school_packages (code, name, slug, education_level, form_level, price_annual)
     values ('T4', 'Pakej Contoh', 'pakej-contoh', 'spm', 't4', 30.00) returning id::text as id`,
  )
  return (rows[0] as { id: string }).id
}

export const MODEL_FIXTURES: Record<string, Fixture> = {
  comp_students: async (query) => ({ user_id: await parentUser(query), package_expires_on: '2027-01-01' }),
  parent_invites: async (query) => ({
    student_id: await parentUser(query),
    token_hash: 'a'.repeat(64),
    expires_at: '2027-01-01T00:00:00Z',
  }),
  parent_links: async (query) => ({ parent_id: await parentUser(query), student_id: await parentUser(query) }),
  school_packages: { code: 'T5', name: 'Pakej T5', slug: 'pakej-t5', education_level: 'spm', form_level: 't5', price_annual: 30 },
  school_subscriptions: async (query) => ({
    school_id: await parentSchool(query),
    school_package_id: await parentPackage(query),
    package_tier: 'full',
    status: 'active',
    starts_on: '2026-01-01',
    ends_on: '2026-12-31',
  }),
  // schools: name (text) is generated; nothing else is required.
  user_roles: async (query) => ({ user_id: await parentUser(query), role: 'student' }),
  user_scopes: async (query) => ({ user_id: await parentUser(query), role: 'student', level: 'self' }),
  // users: name (text) is generated; nothing else is required.
}
