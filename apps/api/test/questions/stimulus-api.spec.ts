import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  QuestionSchema,
  STIMULUS_MESSAGES,
  StimulusGroupDetailSchema,
  StimulusSchema,
  mutationEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { bootQuestionsApp, expectError, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1-T32 (D90): admin HTTP API for stimuli and stimulus groups. Real database, real session guard, real file upload.
 */
describe('stimulus and stimulus group API (admin, real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let pupil: Client
  let refs: Refs
  let adminId: string

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-stimulus-api-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000' // the suite makes hundreds of writes in one minute
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    pupil = await loginAs(t, 'student')
    refs = await refsOf(t.db)
    adminId = (await t.db.query<{ id: string }>(`select id::text id from users where lower(email) = 'admin@demo.test'`))[0]!.id
  })
  afterAll(async () => {
    await t.close()
  })

  const upload = async (who: Client = admin, purpose = 'question_image'): Promise<string> => {
    const res = await who.post(`/api/files?purpose=${purpose}`).attach('file', makePng(), { filename: 'rajah.png', contentType: 'image/png' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body.data as { id: string }).id
  }
  const stimulus = async (over: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan A', body: { ms: 'Teks petikan.' }, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusSchema).parse(res.body).data
  }
  const question = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  const group = async (stimulusIds: string[], questionIds: string[], over: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/stimulus-groups', { stimulusIds, questionIds, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
  }
  const positions = async (groupId: string): Promise<{ id: string; pos: number }[]> =>
    (await t.db.query<{ id: string; pos: number }>(`select id::text id, group_position pos from questions where group_id = $1 order by group_position`, [groupId]))
  const auditRows = (action: string) => t.db.query<{ target_id: string; actor_user_id: string; detail: Record<string, unknown> | null }>(`select target_id, actor_user_id::text, detail from audit_events where action = $1 order by id`, [action])

  describe('guards', () => {
    it('401 anonymous, 403 teacher and pupil, on every route; nothing is written', async () => {
      const before = Number((await t.db.query<{ n: string }>('select count(*)::text n from stimuli'))[0]!.n)
      const calls: [string, string][] = [
        ['post', '/api/stimuli'],
        ['get', '/api/stimuli/1'],
        ['put', '/api/stimuli/1'],
        ['delete', '/api/stimuli/1'],
        ['post', '/api/stimulus-groups'],
        ['get', '/api/stimulus-groups/1'],
        ['put', '/api/stimulus-groups/1'],
        ['delete', '/api/stimulus-groups/1'],
        ['post', '/api/stimulus-groups/1/members'],
        ['delete', '/api/stimulus-groups/1/members/2'],
        ['put', '/api/stimulus-groups/1/members/order'],
        ['post', '/api/stimulus-groups/1/questions'],
      ]
      for (const [method, path] of calls) {
        const anon = await (t.http() as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method]!(path)
        expect(anon.status, `${method} ${path} anonymous`).toBe(401)
        for (const who of [teacher, pupil]) {
          const res = await (who as unknown as Record<string, (p: string, b?: unknown) => Promise<{ status: number }>>)[method]!(path, method === 'get' || method === 'delete' ? undefined : {})
          expect(res.status, `${method} ${path} non-admin`).toBe(403)
        }
      }
      expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from stimuli'))[0]!.n)).toBe(before)
    })
  })

  describe('stimuli', () => {
    it('creates every one of the seven kinds, returns the BM flash and reads it back', async () => {
      const png = await upload()
      const cases: Record<string, unknown>[] = [
        { kind: 'passage', body: { ms: 'Petikan', en: 'Passage' }, caption: 'Tajuk', sourceCitation: 'Sumber 2024' },
        { kind: 'image', imageFileId: png, alt: 'Gambar' },
        { kind: 'diagram', imageFileId: png, alt: 'Rajah 1', caption: 'Rajah 1' },
        { kind: 'table', tableData: { head: ['a', 'b'], rows: [['1', '2']] }, caption: 'Jadual 1' },
        { kind: 'map', imageFileId: png },
        { kind: 'infographic', imageFileId: png },
        { kind: 'graph', imageFileId: png },
      ]
      for (const body of cases) {
        const res = await admin.post('/api/stimuli', body)
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.status).toBe(STIMULUS_MESSAGES.created)
        const made = mutationEnvelopeOf(StimulusSchema).parse(res.body).data
        expect(made.kind).toBe(body.kind)
        expect(made.groupCount).toBe(0)
        const read = await admin.get(`/api/stimuli/${made.id}`)
        expect(StimulusSchema.parse(read.body.data)).toEqual(made)
      }
    })

    it('the picture is a token of a question_image file and the admin can download it', async () => {
      const png = await upload()
      const made = await stimulus({ kind: 'image', imageFileId: png, body: undefined })
      expect(made.imageId).toBe(png)
      const file = await admin.get(`/api/files/${made.imageId as string}`)
      expect(file.status).toBe(200)
      expect(t.db).toBeDefined()
    })

    it('refuses by kind with the BM message on the right field', async () => {
      const bad = async (body: Record<string, unknown>, field: string, message: string) => {
        const res = await admin.post('/api/stimuli', body)
        expectError(res, 'VALIDATION_ERROR')
        expect(res.body.error.fields[field], JSON.stringify(res.body)).toBe(message)
      }
      await bad({ kind: 'passage' }, 'body', STIMULUS_MESSAGES.bodyRequired)
      await bad({ kind: 'diagram' }, 'imageFileId', STIMULUS_MESSAGES.imageRequired)
      await bad({ kind: 'image', alt: 'x' }, 'imageFileId', STIMULUS_MESSAGES.imageRequired)
      await bad({ kind: 'table' }, 'tableData', STIMULUS_MESSAGES.tableRequired)
      await bad({ kind: 'poster', body: { ms: 'x' } }, 'kind', STIMULUS_MESSAGES.kind)
    })

    it('never writes inline svg or html: unknown keys are 422; stray keys stored nowhere', async () => {
      const res = await admin.post('/api/stimuli', { kind: 'diagram', svg: '<svg onload=alert(1)>', imageFileId: await upload() })
      expect(res.status).toBe(422)
      expect((await admin.post('/api/stimuli', { kind: 'passage', body: { ms: 'x' }, html: '<script>' })).status).toBe(422)
      expect((await admin.post('/api/stimuli', { kind: 'audio', body: { ms: 'x' } })).status).toBe(422)
    })

    it('a picture must be a question_image file: another purpose, an unknown token and a malformed value are the same 422', async () => {
      const avatar = await upload(admin, 'avatar')
      for (const imageFileId of [avatar, 'tiada-fail-ini', '0', '99999999999']) {
        const res = await admin.post('/api/stimuli', { kind: 'image', imageFileId })
        expect(res.status, imageFileId).toBe(422)
        expect(res.body.error.fields.imageFileId).toBe(STIMULUS_MESSAGES.image)
      }
    })

    it('bounds the free text and the table', async () => {
      expect((await admin.post('/api/stimuli', { kind: 'passage', body: { ms: 'x'.repeat(20_001) } })).status).toBe(422)
      expect((await admin.post('/api/stimuli', { kind: 'passage', body: { ms: 'x' }, caption: 'c'.repeat(301) })).status).toBe(422)
      expect((await admin.post('/api/stimuli', { kind: 'table', tableData: { head: Array.from({ length: 13 }, () => 'h'), rows: [['1']] } })).status).toBe(422)
      expect((await admin.post('/api/stimuli', { kind: 'table', tableData: { head: ['h'], rows: Array.from({ length: 61 }, () => ['1']) } })).status).toBe(422)
    })

    it('updates only the keys sent; null clears; the merged result must still satisfy the kind; an empty body is 422; unknown is 404', async () => {
      const made = await stimulus({ caption: 'Lama' })
      const res = await admin.put(`/api/stimuli/${made.id}`, { caption: 'Baharu', alt: 'Penerangan' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBe(STIMULUS_MESSAGES.updated)
      expect(res.body.data).toMatchObject({ caption: 'Baharu', alt: 'Penerangan', label: 'Petikan A', body: { ms: 'Teks petikan.' } })
      expect((await admin.put(`/api/stimuli/${made.id}`, { caption: null })).body.data.caption).toBeNull()
      const emptied = await admin.put(`/api/stimuli/${made.id}`, { body: null })
      expect(emptied.status).toBe(422)
      expect(emptied.body.error.fields.body).toBe(STIMULUS_MESSAGES.bodyRequired)
      expect((await admin.put(`/api/stimuli/${made.id}`, {})).status).toBe(422)
      expect((await admin.put(`/api/stimuli/${made.id}`, { kind: 'image' })).status).toBe(422) // the kind never changes
      expect((await admin.put('/api/stimuli/987654321', { caption: 'x' })).status).toBe(404)
      expect((await admin.put('/api/stimuli/987654321', {})).status).toBe(404) // 404 before 422
      expect((await admin.get('/api/stimuli/abc')).status).toBe(404)
    })

    it('swaps the picture of an image stimulus and refuses to remove it', async () => {
      const made = await stimulus({ kind: 'image', imageFileId: await upload(), body: undefined })
      const next = await upload()
      const res = await admin.put(`/api/stimuli/${made.id}`, { imageFileId: next })
      expect(res.body.data.imageId).toBe(next)
      const gone = await admin.put(`/api/stimuli/${made.id}`, { imageFileId: null })
      expect(gone.status).toBe(422)
      expect(gone.body.error.fields.imageFileId).toBe(STIMULUS_MESSAGES.imageRequired)
    })

    it('deletes an unused stimulus; a stimulus shown by a group is 409 with the BM message; audio rows are invisible', async () => {
      const free = await stimulus()
      const del = await admin.delete(`/api/stimuli/${free.id}`)
      expect(del.status).toBe(200)
      expect(del.body.status).toBe(STIMULUS_MESSAGES.deleted)
      expect((await admin.get(`/api/stimuli/${free.id}`)).status).toBe(404)
      expect((await admin.delete(`/api/stimuli/${free.id}`)).status).toBe(404)

      const used = await stimulus()
      await group([used.id], [await question(), await question()])
      const refused = await admin.delete(`/api/stimuli/${used.id}`)
      expect(refused.status).toBe(409)
      expect(refused.body.error.message).toBe(STIMULUS_MESSAGES.inUse)

      const audio = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label) values ('audio', 'Bunyi') returning id::text id`))[0]!.id
      expect((await admin.get(`/api/stimuli/${audio}`)).status).toBe(404)
      expect((await admin.delete(`/api/stimuli/${audio}`)).status).toBe(404)
    })
  })

  describe('groups (D90)', () => {
    it('creates a group of 1 to 3 stimuli and at least 2 questions; members get positions 1..n in the order sent; no marks, never a question', async () => {
      const a = await stimulus({ label: 'Petikan A' })
      const b = await stimulus({ kind: 'table', body: undefined, tableData: { head: ['x'], rows: [['1']] }, label: 'Jadual B' })
      const [q1, q2, q3] = [await question(), await question(), await question()] as [string, string, string]
      const questionsBefore = Number((await t.db.query<{ n: string }>('select count(*)::text n from questions'))[0]!.n)
      const res = await admin.post('/api/stimulus-groups', { label: 'Kumpulan 1', stimulusIds: [b.id, a.id], questionIds: [q3, q1, q2] })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe(STIMULUS_MESSAGES.groupCreated)
      const g = StimulusGroupDetailSchema.parse(res.body.data)
      expect(g.stimuli.map((s) => s.id)).toEqual([b.id, a.id])
      expect(g.questionIds).toEqual([q3, q1, q2])
      expect(g.scope).toBe('section')
      expect(JSON.stringify(g)).not.toMatch(/marks|markah/i)
      expect(await positions(g.id)).toEqual([{ id: q3, pos: 1 }, { id: q1, pos: 2 }, { id: q2, pos: 3 }])
      // The group is not a question: creating it adds no row to `questions`.
      expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from questions'))[0]!.n)).toBe(questionsBefore)
      expect((await admin.get(`/api/stimulus-groups/${g.id}`)).body.data).toEqual(g)
      // Each member shows the shared stimuli once, through the question read.
      for (const q of [q1, q2, q3]) {
        const detail = await admin.get(`/api/questions/${q}`)
        expect(detail.body.data.stimulusGroup.id).toBe(g.id)
        expect(detail.body.data.stimulusGroup.stimuli).toHaveLength(2)
      }
    })

    it('refuses bad stimulus and member lists with a BM message on the right field', async () => {
      const [s1, s2, s3, s4] = [await stimulus(), await stimulus(), await stimulus(), await stimulus()] as [{ id: string }, { id: string }, { id: string }, { id: string }]
      const [q1, q2, q3] = [await question(), await question(), await question()] as [string, string, string]
      const taken = await group([s1.id], [q3, await question()])
      const cases: [Record<string, unknown>, string, string][] = [
        [{ stimulusIds: [], questionIds: [q1, q2] }, 'stimulusIds', STIMULUS_MESSAGES.stimuliCount],
        [{ stimulusIds: [s1.id, s2.id, s3.id, s4.id], questionIds: [q1, q2] }, 'stimulusIds', STIMULUS_MESSAGES.stimuliCount],
        [{ stimulusIds: [s1.id, s1.id], questionIds: [q1, q2] }, 'stimulusIds', STIMULUS_MESSAGES.stimuliInvalid],
        [{ stimulusIds: ['987654321'], questionIds: [q1, q2] }, 'stimulusIds', STIMULUS_MESSAGES.stimuliInvalid],
        [{ stimulusIds: [s1.id], questionIds: [q1] }, 'questionIds', STIMULUS_MESSAGES.membersMin],
        [{ stimulusIds: [s1.id], questionIds: [q1, q1] }, 'questionIds', STIMULUS_MESSAGES.membersInvalid],
        [{ stimulusIds: [s1.id], questionIds: [q1, '987654321'] }, 'questionIds', STIMULUS_MESSAGES.membersInvalid],
        [{ stimulusIds: [s1.id], questionIds: [q1, q3] }, 'questionIds', STIMULUS_MESSAGES.memberTaken],
        [{ stimulusIds: [s1.id], questionIds: [q1, q2], marks: 5 }, '_', expect.any(String) as unknown as string],
      ]
      for (const [body, field, message] of cases) {
        const res = await admin.post('/api/stimulus-groups', body)
        expect(res.status, JSON.stringify(body)).toBe(422)
        if (field !== '_') expect(res.body.error.fields[field], JSON.stringify(res.body)).toBe(message)
      }
      // Nothing half-built: q1 and q2 are still outside any group.
      expect(await t.db.query(`select 1 from questions where id in ($1, $2) and group_id is not null`, [q1, q2])).toEqual([])
      expect(taken.questionIds).toHaveLength(2)
    })

    it('a PKSK question cannot be grouped', async () => {
      const pksk = await question()
      await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'X')`, [pksk])
      const res = await admin.post('/api/stimulus-groups', { stimulusIds: [(await stimulus()).id], questionIds: [pksk, await question()] })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.membersInvalid)
    })

    it('adds a member at the end; a question of another group or of this group is refused', async () => {
      const g = await group([(await stimulus()).id], [await question(), await question()])
      const other = await group([(await stimulus()).id], [await question(), await question()])
      const q = await question()
      const added = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: q })
      expect(added.status, JSON.stringify(added.body)).toBe(200)
      expect(added.body.status).toBe(STIMULUS_MESSAGES.memberAdded)
      expect(added.body.data.questionIds).toEqual([...g.questionIds, q])
      expect((await positions(g.id)).map((p) => p.pos)).toEqual([1, 2, 3])

      const again = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: q })
      expect(again.status).toBe(422)
      expect(again.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberExists)
      const stolen = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: other.questionIds[0] })
      expect(stolen.status).toBe(422)
      expect(stolen.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberTaken)
      expect((await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: '987654321' })).body.error.fields.questionId).toBe(STIMULUS_MESSAGES.membersInvalid)
      expect((await admin.post('/api/stimulus-groups/987654321/members', { questionId: q })).status).toBe(404)
    })

    it('removes a member and closes the gap; fewer than 2 left still succeeds with a BM warning', async () => {
      const [q1, q2, q3] = [await question(), await question(), await question()] as [string, string, string]
      const g = await group([(await stimulus()).id], [q1, q2, q3])
      const first = await admin.delete(`/api/stimulus-groups/${g.id}/members/${q2}`)
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      expect(first.body.status).toBe(STIMULUS_MESSAGES.memberRemoved)
      expect(first.body.data.warning).toBeNull()
      expect(first.body.data.group.questionIds).toEqual([q1, q3])
      expect(await positions(g.id)).toEqual([{ id: q1, pos: 1 }, { id: q3, pos: 2 }])
      expect(await t.db.query(`select 1 from questions where id = $1 and group_id is null and group_position is null`, [q2])).toHaveLength(1)

      const second = await admin.delete(`/api/stimulus-groups/${g.id}/members/${q1}`)
      expect(second.status).toBe(200)
      expect(second.body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(1))
      expect(second.body.data.warning).toBe('Kumpulan ini kini hanya mempunyai 1 soalan. Rangsangan bersama lazimnya untuk sekurang-kurangnya 2 soalan.')
      const last = await admin.delete(`/api/stimulus-groups/${g.id}/members/${q3}`)
      expect(last.body.data.warning).toBe(STIMULUS_MESSAGES.smallGroup(0))
      expect(last.body.data.group.questionIds).toEqual([])
      // A non-member and an unknown group are 404.
      expect((await admin.delete(`/api/stimulus-groups/${g.id}/members/${q1}`)).status).toBe(404)
      expect((await admin.delete(`/api/stimulus-groups/987654321/members/${q1}`)).status).toBe(404)
    })

    it('reorders: the list must be exactly the current members; positions follow', async () => {
      const [q1, q2, q3] = [await question(), await question(), await question()] as [string, string, string]
      const g = await group([(await stimulus()).id], [q1, q2, q3])
      const ok = await admin.put(`/api/stimulus-groups/${g.id}/members/order`, { questionIds: [q3, q1, q2] })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(ok.body.status).toBe(STIMULUS_MESSAGES.membersReordered)
      expect(ok.body.data.questionIds).toEqual([q3, q1, q2])
      expect(await positions(g.id)).toEqual([{ id: q3, pos: 1 }, { id: q1, pos: 2 }, { id: q2, pos: 3 }])
      const outsider = await question()
      for (const questionIds of [[q1, q2], [q1, q2, q3, q3], [q1, q2, outsider], [q1, q2, q3, outsider]]) {
        const bad = await admin.put(`/api/stimulus-groups/${g.id}/members/order`, { questionIds })
        expect(bad.status, JSON.stringify(questionIds)).toBe(422)
        expect(bad.body.error.fields.questionIds).toBe(STIMULUS_MESSAGES.orderInvalid)
      }
      expect((await positions(g.id)).map((p) => p.id)).toEqual([q3, q1, q2])
      expect((await admin.put('/api/stimulus-groups/987654321/members/order', { questionIds: [q1] })).status).toBe(404)
    })

    it('relabels and replaces the ordered stimuli (1 to 3)', async () => {
      const [a, b, c, d] = [await stimulus(), await stimulus(), await stimulus(), await stimulus()] as [{ id: string }, { id: string }, { id: string }, { id: string }]
      const g = await group([a.id], [await question(), await question()])
      const res = await admin.put(`/api/stimulus-groups/${g.id}`, { label: 'Baharu', stimulusIds: [c.id, b.id, a.id] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.label).toBe('Baharu')
      expect(res.body.data.stimuli.map((s: { id: string }) => s.id)).toEqual([c.id, b.id, a.id])
      expect((await admin.put(`/api/stimulus-groups/${g.id}`, { stimulusIds: [a.id, b.id, c.id, d.id] })).status).toBe(422)
      expect((await admin.put(`/api/stimulus-groups/${g.id}`, {})).status).toBe(422)
      expect((await admin.put('/api/stimulus-groups/987654321', { label: 'x' })).status).toBe(404)
    })

    it('dissolves a group: members stay without the shared stimulus, the stimuli stay in the library', async () => {
      const s = await stimulus()
      const [q1, q2] = [await question(), await question()] as [string, string]
      const g = await group([s.id], [q1, q2])
      const res = await admin.delete(`/api/stimulus-groups/${g.id}`)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe(STIMULUS_MESSAGES.groupDeleted)
      expect(res.body.data).toEqual({ deleted: 1, releasedQuestionIds: [q1, q2] })
      expect((await admin.get(`/api/stimulus-groups/${g.id}`)).status).toBe(404)
      expect(await t.db.query(`select 1 from questions where id in ($1, $2) and group_id is null and group_position is null`, [q1, q2])).toHaveLength(2)
      expect((await admin.get(`/api/stimuli/${s.id}`)).status).toBe(200)
      expect((await admin.delete(`/api/stimuli/${s.id}`)).status).toBe(200) // no longer in use
    })

    it('creates a question directly inside a group, appended at the end; a different group id in the body is 422; unknown group is 404', async () => {
      const g = await group([(await stimulus()).id], [await question(), await question()])
      const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { questionText: 'Soalan dalam kumpulan?' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe(STIMULUS_MESSAGES.questionAdded)
      const created = mutationEnvelopeOf(QuestionSchema).parse(res.body).data
      expect((await admin.get(`/api/stimulus-groups/${g.id}`)).body.data.questionIds).toEqual([...g.questionIds, created.id])
      expect(await positions(g.id)).toHaveLength(3)

      const mismatch = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { stimulusGroupId: '123456' }))
      expect(mismatch.status).toBe(422)
      expect(mismatch.body.error.fields.stimulusGroupId).toBe(STIMULUS_MESSAGES.groupMismatch)
      const same = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { stimulusGroupId: g.id }))
      expect(same.status).toBe(201)
      expect((await admin.post(`/api/stimulus-groups/${g.id}/questions`, { questionType: 'mcq' })).status).toBe(422)
      expect((await admin.post('/api/stimulus-groups/987654321/questions', mcqBody(refs))).status).toBe(404)
    })

    it('works on a seeded question too (a bank question joins a group and keeps its live version)', async () => {
      const seeded = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
      const live = (await t.db.query<{ v: number | null }>(`select live_version_no v from questions where id = $1`, [seeded]))[0]!.v
      const g = await group([(await stimulus()).id], [seeded, await question()])
      expect(g.questionIds[0]).toBe(seeded)
      expect((await t.db.query<{ v: number | null }>(`select live_version_no v from questions where id = $1`, [seeded]))[0]!.v).toBe(live)
    })
  })

  describe('audit', () => {
    it('writes one row per write with ids and counts only, never the stimulus text', async () => {
      const made = await stimulus({ body: { ms: 'RAHSIA-PETIKAN-123' }, caption: 'RAHSIA-KAPSYEN' })
      const created = await auditRows('stimulus.created')
      const mine = created.find((r) => r.target_id === made.id)
      expect(mine?.actor_user_id).toBe(adminId)
      const g = await group([made.id], [await question(), await question()])
      expect((await auditRows('stimulus.group.created')).some((r) => r.target_id === g.id)).toBe(true)
      await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: await question() })
      expect((await auditRows('stimulus.group.members_changed')).some((r) => r.target_id === g.id)).toBe(true)
      const all = JSON.stringify([...(await auditRows('stimulus.created')), ...(await auditRows('stimulus.group.created'))])
      expect(all).not.toContain('RAHSIA')
    })
  })
})
