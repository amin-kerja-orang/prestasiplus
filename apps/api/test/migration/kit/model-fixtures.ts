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

let seq = 0
const next = (prefix: string): string => `${prefix}${(seq += 1)}`

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

/** BE-08: curriculum parents (codes are stored upper-case, a CHECK enforces it; fictitious names). */
async function parentLevel(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into education_levels (code, name, name_en, stage, curriculum) values ($1, 'Tahap Contoh', 'Sample Level', 'primary', 'KSSR') returning id::text as id`,
    [next('FXL')],
  )
  return (rows[0] as { id: string }).id
}

async function parentSubject(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into subjects (code, name, name_en, color) values ($1, 'Subjek Contoh', 'Sample Subject', '#4f46e5') returning id::text as id`,
    [next('FXS')],
  )
  return (rows[0] as { id: string }).id
}

async function parentChapter(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into chapters (subject_id, education_level_id, name) values ($1, $2, 'Bab Contoh') returning id::text as id`,
    [await parentSubject(query), await parentLevel(query)],
  )
  return (rows[0] as { id: string }).id
}

export const MODEL_FIXTURES: Record<string, Fixture> = {
  articles: async (query) => ({ author_id: await parentUser(query), category: 'UMUM' }),
  audio_kbat_sets: async (query) => ({ created_by_id: await parentUser(query), education_level_id: await parentLevel(query), subject_id: await parentSubject(query) }),
  banners: { banner_type: 'HERO' },
  // coin_ledger (BE-11): type has a check and the sign of amount follows it.
  coin_ledger: async (query) => ({ user_id: await parentUser(query), type: 'earn', source: 'quiz_practice', amount: 1, balance_after: 1, description: 'Latih Tubi' }),
  comp_students: async (query) => ({ user_id: await parentUser(query), package_expires_on: '2027-01-01' }),
  notes: async (query) => ({ author_id: await parentUser(query), subject: 'sains', note_type: 'RINGKASAN' }),
  // chapters (BE-08): an in-tree chapter needs a name and a level (ck_chapters_in_tree_complete).
  chapters: async (query) => ({ subject_id: await parentSubject(query), education_level_id: await parentLevel(query), name: 'Bab Contoh' }),
  // coin_ledger (BE-11): type has a check and the sign of amount follows it.
  coin_ledger: async (query) => ({ user_id: await parentUser(query), type: 'earn', source: 'quiz_practice', amount: 1, balance_after: 1, description: 'Latih Tubi' }),
  // education_levels (BE-08): code must be upper-case, stage one of three.
  education_levels: async () => ({ code: next('FXL'), stage: 'primary' }),
  // exam_attempts (BE-16): the owner must exist; kind, mode and status have check constraints.
  exam_attempts: async (query) => ({ user_id: await parentUser(query), paper_kind: 'pilihan', mode: 'exam', status: 'submitted', kertas: 1, duration_min: 60 }),
  // files (BE-04): mime, sha256 and purpose have check constraints.
  files: { public_id: 'AAAAAAAAAAAAAAAAAAAAAA', purpose: 'avatar', mime: 'image/png', size_bytes: 1, sha256: '0'.repeat(64), storage_key: 'avatar/migration-fixture.png' },
  notifications: async (query) => ({ user_id: await parentUser(query), type: 'spaced_review', title: 'Tajuk Contoh', body: 'Kandungan contoh' }),
  parent_invites: async (query) => ({
    student_id: await parentUser(query),
    token_hash: 'a'.repeat(64),
    expires_at: '2027-01-01T00:00:00Z',
  }),
  parent_links: async (query) => ({ parent_id: await parentUser(query), student_id: await parentUser(query) }),
  // practice_answers (BE-12): the user must exist; a row links to a question or a subject (ck_practice_answers_link).
  // Linked by subject, not question: the FK to questions (BE-09) is deferred, so a fixed question id breaks once it lands.
  practice_answers: async (query) => ({ user_id: await parentUser(query), question_id: null, subject_id: await parentSubject(query) }),
  // practice_sessions (BE-12): the user must exist; mode is one of the ten practice modes.
  practice_sessions: async (query) => ({ user_id: await parentUser(query), mode: 'random' }),
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
  support_tickets: async (query) => ({ user_id: await parentUser(query) }),
  videos: async (query) => ({ uploader_id: await parentUser(query), platform: 'Youtube', category: 'tutorial' }),
  // subject_levels (BE-08): both parents must exist.
  subject_levels: async (query) => ({ subject_id: await parentSubject(query), education_level_id: await parentLevel(query) }),
  // subjects (BE-08): code must be upper-case.
  subjects: async () => ({ code: next('FXS') }),
  // topics (BE-08): the chapter must exist.
  topics: async (query) => ({ chapter_id: await parentChapter(query) }),
  // streaks and wallets (BE-11): one row per user, so a parent user is all they need.
  streaks: async (query) => ({ user_id: await parentUser(query) }),
  user_roles: async (query) => ({ user_id: await parentUser(query), role: 'student' }),
  user_scopes: async (query) => ({ user_id: await parentUser(query), role: 'student', level: 'self' }),
  // users: name (text) is generated; nothing else is required.
  wallets: async (query) => ({ user_id: await parentUser(query) }),
}
