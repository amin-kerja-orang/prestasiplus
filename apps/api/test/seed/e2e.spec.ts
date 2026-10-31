/**
 * Local / E2E seed (R1-B19, T26): default off, guarded by profile `e2e` plus `E2E_SEED=1`; with the guard on it creates a Tingkatan 4
 * pupil, an Admin Pusat and one Disahkan T4 blueprint through the Sahkan checks, and the pupil can Jana Kertas against it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { E2E_ADMIN_EMAIL, E2E_EVIDENCE_NOTE, E2E_PUPIL_EMAIL, e2eSeed, e2eSeedEnabled } from '../../prisma/seed/e2e'
import { examSeed } from '../../prisma/seed/exam'
import { examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { examLaunchBlueprintsSeed } from '../../prisma/seed/exam-launch-blueprints'
import { bootPapersApp, expectError, loginAs, type PapersTestApp } from '../bijak-papers/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

const BASE = [identitySeed, curriculumSeed, examSeed, examDemoBlueprintsSeed, examLaunchBlueprintsSeed]
const FLAGGED = { ...process.env, E2E_SEED: '1' }
const CODE = '3472/2'

describe('e2e seed guard', () => {
  afterEach(() => {
    delete process.env.E2E_SEED
  })

  it('is enabled only by an explicit E2E_SEED=1 or true', () => {
    expect(e2eSeedEnabled({})).toBe(false)
    expect(e2eSeedEnabled({ E2E_SEED: '0' })).toBe(false)
    expect(e2eSeedEnabled({ E2E_SEED: 'yes' })).toBe(false)
    expect(e2eSeedEnabled({ E2E_SEED: '1' })).toBe(true)
    expect(e2eSeedEnabled({ E2E_SEED: 'true' })).toBe(true)
  })

  it('is registered for the e2e profile only: the poc and default profiles never run it', async () => {
    const db = await createTestDatabase()
    try {
      await runSeeds(BASE, { prisma: db.prisma })
      const poc = await runSeeds([...BASE, e2eSeed], { prisma: db.prisma, profile: 'poc', env: FLAGGED })
      expect(poc).not.toContain('e2e-bijak')
      expect(await db.query(`select 1 from users where email = $1`, [E2E_PUPIL_EMAIL])).toHaveLength(0)
    } finally {
      await db.drop()
    }
  }, 180_000)

  it('profile e2e without the flag creates nothing (default off); the flag is read from the runner env, not from process.env', async () => {
    const db = await createTestDatabase()
    try {
      await runSeeds(BASE, { prisma: db.prisma })
      process.env.E2E_SEED = '1'
      await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: { ...process.env, E2E_SEED: undefined } })
      expect(await db.query(`select 1 from users where email in ($1, $2)`, [E2E_PUPIL_EMAIL, E2E_ADMIN_EMAIL])).toHaveLength(0)
      expect(await db.query(`select 1 from blueprints where source = 'verified'`)).toHaveLength(0)
    } finally {
      await db.drop()
    }
  }, 180_000)
})

describe('e2e seed refuses a run that counts as production', () => {
  it('throws before touching the database, even with ALLOW_DEMO_SEED and E2E_SEED', async () => {
    const db = await createTestDatabase()
    try {
      await runSeeds(BASE, { prisma: db.prisma })
      for (const nodeEnv of ['production', undefined, 'staging']) {
        const env = { NODE_ENV: nodeEnv, ALLOW_DEMO_SEED: 'true', E2E_SEED: '1' }
        await expect(runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env })).rejects.toThrow(/counts as production/)
      }
      // without ALLOW_DEMO_SEED the runner skips the demo module, as for every demo seed
      expect(await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: { NODE_ENV: 'production', E2E_SEED: '1' } })).toEqual([])
      expect(await db.query(`select 1 from users where email in ($1, $2)`, [E2E_PUPIL_EMAIL, E2E_ADMIN_EMAIL])).toHaveLength(0)
      expect(await db.query(`select 1 from blueprints where source = 'verified'`)).toHaveLength(0)
    } finally {
      await db.drop()
    }
  }, 180_000)
})

describe('e2e seed with the guard on', () => {
  let db: TestDatabase
  let t: PapersTestApp

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([...BASE, e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
    t = await bootPapersApp({ db })
  }, 240_000)
  afterAll(async () => {
    await t.close()
    await db.drop()
  })

  it('creates a Tingkatan 4 pupil and an Admin Pusat with fictitious example.test accounts', async () => {
    const pupil = (await db.query<{ grade: number; roles: string[]; name: string }>(
      `select u.grade, u.name, array(select role from user_roles r where r.user_id = u.id) roles from users u where u.email = $1`,
      [E2E_PUPIL_EMAIL],
    ))[0]
    expect(pupil).toMatchObject({ grade: 10, roles: ['student'], name: 'Murid Ujian E2E' })
    const admin = (await db.query<{ roles: string[]; level: string }>(
      `select array(select role from user_roles r where r.user_id = u.id) roles, (select level from user_scopes s where s.user_id = u.id and s.role = 'admin') level
         from users u where u.email = $1`,
      [E2E_ADMIN_EMAIL],
    ))[0]
    expect(admin).toEqual({ roles: ['admin'], level: 'national' })
    expect(E2E_PUPIL_EMAIL).toMatch(/@example\.test$/)
    expect(E2E_ADMIN_EMAIL).toMatch(/@example\.test$/)
  })

  it('moves one T4 launch blueprint to Disahkan with a verification row, 2+ evidence bodies and serves_students', async () => {
    const bp = (await db.query<{ id: string; source: string; serves_students: boolean; verification_id: string | null }>(
      `select id::text, source, serves_students, verification_id::text from blueprints where code = $1 and status = 'active'`,
      [CODE],
    ))[0]
    expect(bp).toMatchObject({ source: 'verified', serves_students: true })
    expect(bp?.verification_id).not.toBeNull()
    const v = (await db.query<{ snapshot: { body: string }[]; by: string }>(
      `select evidence_snapshot snapshot, verified_by_id::text by from blueprint_verifications where id = $1`,
      [bp?.verification_id],
    ))[0]
    expect(new Set(v?.snapshot.map((e) => e.body)).size).toBeGreaterThanOrEqual(2)
    const admin = (await db.query<{ id: string }>(`select id::text from users where email = $1`, [E2E_ADMIN_EMAIL]))[0]
    expect(v?.by).toBe(admin?.id)
    // the other launch blueprints stay Spec
    expect(await db.query(`select 1 from blueprints where provenance = 'paper' and code <> $1 and source = 'verified'`, [CODE])).toHaveLength(0)
  })

  it('H-A15: Sahkan counts only admin-origin evidence, so the seed replaces the study rows by admin rows labelled as an E2E fixture (and keeps their values)', async () => {
    const rows = await db.query<{ origin: string; note: string | null; body: string; created_by_id: string | null }>(
      `select e.origin, e.note, e.body, e.created_by_id::text from blueprint_evidence e join blueprints b on b.id = e.blueprint_id where b.code = $1 and b.status = 'active'`,
      [CODE],
    )
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows.every((r) => r.origin === 'admin' && r.note === E2E_EVIDENCE_NOTE && r.created_by_id !== null)).toBe(true)
    expect(new Set(rows.map((r) => r.body)).size).toBeGreaterThanOrEqual(2)
    const v = (await db.query<{ note: string; snapshot: { origin: string }[] }>(
      `select v.note, v.evidence_snapshot snapshot from blueprint_verifications v join blueprints b on b.id = v.blueprint_id where b.code = $1`,
      [CODE],
    ))[0]
    expect(v?.note?.trim().length).toBeGreaterThan(0)
    expect(v?.snapshot.every((e) => e.origin === 'admin')).toBe(true)
  })

  it('is idempotent: a second run keeps one verification row and the same accounts', async () => {
    await runSeeds([e2eSeed], { prisma: db.prisma, profile: 'e2e', env: FLAGGED })
    expect(await db.query(`select 1 from blueprint_verifications v join blueprints b on b.id = v.blueprint_id where b.code = $1`, [CODE])).toHaveLength(1)
    expect(await db.query(`select 1 from users where email in ($1, $2)`, [E2E_PUPIL_EMAIL, E2E_ADMIN_EMAIL])).toHaveLength(2)
  })

  it('the pupil can Jana Kertas against it: 201, or a 422 SHORTAGE that the question bank explains (never NO_BLUEPRINT)', async () => {
    // Blueprint 3472/2 asks for structured Matematik Tambahan questions of 5 to 10 marks per unit (Bahagian A, B, C). The only pool seed
    // (`questions-pool`) holds single-part MCQs of 1 mark, so no honest pool exists for it and the seed adds none: today this answers
    // 422 SHORTAGE with have 0. The test stays correct if a structured pool is ever seeded.
    const pupil = await loginAs(t, E2E_PUPIL_EMAIL)
    const contracts = (await pupil.get('/api/bijak/contracts')).body.data as { code: string; subject: string; kertas: number; canGenerate: boolean }[]
    const mine = contracts.find((c) => c.code === CODE)
    expect(mine?.canGenerate).toBe(true)
    const res = await pupil.post('/api/bijak/papers/generate', { subject: mine?.subject, kertas: mine?.kertas })
    if (res.status === 201) {
      expect(res.body.data.paperId).toBeTruthy()
    } else {
      expectError(res, 'SHORTAGE', 422)
    }
  })
})
