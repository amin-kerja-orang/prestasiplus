import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T01 part 4, migration 0131 (DM-70): the 7 stimulus kinds on intake_stimuli, audio kept on stimuli, stimuli.style. */
const KINDS = ['passage', 'diagram', 'table', 'graph', 'map', 'infographic', 'image'] as const

describe('migration 0131 stimulus kinds and style', () => {
  let db: TestDatabase
  let batch: string

  beforeAll(async () => {
    db = await createTestDatabase()
    batch = (await db.query<{ id: string }>(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own') returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const insertStimulus = (kind: string, style?: string | null) => db.query(`insert into stimuli (kind, style) values ($1, $2)`, [kind, style ?? null])
  const insertIntake = (kind: string, ref: string) => db.query(`insert into intake_stimuli (batch_id, ref, kind) values ($1::bigint, $2, $3)`, [batch, ref, kind])

  it('stimuli.style accepts kotak, null and any text (no check)', async () => {
    await insertStimulus('passage', 'kotak')
    await insertStimulus('passage', null)
    await insertStimulus('passage', 'mono')
    await insertStimulus('passage', 'anything goes here')
    const rows = await db.query<{ style: string | null }>(`select style from stimuli order by id`)
    expect(rows.map((r) => r.style)).toEqual(['kotak', null, 'mono', 'anything goes here'])
  })

  it('stimuli.kind keeps the 7 kinds and audio, and rejects others', async () => {
    for (const kind of [...KINDS, 'audio']) await insertStimulus(kind)
    await expect(insertStimulus('video')).rejects.toThrow(/ck_stimuli_kind/)
  })

  it('intake_stimuli.kind accepts each of the 7 kinds and rejects audio and video', async () => {
    for (const [i, kind] of KINDS.entries()) await insertIntake(kind, `s${String(i)}`)
    await expect(insertIntake('audio', 'a')).rejects.toThrow(/ck_intake_stimuli_kind/)
    await expect(insertIntake('video', 'v')).rejects.toThrow(/ck_intake_stimuli_kind/)
  })

  it('the widened constraint is validated, keeps its name and no temporary constraint is left', async () => {
    const rows = await db.query<{ conname: string; convalidated: boolean }>(
      `select conname, convalidated from pg_constraint where conrelid in ('intake_stimuli'::regclass, 'stimuli'::regclass) and contype = 'c' order by conname`,
    )
    expect(rows.every((r) => r.convalidated)).toBe(true)
    expect(rows.map((r) => r.conname).filter((n) => /kind/.test(n))).toEqual(['ck_intake_stimuli_kind', 'ck_stimuli_kind'])
    expect(rows.some((r) => /_new|_old|tmp/.test(r.conname))).toBe(false)
  })
})
