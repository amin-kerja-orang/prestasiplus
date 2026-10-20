import { VIDEO_CATEGORIES, VideoDetailSchema, VideoFormContextSchema, VideoListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseVideoUrl } from '../../src/modules/content/videos/video-url'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT,
  TEACHER,
  apiOf,
  bootVp,
  expectError,
  fieldsOf,
  insertSubject,
  insertVideo,
  login,
  moveUser,
  userIdOf,
  type Api,
  type LoggedIn,
  type VpApp,
} from './vp-helpers'

const OTHER_SCHOOL_STUDENT = 'pelajar2@demo.test'
const YT = 'https://www.youtube.com/watch?v=abcdefghijk'
const body = (over: Record<string, unknown> = {}) => ({ videoUrl: YT, title: 'Video contoh', category: 'tutorial', visibility: 'global', ...over })

describe('videos: visibility by school, writes, validation (AC 5, AC 6, AC 8)', () => {
  let t: VpApp
  let teacher: LoggedIn
  let student: LoggedIn
  let outsider: LoggedIn
  let schoolAdmin: LoggedIn
  let admin: LoggedIn
  let api: Record<'teacher' | 'student' | 'outsider' | 'schoolAdmin' | 'admin', Api>
  const id: Record<string, string> = {}
  let sejarah = ''
  let fizik = ''

  const idsOf = (res: { body: { data: { id: string }[] } }): string[] => res.body.data.map((v) => v.id)

  beforeAll(async () => {
    t = await bootVp()
    await moveUser(t.db, OTHER_SCHOOL_STUDENT, 'DEMO002')
    teacher = await login(t, TEACHER)
    student = await login(t, STUDENT)
    outsider = await login(t, OTHER_SCHOOL_STUDENT)
    schoolAdmin = await login(t, SCHOOL_ADMIN)
    admin = await login(t, ADMIN)
    api = { teacher: apiOf(teacher), student: apiOf(student), outsider: apiOf(outsider), schoolAdmin: apiOf(schoolAdmin), admin: apiOf(admin) }

    sejarah = await insertSubject(t.db, 'SEJ', 'Sejarah')
    fizik = await insertSubject(t.db, 'FIZ', 'Fizik')
    id.global1 = await insertVideo(t.db, { title: 'Global satu', uploader: ADMIN, category: 'motivasi', createdAt: '2026-10-01T10:00:00+08:00', subjectId: Number(sejarah) })
    id.global2 = await insertVideo(t.db, { title: 'Global dua', uploader: ADMIN, category: 'tutorial', createdAt: '2026-10-02T10:00:00+08:00', subjectId: Number(sejarah) })
    id.school1 = await insertVideo(t.db, { title: 'Sekolah satu', uploader: TEACHER, visibility: 'school', sharedWith: ['DEMO001'], createdAt: '2026-10-03T10:00:00+08:00', subjectId: Number(sejarah) })
    id.school2 = await insertVideo(t.db, { title: 'Sekolah dua', uploader: ADMIN, visibility: 'school', sharedWith: ['DEMO002'], createdAt: '2026-10-04T10:00:00+08:00' })
    // A `school` video with no share row is visible to its uploader and admins only.
    id.orphan = await insertVideo(t.db, { title: 'Sekolah tanpa kongsi', uploader: TEACHER, visibility: 'school', createdAt: '2026-10-05T10:00:00+08:00' })
  })
  afterAll(async () => {
    await t.close()
  })

  describe('visibility (AC 5)', () => {
    it('a guest sees global videos only, newest first, and the answer is no-store', async () => {
      const res = await t.http().get('/api/videos')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      VideoListResponseSchema.parse(res.body)
      expect(idsOf(res)).toEqual([id.global2, id.global1])
      expect(res.body.meta.facets.total).toBe(2)
    })

    it('a student sees global videos and those shared with the own school, not other schools or unshared ones', async () => {
      const res = await student.agent.get('/api/videos')
      expect(idsOf(res)).toEqual([id.school1, id.global2, id.global1])
      expect(res.body.meta.facets.total).toBe(3)
    })

    it('a student of another school sees only their own school videos and the global ones', async () => {
      const res = await outsider.agent.get('/api/videos')
      expect(idsOf(res)).toEqual([id.school2, id.global2, id.global1])
    })

    it('the uploader sees the own unshared school video; an admin sees everything', async () => {
      expect(idsOf(await teacher.agent.get('/api/videos'))).toEqual([id.orphan, id.school1, id.global2, id.global1])
      const all = await admin.agent.get('/api/videos')
      expect(idsOf(all)).toEqual([id.orphan, id.school2, id.school1, id.global2, id.global1])
      expect(all.body.meta.facets.total).toBe(5)
    })

    it('an invisible video is a plain 404 on the page, edit and delete, for a guest and for another school', async () => {
      for (const actor of [t.http(), outsider.agent]) {
        const res = await actor.get(`/api/videos/${id.school1}`)
        expectError(res, 'NOT_FOUND', 'Not Found.')
      }
      expectError(await api.outsider.put(`/videos/${id.school1}`, body()), 'NOT_FOUND')
      expectError(await api.outsider.del(`/videos/${id.school1}`), 'NOT_FOUND')
      const count = await t.db.query(`select 1 from videos where id = $1`, [id.school1])
      expect(count).toHaveLength(1)
      // A school video of the own school is visible but not manageable: 403, not 404.
      expectError(await api.student.put(`/videos/${id.school1}`, body()), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await api.student.del(`/videos/${id.school1}`), 'FORBIDDEN', 'This action is unauthorized.')
    })

    it('related videos never include a school-only video for a non-admin', async () => {
      const own = await student.agent.get(`/api/videos/${id.global1}`)
      expect(own.body.data.related.map((c: { id: string }) => c.id)).toEqual([id.global2])
      const admins = await admin.agent.get(`/api/videos/${id.global1}`)
      expect(admins.body.data.related.map((c: { id: string }) => c.id)).toEqual([id.school1, id.global2])
    })

    it('an invalid or unknown id is 404 for everyone', async () => {
      for (const bad of ['abc', '0', '999999', '-1', '1.5', '99999999999999999999999']) {
        expectError(await t.http().get(`/api/videos/${bad}`), 'NOT_FOUND')
      }
    })
  })

  describe('create, update, delete (AC 5, AC 8)', () => {
    it('a teacher publishes at once (no approval state in the mock): 201, flash, detail shape, uploader from the session', async () => {
      const res = await api.teacher.post('/videos', body({ title: 'Video guru', visibility: 'school', description: 'Penerangan', subjectId: fizik, uploaderId: undefined }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('Video berjaya diterbitkan.')
      const detail = VideoDetailSchema.parse(res.body.data)
      expect(detail.visibility).toBe('school')
      expect(detail.platform).toBe('Youtube')
      expect(detail.embedUrl).toBe('https://www.youtube.com/embed/abcdefghijk')
      expect(detail.thumbnailUrl).toBe('https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg')
      expect(detail.views).toBe(0)
      expect(detail.subject).toEqual({ id: fizik, name: 'Fizik' })
      expect(detail.canManage).toBe(true)
      expect(detail.uploader).toEqual({ name: 'Guru Demo', initial: 'G', roleLabel: 'Guru' })
      const [row] = await t.db.query<{ uploader_id: string; school_id: string; subject_id: string }>(`select uploader_id::text, school_id::text, subject_id::text from videos where id = $1`, [detail.id])
      expect(row?.uploader_id).toBe(await userIdOf(t.db, TEACHER))
      const shares = await t.db.query<{ school_id: string }>(`select school_id::text from video_schools where video_id = $1`, [detail.id])
      expect(shares.map((s) => s.school_id)).toEqual([row?.school_id])
      // The classmate sees it, the other school does not.
      expect((await student.agent.get(`/api/videos/${detail.id}`)).status).toBe(200)
      expect((await outsider.agent.get(`/api/videos/${detail.id}`)).status).toBe(404)
      const audit = await t.db.query<{ actor_user_id: string }>(`select actor_user_id::text from audit_events where action = 'content.video.created' and target_id = $1`, [detail.id])
      expect(audit).toHaveLength(1)
      expect(audit[0]?.actor_user_id).toBe(await userIdOf(t.db, TEACHER))
    })

    it('a client-sent uploader, school or any unknown key is refused, never read', async () => {
      const res = await api.student.post('/videos', body({ uploaderId: '1', schoolId: '1' }))
      expect(fieldsOf(res)).toEqual({ uploaderId: 'Medan ini tidak sah.', schoolId: 'Medan ini tidak sah.' })
    })

    it('an unknown subject is 422 under subjectId on create and update (the contract copy); a known one is accepted and named', async () => {
      expect(fieldsOf(await api.teacher.post('/videos', body({ subjectId: '99999999' })))).toEqual({ subjectId: 'Medan ini tidak sah.' })
      expect(fieldsOf(await api.teacher.post('/videos', body({ subjectId: 'abc' })))).toEqual({ subjectId: 'Medan ini tidak sah.' })
      const ok = await api.teacher.post('/videos', body({ title: 'Ada subjek', subjectId: sejarah }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      expect(ok.body.data.subject).toEqual({ id: sejarah, name: 'Sejarah' })
      expect(fieldsOf(await api.teacher.put(`/videos/${ok.body.data.id}`, body({ subjectId: '99999999' })))).toEqual({ subjectId: 'Medan ini tidak sah.' })
      const moved = await api.teacher.put(`/videos/${ok.body.data.id}`, body({ title: 'Ada subjek', subjectId: fizik }))
      expect(moved.body.data.subject).toEqual({ id: fizik, name: 'Fizik' })
      const cleared = await api.teacher.put(`/videos/${ok.body.data.id}`, body({ title: 'Ada subjek', subjectId: '' }))
      expect(cleared.body.data.subject).toBeNull()
    })

    it('required and invalid fields use the mock placeholder messages', async () => {
      expect(fieldsOf(await api.student.post('/videos', {}))).toEqual({
        videoUrl: 'Medan ini diperlukan.',
        title: 'Medan ini diperlukan.',
        category: 'Medan ini diperlukan.',
        visibility: 'Medan ini diperlukan.',
      })
      expect(fieldsOf(await api.student.post('/videos', body({ title: '   ' })))).toEqual({ title: 'Medan ini diperlukan.' })
      const bad = fieldsOf(
        await api.student.post('/videos', body({ videoUrl: 'javascript:alert(1)', title: 'x'.repeat(256), category: 'lain', visibility: 'private', description: 'd'.repeat(1001) })),
      )
      expect(bad).toEqual({
        videoUrl: 'Medan ini tidak sah.',
        title: 'Medan ini tidak sah.',
        category: 'Medan ini tidak sah.',
        visibility: 'Medan ini tidak sah.',
        description: 'Medan ini tidak sah.',
      })
      expect(fieldsOf(await api.student.post('/videos', body({ subjectId: 'abc' })))).toEqual({ subjectId: 'Medan ini tidak sah.' })
      expect(fieldsOf(await api.student.post('/videos', body({ title: 42 })))).toEqual({ title: 'Medan ini tidak sah.' })
      expect(fieldsOf(await api.student.post('/videos', body({ videoUrl: 'ftp://example.test/v' })))).toEqual({ videoUrl: 'Medan ini tidak sah.' })
    })

    it('"school" needs a school on the uploader account: 422 under fields.visibility', async () => {
      // The central admin account has no school.
      const res = await api.admin.post('/videos', body({ visibility: 'school' }))
      expect(fieldsOf(res)).toEqual({ visibility: 'Anda tiada sekolah untuk dikongsi.' })
      expect(errorOf(res).message).toBe('Anda tiada sekolah untuk dikongsi.')
      const ctx = await admin.agent.get('/api/videos/form-context')
      expect(VideoFormContextSchema.parse(ctx.body.data).school).toBeNull()
      expect((await api.admin.post('/videos', body({ visibility: 'global' }))).status).toBe(201)
    })

    it('form-context returns the uploader and the account school; a guest gets 401', async () => {
      const res = await student.agent.get('/api/videos/form-context')
      expect(res.status).toBe(200)
      const ctx = VideoFormContextSchema.parse(res.body.data)
      expect(ctx.school?.name).toBe('SMK Demo Satu')
      expect(ctx.uploader.roleLabel).toBe('Pelajar')
      expectError(await t.http().get('/api/videos/form-context'), 'UNAUTHORIZED')
    })

    it('no session is 401 and a missing or wrong CSRF token is 403 CSRF_INVALID on every write', async () => {
      for (const [method, url] of [['post', '/api/videos'], ['put', `/api/videos/${id.global1}`], ['delete', `/api/videos/${id.global1}`]] as const) {
        expectError(await t.http()[method](url).send(body()), 'UNAUTHORIZED')
        expectError(await admin.agent[method](url).send(body()), 'CSRF_INVALID')
        expectError(await admin.agent[method](url).set('X-CSRF-Token', 'wrong').send(body()), 'CSRF_INVALID')
      }
      expect(await t.db.query(`select 1 from videos where id = $1`, [id.global1])).toHaveLength(1)
    })

    it('the uploader edits: visibility school -> global removes the share row; other fields change; one audit row', async () => {
      const created = await api.teacher.post('/videos', body({ title: 'Untuk diubah', visibility: 'school' }))
      const vid = created.body.data.id as string
      const res = await api.teacher.put(`/videos/${vid}`, body({ title: 'Sudah diubah', visibility: 'global', videoUrl: 'https://vimeo.com/123456', category: 'ceramah' }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBe('Video berjaya dikemaskini.')
      const detail = VideoDetailSchema.parse(res.body.data)
      expect(detail).toMatchObject({ title: 'Sudah diubah', platform: 'Vimeo', category: 'ceramah', visibility: 'global', embedUrl: 'https://player.vimeo.com/video/123456' })
      expect(await t.db.query(`select 1 from video_schools where video_id = $1`, [vid])).toHaveLength(0)
      const [row] = await t.db.query<{ school_id: string | null }>(`select school_id::text from videos where id = $1`, [vid])
      expect(row?.school_id).toBeNull()
      expect(await t.db.query(`select 1 from audit_events where action = 'content.video.updated' and target_id = $1`, [vid])).toHaveLength(1)
    })

    it('an admin edits another user video and the school stays the uploader school', async () => {
      const created = await api.teacher.post('/videos', body({ title: 'Guru kongsi', visibility: 'global' }))
      const vid = created.body.data.id as string
      const res = await api.admin.put(`/videos/${vid}`, body({ title: 'Admin ubah', visibility: 'school' }))
      expect(res.status).toBe(200)
      const shares = await t.db.query<{ school_id: string }>(`select school_id::text from video_schools where video_id = $1`, [vid])
      expect(shares).toHaveLength(1)
      const [teacherRow] = await t.db.query<{ school_id: string }>(`select school_id::text from users where lower(email) = lower($1)`, [TEACHER])
      expect(shares[0]?.school_id).toBe(teacherRow?.school_id)
      expect(res.body.data.canManage).toBe(true)
    })

    it('validation on update comes after 404 and 403 (the mock order)', async () => {
      expectError(await api.student.put(`/videos/${id.global1}`, {}), 'FORBIDDEN')
      expectError(await api.admin.put('/videos/999999', {}), 'NOT_FOUND')
      expect(fieldsOf(await api.admin.put(`/videos/${id.global1}`, {}))).toHaveProperty('title')
    })

    it('the uploader deletes (200 { deleted: 1 } + flash), the share rows go too, and the delete is audited', async () => {
      const created = await api.teacher.post('/videos', body({ title: 'Untuk dipadam', visibility: 'school' }))
      const vid = created.body.data.id as string
      const res = await api.teacher.del(`/videos/${vid}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Video berjaya dipadam.' })
      expect(await t.db.query(`select 1 from videos where id = $1`, [vid])).toHaveLength(0)
      expect(await t.db.query(`select 1 from video_schools where video_id = $1`, [vid])).toHaveLength(0)
      expect(await t.db.query(`select 1 from audit_events where action = 'content.video.deleted' and target_id = $1`, [vid])).toHaveLength(1)
      expectError(await api.teacher.del(`/videos/${vid}`), 'NOT_FOUND')
    })
  })

  describe('child safety: global and open links are for staff only (LEAD 2026-10-20, D9)', () => {
    const count = async () => (await t.db.query(`select 1 from videos`)).length

    it('a student cannot publish global: 422 under visibility, nothing stored; school is accepted and stays school', async () => {
      const before = await count()
      expect(fieldsOf(await api.student.post('/videos', body({ visibility: 'global' })))).toEqual({ visibility: 'Medan ini tidak sah.' })
      expect(await count()).toBe(before)
      const ok = await api.student.post('/videos', body({ visibility: 'school', title: 'Pelajar sekolah' }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      expect(ok.body.data.visibility).toBe('school')
      // Only the own school sees it.
      expect((await outsider.agent.get(`/api/videos/${ok.body.data.id}`)).status).toBe(404)
      expect((await t.http().get(`/api/videos/${ok.body.data.id}`)).status).toBe(404)
    })

    it('a teacher and an admin may publish global, and any https host', async () => {
      for (const who of [api.teacher, api.admin]) {
        const res = await who.post('/videos', body({ visibility: 'global', videoUrl: 'https://example.test/clip.mp4' }))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.data.visibility).toBe('global')
      }
    })

    it('a student link must be https on a known video host: YouTube and Vimeo pass, everything else is 422 under videoUrl', async () => {
      for (const url of [YT, 'https://youtu.be/abcdefghijk', 'https://m.youtube.com/watch?v=abcdefghijk', 'https://vimeo.com/123456', 'https://player.vimeo.com/video/123456']) {
        const res = await api.student.post('/videos', body({ visibility: 'school', videoUrl: url }))
        expect(res.status, url).toBe(201)
      }
      for (const url of [
        'https://example.test/clip.mp4',
        'http://www.youtube.com/watch?v=abcdefghijk',
        'https://evil.test/www.youtube.com/watch?v=abcdefghijk',
        'https://www.youtube.com.evil.test/watch?v=abcdefghijk',
        'https://user:pw@www.youtube.com/watch?v=abcdefghijk',
        'https://www.dailymotion.com/video/x8abc',
        'https://www.youtube.com/channel/abc',
      ]) {
        expect(fieldsOf(await api.student.post('/videos', body({ visibility: 'school', videoUrl: url }))), url).toEqual({ videoUrl: 'Medan ini tidak sah.' })
      }
    })

    it('a student cannot edit the own video to global or to another host; a staff member can edit it', async () => {
      const created = await api.student.post('/videos', body({ visibility: 'school', title: 'Ubah saya' }))
      const vid = created.body.data.id as string
      expect(fieldsOf(await api.student.put(`/videos/${vid}`, body({ visibility: 'global' })))).toEqual({ visibility: 'Medan ini tidak sah.' })
      expect(fieldsOf(await api.student.put(`/videos/${vid}`, body({ visibility: 'school', videoUrl: 'https://example.test/x' })))).toEqual({ videoUrl: 'Medan ini tidak sah.' })
      expect((await api.student.put(`/videos/${vid}`, body({ visibility: 'school', title: 'Sudah ubah' }))).status).toBe(200)
      const [row] = await t.db.query<{ visibility: string; title: string }>(`select visibility, title from videos where id = $1`, [vid])
      expect(row).toEqual({ visibility: 'school', title: 'Sudah ubah' })
      const staff = await api.admin.put(`/videos/${vid}`, body({ visibility: 'global', title: 'Disemak admin' }))
      expect(staff.status, JSON.stringify(staff.body)).toBe(200)
    })
  })

  describe('page, views, list, search and facets (AC 6)', () => {
    it('the page shows the views before this open and counts it after; for=edit counts nothing for the uploader or an admin, but is a normal view for anyone else', async () => {
      const vid = await insertVideo(t.db, { title: 'Dibuka', uploader: ADMIN, views: 4 })
      expect((await t.http().get(`/api/videos/${vid}`)).body.data.views).toBe(4)
      expect((await t.http().get(`/api/videos/${vid}`)).body.data.views).toBe(5)
      // A guest and a student cannot manage it: ?for=edit is counted like any open.
      expect((await t.http().get(`/api/videos/${vid}?for=edit`)).body.data.views).toBe(6)
      expect((await student.agent.get(`/api/videos/${vid}?for=edit`)).body.data.views).toBe(7)
      // An admin (canManage) loads the form without counting.
      expect((await admin.agent.get(`/api/videos/${vid}?for=edit`)).body.data.views).toBe(8)
      expect((await admin.agent.get(`/api/videos/${vid}?for=edit`)).body.data.views).toBe(8)
      const [row] = await t.db.query<{ views: number }>(`select views from videos where id = $1`, [vid])
      expect(row?.views).toBe(8)
    })

    it('a PUT racing a DELETE never answers 500: 200 or 404, and no half-updated row is left', async () => {
      for (let i = 0; i < 6; i++) {
        const created = await api.teacher.post('/videos', body({ title: `Lumba ${String(i)}`, visibility: 'school' }))
        const vid = created.body.data.id as string
        const [put, del] = await Promise.all([api.teacher.put(`/videos/${vid}`, body({ title: 'Diubah' })), api.teacher.del(`/videos/${vid}`)])
        expect([200, 404]).toContain(put.status)
        expect(del.status).toBe(200)
        expect(await t.db.query(`select 1 from video_schools where video_id = $1`, [vid])).toHaveLength(0)
      }
    })

    it('a page holds 24 cards, newest first; meta follows the mock; a bad or too large page is not an error', async () => {
      const other = await bootVp()
      try {
        for (let i = 0; i < 30; i++) {
          await insertVideo(other.db, { title: `Banyak ${String(i).padStart(2, '0')}`, uploader: ADMIN, createdAt: `2026-09-${String(i + 1).padStart(2, '0')}T08:00:00+08:00` })
        }
        const one = await other.http().get('/api/videos')
        expect(one.body.data).toHaveLength(24)
        expect(one.body.data[0].title).toBe('Banyak 29')
        expect(one.body.meta).toMatchObject({ page: 1, pageSize: 24, totalItems: 30, totalPages: 2, from: 1, to: 24 })
        const two = await other.http().get('/api/videos?page=2')
        expect(two.body.data).toHaveLength(6)
        expect(two.body.meta).toMatchObject({ page: 2, from: 25, to: 30 })
        for (const bad of ['abc', '0', '-3', '1.5', '']) {
          expect((await other.http().get(`/api/videos?page=${bad}`)).body.meta.page).toBe(1)
        }
        const far = await other.http().get('/api/videos?page=99')
        expect(far.status).toBe(200)
        expect(far.body.data).toEqual([])
        expect(far.body.meta).toMatchObject({ page: 99, totalItems: 30, from: null, to: null })
      } finally {
        await other.close()
      }
    })

    it('search is a literal, case-insensitive title match: % and _ are not wildcards', async () => {
      await insertVideo(t.db, { title: 'Diskaun 100% Hebat', uploader: ADMIN })
      await insertVideo(t.db, { title: 'Nama_garis', uploader: ADMIN })
      await insertVideo(t.db, { title: 'NamaXgaris', uploader: ADMIN })
      const titles = async (q: string) => ((await t.http().get(`/api/videos?search=${encodeURIComponent(q)}`)).body.data as { title: string }[]).map((v) => v.title)
      expect(await titles('hebat')).toEqual(['Diskaun 100% Hebat'])
      expect(await titles('%')).toEqual(['Diskaun 100% Hebat'])
      expect(await titles('a_g')).toEqual(['Nama_garis'])
      expect(await titles("' OR 1=1 --")).toEqual([])
    })

    it('facets: all five categories (zero counts too) and only subjects with a count, in id order; names come from the curriculum', async () => {
      const res = await t.http().get('/api/videos?search=Global')
      const { facets } = res.body.meta
      expect(facets.total).toBe(2)
      expect(facets.categories.map((c: { code: string }) => c.code)).toEqual([...VIDEO_CATEGORIES])
      expect(Object.fromEntries(facets.categories.map((c: { code: string; count: number }) => [c.code, c.count]))).toEqual({ motivasi: 1, tutorial: 1, 'tips-spm': 0, ceramah: 0, 'lain-lain': 0 })
      expect(facets.subjects).toEqual([{ id: sejarah, name: 'Sejarah', count: 2 }])
      // The category filter narrows the list and the subject pills, not the category pills.
      const filtered = await t.http().get('/api/videos?search=Global&category=motivasi')
      expect(filtered.body.data).toHaveLength(1)
      expect(filtered.body.meta.facets.total).toBe(2)
      expect(filtered.body.meta.facets.subjects).toEqual([{ id: sejarah, name: 'Sejarah', count: 1 }])
      const bySubject = await t.http().get(`/api/videos?search=Global&subject=${sejarah}&category=all`)
      expect(bySubject.body.data).toHaveLength(2)
      expect(bySubject.body.meta.facets.total).toBe(2)
      const none = await t.http().get('/api/videos?subject=999')
      expect(none.body.data).toEqual([])
      expect((await t.http().get('/api/videos?subject=abc')).body.meta.totalItems).toBeGreaterThan(0)
      expect((await t.http().get('/api/videos?category=nope')).body.data).toEqual([])
    })

    it('facet names resolve for several subjects at once, inactive ones included', async () => {
      const extra = [await insertSubject(t.db, 'KIM', 'Kimia'), await insertSubject(t.db, 'BIO', 'Biologi')]
      await t.db.query(`update subjects set is_active = false where id = $1`, [extra[1]])
      for (const [i, sid] of extra.entries()) await insertVideo(t.db, { title: `Subjek banyak ${String(i)}`, uploader: ADMIN, subjectId: Number(sid) })
      const res = await t.http().get('/api/videos?search=Subjek%20banyak')
      expect(res.body.meta.facets.subjects).toEqual(extra.map((sid, i) => ({ id: sid, name: ['Kimia', 'Biologi'][i], count: 1 })))
    })

    it('a guest with a stale or invalid cookie is a guest, not an error', async () => {
      const res = await t.http().get('/api/videos').set('Cookie', 'pp_session=not-a-session')
      expect(res.status).toBe(200)
      expect(idsOf(res)).toEqual(expect.not.arrayContaining([id.school1]))
    })
  })
})

describe('videos: hygiene', () => {
  it('writes are limited per user: the 3rd create in a minute is 429 with Retry-After', async () => {
    const t = await bootVp({ THROTTLE_ADMIN_WRITE_PER_MINUTE: '2' })
    try {
      const me = await login(t, TEACHER)
      const a = apiOf(me)
      expect((await a.post('/videos', body())).status).toBe(201)
      expect((await a.post('/videos', body())).status).toBe(201)
      const third = await a.post('/videos', body())
      expectError(third, 'RATE_LIMITED', 'Too Many Attempts.')
      expect(Number(third.headers['retry-after'])).toBeGreaterThan(0)
      expect(await t.db.query(`select 1 from videos`)).toHaveLength(2)
    } finally {
      await t.close()
    }
  })

  it('public reads are limited per client address', async () => {
    const t = await bootVp({ THROTTLE_PUBLIC_SEARCH_PER_MINUTE: '3' })
    try {
      for (let i = 0; i < 3; i++) expect((await t.http().get('/api/videos')).status).toBe(200)
      expectError(await t.http().get('/api/videos'), 'RATE_LIMITED', 'Too Many Attempts.')
    } finally {
      await t.close()
    }
  })
})

describe('video URL parsing (port of the mock)', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abcdefghijk&t=3', 'Youtube', 'abcdefghijk'],
    ['https://youtu.be/abcdefghijk', 'Youtube', 'abcdefghijk'],
    ['https://www.youtube.com/shorts/abcdefghijk', 'Youtube', 'abcdefghijk'],
    ['https://vimeo.com/987654', 'Vimeo', '987654'],
    ['https://www.dailymotion.com/video/x8abc', 'Dailymotion', 'x8abc'],
    ['https://www.tiktok.com/@a/video/1', 'TikTok', null],
    ['https://www.facebook.com/page/videos/1', 'Facebook', null],
    ['https://example.test/clip.mp4', 'Other', null],
  ])('%s -> %s', (url, platform, externalId) => {
    expect(parseVideoUrl(url)).toMatchObject({ platform, externalId })
  })

  it('an embed URL is built only from a matched id, never from the input text', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=abcdefghijk"><script>').embedUrl).toBe('https://www.youtube.com/embed/abcdefghijk')
    expect(parseVideoUrl('https://www.youtube.com/watch?v="><script>x</script>').embedUrl).toBeNull()
  })
})

function errorOf(res: { body: unknown }) {
  return (res.body as { error: { message: string } }).error
}

describe('video repository: a lost update race', () => {
  it('update answers null (the service maps it to 404) when the row is already gone, never a P2025', async () => {
    const { VideosRepository } = await import('../../src/modules/content/videos/videos.repository')
    const fake = { client: { video: { updateMany: async () => ({ count: 0 }) } } }
    const repo = new VideosRepository(fake as never)
    const data = { videoUrl: 'https://example.test/v', platform: 'Other' as const, externalId: null, thumbnailUrl: null, title: 't', description: null, category: 'tutorial', subjectId: null, visibility: 'global' as const, schoolId: null }
    expect(await repo.update('5', data, new Date())).toBeNull()
  })
})
