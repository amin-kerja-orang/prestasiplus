import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BattleInvitationsResponseSchema, BattleInviteAcceptResponseSchema, BattleRawErrorSchema, BattleSearchResponseSchema, BattleSuccessSchema } from '@pp/contract'

import { addMcqs, bootBattleApp, client, parse, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

const NOT_FOUND = { error: 'Cabaran tidak dijumpai.' }

describe('search and invitations (M16-07 to M16-11)', () => {
  let t: BattleTestApp
  let s: Subjects
  let a: Client
  let b: Client
  let c: Client
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ question_type: 'biasa', subject_id: s.math, receiver_id: b.id, ...over })

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 12)
    await addMcqs(t, s.math, s.t5, 12)
    await addMcqs(t, s.sci, s.t4, 3)
    await addMcqs(t, s.bm, s.t4, 10)
    ;[a, b, c] = [await client(t, STUDENT_G10), await client(t, STUDENT_G10_B), await client(t, STUDENT_G11)]
  }, 180_000)
  afterAll(async () => t.close())

  describe('search-opponent (AC 8)', () => {
    it('fewer than 2 trimmed characters, a repeated key, a very long text and a wildcard answer an empty list', async () => {
      for (const q of ['', ' ', ' a ', 'a', '%%', '_%', 'x'.repeat(101), 'zzzzzz']) {
        const res = await a.get(`/battle/search-opponent?q=${encodeURIComponent(q)}`)
        expect(res.status).toBe(200)
        expect(parse(BattleSearchResponseSchema, res)).toEqual({ users: [] })
      }
      expect((await a.get('/battle/search-opponent')).body).toEqual({ users: [] })
      expect((await a.get('/battle/search-opponent?q=Murid&q=Demo')).body.users.length).toBe(0)
    })

    it('students whose name contains the text, any case, caller excluded, at most 10, display fields only; names masked outside the viewer scope', async () => {
      const res = await a.get('/battle/search-opponent?q=MURID%20demo')
      expect(res.status).toBe(200)
      const { users } = parse(BattleSearchResponseSchema, res)
      expect(users.length).toBeGreaterThan(1)
      expect(users.length).toBeLessThanOrEqual(10)
      expect(users.map((u) => u.id)).not.toContain(a.id)
      for (const u of users) {
        expect(Object.keys(u).sort()).toEqual(['avatar', 'id', 'name', 'school'])
        // Children's names rule (issue #76): a student sees the first given name of other pupils (ruling 7 on #497); no school; the id stays (invite handle).
        expect(u.name).toBe('Murid')
        expect(u.school).toBe('')
        expect(u.avatar).toBeNull()
      }
      const roles = await rows<{ role: string }>(`select distinct role from user_roles where user_id = any($1::bigint[])`, [users.map((u) => u.id)])
      expect(roles.map((r) => r.role)).toEqual(['student'])
      expect(JSON.stringify(res.body)).not.toMatch(/@|ic_|phone|email/i)
    })

    it('the school admin of the pupil school sees full names, sorted by name then id; an admin with no school finds nobody (FR-GM-01.6)', async () => {
      const who = await client(t, 'adminsekolah@demo.test')
      const { users } = parse(BattleSearchResponseSchema, await who.get('/battle/search-opponent?q=MURID%20demo'))
      expect(users.length).toBeGreaterThan(1)
      const names = users.map((u) => u.name)
      expect(names).toEqual([...names].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)))
      for (const u of users) expect(u.name.toLowerCase()).toContain('murid demo')
      // the admin of the whole system has no school: the search is the caller's own school, so it is empty
      const admin = await client(t, 'admin@demo.test')
      expect((await admin.get('/battle/search-opponent?q=MURID%20demo')).body).toEqual({ users: [] })
    })

    describe('own school only (FR-GM-01.6, AC-GM-01.6)', () => {
      const OTHER = 'murid.demo001.04@example.test' // Tingkatan 4, school 1 until the fixture moves him
      let otherId: string
      let otherSchool: string
      let sameId: string
      beforeAll(async () => {
        otherSchool = (await rows<{ id: string }>(`insert into schools (name, code, type, state) values ('SMK Ujian Sekolah Lain', 'UJISEKOLAHLAIN', 'SMK', 'Selangor') returning id::text`))[0]?.id as string
        otherId = (await rows<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [OTHER]))[0]?.id as string
        sameId = (await rows<{ id: string }>(`select id::text from users where lower(email) = lower('murid.demo001.01@example.test')`))[0]?.id as string
        await rows(`update users set school_id = $1 where id = $2`, [otherSchool, otherId])
      })
      afterAll(async () => rows(`update users set school_id = 1 where id = $1`, [otherId]))

      it('a pupil of another school is never found, whatever the name; the pupil of his own school is', async () => {
        const found = ((await a.get('/battle/search-opponent?q=Murid%20Contoh')).body.users as { id: string }[]).map((u) => u.id)
        expect(found).toContain(sameId)
        expect(found).not.toContain(otherId)
        const schools = await rows<{ school_id: string }>(`select distinct school_id::text from users where id = any($1::bigint[])`, [found])
        expect(schools).toEqual([{ school_id: '1' }])
        // the same pupil is found again as soon as he is in the school of the caller
        await rows(`update users set school_id = 1 where id = $1`, [otherId])
        expect(((await a.get('/battle/search-opponent?q=Contoh%20Hitam')).body.users as { id: string }[]).map((u) => u.id)).toContain(otherId)
        await rows(`update users set school_id = $2 where id = $1`, [otherId, otherSchool])
        expect((await a.get('/battle/search-opponent?q=Contoh%20Hitam')).body).toEqual({ users: [] })
      })

      it('invite: a receiver of another school answers "Penerima tidak sah." and stores nothing; one of the same school is stored', async () => {
        await rows(`delete from battle_invitations`)
        const res = await a.post('/battle/invite', body({ receiver_id: otherId }))
        expect(res.status).toBe(422)
        expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Penerima tidak sah.' })
        expect((await rows(`select 1 from battle_invitations`)).length).toBe(0)
        expect((await a.post('/battle/invite', body({ receiver_id: sameId }))).status).toBe(200)
        expect((await rows(`select 1 from battle_invitations where receiver_id = $1`, [sameId])).length).toBe(1)
        await rows(`delete from battle_invitations`)
      })
    })

    it('never lists staff, inactive or suspended accounts', async () => {
      const { users } = (await a.get('/battle/search-opponent?q=Demo')).body as { users: { name: string }[] }
      expect(users.some((u) => /guru|admin|digantung|tidak aktif/i.test(u.name))).toBe(false)
      const staff = await rows<{ id: string }>(`select u.id::text from users u where not exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student')`)
      const found = (await a.get('/battle/search-opponent?q=Demo')).body.users.map((u: { id: string }) => u.id)
      for (const row of staff) expect(found).not.toContain(row.id)
    })
  })

  describe('invite (AC 8)', () => {
    it('stores a pending invitation and answers {success: true}', async () => {
      const res = await a.post('/battle/invite', body({ points: 99999, status: 'accepted' }))
      expect(res.status).toBe(200)
      expect(parse(BattleSuccessSchema, res)).toEqual({ success: true })
      const [inv] = await rows<{ sender_id: string; receiver_id: string; status: string; is_test: boolean }>(`select sender_id::text, receiver_id::text, status, is_test from battle_invitations order by created_at desc, id limit 1`)
      expect(inv).toEqual({ sender_id: a.id, receiver_id: b.id, status: 'pending', is_test: false })
    })

    it('a second invitation to the same receiver while one is pending answers success and creates no new row', async () => {
      await rows(`delete from battle_invitations`)
      expect((await a.post('/battle/invite', body())).status).toBe(200)
      const again = await a.post('/battle/invite', body())
      expect(again.status).toBe(200)
      expect(parse(BattleSuccessSchema, again)).toEqual({ success: true })
      expect((await rows(`select 1 from battle_invitations`)).length).toBe(1)
      // another receiver is a different invitation
      expect((await a.post('/battle/invite', body({ receiver_id: c.id }))).status).toBe(200)
      expect((await rows(`select 1 from battle_invitations`)).length).toBe(2)
      await rows(`delete from battle_invitations`)
    })

    it.each([
      ['receiver is the sender', () => body({ receiver_id: a.id })],
      ['unknown receiver', () => body({ receiver_id: '9999999' })],
      ['malformed receiver', () => body({ receiver_id: 'abc' })],
      ['numeric receiver', () => body({ receiver_id: 5 })],
      ['no receiver', () => ({ question_type: 'biasa', subject_id: s.math })],
    ])('422 "Penerima tidak sah." when %s', async (_n, make) => {
      const res = await a.post('/battle/invite', make())
      expect(res.status).toBe(422)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Penerima tidak sah.' })
    })

    it('a teacher or an inactive student is not a valid receiver', async () => {
      for (const email of ['guru@demo.test', 'tidakaktif@demo.test', 'digantung@demo.test']) {
        const id = (await rows<{ id: string }>(`select id::text from users where email = $1`, [email]))[0]?.id
        const res = await a.post('/battle/invite', body({ receiver_id: id }))
        expect(res.status, email).toBe(422)
        expect(res.body).toEqual({ error: 'Penerima tidak sah.' })
      }
    })

    it('type, subject, domain, level and pool messages', async () => {
      const phy = (await rows<{ id: string }>(`select id::text from subjects where code = 'PHY'`))[0]?.id as string
      const cases: [Record<string, unknown>, string][] = [
        [{ question_type: 'x' }, 'Jenis soalan tidak sah.'],
        [{ subject_id: '987654' }, 'Subjek tidak sah.'],
        [{ question_type: 'spm', subject_id: phy }, 'Subjek tidak sah.'],
        [{ subject_id: s.sci }, 'Soalan tidak mencukupi.'],
        [{ question_type: 'pksk', subject_id: undefined, pksk_domain_id: '999999', pksk_target_level: 'T1' }, 'Domain PKSK tidak sah.'],
        [{ question_type: 'spm', subject_id: s.sci }, 'Soalan tidak mencukupi.'], // R1-B06: math has T4 questions, so it has an SPM pool; science (3) is too small
      ]
      for (const [over, error] of cases) {
        const res = await a.post('/battle/invite', body(over))
        expect(res.status, error).toBe(422)
        expect(parse(BattleRawErrorSchema, res)).toEqual({ error })
      }
    })

    it('SPM: 403 with the text below Tingkatan 4, accepted from grade 10 with a pool', async () => {
      const lowGrade = (await rows<{ email: string }>(`select email from users where grade = 9 and email is not null order by id limit 1`))[0]?.email as string
      const low = await client(t, lowGrade)
      const res = await low.post('/battle/invite', body({ question_type: 'spm', subject_id: s.bm }))
      expect(res.status).toBe(403)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Khas untuk pelajar Tingkatan 4 & 5 sahaja.' })
      expect((await a.post('/battle/invite', body({ question_type: 'spm', subject_id: s.bm }))).status).toBe(200)
    })
  })

  describe('list, accept, decline (AC 8, 15, 16)', () => {
    let uuid: string
    const newInvite = async (from: Client, to: Client): Promise<string> => {
      expect((await from.post('/battle/invite', body({ receiver_id: to.id }))).status).toBe(200)
      const list = parse(BattleInvitationsResponseSchema, await to.get('/battle/invitations'))
      return list.invitations[0]?.uuid as string
    }

    it('lists the receiver\'s pending invitations newest first with the sender first given name only (FR-GM-00.8)', async () => {
      await rows(`delete from battle_invitations`)
      const first = await newInvite(a, b)
      t.clock.advance(60_000)
      const second = await newInvite(c, b)
      const list = parse(BattleInvitationsResponseSchema, await b.get('/battle/invitations'))
      expect(list.invitations.map((i) => i.uuid)).toEqual([second, first])
      expect(list.invitations[0]).toEqual({ uuid: second, sender_name: 'Murid', sender_school: '' })
      // the sender and a bystander see nothing
      expect((await a.get('/battle/invitations')).body).toEqual({ invitations: [] })
      uuid = first
    })

    it('an invitation is open for 24 h: older ones are not listed and cannot be accepted', async () => {
      await rows(`delete from battle_invitations`)
      const id = await newInvite(a, b)
      // the session clock stays put: the invitation is aged in the table instead
      const age = async (ms: number) => rows(`update battle_invitations set created_at = $1::timestamptz - ($2 || ' milliseconds')::interval where id = $3`, [t.clock.now().toISOString(), String(ms), id])
      await age(24 * 3_600_000)
      expect((await b.get('/battle/invitations')).body.invitations.length).toBe(1)
      await age(24 * 3_600_000 + 1)
      expect((await b.get('/battle/invitations')).body).toEqual({ invitations: [] })
      const res = await b.post(`/battle/invite/${id}/accept`)
      expect(res.status).toBe(404)
      // FR-GM-01 (48): the receiver of an invitation that ran out is told so; a stranger still gets the plain not-found
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Cabaran tamat tempoh.' })
      expect(parse(BattleRawErrorSchema, await c.post(`/battle/invite/${id}/accept`))).toEqual(NOT_FOUND)
      expect((await rows(`select 1 from battles where mode = 'challenge'`)).length).toBe(0)
    })

    it('battle_invitation_hours sets the window (48 h and 1 h), and an expired invitation tells the receiver "Cabaran tamat tempoh."', async () => {
      const set = (hours: number) => rows(`update gamification_settings set value = $1 where key = 'battle_invitation_hours'`, [hours])
      const age = (id: string, ms: number) => rows(`update battle_invitations set created_at = $1::timestamptz - ($2 || ' milliseconds')::interval where id = $3`, [t.clock.now().toISOString(), String(ms), id])
      try {
        await rows(`delete from battle_invitations`)
        const id = await newInvite(a, b)
        await set(48)
        await age(id, 24 * 3_600_000 + 1) // past the old 24 h, inside 48 h
        expect((await b.get('/battle/invitations')).body.invitations.length).toBe(1)
        // a second invite to the same receiver is still the same open one
        expect((await a.post('/battle/invite', body())).status).toBe(200)
        expect((await rows(`select 1 from battle_invitations`)).length).toBe(1)
        await age(id, 48 * 3_600_000 + 1)
        expect((await b.get('/battle/invitations')).body).toEqual({ invitations: [] })
        expect(parse(BattleRawErrorSchema, await b.post(`/battle/invite/${id}/accept`))).toEqual({ error: 'Cabaran tamat tempoh.' })
        // the window is read on each call: 1 h
        await set(1)
        await rows(`delete from battle_invitations`)
        const short = await newInvite(a, b)
        await age(short, 3_600_000)
        expect((await b.get('/battle/invitations')).body.invitations.length).toBe(1)
        await age(short, 3_600_000 + 1)
        expect((await b.get('/battle/invitations')).body).toEqual({ invitations: [] })
        const res = await b.post(`/battle/invite/${short}/accept`)
        expect(res.status).toBe(404)
        expect(res.body).toEqual({ error: 'Cabaran tamat tempoh.' })
        // an expired invitation can be sent again: a new row
        expect((await a.post('/battle/invite', body())).status).toBe(200)
        expect((await rows(`select 1 from battle_invitations`)).length).toBe(2)
      } finally {
        await set(24)
        await rows(`delete from battle_invitations`)
      }
    })

    it('question_count of the invitation reaches the battle and its draw (5 and 10; 15 is more than the 12 questions of the pool)', async () => {
      await rows(`delete from battle_invitations`)
      for (const n of [5, 10, 15]) {
        if (n === 15) {
          // 12 questions of Tingkatan 4 maths: 15 is refused when sent
          const res = await a.post('/battle/invite', body({ question_count: n }))
          expect(res.status).toBe(422)
          expect(res.body).toEqual({ error: 'Soalan tidak mencukupi.' })
          continue
        }
        expect((await a.post('/battle/invite', body({ question_count: n }))).status).toBe(200)
        const [inv] = await rows<{ id: string; question_count: number }>(`select id::text, question_count from battle_invitations where status = 'pending'`)
        expect(inv?.question_count).toBe(n)
        const accepted = await b.post(`/battle/invite/${inv?.id}/accept`)
        expect(accepted.status).toBe(200)
        const uuid = accepted.body.battle_uuid as string
        expect((await rows<{ question_count: number }>(`select question_count from battles where id = $1`, [uuid]))[0]?.question_count).toBe(n)
        expect((await rows<{ n: string }>(`select count(*)::text n from battle_questions where battle_id = $1`, [uuid]))[0]?.n).toBe(String(n))
      }
      // absent: 10
      expect((await a.post('/battle/invite', body())).status).toBe(200)
      const [last] = await rows<{ question_count: number }>(`select question_count from battle_invitations where status = 'pending'`)
      expect(last?.question_count).toBe(10)
      await rows(`delete from battle_invitations`)
    })

    it.each([[7], [0], ['10'], [null], [25]])('an invalid question_count (%j) answers 422 "Nilai di luar julat." and stores nothing', async (bad) => {
      await rows(`delete from battle_invitations`)
      const res = await a.post('/battle/invite', body({ question_count: bad }))
      expect(res.status).toBe(422)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Nilai di luar julat.' })
      expect((await rows(`select 1 from battle_invitations`)).length).toBe(0)
    })

    it('accept: receiver only; the sender is side A; one battle; a second accept is not found', async () => {
      uuid = await newInvite(a, b)
      expect((await a.post(`/battle/invite/${uuid}/accept`)).body).toEqual(NOT_FOUND)
      expect((await c.post(`/battle/invite/${uuid}/accept`)).body).toEqual(NOT_FOUND)
      const res = await b.post(`/battle/invite/${uuid}/accept`)
      expect(res.status).toBe(200)
      const { battle_uuid } = parse(BattleInviteAcceptResponseSchema, res)
      const [battle] = await rows<{ mode: string; status: string; is_test: boolean }>(`select mode, status, is_test from battles where id = $1`, [battle_uuid])
      expect(battle).toEqual({ mode: 'challenge', status: 'active', is_test: false })
      const parts = await rows<{ side: string; user_id: string; is_bot: boolean }>(`select side, user_id::text, is_bot from battle_participants where battle_id = $1 order by side`, [battle_uuid])
      expect(parts).toEqual([{ side: 'A', user_id: a.id, is_bot: false }, { side: 'B', user_id: b.id, is_bot: false }])
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_questions where battle_id = $1`, [battle_uuid]))[0]?.n).toBe('10')
      const again = await b.post(`/battle/invite/${uuid}/accept`)
      expect(again.status).toBe(404)
      expect(again.body).toEqual(NOT_FOUND)
      expect((await b.get('/battle/invitations')).body).toEqual({ invitations: [] })
    })

    it('two concurrent accepts create one battle', async () => {
      const id = await newInvite(a, b)
      const before = Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)
      const [r1, r2] = await Promise.all([b.post(`/battle/invite/${id}/accept`), b.post(`/battle/invite/${id}/accept`)])
      expect([r1.status, r2.status].sort()).toEqual([200, 404])
      expect(Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)).toBe(before + 1)
    })

    it('decline: receiver only; afterwards accept and decline are not found', async () => {
      const id = await newInvite(a, b)
      const foreign = await c.post(`/battle/invite/${id}/decline`)
      expect(foreign.status).toBe(404)
      expect(parse(BattleRawErrorSchema, foreign)).toEqual(NOT_FOUND)
      expect((await a.post(`/battle/invite/${id}/decline`)).body).toEqual(NOT_FOUND)
      expect(parse(BattleSuccessSchema, await b.post(`/battle/invite/${id}/decline`))).toEqual({ success: true })
      expect((await b.post(`/battle/invite/${id}/accept`)).body).toEqual(NOT_FOUND)
      expect((await b.post(`/battle/invite/${id}/decline`)).body).toEqual(NOT_FOUND)
      const [row] = await rows<{ status: string }>(`select status from battle_invitations where id = $1`, [id])
      expect(row?.status).toBe('declined')
    })

    it('unknown and malformed uuids are the same not-found answer (never a server error)', async () => {
      for (const id of ['00000000-0000-4000-8000-000000000000', 'abc', "1' or '1'='1", '123']) {
        for (const action of ['accept', 'decline']) {
          const res = await b.post(`/battle/invite/${encodeURIComponent(id)}/${action}`)
          expect(res.status, `${action} ${id}`).toBe(404)
          expect(res.body).toEqual(NOT_FOUND)
        }
      }
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('a test invitation is stored with is_test and is invisible to the real receiver', async () => {
      // FR-GM-01.6: Mod Pelajar of a school admin acts inside that school; an admin with no school reaches nobody
      const noSchool = await client(t, 'admin@demo.test', { modPelajar: true })
      expect((await noSchool.post('/battle/invite', body({ receiver_id: b.id }))).status).toBe(422)
      const admin = await client(t, 'adminsekolah@demo.test', { modPelajar: true })
      await rows(`delete from battle_invitations`)
      expect((await admin.post('/battle/invite', body({ receiver_id: b.id }))).status).toBe(200)
      const [inv] = await rows<{ id: string; is_test: boolean }>(`select id::text, is_test from battle_invitations`)
      expect(inv?.is_test).toBe(true)
      expect((await b.get('/battle/invitations')).body).toEqual({ invitations: [] })
      expect((await b.post(`/battle/invite/${inv?.id}/accept`)).body).toEqual(NOT_FOUND)
      // staff never show up in the search of a pupil
      const { users } = (await a.get('/battle/search-opponent?q=Admin')).body
      expect(users).toEqual([])
    })
  })
})
