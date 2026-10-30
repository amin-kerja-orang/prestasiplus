import { AdminNoteDetailSchema, AdminNoteItemSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, SCHOOL_ADMIN, STUDENT, TEACHER, apiFor, bootCmsApp, errorOf, fieldsOf, type Api, type CmsApp } from './cms-helpers'

let t: CmsApp
let admin: Api & { agent: ReturnType<CmsApp['agent']>; csrf: string }

beforeAll(async () => {
  t = await bootCmsApp()
  admin = await apiFor(t, ADMIN)
}, 120_000)
afterAll(async () => {
  await t.close()
})

const NOTE = { title: 'Nota Ujian', summary: 'Ringkasan nota', content: '<p>Isi</p>', subject: 'sejarah', noteType: 'LENGKAP', grade: 'TINGKATAN_4', isPublished: true }

describe('AC 8 access', () => {
  it('401 without a session, 403 for other roles, 403 CSRF_INVALID without the token', async () => {
    errorOf(await t.http().get('/api/admin/notes'), 401, 'UNAUTHORIZED')
    for (const who of [STUDENT, TEACHER, SCHOOL_ADMIN]) {
      const api = await apiFor(t, who)
      for (const res of [await api.get('/admin/notes'), await api.get('/admin/notes/1'), await api.post('/admin/notes', NOTE), await api.put('/admin/notes/1', {}), await api.del('/admin/notes/1')]) {
        errorOf(res, 403, 'FORBIDDEN')
      }
    }
    errorOf(await admin.agent.post('/api/admin/notes').send(NOTE), 403, 'CSRF_INVALID')
    expect((await admin.get('/admin/notes')).headers['cache-control']).toBe('no-store')
  })

  it('there is no public notes reader', async () => {
    expect((await t.http().get('/api/notes')).status).toBe(404)
  })
})

