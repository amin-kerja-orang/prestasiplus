/**
 * Synthetic .cloud fixture generator (BE-35, BE-MIG-15). Emits the `pp-staging-dump/1` shape of BE-27
 * (`manifest.json` plus `<table>.ndjson`), so `staging:load` takes it as it is.
 *
 * Deterministic: the same `size` and `seed` always give byte-identical files (a seeded PRNG, a fixed
 * clock origin, no `Date.now`). Everything is obviously fictitious: names are `Murid Contoh 00001`,
 * e-mails end in `@contoh.invalid`, phones start `00`, IC numbers are all zeros with a serial,
 * password hashes are filler strings. No real data, no real person.
 *
 * It plants the nasty cases on purpose and writes `anomalies.json` next to the dump: what was planted
 * and what a scan of the generated rows finds (`scanned`), so a test can compare both with the BE-27
 * profiler. Planted cases: orphans (users.school_id, users.referred_by, attempts without their legacy
 * question or session, pivot rows without parents), case-variant and exact duplicate e-mails,
 * duplicate (school_id, username), unknown enum values, non-bcrypt and shared-default password hashes,
 * roster users without e-mail, date-only edges (a stored UTC date that is the day before the Malaysia
 * date), cyclic and self references, secrets that the loader must drop.
 */
import { TABLES, type TableSpec } from '../ddl/spec'
import { DUMP_FORMAT } from '../staging/readers'
import { Rng } from './rng'

export type FixtureSize = 'tiny' | 'small' | 'medium'
export const FIXTURE_SIZES: readonly FixtureSize[] = ['tiny', 'small', 'medium']
export type Row = Record<string, unknown>

interface SizeSpec {
  users: number
  /** Multiplier for the planted counts. */
  scale: number
}
export const SIZE_SPECS: Record<FixtureSize, SizeSpec> = {
  tiny: { users: 100, scale: 1 },
  small: { users: 1500, scale: 10 },
  medium: { users: 20000, scale: 100 },
}

export const FICTITIOUS_DOMAIN = 'contoh.invalid'
export const ANOMALIES_FORMAT = 'pp-fixture-anomalies/1'
export const DEFAULT_HASH = `$2y$10$${'D'.repeat(53)}`
const argonHash = (id: number): string => `$argon2id$v=19$m=65536,t=4,p=1$ZmFrZQ$ZmFrZWZha2Vm${id.toString(16).padStart(8, '0')}`
export const UNKNOWN_ROLE = 'penyelia_tidak_dikenali'
export const UNKNOWN_COIN_TYPE = 'jenis_tidak_dikenali'
export const UNKNOWN_MODE = 'mod_tidak_dikenali'

const ROLES = ['pelajar', 'guru', 'ibu_bapa', 'penaja', 'admin_sekolah', 'pegawai_ppd', 'admin'] as const
const BASE_MS = Date.UTC(2026, 0, 1)
const MIN = 60_000
const DAY = 24 * 60 * MIN

const pad = (n: number, w = 5) => String(n).padStart(w, '0')
const iso = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
const utcDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const mytDate = (ms: number): string => new Date(ms + 8 * 60 * MIN).toISOString().slice(0, 10)

export interface PlantedAnomalies {
  duplicateEmail: { groups: number; rows: number }
  duplicateSchoolUsername: { groups: number; rows: number }
  rosterNoEmail: number
  sharedDefaultHash: number
  orphans: Record<string, number>
  unknownEnums: Record<string, Record<string, number>>
  passwordPrefixes: Record<string, number>
  dateOnlyEdges: Record<string, number>
  referralCycles: { pairs: number; selfReferences: number }
  duplicatePivotRows: Record<string, number>
  redactedSecrets: Record<string, number>
}

export interface AnomalyManifest {
  format: typeof ANOMALIES_FORMAT
  size: FixtureSize
  seed: number
  rows: Record<string, number>
  /** What the generator meant to plant. */
  planted: PlantedAnomalies
  /** What a scan of the generated rows finds, independent of the planting code (the profiler must agree). */
  scanned: {
    orphans: Record<string, number>
    duplicateEmail: { groups: number; rows: number }
    duplicateSchoolUsername: { groups: number; rows: number }
    passwordPrefixes: Record<string, number>
    nulls: Record<string, number>
    dateOnlyEdges: Record<string, number>
    sharedDefaultHash: number
  }
}

