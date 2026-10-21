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

/** BE-17: a class needs a level (and a valid academic year, ck_classrooms_academic_year). */
async function parentClassroom(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into classrooms (name, education_level_id, academic_year) values ('Kelas Contoh', $1, 2026) returning id::text as id`,
    [await parentLevel(query)],
  )
  return (rows[0] as { id: string }).id
}

/** BE-45: a room needs a host and a six-character A-Z0-9 code (ck_game_rooms_code). */
async function parentRoom(query: FixtureQuery): Promise<string> {
  const code = `FX${String((seq += 1)).padStart(4, '0')}`
  await query(
    `insert into game_rooms (code, game, subject, grade_level, match_mode, max_players, host_id)
     values ($1, 'papan-bijak', 'MATEMATIK', 'DARJAH_4', 'same_grade', 4, $2)`,
    [code, await parentUser(query)],
  )
  return code
}

/** BE-19: the columns a headcount config needs: its teacher, class, subject and level (the class has its own level row). */
async function headcountConfigColumns(query: FixtureQuery): Promise<Record<string, unknown>> {
  const level = await parentLevel(query)
  const classroom = await query<{ id: string }>(
    `insert into classrooms (name, education_level_id, academic_year) values ('Kelas Contoh', $1, 2026) returning id::text as id`,
    [level],
  )
  return {
    teacher_id: await parentUser(query),
    classroom_id: (classroom[0] as { id: string }).id,
    subject_id: await parentSubject(query),
    education_level_id: level,
    academic_year: 2026,
    active_otrs: 3,
    mode: 'auto',
  }
}

async function parentHeadcountConfig(query: FixtureQuery): Promise<string> {
  const c = await headcountConfigColumns(query)
  const rows = await query<{ id: string }>(
    `insert into headcount_configs (teacher_id, classroom_id, subject_id, education_level_id, academic_year, active_otrs, mode)
     values ($1, $2, $3, $4, $5, $6, $7) returning id::text as id`,
    [c.teacher_id, c.classroom_id, c.subject_id, c.education_level_id, c.academic_year, c.active_otrs, c.mode],
  )
  return (rows[0] as { id: string }).id
}

/** BE-44: a battle needs a mode and a question type (checks). */
async function parentBattle(query: FixtureQuery): Promise<string> {
  const rows = await query<{ id: string }>(`insert into battles (mode, question_type) values ('quick_match', 'biasa') returning id::text as id`)
  return (rows[0] as { id: string }).id
}

export const MODEL_FIXTURES: Record<string, Fixture> = {
  // ai_usage_logs (BE-36): provider has a check.
  ai_usage_logs: { provider: 'mock' },
  articles: async (query) => ({ author_id: await parentUser(query), category: 'UMUM' }),
  audio_kbat_sets: async (query) => ({ created_by_id: await parentUser(query), education_level_id: await parentLevel(query), subject_id: await parentSubject(query) }),
  banners: { banner_type: 'HERO' },
  // battle_participants (BE-44): the battle and the player must exist; side has a check.
  battle_participants: async (query) => ({ battle_id: await parentBattle(query), side: 'A', user_id: await parentUser(query) }),
  // battles (BE-44): mode and question_type have checks.
  battles: { mode: 'quick_match', question_type: 'biasa' },
  // coin_ledger (BE-11): type has a check and the sign of amount follows it.
  coin_ledger: async (query) => ({ user_id: await parentUser(query), type: 'earn', source: 'quiz_practice', amount: 1, balance_after: 1, description: 'Latih Tubi' }),
  comp_students: async (query) => ({ user_id: await parentUser(query), package_expires_on: '2027-01-01' }),
  notes: async (query) => ({ author_id: await parentUser(query), subject: 'sains', note_type: 'RINGKASAN' }),
  // chat_messages (BE-43): the thread and its owner must exist; role has a check.
  chat_messages: async (query) => {
    const user = await parentUser(query)
    const thread = await query<{ id: string }>(`insert into chat_threads (user_id) values ($1) returning id::text as id`, [user])
    return { thread_id: (thread[0] as { id: string }).id, user_id: user, role: 'user' }
  },
  // chat_threads (BE-43): the owner must exist.
  chat_threads: async (query) => ({ user_id: await parentUser(query) }),
  // chapters (BE-08): an in-tree chapter needs a name and a level (ck_chapters_in_tree_complete).
  chapters: async (query) => ({ subject_id: await parentSubject(query), education_level_id: await parentLevel(query), name: 'Bab Contoh' }),
  // classrooms (BE-17): the level must exist; the academic year has a check.
  classrooms: async (query) => ({ name: 'Kelas Contoh', education_level_id: await parentLevel(query), academic_year: 2026 }),
  // education_levels (BE-08): code must be upper-case, stage one of three.
  education_levels: async () => ({ code: next('FXL'), stage: 'primary' }),
  // enrolments (BE-17): the class and the pupil must exist.
  enrolments: async (query) => ({ classroom_id: await parentClassroom(query), student_id: await parentUser(query) }),
  // exam_attempts (BE-16): the owner must exist; kind, mode and status have check constraints.
  exam_attempts: async (query) => ({ user_id: await parentUser(query), paper_kind: 'pilihan', mode: 'exam', status: 'submitted', kertas: 1, duration_min: 60 }),
  // files (BE-04): mime, sha256 and purpose have check constraints.
  files: { public_id: 'AAAAAAAAAAAAAAAAAAAAAA', purpose: 'avatar', mime: 'image/png', size_bytes: 1, sha256: '0'.repeat(64), storage_key: 'avatar/migration-fixture.png' },
  // feedback (BE-20): the user must exist; role and satisfaction have checks.
  feedback: async (query) => ({ user_id: await parentUser(query), role: 'student', month: '2026-10-01', satisfaction: 4 }),
  // foster_applications (BE-47): the student and the applicant must exist; category has a check.
  foster_applications: async (query) => ({ student_id: await parentUser(query), applicant_user_id: await parentUser(query), applicant_role: 'student', student_category: 'B40', reason: 'Sebab Contoh' }),
  // headcount_configs (BE-19): teacher, class, subject and level must exist; mode, OTR count and year have checks.
  headcount_configs: headcountConfigColumns,
  // headcount_entries (BE-19): the config and the pupil must exist.
  headcount_entries: async (query) => ({ config_id: await parentHeadcountConfig(query), student_id: await parentUser(query) }),
  // interventions (BE-20): pupil and author must exist; alert type and the free text are required.
  interventions: async (query) => ({
    student_id: await parentUser(query),
    created_by_id: await parentUser(query),
    alert_type: 'inactive',
    action_date: '2026-10-01',
    alert_description: 'Huraian contoh',
    action_taken: 'Tindakan contoh',
  }),
  // game_rooms, game_room_players, game_sessions (BE-45): host / owner must exist; code, game, subject, level, mode have checks.
  game_room_players: async (query) => ({ room_code: await parentRoom(query), user_id: await parentUser(query) }),
  game_rooms: async (query) => ({
    code: `FY${String((seq += 1)).padStart(4, '0')}`,
    game: 'papan-bijak',
    subject: 'MATEMATIK',
    grade_level: 'DARJAH_4',
    match_mode: 'same_grade',
    max_players: 4,
    host_id: await parentUser(query),
  }),
  game_sessions: async (query) => ({ user_id: await parentUser(query), game: 'betul-salah' }),
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
  // question_reports (BE-10): reasons and source have checks; question_id has no foreign key (BE-09 owns questions).
  question_reports: { reasons: ['typo'], source: 'latihan' },
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
  // spm_targets (BE-13): user and subject must exist; the grade has a check.
  spm_targets: async (query) => ({ user_id: await parentUser(query), subject_id: await parentSubject(query), target_grade: 'A' }),
  // structured_attempts (BE-13): the user must exist; question_id has no FK (BE-09 owns the bank).
  structured_attempts: async (query) => ({ user_id: await parentUser(query), question_id: 1, question_version_no: 1, total_awarded: 0, total_max: 0 }),
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
  // timeline_posts (BE-19): the owner must exist; category has a check and the title is required.
  timeline_posts: async (query) => ({ user_id: await parentUser(query), title: 'Tajuk Contoh', category: 'lain' }),
  // teacher_profiles (BE-17): the user must exist.
  teacher_profiles: async (query) => ({ user_id: await parentUser(query) }),
  user_roles: async (query) => ({ user_id: await parentUser(query), role: 'student' }),
  user_scopes: async (query) => ({ user_id: await parentUser(query), role: 'student', level: 'self' }),
  // BE-23 gamification and shop: parents and the checked text columns.
  challenge_completions: async (query) => ({
    user_id: await parentUser(query),
    challenge_id: (await query<{ id: string }>(`insert into challenges (title, challenge_type, target_value) values ('Cabaran Contoh', 'quiz_count', 1) returning id::text as id`))[0]!.id,
  }),
  challenges: { challenge_type: 'quiz_count' },
  gamification_settings: { key: 'coins_per_question' },
  referral_codes: async (query) => ({ user_id: await parentUser(query) }),
  referrals: async (query) => ({ referrer_id: await parentUser(query), referee_id: await parentUser(query) }),
  reward_claims: async (query) => ({
    user_id: await parentUser(query),
    reward_id: (await query<{ id: string }>(`insert into syiling_rewards (name, type, price_syiling, cost_value_sen) values ('Hadiah Contoh', 'voucher', 1, 1) returning id::text as id`))[0]!.id,
  }),
  reward_redemptions: async (query) => ({ user_id: await parentUser(query), status: 'pending_admin' }),
  rewards: { category: 'telco' },
  syiling_rewards: { type: 'voucher' },
  user_achievements: async (query) => ({
    user_id: await parentUser(query),
    achievement_id: (await query<{ id: string }>(`insert into achievements (name) values ('Pencapaian Contoh') returning id::text as id`))[0]!.id,
  }),
  // users: name (text) is generated; nothing else is required.
  wallets: async (query) => ({ user_id: await parentUser(query) }),
  // missions (BE-18): teacher and subject must exist; mission_type and question_count have checks.
  missions: async (query) => ({ teacher_id: await parentUser(query), title: 'Misi Contoh', mission_type: 'latih_tubi', mission_date: '2026-10-20', subject_id: await parentSubject(query), question_count: 10 }),
  // question_sets (BE-18): teacher and class must exist.
  question_sets: async (query) => ({ teacher_id: await parentUser(query), classroom_id: await parentClassroom(query), title: 'Set Contoh' }),
}
