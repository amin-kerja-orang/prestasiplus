import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, STIMULUS_MESSAGES, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GROUP_WITHOUT_STIMULUS_MESSAGE } from '../../src/modules/questions/serving/approval-guard'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * m-5 follow-up (create-as-approved must apply the group-without-stimulus gate) and m-6 (regroup refuses a member that a published paper places).
 * Synthetic rows only.
 */
describe('M2 group rules (real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-m2-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const q = <R extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<R>(sql, params)

  async function served(text: string): Promise<string> {
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: text, tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [id])
    await q(`update questions set live_version_no = 1 where id = $1`, [id])
    return id
  }

  it('m-5: creating a grouped question already approved is refused (422, `media`) when its group has no stimulus; with a stimulus it is created', async () => {
    const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan M5', body: { ms: 'Teks rangsangan.' } })
    expect(stim.status, JSON.stringify(stim.body)).toBe(201)
    const sid = (stim.body as { data: { id: string } }).data.id
    const empty = await admin.post('/api/stimulus-groups', { stimulusIds: [sid], questionIds: [] })
    expect(empty.status, JSON.stringify(empty.body)).toBe(201)
    const gid = (empty.body as { data: { id: string } }).data.id
    const withStimulus = await admin.post('/api/questions', mcqBody(refs, { questionText: 'Soalan ahli kumpulan yang ada petikan.', tag, status: 'approved', stimulusGroupId: gid }))
    expect(withStimulus.status, JSON.stringify(withStimulus.body)).toBe(201)

    await q(`delete from stimulus_group_stimuli where group_id = $1::bigint`, [gid])
    const refused = await admin.post('/api/questions', mcqBody(refs, { questionText: 'Soalan ahli kumpulan tanpa petikan.', tag, status: 'approved', stimulusGroupId: gid }))
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(refused.body.error.fields.media).toBe(GROUP_WITHOUT_STIMULUS_MESSAGE)
  })

  it('m-6 (KP-14, ruling P-5): regroup of a member a published paper places is allowed with affectedPapers; a move that would leave a PARTIAL group on a paper is refused (409, nothing written)', async () => {
    const placed = await served('Soalan yang ada pada kertas Terbit. Satu.')
    const free = await served('Soalan yang tiada pada kertas Terbit. Dua.')
    const both1 = await served('Soalan pasangan pada kertas Terbit. Tiga.')
    const both2 = await served('Soalan pasangan pada kertas Terbit. Empat.')
    const paper = (await q<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', 'Kertas m6', $1, 2, 60, 'published', now()) returning id::text id`, [refs.mathId]))[0]!
    const section = (await q<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 1, 1) returning id::text id`, [paper.id]))[0]!
    for (const [i, id] of [placed, both1, both2].entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [section.id, id, i + 1])
    const stimulus = { kind: 'passage', label: 'Petikan 6', body: { ms: 'Isi petikan.' } }

    // one member on the paper and one not: the paper would hold a partial group
    const refused = await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [placed, free] })
    expect(refused.status, JSON.stringify(refused.body)).toBe(409)
    expect(refused.body.error.message).toBe(STIMULUS_MESSAGES.conflict)
    expect(await q(`select 1 from questions where id = any($1::bigint[]) and group_id is not null`, [[placed, free]])).toHaveLength(0)

    // every member on the same paper: allowed, the paper is reported
    const whole = await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [both1, both2] })
    expect(whole.status, JSON.stringify(whole.body)).toBe(200)
    expect(whole.body.meta.affectedPapers).toEqual([{ id: paper.id, title: 'Kertas m6', status: 'published' }])

    // R-1: not consecutive, out of order, or partial on a DRAFT paper: refused on the post-regroup membership
    const mk = async (title: string, status: string, order: string[]) => {
      const p = (await q<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', $1, $2, 2, 60, $3) returning id::text id`, [title, refs.mathId, status]))[0]!
      const sec = (await q<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', 3, 3) returning id::text id`, [p.id]))[0]!
      for (const [i, id] of order.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [sec.id, id, i + 1])
    }
    const [g1, g2, other] = [await served('Soalan kumpulan satu. Lima.'), await served('Soalan kumpulan dua. Enam.'), await served('Soalan lain. Tujuh.')]
    await mk('Draf tidak berturutan', 'draft', [g1, other, g2])
    const gap = await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [g1, g2] })
    expect(gap.status, JSON.stringify(gap.body)).toBe(409)
    const [h1, h2] = [await served('Soalan kumpulan tiga. Lapan.'), await served('Soalan kumpulan empat. Sembilan.')]
    await mk('Draf terbalik', 'draft', [h2, h1])
    const reversed = await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [h1, h2] })
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(409)
    const [d1, d2] = [await served('Soalan kumpulan lima. Sepuluh.'), await served('Soalan kumpulan enam. Sebelas.')]
    await mk('Draf separa', 'draft', [d1])
    expect((await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [d1, d2] })).status).toBe(409)

    // R-2: a draft paper holding the whole group in the right order is allowed and listed with its status
    const [r1, r2] = [await served('Soalan kumpulan tujuh. Dua belas.'), await served('Soalan kumpulan lapan. Tiga belas.')]
    await mk('Draf betul', 'draft', [r1, r2])
    const draftOk = await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [r1, r2] })
    expect(draftOk.status, JSON.stringify(draftOk.body)).toBe(200)
    expect(draftOk.body.meta.affectedPapers).toEqual([expect.objectContaining({ title: 'Draf betul', status: 'draft' })])

    // an unplaced member: grouped, no warning
    const ok = await admin.post('/api/admin/questions/regroup', { stimulus, memberQuestionIds: [free] })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.meta.affectedPapers).toBeUndefined()
  })
})
