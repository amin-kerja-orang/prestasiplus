import { INTAKE_GATE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootWorkflowApp, loginAs, post, del, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * S6-T17: the admin "Terima" of a teacher's structured submission that carries a stimulus image. The picture is COPIED to a new
 * `question_image` file on a bank image stimulus (the bank never points at the teacher's own upload); a file the batch owner does not own
 * is refused; an image shared by two own items outlives the deletion of one of them.
 */
let t: WorkflowTestApp
let admin: LoggedIn
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  admin = await loginAs(t, 'admin@demo.test')
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t?.close()
})

const rows = <R extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<R>(sql, params)

async function upload(): Promise<string> {
  const up = await teacher.agent.post('/api/files?purpose=question_image').set('X-CSRF-Token', teacher.csrf).attach('file', makePng(), { filename: 'rangsangan.png', contentType: 'image/png' })
  expect(up.status, JSON.stringify(up.body)).toBe(201)
  return (up.body as { data: { id: string } }).data.id
}

async function submit(token: string | null, stimulus = 'Rajah menunjukkan sebuah segi tiga.'): Promise<string> {
  const ref = (await rows<{ s: string; l: string }>(`select (select id::text from subjects where code = 'MATH') s, (select id::text from education_levels where code = 'T4') l`))[0]!
  const res = await post(teacher, '/guru/intake/structured', {
    subjectId: ref.s,
    educationLevelId: ref.l,
    difficultyLevel: 3,
    stimulus,
    ...(token === null ? {} : { stimulusImageId: token }),
    parts: [{ text: 'Hitung luas segi tiga itu.', marks: 3, scheme: '1/2 x 6 x 4 = 12 cm2' }],
    // The conditional DSKP fields are required only where the seed has chapters or DSKP nodes for MATH T4.
    ...(await dskp(ref.s, ref.l)),
  })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  const id = (res.body as { data: { id: string } }).data.id.slice(1)
  // The admin completes the tag in review (unit and SP are the admin's to confirm, AC-GUR-44-11): done here straight on the item.
  const unit = (await rows<{ code: string }>(`select n.code from curriculum_nodes n where n.kind = 'unit' and n.subject_id = (select id from subjects where code = 'MATH') and n.education_level_id = $1 order by n.id limit 1`, [ref.l]))[0]
  const sp = (await rows<{ code: string }>(`select n.code from curriculum_nodes n where n.kind = 'sp' and n.subject_id = (select id from subjects where code = 'MATH') and n.education_level_id = $1 order by n.id limit 1`, [ref.l]))[0]
  await t.db.query(
    `update intake_items set low_fields = '{}', payload = jsonb_set(payload, '{tag}', (payload -> 'tag') || jsonb_build_object('unit', $2::text, 'unitLabel', 'Unit ujian', 'sp', jsonb_build_array($3::text), 'tp', 3)) where id = $1`,
    [id, unit?.code ?? null, sp?.code ?? null],
  )
  return id
}

async function dskp(subjectId: string, levelId: string): Promise<Record<string, unknown>> {
  const f = (await rows<{ ch: boolean; nd: boolean }>(
    `select exists (select 1 from chapters where subject_id = $1 and education_level_id = $2 and is_active and in_tree) ch, exists (select 1 from curriculum_nodes where subject_id = $1 and education_level_id = $2) nd`,
    [subjectId, levelId],
  ))[0]!
  const chapter = f.ch ? (await rows<{ id: string }>(`select id::text from chapters where subject_id = $1 and education_level_id = $2 and is_active and in_tree order by id limit 1`, [subjectId, levelId]))[0] : undefined
  const sp = f.nd ? (await rows<{ id: string }>(`select id::text from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 order by id limit 1`, [subjectId, levelId]))[0] : undefined
  return { ...(chapter ? { chapterId: chapter.id } : {}), ...(f.nd && sp ? { spIds: [sp.id], tp: 3, cognitiveLevel: 'mengaplikasi' } : {}) }
}

describe('admin Terima of a structured teacher submission with a stimulus image', () => {
  it('makes a structured Draf in a stimulus group whose stimulus is image-kind with a NEW file (a copy of the teacher upload)', async () => {
    const token = await upload()
    const item = await submit(token)
    const res = await post(admin, `/intake/items/${item}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    const q = (await rows<{ qid: string; gid: string | null }>(`select q.id::text qid, q.group_id::text gid from intake_items i join questions q on q.id = i.question_id where i.id = $1`, [item]))[0]!
    expect(q.gid).toBeTruthy()
    const st = await rows<{ kind: string; body: string | null; token: string; purpose: string; owner: string | null }>(
      `select s.kind, s.body_ms body, f.public_id token, f.purpose, f.owner_user_id::text owner
         from stimulus_group_stimuli gs join stimuli s on s.id = gs.stimulus_id join files f on f.id = s.asset_file_id where gs.group_id = $1`,
      [q.gid],
    )
    expect(st).toHaveLength(1)
    expect(st[0]).toMatchObject({ kind: 'image', body: 'Rajah menunjukkan sebuah segi tiga.', purpose: 'question_image' })
    expect(st[0]?.token).not.toBe(token)
    // The teacher's own upload is untouched.
    expect((await rows<{ n: string }>(`select count(*)::text n from files where public_id = $1`, [token]))[0]?.n).toBe('1')
    const version = (await rows<{ type: string }>(`select v.type from question_versions v join questions x on x.id = v.question_id and v.version_no = x.latest_version_no where x.id = $1`, [q.qid]))[0]
    expect(version?.type).toBe('structured')
  })

  it('refuses a file the batch owner does not own (another user, or no owner) with the figureNotResolved 422 and creates nothing', async () => {
    const adminId = (await rows<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`))[0]!.id
    for (const owner of [adminId, null]) {
      const token = await upload()
      const item = await submit(token)
      await t.db.query(`update files set owner_user_id = $2 where public_id = $1`, [token, owner])
      const questions = (await rows<{ n: string }>(`select count(*)::text n from questions`))[0]!.n
      const res = await post(admin, `/intake/items/${item}/accept`)
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(JSON.stringify(res.body)).toContain(INTAKE_GATE_MESSAGES.figureNotResolved)
      expect((await rows<{ n: string }>(`select count(*)::text n from questions`))[0]!.n).toBe(questions)
      expect((await rows<{ s: string }>(`select review_state s from intake_items where id = $1`, [item]))[0]?.s).toBe('needs_review')
    }
  })

  it('an image shared by two of the teacher own items survives the deletion of one of them and goes with the last', async () => {
    const token = await upload()
    const a = await submit(token)
    const b = await submit(token)
    const exists = async () => (await rows<{ n: string }>(`select count(*)::text n from files where public_id = $1`, [token]))[0]!.n
    const first = await del(teacher, `/guru/intake/structured/g${a}`)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(await exists()).toBe('1')
    expect((await del(teacher, `/guru/intake/structured/g${b}`)).status).toBe(200)
    expect(await exists()).toBe('0')
  })
})
