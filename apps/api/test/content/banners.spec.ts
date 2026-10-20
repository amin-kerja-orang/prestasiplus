import { ActiveBannerSchema, AdminBannerSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
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

// The fixed clock is 2026-10-19 09:00 MYT.
const BANNER = {
  title: 'Promosi Ujian',
  description: 'Penerangan banner',
  bannerType: 'promo',
  linkType: 'external',
  externalUrl: 'https://example.com/pergi',
  targetAudience: 'teacher',
  displayOrder: 0,
  startDate: '2026-09-01',
  endDate: '2026-12-31',
  isActive: true,
}

async function titlesFor(who: string): Promise<string[]> {
  const api = await apiFor(t, who)
  const res = await api.get('/banners/active')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  for (const b of res.body.data) ActiveBannerSchema.parse(b)
  return (res.body.data as Array<{ title: string }>).map((b) => b.title)
}

async function insertBanner(o: { title: string; audience?: string; active?: boolean; start?: string | null; end?: string | null; order?: number }): Promise<void> {
  await t.db.query(
    `insert into banners (title, banner_type, target_audience, is_active, start_date, end_date, display_order) values ($1, 'HERO', $2, $3, $4, $5, $6)`,
    [o.title, o.audience ?? 'ALL', o.active ?? true, o.start ?? null, o.end ?? null, o.order ?? 0],
  )
}

describe('AC 8 access', () => {
  it('admin routes: 401 without a session, 403 for other roles, 403 CSRF_INVALID without the token', async () => {
    errorOf(await t.http().get('/api/admin/banners'), 401, 'UNAUTHORIZED')
    errorOf(await t.http().post('/api/admin/banners').send(BANNER), 401, 'UNAUTHORIZED')
    for (const who of [STUDENT, TEACHER, SCHOOL_ADMIN]) {
      const api = await apiFor(t, who)
      for (const res of [await api.get('/admin/banners'), await api.get('/admin/banners/1'), await api.post('/admin/banners', BANNER), await api.put('/admin/banners/1', {}), await api.del('/admin/banners/1')]) {
        errorOf(res, 403, 'FORBIDDEN')
      }
    }
    errorOf(await admin.agent.post('/api/admin/banners').send(BANNER), 403, 'CSRF_INVALID')
    errorOf(await admin.agent.delete('/api/admin/banners/1'), 403, 'CSRF_INVALID')
  })

  it('GET /banners/active needs a session (401) and is no-store', async () => {
    errorOf(await t.http().get('/api/banners/active'), 401, 'UNAUTHORIZED')
    expect((await admin.get('/banners/active')).headers['cache-control']).toBe('no-store')
  })
})

describe('AC 1 the carousel honours is_active, the date window and the audience', () => {
  it('delivers only active banners inside their window, in displayOrder then id order', async () => {
    await insertBanner({ title: 'Aktif B', order: 2 })
    await insertBanner({ title: 'Aktif A', order: 1 })
    await insertBanner({ title: 'Tidak Aktif', active: false })
    await insertBanner({ title: 'Belum Bermula', start: '2026-10-20' })
    await insertBanner({ title: 'Sudah Tamat', end: '2026-10-18' })
    await insertBanner({ title: 'Mula Hari Ini', start: '2026-10-19', end: '2026-10-19', order: 3 })
    await insertBanner({ title: 'Tamat Hari Ini', end: '2026-10-19', order: 4 })
    expect(await titlesFor(STUDENT)).toEqual(['Aktif A', 'Aktif B', 'Mula Hari Ini', 'Tamat Hari Ini'])
  })

  it('the window follows Malaysia time: 00:30 MYT on the 20th (still the 19th in UTC) shows a banner starting on the 20th', async () => {
    t.clock.set('2026-10-20T00:30:00+08:00')
    expect(await titlesFor(STUDENT)).toContain('Belum Bermula')
    expect(await titlesFor(STUDENT)).not.toContain('Tamat Hari Ini')
    t.clock.set('2026-10-19T09:00:00+08:00')
  })

  it('the audience: ALL for everyone, a role sees its own, admin sees every audience, a school admin ALL only', async () => {
    await insertBanner({ title: 'Untuk Pelajar', audience: 'STUDENT', order: 10 })
    await insertBanner({ title: 'Untuk Guru', audience: 'TEACHER', order: 11 })
    await insertBanner({ title: 'Untuk Admin', audience: 'ADMIN', order: 12 })
    const student = await titlesFor(STUDENT)
    expect(student).toContain('Untuk Pelajar')
    expect(student).not.toContain('Untuk Guru')
    expect(student).not.toContain('Untuk Admin')
    const teacher = await titlesFor(TEACHER)
    expect(teacher).toContain('Untuk Guru')
    expect(teacher).not.toContain('Untuk Pelajar')
    expect(await titlesFor(ADMIN)).toEqual(expect.arrayContaining(['Untuk Pelajar', 'Untuk Guru', 'Untuk Admin']))
    const school = await titlesFor(SCHOOL_ADMIN)
    expect(school).not.toContain('Untuk Pelajar')
    expect(school).not.toContain('Untuk Guru')
    expect(school).not.toContain('Untuk Admin')
    expect(school).toContain('Aktif A')
  })

  it('the item exposes type, title and description only', async () => {
    const res = await (await apiFor(t, STUDENT)).get('/banners/active')
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['description', 'title', 'type'])
    expect(res.body.meta).toMatchObject({ page: 1, totalPages: 1 })
  })
})

