import { ScreenshotFileSchema, ScreenshotUploadResultSchema } from '@pp/contract'
import type { Test } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makeJpeg, makePdf, makePng, makeWebp } from '../files/fixtures'
import { storedBaseName, storedNames } from '../../src/modules/content/screenshots/screenshots.service'
import { ADMIN, SCHOOL_ADMIN, STUDENT, TEACHER, apiFor, bootCmsApp, errorOf, type Api, type CmsApp } from './cms-helpers'

let t: CmsApp
let admin: Api & { agent: ReturnType<CmsApp['agent']>; csrf: string }

beforeAll(async () => {
  t = await bootCmsApp()
  admin = await apiFor(t, ADMIN)
}, 120_000)
afterAll(async () => {
  await t.close()
})

interface Part {
  name: string
  bytes?: Buffer
  type?: string
}
function upload(parts: Part[], field = 'files[]'): Test {
  let req = admin.agent.post('/api/admin/screenshots').set('X-CSRF-Token', admin.csrf)
  for (const p of parts) req = req.attach(field, p.bytes ?? makePng(), { filename: p.name, contentType: p.type ?? 'image/png' })
  return req
}
const count = async (): Promise<number> => Number((await t.db.query<{ n: string }>('select count(*)::text as n from screenshots'))[0]?.n)

describe('name rules', () => {
  it('stores a lower-case, hyphenated, safe name; a clash gets -1, -2; an empty name becomes screenshot-<id>', () => {
    expect(storedBaseName('Skrin Saya (1).PNG')).toBe('skrin-saya-1.png')
    expect(storedBaseName('..Foto Baru.png')).toBe('foto-baru.png')
    expect(storedBaseName('$$$.png')).toBe('')
    expect(storedBaseName(`${'a'.repeat(300)}.png`)).toHaveLength(120)
    expect(storedBaseName(`${'a'.repeat(300)}.png`).endsWith('.png')).toBe(true)
    const names = storedNames([
      { id: 1n, originalName: 'Skrin Saya (1).PNG', mime: 'image/png' },
      { id: 2n, originalName: 'skrin saya (1).png', mime: 'image/png' },
      { id: 3n, originalName: 'skrin saya (1).png', mime: 'image/png' },
      { id: 4n, originalName: '$$$.png', mime: 'image/png' },
    ])
    expect([...names.values()]).toEqual(['skrin-saya-1.png', 'skrin-saya-1-1.png', 'skrin-saya-1-2.png', 'screenshot-4.png'])
  })
})

describe('AC 8 access', () => {
  it('401 without a session, 403 for other roles, 403 CSRF_INVALID without the token; nothing is stored', async () => {
    errorOf(await t.http().get('/api/admin/screenshots'), 401, 'UNAUTHORIZED')
    errorOf(await t.http().post('/api/admin/screenshots'), 401, 'UNAUTHORIZED')
    for (const who of [STUDENT, TEACHER, SCHOOL_ADMIN]) {
      const api = await apiFor(t, who)
      errorOf(await api.get('/admin/screenshots'), 403, 'FORBIDDEN')
      errorOf(await api.agent.post('/api/admin/screenshots').set('X-CSRF-Token', api.csrf).attach('files[]', makePng(), { filename: 'a.png', contentType: 'image/png' }), 403, 'FORBIDDEN')
    }
    errorOf(await admin.agent.post('/api/admin/screenshots').attach('files[]', makePng(), { filename: 'a.png', contentType: 'image/png' }), 403, 'CSRF_INVALID')
    expect(await count()).toBe(0)
    expect((await admin.get('/admin/screenshots')).headers['cache-control']).toBe('no-store')
  })
})