export interface GeneratedFixture {
  size: FixtureSize
  seed: number
  tables: Map<string, Row[]>
  anomalies: AnomalyManifest
}

function fakeHash(id: number, prefix = '2y'): string {
  return '$' + prefix + '$10$' + 'F'.repeat(40) + id.toString(16).padStart(13, '0')
}

function build(size: FixtureSize, seed: number): { tables: Map<string, Row[]>; planted: PlantedAnomalies } {
  const sizeSalt = { tiny: 1, small: 2, medium: 3 }[size]
  const rng = new Rng((seed ^ Math.imul(sizeSalt, 0x9e3779b1)) >>> 0)
  const { users: U, scale: B } = SIZE_SPECS[size]
  const tables = new Map<string, Row[]>()
  const put = (name: string, rows: Row[]) => void tables.set(name, rows)
  const planted: PlantedAnomalies = {
    duplicateEmail: { groups: 0, rows: 0 },
    duplicateSchoolUsername: { groups: 0, rows: 0 },
    rosterNoEmail: 0,
    sharedDefaultHash: 0,
    orphans: {},
    unknownEnums: {},
    passwordPrefixes: {},
    dateOnlyEdges: {},
    referralCycles: { pairs: 0, selfReferences: 0 },
    duplicatePivotRows: {},
    redactedSecrets: {},
  }
  const bump = (m: Record<string, number>, k: string, n = 1) => void (m[k] = (m[k] ?? 0) + n)
  const plantEnum = (col: string, value: string, n = 1) => {
    planted.unknownEnums[col] ??= {}
    bump(planted.unknownEnums[col] as Record<string, number>, value, n)
  }
  const created = (i: number) => iso(BASE_MS + i * 7 * MIN)

  // Reference data
  const S = Math.max(3, Math.round(U / 50))
  put('schools', Array.from({ length: S }, (_, i) => ({
    id: i + 1, name: `Sekolah Contoh ${pad(i + 1, 3)}`, code: `SC${pad(i + 1, 4)}`, type: i % 3 === 2 ? 'smk' : 'sk',
    state: `negeri_${'abc'[i % 3]}`, district: `daerah_${'abc'[i % 3]}${(i % 5) + 1}`, join_code: `JOIN${pad(i + 1, 4)}`,
    is_active: '1', created_at: created(i), updated_at: created(i),
  })))
  put('school_subscriptions', Array.from({ length: S }, (_, i) => ({
    id: i + 1, school_id: i + 1, package: i % 2 ? 'asas' : 'premium', quota: 100 + i, starts_at: '2026-01-01', ends_at: '2026-12-31',
  })))
  put('subjects', Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Mata Pelajaran Contoh ${i + 1}`, code: `MP${i + 1}`, is_core: i < 3 ? '1' : '0', color: '#cccccc', sort_order: i + 1 })))
  put('education_levels', Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name_bm: `Darjah Contoh ${i + 1}`, name_en: `Level Sample ${i + 1}`, sort_order: i + 1, curriculum: 'kssr', stage: i < 2 ? 'primary' : 'secondary' })))
  const chapters: Row[] = []
  for (let s = 1; s <= 6; s++) for (let c = 1; c <= 3; c++) chapters.push({ id: chapters.length + 1, subject_id: s, education_level_id: ((s + c) % 4) + 1, number: c, title: `Bab Contoh ${s}.${c}`, dskp_code: `D${s}${c}`, strand: c % 2 ? 'a' : 'b' })
  put('chapters', chapters)
  const topics: Row[] = []
  for (const ch of chapters) for (let t = 1; t <= 3; t++) topics.push({ id: topics.length + 1, chapter_id: ch.id, subject_id: ch.subject_id, name: `Topik Contoh ${topics.length + 1}`, sort_order: t })
  put('topics', topics)

  // Users
  const roleOf = (i: number): string => {
    if (i < ROLES.length) return ROLES[i] as string
    const r = rng.next()
    return r < 0.78 ? 'pelajar' : r < 0.86 ? 'guru' : r < 0.94 ? 'ibu_bapa' : r < 0.96 ? 'penaja' : r < 0.98 ? 'admin_sekolah' : r < 0.99 ? 'pegawai_ppd' : 'admin'
  }
  const users: Row[] = Array.from({ length: U }, (_, i) => {
    const id = i + 1
    const role = roleOf(i)
    return {
      id,
      name: `${role === 'guru' ? 'Guru' : role === 'ibu_bapa' ? 'Penjaga' : role === 'pelajar' ? 'Murid' : 'Pengguna'} Contoh ${pad(id)}`,
      email: `pengguna${pad(id)}@${FICTITIOUS_DOMAIN}`,
      phone: `00${pad(id, 9)}`,
      ic: `0000000${pad(id)}`,
      username: `contoh${pad(id)}`,
      password: fakeHash(id),
      role,
      school_id: role === 'admin' || role === 'pegawai_ppd' ? null : (i % S) + 1,
      kelas: role === 'pelajar' ? `${(i % 6) + 1} Contoh` : null,
      is_active: '1',
      is_suspended: '0',
      is_complimentary: '0',
      referral_code: `RC${pad(id, 6)}`,
      created_at: created(i),
      updated_at: created(i),
      last_login_at: iso(BASE_MS + 90 * DAY + i * MIN),
    }
  })
  put('users', users)
  // Eligible pool for planting: pupils beyond the first fixed role rows, shuffled once. Disjoint picks.
  const pool = rng.shuffle(users.filter((u) => u.role === 'pelajar' && (u.id as number) > ROLES.length).map((u) => u.id as number))
  const take = (n: number): Row[] => {
    if (pool.length < n) throw new Error(`Fixture size "${size}" has too few pupils to plant ${n} more cases; use a larger size.`)
    return pool.splice(0, n).map((id) => users[id - 1] as Row)
  }

  // Duplicate e-mails: even groups are a case-variant pair, odd groups an exact copy plus a case variant.
  for (let g = 0; g < 2 * B; g++) {
    const size3 = g % 2 === 1
    const members = take(size3 ? 3 : 2)
    const original = members[0] as Row
    ;(members[1] as Row).email = String(original.email).toUpperCase()
    if (size3) (members[2] as Row).email = original.email
    planted.duplicateEmail.groups++
    planted.duplicateEmail.rows += members.length
  }
  // Duplicate (school_id, username): same school, same username, e-mails stay distinct.
  for (let g = 0; g < B; g++) {
    const [a, b] = take(2) as [Row, Row]
    b.school_id = a.school_id
    b.username = a.username
    planted.duplicateSchoolUsername.groups++
    planted.duplicateSchoolUsername.rows += 2
  }
  // Roster users: no e-mail, a username, the shared default hash.
  for (const u of take(4 * B)) {
    u.email = null
    u.password = DEFAULT_HASH
    planted.rosterNoEmail++
    planted.sharedDefaultHash++
  }
  for (const u of take(2 * B)) {
    u.password = DEFAULT_HASH
    planted.sharedDefaultHash++
  }
  // Orphan school, orphan referrer, referral cycles (pairs and a self reference).
  for (const [k, u] of take(2 * B).entries()) {
    u.school_id = 900_000 + k
    bump(planted.orphans, 'users.school_id')
  }
  for (const [k, u] of take(B).entries()) {
    u.referred_by = 800_000 + k
    bump(planted.orphans, 'users.referred_by')
  }
  for (let g = 0; g < B; g++) {
    const [a, b] = take(2) as [Row, Row]
    a.referred_by = b.id
    b.referred_by = a.id
    planted.referralCycles.pairs++
  }
  for (const u of take(B)) {
    u.referred_by = u.id
    planted.referralCycles.selfReferences++
  }
  // A normal referral chain, so the column is not only anomalies.
  for (let i = ROLES.length + 40; i < Math.min(U, ROLES.length + 40 + 10 * B); i++) {
    const u = users[i] as Row
    if (u.referred_by === undefined && u.role === 'pelajar') u.referred_by = 1
  }
  // Unknown roles.
  for (const u of take(2 * B)) {
    u.role = UNKNOWN_ROLE
    plantEnum('users.role', UNKNOWN_ROLE)
  }
  // Non-bcrypt and odd hashes.
  // Every odd hash is unique, so only the roster/default hash is shared.
  const oddHashes: [string, (id: number) => string | null][] = [
    ['$2b$', (id) => fakeHash(id, '2b')], ['$2b$', (id) => fakeHash(id, '2b')],
    ['$argon2id$', argonHash], ['$argon2id$', argonHash],
    ['(other)', (id) => `not-a-hash-fixture-${id}`], ['(empty)', () => ''], ['(null)', () => null],
  ]
  for (let g = 0; g < B; g++) {
    for (const [label, make] of oddHashes) {
      const u = take(1)[0] as Row
      u.password = make(u.id as number)
      bump(planted.passwordPrefixes, label)
    }
  }
  // Secrets the loader must drop (users.remember_token, users.parent_invite_token).
  for (const u of take(3 * B)) {
    u.remember_token = `fixture-remember-token-${pad(u.id as number)}`
    bump(planted.redactedSecrets, 'users.remember_token')
  }
  for (const u of users.filter((x) => x.role === 'ibu_bapa').slice(0, 2 * B)) {
    u.parent_invite_token = `fixture-invite-token-${pad(u.id as number)}`
    bump(planted.redactedSecrets, 'users.parent_invite_token')
  }

  const ids = (role: string) => users.filter((u) => u.role === role).map((u) => u.id as number)
  const pupils = ids('pelajar')
  const teachers = ids('guru')
  const parents = ids('ibu_bapa')

  // Classes and rosters
  const C = Math.max(3, Math.round(U / 25))
  put('classrooms', Array.from({ length: C }, (_, i) => ({
    id: i + 1, name: `Kelas Contoh ${pad(i + 1, 3)}`, code: `KLS${pad(i + 1, 4)}`, teacher_id: teachers.length ? teachers[i % teachers.length] : null,
    school_id: (i % S) + 1, subject_id: (i % 6) + 1, session_year: '2026',
  })))
  const roster: Row[] = pupils.map((id, i) => ({ classroom_id: (i % C) + 1, student_id: id }))
  for (let k = 0; k < B; k++) {
    roster.push({ classroom_id: 1, student_id: 900_100 + k })
    bump(planted.orphans, 'classroom_student.student_id')
    roster.push({ classroom_id: 900_200 + k, student_id: pupils[k % pupils.length] })
    bump(planted.orphans, 'classroom_student.classroom_id')
    roster.push({ ...(roster[k] as Row) })
    bump(planted.duplicatePivotRows, 'classroom_student')
  }
  put('classroom_student', roster)
  const links: Row[] = []
  parents.forEach((pid, i) => {
    links.push({ parent_id: pid, student_id: pupils[(i * 2) % pupils.length], relationship: i % 2 ? 'ibu' : 'bapa' })
  })
  for (let k = 0; k < B; k++) {
    links.push({ parent_id: parents[k % parents.length], student_id: 910_000 + k, relationship: 'bapa' })
    bump(planted.orphans, 'parent_student.student_id')
  }
  put('parent_student', links)
  // The curriculum is fixed at 54 topics whatever the size, so this orphan count grows more slowly.
  for (let k = 0; k < Math.max(1, Math.round(B / 2)); k++) {
    ;(topics[k] as Row).chapter_id = 920_000 + k
    bump(planted.orphans, 'topics.chapter_id')
  }

  // Question bank (archive)
  const Q = Math.max(24, Math.round(U / 5))
  put('questions', Array.from({ length: Q }, (_, i) => ({
    id: i + 1, subject_id: (i % 6) + 1, education_level_id: (i % 4) + 1, chapter_id: (i % 18) + 1, topic_id: (i % 54) + 1,
    difficulty_level: ['mudah', 'sederhana', 'sukar'][i % 3], question_type: 'objektif', status: i % 17 === 0 ? 'diarkib' : 'diluluskan', body: `Soalan contoh ${i + 1}.`,
  })))
  const options: Row[] = []
  for (let q = 1; q <= Q; q++) for (let o = 0; o < 4; o++) options.push({ id: options.length + 1, question_id: q, label: 'ABCD'[o], body: `Pilihan contoh ${q}${'ABCD'[o]}`, is_correct: o === 0 ? '1' : '0' })
  for (let k = 0; k < B; k++) {
    ;(options[k] as Row).question_id = 930_000 + k
    bump(planted.orphans, 'question_options.question_id')
  }
  put('question_options', options)
  put('source_papers', Array.from({ length: 3 }, (_, i) => ({ id: i + 1, natural_key: `contoh-2025-${i + 1}`, content_hash: String(i).repeat(64).slice(0, 64), year: 2025 })))
  put('exam_papers', Array.from({ length: 3 }, (_, i) => ({ id: i + 1, source_paper_id: i + 1, status: 'diterbitkan', title: `Kertas Contoh ${i + 1}` })))
  put('teacher_reference_papers', Array.from({ length: 3 }, (_, i) => ({ id: i + 1, teacher_reference_document_id: null, title: `Rujukan Contoh ${i + 1}` })))
  put('legacy_canonical_map', Array.from({ length: Q }, (_, i) => ({ id: i + 1, source: 'questions', legacy_id: String(i + 1), canonical_type: 'exam_question', canonical_id: i + 1 })))
  put('question_sets', Array.from({ length: C }, (_, i) => ({ id: i + 1, teacher_id: teachers.length ? teachers[i % teachers.length] : null, title: `Set Contoh ${i + 1}`, subject_id: (i % 6) + 1, education_level_id: (i % 4) + 1, status: 'draf' })))

  // Practice and attempts
  const P = 2 * U
  const sessions: Row[] = Array.from({ length: P }, (_, i) => {
    const total = 10
    const correct = rng.int(2, 10)
    return {
      id: i + 1, user_id: pupils[i % pupils.length], subject_id: (i % 6) + 1, mode: i % 5 === 0 ? 'kuiz' : 'latih_tubi', paper: i % 2 ? 'paper1' : 'paper2',
      client_uuid: `00000000-0000-4000-8000-${pad(i + 1, 12)}`, total_questions: total, correct, accuracy: correct * 10, duration_seconds: 120 + (i % 400),
      syiling_earned: correct, started_at: created(i), created_at: created(i), updated_at: created(i),
    }
  })
  for (const s of rng.shuffle(sessions).slice(0, B)) {
    s.mode = UNKNOWN_MODE
    plantEnum('practice_sessions.mode', UNKNOWN_MODE)
  }
  put('practice_sessions', sessions)
  const A = 6 * U
  const attempts: Row[] = Array.from({ length: A }, (_, i) => ({
    id: i + 1, user_id: pupils[i % pupils.length], practice_session_id: (i % P) + 1, question_id: (i % Q) + 1, selected_option: 'ABCD'[i % 4],
    is_correct: i % 3 === 0 ? '1' : '0', time_seconds: 5 + (i % 60), created_at: created(i), updated_at: created(i),
  }))
  // Attempts whose legacy question is gone, and attempts whose session is gone (distinct rows).
  const attemptOrder = rng.shuffle(attempts.map((_, i) => i))
  for (let k = 0; k < 3 * B; k++) {
    ;(attempts[attemptOrder[k] as number] as Row).question_id = 700_000 + k
    bump(planted.orphans, 'question_attempts.question_id')
  }
  for (let k = 0; k < 2 * B; k++) {
    ;(attempts[attemptOrder[3 * B + k] as number] as Row).practice_session_id = 710_000 + k
    bump(planted.orphans, 'question_attempts.practice_session_id')
  }
  put('question_attempts', attempts)
  put('review_schedules', pupils.map((id, i) => ({ id: i + 1, user_id: id, question_id: (i % Q) + 1, ease_factor: 2.5, interval_days: 1 + (i % 7), repetitions: i % 4, lapses: i % 2, next_due_at: iso(BASE_MS + 100 * DAY + i * MIN), created_at: created(i), updated_at: created(i) })))
  put('student_notes', pupils.filter((_, i) => i % 4 === 0).map((id, i) => ({ id: i + 1, user_id: id, subject_id: (i % 6) + 1, title: `Nota Contoh ${i + 1}`, body: `Isi nota contoh ${i + 1}.`, created_at: created(i), updated_at: created(i) })))

  // Mood check-ins with date-only edges: the stored date is the UTC date; a check-in between 16:00 and 24:00 UTC
  // is already the next day in Malaysia.
  const moods: Row[] = pupils.map((id, i) => {
    const day = Math.floor(i / 3)
    const ms = BASE_MS + day * DAY + 4 * 60 * MIN + (i % 300) * MIN
    return { id: i + 1, user_id: id, mood: ['gembira', 'sedih', 'biasa', 'marah'][i % 4], checked_in_on: utcDate(ms), created_at: iso(ms), updated_at: iso(ms) }
  })
  const edgeAt = (row: Row, ms: number) => {
    row.created_at = iso(ms)
    row.updated_at = iso(ms)
    row.checked_in_on = utcDate(ms)
  }
  for (let k = 0; k < B; k++) {
    edgeAt(moods[3 * k] as Row, BASE_MS + (10 + k) * DAY + 16 * 60 * MIN) // exactly 00:00 Malaysia
    edgeAt(moods[3 * k + 1] as Row, BASE_MS + (10 + k) * DAY + 23 * 60 * MIN + 59 * MIN) // 07:59 Malaysia next day
    edgeAt(moods[3 * k + 2] as Row, BASE_MS + (10 + k) * DAY + 15 * 60 * MIN + 59 * MIN) // 23:59 Malaysia, same day (not an edge)
    bump(planted.dateOnlyEdges, 'mood_checkins', 2)
  }
  put('mood_checkins', moods)
  put('feedback', pupils.filter((_, i) => i % 10 === 0).map((id, i) => ({ id: i + 1, user_id: id, score: 1 + (i % 10), satisfaction: 1 + (i % 5), usability: 1 + (i % 5), relevance: 1 + (i % 5), comment: `Komen contoh ${i + 1}.`, created_at: created(i), updated_at: created(i) })))

  // Gamification
  put('gamification_tiers', Array.from({ length: 4 }, (_, i) => ({ id: i + 1, label_ms: `Peringkat Contoh ${i + 1}`, perks: 'Contoh', sort_order: i + 1 })))
  put('student_wallets', pupils.map((id, i) => ({ id: i + 1, user_id: id, syiling_balance: i % 200, syiling_lifetime: (i % 200) + 50, streak_days: i % 30, gamification_tier_id: (i % 4) + 1, created_at: created(i), updated_at: created(i) })))
  const coins: Row[] = Array.from({ length: pupils.length * 3 }, (_, i) => ({
    id: i + 1, user_id: pupils[i % pupils.length], type: ['earn', 'spend', 'bonus'][i % 3], source: ['practice', 'battle', 'gift'][i % 3], amount: 5 + (i % 20), balance_after: 10 + (i % 100), created_at: created(i), updated_at: created(i),
  }))
  for (const c of rng.shuffle(coins).slice(0, 2 * B)) {
    c.type = UNKNOWN_COIN_TYPE
    plantEnum('coin_transactions.type', UNKNOWN_COIN_TYPE)
  }
  put('coin_transactions', coins)
  put('challenges', Array.from({ length: 5 }, (_, i) => ({ id: i + 1, created_by: null, classroom_id: null, type: 'harian', title: `Cabaran Contoh ${i + 1}` })))
  const cu: Row[] = pupils.filter((_, i) => i % 2 === 0).map((id, i) => {
    const ms = BASE_MS + (i % 60) * DAY + 5 * 60 * MIN
    return { challenge_id: (i % 5) + 1, user_id: id, progress: i % 10, completed_at: iso(ms), claimed_on: utcDate(ms), created_at: iso(ms), updated_at: iso(ms) }
  })
  for (let k = 0; k < B && k < cu.length; k++) {
    const ms = BASE_MS + (70 + k) * DAY + 17 * 60 * MIN
    ;(cu[k] as Row).completed_at = iso(ms)
    ;(cu[k] as Row).claimed_on = utcDate(ms)
    bump(planted.dateOnlyEdges, 'challenge_user')
  }
  put('challenge_user', cu)
  put('achievements', Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Pencapaian Contoh ${i + 1}`, criteria: 'Contoh' })))
  put('achievement_user', pupils.filter((_, i) => i % 2 === 1).map((id, i) => ({ achievement_id: (i % 6) + 1, user_id: id, unlocked_at: created(i) })))
  const nb = Math.max(2, Math.round(U / 10))
  put('battles', Array.from({ length: nb }, (_, i) => ({ id: i + 1, mode: i % 2 ? '1v1' : 'quick_match', total_questions: 5, duration_seconds: 120, status: 'selesai', created_at: created(i), updated_at: created(i) })))
  put('battle_participants', Array.from({ length: nb * 2 }, (_, i) => ({ id: i + 1, battle_id: (i >> 1) + 1, user_id: i % 2 ? null : pupils[(i >> 1) % pupils.length], score: i % 6, accuracy: (i % 6) * 20, is_bot: i % 2 ? '1' : '0', target_score: i % 2 ? 3 : 0, answered: 5 })))
  put('games', Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: `Permainan Contoh ${i + 1}`, type: 'solo', config: { level: i + 1 } })))
  put('game_sessions', pupils.map((id, i) => ({ id: i + 1, game_id: (i % 3) + 1, user_id: id, score: i % 50, result: i % 2 ? 'menang' : 'kalah', created_at: created(i), updated_at: created(i) })))

  // Content, support, billing, exams
  put('banners', Array.from({ length: 3 }, (_, i) => ({ id: i + 1, title: `Sepanduk Contoh ${i + 1}`, type: 'info', target: '/', sort_order: i + 1, is_active: '1' })))
  put('articles', Array.from({ length: 5 }, (_, i) => ({ id: i + 1, slug: `artikel-contoh-${i + 1}`, category: 'umum', title: `Artikel Contoh ${i + 1}`, views: i * 3, is_published: '1', author_id: 7 })))
  put('support_tickets', pupils.filter((_, i) => i % 10 === 3).map((id, i) => ({ id: i + 1, user_id: id, subject: `Tiket contoh ${i + 1}`, status: i % 2 ? 'ditutup' : 'dibuka', admin_reply: i % 2 ? 'Balasan contoh.' : null, created_at: created(i), updated_at: created(i) })))
  put('settings', Array.from({ length: 5 }, (_, i) => ({ id: i + 1, key: `contoh.tetapan_${i + 1}`, value: `nilai-${i + 1}`, group: 'umum' })))
  put('feature_flags', Array.from({ length: 4 }, (_, i) => ({ id: i + 1, slug: `ciri-contoh-${i + 1}`, enabled: i % 2 ? '1' : '0', audience: 'semua' })))
  put('packages', Array.from({ length: 3 }, (_, i) => ({ id: i + 1, name: `Pakej Contoh ${i + 1}`, tier: 'asas', price: 10 + i, duration_days: 30 })))
  const pays = pupils.filter((_, i) => i % 10 === 5)
  put('payments', pays.map((id, i) => ({ id: i + 1, user_id: id, package_id: (i % 3) + 1, amount: 10 + (i % 3), status: i % 7 === 0 ? 'gagal' : 'berjaya', created_at: created(i), updated_at: created(i) })))
  put('invoices', pays.map((_, i) => ({ id: i + 1, payment_id: i + 1, amount: 10 + (i % 3), status: 'dibayar', created_at: created(i), updated_at: created(i) })))
  put('exam_attempts', pupils.filter((_, i) => i % 5 === 0).map((id, i) => ({ id: i + 1, user_id: id, exam_paper_id: (i % 3) + 1, mode: 'latihan', score: i % 40, max_score: 40, section_scores: { a: i % 20, b: i % 20 }, section_selections: null, served_composition: null, created_at: created(i), updated_at: created(i) })))

  return { tables, planted }
}

