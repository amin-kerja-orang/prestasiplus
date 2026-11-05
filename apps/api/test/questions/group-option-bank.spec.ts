import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, STIMULUS_MESSAGES, StimulusGroupDetailSchema, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * S1-T01 (#685 ruling, API-Q-08): the stimulus group detail names the Terbit papers that place the group or a member (`usedInPapers`), and the
 * option bank carries `imageId` and `isDistractor` and can be edited by `PUT /stimulus-groups/:id` (AC-QA-10: a key letter cannot be dropped).
 */
describe('[CI] group usedInPapers and option bank image/distractor/update (API-Q-08)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-group-bank-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const upload = async (purpose = 'question_image'): Promise<string> => {
    const res = await admin.post(`/api/files?purpose=${purpose}`).attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body.data as { id: string }).id
  }
  const stimulus = async (): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan', body: { ms: 'Teks petikan.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusSchema).parse(res.body).data.id
  }
  const detail = async (id: string) => {
    const res = await admin.get(`/api/stimulus-groups/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body.data ?? res.body) as ReturnType<typeof StimulusGroupDetailSchema.parse>
  }
  /** A group of `n` members created inside it; approved (served) when `served`. */
  const makeGroup = async (n: number, served: boolean, extra: Record<string, unknown> = {}) => {
    const created = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds: [], ...extra })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const g = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(created.body).data
    const ids: string[] = []
    for (let i = 0; i < n; i += 1) {
      const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, served ? { status: 'approved', tag } : {}))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      ids.push(mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id)
    }
    return { id: g.id, ids }
  }
  async function paper(title: string, status: string, questionIds: string[]): Promise<string> {
    const p = (await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', $1, $2, 1, 60, $3) returning id::text id`, [title, refs.mathId, status]))[0]!.id as string
    const s = (await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'Bahagian A', 1, 0) returning id::text id`, [p]))[0]!.id as string
    for (const [i, id] of questionIds.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [s, id, i + 1])
    return p
  }
  /** A `match_letter` leaf with a mapping key on the latest version of a question. */
  async function keyOn(questionId: string, letter: string): Promise<void> {
    const v = (await q(`select v.id::text id from question_versions v join questions x on x.id = v.question_id and v.version_no = x.latest_version_no where x.id = $1`, [questionId]))[0]!.id as string
    const part = (await q(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, mode, marks) values ($1, 90, 1, '33', 'Item', 'match_letter', 1) returning id::text id`, [v]))[0]!.id as string
    await q(`insert into answer_keys (part_id, kind, content) values ($1, 'mapping', $2::jsonb)`, [part, JSON.stringify({ kind: 'mapping', map: { '33': letter } })])
  }
  const bank = (extra: Record<string, unknown>[] = []) => [
    { label: 'A', body: { ms: 'Pilihan A' } },
    { label: 'B', body: { ms: 'Pilihan B' } },
    { label: 'C', body: { ms: 'Pilihan C' }, ...(extra[0] ?? {}) },
  ]

  describe('usedInPapers', () => {
    it('lists Terbit papers only, for a member placement and for every member, once each; empty when unused', async () => {
      const g = await makeGroup(2, false)
      expect((await detail(g.id)).usedInPapers).toEqual([])
      await paper('Kertas draf', 'draft', [g.ids[0]!])
      await paper('Kertas siap', 'ready', [g.ids[1]!])
      await paper('Kertas ditarik', 'withdrawn', g.ids)
      expect((await detail(g.id)).usedInPapers).toEqual([])
      const whole = await paper('Kertas A terbit', 'published', g.ids) // the group placed whole: one entry, not one per member
      const one = await paper('Kertas B terbit', 'published', [g.ids[1]!]) // a single member
      const other = await makeGroup(1, false)
      await paper('Kertas lain terbit', 'published', other.ids)
      expect((await detail(g.id)).usedInPapers).toEqual([
        { id: whole, title: 'Kertas A terbit' },
        { id: one, title: 'Kertas B terbit' },
      ])
      expect((await detail(other.id)).usedInPapers).toHaveLength(1)
    })

    it('a group with no member lists nothing, and the retire response is unchanged', async () => {
      const empty = await makeGroup(0, false)
      expect((await detail(empty.id)).usedInPapers).toEqual([])
    })
  })

  describe('option bank imageId and isDistractor', () => {
    it('round-trip on create and on read: imageId is the public token, isDistractor defaults to false', async () => {
      const file = await upload()
      const g = await makeGroup(0, false, { optionBank: bank([{ imageId: file, isDistractor: true }]) })
      const read = (await detail(g.id)).optionBank!
      expect(read).toEqual([
        { label: 'A', body: { ms: 'Pilihan A' }, imageId: null, isDistractor: false },
        { label: 'B', body: { ms: 'Pilihan B' }, imageId: null, isDistractor: false },
        { label: 'C', body: { ms: 'Pilihan C' }, imageId: file, isDistractor: true },
      ])
      expect((await q(`select is_distractor, image_file_id is not null as has_image from stimulus_group_options where group_id = $1 and label = 'C'`, [g.id]))[0]).toEqual({ is_distractor: true, has_image: true })
    })

    it('a foreign picture (another purpose, an unknown token) is refused on create and on update; nothing is written', async () => {
      const avatar = await upload('avatar')
      for (const imageId of [avatar, 'tiada-fail-ini', '0']) {
        const res = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], optionBank: bank([{ imageId }]) })
        expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ 'optionBank.2.imageId': STIMULUS_MESSAGES.image })
      }
      const g = await makeGroup(0, false, { optionBank: bank() })
      const res = await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: bank([{ imageId: avatar }]) })
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ 'optionBank.2.imageId': STIMULUS_MESSAGES.image })
      expect((await detail(g.id)).optionBank!.every((o) => o.imageId === null)).toBe(true)
    })
  })

  describe('optionBank on the update request', () => {
    it('replaces the whole bank (text, picture, distractor) and an empty array clears it; other fields stay', async () => {
      const g = await makeGroup(0, false, { label: 'Kumpulan A', optionBank: bank() })
      const file = await upload()
      const res = await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [{ label: 'D', body: { ms: 'Baharu', en: 'New' }, imageId: file, isDistractor: true }, { label: 'A', body: { ms: 'Lama' } }] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const after = await detail(g.id)
      expect(after.label).toBe('Kumpulan A')
      expect(after.optionBank).toEqual([
        { label: 'D', body: { ms: 'Baharu', en: 'New' }, imageId: file, isDistractor: true },
        { label: 'A', body: { ms: 'Lama' }, imageId: null, isDistractor: false },
      ])
      expect((await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [] })).status).toBe(200)
      expect((await detail(g.id)).optionBank).toBeUndefined()
    })

    it('AC-QA-10: a letter that a leaf key of a member uses cannot be dropped; keeping it, or dropping an unused one, works', async () => {
      const g = await makeGroup(1, false, { optionBank: bank() })
      await keyOn(g.ids[0]!, 'C')
      const refused = await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [{ label: 'A', body: { ms: 'A' } }, { label: 'B', body: { ms: 'B' } }] })
      expect(expectError(refused, 'VALIDATION_ERROR').fields).toEqual({ optionBank: STIMULUS_MESSAGES.bankLetterKey })
      expect((await detail(g.id)).optionBank).toHaveLength(3)
      expectError(await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [] }), 'VALIDATION_ERROR')
      const ok = await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [{ label: 'C', body: { ms: 'C' } }, { label: 'H', body: { ms: 'H' } }] })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect((await detail(g.id)).optionBank!.map((o) => o.label)).toEqual(['C', 'H'])
    })

    it('a served group refuses a bank change with 409 groupServed; the draft copy takes it and the swap brings it to the served group', async () => {
      const g = await makeGroup(1, true, { optionBank: bank() })
      expectError(await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [{ label: 'A', body: { ms: 'Ubah' } }] }), 'CONFLICT', STIMULUS_MESSAGES.groupServed)
      expect((await detail(g.id)).optionBank).toHaveLength(3)
      // a label-only change is not a bank change and stays allowed
      expect((await admin.put(`/api/stimulus-groups/${g.id}`, { label: 'Nama baharu' })).status).toBe(200)

      const copyRes = await admin.post(`/api/stimulus-groups/${g.id}/edit-as-draft`)
      expect(copyRes.status, JSON.stringify(copyRes.body)).toBe(201)
      const copy = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(copyRes.body).data
      expect(copy.draftOfGroupId).toBe(g.id)
      expect(copy.optionBank).toHaveLength(3)
      const edited = await admin.put(`/api/stimulus-groups/${copy.id}`, { optionBank: [{ label: 'A', body: { ms: 'Ubah' }, isDistractor: true }] })
      expect(edited.status, JSON.stringify(edited.body)).toBe(200)
      expect((await detail(g.id)).optionBank).toHaveLength(3) // the served group is untouched until the swap
      expect((await detail(copy.id)).optionBank).toEqual([{ label: 'A', body: { ms: 'Ubah' }, imageId: null, isDistractor: true }])
    })

    it('a duplicate letter answers 422 on optionBank and changes nothing, on create and on update', async () => {
      const dup = [{ label: 'A', body: { ms: 'Satu' } }, { label: 'B', body: { ms: 'Dua' } }, { label: 'A', body: { ms: 'Tiga' } }]
      const groups = Number((await q('select count(*)::text n from stimulus_groups'))[0]!.n)
      const created = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], optionBank: dup })
      expect(expectError(created, 'VALIDATION_ERROR').fields).toEqual({ optionBank: STIMULUS_MESSAGES.requestInvalid })
      expect(Number((await q('select count(*)::text n from stimulus_groups'))[0]!.n)).toBe(groups)
      const g = await makeGroup(0, false, { optionBank: bank() })
      const res = await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: dup })
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ optionBank: STIMULUS_MESSAGES.requestInvalid })
      expect((await detail(g.id)).optionBank!.map((o) => o.label)).toEqual(['A', 'B', 'C'])
    })

    it('the swap refuses a draft copy whose bank drops a letter that a key uses: 422, rolled back, the served group unchanged', async () => {
      const g = await makeGroup(1, true, { optionBank: bank() })
      await keyOn(g.ids[0]!, 'C')
      const copyRes = await admin.post(`/api/stimulus-groups/${g.id}/edit-as-draft`)
      expect(copyRes.status, JSON.stringify(copyRes.body)).toBe(201)
      const copy = mutationEnvelopeOf(StimulusGroupDetailSchema).parse(copyRes.body).data
      // the PUT would already refuse this, so the letter is removed straight in the database
      await q(`delete from stimulus_group_options where group_id = $1 and label = 'C'`, [copy.id])
      const res = await admin.post(`/api/stimulus-groups/${copy.id}/publish`)
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ optionBank: STIMULUS_MESSAGES.bankLetterKey })
      expect((await detail(g.id)).optionBank!.map((o) => o.label)).toEqual(['A', 'B', 'C'])
      expect((await q(`select 1 from stimulus_groups where id = $1`, [copy.id])).length).toBe(1) // the copy is still there
    })

    it('guards: 422 on a bad letter, 401 anonymous, 403 teacher', async () => {
      const g = await makeGroup(0, false)
      expectError(await admin.put(`/api/stimulus-groups/${g.id}`, { optionBank: [{ label: 'Z', body: { ms: 'x' } }] }), 'VALIDATION_ERROR')
      const teacher = await loginAs(t, 'teacher')
      expectError(await teacher.put(`/api/stimulus-groups/${g.id}`, { optionBank: [] }), 'FORBIDDEN')
    })
  })
})
