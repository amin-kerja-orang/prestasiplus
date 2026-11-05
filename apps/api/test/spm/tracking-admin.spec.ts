import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  SpmAdminTrackingASetSchema,
  SpmTrackingAHubSchema,
  SpmTrackingASubjectResultSchema,
  TRACKING_A_CANDIDATE_CAP,
  TRACKING_A_MESSAGES as COPY,
  TRACKING_A_PROPOSED_COPY as PROPOSED,
  type SpmAdminTrackingASet,
  type SpmTrackingASubject,
} from '@pp/contract'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { SpmTrackingService } from '../../src/modules/spm'
import { SpmRepository } from '../../src/modules/spm/spm.repository'
import { addPool, addQuestion, addSet, bootSpmApp, expectCsrfInvalid, expectError, idOf, loginAs, parseData, type Client, type SpmTestApp } from './helpers'

/** API-BIJAK-13 (S3-T05, DM-24, FR-ADM-Q17.1..6) and the pupil half FR-MUR-13-18. Real database, real session guard. */
describe('Tracking A admin', () => {
  let t: SpmTestApp
  let admin: Client
  let student: Client
  let addmath: string
  const ROUTE = '/api/admin/spm/tracking-a'
  const q = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const parse = (res: { status: number; body: unknown }, status = 200): SpmAdminTrackingASet => {
    expect(res.status, JSON.stringify(res.body)).toBe(status)
    return SpmAdminTrackingASetSchema.parse((res.body as { data: unknown }).data)
  }
  const create = async (subjectId: string, setNo: number, year = 2026): Promise<SpmAdminTrackingASet> => parse(await admin.post(ROUTE, { subjectId, year, setNo }), 201)
  const qs = (ids: readonly string[]) => ids.map((id) => ({ kind: 'question' as const, id }))
  const group = async (label: string, ids: readonly string[]): Promise<string> => {
    const id = (await q<{ id: string }>(`insert into stimulus_groups (label) values ($1) returning id::text id`, [label]))[0]?.id as string
    const stimulus = (await q<{ id: string }>(`insert into stimuli (kind, label, body_ms) values ('passage', $1, 'Petikan ujian') returning id::text id`, [label]))[0]?.id as string
    await q(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1, $2, 1)`, [id, stimulus])
    for (const [i, qid] of ids.entries()) await q(`update questions set group_id = $1, group_position = $2 where id = $3`, [id, i + 1, qid])
    return id
  }
  const reasonOf = (res: { status: number; body: unknown }): string => expectError(res as never, 'VALIDATION_ERROR').fields?.items as string
  const members = async (setId: string): Promise<string[]> =>
    (await q<{ id: string }>(`select question_id::text id from spm_tracking_set_questions where set_id = $1 order by position`, [setId])).map((r) => r.id)
  /** A clean subject: its sets go and its questions stop being eligible, leaving `n` new servable questions at the given target. */
  const fresh = async (code: string, n: number, target: number): Promise<{ subjectId: string; ids: string[] }> => {
    const subjectId = await idOf(t.db, 'subjects', code)
    await q(`delete from spm_tracking_sets where subject_id = $1`, [subjectId])
    await q(`update questions set is_active = false where id in (select question_id from question_versions where subject_id = $1)`, [subjectId])
    await q(`update spm_subject_configs set target_type = 'latihan', target_size = $2 where subject_id = $1`, [subjectId, target])
    const ids: string[] = []
    for (let i = 0; i < n; i++) ids.push(await addQuestion(t.db, { subject: code, pool: false }))
    return { subjectId, ids }
  }

  beforeAll(async () => {
    t = await bootSpmApp()
    admin = await loginAs(t, 'admin')
    student = await loginAs(t, 'student')
    addmath = await idOf(t.db, 'subjects', 'ADDMATH')
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  describe('access', () => {
    it('[CI] 401 with no session, 403 for a pupil, 403 without the CSRF token, 404 for an unknown or malformed id', async () => {
      const anon = t.http()
      expectError(await anon.get(`${ROUTE}/1`), 'UNAUTHORIZED')
      expect((await student.get(`${ROUTE}/1`)).status).toBe(403)
      expect((await student.post(ROUTE, { subjectId: addmath, year: 2026, setNo: 1 })).status).toBe(403)
      expectCsrfInvalid(await admin.noCsrf.post(ROUTE, { subjectId: addmath, year: 2026, setNo: 1 }))
      expectError(await admin.get(`${ROUTE}/99999999`), 'NOT_FOUND')
      expectError(await admin.get(`${ROUTE}/abc`), 'NOT_FOUND')
      expectError(await admin.put(`${ROUTE}/99999999`, { items: [] }), 'NOT_FOUND')
    })
  })

  describe('field 17-01: Tambah Set', () => {
    it('[CI] creates an empty set whose target is read from spm_subject_configs (D-12), with kind ramalan (D-2)', async () => {
      const { subjectId } = await fresh('CHEM', 0, 33)
      const set = await create(subjectId, 1)
      expect(set).toMatchObject({ subject: 'Kimia', year: 2026, setNo: 1, kind: 'ramalan', targetCount: 33, filled: 0, attention: ['Hanya 0 daripada 33 soalan'], items: [] })
    })

    it('[CI] a repeat answers the exact text; the year and set number have their ranges; BM and BI are refused (D-11)', async () => {
      const { subjectId } = await fresh('BIO', 0, 20)
      await create(subjectId, 4)
      expect(expectError(await admin.post(ROUTE, { subjectId, year: 2026, setNo: 4 }), 'VALIDATION_ERROR').fields).toEqual({ setNo: 'Set 4 sudah wujud untuk subjek dan tahun ini.' })
      await create(subjectId, 4, 2025) // another year is another set
      const fieldOf = async (body: object): Promise<Record<string, string> | undefined> => expectError(await admin.post(ROUTE, body), 'VALIDATION_ERROR').fields as never
      // The test clock is frozen in 2026, so the highest year is 2027.
      expect(await fieldOf({ subjectId, year: 2019, setNo: 1 })).toEqual({ year: PROPOSED.yearRange(2027) })
      expect(await fieldOf({ subjectId, year: 2028, setNo: 1 })).toEqual({ year: PROPOSED.yearRange(2027) })
      await create(subjectId, 1, 2027)
      expect(await fieldOf({ subjectId, year: 2026, setNo: 100 })).toEqual({ setNo: PROPOSED.setNoRange })
      expect(await fieldOf({ subjectId, year: 2026, setNo: 0 })).toEqual({ setNo: PROPOSED.setNoRange })
      expect(await fieldOf({ year: 2026, setNo: 1 })).toEqual({ subjectId: 'Sila pilih subjek.' })
      for (const code of ['BM', 'BI']) expect(await fieldOf({ subjectId: await idOf(t.db, 'subjects', code), year: 2026, setNo: 50 })).toEqual({ subjectId: 'Sila pilih subjek.' })
    })

    it('[CI] the form select holds configured subjects without BM and BI (D-11)', async () => {
      const res = await admin.get('/api/admin/servability/lanes/tracking-a?pageSize=1')
      const names = (res.body as { setSubjects: { name: string }[] }).setSubjects.map((s) => s.name)
      expect(names).toContain('Kimia')
      expect(names).not.toContain('Bahasa Melayu')
      expect(names).not.toContain('Bahasa Inggeris')
    })
  })

  describe('PUT: the set in one transaction', () => {
    it('[CI] AC-ADM-Q17.1, AC-ADM-Q17.2: an empty set, target 20, 30 candidates: save 20, the pupil sees it unlocked and can start it', async () => {
      const { subjectId, ids } = await fresh('ADDMATH', 30, 20)
      const empty = await create(subjectId, 1)
      expect(empty.candidates).toBe(30)
      const before = parseData(await student.get('/api/spm/tracking-a/ADDMATH'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
      expect(before.sets).toEqual([])
      const saved = parse(await admin.put(`${ROUTE}/${empty.id}`, { items: qs(ids.slice(0, 20)) }))
      expect(saved).toMatchObject({ filled: 20, attention: [], targetCount: 20 })
      const after = parseData(await student.get('/api/spm/tracking-a/ADDMATH'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
      expect(after.sets).toEqual([{ year: 2026, setNo: 1, status: 'bersih', readyCount: 20, bankSource: null, dskpTagged: 0, dskpTotal: 20 }])
      const hub = parseData(await student.get('/api/spm/tracking-a'), SpmTrackingAHubSchema)
      expect(hub.openSubjects.find((c) => c.code === 'ADDMATH')?.startableSets).toBe(1)
      // What the pupil start reads through the practice port, in the admin's order.
      expect(await t.app.get(SpmTrackingService).ramalanQuestionIds(subjectId, 2026, 1)).toEqual(ids.slice(0, 20))
    })

    it('[CI] writes subject_id and year on each row, and swaps positions in place (the key blocks an update, not this save)', async () => {
      const { subjectId, ids } = await fresh('PHY', 4, 4)
      const set = await create(subjectId, 1)
      await admin.put(`${ROUTE}/${set.id}`, { items: qs(ids) })
      parse(await admin.put(`${ROUTE}/${set.id}`, { items: qs([...ids].reverse()) }))
      expect(await members(set.id)).toEqual([...ids].reverse())
      const rows = await q<{ subject_id: string; year: number; position: number }>(`select subject_id::text, year, position from spm_tracking_set_questions where set_id = $1 order by position`, [set.id])
      expect(rows).toEqual(ids.map((_, i) => ({ subject_id: subjectId, year: 2026, position: i + 1 })))
    })

    it('[CI] D-17: dskp_tagged is recomputed on save from the linked chapters', async () => {
      const { subjectId, ids } = await fresh('SCI', 2, 3)
      const tagged = await addQuestion(t.db, { subject: 'SCI', level: 'T4', chapterNumber: 1 })
      const set = await create(subjectId, 1)
      await admin.put(`${ROUTE}/${set.id}`, { items: qs([...ids, tagged]) })
      expect((await q<{ dskp_tagged: number }>(`select dskp_tagged from spm_tracking_sets where id = $1`, [set.id]))[0]?.dskp_tagged).toBe(1)
    })

    it('[CI] an empty body has the exact message, and a failed save leaves the set as it was', async () => {
      const { subjectId, ids } = await fresh('GEO', 3, 3)
      const set = await create(subjectId, 1)
      await admin.put(`${ROUTE}/${set.id}`, { items: qs(ids.slice(0, 2)) })
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: [] }))).toBe('Pilih sekurang-kurangnya satu soalan sebelum menyimpan.')
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: qs([ids[0] as string, ids[0] as string]) }))).toBe(PROPOSED.repeated(2))
      expect(await members(set.id)).toEqual(ids.slice(0, 2))
    })

    it('[CI] D-16: above the target is refused whole', async () => {
      const { subjectId, ids } = await fresh('EKON', 5, 3)
      const set = await create(subjectId, 1)
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: qs(ids) }))).toBe(PROPOSED.overTarget(3, 2))
      expect(await members(set.id)).toEqual([])
    })

    it('[CI] a question that is not servable is refused with its row number', async () => {
      const { subjectId, ids } = await fresh('PSI', 2, 3)
      const draft = await addQuestion(t.db, { subject: 'PSI', pool: false, status: 'draft' })
      const structured = await addQuestion(t.db, { subject: 'PSI', type: 'structured' })
      const otherSubject = await addQuestion(t.db, { subject: 'GEO', pool: false })
      const set = await create(subjectId, 1)
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: qs([ids[0] as string, draft]) }))).toBe(PROPOSED.notServable(2))
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: qs([structured]) }))).toBe(PROPOSED.notServable(1))
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: qs([otherSubject]) }))).toBe(PROPOSED.notServable(1))
    })

    it('[CI] PO 14, FR-ADM-Q17.3: a question in a sibling set is refused with the exact text; another year may use it; the index holds it', async () => {
      const { subjectId, ids } = await fresh('PERNIAGA', 4, 4)
      const one = await create(subjectId, 1)
      const two = await create(subjectId, 2)
      const other = await create(subjectId, 1, 2025)
      await admin.put(`${ROUTE}/${one.id}`, { items: qs(ids.slice(0, 2)) })
      expect(reasonOf(await admin.put(`${ROUTE}/${two.id}`, { items: qs([ids[2] as string, ids[1] as string]) }))).toBe(
        'Soalan No. 2 sudah ada dalam Set 1 untuk subjek dan tahun ini. Buang atau tukar soalan itu.',
      )
      expect(await members(two.id)).toEqual([])
      parse(await admin.put(`${ROUTE}/${other.id}`, { items: qs([ids[1] as string]) }))
      await expect(q(`insert into spm_tracking_set_questions (set_id, question_id, position, subject_id, year) values ($1, $2, 9, $3, 2026)`, [two.id, ids[0], subjectId])).rejects.toThrow(/uq_spm_tracking_set_questions_subject_id_year_question_id/)
      // A sibling's question is no candidate.
      const read = parse(await admin.get(`${ROUTE}/${two.id}`))
      expect(read.candidateItems.map((c) => c.id)).not.toContain(ids[0])
      expect(read.candidateItems.map((c) => c.id)).toContain(ids[2])
    })
  })

  describe('saveSet against the index: a race lost after the checks', () => {
    /** The sibling check sees nothing, as a save that ran it just before another save committed would. */
    const blindSiblingCheck = (times: number): void => {
      const spy = vi.spyOn(SpmRepository.prototype, 'siblingHolders')
      for (let i = 0; i < times; i++) spy.mockResolvedValueOnce(new Map())
    }
    afterEach(() => {
      vi.restoreAllMocks()
    })
    const dskpOf = async (setId: string): Promise<number | undefined> => (await q<{ dskp_tagged: number }>(`select dskp_tagged from spm_tracking_sets where id = $1`, [setId]))[0]?.dskp_tagged

    it('[CI] PO 14: the index error answers the exact sibling text, and the rollback keeps the rows and dskp_tagged the delete and the update touched', async () => {
      const { subjectId, ids } = await fresh('SCI', 3, 4)
      const tagged = await addQuestion(t.db, { subject: 'SCI', level: 'T4', chapterNumber: 1 })
      const one = await create(subjectId, 1)
      const two = await create(subjectId, 2)
      parse(await admin.put(`${ROUTE}/${one.id}`, { items: qs(ids.slice(0, 1)) }))
      parse(await admin.put(`${ROUTE}/${two.id}`, { items: qs([tagged]) }))
      expect(await dskpOf(two.id)).toBe(1)
      blindSiblingCheck(1)
      const res = await admin.put(`${ROUTE}/${two.id}`, { items: qs([ids[1] as string, ids[0] as string]) })
      expect(reasonOf(res)).toBe('Soalan No. 2 sudah ada dalam Set 1 untuk subjek dan tahun ini. Buang atau tukar soalan itu.')
      expect(await members(two.id)).toEqual([tagged])
      expect(await dskpOf(two.id)).toBe(1)
    })

    it('[CI] an index error no sibling explains is a 409, and the rollback keeps the set', async () => {
      const { subjectId, ids } = await fresh('CHEM', 3, 4)
      const one = await create(subjectId, 1)
      const two = await create(subjectId, 2)
      parse(await admin.put(`${ROUTE}/${one.id}`, { items: qs(ids.slice(0, 1)) }))
      parse(await admin.put(`${ROUTE}/${two.id}`, { items: qs(ids.slice(1, 2)) }))
      blindSiblingCheck(2)
      const res = await admin.put(`${ROUTE}/${two.id}`, { items: qs([ids[2] as string, ids[0] as string]) })
      expectError(res as never, 'CONFLICT')
      expect(res.status).toBe(409)
      expect(await members(two.id)).toEqual(ids.slice(1, 2))
    })

    it('[CI] a real deadlock between two saves answers a retryable 429, not a 500, and the set keeps its rows', async () => {
      const { subjectId, ids } = await fresh('BIO', 3, 4)
      const one = await create(subjectId, 1)
      const two = await create(subjectId, 2)
      const [first, second, kept] = ids as [string, string, string]
      parse(await admin.put(`${ROUTE}/${two.id}`, { items: qs([kept]) }))
      vi.spyOn(SpmRepository.prototype, 'siblingHolders').mockResolvedValue(new Map())
      const other = new pg.Client({ connectionString: t.db.url })
      await other.connect()
      try {
        const insert = (question: string, position: number) =>
          other.query(`insert into spm_tracking_set_questions (set_id, question_id, position, subject_id, year) values ($1, $2, $3, $4, 2026)`, [one.id, question, position, subjectId])
        await other.query('begin')
        await insert(first, 1)
        // The save inserts `second`, then waits on `first`. The other transaction then waits on `second`: a cycle.
        const save = (async () => admin.put(`${ROUTE}/${two.id}`, { items: qs([second, first]) }))()
        await vi.waitFor(async () => expect((await q<{ n: string }>(`select count(*)::text n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`))[0]?.n).toBe('1'), { timeout: 10_000, interval: 25 })
        const blocked = insert(second, 2).catch((e: { code?: string }) => e)
        const res = await save
        expectError(res as never, 'RATE_LIMITED')
        expect(res.status).toBe(429)
        expect(await blocked).toMatchObject({ rowCount: 1 })
      } finally {
        await other.query('rollback').catch(() => undefined)
        await other.end()
      }
      expect(await members(two.id)).toEqual([kept])
    }, 30_000)
  })

  describe('FR-ADM-Q17.6: a stimulus group is one unit', () => {
    it('[CI] AC-ADM-Q17.3, PO 15: a group of 4 with 3 free slots is refused whole; with 4 free it goes in together, in group order', async () => {
      const { subjectId, ids } = await fresh('AKAUN', 10, 8)
      const rajah = ids.slice(6, 10)
      const groupId = await group('Rajah 3', [...rajah].reverse())
      const ordered = [...rajah].reverse()
      const set = await create(subjectId, 1)
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: [...qs(ids.slice(0, 5)), { kind: 'group', id: groupId }] }))).toBe(
        'Kumpulan “Rajah 3” (4 soalan) tidak muat dalam 3 petak yang tinggal. Pilih kumpulan lain atau kosongkan petak.',
      )
      expect(await members(set.id)).toEqual([])
      const saved = parse(await admin.put(`${ROUTE}/${set.id}`, { items: [...qs(ids.slice(0, 4)), { kind: 'group', id: groupId }] }))
      expect(await members(set.id)).toEqual([...ids.slice(0, 4), ...ordered])
      expect(saved.filled).toBe(8)
      expect(saved.items.map((i) => [i.kind, i.position, i.questions])).toEqual([['question', 1, 1], ['question', 2, 1], ['question', 3, 1], ['question', 4, 1], ['group', 5, 4]])
      expect(saved.items[4]).toMatchObject({ id: groupId, label: 'Rajah 3' })
      expect(saved.items[4]?.members.map((m) => m.id)).toEqual(ordered)
    })

    it('[CI] a member sent alone is refused: a group is never split', async () => {
      const { subjectId, ids } = await fresh('PI', 3, 3)
      await group('Rajah 1', ids.slice(0, 2))
      const set = await create(subjectId, 1)
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: qs([ids[2] as string, ids[0] as string]) }))).toBe(PROPOSED.groupMember(2))
    })

    it('[CI] candidateItems lists a group once with its size; a group with a member that is not servable is not a candidate (D-10)', async () => {
      const { subjectId, ids } = await fresh('SEJ', 5, 5)
      const whole = await group('Rajah 2', ids.slice(0, 2))
      const broken = await group('Rajah 4', ids.slice(2, 4))
      await q(`update questions set is_active = false where id = $1`, [ids[3]])
      const set = await create(subjectId, 1)
      expect(set.candidateItems.find((c) => c.kind === 'group' && c.id === whole)).toMatchObject({ questions: 2, label: 'Rajah 2' })
      expect(set.candidateItems.find((c) => c.kind === 'group' && c.id === broken)).toBeUndefined()
      expect(set.candidateItems.map((c) => c.id)).not.toContain(ids[2])
      expect(set.candidateItems.find((c) => c.id === ids[4])).toMatchObject({ kind: 'question', questions: 1 })
    })

    it('[CI] D90: on the wire a group counts once in candidates and is one candidate item with its size', async () => {
      const { subjectId, ids } = await fresh('GEO', 5, 10)
      const groupId = await group('Rajah 5', ids.slice(0, 3))
      const set = await create(subjectId, 1)
      expect(set.candidates).toBe(3)
      expect(set.candidateItems.map((c) => [c.kind, c.id, c.questions])).toEqual([['group', groupId, 3], ['question', ids[3], 1], ['question', ids[4], 1]])
    })

    it('[CI] a group with a member of another subject is never split: refused on PUT, and no candidate in either subject', async () => {
      const { subjectId, ids } = await fresh('PHY', 3, 5)
      const other = await fresh('EKON', 1, 5)
      const groupId = await group('Rajah 6', [ids[0] as string, other.ids[0] as string, ids[1] as string])
      const set = await create(subjectId, 1)
      expect(set.candidates).toBe(1)
      expect(set.candidateItems.map((c) => c.id)).toEqual([ids[2]])
      const otherSet = await create(other.subjectId, 1)
      expect(otherSet.candidates).toBe(0)
      expect(otherSet.candidateItems).toEqual([])
      expect(reasonOf(await admin.put(`${ROUTE}/${set.id}`, { items: [...qs([ids[2] as string]), { kind: 'group', id: groupId }] }))).toBe(PROPOSED.notServable(2))
      expect(await members(set.id)).toEqual([])
      // An archived member is out of the group and no gap: the rest are still whole.
      await q(`update question_versions set status = 'archived' where question_id = $1`, [other.ids[0]])
      const saved = parse(await admin.put(`${ROUTE}/${set.id}`, { items: [{ kind: 'group', id: groupId }] }))
      expect(await members(set.id)).toEqual(ids.slice(0, 2))
      expect(saved.candidates).toBe(2)
    })

    it('[CI] candidateItems is capped while candidates counts them all (PO 16)', async () => {
      const { subjectId } = await fresh('TI', 0, 40)
      await addPool(t.db, 'TI', TRACKING_A_CANDIDATE_CAP + 5, { pool: false })
      const set = await create(subjectId, 1)
      expect(set.candidateItems).toHaveLength(TRACKING_A_CANDIDATE_CAP)
      expect(set.candidates).toBe(TRACKING_A_CANDIDATE_CAP + 5)
    })
  })

  describe('one definition across the lane, the editor and the pupil (D-9, D-10)', () => {
    it('[CI] filled and attention equal the lane row; a member that left shows why, and the set falls short', async () => {
      const { subjectId, ids } = await fresh('PM', 3, 3)
      const set = await create(subjectId, 1)
      await admin.put(`${ROUTE}/${set.id}`, { items: qs(ids) })
      await q(`update question_versions set status = 'archived' where question_id = $1`, [ids[1]])
      const read = parse(await admin.get(`${ROUTE}/${set.id}`))
      expect(read).toMatchObject({ filled: 2, attention: ['Hanya 2 daripada 3 soalan'] })
      expect(read.items[1]?.members[0]).toMatchObject({ id: ids[1], servable: false, statusWord: 'diarkib' })
      const lane = await admin.get(`/api/admin/servability/lanes/tracking-a?subjectId=${subjectId}`)
      const row = (lane.body as { data: { id: string; attention: string[]; meta: string }[] }).data.find((r) => r.id === set.id)
      expect(row?.attention).toEqual(read.attention)
      expect(row?.meta).toBe(`#${set.id} · ramalan · 2 soalan`)
      // The pupil counts it the same way: 2 of 3 is not complete, so it is not listed.
      expect((parseData(await student.get('/api/spm/tracking-a/PM'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject).sets).toEqual([])
      expect(COPY.notServed).toBe('Tidak disajikan kepada pelajar')
    })
  })

  describe('FR-MUR-13-18, D-14: the pupil list', () => {
    it('[CI] complete sets of every year, year descending then set number; an incomplete one is not listed', async () => {
      const { subjectId, ids } = await fresh('PSV', 6, 2)
      const save = async (setNo: number, year: number, members: string[]) => {
        const set = await create(subjectId, setNo, year)
        await admin.put(`${ROUTE}/${set.id}`, { items: qs(members) })
      }
      await save(2, 2026, ids.slice(0, 2))
      await save(1, 2026, ids.slice(2, 4))
      await save(1, 2027, ids.slice(0, 2))
      await save(9, 2025, ids.slice(0, 2))
      await save(3, 2026, ids.slice(4, 5)) // one of two
      const s = parseData(await student.get('/api/spm/tracking-a/PSV'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
      expect(s.sets.map((x) => [x.year, x.setNo])).toEqual([[2027, 1], [2026, 1], [2026, 2], [2025, 9]])
    })
  })

  describe('DM-24 data', () => {
    it('[CI] seeded rows carry the subject and year of their set', async () => {
      const off = await q<{ n: string }>(`select count(*)::text n from spm_tracking_set_questions q join spm_tracking_sets s on s.id = q.set_id where q.subject_id is distinct from s.subject_id or q.year is distinct from s.year`)
      expect(off[0]?.n).toBe('0')
    })

    it('[CI] the report lists a sibling duplicate with the set to keep and the sets to clear (D-6a)', async () => {
      const report = readFileSync(resolve(__dirname, '../../scripts/uat-ops/tracking-sibling-duplicates.sql'), 'utf8')
      const select = /^SELECT[\s\S]*?;/m.exec(report)?.[0] as string
      const { subjectId, ids } = await fresh('BA', 1, 5)
      await addSet(t.db, 'BA', 1, ids)
      const two = (await q<{ id: string }>(`insert into spm_tracking_sets (subject_id, year, set_no) values ($1, 2026, 2) returning id::text id`, [subjectId]))[0]?.id
      // A row from before the migration: no subject or year, so the index does not see it. The report reads the parent set.
      await q(`insert into spm_tracking_set_questions (set_id, question_id, position) values ($1, $2, 1)`, [two, ids[0]])
      const rows = await q<{ question_id: string; keep_in_set_no: number; remove_from_set_nos: number[] }>(select)
      const row = rows.find((r) => String(r.question_id) === ids[0])
      expect(row).toMatchObject({ keep_in_set_no: 1, remove_from_set_nos: [2] })
      await q(`delete from spm_tracking_sets where id = $1`, [two])
    })
  })
})
