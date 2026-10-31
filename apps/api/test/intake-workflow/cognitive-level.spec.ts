import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, uniqueStem, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * R1-B05 follow-up: the reviewer sets the cognitive level of an item (and of each part of a structured item) in review; accept carries
 * it onto the bank leaf, so an accepted SPM item that has one passes the new-approval gate and one that does not is refused.
 */
let t: WorkflowTestApp
let admin: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  admin = await loginAs(t, 'admin@demo.test')
  const math = (await t.db.query<{ id: string }>(`select id::text id from subjects where code = 'MATH'`))[0]!.id
  await t.db.query(`insert into spm_subject_configs (subject_id, grp, display_order) values ($1::bigint, 'teras', 1) on conflict do nothing`, [math])
}, 120_000)
afterAll(async () => {
  await t.close()
})

const part = (label: string, over: Record<string, unknown> = {}) => ({
  id: `p-${label}`,
  label: `(${label})`,
  prompt: `Hitung nilai bahagian ${label}.`,
  marks: 1,
  mode: 'short_text',
  scheme: { kind: 'accepted', marks: 1, values: [{ v: '4' }] },
  ...over,
})

async function batchWith(items: ReturnType<typeof draft>[]): Promise<{ batchId: string; ids: string[] }> {
  t.ai.paper = () => paper(items)
  const { batchId } = await readyBatch(t, admin)
  await extractAndRun(t, admin, batchId)
  return { batchId, ids: (await itemsOf(admin, batchId)).map((i) => i.id) }
}
const questionOf = async (itemId: string): Promise<string> =>
  (await t.db.query<{ q: string }>(`select question_id::text q from intake_items where id = $1::bigint`, [itemId]))[0]!.q
const leaves = (questionId: string) =>
  t.db.query<{ label: string; cognitive_level: string | null; kbat: string | null }>(
    `select p.label, p.cognitive_level, p.kbat from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint and p.mode is not null order by p.position`,
    [questionId],
  )
const approve = async (questionId: string) => {
  const svc = t.app.get(QuestionsService)
  await t.db.query(`update question_versions set paper_code = 'MATH/2', chapter_id = (select id from chapters limit 1) where question_id = $1::bigint`, [questionId])
  await svc.setStatus(questionId, 'review', admin.session.user.id)
  return svc.setStatus(questionId, 'approved', admin.session.user.id)
}

describe('intake item cognitive level', () => {
  it('PATCH sets, changes and clears the level on an item, with the history and the "edited by a person" mark; a bad value is 422', async () => {
    const { ids } = await batchWith([draft(t.codes, '1', { stem: uniqueStem() })])
    const id = ids[0]!
    const set = await patch(admin, `/intake/items/${id}`, { cognitiveLevel: 'menganalisis' })
    expect(set.status, JSON.stringify(set.body)).toBe(200)
    expect(set.body.data.cognitiveLevel).toBe('menganalisis')
    const read = await admin.agent.get(`/api/intake/items/${id}`)
    expect(read.body.data.cognitiveLevel).toBe('menganalisis')
    expect(read.body.data.humanEdited).toContain('cognitiveLevel')
    expect(read.body.data.events.some((e: { field?: string }) => e.field === 'cognitiveLevel' || JSON.stringify(e).includes('cognitiveLevel'))).toBe(true)

    expect((await patch(admin, `/intake/items/${id}`, { cognitiveLevel: 'kreatif' })).status).toBe(422)
    const cleared = await patch(admin, `/intake/items/${id}`, { cognitiveLevel: null })
    expect(cleared.status).toBe(200)
    expect(cleared.body.data.cognitiveLevel).toBeUndefined()
  })

  it('an MCQ item with a level is accepted into a leaf with that level (KBAT follows), and the SPM approval passes the gate', async () => {
    const { ids } = await batchWith([draft(t.codes, '1', { stem: uniqueStem() })])
    const id = ids[0]!
    expect((await patch(admin, `/intake/items/${id}`, { cognitiveLevel: 'mengaplikasi' })).status).toBe(200)
    const accepted = await post(admin, `/intake/items/${id}/accept`)
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    const q = await questionOf(id)
    expect(await leaves(q)).toEqual([{ label: '1', cognitive_level: 'mengaplikasi', kbat: 'mengaplikasi' }])
    const view = await approve(q)
    expect(view.version.status).toBe('approved')
  })

  it('an item without a level is accepted as a draft but refused at the SPM approval, naming the leaf', async () => {
    const { ids } = await batchWith([draft(t.codes, '1', { stem: uniqueStem() })])
    const id = ids[0]!
    expect((await post(admin, `/intake/items/${id}/accept`)).status).toBe(200)
    const q = await questionOf(id)
    expect((await leaves(q))[0]!.cognitive_level).toBeNull()
    await expect(approve(q)).rejects.toMatchObject({ fields: { 'parts.1.cognitiveLevel': 'Bahagian (1) belum ada aras pemikiran.' } })
  })

  it('a structured item carries the level per part; a part without one is named at approval', async () => {
    const structured = draft(t.codes, '2', {
      type: 'structured',
      stem: uniqueStem(),
      options: [],
      marks: 2,
      scheme: undefined,
      parts: [part('a'), part('b')] as never,
    })
    const { ids } = await batchWith([structured])
    const id = ids[0]!
    const parts = [part('a', { cognitiveLevel: 'mengingat' }), part('b')]
    const pr = await patch(admin, `/intake/items/${id}`, { parts })
    expect(pr.status, JSON.stringify(pr.body)).toBe(200)
    const accepted = await post(admin, `/intake/items/${id}/accept`)
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200)
    const q = await questionOf(id)
    const stored = await leaves(q)
    expect(stored.map((l) => [l.label, l.cognitive_level, l.kbat])).toEqual([
      ['(a)', 'mengingat', 'bukan'],
      ['(b)', null, null],
    ])
    await expect(approve(q)).rejects.toMatchObject({ fields: { 'parts.(b).cognitiveLevel': 'Bahagian (b) belum ada aras pemikiran.' } })
    expect(stored).toHaveLength(2)
  })
})