describe('GET and POST /admin/screenshots', () => {
  it('starts empty', async () => {
    const res = await admin.get('/admin/screenshots')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })

  it('AC 7 saves images through BE-04 (purpose cms_screenshot) under safe names', async () => {
    const res = await upload([{ name: 'Skrin Saya (1).PNG' }, { name: 'skrin saya (1).png', bytes: makePng({ width: 3 }) }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('2 fail berjaya dimuat naik.')
    const out = ScreenshotUploadResultSchema.parse(res.body.data)
    expect(out.rejected).toEqual([])
    expect(out.saved.map((s) => s.fileName)).toEqual(['skrin-saya-1.png', 'skrin-saya-1-1.png'])
    expect(out.saved[0]).toMatchObject({ originalName: 'Skrin Saya (1).PNG', mimeType: 'image/png' })
    expect(out.saved[0]?.url).toMatch(/^\/api\/files\/[A-Za-z0-9_-]{22}$/)
    const [adm] = await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`)
    expect(out.saved[0]?.uploadedById).toBe(adm?.id)
    const rows = await t.db.query<{ purpose: string; owner: string }>(`select f.purpose, f.owner_user_id::text as owner from screenshots s join files f on f.id = s.file_id`)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.purpose === 'cms_screenshot' && r.owner === adm?.id)).toBe(true)
  })

  it('the stored file is served by BE-04 with the detected type', async () => {
    const [s] = (await admin.get('/admin/screenshots')).body.data as Array<{ url: string }>
    const res = await admin.agent.get(s?.url ?? '/x')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/png/)
  })

  it('lists newest first with the total', async () => {
    const res = await admin.get('/admin/screenshots')
    expect(res.body.meta.total).toBe(2)
    expect((res.body.data as Array<{ fileName: string }>).map((s) => s.fileName)).toEqual(['skrin-saya-1-1.png', 'skrin-saya-1.png'])
    for (const s of res.body.data) ScreenshotFileSchema.parse(s)
  })

  it('a refused file is listed in rejected and does not block the others', async () => {
    const res = await upload([
      { name: 'foto.webp', bytes: makeWebp(), type: '' },
      { name: 'dokumen.pdf', bytes: makePdf(), type: 'application/pdf' },
      { name: 'palsu.html', type: 'image/png' },
      { name: 'padanan.png', type: 'image/jpeg' },
      { name: 'teks.png', bytes: Buffer.from('<script>alert(1)</script>') },
      { name: 'kecil.jpg', bytes: makeJpeg(), type: 'image/jpeg' },
    ])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('2 fail berjaya dimuat naik.')
    expect(res.body.data.saved.map((s: { fileName: string }) => s.fileName)).toEqual(['foto.webp', 'kecil.jpg'])
    expect(res.body.data.rejected).toEqual([
      { name: 'dokumen.pdf', reason: 'dokumen.pdf: format atau saiz tidak dibenarkan.' },
      { name: 'palsu.html', reason: 'palsu.html: format atau saiz tidak dibenarkan.' },
      { name: 'padanan.png', reason: 'padanan.png: format atau saiz tidak dibenarkan.' },
      { name: 'teks.png', reason: 'teks.png: format atau saiz tidak dibenarkan.' },
    ])
  })

  it('422 with the type message when no file is saved; nothing is written', async () => {
    const before = await count()
    const res = await upload([{ name: 'dokumen.pdf', bytes: makePdf(), type: 'application/pdf' }])
    const e = errorOf(res, 422, 'VALIDATION_ERROR', 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.')
    expect(e.fields).toEqual({ files: 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.' })
    expect(await count()).toBe(before)
  })

  it('a GIF is refused per file because BE-04 stores jpeg, png, webp only (deviation log)', async () => {
    const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)])
    const res = await upload([{ name: 'anim.gif', bytes: gif, type: 'image/gif' }, { name: 'ok.png' }])
    expect(res.status).toBe(201)
    expect(res.body.data.rejected.map((r: { name: string }) => r.name)).toEqual(['anim.gif'])
  })

  it('a name that sanitises to nothing becomes screenshot-<id>.<ext>', async () => {
    const res = await upload([{ name: '$$$.png' }])
    expect(res.body.data.saved[0].fileName).toBe(`screenshot-${res.body.data.saved[0].id as string}.png`)
  })

  it('422 for no file at all, for non-multipart, and for more than 20', async () => {
    const none = await admin.agent.post('/api/admin/screenshots').set('X-CSRF-Token', admin.csrf).field('x', '1')
    expect(errorOf(none, 422, 'VALIDATION_ERROR').fields).toEqual({ files: 'Medan ini diperlukan.' })
    const json = await admin.post('/admin/screenshots', {})
    expect(errorOf(json, 422, 'VALIDATION_ERROR').fields).toEqual({ files: 'Medan ini diperlukan.' })
    const before = await count()
    const many = await upload(Array.from({ length: 21 }, (_, i) => ({ name: `f${String(i)}.png` })))
    expect(errorOf(many, 422, 'VALIDATION_ERROR').fields).toEqual({ files: 'Maksimum 20 fail setiap muat naik.' })
    const huge = await upload(Array.from({ length: 30 }, (_, i) => ({ name: `g${String(i)}.png` })))
    expect(errorOf(huge, 422, 'VALIDATION_ERROR').fields).toEqual({ files: 'Maksimum 20 fail setiap muat naik.' })
    expect(await count()).toBe(before)
    const twenty = await upload(Array.from({ length: 20 }, (_, i) => ({ name: `h${String(i)}.png` })))
    expect(twenty.status, JSON.stringify(twenty.body)).toBe(201)
    expect(twenty.body.data.saved).toHaveLength(20)
  })

  it('a file over 10 MB is refused with 422', async () => {
    const big = Buffer.concat([makePng(), Buffer.alloc(10 * 1024 * 1024 + 1)])
    const res = await upload([{ name: 'besar.png', bytes: big }])
    errorOf(res, 422, 'VALIDATION_ERROR', 'Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB.')
  })

  it('a field name other than files[] / files is ignored', async () => {
    const res = await upload([{ name: 'a.png' }], 'gambar')
    errorOf(res, 422, 'VALIDATION_ERROR')
  })

  it('stores a screenshot with purpose cms_screenshot, readable by an admin only (student and teacher 404, anonymous 401)', async () => {
    const res = await upload([{ name: 'rahsia.png' }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const url = res.body.data.saved[0].url as string
    const [row] = await t.db.query<{ purpose: string }>(`select purpose from files where public_id = $1`, [url.split('/').pop()])
    expect(row?.purpose).toBe('cms_screenshot')
    const adminRead = await admin.agent.get(url)
    expect(adminRead.status).toBe(200)
    expect(adminRead.headers['content-type']).toMatch(/image\/png/)
    for (const who of [STUDENT, TEACHER, SCHOOL_ADMIN]) {
      const api = await apiFor(t, who)
      errorOf(await api.agent.get(url), 404, 'NOT_FOUND')
    }
    errorOf(await t.http().get(url), 401, 'UNAUTHORIZED')
  })

  it('a screenshot file cannot be used as an article or banner image', async () => {
    const res = await upload([{ name: 'bukan-gambar-umum.png' }])
    const url = `https://app.example${res.body.data.saved[0].url as string}`
    const art = await admin.post('/admin/articles', { title: 'Guna Tangkapan', content: '<p>x</p>', category: 'UMUM', featuredImage: url })
    expect(art.status).toBe(422)
    expect(art.body.error.fields).toHaveProperty('featuredImage', 'Medan ini tidak sah.')
    const ban = await admin.post('/admin/banners', { title: 'Guna Tangkapan', bannerType: 'HERO', imageUrl: url })
    expect(ban.status).toBe(422)
    expect(ban.body.error.fields).toHaveProperty('imageUrl', 'Medan ini tidak sah.')
  })

  it('a 3 MB image is saved now (the cms_screenshot limit is 10 MB); a BMP is rejected', async () => {
    const png3 = makePng({ padTo: 3 * 1024 * 1024 })
    const bmp = Buffer.concat([Buffer.from('BM'), Buffer.alloc(60)])
    const res = await upload([{ name: 'tiga-mb.png', bytes: png3 }, { name: 'lama.bmp', bytes: bmp, type: 'image/bmp' }])
    expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(201)
    expect(res.body.data.saved.map((s: { fileName: string }) => s.fileName)).toEqual(['tiga-mb.png'])
    expect(res.body.data.saved[0].size).toBeGreaterThan(3 * 1024 * 1024 - 1000)
    expect(res.body.data.rejected.map((r: { name: string }) => r.name)).toEqual(['lama.bmp'])
  })

  it('every saved file is audited without its name', async () => {
    const rows = await t.db.query<{ detail: unknown }>(`select detail from audit_events where action = 'content.screenshot.uploaded'`)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(rows)).not.toContain('Skrin')
  })
})