describe('admin banners', () => {
  let id: string

  it('creates a banner with the codes upper-cased, 201 and the flash', async () => {
    const res = await admin.post('/admin/banners', BANNER)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('Banner berjaya ditambah.')
    const b = AdminBannerSchema.parse(res.body.data)
    expect(b).toMatchObject({ bannerType: 'PROMO', linkType: 'EXTERNAL', targetAudience: 'TEACHER', externalUrl: 'https://example.com/pergi', startDate: '2026-09-01', endDate: '2026-12-31', isActive: true, imageUrl: null })
    id = b.id
    expect(await titlesFor(TEACHER)).toContain('Promosi Ujian')
    expect(await titlesFor(STUDENT)).not.toContain('Promosi Ujian')
  })

  it('applies the form defaults and drops externalUrl unless the link type is EXTERNAL', async () => {
    const res = await admin.post('/admin/banners', { title: 'Minimum', bannerType: 'EVENT', externalUrl: 'https://example.com/x' })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ linkType: 'NONE', targetAudience: 'ALL', displayOrder: 0, isActive: true, externalUrl: null, imageUrl: null, startDate: null, endDate: null })
  })

  it('422 with a message per field and nothing written', async () => {
    const before = (await t.db.query<{ n: string }>('select count(*)::text as n from banners'))[0]?.n
    const res = await admin.post('/admin/banners', { title: '', bannerType: 'FEATURE', linkType: 'EXTERNAL', targetAudience: 'PARENT', imageUrl: 'tiada', displayOrder: -1, startDate: '2026-12-31', endDate: '2026-01-01' })
    expect(Object.keys(fieldsOf(res))).toEqual(expect.arrayContaining(['title', 'bannerType', 'targetAudience', 'imageUrl', 'displayOrder']))
    expect(fieldsOf(await admin.post('/admin/banners', { title: 'T' }))).toHaveProperty('bannerType')
    expect(fieldsOf(await admin.post('/admin/banners', { title: 'T', bannerType: 'HERO', linkType: 'EXTERNAL' }))).toHaveProperty('externalUrl', 'Medan ini diperlukan.')
    expect(fieldsOf(await admin.post('/admin/banners', { title: 'T', bannerType: 'HERO', description: 'x'.repeat(5001) }))).toHaveProperty('description')
    expect((await t.db.query<{ n: string }>('select count(*)::text as n from banners'))[0]?.n).toBe(before)
  })

  it('updates: absent fields keep their value, deactivation and an ended window remove it from the carousel', async () => {
    const off = await admin.put(`/admin/banners/${id}`, { isActive: false })
    expect(off.status).toBe(200)
    expect(off.body.status).toBe('Banner berjaya dikemaskini.')
    expect(off.body.data).toMatchObject({ isActive: false, title: 'Promosi Ujian', bannerType: 'PROMO', externalUrl: 'https://example.com/pergi' })
    expect(await titlesFor(TEACHER)).not.toContain('Promosi Ujian')
    await admin.put(`/admin/banners/${id}`, { isActive: true, targetAudience: 'student' })
    expect(await titlesFor(STUDENT)).toContain('Promosi Ujian')
    await admin.put(`/admin/banners/${id}`, { startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(await titlesFor(STUDENT)).not.toContain('Promosi Ujian')
    const bad = await admin.put(`/admin/banners/${id}`, { startDate: '2027-01-01' })
    expect(fieldsOf(bad)).toHaveProperty('endDate')
  })

  it('moving away from EXTERNAL clears the URL; an EXTERNAL banner needs one', async () => {
    const none = await admin.put(`/admin/banners/${id}`, { linkType: 'NONE' })
    expect(none.body.data).toMatchObject({ linkType: 'NONE', externalUrl: null })
    expect(fieldsOf(await admin.put(`/admin/banners/${id}`, { linkType: 'EXTERNAL' }))).toHaveProperty('externalUrl', 'Medan ini diperlukan.')
  })

  it('a banner may keep its own stored code but no other banner may use a code outside the form list', async () => {
    const same = await admin.put(`/admin/banners/${id}`, { bannerType: 'PROMO', title: 'Sama Kod' })
    expect(same.status).toBe(200)
    expect(fieldsOf(await admin.put(`/admin/banners/${id}`, { bannerType: 'FEATURE' }))).toHaveProperty('bannerType', 'Medan ini tidak sah.')
  })

  it('404 with the screen copy for an unknown or malformed id; delete answers 200 { deleted: 1 }', async () => {
    errorOf(await admin.get('/admin/banners/999999'), 404, 'NOT_FOUND', 'Banner tidak dijumpai.')
    errorOf(await admin.put('/admin/banners/999999', {}), 404, 'NOT_FOUND', 'Banner tidak dijumpai.')
    errorOf(await admin.del('/admin/banners/abc'), 404, 'NOT_FOUND')
    const res = await admin.del(`/admin/banners/${id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Banner berjaya dipadam.' })
    errorOf(await admin.get(`/admin/banners/${id}`), 404, 'NOT_FOUND')
  })

  it('lists every banner unpaged, ordered by displayOrder then id', async () => {
    const res = await admin.get('/admin/banners')
    expect(res.status).toBe(200)
    const keys = (res.body.data as Array<{ displayOrder: number; id: string }>).map((b) => [b.displayOrder, BigInt(b.id)] as const)
    const sorted = [...keys].sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1))
    expect(keys).toEqual(sorted)
    expect(res.body.meta.totalItems).toBe(keys.length)
  })

  it('writes are audited', async () => {
    const rows = await t.db.query<{ action: string }>(`select action from audit_events where action like 'content.banner.%' order by id`)
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['content.banner.created', 'content.banner.updated', 'content.banner.deleted']))
  })
})

describe('AC 7 banner image goes through BE-04 (cms_image)', () => {
  it('accepts the download URL of a cms_image and returns it; refuses any other URL', async () => {
    const up = await admin.agent.post('/api/files?purpose=cms_image').set('X-CSRF-Token', admin.csrf).attach('file', makePng(), { filename: 'b.png', contentType: 'image/png' })
    expect(up.status).toBe(201)
    const ok = await admin.post('/admin/banners', { title: 'Ada Gambar', bannerType: 'HERO', imageUrl: `https://app.example${up.body.data.url as string}` })
    expect(ok.status, JSON.stringify(ok.body)).toBe(201)
    expect(ok.body.data.imageUrl).toBe(up.body.data.url)
    const [row] = await t.db.query<{ image_file_id: string | null }>(`select image_file_id::text from banners where id = $1`, [ok.body.data.id])
    expect(row?.image_file_id).not.toBeNull()
    expect(fieldsOf(await admin.post('/admin/banners', { title: 'Luar', bannerType: 'HERO', imageUrl: 'https://example.com/b.jpg' }))).toHaveProperty('imageUrl')
    const cleared = await admin.put(`/admin/banners/${ok.body.data.id as string}`, { imageUrl: null })
    expect(cleared.body.data.imageUrl).toBeNull()
  })
})