function scan(tables: Map<string, Row[]>): AnomalyManifest['scanned'] {
  const ids = new Map<string, Set<string>>()
  const idsOf = (t: string): Set<string> => {
    let set = ids.get(t)
    if (!set) {
      set = new Set((tables.get(t) ?? []).map((r) => String(r.id)))
      ids.set(t, set)
    }
    return set
  }
  const orphans: Record<string, number> = {}
  for (const spec of TABLES) {
    const rows = tables.get(spec.name) ?? []
    for (const col of spec.columns.filter((c) => c.fk)) {
      const parents = idsOf(col.fk as string)
      let n = 0
      for (const r of rows) {
        const v = r[col.name]
        if (v !== null && v !== undefined && !parents.has(String(v))) n++
      }
      if (n > 0) orphans[`${spec.name}.${col.name}`] = n
    }
  }
  const users = tables.get('users') ?? []
  const group = (key: (u: Row) => string | null): { groups: number; rows: number } => {
    const counts = new Map<string, number>()
    for (const u of users) {
      const k = key(u)
      if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    let groups = 0
    let rows = 0
    for (const n of counts.values()) if (n > 1) { groups++; rows += n }
    return { groups, rows }
  }
  const duplicateEmail = group((u) => (typeof u.email === 'string' ? u.email.toLowerCase() : null))
  // Mirrors the profiler: NULL school_id rows form one group; username must be non-null.
  const duplicateSchoolUsername = group((u) => (typeof u.username === 'string' ? `${u.school_id ?? ''}|${u.username}` : null))
  const passwordPrefixes: Record<string, number> = {}
  let shared = 0
  const hashCounts = new Map<string, number>()
  for (const u of users) {
    const p = u.password
    const key = p === null || p === undefined ? '(null)' : p === '' ? '(empty)' : (/^\$[0-9A-Za-z]{1,10}\$/.exec(String(p))?.[0] ?? '(other)')
    passwordPrefixes[key] = (passwordPrefixes[key] ?? 0) + 1
    if (typeof p === 'string' && p !== '') hashCounts.set(p, (hashCounts.get(p) ?? 0) + 1)
  }
  for (const n of hashCounts.values()) if (n > 1) shared += n
  const nulls: Record<string, number> = {}
  for (const spec of TABLES) {
    const rows = tables.get(spec.name) ?? []
    if (rows.length === 0) continue
    for (const col of spec.columns) {
      const n = rows.filter((r) => r[col.name] === null || r[col.name] === undefined).length
      if (n > 0) nulls[`${spec.name}.${col.name}`] = n
    }
  }
  const dateOnlyEdges: Record<string, number> = {}
  const edge = (table: string, dateCol: string, tsCol: string) => {
    const n = (tables.get(table) ?? []).filter((r) => typeof r[tsCol] === 'string' && typeof r[dateCol] === 'string' && mytDate(Date.parse(r[tsCol] as string)) !== r[dateCol]).length
    if (n > 0) dateOnlyEdges[table] = n
  }
  edge('mood_checkins', 'checked_in_on', 'created_at')
  edge('challenge_user', 'claimed_on', 'completed_at')
  return { orphans, duplicateEmail, duplicateSchoolUsername, passwordPrefixes, nulls, dateOnlyEdges, sharedDefaultHash: shared }
}

export function generateFixture(size: FixtureSize, seed: number): GeneratedFixture {
  if (!FIXTURE_SIZES.includes(size)) throw new RangeError('The size must be tiny, small or medium.')
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('The seed must be an integer from 0 to 4294967295.')
  const { tables, planted } = build(size, seed)
  for (const name of tables.keys()) if (!TABLES.some((t) => t.name === name)) throw new Error(`Fixture table "${name}" is not in the staging spec.`)
  const scanned = scan(tables)
  const rows: Record<string, number> = {}
  for (const spec of TABLES) rows[spec.name] = tables.get(spec.name)?.length ?? 0
  return { size, seed, tables, anomalies: { format: ANOMALIES_FORMAT, size, seed, rows, planted, scanned } }
}

/** File name to content (manifest and anomalies included), keys sorted: the same input gives the same bytes. */
export function fixtureFiles(fixture: GeneratedFixture, tableSpecs: readonly TableSpec[] = TABLES): Map<string, string> {
  const files = new Map<string, string>()
  const manifestTables: Record<string, { rows: number; file?: string }> = {}
  for (const spec of tableSpecs) {
    const rows = fixture.tables.get(spec.name) ?? []
    if (rows.length === 0) {
      manifestTables[spec.name] = { rows: 0 }
      continue
    }
    const file = `${spec.name}.ndjson`
    manifestTables[spec.name] = { rows: rows.length, file }
    files.set(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)
  }
  files.set('manifest.json', `${JSON.stringify({ format: DUMP_FORMAT, source: 'cloud', synthetic: true, tables: manifestTables }, null, 2)}\n`)
  files.set('anomalies.json', `${JSON.stringify(fixture.anomalies, null, 2)}\n`)
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}
