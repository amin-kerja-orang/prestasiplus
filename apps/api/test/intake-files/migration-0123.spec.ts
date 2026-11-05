import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T03, migration 0123 (DM-07 plus D4, D6, D8): section_label on items and versions, the item to stimulus join, the stimulus image, the file role. */
describe('migration 0123 section label, item stimuli, stimulus image, file role', () => {
  let db: TestDatabase
  let batchId: string
  beforeAll(async () => {
    db = await createTestDatabase()
    batchId = (
      await db.query<{ id: string }>(
        `insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own') returning id::text`,
      )
    )[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const item = async (label: string, section: string | null = null): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `insert into intake_items (batch_id, position, number_label, item_type, payload, section_label) values ($1, 1, $2, 'mcq', '{}', $3) returning id::text`,
        [batchId, label, section],
      )
    )[0]!.id
  const stimulus = async (ref: string): Promise<string> =>
    (await db.query<{ id: string }>(`insert into intake_stimuli (batch_id, ref, kind) values ($1, $2, 'diagram') returning id::text`, [batchId, ref]))[0]!.id

  it('adds a nullable section_label to intake_items and question_versions, limited to 1..100 characters', async () => {
    await item('1')
    await item('2', 'Bahagian A')
    const rows = await db.query<{ n: string }>(`select count(*)::text n from information_schema.columns where column_name = 'section_label' and table_name in ('intake_items', 'question_versions') and is_nullable = 'YES'`)
    expect(rows[0]?.n).toBe('2')
    await expect(item('3', '')).rejects.toThrow(/ck_intake_items_section_label/)
    await expect(item('4', 'x'.repeat(101))).rejects.toThrow(/ck_intake_items_section_label/)
  })

  it('links an item to up to 3 stimuli with a position 1..3, once per stimulus', async () => {
    const i = await item('5')
    const s1 = await stimulus('a')
    const s2 = await stimulus('b')
    await db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values ($1, $2, 1), ($1, $3, 2)`, [i, s1, s2])
    await expect(db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values ($1, $2, 3)`, [i, s1])).rejects.toThrow(/intake_item_stimuli_pkey/)
    await expect(db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values ($1, $2, 4)`, [i, await stimulus('c')])).rejects.toThrow(/ck_intake_item_stimuli_position/)
    await expect(db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values ($1, $2, 0)`, [i, await stimulus('d')])).rejects.toThrow(/ck_intake_item_stimuli_position/)
  })

  it('removes the links with the item (cascade) and with the stimulus (cascade); refuses an unknown item', async () => {
    const i = await item('6')
    const s = await stimulus('e')
    await db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values ($1, $2, 1)`, [i, s])
    await db.query(`delete from intake_items where id = $1`, [i])
    expect((await db.query<{ n: string }>(`select count(*)::text n from intake_item_stimuli where intake_item_id = $1`, [i]))[0]?.n).toBe('0')
    const i2 = await item('7')
    await db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values ($1, $2, 1)`, [i2, s])
    await db.query(`delete from intake_stimuli where id = $1`, [s])
    expect((await db.query<{ n: string }>(`select count(*)::text n from intake_item_stimuli where intake_item_id = $1`, [i2]))[0]?.n).toBe('0')
    await expect(db.query(`insert into intake_item_stimuli (intake_item_id, intake_stimulus_id, position) values (999999, 999999, 1)`)).rejects.toThrow(/fk_intake_item_stimuli/)
  })

  it('adds a nullable intake_stimuli.image_file_id that goes null when the file is deleted', async () => {
    const f = (
      await db.query<{ id: string }>(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('${'i'.repeat(22)}', 'question_image', 'image/png', 1, repeat('a', 64), 'k') returning id::text`)
    )[0]!.id
    const s = await stimulus('f')
    expect((await db.query<{ v: string | null }>(`select image_file_id::text v from intake_stimuli where id = $1`, [s]))[0]?.v).toBeNull()
    await db.query(`update intake_stimuli set image_file_id = $1 where id = $2`, [f, s])
    await db.query(`delete from files where id = $1`, [f])
    expect((await db.query<{ v: string | null }>(`select image_file_id::text v from intake_stimuli where id = $1`, [s]))[0]?.v).toBeNull()
    await expect(db.query(`update intake_stimuli set image_file_id = 999999 where id = $1`, [s])).rejects.toThrow(/fk_intake_stimuli_image_file_id/)
  })

  it('adds intake_files.role, default paper, only paper or scheme', async () => {
    const file = (
      await db.query<{ id: string }>(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('${'r'.repeat(22)}', 'intake_original', 'application/pdf', 1, repeat('b', 64), 'k2') returning id::text`)
    )[0]!.id
    const add = (role?: string) =>
      db.query<{ role: string }>(
        role === undefined
          ? `insert into intake_files (batch_id, file_id, original_name, sha256, size_bytes) values ($1, $2, 'a.pdf', repeat('c', 64), 1) returning role`
          : `insert into intake_files (batch_id, file_id, original_name, sha256, size_bytes, role) values ($1, $2, 'a.pdf', repeat('c', 64), 1, '${role}') returning role`,
        [batchId, file],
      )
    expect((await add())[0]?.role).toBe('paper')
    expect((await add('scheme'))[0]?.role).toBe('scheme')
    await expect(add('bogus')).rejects.toThrow(/ck_intake_files_role/)
  })
})
