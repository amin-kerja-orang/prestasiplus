import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { DUTA_PROFILES, SPM_SUBJECT_CONFIGS, spmSeed } from '../../prisma/seed/spm'
import { spmSubjectConfigsSeed } from '../../prisma/seed/spm-subject-configs'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { dropDatabase } from '../curriculum/helpers'

let db: TestDatabase
beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, questionsSeed, spmSubjectConfigsSeed, spmSeed], { prisma: db.prisma })
}, 120_000)
afterAll(async () => {
  await dropDatabase(db)
})

const snapshot = async () => ({
  configs: await db.query('select subject_id, grp, display_order, databank_order, target_type, target_size, created_at from spm_subject_configs order by subject_id'),
  duta: await db.query('select slug, name, tier, rating::text, is_active from duta_profiles order by slug'),
  sets: await db.query('select subject_id, year, set_no, dskp_tagged from spm_tracking_sets order by subject_id, set_no'),
  links: await db.query('select set_id, question_id, position from spm_tracking_set_questions order by set_id, position'),
})

describe('SPM seed', () => {
  it('the configuration module is a reference seed that skips subjects that do not exist', async () => {
    expect(spmSubjectConfigsSeed.kind).toBe('reference')
    expect(spmSeed.kind).toBe('demo')
    const other = await createTestDatabase()
    try {
      // No curriculum: every code is skipped without error.
      await runSeeds([spmSubjectConfigsSeed], { prisma: other.prisma })
      expect(await other.query('select 1 from spm_subject_configs')).toHaveLength(0)
    } finally {
      await dropDatabase(other)
    }
  })

  it('loads the 19 subject configs of the mock (groups, orders, targets) by subject code', async () => {
    expect(SPM_SUBJECT_CONFIGS).toHaveLength(19)
    const rows = await db.query<{ code: string; grp: string; display_order: number; databank_order: number | null; target_type: string | null; target_size: number | null }>(
      'select s.code, c.grp, c.display_order, c.databank_order, c.target_type, c.target_size from spm_subject_configs c join subjects s on s.id = c.subject_id order by s.code',
    )
    expect(rows).toHaveLength(19)
    const by = Object.fromEntries(rows.map((r) => [r.code, r]))
    expect(by.BM).toMatchObject({ grp: 'teras', display_order: 0, databank_order: 0, target_type: 'custom', target_size: 34 })
    expect(by.BI).toMatchObject({ target_type: 'custom', target_size: 36 })
    expect(by.MATH).toMatchObject({ target_type: 'spm', target_size: 40 })
    expect(by.ADDMATH).toMatchObject({ grp: 'elektif', target_type: 'latihan', target_size: 20 })
    expect(by.PERNIAGA).toMatchObject({ target_type: null, target_size: null })
    expect(by.BA).toMatchObject({ databank_order: null, target_type: 'latihan', target_size: 40 })
    // 18 subjects on the Tahun Lepas list, 7 teras and 12 elektif.
    expect(rows.filter((r) => r.databank_order !== null)).toHaveLength(18)
    expect(new Set(rows.filter((r) => r.databank_order !== null).map((r) => r.databank_order)).size).toBe(18)
    expect(rows.filter((r) => r.grp === 'teras')).toHaveLength(7)
    expect(rows.filter((r) => r.grp === 'elektif')).toHaveLength(12)
  })

  it('the target columns are both set or both null (check constraint)', async () => {
    await expect(db.query(`update spm_subject_configs set target_size = null where target_type = 'spm'`)).rejects.toThrow(/ck_spm_subject_configs_target/)
  })

  it('has five fictitious Duta rows: three active bintang, one inspirasi, one tetamu', async () => {
    expect(DUTA_PROFILES).toHaveLength(5)
    const rows = await db.query<{ slug: string; name: string; tier: string }>('select slug, name, tier from duta_profiles order by slug')
    expect(rows).toHaveLength(5)
    expect(rows.filter((r) => r.tier === 'bintang')).toHaveLength(3)
    expect(rows.every((r) => r.name.startsWith('Cikgu Contoh'))).toBe(true)
  })

  it('builds one Tracking A set per subject with published questions in the seeded bank, in id order', async () => {
    const sets = await db.query<{ code: string; year: number; set_no: number; n: string }>(
      `select s.code, t.year, t.set_no, (select count(*)::text from spm_tracking_set_questions q where q.set_id = t.id) n from spm_tracking_sets t join subjects s on s.id = t.subject_id order by s.code`,
    )
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every((s) => s.year === 2026 && s.set_no === 1 && Number(s.n) >= 1)).toBe(true)
    // Only SPM-pool multiple-choice questions (read through the questions doorway), live-published, in id order.
    const bad = await db.query<{ n: string }>(
      `select count(*)::text n from spm_tracking_set_questions sq
         join questions q on q.id = sq.question_id join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where not (q.is_active and v.status = 'approved' and v.type = 'mcq')`,
    )
    expect(bad[0]?.n).toBe('0')
    const unordered = await db.query<{ n: string }>(
      `select count(*)::text n from spm_tracking_set_questions a join spm_tracking_set_questions b on b.set_id = a.set_id and b.position = a.position + 1 where b.question_id < a.question_id`,
    )
    expect(unordered[0]?.n).toBe('0')
  })

  it('is idempotent: a second run changes nothing', async () => {
    const before = await snapshot()
    await runSeeds([spmSubjectConfigsSeed, spmSeed], { prisma: db.prisma })
    expect(await snapshot()).toEqual(before)
  })

  it('is deterministic: no randomness and no real clock in the seed source', () => {
    for (const file of ['spm.ts', 'spm-subject-configs.ts']) {
      const source = readFileSync(join(__dirname, '../../prisma/seed', file), 'utf8')
      expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(/)
    }
  })
})
