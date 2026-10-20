import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ErrorBodySchema, PERFORMANCE_TIMELINE_MESSAGES as MSG, PerformanceTimelinePostSchema, PerformanceTimelineSchema, envelopeOf } from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DEMO_PASSWORD, expectCsrfInvalid, expectError } from '../../../curriculum/helpers'
import { makeJpeg, makePng, makeWebp } from '../../../files/fixtures'
import { bootHeadcountWorld, type HeadcountWorld } from './headcount-boot'

/**
 * POST /timeline and GET /timeline (BE-19, Part C) on a real database and a temp file folder: multipart, magic-byte
 * spoofing, caption and photo limits, CSRF, 401/403, own-posts-only, test posts, the 200-post cap and the rate limit.
 * Each describe uses its own pupil so the 10 posts per minute limit of one user is never shared.
 * Needs a database: run with `npm run test -w @pp/api -- test/reports/performance/http/timeline.spec.ts --maxWorkers=1`.
 */

let w: HeadcountWorld
let dir: string

interface Session {
  agent: ReturnType<HeadcountWorld['agent']>
  csrf: string
  userId: string
}

async function login(email: string): Promise<Session> {
  const agent = w.agent()
  const res = await agent.post('/api/auth/login').send({ identifier: email, password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return { agent, csrf: res.body.data.csrf as string, userId: res.body.data.user.id as string }
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pp-timeline-test-'))
  w = await bootHeadcountWorld({ FILE_STORAGE_DIR: dir, UPLOAD_RATE_PER_MINUTE: '1000', FILE_READS_PER_MINUTE: '10000' })
}, 180_000)
// The 10 posts per minute window is per process and follows the fixed clock: a new minute for every test.
beforeEach(() => {
  w.clock.advance(61_000)
})
afterAll(async () => {
  await w?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

interface Part {
  bytes: Buffer
  name?: string
  type?: string
  field?: string
}
const fields = { title: 'Johan kuiz matematik', category: 'pencapaian' }

function post(s: Session, text: Record<string, string> | null, parts: Part[], csrf = true) {
  let r = s.agent.post('/api/timeline')
  if (csrf) r = r.set('X-CSRF-Token', s.csrf)
  for (const [k, v] of Object.entries(text ?? {})) r = r.field(k, v)
  for (const p of parts) r = r.attach(p.field ?? 'photos', p.bytes, { filename: p.name ?? 'gambar.png', contentType: p.type ?? 'image/png' })
  return r
}
const png = (): Part => ({ bytes: makePng() })
const noStore = (res: Response): void => expect(String(res.headers['cache-control'])).toContain('no-store')
const countPosts = async (userId: string): Promise<number> =>
  Number((await w.db.query<{ n: string }>(`select count(*)::text as n from timeline_posts where user_id = $1`, [userId]))[0]?.n)
const countFiles = async (): Promise<number> =>
  Number((await w.db.query<{ n: string }>(`select count(*)::text as n from files where purpose = 'timeline_photo'`))[0]?.n)
const bodyError = (res: Response) => ErrorBodySchema.parse(res.body).error

describe('authentication, roles and CSRF', () => {
  it('answers 401 without a session on GET and POST', async () => {
    expectError(await w.http().get('/api/timeline'), 'UNAUTHORIZED')
    const res = await w.http().post('/api/timeline').field('title', 'x').attach('photos', makePng(), 'a.png')
    expectError(res, 'UNAUTHORIZED')
  })

  it('a teacher, a school admin, a parent and an admin outside Mod Pelajar get 403 on POST, before any body is read', async () => {
    for (const email of ['guru@demo.test', 'adminsekolah@demo.test', 'ibubapa@demo.test', 'admin@demo.test']) {
      const s = await login(email)
      const before = await countFiles()
      expectError(await post(s, fields, [png()]), 'FORBIDDEN', 'This action is unauthorized.')
      expect(await countFiles()).toBe(before)
    }
  })

  it('a POST without the CSRF token is CSRF_INVALID and stores nothing', async () => {
    const s = await login('ujian1@demo.test')
    const before = await countPosts(s.userId)
    expectCsrfInvalid(await post(s, fields, [png()], false))
    expect(await countPosts(s.userId)).toBe(before)
  })

  it('GET /timeline is open to every signed-in role and answers its own (empty) list', async () => {
    for (const email of ['guru@demo.test', 'adminsekolah@demo.test', 'ibubapa@demo.test', 'admin@demo.test', 'ujian3@demo.test']) {
      const s = await login(email)
      const res = await s.agent.get('/api/timeline')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      noStore(res)
      const data = envelopeOf(PerformanceTimelineSchema).parse(res.body).data
      expect(data.profileUrl).toBe(`/pelajar/${s.userId}`)
      expect(data.posts).toEqual([])
    }
  })
})

describe('a student posts and reads the timeline', () => {
  it('creates a post with 2 photos and captions (201), stores the files, and lists it newest first', async () => {
    const s = await login('pelajar@demo.test')
    const files0 = await countFiles()
    const res = await post(
      s,
      { ...fields, eventDate: '2026-08-14', story: 'Mewakili sekolah.', 'captions[0]': '  Di pentas  ', 'captions[1]': '' },
      [png(), { bytes: makeJpeg(), name: 'b.jpg', type: 'image/jpeg' }],
    )
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    noStore(res)
    const created = envelopeOf(PerformanceTimelinePostSchema).parse(res.body).data
    expect(created).toMatchObject({ userId: s.userId, title: fields.title, category: 'pencapaian', eventDate: '2026-08-14', story: 'Mewakili sekolah.' })
    expect(created.photos.map((p) => p.caption)).toEqual(['Di pentas', null])
    expect(created.photos.every((p) => /^\/api\/files\/[A-Za-z0-9_-]{22}$/.test(p.url))).toBe(true)
    expect(await countFiles()).toBe(files0 + 2)

    const second = await post(s, { ...fields, title: 'Kedua' }, [{ bytes: makeWebp(), name: 'c.webp', type: 'image/webp' }])
    expect(second.status, JSON.stringify(second.body)).toBe(201)

    const list = envelopeOf(PerformanceTimelineSchema).parse((await s.agent.get('/api/timeline')).body).data
    expect(list.posts.map((p) => p.title)).toEqual(['Kedua', fields.title])
  })

  it('accepts the repeated `photos[]` part name and exactly 5 photos', async () => {
    const s = await login('pelajar@demo.test')
    const res = await post(s, { ...fields, title: 'Lima gambar' }, Array.from({ length: 5 }, () => ({ ...png(), field: 'photos[]' })))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.photos).toHaveLength(5)
  })

  it('strips the EXIF/text metadata of a stored photo and stores it under the timeline_photo purpose', async () => {
    const s = await login('pelajar@demo.test')
    const res = await post(s, { ...fields, title: 'Metadata' }, [{ bytes: makePng({ text: 'GPS-SECRET' }) }])
    expect(res.status).toBe(201)
    const token = (res.body.data.photos[0].url as string).replace('/api/files/', '')
    const row = (await w.db.query<{ purpose: string; owner_user_id: string }>(`select purpose, owner_user_id::text from files where public_id = $1`, [token]))[0]
    expect(row).toMatchObject({ purpose: 'timeline_photo', owner_user_id: s.userId })
    const bytes = await s.agent.get(`/api/files/${token}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = []
      r.on('data', (c: Buffer) => chunks.push(c))
      r.on('end', () => cb(null, Buffer.concat(chunks)))
    })
    expect(bytes.status).toBe(200)
    expect((bytes.body as Buffer).includes(Buffer.from('GPS-SECRET'))).toBe(false)
  })

  it('shows a viewer only their OWN posts: another pupil, a teacher and an admin never see them', async () => {
    const owner = await login('pelajar@demo.test')
    for (const email of ['ujian3@demo.test', 'guru@demo.test', 'admin@demo.test']) {
      const s = await login(email)
      const posts = envelopeOf(PerformanceTimelineSchema).parse((await s.agent.get('/api/timeline')).body).data.posts
      expect(posts.every((p) => p.userId === s.userId)).toBe(true)
    }
    // there is no way to ask for another user's timeline: a query parameter is ignored
    const sneaky = await (await login('ujian3@demo.test')).agent.get(`/api/timeline?userId=${owner.userId}`)
    expect(envelopeOf(PerformanceTimelineSchema).parse(sneaky.body).data.posts).toEqual([])
  })

  it('lets any signed-in user read a timeline photo, and refuses an anonymous caller (401)', async () => {
    const owner = await login('pelajar@demo.test')
    const url = (envelopeOf(PerformanceTimelineSchema).parse((await owner.agent.get('/api/timeline')).body).data.posts[0]?.photos[0]?.url) as string
    expect(url).toBeTruthy()
    for (const email of ['ujian3@demo.test', 'guru@demo.test']) {
      const res = await (await login(email)).agent.get(url)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/^image\//)
    }
    expectError(await w.http().get(url), 'UNAUTHORIZED')
  })

  it('never lists a test post (is_test), and a public profile of the pupil carries no posts for an anonymous caller', async () => {
    const s = await login('ujian3@demo.test')
    await w.db.query(`insert into timeline_posts (user_id, title, category, is_test) values ($1, 'Ujian rahsia', 'lain', true), ($1, 'Biasa', 'lain', false)`, [s.userId])
    const posts = envelopeOf(PerformanceTimelineSchema).parse((await s.agent.get('/api/timeline')).body).data.posts
    expect(posts.map((p) => p.title)).toEqual(['Biasa'])
    const pub = await w.http().get(`/api/public/students/${s.userId}`)
    expect(pub.status).toBe(200)
    expect(pub.body.data.posts).toEqual([])
    await w.db.query(`delete from timeline_posts where user_id = $1`, [s.userId])
  })
})

describe('validation, spoofing and limits', () => {
  const unchanged = async (s: Session, run: () => Promise<Response>): Promise<Response> => {
    const posts = await countPosts(s.userId)
    const files = await countFiles()
    const res = await run()
    expect(await countPosts(s.userId), 'no post must be stored').toBe(posts)
    expect(await countFiles(), 'no file must be stored').toBe(files)
    return res
  }

  it('refuses a .png that is really HTML (magic bytes), and also a text file sent as image/png', async () => {
    const s = await login('ujian1@demo.test')
    const html = Buffer.from('<html><script>alert(1)</script></html>')
    for (const bytes of [html, Buffer.from('just text'), Buffer.from('%PDF-1.4 fictitious')]) {
      const res = await unchanged(s, () => post(s, fields, [{ bytes, name: 'gambar.png', type: 'image/png' }]))
      const err = expectError(res, 'VALIDATION_ERROR')
      expect(err.fields).toEqual({ photos: MSG.photoInvalid })
      expect(err.message).toBe(MSG.photoInvalid)
    }
  })

  it('one bad photo among good ones stores none of them', async () => {
    const s = await login('ujian1@demo.test')
    const res = await unchanged(s, () => post(s, fields, [png(), { bytes: Buffer.from('MZ fake') }, png()]))
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ photos: MSG.photoInvalid })
  })

  it('refuses a 6th photo with the photos-required message', async () => {
    const s = await login('ujian1@demo.test')
    const res = await unchanged(s, () => post(s, fields, Array.from({ length: 6 }, png)))
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ photos: MSG.photosRequired })
  })

  it('refuses a photo over 2 MB (cut off while streaming) and accepts one of exactly 2 MB', async () => {
    const s = await login('ujian1@demo.test')
    const over = await unchanged(s, () => post(s, fields, [{ bytes: makePng({ padTo: 2 * 1024 * 1024 + 1 }) }]))
    expect(expectError(over, 'VALIDATION_ERROR').fields).toEqual({ photos: MSG.photoInvalid })
    const exact = await post(s, { ...fields, title: 'Tepat 2 MB' }, [{ bytes: makePng({ padTo: 2 * 1024 * 1024 }) }])
    expect(exact.status, JSON.stringify(exact.body)).toBe(201)
  })

  it('answers the contract messages, one per field, with the first message plus the count of the rest', async () => {
    const s = await login('ujian1@demo.test')
    const res = await unchanged(s, () => post(s, { title: ' ', category: 'bukan', eventDate: '2026-02-31', story: 'x'.repeat(2001) }, []))
    const err = expectError(res, 'VALIDATION_ERROR')
    expect(err.fields).toEqual({
      title: MSG.titleRequired,
      category: MSG.categoryInvalid,
      eventDate: MSG.dateInvalid,
      story: MSG.storyTooLong,
      photos: MSG.photosRequired,
    })
    expect(err.message).toBe(`${MSG.titleRequired} (and 4 more errors)`)
  })

  it('refuses a title of 151 characters and a missing photo part', async () => {
    const s = await login('ujian1@demo.test')
    const long = await unchanged(s, () => post(s, { ...fields, title: 't'.repeat(151) }, [png()]))
    expect(expectError(long, 'VALIDATION_ERROR').fields).toEqual({ title: MSG.titleTooLong })
    const none = await unchanged(s, () => post(s, fields, []))
    expect(expectError(none, 'VALIDATION_ERROR').fields).toEqual({ photos: MSG.photosRequired })
  })

  it('a file sent under an unknown part name is refused like a missing photo', async () => {
    const s = await login('ujian1@demo.test')
    const res = await unchanged(s, () => post(s, fields, [{ ...png(), field: 'file' }]))
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ photos: MSG.photosRequired })
  })

  it('truncates a caption to 200 characters and keeps no caption for an empty one', async () => {
    const s = await login('ujian2@demo.test')
    const res = await post(s, { ...fields, title: 'Kapsyen', 'captions[0]': 'k'.repeat(250), 'captions[1]': '   ' }, [png(), png()])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.photos as { caption: string | null }[]).map((p) => p.caption?.length ?? null)).toEqual([200, null])
  })

  it('ignores a post owner sent in the body: the post belongs to the session user', async () => {
    const s = await login('ujian2@demo.test')
    const res = await post(s, { ...fields, title: 'Pemilik', userId: w.ids['pelajar@demo.test'] as string, isTest: 'true' }, [png()])
    expect(res.status).toBe(201)
    expect(res.body.data.userId).toBe(s.userId)
    const row = (await w.db.query<{ is_test: boolean }>(`select is_test from timeline_posts where id = $1`, [res.body.data.id]))[0]
    expect(row?.is_test).toBe(false)
  })

  it('does not echo a caption or story into an error body', async () => {
    const s = await login('ujian2@demo.test')
    const res = await post(s, { title: ' ', category: 'lain', story: 'RAHSIA-CERITA', 'captions[0]': 'RAHSIA-KAPSYEN' }, [png()])
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).not.toContain('RAHSIA')
  })
})

describe('the cap and the rate limit', () => {
  it('refuses a new post when the pupil already holds 200, and stores nothing', async () => {
    const s = await login('ujian3@demo.test')
    await w.db.query(`insert into timeline_posts (user_id, title, category) select $1, 'Isi ' || g, 'lain' from generate_series(1, 200) g`, [s.userId])
    const files = await countFiles()
    const res = await post(s, fields, [png()])
    const err = expectError(res, 'VALIDATION_ERROR')
    expect(Object.keys(err.fields ?? {})).toEqual(['posts'])
    expect(await countPosts(s.userId)).toBe(200)
    expect(await countFiles()).toBe(files)
    await w.db.query(`delete from timeline_posts where user_id = $1`, [s.userId])
  })

  it('limits POST /timeline to 10 per minute per user, counting refused attempts too (429 with Retry-After)', async () => {
    const s = await login('guru2@demo.test')
    // a teacher is refused before the body, but every attempt still counts against the bucket; use a pupil instead
    const pupil = await login('ujian9@demo.test')
    for (let i = 0; i < 10; i++) {
      const res = await pupil.agent.post('/api/timeline').set('X-CSRF-Token', pupil.csrf).send({ title: 'x' })
      expect(res.status).toBe(422)
    }
    const limited = await pupil.agent.post('/api/timeline').set('X-CSRF-Token', pupil.csrf).send({ title: 'x' })
    expect(limited.status).toBe(429)
    expect(limited.headers['retry-after']).toBeTruthy()
    // another user is not affected
    expect((await s.agent.get('/api/timeline')).status).toBe(200)
  })
})
