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
  schoolIdOf,
  userIdOf,
  type Api,
  type LoggedIn,
  type VpApp,
} from './vp-helpers'

const OTHER_SCHOOL_STUDENT = 'pelajar2@demo.test'
/** A second teacher (also a school admin); moved to school DEMO002 so a teacher of another school exists. */
const OTHER_SCHOOL_TEACHER = 'guruadmin@demo.test'
const YT = 'https://www.youtube.com/watch?v=abcdefghijk'
/** Switches the active role of a multi-role login (POST /auth/role); the answer carries the new CSRF token. */
async function actAs(who: LoggedIn, role: string): Promise<LoggedIn> {
  const res = await who.agent.post('/api/session/role').set('X-CSRF-Token', who.csrf).send({ role })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return { ...who, csrf: res.body.data.csrf as string }
}
const body = (over: Record<string, unknown> = {}) => ({ videoUrl: YT, title: 'Video contoh', category: 'tutorial', visibility: 'global', ...over })

describe('videos: visibility by school, writes, validation (AC 5, AC 6, AC 8)', () => {
  let t: VpApp
  let teacher: LoggedIn
  let student: LoggedIn
  let outsider: LoggedIn
  let schoolAdmin: LoggedIn
  let teacher2: LoggedIn
  let admin: LoggedIn
  let api: Record<'teacher' | 'teacher2' | 'student' | 'outsider' | 'schoolAdmin' | 'admin', Api>
  const id: Record<string, string> = {}
  let sejarah = ''
  let fizik = ''

  const idsOf = (res: { body: { data: { id: string }[] } }): string[] => res.body.data.map((v) => v.id)

  beforeAll(async () => {
    t = await bootVp()
    await moveUser(t.db, OTHER_SCHOOL_STUDENT, 'DEMO002')
    await moveUser(t.db, OTHER_SCHOOL_TEACHER, 'DEMO002')
    teacher = await login(t, TEACHER)
    student = await login(t, STUDENT)
    outsider = await login(t, OTHER_SCHOOL_STUDENT)
    schoolAdmin = await login(t, SCHOOL_ADMIN)
    admin = await login(t, ADMIN)
    // The account is a teacher and a school admin; writes need the ACTIVE role to be teacher.
    teacher2 = await actAs(await login(t, OTHER_SCHOOL_TEACHER), 'teacher')
    api = { teacher: apiOf(teacher), teacher2: apiOf(teacher2), student: apiOf(student), outsider: apiOf(outsider), schoolAdmin: apiOf(schoolAdmin), admin: apiOf(admin) }

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
      // The list card carries the category and the subject (admin list columns).
      expect(res.body.data[0]).toMatchObject({ category: 'tutorial', categoryLabel: 'Tutorial', subject: { id: sejarah } })
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

    it('an invisible video is a plain 404 on the page for a guest and for another school, and on edit and delete for a teacher of another school', async () => {
      for (const actor of [t.http(), outsider.agent]) {
        const res = await actor.get(`/api/videos/${id.school1}`)
        expectError(res, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
      }
      // Writes are for admin and teacher only: a pupil of another school gets the role 403 first, a teacher of another school the plain 404.
      expectError(await api.outsider.put(`/videos/${id.school1}`, body()), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await api.teacher2.put(`/videos/${id.school1}`, body()), 'NOT_FOUND')
      expectError(await api.teacher2.del(`/videos/${id.school1}`), 'NOT_FOUND')
      const count = await t.db.query(`select 1 from videos where id = $1`, [id.school1])
      expect(count).toHaveLength(1)
      // A pupil never writes: 403 from the role check, whether or not the video is visible.
      expectError(await api.student.put(`/videos/${id.school1}`, body()), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
      expectError(await api.student.del(`/videos/${id.school1}`), 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
    })

    it('related videos follow the same visibility as the list (global + own school; a guest global only; admin all)', async () => {
      const related = async (who: { get(url: string): Promise<{ body: { data: { related: { id: string }[] } } }> }) =>
        (await who.get(`/api/videos/${id.global1}`)).body.data.related.map((c) => c.id)
      expect(await related(student.agent)).toEqual([id.school1, id.global2])
      expect(await related(outsider.agent)).toEqual([id.global2])
      expect(await related(t.http())).toEqual([id.global2])
      expect(await related(admin.agent)).toEqual([id.school1, id.global2])
    })

    it('an invalid or unknown id is 404 for everyone', async () => {
      for (const bad of ['abc', '0', '999999', '-1', '1.5', '99999999999999999999999']) {
        expectError(await t.http().get(`/api/videos/${bad}`), 'NOT_FOUND')
      }
    })
  })

  describe('create, update, delete (AC 5, AC 8)', () => {
    it('a teacher publishes at once (no approval state in the mock): 201, flash, detail shape, uploader from the session', async () => {
      const res = await api.teacher.post('/videos', body({ title: 'Video guru', visibility: 'global', description: 'Penerangan', subjectId: fizik, uploaderId: undefined }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('Video ditambah.')
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
      // The body asked for `global`; the server stores `school` with the teacher's own school (AC-GUR-7-6).
      expect(row?.school_id).toBe(await schoolIdOf(t.db, 'DEMO001'))
      const shares = await t.db.query<{ school_id: string }>(`select school_id::text from video_schools where video_id = $1`, [detail.id])
      expect(shares.map((s) => s.school_id)).toEqual([row?.school_id])
      // The classmate sees it, the other school does not.
      expect((await student.agent.get(`/api/videos/${detail.id}`)).status).toBe(200)
      expect((await outsider.agent.get(`/api/videos/${detail.id}`)).status).toBe(404)
      // A teacher of school Y does not see it; a teacher of school X (the uploader) does.
      expect((await teacher2.agent.get(`/api/videos/${detail.id}`)).status).toBe(404)
      expect(idsOf(await teacher2.agent.get('/api/videos'))).not.toContain(detail.id)
      expect(idsOf(await teacher.agent.get('/api/videos'))).toContain(detail.id)
      const audit = await t.db.query<{ actor_user_id: string }>(`select actor_user_id::text from audit_events where action = 'content.video.created' and target_id = $1`, [detail.id])
      expect(audit).toHaveLength(1)
      expect(audit[0]?.actor_user_id).toBe(await userIdOf(t.db, TEACHER))
    })

    it('a client-sent uploader, school or any unknown key is refused, never read', async () => {
      const res = await api.teacher.post('/videos', body({ uploaderId: '1', schoolId: '1' }))
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

    it('a teacher gets the exact BM copy for title, link and category; the other fields keep the generic copy', async () => {
      expect(fieldsOf(await api.teacher.post('/videos', {}))).toEqual({
        videoUrl: 'Sila isi pautan YouTube.',
        title: 'Sila isi tajuk video.',
        category: 'Sila pilih kategori.',
      })
      expect(fieldsOf(await api.teacher.post('/videos', body({ title: '   ' })))).toEqual({ title: 'Sila isi tajuk video.' })
      expect(fieldsOf(await api.teacher.post('/videos', body({ category: '' })))).toEqual({ category: 'Sila pilih kategori.' })
      expect(fieldsOf(await api.teacher.post('/videos', body({ title: 'x'.repeat(151) })))).toEqual({ title: 'Tajuk video tidak boleh melebihi 150 aksara.' })
      expect((await api.teacher.post('/videos', body({ title: 'x'.repeat(150) }))).status).toBe(201)
      const missingCategory = body()
      delete (missingCategory as Record<string, unknown>).category
      expect(fieldsOf(await api.teacher.post('/videos', missingCategory))).toEqual({ category: 'Sila pilih kategori.' })
      expect(fieldsOf(await api.teacher.post('/videos', body({ videoUrl: 'https://vimeo.com/123456' })))).toEqual({ videoUrl: 'Pautan mesti pautan YouTube yang sah.' })
      expect(fieldsOf(await api.teacher.post('/videos', body({ category: 'lain', description: 'd'.repeat(1001), subjectId: 'abc' })))).toEqual({
        category: 'Medan ini tidak sah.',
        description: 'Medan ini tidak sah.',
      })
      // The subject is checked after the body shape passes, so it is reported alone (see the subject case above).
      expect(fieldsOf(await api.teacher.post('/videos', body({ title: 42 })))).toEqual({ title: 'Medan ini tidak sah.' })
    })

    it('an admin gets the same required copy and the 150 limit; the host rule stays as it was', async () => {
      expect(fieldsOf(await api.admin.post('/videos', {}))).toEqual({
        videoUrl: 'Sila isi pautan YouTube.',
        title: 'Sila isi tajuk video.',
        category: 'Sila pilih kategori.',
      })
      expect(fieldsOf(await api.admin.post('/videos', body({ title: 'x'.repeat(151) })))).toEqual({ title: 'Tajuk video tidak boleh melebihi 150 aksara.' })
      expect(fieldsOf(await api.admin.post('/videos', body({ videoUrl: 'ftp://example.test/v' })))).toEqual({ videoUrl: 'Medan ini tidak sah.' })
    })

    it('a teacher without a school gets 422 "Anda tiada sekolah untuk dikongsi." under fields.visibility; an admin (no school) is global', async () => {
      // A teacher cannot hold a session without a school (the session is refused and revoked). The only way to reach the check is a
      // teacher whose stored scope names a school while the account itself has none: the session lives, the upload has no school.
      const schoolId = await schoolIdOf(t.db, 'DEMO001')
      const uid = await userIdOf(t.db, TEACHER)
      await t.db.query(`insert into user_scopes (user_id, role, level, school_id) values ($1::bigint, 'teacher', 'school', $2::bigint) on conflict (user_id, role) do update set level = excluded.level, school_id = excluded.school_id`, [uid, schoolId])
      await moveUser(t.db, TEACHER, null)
      try {
        const homeless = apiOf(await login(t, TEACHER))
        const res = await homeless.post('/videos', body())
        expect(fieldsOf(res)).toEqual({ visibility: 'Anda tiada sekolah untuk dikongsi.' })
        expect(errorOf(res).message).toBe('Anda tiada sekolah untuk dikongsi.')
        expect(await t.db.query(`select 1 from videos where title = 'Video contoh' and uploader_id = $1::bigint`, [uid])).toHaveLength(0)
      } finally {
        await moveUser(t.db, TEACHER, 'DEMO001')
        await t.db.query(`delete from user_scopes where user_id = $1::bigint and role = 'teacher'`, [uid])
      }
      const ctx = await admin.agent.get('/api/videos/form-context')
      expect(VideoFormContextSchema.parse(ctx.body.data).school).toBeNull()
      const created = await api.admin.post('/videos', body({ visibility: 'school' }))
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(created.body.data.visibility).toBe('global')
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

    it('the uploader edits: other fields change, the video stays school with the same share row; the body visibility is ignored; one audit row', async () => {
      const created = await api.teacher.post('/videos', body({ title: 'Untuk diubah' }))
      const vid = created.body.data.id as string
      const res = await api.teacher.put(`/videos/${vid}`, body({ title: 'Sudah diubah', visibility: 'global', videoUrl: 'https://youtu.be/abcdefghijk', category: 'ceramah' }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBe('Video berjaya dikemaskini.')
      const detail = VideoDetailSchema.parse(res.body.data)
      expect(detail).toMatchObject({ title: 'Sudah diubah', platform: 'Youtube', category: 'ceramah', visibility: 'school', embedUrl: 'https://www.youtube.com/embed/abcdefghijk' })
      expect(await t.db.query(`select 1 from video_schools where video_id = $1`, [vid])).toHaveLength(1)
      const [row] = await t.db.query<{ school_id: string | null }>(`select school_id::text from videos where id = $1`, [vid])
      expect(row?.school_id).toBe(await schoolIdOf(t.db, 'DEMO001'))
      expect(await t.db.query(`select 1 from audit_events where action = 'content.video.updated' and target_id = $1`, [vid])).toHaveLength(1)
      // Another teacher cannot see, so cannot edit, this video.
      expectError(await api.teacher2.put(`/videos/${vid}`, body()), 'NOT_FOUND')
    })

    it('only the ACTIVE role counts: a teacher+school admin account acting as school admin is refused, acting as teacher may post', async () => {
      let createdId: string | null = null
      try {
        const who = await login(t, OTHER_SCHOOL_TEACHER)
        const asAdmin = await actAs(who, 'school_admin')
        const refused = await apiOf(asAdmin).post('/videos', body())
        expectError(refused, 'FORBIDDEN', 'This action is unauthorized.')
        const allowed = await apiOf(await actAs(asAdmin, 'teacher')).post('/videos', body({ title: 'Guru peranan aktif' }))
        expect(allowed.status, JSON.stringify(allowed.body)).toBe(201)
        createdId = allowed.body.data.id as string
      } finally {
        if (createdId) {
          await t.db.query(`delete from video_schools where video_id = $1`, [createdId])
          await t.db.query(`delete from videos where id = $1`, [createdId])
        }
      }
    })

    it('a teacher of another school cannot edit or delete a school video: 404 and the row is unchanged', async () => {
      const before = await t.db.query<{ title: string; updated_at: string }>(`select title, updated_at::text from videos where id = $1`, [id.school1])
      expectError(await api.teacher2.put(`/videos/${id.school1}`, body({ title: 'Dirampas' })), 'NOT_FOUND')
      expectError(await api.teacher2.del(`/videos/${id.school1}`), 'NOT_FOUND')
      const after = await t.db.query<{ title: string; updated_at: string }>(`select title, updated_at::text from videos where id = $1`, [id.school1])
      expect(after).toEqual(before)
      expect(after).toHaveLength(1)
    })

    it('a legacy student upload shows no Edit or Padam: canManage is false for its own uploader', async () => {
      const legacy = await insertVideo(t.db, { title: 'Muat naik lama pelajar', uploader: OTHER_SCHOOL_STUDENT, createdAt: '2026-10-06T10:00:00+08:00' })
      try {
        const res = await outsider.agent.get(`/api/videos/${legacy}`)
        expect(res.status).toBe(200)
        expect(res.body.data.canManage).toBe(false)
        const asAdmin = await admin.agent.get(`/api/videos/${legacy}`)
        expect(asAdmin.body.data.canManage).toBe(true)
      } finally {
        await t.db.query(`delete from videos where id = $1`, [legacy])
      }
    })

    it('an admin edits another user video and the stored visibility and school stay the uploader ones', async () => {
      const created = await api.teacher.post('/videos', body({ title: 'Guru kongsi' }))
      const vid = created.body.data.id as string
      const res = await api.admin.put(`/videos/${vid}`, body({ title: 'Admin ubah', visibility: 'global' }))
      expect(res.status).toBe(200)
      expect(res.body.data.visibility).toBe('school')
      const shares = await t.db.query<{ school_id: string }>(`select school_id::text from video_schools where video_id = $1`, [vid])
      expect(shares).toHaveLength(1)
      const [teacherRow] = await t.db.query<{ school_id: string }>(`select school_id::text from users where lower(email) = lower($1)`, [TEACHER])
      expect(shares[0]?.school_id).toBe(teacherRow?.school_id)
      expect(res.body.data.canManage).toBe(true)
    })

    it('on update the role check (403) comes first, then 404, then validation', async () => {
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

  describe('writes are for admin and teacher only (API-MUR-05, OQ-MUR-11, AC-AS-7-4)', () => {
    const count = async () => (await t.db.query(`select 1 from videos`)).length

    it('a student gets 403 on POST, PUT and DELETE and nothing is stored or changed', async () => {
      const before = await count()
      expectError(await api.student.post('/videos', body()), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await api.student.put(`/videos/${id.global1}`, body({ title: 'Diubah murid' })), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await api.student.del(`/videos/${id.global1}`), 'FORBIDDEN', 'This action is unauthorized.')
      expect(await count()).toBe(before)
      const [row] = await t.db.query<{ title: string }>(`select title from videos where id = $1`, [id.global1])
      expect(row?.title).toBe('Global satu')
    })

    it('a school admin gets 403 on POST, PUT and DELETE', async () => {
      const before = await count()
      expectError(await api.schoolAdmin.post('/videos', body()), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await api.schoolAdmin.put(`/videos/${id.school1}`, body()), 'FORBIDDEN', 'This action is unauthorized.')
      expectError(await api.schoolAdmin.del(`/videos/${id.school1}`), 'FORBIDDEN', 'This action is unauthorized.')
      expect(await count()).toBe(before)
    })

    it('a teacher video is school + the own school whatever the body says; an admin video is global with no school', async () => {
      for (const visibility of ['global', 'school', undefined]) {
        const res = await api.teacher.post('/videos', body({ visibility, title: `Guru kes ${visibility === 'global' ? 'umum' : 'sekolah'}` }))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.data.visibility).toBe('school')
        const [row] = await t.db.query<{ visibility: string; school_id: string }>(`select visibility, school_id::text from videos where id = $1`, [res.body.data.id])
        expect(row).toEqual({ visibility: 'school', school_id: await schoolIdOf(t.db, 'DEMO001') })
      }
      for (const visibility of ['global', 'school', undefined]) {
        const res = await api.admin.post('/videos', body({ visibility, title: `Admin kes ${visibility === 'global' ? 'umum' : 'sekolah'}` }))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        const [row] = await t.db.query<{ visibility: string; school_id: string | null }>(`select visibility, school_id::text from videos where id = $1`, [res.body.data.id])
        expect(row).toEqual({ visibility: 'global', school_id: null })
        expect(await t.db.query(`select 1 from video_schools where video_id = $1`, [res.body.data.id])).toHaveLength(0)
      }
    })

    it('a teacher of another school cannot see a teacher video; a guest and a pupil of another school cannot either', async () => {
      const res = await api.teacher.post('/videos', body({ title: 'Hanya sekolah X' }))
      const vid = res.body.data.id as string
      expect((await teacher.agent.get(`/api/videos/${vid}`)).status).toBe(200)
      expect((await student.agent.get(`/api/videos/${vid}`)).status).toBe(200)
      for (const who of [teacher2.agent, outsider.agent, t.http()]) expect((await who.get(`/api/videos/${vid}`)).status).toBe(404)
      expect(idsOf(await teacher2.agent.get('/api/videos?search=Hanya%20sekolah%20X'))).toEqual([])
    })

    it('a teacher link must be a YouTube video link: everything else is 422 "Pautan mesti pautan YouTube yang sah." under videoUrl', async () => {
      for (const url of [YT, 'https://youtu.be/abcdefghijk', 'https://m.youtube.com/watch?v=abcdefghijk', 'http://www.youtube.com/watch?v=abcdefghijk', 'https://www.youtube.com/embed/abcdefghijk', 'https://www.youtube.com/shorts/abcdefghijk']) {
        const res = await api.teacher.post('/videos', body({ videoUrl: url }))
        expect(res.status, url).toBe(201)
      }
      for (const url of [
        'https://example.test/clip.mp4',
        'https://vimeo.com/123456',
        'https://evil.test/www.youtube.com/watch?v=abcdefghijk',
        'https://www.youtube.com.evil.test/watch?v=abcdefghijk',
        'https://www.youtube.com/channel/abc',
        'https://www.youtube.com/watch',
      ]) {
        expect(fieldsOf(await api.teacher.post('/videos', body({ videoUrl: url }))), url).toEqual({ videoUrl: 'Pautan mesti pautan YouTube yang sah.' })
      }
    })

    it('an admin keeps today\'s host rule: any https host is accepted', async () => {
      const res = await api.admin.post('/videos', body({ videoUrl: 'https://example.test/clip.mp4' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data.visibility).toBe('global')
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
        const sized = await other.http().get('/api/videos?pageSize=25')
        expect(sized.body.data).toHaveLength(25)
        expect(sized.body.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: 30, totalPages: 2, from: 1, to: 25 })
        expect((await other.http().get('/api/videos?pageSize=25&page=2')).body.data).toHaveLength(5)
        for (const bad of ['0', '51', 'abc', '']) expect((await other.http().get(`/api/videos?pageSize=${bad}`)).body.meta.pageSize).toBe(24)
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

    it('search also matches the description, case-insensitively', async () => {
      const vid = await insertVideo(t.db, { title: 'Tajuk biasa', uploader: ADMIN })
      await t.db.query(`update videos set description = $2 where id = $1`, [vid, 'Penerangan tentang Nukleus Sel'])
      const titles = async (q: string) => ((await t.http().get(`/api/videos?search=${encodeURIComponent(q)}`)).body.data as { title: string }[]).map((v) => v.title)
      expect(await titles('nukleus')).toEqual(['Tajuk biasa'])
      expect(await titles('NUKLEUS SEL')).toEqual(['Tajuk biasa'])
      expect(await titles('tajuk biasa')).toEqual(['Tajuk biasa'])
      expect(await titles('tiada padanan')).toEqual([])
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
      expectError(third, 'RATE_LIMITED', 'Terlalu banyak percubaan. Sila cuba sebentar lagi.')
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
      expectError(await t.http().get('/api/videos'), 'RATE_LIMITED', 'Terlalu banyak percubaan. Sila cuba sebentar lagi.')
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
