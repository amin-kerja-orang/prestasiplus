import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * R1-T32 (D90), intake path: one figure (or passage) shown by several questions is ONE bank stimulus in ONE group, and EVERY question
 * of the intake stimulus is linked to it, however the items are accepted (bulk, one by one, in separate calls). A question that
 * does not refer to the figure stays outside the group. The group carries no marks and is never a question.
 */
let t: WorkflowTestApp
let admin: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  admin = await loginAs(t, 'admin@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> => (await t.db.query<T>(sql, params))[0] as T

async function batchWith(n: number): Promise<{ batchId: string; ids: string[] }> {
  t.ai.paper = () => paper(Array.from({ length: n }, (_v, i) => draft(t.codes, String(i + 1), { stem: uniqueStem() })))
  const { batchId } = await readyBatch(t, admin)
  await extractAndRun(t, admin, batchId)
  return { batchId, ids: (await itemsOf(admin, batchId)).map((i) => i.id) }
}

/** A diagram stimulus whose figure has a crop file, attached to the first `n` items of the batch. */
async function figureFor(batchId: string, ids: string[]): Promise<{ stimulusId: string; cropFileId: string }> {
  const s = (await post(admin, `/intake/batches/${batchId}/stimuli`, { kind: 'diagram', alt: 'Rajah segi tiga', label: 'Rajah 1', caption: 'Rajah 1 menunjukkan segi tiga.' })).body.data as { id: string }
  const up = await admin.agent.post('/api/files?purpose=question_image').set('X-CSRF-Token', admin.csrf).attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
  expect(up.status, JSON.stringify(up.body)).toBe(201)
  const crop = (await one<{ id: string }>(`select id::text id from files order by id desc limit 1`)).id
  const page = await one<{ id: string }>(`select p.id::text id from intake_pages p join intake_files f on f.id = p.intake_file_id where f.batch_id = $1 order by p.id limit 1`, [batchId])
  const figure = await one<{ id: string }>(`insert into intake_figures (intake_page_id, bbox, crop_file_id) values ($1, '{"x":0,"y":0,"w":0.5,"h":0.5}', $2) returning id::text id`, [page.id, crop])
  await t.db.query(`update intake_stimuli set figure_id = $1 where id = $2`, [figure.id, s.id])
  for (const id of ids) expect((await patch(admin, `/intake/items/${id}`, { stimulusId: s.id })).status).toBe(200)
  return { stimulusId: s.id, cropFileId: crop }
}

const questionOf = async (itemId: string) => one<{ q: string; g: string | null; pos: number | null }>(
  `select q.id::text q, q.group_id::text g, q.group_position pos from intake_items i join questions q on q.id = i.question_id where i.id = $1`,
  [itemId],
)

describe('intake: every question that refers to a figure is linked to it (D90)', () => {
  it('bulk accept of three items of one figure makes one stimulus, one group and three members in item order; the fourth item stays outside', async () => {
    const { batchId, ids } = await batchWith(4)
    const [a, b, c, plain] = ids as [string, string, string, string]
    const { cropFileId } = await figureFor(batchId, [a, b, c])
    const stimuliBefore = Number((await one<{ n: string }>('select count(*)::text n from stimuli')).n)
    const groupsBefore = Number((await one<{ n: string }>('select count(*)::text n from stimulus_groups')).n)
    const questionsBefore = Number((await one<{ n: string }>('select count(*)::text n from questions')).n)

    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids: [a, b, c, plain] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.done).toBe(4)

    expect(Number((await one<{ n: string }>('select count(*)::text n from stimuli')).n)).toBe(stimuliBefore + 1)
    expect(Number((await one<{ n: string }>('select count(*)::text n from stimulus_groups')).n)).toBe(groupsBefore + 1)
    const qa = await questionOf(a)
    const qb = await questionOf(b)
    const qc = await questionOf(c)
    expect(qa.g).toBeTruthy()
    expect([qb.g, qc.g]).toEqual([qa.g, qa.g])
    expect([qa.pos, qb.pos, qc.pos]).toEqual([1, 2, 3])
    expect((await questionOf(plain)).g).toBeNull()

    // The bank stimulus is a snapshot of the figure: kind, caption, alt and the crop file; one link row for the group.
    const group = await one<{ n: string; stimulus: string; kind: string; asset: string | null; caption: string | null; alt: string | null }>(
      `select (select count(*) from stimulus_group_stimuli where group_id = g.id)::text n, s.id::text stimulus, s.kind, s.asset_file_id::text asset, s.caption, s.alt_text alt
         from stimulus_groups g join stimulus_group_stimuli gs on gs.group_id = g.id join stimuli s on s.id = gs.stimulus_id where g.id = $1`,
      [qa.g],
    )
    expect(group.n).toBe('1')
    expect(group.kind).toBe('diagram')
    expect(group.asset).toBe(cropFileId)
    expect(group.alt).toBe('Rajah segi tiga')

    // Read back through the question detail: each member shows the same single stimulus, the group lists all three members, no marks on the group.
    for (const q of [qa, qb, qc]) {
      const detail = await admin.agent.get(`/api/questions/${q.q}`)
      expect(detail.status).toBe(200)
      expect(detail.body.data.stimulusGroup.stimuli).toHaveLength(1)
      expect(detail.body.data.stimulusGroup.stimuli[0].id).toBe(group.stimulus)
      expect(detail.body.data.stimulusGroup.questionIds).toEqual([qa.q, qb.q, qc.q])
      expect(JSON.stringify(detail.body.data.stimulusGroup)).not.toMatch(/marks/i)
    }
    // The group itself is not a question: only the four accepted items made questions.
    expect(Number((await one<{ n: string }>('select count(*)::text n from questions')).n)).toBe(questionsBefore + 4)
  })

  it('items of the same figure accepted in separate calls (bulk, then one by one) all join the first group', async () => {
    const { batchId, ids } = await batchWith(3)
    const [a, b, c] = ids as [string, string, string]
    await figureFor(batchId, [a, b, c])
    const stimuliBefore = Number((await one<{ n: string }>('select count(*)::text n from stimuli')).n)
    const groupsBefore = Number((await one<{ n: string }>('select count(*)::text n from stimulus_groups')).n)

    expect((await post(admin, '/intake/items/bulk', { action: 'accept', ids: [a] })).body.data.done).toBe(1)
    expect((await post(admin, `/intake/items/${b}/accept`)).status).toBe(200)
    expect((await post(admin, '/intake/items/bulk', { action: 'accept', ids: [c] })).body.data.done).toBe(1)

    const [qa, qb, qc] = [await questionOf(a), await questionOf(b), await questionOf(c)]
    expect(qa.g).toBeTruthy()
    expect([qb.g, qc.g]).toEqual([qa.g, qa.g])
    expect([qa.pos, qb.pos, qc.pos]).toEqual([1, 2, 3])
    expect(Number((await one<{ n: string }>('select count(*)::text n from stimuli')).n)).toBe(stimuliBefore + 1)
    expect(Number((await one<{ n: string }>('select count(*)::text n from stimulus_groups')).n)).toBe(groupsBefore + 1)
  })

  it('two figures of one batch make two groups; a passage stimulus does the same', async () => {
    const { batchId, ids } = await batchWith(4)
    const [a, b, c, d] = ids as [string, string, string, string]
    await figureFor(batchId, [a, b])
    const passage = (await post(admin, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Bacaan bersama untuk dua soalan.', alt: 'Bacaan', label: 'Petikan 1' })).body.data as { id: string }
    for (const id of [c, d]) expect((await patch(admin, `/intake/items/${id}`, { stimulusId: passage.id })).status).toBe(200)

    expect((await post(admin, '/intake/items/bulk', { action: 'accept', ids: [a, b, c, d] })).body.data.done).toBe(4)
    const [qa, qb, qc, qd] = [await questionOf(a), await questionOf(b), await questionOf(c), await questionOf(d)]
    expect(qa.g).toBe(qb.g)
    expect(qc.g).toBe(qd.g)
    expect(qa.g).not.toBe(qc.g)
    expect([qc.pos, qd.pos]).toEqual([1, 2])
    expect((await one<{ kind: string }>(`select s.kind from stimulus_group_stimuli gs join stimuli s on s.id = gs.stimulus_id where gs.group_id = $1`, [qc.g])).kind).toBe('passage')
  })
})