describe('admin notes', () => {
  let id: string

  it('creates a note: 201, flash, counters 0, author is the session user, listed last', async () => {
    const res = await admin.post('/admin/notes', NOTE)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('Nota berjaya ditambah.')
    const n = AdminNoteDetailSchema.parse(res.body.data)
    expect(n).toMatchObject({ subjectLabel: 'Sejarah', gradeLabel: 'Tingkatan 4', views: 0, downloads: 0, content: '<p>Isi</p>' })
    const [adm] = await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`)
    expect(n.author.id).toBe(adm?.id)
    id = n.id
    const second = await admin.post('/admin/notes', { ...NOTE, title: 'Kedua' })
    const list = await admin.get('/admin/notes')
    expect((list.body.data as Array<{ id: string }>).map((x) => x.id)).toEqual([id, second.body.data.id])
    for (const item of list.body.data) AdminNoteItemSchema.parse(item)
    expect(list.body.meta).toMatchObject({ pageSize: 20, totalItems: 2 })
  })

  it('normalises the case of the codes before checking them', async () => {
    const res = await admin.post('/admin/notes', { ...NOTE, subject: 'SAINS', noteType: 'tips_tricks', grade: 'tingkatan_5', isPublished: false })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data).toMatchObject({ subject: 'sains', noteType: 'TIPS_TRICKS', grade: 'TINGKATAN_5', isPublished: false })
  })

  it('422 with a message per field', async () => {
    const res = await admin.post('/admin/notes', { title: ' ', content: '', subject: 'geografi', noteType: 'MIND_MAP', grade: 'DARJAH_5' })
    expect(Object.keys(fieldsOf(res)).sort()).toEqual(['content', 'grade', 'noteType', 'subject', 'title'])
    expect(Object.keys(fieldsOf(await admin.post('/admin/notes', {}))).sort()).toEqual(['content', 'grade', 'noteType', 'subject', 'title'])
  })

  it('sanitises the content on create and on update (script and onerror removed from stored and returned body)', async () => {
    const dirty = '<p>Nota</p><script>alert(1)</script><img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA" onerror="alert(2)"><SCRIPT>alert(3)</SCRIPT>'
    const res = await admin.post('/admin/notes', { ...NOTE, title: 'Kotor', content: dirty })
    for (const body of [res.body.data.content as string, (await t.db.query<{ content: string }>(`select content from notes where id = $1`, [res.body.data.id]))[0]?.content ?? '']) {
      expect(body).not.toMatch(/<script/i)
      expect(body).not.toMatch(/onerror/i)
      expect(body).toContain('Nota')
    }
    const up = await admin.put(`/admin/notes/${res.body.data.id as string}`, { content: dirty })
    expect(up.body.data.content).not.toMatch(/<script|onerror/i)
  })

  it('updates keep the counters and the author; absent fields keep their value', async () => {
    await t.db.query(`update notes set views = 9, downloads = 4 where id = $1`, [id])
    const res = await admin.put(`/admin/notes/${id}`, { title: 'Nota Dikemaskini', isPublished: false })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Nota berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({ title: 'Nota Dikemaskini', isPublished: false, views: 9, downloads: 4, subject: 'sejarah', noteType: 'LENGKAP', content: '<p>Isi</p>' })
    expect(fieldsOf(await admin.put(`/admin/notes/${id}`, { title: '' }))).toHaveProperty('title')
  })

  it('a stored type that the form cannot create is kept on an edit that does not touch it', async () => {
    const [row] = await t.db.query<{ id: string }>(
      `insert into notes (title, content, subject, note_type, grade, author_id) values ('Peta Minda', '<p>x</p>', 'sains', 'MIND_MAP', 'DARJAH_1', (select id from users where email = 'admin@demo.test')) returning id::text`,
    )
    const res = await admin.put(`/admin/notes/${row?.id as string}`, { title: 'Peta Minda 2' })
    expect(res.body.data.noteType).toBe('MIND_MAP')
  })

  it('filters by subject, mapped note type and title search; page size is 20', async () => {
    const q = async (s: string) => (await admin.get(`/admin/notes?${s}`)).body.meta.totalItems as number
    expect(await q('subject=sains')).toBeGreaterThanOrEqual(2)
    expect(await q('subject=nope')).toBe(0)
    expect(await q('subject=all')).toBe(await q(''))
    expect(await q('noteType=mind_map')).toBe(1)
    expect(await q('noteType=full_notes')).toBeGreaterThanOrEqual(1)
    expect(await q('noteType=garbage')).toBe(await q(''))
    expect(await q('search=PETA')).toBe(1)
    const many = Array.from({ length: 21 }, (_, i) => `('Banyak ${String(i)}', '<p>x</p>', 'sains', 'RINGKASAN', 'DARJAH_1', (select id from users where email = 'admin@demo.test'))`).join(',')
    await t.db.query(`insert into notes (title, content, subject, note_type, grade, author_id) values ${many}`)
    const p2 = await admin.get('/admin/notes?search=Banyak&page=2')
    expect(p2.body.data).toHaveLength(1)
    expect(p2.body.meta).toMatchObject({ page: 2, totalItems: 21, totalPages: 2, from: 21, to: 21 })
    expect((await admin.get('/admin/notes?page=zzz')).body.meta.page).toBe(1)
  })

  it('404 with the note copy; delete answers 200 { deleted: 1 }; writes are audited', async () => {
    errorOf(await admin.get('/admin/notes/999999'), 404, 'NOT_FOUND', 'Nota tidak dijumpai.')
    errorOf(await admin.put('/admin/notes/abc', {}), 404, 'NOT_FOUND', 'Nota tidak dijumpai.')
    const res = await admin.del(`/admin/notes/${id}`)
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Nota berjaya dipadam.' })
    errorOf(await admin.del(`/admin/notes/${id}`), 404, 'NOT_FOUND', 'Nota tidak dijumpai.')
    const actions = (await t.db.query<{ action: string }>(`select action from audit_events where target_id = $1 order by id`, [id])).map((r) => r.action)
    expect(actions).toEqual(['content.note.created', 'content.note.updated', 'content.note.deleted'])
  })
})
