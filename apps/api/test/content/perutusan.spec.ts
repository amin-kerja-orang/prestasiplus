import { PerutusanComposeContextSchema, PerutusanDetailSchema, PerutusanPublicSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { asBool, excerptOf, initialsOf } from '../../src/modules/content/perutusan/perutusan.service'
import { parseScheduledAt } from '../../src/modules/content/perutusan/scheduled-at'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT,
  TEACHER,
  apiOf,
  bootVp,
  expectError,
  fieldsOf,
  insertPost,
  login,
  moveUser,
  postPerutusan,
  userIdOf,
  type Api,
  type LoggedIn,
  type VpApp,
} from './vp-helpers'

const SCHOOL_ADMIN_2 = 'guruadmin@demo.test'
const STUDENT_2 = 'pelajar2@demo.test'
const text = (over: Record<string, string> = {}) => ({ title: 'Perutusan contoh', body: '<p>Salam sejahtera.</p>', status: 'published', ...over })

describe('perutusan: feed, visibility, reads, reactions, comments, public page (AC 8)', () => {
  let t: VpApp
  let admin: LoggedIn
  let sa1: LoggedIn
  let sa2: LoggedIn
  let teacher: LoggedIn
  let st1: LoggedIn
  let st2: LoggedIn
  let a: Record<'admin' | 'sa1' | 'sa2' | 'teacher' | 'st1' | 'st2', Api>
  const id = {} as Record<'nat1' | 'nat2' | 's1' | 's2' | 'draft' | 'future' | 'due' | 'pub', string>
  const feedIds = async (who: LoggedIn) => ((await who.agent.get('/api/perutusan')).body.data as { id: string }[]).map((p) => p.id)

  beforeAll(async () => {
    t = await bootVp()
    await moveUser(t.db, SCHOOL_ADMIN_2, 'DEMO002')
    await moveUser(t.db, STUDENT_2, 'DEMO002')
    admin = await login(t, ADMIN)
    sa1 = await login(t, SCHOOL_ADMIN)
    sa2 = await login(t, SCHOOL_ADMIN_2)
    teacher = await login(t, TEACHER)
    st1 = await login(t, STUDENT)
    st2 = await login(t, STUDENT_2)
    a = { admin: apiOf(admin), sa1: apiOf(sa1), sa2: apiOf(sa2), teacher: apiOf(teacher), st1: apiOf(st1), st2: apiOf(st2) }

    id.nat1 = await insertPost(t.db, { title: 'Nasional satu', author: ADMIN, createdAt: '2026-10-01T09:00:00+08:00' })
    id.nat2 = await insertPost(t.db, { title: 'Nasional disemat', author: ADMIN, isPinned: true, createdAt: '2026-09-01T09:00:00+08:00' })
    id.s1 = await insertPost(t.db, { title: 'Sekolah satu', author: SCHOOL_ADMIN, school: 'DEMO001', createdAt: '2026-10-05T09:00:00+08:00' })
    id.s2 = await insertPost(t.db, { title: 'Sekolah dua', author: SCHOOL_ADMIN_2, school: 'DEMO002', createdAt: '2026-10-06T09:00:00+08:00' })
    id.draft = await insertPost(t.db, { title: 'Draf sekolah satu', author: SCHOOL_ADMIN, school: 'DEMO001', status: 'draft', createdAt: '2026-10-03T09:00:00+08:00' })
    id.future = await insertPost(t.db, { title: 'Dijadualkan kelak', author: ADMIN, status: 'scheduled', scheduledAt: '2026-10-19T10:00:00+08:00', createdAt: '2026-10-02T09:00:00+08:00' })
    id.due = await insertPost(t.db, { title: 'Dijadualkan sudah tiba', author: ADMIN, status: 'scheduled', scheduledAt: '2026-10-18T08:00:00+08:00', createdAt: '2026-10-02T09:00:00+08:00' })
    id.pub = await insertPost(t.db, { title: 'Awam', author: ADMIN, isPublic: true, createdAt: '2026-10-07T09:00:00+08:00', body: '<p>Isi awam</p>', youtubeUrl: 'https://youtu.be/abcdefghijk' })
  })
  afterAll(async () => {
    await t.close()
  })

  describe('feed and visibility', () => {
    it('a student sees national posts and the own school, pinned first, then by effective time (a scheduled post counts from its time)', async () => {
      expect(await feedIds(st1)).toEqual([id.nat2, id.due, id.pub, id.s1, id.nat1])
      expect(await feedIds(st2)).toEqual([id.nat2, id.due, id.pub, id.s2, id.nat1])
    })

    it('an admin sees every due post of every school; drafts and not-yet-due posts are in nobody feed, not even the author', async () => {
      expect(await feedIds(admin)).toEqual([id.nat2, id.due, id.pub, id.s2, id.s1, id.nat1])
      expect(await feedIds(sa1)).not.toContain(id.draft)
      expect(await feedIds(admin)).not.toContain(id.future)
    })

    it('the feed answer is a no-store unpaged list in the contract shape', async () => {
      const res = await st1.agent.get('/api/perutusan')
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.meta).toMatchObject({ page: 1, totalPages: 1, totalItems: 5, from: 1, to: 5 })
      const card = res.body.data[0]
      expect(card).toMatchObject({ id: id.nat2, isPinned: true, hasVideo: false, scopeLabel: 'Seluruh Malaysia (Kebangsaan)', author: { name: 'Admin Pusat Demo', initials: 'AP', roleLabel: 'Admin' } })
      expect(card.createdAt).toMatch(/\+08:00$/)
      const school = res.body.data.find((p: { id: string }) => p.id === id.s1)
      expect(school.scopeLabel).toBe('SMK Demo Satu')
      expect(school.author.roleLabel).toBe('Pengetua')
    })

    it('every route needs a session: 401 for a guest', async () => {
      for (const url of ['/api/perutusan', '/api/perutusan/mine', '/api/perutusan/compose-context', `/api/perutusan/${id.nat1}`]) {
        expectError(await t.http().get(url), 'UNAUTHORIZED')
      }
      for (const url of [`/api/perutusan/${id.nat1}/reactions`, `/api/perutusan/${id.nat1}/comments`, '/api/perutusan']) {
        expectError(await t.http().post(url).send({}), 'UNAUTHORIZED')
      }
    })

    it('another school post, a draft of someone else and a post not yet due are 404 (never 403) on the page, reactions and comments', async () => {
      const cases: [LoggedIn, Api, string][] = [
        [st1, a.st1, id.s2],
        [st2, a.st2, id.s1],
        [sa2, a.sa2, id.s1],
        [st1, a.st1, id.draft],
        [sa2, a.sa2, id.draft],
        [teacher, a.teacher, id.future],
        [st1, a.st1, id.future],
      ]
      for (const [who, api, post] of cases) {
        expectError(await who.agent.get(`/api/perutusan/${post}`), 'NOT_FOUND', 'Not Found.')
        expectError(await api.post(`/perutusan/${post}/reactions`, { type: 'like' }), 'NOT_FOUND')
        expectError(await api.post(`/perutusan/${post}/comments`, { body: 'Hai' }), 'NOT_FOUND')
      }
      expect(await t.db.query(`select 1 from perutusan_reactions`)).toHaveLength(0)
      expect(await t.db.query(`select 1 from perutusan_comments`)).toHaveLength(0)
    })

    it('the author and an admin may open the own draft and a post not yet due; they cannot react to or comment on a draft', async () => {
      for (const [who, post] of [[sa1, id.draft], [admin, id.draft], [admin, id.future]] as const) {
        const res = await who.agent.get(`/api/perutusan/${post}`)
        expect(res.status).toBe(200)
        expect(res.body.data.canWrite).toBe(true)
      }
      expectError(await a.sa1.post(`/perutusan/${id.draft}/reactions`, { type: 'like' }), 'NOT_FOUND')
    })

    it('a scheduled post appears for readers only once its time has come', async () => {
      expect(await feedIds(st1)).not.toContain(id.future)
      t.clock.advance(70 * 60 * 1000)
      try {
        expect(await feedIds(st1)).toContain(id.future)
        expect((await st1.agent.get(`/api/perutusan/${id.future}`)).status).toBe(200)
      } finally {
        t.clock.set('2026-10-19T09:00:00+08:00')
      }
      expect(await feedIds(st1)).not.toContain(id.future)
    })

    it('"mine" lists the own posts of every status, pinned first then newest', async () => {
      const res = await sa1.agent.get('/api/perutusan/mine')
      expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([id.s1, id.draft])
      expect(res.body.data[1]).toMatchObject({ status: 'draft', statusLabel: 'Draf', title: 'Draf sekolah satu' })
      expect((await st1.agent.get('/api/perutusan/mine')).body.data).toEqual([])
    })

    it('compose-context: admin national, school admin the school name, everyone else cannot write', async () => {
      const get = async (who: LoggedIn) => PerutusanComposeContextSchema.parse((await who.agent.get('/api/perutusan/compose-context')).body.data)
      expect(await get(admin)).toEqual({ scope: 'national', scopeLabel: 'Seluruh Malaysia (Kebangsaan)', canWrite: true })
      expect(await get(sa1)).toEqual({ scope: 'school', scopeLabel: 'SMK Demo Satu', canWrite: true })
      expect(await get(teacher)).toEqual({ scope: null, scopeLabel: '', canWrite: false })
      expect(await get(st1)).toEqual({ scope: null, scopeLabel: '', canWrite: false })
    })

    it('an invalid id is 404', async () => {
      for (const bad of ['abc', '0', '-1', '99999999999999999999999', '1;drop']) {
        expectError(await st1.agent.get(`/api/perutusan/${bad}`), 'NOT_FOUND')
      }
    })
  })

  describe('reads (BR-M09-07): once per user, none for the author and the admin', () => {
    it('counts a reader once, including this open, and not the admin or the author', async () => {
      const first = await st1.agent.get(`/api/perutusan/${id.nat1}`)
      PerutusanDetailSchema.parse(first.body.data)
      expect(first.body.data.reads).toBe(1)
      expect((await st1.agent.get(`/api/perutusan/${id.nat1}`)).body.data.reads).toBe(1)
      expect((await st2.agent.get(`/api/perutusan/${id.nat1}`)).body.data.reads).toBe(2)
      expect((await admin.agent.get(`/api/perutusan/${id.nat1}`)).body.data.reads).toBe(2)
      const rows = await t.db.query(`select user_id from perutusan_reads where perutusan_id = $1`, [id.nat1])
      expect(rows).toHaveLength(2)
      expect((await sa1.agent.get(`/api/perutusan/${id.s1}`)).body.data.reads).toBe(0)
      expect(await t.db.query(`select 1 from perutusan_reads where perutusan_id = $1`, [id.s1])).toHaveLength(0)
    })

    it('two simultaneous first opens record one read', async () => {
      const [x, y] = await Promise.all([teacher.agent.get(`/api/perutusan/${id.pub}`), teacher.agent.get(`/api/perutusan/${id.pub}`)])
      expect([x.status, y.status]).toEqual([200, 200])
      expect(await t.db.query(`select 1 from perutusan_reads where perutusan_id = $1`, [id.pub])).toHaveLength(1)
    })

    it('the feed card carries the computed read count', async () => {
      const card = (await st1.agent.get('/api/perutusan')).body.data.find((p: { id: string }) => p.id === id.nat1)
      expect(card.reads).toBe(2)
    })
  })

  describe('reactions (BR-M09-25)', () => {
    it('toggles per kind; myReactions is a list in the order given; the counts come from the table', async () => {
      const like = await a.st1.post(`/perutusan/${id.nat2}/reactions`, { type: 'like' })
      expect(like.status).toBe(200)
      expect(like.body.data).toEqual({ reactions: { like: 1, love: 0, thanks: 0 }, myReactions: ['like'] })
      const love = await a.st1.post(`/perutusan/${id.nat2}/reactions`, { type: 'love' })
      expect(love.body.data).toEqual({ reactions: { like: 1, love: 1, thanks: 0 }, myReactions: ['like', 'love'] })
      const off = await a.st1.post(`/perutusan/${id.nat2}/reactions`, { type: 'like' })
      expect(off.body.data).toEqual({ reactions: { like: 0, love: 1, thanks: 0 }, myReactions: ['love'] })
      const other = await a.st2.post(`/perutusan/${id.nat2}/reactions`, { type: 'like' })
      expect(other.body.data.reactions).toEqual({ like: 1, love: 1, thanks: 0 })
      expect(other.body.data.myReactions).toEqual(['like'])
      // A tie goes to like, then love, then thanks.
      const card = (await st1.agent.get('/api/perutusan')).body.data.find((p: { id: string }) => p.id === id.nat2)
      expect(card.topReaction).toEqual({ type: 'like', emoji: '👍', count: 1 })
      const detail = PerutusanDetailSchema.parse((await st1.agent.get(`/api/perutusan/${id.nat2}`)).body.data)
      expect(detail.myReactions).toEqual(['love'])
      expect(detail.reactions).toEqual({ like: 1, love: 1, thanks: 0 })
    })

    it('a double click leaves the table consistent (unique per post, user and kind)', async () => {
      const rs = await Promise.all([a.teacher.post(`/perutusan/${id.nat1}/reactions`, { type: 'thanks' }), a.teacher.post(`/perutusan/${id.nat1}/reactions`, { type: 'thanks' })])
      expect(rs.map((r) => r.status)).toEqual([200, 200])
      const rows = await t.db.query(`select 1 from perutusan_reactions where perutusan_id = $1 and kind = 'thanks'`, [id.nat1])
      expect(rows.length).toBeLessThanOrEqual(1)
    })

    it('an unknown type, a missing type and an unknown key are 422; the unique key refuses a duplicate', async () => {
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/reactions`, { type: 'angry' }))).toEqual({ type: 'Medan ini tidak sah.' })
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/reactions`, {}))).toEqual({ type: 'Medan ini diperlukan.' })
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/reactions`, { type: 'like', userId: '1' }))).toEqual({ userId: 'Medan ini tidak sah.' })
      const uid = await userIdOf(t.db, STUDENT)
      await expect(t.db.query(`insert into perutusan_reactions (perutusan_id, user_id, kind) values ($1, $2, 'like'), ($1, $2, 'like')`, [id.nat1, uid])).rejects.toThrow()
      await expect(t.db.query(`insert into perutusan_reactions (perutusan_id, user_id, kind) values ($1, $2, 'angry')`, [id.nat1, uid])).rejects.toThrow()
    })

    it('a reaction needs CSRF, and is audited', async () => {
      expectError(await st1.agent.post(`/api/perutusan/${id.nat1}/reactions`).send({ type: 'like' }), 'CSRF_INVALID')
      expect((await t.db.query(`select 1 from audit_events where action = 'content.perutusan.reacted'`)).length).toBeGreaterThan(0)
    })
  })

  describe('comments (BR-M09-26): stored pending', () => {
    it('stores a pending comment, answers 201 with the flash, and shows it nowhere', async () => {
      const res = await a.st1.post(`/perutusan/${id.nat1}/comments`, { body: '  Terima kasih cikgu!  ' })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ data: { id: expect.any(String), status: 'pending' }, status: 'Komen anda telah dihantar dan akan disemak.' })
      const [row] = await t.db.query<{ body: string; status: string; user_id: string }>(`select body, status, user_id::text from perutusan_comments where id = $1`, [res.body.data.id])
      expect(row).toEqual({ body: 'Terima kasih cikgu!', status: 'pending', user_id: await userIdOf(t.db, STUDENT) })
      const detail = (await st1.agent.get(`/api/perutusan/${id.nat1}`)).body.data
      expect(detail.commentCount).toBe(0)
      expect(JSON.stringify(detail)).not.toContain('Terima kasih cikgu')
      // Approved comments are the only ones counted.
      await t.db.query(`update perutusan_comments set status = 'approved' where id = $1`, [res.body.data.id])
      expect((await st1.agent.get(`/api/perutusan/${id.nat1}`)).body.data.commentCount).toBe(1)
    })

    it('1 to 1000 characters; a body or user id the client sends is never trusted', async () => {
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/comments`, {}))).toEqual({ body: 'Medan ini diperlukan.' })
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/comments`, { body: '   ' }))).toEqual({ body: 'Medan ini diperlukan.' })
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/comments`, { body: 'x'.repeat(1001) }))).toEqual({ body: 'Medan ini tidak sah.' })
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/comments`, { body: 'Hai', userId: '1', status: 'approved' }))).toEqual({ userId: 'Medan ini tidak sah.', status: 'Medan ini tidak sah.' })
      expect(fieldsOf(await a.st1.post(`/perutusan/${id.nat1}/comments`, { body: 42 }))).toEqual({ body: 'Medan ini tidak sah.' })
      expect((await a.st1.post(`/perutusan/${id.nat1}/comments`, { body: 'x'.repeat(1000) })).status).toBe(201)
    })

    it('a comment needs CSRF and is audited without its text', async () => {
      expectError(await st1.agent.post(`/api/perutusan/${id.nat1}/comments`).send({ body: 'Hai' }), 'CSRF_INVALID')
      const rows = await t.db.query<{ detail: unknown }>(`select detail from audit_events where action = 'content.perutusan.commented'`)
      expect(rows.length).toBeGreaterThan(0)
      expect(JSON.stringify(rows)).not.toContain('Terima kasih')
    })
  })

  describe('public page (#40)', () => {
    it('a guest reads a public, published post; no read is counted; the shape is the public one', async () => {
      const before = await t.db.query(`select 1 from perutusan_reads where perutusan_id = $1`, [id.pub])
      const res = await t.http().get(`/api/public/perutusan/${id.pub}`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const pub = PerutusanPublicSchema.parse(res.body.data)
      expect(pub).toMatchObject({ id: id.pub, title: 'Awam', body: '<p>Isi awam</p>', youtubeEmbedUrl: 'https://www.youtube.com/embed/abcdefghijk', scopeLabel: 'Seluruh Malaysia (Kebangsaan)' })
      expect(Object.keys(res.body.data).sort()).toEqual(['author', 'body', 'commentCount', 'createdAt', 'id', 'reactionTotal', 'reads', 'scopeLabel', 'title', 'youtubeEmbedUrl'])
      expect(await t.db.query(`select 1 from perutusan_reads where perutusan_id = $1`, [id.pub])).toHaveLength(before.length)
    })

    it('a non-public, draft, not-yet-due or unknown post is 404 for a guest', async () => {
      const draftPublic = await insertPost(t.db, { title: 'Draf awam', author: ADMIN, isPublic: true, status: 'draft' })
      const futurePublic = await insertPost(t.db, { title: 'Jadual awam', author: ADMIN, isPublic: true, status: 'scheduled', scheduledAt: '2026-12-01T09:00:00+08:00' })
      for (const post of [id.nat1, id.s1, draftPublic, futurePublic, '999999', 'abc']) {
        expectError(await t.http().get(`/api/public/perutusan/${post}`), 'NOT_FOUND', 'Not Found.')
      }
    })

    it('the page detail of the same post says it has a public link; a private one has none', async () => {
      expect((await st1.agent.get(`/api/perutusan/${id.pub}`)).body.data.publicUrl).toBe(`/perutusan/awam/${id.pub}`)
      expect((await st1.agent.get(`/api/perutusan/${id.nat1}`)).body.data.publicUrl).toBeNull()
    })
  })

  describe('write access and validation (BR-M09-22)', () => {
    it('only admin and school_admin may write: 403 for teacher and student, 401 without a session, CSRF_INVALID without a token', async () => {
      for (const who of [teacher, st1]) expectError(await postPerutusan(who, text()), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await postPerutusan({ agent: t.http(), csrf: '' }, text(), {}, { csrf: null }), 'UNAUTHORIZED')
      expectError(await postPerutusan(admin, text(), {}, { csrf: null }), 'CSRF_INVALID')
      expectError(await postPerutusan(admin, text(), {}, { csrf: 'wrong' }), 'CSRF_INVALID')
      expect(await t.db.query(`select 1 from perutusan where title = 'Perutusan contoh'`)).toHaveLength(0)
    })

    it('admin writes nationally; the scope and author come from the session, never the body; the body is sanitised', async () => {
      const res = await postPerutusan(
        admin,
        text({ body: '<p>Halo</p><script>alert(1)</script><img src="x" onerror="alert(1)">', title: '  Tajuk admin  ', isPublic: '1' }),
      )
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('Perutusan berjaya dihantar.')
      const detail = PerutusanDetailSchema.parse(res.body.data)
      expect(detail).toMatchObject({ title: 'Tajuk admin', isPublic: true, canWrite: true, reads: 0, myReactions: [], images: [], documents: [], scopeLabel: 'Seluruh Malaysia (Kebangsaan)' })
      expect(detail.publicUrl).toBe(`/perutusan/awam/${detail.id}`)
      expect(detail.body).not.toMatch(/script|onerror|alert/i)
      const [row] = await t.db.query<{ scope: string; school_id: string | null; author_id: string; body: string }>(`select scope, school_id::text, author_id::text, body from perutusan where id = $1`, [detail.id])
      expect(row).toMatchObject({ scope: 'national', school_id: null, author_id: await userIdOf(t.db, ADMIN) })
      expect(row?.body).not.toMatch(/script|onerror|alert/i)
      expect(await t.db.query(`select 1 from audit_events where action = 'content.perutusan.created' and target_id = $1`, [detail.id])).toHaveLength(1)
    })

    it('a school admin writes for the own school only (scope=school with school_id set)', async () => {
      const res = await postPerutusan(sa1, text({ title: 'Dari pengetua' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data.scopeLabel).toBe('SMK Demo Satu')
      const [row] = await t.db.query<{ scope: string; school_id: string }>(`select scope, school_id::text from perutusan where id = $1`, [res.body.data.id])
      expect(row?.scope).toBe('school')
      expect(row?.school_id).toBeTruthy()
      // The other school cannot see it; the own school can.
      expectError(await st2.agent.get(`/api/perutusan/${res.body.data.id}`), 'NOT_FOUND')
      expect((await st1.agent.get(`/api/perutusan/${res.body.data.id}`)).status).toBe(200)
    })

    it('a school admin with no school: 422 under fields.form and nothing is stored', async () => {
      const t2 = await bootVp()
      try {
        const sa = await login(t2, SCHOOL_ADMIN)
        await t2.db.query(`update users set school_id = null where lower(email) = lower($1)`, [SCHOOL_ADMIN])
        const res = await postPerutusan(sa, text())
        // A changed account may also end the session; the rule is only reachable while it is valid.
        if (res.status === 422) {
          expect(fieldsOf(res)).toEqual({ form: 'Pentadbir sekolah mesti mempunyai sekolah.' })
          expect(await t2.db.query(`select 1 from perutusan`)).toHaveLength(0)
        } else {
          expect([401, 403]).toContain(res.status)
        }
      } finally {
        await t2.close()
      }
    })

    it('required and invalid fields use the mock placeholder messages; unknown keys are refused', async () => {
      expect(fieldsOf(await postPerutusan(admin, {}))).toEqual({ title: 'Medan ini diperlukan.', status: 'Medan ini diperlukan.' })
      expect(fieldsOf(await postPerutusan(admin, text({ title: '   ' })))).toEqual({ title: 'Medan ini diperlukan.' })
      expect(fieldsOf(await postPerutusan(admin, text({ title: 'x'.repeat(256), status: 'archived', youtubeUrl: 'https://vimeo.com/123' })))).toEqual({
        title: 'Medan ini tidak sah.',
        status: 'Medan ini tidak sah.',
        youtubeUrl: 'Medan ini tidak sah.',
      })
      expect(fieldsOf(await postPerutusan(admin, text({ authorId: '1', scope: 'national', schoolId: '1' })))).toEqual({
        authorId: 'Medan ini tidak sah.',
        scope: 'Medan ini tidak sah.',
        schoolId: 'Medan ini tidak sah.',
      })
    })

    it('scheduling: needs a future time (a time without an offset is Malaysia time); a past, impossible or missing time is 422; the DB check cannot be reached', async () => {
      expect(fieldsOf(await postPerutusan(admin, text({ status: 'scheduled' })))).toEqual({ scheduledAt: 'Medan ini diperlukan.' })
      for (const bad of ['2026-10-19T08:59', '2026-10-19T08:00:00+08:00', '2026-02-31T10:00', '2026-13-01T10:00', 'tomorrow', '2026-10-19T24:00']) {
        expect(fieldsOf(await postPerutusan(admin, text({ status: 'scheduled', scheduledAt: bad }))), bad).toEqual({ scheduledAt: 'Medan ini tidak sah.' })
      }
      const ok = await postPerutusan(admin, text({ status: 'scheduled', scheduledAt: '2026-10-19T09:30', title: 'Jadual baharu' }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      expect(ok.body.status).toBe('Perutusan dijadualkan.')
      const [row] = await t.db.query<{ at: string }>(`select scheduled_at at time zone 'Asia/Kuala_Lumpur' as at from perutusan where id = $1`, [ok.body.data.id])
      expect(String(row?.at)).toContain('09:30')
      // A scheduled time on a post that is not scheduled is ignored.
      const pub = await postPerutusan(admin, text({ scheduledAt: 'rubbish', title: 'Terbit segera' }))
      expect(pub.status).toBe(201)
      const [r2] = await t.db.query<{ scheduled_at: string | null }>(`select scheduled_at from perutusan where id = $1`, [pub.body.data.id])
      expect(r2?.scheduled_at).toBeNull()
    })

    it('draft: stored as draft with the draft flash; it is in "mine" but in nobody feed', async () => {
      const res = await postPerutusan(admin, text({ status: 'draft', title: 'Draf admin' }))
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('Draf perutusan disimpan.')
      expect(await feedIds(admin)).not.toContain(res.body.data.id)
      expect((await admin.agent.get('/api/perutusan/mine')).body.data.map((p: { id: string }) => p.id)).toContain(res.body.data.id)
    })

    it('the pin limit is 2 published-or-scheduled pins per scope; drafts do not count; another school has its own limit', async () => {
      const t2 = await bootVp()
      try {
        const adm = await login(t2, ADMIN)
        const s1 = await login(t2, SCHOOL_ADMIN)
        const pin = (who: LoggedIn, over: Record<string, string> = {}) => postPerutusan(who, text({ isPinned: 'on', ...over }))
        expect((await pin(adm)).status).toBe(201)
        expect((await pin(adm, { status: 'scheduled', scheduledAt: '2026-11-01T09:00' })).status).toBe(201)
        const third = await pin(adm)
        expect(fieldsOf(third)).toEqual({ isPinned: 'Maksimum 2 perutusan boleh disematkan.' })
        expect((await pin(adm, { status: 'draft' })).status).toBe(201)
        expect((await pin(s1)).status).toBe(201)
        expect(await t2.db.query(`select 1 from perutusan where is_pinned and status <> 'draft' and scope = 'national'`)).toHaveLength(2)
        // Simultaneous pins in one scope cannot pass the limit.
        const race = await Promise.all([pin(s1), pin(s1), pin(s1), pin(s1)])
        expect(race.filter((r) => r.status === 201)).toHaveLength(1)
        expect(await t2.db.query(`select 1 from perutusan where is_pinned and status <> 'draft' and scope = 'school'`)).toHaveLength(2)
      } finally {
        await t2.close()
      }
    })

    it('writes are limited per user: 429 after the ceiling, nothing stored for the refused call', async () => {
      const t2 = await bootVp({ THROTTLE_ADMIN_WRITE_PER_MINUTE: '2' })
      try {
        const adm = await login(t2, ADMIN)
        expect((await postPerutusan(adm, text())).status).toBe(201)
        expect((await postPerutusan(adm, text())).status).toBe(201)
        const third = await postPerutusan(adm, text())
        expectError(third, 'RATE_LIMITED', 'Too Many Attempts.')
        expect(await t2.db.query(`select 1 from perutusan`)).toHaveLength(2)
      } finally {
        await t2.close()
      }
    })
  })
})

describe('perutusan helpers', () => {
  it('excerpt: tags removed, whitespace collapsed, cut at 250 characters with "..."', () => {
    expect(excerptOf('<p>Satu   <b>dua</b></p>\n<p>tiga</p>')).toBe('Satu dua tiga')
    expect(excerptOf(`<p>${'a'.repeat(300)}</p>`)).toBe(`${'a'.repeat(250)}...`)
    expect(excerptOf('a'.repeat(250))).toBe('a'.repeat(250))
  })

  it('initials: the first letters of the first two words', () => {
    expect(initialsOf('Admin Pusat Demo')).toBe('AP')
    expect(initialsOf('  guru  ')).toBe('G')
  })

  it('booleans: true, 1, on, yes are true; anything else is false and never an error', () => {
    expect(['1', 'true', 'on', 'yes', 'ON', 'True'].map(asBool)).toEqual([true, true, true, true, true, true])
    expect(['0', 'false', 'off', 'no', '', 'banana', undefined, null].map(asBool)).toEqual([false, false, false, false, false, false, false, false])
  })

  it('scheduledAt: no offset means Malaysia time; the calendar is checked, never rolled over', () => {
    expect(parseScheduledAt('2026-10-19T10:00')?.toISOString()).toBe('2026-10-19T02:00:00.000Z')
    expect(parseScheduledAt('2026-10-19T10:00:30')?.toISOString()).toBe('2026-10-19T02:00:30.000Z')
    expect(parseScheduledAt('2026-10-19T10:00:00Z')?.toISOString()).toBe('2026-10-19T10:00:00.000Z')
    expect(parseScheduledAt('2026-10-19T10:00:00-05:00')?.toISOString()).toBe('2026-10-19T15:00:00.000Z')
    for (const bad of ['2026-02-31T10:00', '2026-02-29T10:00', '2026-10-19T24:00', '2026-10-19T10:60', '2026-10-19T10:00:61', '2026-10-19', '2026-10-19T10:00+25:00', '']) {
      expect(parseScheduledAt(bad), bad).toBeNull()
    }
    expect(parseScheduledAt('2028-02-29T10:00')).not.toBeNull()
  })
})
