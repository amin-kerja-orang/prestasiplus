import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, STIMULUS_MESSAGES, StimulusGroupDetailSchema, StimulusGroupListRowSchema, StimulusListRowSchema, listEnvelopeOf, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * R1-T49 (REQ-C-004/005): the Studio lists of stimulus groups and stimuli. Admin Pusat only, no-store, strict bounded query, filters
 * (subject, level, status, text), and the short form of the members on every group so the Studio does not fetch them one by one.
 * Status: `served` = a member (group) or a linked version (stimulus) is shown to pupils now; `draft` = none is.
 */
describe('stimulus group and stimulus lists (admin, real database)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let pupil: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>
  const tagTag = `Lst${String(Date.now() % 100000)}`

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-stimulus-lists-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    pupil = await loginAs(t, 'student')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const stimulus = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: `Petikan ${tagTag}`, body: { ms: 'Teks petikan.' }, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
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
  const groups = async (query: string) => {
    const res = await admin.get(`/api/stimulus-groups?${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return listEnvelopeOf(StimulusGroupListRowSchema).parse(res.body)
  }
  const stimuli = async (query: string) => {
    const res = await admin.get(`/api/stimuli?${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return listEnvelopeOf(StimulusListRowSchema).parse(res.body)
  }

  describe('guards and bounds', () => {
    it('401 anonymous; 403 teacher and pupil; no-store on the admin read', async () => {
      for (const path of ['/api/stimulus-groups', '/api/stimuli']) {
        expect((await t.http().get(path)).status, path).toBe(401)
        expect((await teacher.get(path)).status, `${path} teacher`).toBe(403)
        expect((await pupil.get(path)).status, `${path} pupil`).toBe(403)
        const ok = await admin.get(path)
        expect(ok.status).toBe(200)
        expect(ok.headers['cache-control']).toBe('no-store')
      }
    })

    it('pageSize 101, 0, a page past the cap, non-numbers, an unknown key and a repeated key are 422 with a BM message', async () => {
      for (const path of ['/api/stimulus-groups', '/api/stimuli']) {
        for (const [query, field, message] of [
          ['pageSize=101', 'pageSize', STIMULUS_MESSAGES.pageSize],
          ['pageSize=0', 'pageSize', STIMULUS_MESSAGES.pageSize],
          ['pageSize=abc', 'pageSize', STIMULUS_MESSAGES.pageSize],
          ['page=0', 'page', STIMULUS_MESSAGES.page],
          ['page=100001', 'page', STIMULUS_MESSAGES.page],
          ['page=1.5', 'page', STIMULUS_MESSAGES.page],
          ['status=baru', 'status', STIMULUS_MESSAGES.filter],
          [`q=${'x'.repeat(101)}`, 'q', STIMULUS_MESSAGES.search],
        ] as const) {
          const res = await admin.get(`${path}?${query}`)
          expect(res.status, `${path}?${query}`).toBe(422)
          expect(res.body.error.fields[field], `${path}?${query}`).toBe(message)
        }
        expect((await admin.get(`${path}?evil=1`)).status).toBe(422)
        expect((await admin.get(`${path}?status=draft&status=served`)).status).toBe(422)
        expect((await admin.get(`${path}?pageSize=100`)).status).toBe(200)
        expect((await admin.get(`${path}?page=&pageSize=`)).status).toBe(200) // empty = absent
      }
      expect((await admin.get('/api/stimuli?kind=audio')).status).toBe(422)
    })
  })

  describe('groups', () => {
    it('paged, newest first, with the total and the members in published order in their short form', async () => {
      const long = `${'Panjang '.repeat(30)}<b>tebal</b>`
      const [q1, q2, q3] = [await question({ questionText: long }), await question({ questionText: '<p>Soalan   dua</p>' }), await question({ questionText: 'Soalan tiga?' })] as [string, string, string]
      await t.db.query(`update question_versions set number_label = 'Q1' where question_id = $1`, [q1])
      const g = await group([await stimulus()], [q3, q1, q2])
      const page = await groups('pageSize=1')
      expect(page.meta).toMatchObject({ page: 1, pageSize: 1 })
      const row = page.data[0]!
      expect(row.id).toBe(g.id)
      expect(row.memberCount).toBe(3)
      expect(row.members.map((m) => m.id)).toEqual([q3, q1, q2])
      expect(row.members.map((m) => m.id)).toEqual(g.questionIds)
      expect(row.members[1]).toMatchObject({ numberLabel: 'Q1', status: 'draft', servable: false })
      expect(row.members[1]!.stem.length).toBeLessThanOrEqual(121)
      expect(row.members[1]!.stem.endsWith('…')).toBe(true)
      expect(row.members[1]!.stem).not.toContain('<')
      expect(row.members[2]!.stem).toBe('Soalan dua')
      expect(row.members[0]).toMatchObject({ numberLabel: null, stem: 'Soalan tiga?' })
      expect(row.warning).toBeNull()
      // the detail read carries the same short form
      expect((await admin.get(`/api/stimulus-groups/${g.id}`)).body.data.members).toEqual(row.members)
      expect(g.members).toHaveLength(3)
    })

    it('status: served when a member is shown to pupils, draft otherwise (empty groups are draft)', async () => {
      const draft = await group([await stimulus()], [await question(), await question()])
      const empty = await group([await stimulus()], [])
      const s = await group([await stimulus()], [])
      const made = await admin.post(`/api/stimulus-groups/${s.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      const served = (await groups('status=served&pageSize=100')).data.map((r) => r.id)
      const drafts = (await groups('status=draft&pageSize=100')).data.map((r) => r.id)
      expect(served).toContain(s.id)
      expect(served).not.toContain(draft.id)
      expect(drafts).toEqual(expect.arrayContaining([draft.id, empty.id]))
      expect(drafts).not.toContain(s.id)
      const row = (await groups('status=served&pageSize=100')).data.find((r) => r.id === s.id)!
      expect(row.status).toBe('served')
      expect(row.members[0]).toMatchObject({ status: 'approved', servable: true })
      expect(row.warning).not.toBeNull() // one member
    })

    it('filters by subject and by level of the members', async () => {
      const math = await group([await stimulus()], [await question(), await question()])
      const sci = await group([await stimulus()], [await question({ subjectId: refs.sciId }), await question({ subjectId: refs.sciId })])
      const t5 = await group([await stimulus()], [await question({ educationLevelId: refs.t5Id })])
      const bySci = (await groups(`subjectId=${refs.sciId}&pageSize=100`)).data.map((r) => r.id)
      expect(bySci).toContain(sci.id)
      expect(bySci).not.toContain(math.id)
      const byT5 = (await groups(`educationLevelId=${refs.t5Id}&pageSize=100`)).data.map((r) => r.id)
      expect(byT5).toContain(t5.id)
      expect(byT5).not.toContain(math.id)
      const both = (await groups(`subjectId=${refs.mathId}&educationLevelId=${refs.t4Id}&pageSize=100`)).data.map((r) => r.id)
      expect(both).toContain(math.id)
      expect(both).not.toContain(sci.id)
      expect((await groups('subjectId=987654321')).data).toEqual([])
      expect((await groups('subjectId=bukan-id')).data).toEqual([])
    })

    it('searches the group label and the label / body of its stimuli, case-insensitively, with % and _ as literals', async () => {
      const a = await group([await stimulus({ label: 'Ekosistem Hutan' })], [await question()], { label: 'Kumpulan Alam' })
      const b = await group([await stimulus({ label: 'Lain', body: { ms: 'Rantai makanan di laut' } })], [await question()])
      const c = await group([await stimulus({ label: '100% tulen_asli' })], [await question()])
      const ids = async (q: string) => (await groups(`q=${encodeURIComponent(q)}&pageSize=100`)).data.map((r) => r.id)
      expect(await ids('ekosistem')).toEqual([a.id])
      expect(await ids('KUMPULAN alam')).toEqual([a.id])
      expect(await ids('rantai MAKANAN')).toEqual([b.id])
      expect(await ids('100%')).toEqual([c.id]) // % is literal, not "any"
      expect(await ids('tulen_a')).toEqual([c.id])
      expect(await ids('tulen\\')).toEqual([])
      expect(await ids('%')).toEqual([c.id])
      expect(await ids('_')).toEqual([c.id])
      expect((await groups('q=tiadamana')).meta.totalItems).toBe(0)
    })

    it('a page past the end is empty and still reports the real total', async () => {
      const first = await groups('pageSize=1')
      const far = await groups('pageSize=1&page=50000')
      expect(far.data).toEqual([])
      expect(far.meta.totalItems).toBe(first.meta.totalItems)
    })
  })

  describe('stimuli', () => {
    it('lists the seven kinds only, with a plain excerpt, caption, group count and status; audio rows never', async () => {
      const audio = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label) values ('audio', 'Bunyi ${tagTag}') returning id::text id`))[0]!.id
      const free = await stimulus({ label: `Bebas ${tagTag}`, body: { ms: '<p>Isi   petikan</p>' }, caption: 'Kapsyen' })
      const used = await stimulus({ label: `Guna ${tagTag}` })
      await group([used], [await question(), await question()])
      const rows = (await stimuli(`q=${tagTag}&pageSize=100`)).data
      expect(rows.map((r) => r.id)).not.toContain(audio)
      const f = rows.find((r) => r.id === free)!
      expect(f).toMatchObject({ kind: 'passage', label: `Bebas ${tagTag}`, caption: 'Kapsyen', excerpt: 'Isi petikan', groupCount: 0, status: 'draft', imageId: null })
      expect(rows.find((r) => r.id === used)).toMatchObject({ groupCount: 1, status: 'draft' })
    })

    it('status served follows the shown questions; subject, level and kind filters read the questions that use the stimulus', async () => {
      const s = await group([await stimulus({ label: `Terbit ${tagTag}` })], [])
      expect((await admin.post(`/api/stimulus-groups/${s.id}/questions`, mcqBody(refs, { status: 'approved', tag }))).status).toBe(201)
      const sci = await group([await stimulus({ label: `Sains ${tagTag}` })], [await question({ subjectId: refs.sciId })])
      const table = await stimulus({ kind: 'table', body: undefined, label: `Jadual ${tagTag}`, tableData: { head: ['a'], rows: [['1']] } })
      const served = (await stimuli(`status=served&pageSize=100`)).data.map((r) => r.id)
      expect(served).toContain(s.stimuli[0]!.id)
      expect(served).not.toContain(sci.stimuli[0]!.id)
      expect((await stimuli(`status=draft&pageSize=100`)).data.map((r) => r.id)).toContain(sci.stimuli[0]!.id)
      const bySci = (await stimuli(`subjectId=${refs.sciId}&pageSize=100`)).data.map((r) => r.id)
      expect(bySci).toContain(sci.stimuli[0]!.id)
      expect(bySci).not.toContain(s.stimuli[0]!.id)
      expect((await stimuli(`kind=table&q=${tagTag}&pageSize=100`)).data.map((r) => r.id)).toEqual([table])
      expect((await stimuli(`kind=table&q=${tagTag}`)).data[0]!.excerpt).toBeNull()
    })

    it('searches label and body, case-insensitively, with % and _ literal; paging reports the total', async () => {
      const a = await stimulus({ label: `Alfa ${tagTag}`, body: { ms: 'Semut dan gula' } })
      const b = await stimulus({ label: `Beta ${tagTag}`, body: { ms: '50% diskaun_hari' } })
      expect((await stimuli(`q=SEMUT`)).data.map((r) => r.id)).toEqual([a])
      expect((await stimuli(`q=${encodeURIComponent('50%')}`)).data.map((r) => r.id)).toEqual([b])
      // a bare % or _ matches only the rows that contain the character, never every row
      for (const q of ['%', '_']) {
        const found = (await stimuli(`q=${encodeURIComponent(q)}&pageSize=100`)).data.map((r) => r.id)
        expect(found, q).toContain(b)
        expect(found, q).not.toContain(a)
      }
      const paged = await stimuli(`q=${tagTag}&pageSize=1&page=2`)
      expect(paged.data).toHaveLength(1)
      expect(paged.meta.totalItems).toBeGreaterThanOrEqual(2)
      expect(paged.meta.page).toBe(2)
    })
  })
})
