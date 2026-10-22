import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PracticeReadsModule } from '../../../../src/modules/practice/reads'
import { PerformancePorts } from '../../../../src/modules/reports/performance'
import { bootIntegrationApp, type IntegrationApp } from '../../../bijak-integration/helpers'

/**
 * A district name is only unique inside its state (security Medium, AM1-2 G4). The real practice and Bijak
 * read adapters must match a district together with its state; a district without a state matches nothing.
 */
let t: IntegrationApp
let ports: PerformancePorts

beforeAll(async () => {
  t = await bootIntegrationApp({ extraModules: [PracticeReadsModule] })
  ports = t.app.get(PerformancePorts)
  const [subject] = await t.db.query<{ id: string }>(`select id::text from subjects order by id limit 1`)
  const [level] = await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T4'`)
  for (const [code, state] of [['DN1', 'Negeri Satu'], ['DN2', 'Negeri Dua']] as const) {
    const [school] = await t.db.query<{ id: string }>(
      `insert into schools (name, code, state, district) values ($1, $2, $3, 'Daerah Kembar') returning id::text`,
      [`Sekolah ${code}`, code, state],
    )
    const [user] = await t.db.query<{ id: string }>(`insert into users (name, email, school_id) values ($1, $2, $3::bigint) returning id::text`, [
      `Murid ${code}`,
      `${code.toLowerCase()}@demo.test`,
      school!.id,
    ])
    await t.db.query(
      `insert into practice_sessions (user_id, subject_id, education_level_id, mode, question_count, status, correct_count, coins_earned, started_at, completed_at, is_test)
       values ($1::bigint, $2::bigint, $3::bigint, 'random', 10, 'completed', 5, 1, now(), now(), false)`,
      [user!.id, subject!.id, level!.id],
    )
    const [a] = await t.db.query<{ id: string }>(
      `insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, duration_min, submitted_at, is_test)
       values ($1::bigint, 'pilihan', 'Kertas ujian', 'MAT', 'Matematik', 1, 'UJ/1', 'latihan', 'submitted', now() - interval '1 hour', 60, now(), false) returning id::text`,
      [user!.id],
    )
    await t.db.query(
      `insert into attempt_results (attempt_id, score, max_score, provisional, pending_review, graded) values ($1::uuid, 5, 10, false, 0, $2::jsonb)`,
      [a!.id, JSON.stringify({ sections: [], questions: [] })],
    )
  }
})
afterAll(async () => {
  await t.close()
})

describe('practice read adapter: district needs its state', () => {
  it('state + district matches only the school of that state', async () => {
    expect(await ports.practice.userTotals({ state: 'Negeri Satu', district: 'Daerah Kembar' })).toHaveLength(1)
  })
  it('the same district name in a state with no such school matches nothing', async () => {
    expect(await ports.practice.userTotals({ state: 'Negeri Tiga', district: 'Daerah Kembar' })).toEqual([])
  })
  it('a district without a state matches nothing (not both states)', async () => {
    expect(await ports.practice.userTotals({ district: 'Daerah Kembar' })).toEqual([])
  })
  it('a state alone still matches its schools', async () => {
    expect(await ports.practice.userTotals({ state: 'Negeri Dua' })).toHaveLength(1)
  })
})

describe('Bijak aggregate adapter: district needs its state', () => {
  it('state + district matches only the school of that state', async () => {
    expect(await ports.bijak.sittings({ state: 'Negeri Satu', district: 'Daerah Kembar' })).toHaveLength(1)
  })
  it('a district without a state matches nothing (not both states)', async () => {
    expect(await ports.bijak.sittings({ district: 'Daerah Kembar' })).toEqual([])
  })
  it('a state alone still matches its schools', async () => {
    expect(await ports.bijak.sittings({ state: 'Negeri Dua' })).toHaveLength(1)
  })
})
