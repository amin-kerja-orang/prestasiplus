import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { filterOf } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S1-T06 (FR-X1-4f): pupil serving drops a question whose image stimulus has no file, and a whole stimulus group when one of its stimuli has no file
 * (complete-group rule); a question approved earlier disappears once its file is cleared. Needs Postgres (CI).
 */
describe('pupil serving needs the stimulus file (S1-T06, FR-X1-4f)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  let fileSeq = 0
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function publish(text: string): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4) }), admin)
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    await q(`update question_parts set prompt_ms = 'Pilih jawapan yang betul.' where question_version_id = (select id from question_versions where question_id = $1)`, [created.id])
    return created.id
  }
  /** An image stimulus; `withFile` gives it an uploaded file row. */
  async function image(withFile: boolean): Promise<string> {
    const [st] = await q(`insert into stimuli (kind, label, alt_text) values ('image', 'Rajah', 'Rajah') returning id::text id`)
    if (withFile) await attachFile(st!.id)
    return st!.id
  }
  async function attachFile(stimulusId: string): Promise<void> {
    const [f] = await q(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'question_image', 'image/png', 10, repeat('b', 64), $1) returning id::text id`, [`s1t06-${stimulusId}-${String(++fileSeq)}`.padEnd(22, 'x')])
    await q(`update stimuli set asset_file_id = $2::bigint where id = $1::bigint`, [stimulusId, f!.id])
  }
  const drawn = async (ids: string[]) => new Set(await repo.eligibleAmong(ids, filterOf('latih_tubi_spm')))

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
    const [math] = await q(`select id::text id from subjects where code = 'MATH'`)
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [math!.id])
  })
  afterAll(async () => {
    await t.close()
  })

  it('[CI] positive control: a question whose image stimulus has its file is served', async () => {
    const id = await publish('Soalan dengan gambar lengkap, hitung luas kawasan berlorek.')
    const sid = await image(true)
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2::bigint, 1 from question_versions where question_id = $1`, [id, sid])
    expect((await drawn([id])).has(id)).toBe(true)
  })

  it('[CI] (a) a single question whose image stimulus has no file is not served', async () => {
    const id = await publish('Soalan dengan gambar tanpa fail, hitung luas kawasan berlorek.')
    const sid = await image(false)
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2::bigint, 1 from question_versions where question_id = $1`, [id, sid])
    expect((await drawn([id])).has(id)).toBe(false)
  })

  it('[CI] (b) a group with one stimulus lacking its file serves none of its members; with the file all are served', async () => {
    const a = await publish('Ahli kumpulan satu, berdasarkan rangsangan di atas, nyatakan jawapan.')
    const b = await publish('Ahli kumpulan dua, berdasarkan rangsangan di atas, nyatakan jawapan.')
    const ok = await image(true)
    const bad = await image(false)
    const [g] = await q(`insert into stimulus_groups (scope) values ('section') returning id::text id`)
    await q(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1), ($1::bigint, $3::bigint, 2)`, [g!.id, ok, bad])
    await q(`update questions set group_id = $2::bigint, group_position = case when id = $1::bigint then 1 else 2 end where id in ($1::bigint, $3::bigint)`, [a, g!.id, b])
    expect([...(await drawn([a, b]))]).toEqual([])
    await attachFile(bad)
    expect([...(await drawn([a, b]))].sort()).toEqual([a, b].sort())
  })

  it('[CI] (c) an approved question whose stimulus file is cleared afterwards leaves serving', async () => {
    const id = await publish('Soalan diluluskan dahulu, kemudian fail rajah dikosongkan, hitung sudut.')
    const sid = await image(true)
    await q(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select id, $2::bigint, 1 from question_versions where question_id = $1`, [id, sid])
    expect((await drawn([id])).has(id)).toBe(true)
    await q(`update stimuli set asset_file_id = null where id = $1::bigint`, [sid])
    expect((await drawn([id])).has(id)).toBe(false)
  })
})
