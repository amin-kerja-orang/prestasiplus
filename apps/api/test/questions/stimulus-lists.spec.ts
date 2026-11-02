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

    it('REQ-B-025a: a group whose only pinned member was archived or deactivated still lists as served while a published paper pins it', async () => {
      const pin = async (questionId: string, status = 'published'): Promise<void> => {
        const p = (await t.db.query<{ id: string }>(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', 'Kertas terbit', $1, 1, 60, $2) returning id::text id`, [refs.mathId, status]))[0]!.id
        const sec = (await t.db.query<{ id: string }>(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'Bahagian A', 1, 0) returning id::text id`, [p]))[0]!.id
        await t.db.query(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, 1)`, [sec, questionId])
      }
      const s = await group([await stimulus()], [])
      const made = await admin.post(`/api/stimulus-groups/${s.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
      const qid = made.body.data.id as string
      await pin(qid)
      // archived (the live version goes) and deactivated: only the published pin serves it now
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [qid] })).status).toBe(200)
      await t.db.query(`update questions set is_active = false where id = $1`, [qid])
      const row = (await groups('status=served&pageSize=100')).data.find((r) => r.id === s.id)
      expect(row, 'listed as served').toBeDefined()
      expect(row!.members[0]).toMatchObject({ id: qid, status: 'archived', servable: true })
      expect((await groups('status=draft&pageSize=100')).data.map((r) => r.id)).not.toContain(s.id)
      // a draft paper pins nothing for pupils: another archived member of a group is draft
      const d = await group([await stimulus()], [])
      const made2 = await admin.post(`/api/stimulus-groups/${d.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
      await pin(made2.body.data.id as string, 'draft')
      await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [made2.body.data.id as string] })
      expect((await groups('status=draft&pageSize=100')).data.map((r) => r.id)).toContain(d.id)
    })

    it('REQ-C-019: joinable=true keeps the groups without a served member (served, draft and empty groups are told apart)', async () => {
      const draft = await group([await stimulus()], [await question(), await question()])
      const empty = await group([await stimulus()], [])
      const served = await group([await stimulus()], [])
      expect((await admin.post(`/api/stimulus-groups/${served.id}/questions`, mcqBody(refs, { status: 'approved', tag }))).status).toBe(201)
      const joinable = (await groups('joinable=true&pageSize=100')).data.map((r) => r.id)
      expect(joinable).toEqual(expect.arrayContaining([draft.id, empty.id]))
      expect(joinable).not.toContain(served.id)
      const all = (await groups('pageSize=100')).data.map((r) => r.id)
      expect(all).toContain(served.id) // without the filter it is listed
      // it combines with the other filters and the total follows
      const both = await groups('joinable=true&status=draft&pageSize=100')
      expect(both.data.map((r) => r.id)).not.toContain(served.id)
      expect(both.meta.totalItems).toBe(both.data.length)
      expect((await groups('joinable=true&status=served&pageSize=100')).data).toEqual([])
      expect((await admin.get('/api/stimulus-groups?joinable=false')).status).toBe(422)
      expect((await admin.get('/api/stimuli?joinable=true')).status).toBe(422) // the stimulus list has no such filter
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

  describe('secondary only (D72) and memberless groups', () => {
    const darjah = async (): Promise<string> => (await t.db.query<{ id: string }>(`select id::text id from education_levels where stage = 'primary' order by id limit 1`))[0]!.id
    const setLevel = (questionId: string, levelId: string) => t.db.query(`update question_versions set education_level_id = $2::bigint where question_id = $1`, [questionId, levelId])
    const listedGroups = async (query: string): Promise<string[]> => (await groups(`${query}&pageSize=100`)).data.map((r) => r.id)
    const listedStimuli = async (query: string): Promise<string[]> => (await stimuli(`${query}&pageSize=100`)).data.map((r) => r.id)

    it('a group with a Darjah (primary-level) member, and one with a PKSK member, is not listed; a secondary group is; the total follows', async () => {
      const mark = `D72g${tagTag}`
      const ok = await group([await stimulus({ label: `${mark} ok` })], [await question({ questionText: 'Soalan menengah untuk senarai D72 kumpulan.' })])
      const primaryQ = await question({ questionText: 'Soalan Darjah untuk senarai D72 kumpulan.' })
      const primary = await group([await stimulus({ label: `${mark} darjah` })], [primaryQ])
      await setLevel(primaryQ, await darjah())
      const pkskQ = await question({ questionText: 'Soalan PKSK untuk senarai D72 kumpulan.' })
      const pksk = await group([await stimulus({ label: `${mark} pksk` })], [pkskQ])
      await t.db.query(`insert into question_tags (question_id, kind, code) values ($1::bigint, 'pksk_domain', 'ujian')`, [pkskQ])
      // a mixed group (one secondary, one Darjah member) is hidden as a whole: it cannot be shown without a Darjah row
      const mixedPrimary = await question({ questionText: 'Soalan Darjah dalam kumpulan campuran D72.' })
      const mixed = await group([await stimulus({ label: `${mark} campuran` })], [await question({ questionText: 'Soalan menengah dalam kumpulan campuran D72.' }), mixedPrimary])
      await setLevel(mixedPrimary, await darjah())

      const found = await listedGroups(`q=${mark}`)
      expect(found).toEqual([ok.id])
      expect(found).not.toContain(primary.id)
      expect(found).not.toContain(pksk.id)
      expect(found).not.toContain(mixed.id)
      expect((await groups(`q=${mark}`)).meta.totalItems).toBe(1)
      // the subject filter and the status filter obey it too
      expect(await listedGroups(`q=${mark}&subjectId=${refs.mathId}`)).toEqual([ok.id])
      expect(await listedGroups(`q=${mark}&status=draft`)).toEqual([ok.id])
    })

    it('a stimulus used only by Darjah or PKSK questions is not listed; an unused one and a secondary one are', async () => {
      const mark = `D72s${tagTag}`
      const used = await stimulus({ label: `${mark} menengah` })
      await group([used], [await question({ questionText: 'Soalan menengah untuk senarai D72 rangsangan.' })])
      const primaryStim = await stimulus({ label: `${mark} darjah` })
      const primaryQ = await question({ questionText: 'Soalan Darjah untuk senarai D72 rangsangan.' })
      await group([primaryStim], [primaryQ])
      await setLevel(primaryQ, await darjah())
      const pkskStim = await stimulus({ label: `${mark} pksk` })
      const pkskQ = await question({ questionText: 'Soalan PKSK untuk senarai D72 rangsangan.' })
      await group([pkskStim], [pkskQ])
      await t.db.query(`insert into question_tags (question_id, kind, code) values ($1::bigint, 'pksk_domain', 'ujian')`, [pkskQ])
      const unused = await stimulus({ label: `${mark} belum guna` })
      // a stimulus linked straight to a Darjah question version (not through a group) is hidden as well
      const linked = await stimulus({ label: `${mark} pautan darjah` })
      const linkedQ = await question({ questionText: 'Soalan Darjah dengan pautan terus untuk D72.' })
      await t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) select v.id, $2::bigint, 1 from question_versions v where v.question_id = $1 and v.version_no = 1`, [linkedQ, linked])
      await setLevel(linkedQ, await darjah())

      // a stimulus reachable ONLY through a PART of a question (no group, no version link): hidden when that question is Darjah or PKSK, listed when it is secondary
      const attachToPart = async (questionId: string, stimulusId: string): Promise<void> => {
        const done = await t.db.query<{ id: string }>(
          `update question_parts set stimulus_id = $2::bigint where id = (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 order by p.id limit 1) returning id::text id`,
          [questionId, stimulusId],
        )
        expect(done).toHaveLength(1)
      }
      const partPrimaryStim = await stimulus({ label: `${mark} bahagian darjah` })
      const partPrimaryQ = await question({ questionText: 'Soalan Darjah dengan rangsangan pada bahagian untuk D72.' })
      await attachToPart(partPrimaryQ, partPrimaryStim)
      await setLevel(partPrimaryQ, await darjah())
      const partPkskStim = await stimulus({ label: `${mark} bahagian pksk` })
      const partPkskQ = await question({ questionText: 'Soalan PKSK dengan rangsangan pada bahagian untuk D72.' })
      await attachToPart(partPkskQ, partPkskStim)
      await t.db.query(`insert into question_tags (question_id, kind, code) values ($1::bigint, 'pksk_domain', 'ujian')`, [partPkskQ])
      const partOkStim = await stimulus({ label: `${mark} bahagian menengah` })
      await attachToPart(await question({ questionText: 'Soalan menengah dengan rangsangan pada bahagian untuk D72.' }), partOkStim)

      const found = await listedStimuli(`q=${mark}`)
      expect([...found].sort()).toEqual([used, unused, partOkStim].sort())
      expect(found).not.toContain(partPrimaryStim)
      expect(found).not.toContain(partPkskStim)
      expect((await stimuli(`q=${mark}`)).meta.totalItems).toBe(3)
    })

    it('a stimulus linked only through a PART of a question follows that question\'s subject and level (the Subjek and Tahap filters read part links too)', async () => {
      const mark = `Bahagian${tagTag}`
      const viaPart = await stimulus({ label: `${mark} pautan bahagian` })
      const q = await question({ questionText: 'Soalan Sains dengan rangsangan pada bahagian untuk penapis subjek.', subjectId: refs.sciId })
      const attached = await t.db.query<{ id: string }>(
        `update question_parts set stimulus_id = $2::bigint where id = (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 order by p.id limit 1) returning id::text id`,
        [q, viaPart],
      )
      expect(attached).toHaveLength(1)
      expect(await listedStimuli(`q=${mark}&subjectId=${refs.sciId}`)).toEqual([viaPart])
      expect(await listedStimuli(`q=${mark}&subjectId=${refs.mathId}`)).toEqual([])
      expect(await listedStimuli(`q=${mark}&educationLevelId=${refs.t4Id}`)).toEqual([viaPart])
    })

    it('a group with no member yet is listed under a subject or level filter (it fits any: the first question decides)', async () => {
      const mark = `Kosong${tagTag}`
      const empty = await group([await stimulus({ label: `${mark} kumpulan kosong` })], [])
      const withMember = await group([await stimulus({ label: `${mark} dengan ahli` })], [await question({ questionText: 'Soalan untuk kumpulan dengan ahli subjek MATH.' })])
      const other = await group([await stimulus({ label: `${mark} sains` })], [await question({ questionText: 'Soalan untuk kumpulan subjek Sains sahaja.', subjectId: refs.sciId })])
      expect([...(await listedGroups(`q=${mark}`))].sort()).toEqual([empty.id, withMember.id, other.id].sort())
      const math = await listedGroups(`q=${mark}&subjectId=${refs.mathId}`)
      expect([...math].sort()).toEqual([empty.id, withMember.id].sort()) // the empty group stays; the Sains group does not
      expect(await listedGroups(`q=${mark}&subjectId=${refs.sciId}`).then((x) => [...x].sort())).toEqual([empty.id, other.id].sort())
      expect([...(await listedGroups(`q=${mark}&educationLevelId=${refs.t4Id}`))].sort()).toEqual([empty.id, withMember.id, other.id].sort())
      // status: an empty group has no served member, so it is a draft
      expect(await listedGroups(`q=${mark}&status=draft&subjectId=${refs.mathId}`).then((x) => [...x].sort())).toEqual([empty.id, withMember.id].sort())
    })

    it('joinable=true with a subject filter lists an EMPTY group (no served member, fits any subject), hides the served and the Darjah ones, and the total agrees on every page', async () => {
      const mark = `Gabung${tagTag}`
      const empty = await group([await stimulus({ label: `${mark} kosong` })], [])
      const draftMember = await group([await stimulus({ label: `${mark} draf` })], [await question({ questionText: 'Soalan draf untuk gabungan joinable dan subjek.' })])
      const served = await group([await stimulus({ label: `${mark} diterbit` })], [])
      expect((await admin.post(`/api/stimulus-groups/${served.id}/questions`, mcqBody(refs, { status: 'approved', tag }))).status).toBe(201)
      const primaryQ = await question({ questionText: 'Soalan Darjah untuk gabungan joinable dan subjek.' })
      const primary = await group([await stimulus({ label: `${mark} darjah` })], [primaryQ])
      await setLevel(primaryQ, await darjah())
      const other = await group([await stimulus({ label: `${mark} sains` })], [await question({ questionText: 'Soalan Sains untuk gabungan joinable dan subjek.', subjectId: refs.sciId })])

      const base = `q=${mark}&joinable=true&subjectId=${refs.mathId}`
      expect([...(await listedGroups(base))].sort()).toEqual([empty.id, draftMember.id].sort())
      for (const hidden of [served.id, primary.id, other.id]) expect(await listedGroups(base)).not.toContain(hidden)
      // page 1 and page 2 hold one group each; page 3 is past the end (the count path): the total is 2 on all three
      const seen: string[] = []
      for (const page of [1, 2, 3]) {
        const res = await groups(`${base}&pageSize=1&page=${page}`)
        expect(res.meta.totalItems, `page ${page}`).toBe(2)
        seen.push(...res.data.map((r) => r.id))
      }
      expect([...seen].sort()).toEqual([empty.id, draftMember.id].sort())
      // a group hidden by D72 is only hidden from the lists: the admin detail by id still answers
      const detail = await admin.get(`/api/stimulus-groups/${primary.id}`)
      expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    })
  })

  describe('GET /api/questions/filter-options (REQ-C-019)', () => {
    it('lists the distinct exam boards of the source papers, trimmed and sorted; Admin Pusat only; no-store', async () => {
      for (const [board, key] of [['Johor', 'a'], [' Selangor ', 'b'], ['Johor', 'c'], ['', 'd'], [null, 'e'], ['JOHOR', 'f'], ['selangor', 'g'], ['Selangor', 'h']] as const) {
        await t.db.query(`insert into source_papers (natural_key, subject_id, kertas, year, exam_type, exam_board, rights_status) values ($1, $2::bigint, 'K1', 2020, 'sebenar', $3, 'own')`, [`fo|${key}|${tagTag}`, refs.mathId, board])
      }
      const res = await admin.get('/api/questions/filter-options')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.data.negeri).toEqual(expect.arrayContaining(['Johor', 'Selangor']))
      expect(res.body.data.negeri.filter((n: string) => n === 'Johor')).toHaveLength(1)
      // case-insensitively distinct (the Negeri filter matches that way): one entry per spelling family, the most used spelling shown
      const lower = res.body.data.negeri.map((n: string) => n.toLowerCase())
      expect(new Set(lower).size).toBe(lower.length)
      expect(res.body.data.negeri).toContain('Selangor') // ' Selangor ' (trimmed) + 'Selangor' beat 'selangor'
      expect(res.body.data.negeri).not.toContain('JOHOR')
      expect(res.body.data.negeri).not.toContain('selangor')
      expect(res.body.data.negeri.every((n: string) => n.trim() === n && n !== '')).toBe(true)
      expect(res.body.data.negeri).toEqual([...res.body.data.negeri].sort((a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0)))
      // the value is what the Negeri list filter matches (case-insensitively)
      expect((await admin.get('/api/questions?negeri=johor')).status).toBe(200)
      expect((await teacher.get('/api/questions/filter-options')).status).toBe(403)
      expect((await pupil.get('/api/questions/filter-options')).status).toBe(403)
      expect((await t.http().get('/api/questions/filter-options')).status).toBe(401)
    })
  })
})
