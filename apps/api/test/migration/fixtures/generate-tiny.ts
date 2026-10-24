/**
 * Generator of the tiny SYNTHETIC .cloud fixture (BE-27). Deterministic: no randomness, no clock.
 * Every name, e-mail, phone, IC and hash is obviously fictitious (`*.invalid` domains, all-zero
 * numbers, `Murid Contoh N`). The data carries the nasty cases on purpose (orphans, duplicate
 * e-mail, duplicate username, unknown role and enum values, non-bcrypt hashes, roster users without
 * e-mail) so the profiler has something to count. BE-35 later adds the full generator.
 *
 * Regenerate: `npx tsx test/migration/fixtures/generate-tiny.ts` from apps/api (writes ./cloud-tiny).
 * A test regenerates in memory and compares with the committed files.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DUMP_FORMAT } from '../../../src/migration/staging/readers'
import { TABLES } from '../../../src/migration/ddl/spec'

type Row = Record<string, unknown>

const HASH_BCRYPT = `$2y$10$${'F'.repeat(53)}`
const HASH_BCRYPT_B = `$2b$10$${'F'.repeat(53)}`
const HASH_ARGON = '$argon2id$v=19$m=65536,t=4,p=1$ZmFrZQ$ZmFrZWZha2VmYWtl'
const T0 = '2026-01-01T00:00:00Z'

const pad = (n: number, w = 3) => String(n).padStart(w, '0')

function users(): Row[] {
  const roles = ['pelajar', 'pelajar', 'pelajar', 'pelajar', 'pelajar', 'pelajar', 'guru', 'guru', 'ibu_bapa', 'admin_sekolah', 'pegawai_ppd', 'admin', 'super_guru', 'jpn_officer', 'agent']
  return roles.map((role, i) => {
    const n = i + 1
    const row: Row = {
      id: n,
      name: `${role === 'guru' ? 'Guru' : 'Murid'} Contoh ${pad(n)}`,
      email: `pengguna${pad(n)}@contoh.invalid`,
      phone: `0000000${pad(n)}`,
      ic: `0000000000${pad(n, 2)}`,
      username: `contoh${pad(n)}`,
      password: HASH_BCRYPT,
      role,
      school_id: (i % 3) + 1,
      is_active: '1',
      is_suspended: '0',
      is_complimentary: '0',
      created_at: T0,
      updated_at: T0,
    }
    return row
  }).map((row, i) => {
    // Nasty cases, by user id (1-based).
    const n = i + 1
    if (n === 2) row.email = (users0Email(1)).toUpperCase() // duplicate e-mail, other case
    if (n === 3) {
      row.email = null // roster pupil without e-mail
      row.username = 'contoh001'
      row.school_id = 1 // duplicate (school_id, username) with user 1 (school 1)
    }
    if (n === 4) row.school_id = 999 // orphan school
    if (n === 5) row.referred_by = 777 // orphan self reference
    if (n === 6) row.referred_by = 1
    if (n === 7) row.password = HASH_BCRYPT_B
    if (n === 8) row.password = HASH_ARGON
    if (n === 9) row.password = 'not-a-hash-fixture'
    if (n === 10) row.password = ''
    if (n === 11) row.password = null
    if (n === 12) row.is_suspended = '1'
    if (n <= 3) row.remember_token = `fixture-remember-token-${pad(n)}` // must be stored as NULL (PDPA)
    if (n === 9) row.parent_invite_token = 'fixture-invite-token-009' // must be stored as NULL (PDPA)
    return row
  })
}
const users0Email = (n: number) => `pengguna${pad(n)}@contoh.invalid`

function build(): Map<string, Row[]> {
  const t = new Map<string, Row[]>()
  const put = (name: string, rows: Row[]) => t.set(name, rows)

  put('schools', [1, 2, 3].map((n) => ({
    id: n, name: `Sekolah Contoh ${n}`, code: `SC${pad(n)}`, type: n === 3 ? 'smk' : 'sk',
    state: n === 3 ? 'negeri b' : 'Negeri B', district: `Daerah B${n}`, join_code: `JOIN${n}`, is_active: '1', created_at: T0,
  })))
  put('users', users())
  put('school_subscriptions', [{ id: 1, school_id: 1, package: 'asas', quota: 100, starts_at: '2026-01-01', ends_at: '2026-12-31' }])
  put('parent_student', [{ parent_id: 9, student_id: 1, relationship: 'bapa' }, { parent_id: 9, student_id: 4242, relationship: 'bapa' }])
  put('subjects', [1, 2, 3].map((n) => ({ id: n, name_bm: `Mata Pelajaran Contoh ${n}`, name_en: `Sample Subject ${n}`, code: `MP${n}`, is_core: '1', sort_order: n })))
  put('education_levels', [1, 2].map((n) => ({ id: n, name_bm: `Darjah Contoh ${n}`, name_en: `Level Sample ${n}`, sort_order: n, curriculum: 'kssr', stage: 'primary' })))
  put('chapters', [
    { id: 1, subject_id: 1, education_level_id: 1, number: 1, title: 'Bab Contoh 1', strand: 'A' },
    { id: 2, subject_id: 1, education_level_id: 1, number: 2, title: 'Bab Contoh 2', strand: 'A' },
    { id: 3, subject_id: 2, education_level_id: 2, number: 1, title: 'Bab Contoh 3', strand: 'B' },
    { id: 4, subject_id: 888, education_level_id: 2, number: 2, title: 'Bab Yatim', strand: 'B' },
  ])
  put('topics', [1, 2, 3, 4, 5].map((n) => ({ id: n, chapter_id: n === 5 ? 12345 : ((n - 1) % 3) + 1, subject_id: 1, name: `Topik Contoh ${n}`, sort_order: n })))
  put('classrooms', [1, 2, 3].map((n) => ({ id: n, name: `Kelas Contoh ${n}`, code: `KLS${n}`, teacher_id: n === 3 ? null : 7, school_id: n, subject_id: 1, session_year: '2026' })))
  put('classroom_student', [
    { classroom_id: 1, student_id: 1 }, { classroom_id: 1, student_id: 2 }, { classroom_id: 2, student_id: 3 },
    { classroom_id: 2, student_id: 9999 }, { classroom_id: 77, student_id: 4 }, { classroom_id: 1, student_id: 1 },
  ])
  put('question_sets', [{ id: 1, teacher_id: 7, title: 'Set Contoh 1', subject_id: 1, education_level_id: 1, status: 'draf' }])
  put('practice_sessions', [1, 2, 3, 4, 5].map((n) => ({
    id: n, user_id: n, subject_id: 1, mode: n === 5 ? 'mod_baru' : 'latih_tubi', paper: 'paper1', client_uuid: `00000000-0000-0000-0000-00000000000${n}`,
    total_questions: 10, correct: n + 3, accuracy: (n + 3) * 10, duration_seconds: 300, syiling_earned: n, started_at: T0, created_at: T0,
  })))
  put('question_attempts', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: n, user_id: (n % 6) + 1, practice_session_id: n === 8 ? 404 : ((n - 1) % 5) + 1, question_id: n === 7 ? 31337 : ((n - 1) % 6) + 1,
    selected_option: 'A', is_correct: n % 2 === 0 ? '1' : '0', time_seconds: 10 + n, created_at: T0,
  })))
  put('review_schedules', [{ id: 1, user_id: 1, question_id: 1, ease_factor: 2.5, interval_days: 1, repetitions: 1, lapses: 0, next_due_at: T0 }])
  put('student_notes', [{ id: 1, user_id: 1, subject_id: 1 }])
  put('mood_checkins', [{ id: 1, user_id: 1, mood: 'gembira', checked_in_on: '2026-01-02' }, { id: 2, user_id: 2, mood: 'sedih', checked_in_on: '2026-01-02' }])
  put('feedback', [{ id: 1, user_id: 1, score: 9, satisfaction: 5, usability: 4, relevance: 5, comment: 'Komen contoh.' }])
  put('gamification_tiers', [{ id: 1, label_ms: 'Peringkat Contoh', perks: 'Contoh', sort_order: 1 }])
  put('student_wallets', [1, 2, 3, 4].map((n) => ({ id: n, user_id: n, syiling_balance: n * 10, syiling_lifetime: n * 20, streak_days: n, gamification_tier_id: 1 })))
  put('coin_transactions', ['earn', 'earn', 'spend', 'bonus', 'earn', 'mystery'].map((type, i) => ({
    id: i + 1, user_id: (i % 4) + 1, type, source: 'practice', amount: 5, balance_after: 5 * (i + 1), created_at: T0,
  })))
  put('challenges', [{ id: 1, created_by: null, classroom_id: null, challenge_type: 'harian', title: 'Cabaran Contoh', target_value: 5, reward_syiling: 10, reward_xp: 5, difficulty: 'medium', is_active: '1', sort_order: 1 }])
  put('challenge_user', [{ challenge_id: 1, user_id: 1, progress: 3, completed_at: T0, claimed_on: '2026-01-02' }])
  put('achievements', [{ id: 1, name: 'Pencapaian Contoh', criteria: 'Contoh' }])
  put('achievement_user', [{ achievement_id: 1, user_id: 1, unlocked_at: T0 }])
  put('battles', [{ id: 1, mode: '1v1', total_questions: 5, duration_seconds: 120, status: 'selesai' }, { id: 2, mode: 'quick_match', total_questions: 5, duration_seconds: 120, status: 'selesai' }])
  put('battle_participants', [
    { id: 1, battle_id: 1, user_id: 1, score: 3, accuracy: 60, is_bot: '0', target_score: 0, answered: 5 },
    { id: 2, battle_id: 1, user_id: 2, score: 2, accuracy: 40, is_bot: '0', target_score: 0, answered: 5 },
    { id: 3, battle_id: 2, user_id: 3, score: 4, accuracy: 80, is_bot: '0', target_score: 0, answered: 5 },
    { id: 4, battle_id: 2, user_id: null, score: 1, accuracy: 20, is_bot: '1', target_score: 1, answered: 5 },
  ])
  put('games', [{ id: 1, name: 'Permainan Contoh', type: 'solo', config: { level: 1 } }])
  put('game_sessions', [{ id: 1, game_id: 1, user_id: 1, score: 7, result: 'menang' }])
  put('banners', [{ id: 1, title: 'Sepanduk Contoh', type: 'info', target: '/', sort_order: 1, is_active: '1' }])
  put('articles', [{ id: 1, slug: 'artikel-contoh', category: 'umum', title: 'Artikel Contoh', views: 1, is_published: '1', author_id: 12 }])
  put('support_tickets', [{ id: 1, user_id: 1, subject: 'Tiket contoh', status: 'dibuka' }, { id: 2, user_id: 2, subject: 'Tiket contoh 2', status: 'ditutup', admin_reply: 'Balasan contoh.' }])
  put('settings', [{ id: 1, key: 'app.name', value: 'Contoh', group: 'umum' }])
  put('feature_flags', [{ id: 1, slug: 'bijak', enabled: '1', audience: 'semua' }])
  put('packages', [{ id: 1, name: 'Pakej Contoh', tier: 'asas', price: 10.5, duration_days: 30 }])
  put('payments', [{ id: 1, user_id: 1, package_id: 1, amount: 10.5, status: 'berjaya' }])
  put('invoices', [{ id: 1, payment_id: 1, amount: 10.5, status: 'dibayar' }])
  put('exam_attempts', [{ id: 1, user_id: 1, exam_paper_id: 1, mode: 'latihan', status_id: 2, score: 20, max_score: 40, section_scores: { a: 10, b: 10 }, section_selections: null, served_composition: null }])

  // Lookups (id, slug): fixed ids as seeded in .cloud (docs/discovery/BIJAK-SPM-cloud.md section 7); only what the rows above point at.
  put('attempt_statuses', ['in_progress', 'submitted', 'marked'].map((slug, i) => ({ id: i + 1, slug })))
  put('paper_statuses', ['draft', 'in_review', 'published', 'archived'].map((slug, i) => ({ id: i + 1, slug })))

  // Archive (question bank)
  put('questions', [1, 2, 3, 4, 5, 6].map((n) => ({
    id: n, subject_id: 1, education_level_id: 1, chapter_id: 1, topic_id: 1, difficulty_level: n % 2 ? 'mudah' : 'sukar', type: 'objektif', status: n === 6 ? 'diarkib' : 'diluluskan', body: `Soalan contoh ${n}.`,
  })))
  put('question_options', [1, 2, 3, 4].map((n) => ({ id: n, question_id: n === 4 ? 555 : 1, label: 'ABCD'[n - 1], body: `Pilihan ${n}`, is_correct: n === 1 ? '1' : '0' })))
  put('source_papers', [{ id: 1, natural_key: 'contoh-2025-1', file_hash: '0'.repeat(64), year: 2025, exam_board_id: 1, exam_type_id: 1 }])
  put('exam_papers', [{ id: 1, status_id: 3, title: 'Kertas Contoh' }])
  put('teacher_reference_papers', [{ id: 1, teacher_id: null }])
  put('legacy_canonical_map', [{ id: 1, source: 'questions', legacy_id: '1', canonical_type: 'exam_question', canonical_id: 1 }, { id: 2, source: 'spm_set', legacy_id: '9', canonical_type: 'exam_paper', canonical_id: 1 }])
  put('exam_boards', [{ id: 1, slug: 'contoh_lembaga' }])
  put('exam_types', [{ id: 1, slug: 'contoh_jenis' }])
  return t
}

/** File name to content for the whole fixture (manifest included), keys sorted. */
export function generateTinyFixture(): Map<string, string> {
  const tables = build()
  const files = new Map<string, string>()
  const manifestTables: Record<string, { rows: number; file?: string }> = {}
  for (const spec of TABLES) {
    const rows = tables.get(spec.name) ?? []
    if (rows.length === 0) {
      manifestTables[spec.name] = { rows: 0 }
      continue
    }
    const file = `${spec.name}.ndjson`
    manifestTables[spec.name] = { rows: rows.length, file }
    files.set(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)
  }
  for (const name of tables.keys()) if (!manifestTables[name]) throw new Error(`Fixture table "${name}" is not in the spec.`)
  const manifest = { format: DUMP_FORMAT, source: 'cloud', synthetic: true, tables: manifestTables }
  files.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
  return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

export function writeTinyFixture(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const [name, content] of generateTinyFixture()) writeFileSync(join(dir, name), content, 'utf8')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = fileURLToPath(new URL('./cloud-tiny', import.meta.url))
  writeTinyFixture(dir)
  console.log(`Wrote ${dir}`)
}
