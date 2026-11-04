/**
 * Profile `uat-like` (S4-T01, D110/D115): a small deterministic CI fixture set, not acceptance data. Runs the profile on a fresh test
 * database, checks every fixture minimum (`>=`, and the zeros exactly), a no-op second run and that the excluded modules did not run.
 */
import { createHash } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules, UAT_LIKE_BASE_MODULES, UAT_LIKE_PROFILE } from '../../prisma/seed'
import { UAT_LIKE_PUPILS, UAT_LIKE_REUSED_EMAILS } from '../../prisma/seed/uat-like/accounts'
import { UAT_LIKE_LABEL_PREFIX, UAT_LIKE_PER_SHAPE } from '../../prisma/seed/uat-like/questions'
import { createTestDatabase, type TestDatabase } from '../support/db'

const ENV = { NODE_ENV: 'test' }
const count = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> => Number((await db.query<{ n: string }>(sql, params))[0]?.n)
const SHAPE_LABEL = (shape: string): string => `${UAT_LIKE_LABEL_PREFIX}${shape}-%`

/** Stable content of the fixture tables (password hashes and `updated_at` excluded). */
async function fingerprint(db: TestDatabase): Promise<{ hash: string; counts: Record<string, number> }> {
  const h = createHash('sha256')
  const counts: Record<string, number> = {}
  const cols: Record<string, string> = {
    schools: 'id, code, name, state, district, type, is_active',
    users: 'id, name, email, school_id, grade, is_active, is_suspended',
    user_roles: 'id, user_id, role',
    question_versions: 'id, question_id, status, stem_ms, number_label, chapter_id, unit_node_id, subject_id, education_level_id',
    question_parts: 'id, question_version_id, prompt_ms',
    question_version_sp_nodes: 'question_version_id, node_id',
    papers: 'id',
    blueprints: 'id',
  }
  for (const [table, c] of Object.entries(cols)) {
    const rows = await db.query(`select ${c} from ${table} order by 1, 2`)
    counts[table] = rows.length
    h.update(table).update(JSON.stringify(rows, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)))
  }
  return { hash: h.digest('hex'), counts }
}

describe('uat-like seed profile (S4-T01): CI fixtures only, not acceptance evidence', () => {
  let db: TestDatabase
  let ran: string[]
  let first: Awaited<ReturnType<typeof fingerprint>>

  beforeAll(async () => {
    db = await createTestDatabase()
    ran = await runSeeds(seedModules, { prisma: db.prisma, profile: UAT_LIKE_PROFILE, env: ENV })
    first = await fingerprint(db)
  }, 240_000)
  afterAll(async () => {
    await db.drop()
  })

  it('runs exactly the include list plus the profile fixtures, and none of the excluded modules', () => {
    const expected = seedModules.filter((m) => (m.profiles ? m.profiles.includes(UAT_LIKE_PROFILE) : UAT_LIKE_BASE_MODULES.has(m.name))).map((m) => m.name)
    expect(ran).toEqual(expected)
    expect(ran).toContain('uat-like-fixtures')
    for (const name of UAT_LIKE_BASE_MODULES) expect(ran).toContain(name)
    for (const name of ['questions', 'questions-pool', 'exam', 'exam-demo-blueprints', 'exam-launch-blueprints', 'e2e-bijak', 'poc-profile', 'core-population']) {
      expect(ran).not.toContain(name)
    }
  })

  it('every include-list name is a registered module without profiles', () => {
    for (const name of UAT_LIKE_BASE_MODULES) {
      const m = seedModules.find((x) => x.name === name)
      expect(m, name).toBeDefined()
      expect(m?.profiles, name).toBeUndefined()
    }
  })

  it('creates no paper, no blueprint and no contract (Kontrak = blueprint)', async () => {
    expect(await count(db, 'select count(*)::text n from papers')).toBe(0)
    expect(await count(db, 'select count(*)::text n from blueprints')).toBe(0)
    expect(await count(db, 'select count(*)::text n from blueprint_verifications')).toBe(0)
    expect(await count(db, 'select count(*)::text n from exam_attempts')).toBe(0)
    // the bank holds only the fixture questions: the demo question bank did not run
    expect(await count(db, `select count(*)::text n from question_versions where number_label is distinct from null and number_label not like 'UATLIKE-%'`)).toBe(0)
    expect(await count(db, `select count(*)::text n from question_versions where number_label is null`)).toBe(0)
  })

  it('has at least 3 schools', async () => {
    expect(await count(db, 'select count(*)::text n from schools where is_active')).toBeGreaterThanOrEqual(3)
  })

  it('has one active pupil per level Tingkatan 1 to 5 (grades 7 to 11)', async () => {
    for (const grade of [7, 8, 9, 10, 11]) {
      const n = await count(
        db,
        `select count(*)::text n from users u join user_roles r on r.user_id = u.id and r.role = 'student' where u.grade = $1 and u.is_active and not u.is_suspended and u.school_id is not null`,
        [grade],
      )
      expect(n, `grade ${grade}`).toBeGreaterThanOrEqual(1)
    }
    for (const e of [UAT_LIKE_REUSED_EMAILS.pupilT4, UAT_LIKE_REUSED_EMAILS.pupilT5]) {
      expect(await count(db, 'select count(*)::text n from users where email = $1', [e])).toBe(1)
    }
  })

  it('has an Admin Pusat, an Admin Sekolah of one school and a Guru', async () => {
    expect(
      await count(db, `select count(*)::text n from users u join user_roles r on r.user_id = u.id and r.role = 'admin' join user_scopes s on s.user_id = u.id and s.role = 'admin' and s.level = 'national'`),
    ).toBeGreaterThanOrEqual(1)
    expect(
      await count(db, `select count(*)::text n from users u join user_roles r on r.user_id = u.id and r.role = 'school_admin' where u.school_id is not null`),
    ).toBeGreaterThanOrEqual(1)
    expect(await count(db, `select count(*)::text n from users u join user_roles r on r.user_id = u.id and r.role = 'teacher'`)).toBeGreaterThanOrEqual(1)
    for (const e of [UAT_LIKE_REUSED_EMAILS.adminPusat, UAT_LIKE_REUSED_EMAILS.adminSekolah, UAT_LIKE_REUSED_EMAILS.guru]) {
      expect(await count(db, 'select count(*)::text n from users where email = $1', [e])).toBe(1)
    }
  })

  it('uses fictitious contoh.invalid e-mails and Murid Contoh names for the accounts it creates', async () => {
    for (const p of UAT_LIKE_PUPILS) {
      expect(p.email).toMatch(/^pengguna\d{5}@contoh\.invalid$/)
      expect(p.name).toMatch(/^Murid Contoh \d{5}$/)
      expect(await count(db, 'select count(*)::text n from users where email = $1 and name = $2', [p.email, p.name])).toBe(1)
    }
  })

  describe('defect-shape questions on Sains Tingkatan 4 (approved), at least 5 each', () => {
    const base = `from question_versions v join questions q on q.id = v.question_id and q.live_version_no = v.version_no
      where v.status = 'approved' and v.number_label like $1 and v.unit_node_id is not null
        and v.subject_id = (select id from subjects where code = 'SCI') and v.education_level_id = (select id from education_levels where code = 'T4')`

    it('no Bab: chapter is null', async () => {
      expect(await count(db, `select count(*)::text n ${base} and v.chapter_id is null`, [SHAPE_LABEL('NOBAB')])).toBeGreaterThanOrEqual(5)
    })
    it('no SP: no SP tag', async () => {
      expect(
        await count(db, `select count(*)::text n ${base} and v.chapter_id is not null and not exists (select 1 from question_version_sp_nodes s where s.question_version_id = v.id)`, [SHAPE_LABEL('NOSP')]),
      ).toBeGreaterThanOrEqual(5)
    })
    it('stimulus-less "Rajah n" stems', async () => {
      expect(
        await count(
          db,
          `select count(*)::text n ${base} and v.stem_ms ~ 'Rajah [0-9]+' and q.group_id is null and not exists (select 1 from question_version_stimuli s where s.question_version_id = v.id)`,
          [SHAPE_LABEL('RAJAH')],
        ),
      ).toBeGreaterThanOrEqual(5)
    })
    it('duplicated stems: the stem is repeated as the only part prompt', async () => {
      expect(
        await count(
          db,
          `select count(*)::text n ${base} and (select count(*) from question_parts p where p.question_version_id = v.id) = 1
             and exists (select 1 from question_parts p where p.question_version_id = v.id and p.prompt_ms = v.stem_ms)`,
          [SHAPE_LABEL('DUP')],
        ),
      ).toBeGreaterThanOrEqual(5)
    })
    it('the per-shape constant is at least 5', () => {
      expect(UAT_LIKE_PER_SHAPE).toBeGreaterThanOrEqual(5)
    })
  })

  it('a second run is a no-op (content hash and counts unchanged)', async () => {
    const again = await runSeeds(seedModules, { prisma: db.prisma, profile: UAT_LIKE_PROFILE, env: ENV })
    expect(again).toEqual(ran)
    const second = await fingerprint(db)
    expect(second.counts).toEqual(first.counts)
    expect(second.hash).toBe(first.hash)
  }, 120_000)
})
