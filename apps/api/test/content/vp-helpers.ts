import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { PerutusanModule } from '../../src/modules/content/perutusan'
import { VideosModule } from '../../src/modules/content/videos'
import { FILE_STORAGE, FilesModule, InMemoryStorage } from '../../src/modules/files'
import { START, loginAs, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'
import { makeJpeg, makePng } from '../files/fixtures'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { START, expectError, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'
export { ADMIN, SCHOOL_ADMIN, STUDENT, TEACHER, apiOf, type Api } from '../users/helpers'

import type { MalwareScanner } from '../../src/modules/files/malware-scanner'
import { ScanningFileStorage } from '../../src/modules/files/scanning-file-storage'

export interface VpApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  storage: InMemoryStorage
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/** Auth, files (in-memory storage), videos and perutusan on a private migrated database with the identity seed. Volume throttles are raised. */
export async function bootVp(env: Record<string, string | undefined> = {}, scanner?: MalwareScanner): Promise<VpApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_PUBLIC_PER_MINUTE: '100000',
    THROTTLE_PUBLIC_SEARCH_PER_MINUTE: '100000',
    THROTTLE_ADMIN_READ_PER_MINUTE: '100000',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...env,
  }
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const storage = new InMemoryStorage()
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, FilesModule, VideosModule, PerutusanModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(FILE_STORAGE)
    .useValue(scanner ? new ScanningFileStorage(storage, scanner) : storage)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    storage,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export const login = (t: Pick<VpApp, 'agent'>, identifier: string): Promise<LoggedIn> => loginAs(t as unknown as Parameters<typeof loginAs>[0], identifier)

export function errorOf(res: Response) {
  return ErrorBodySchema.parse(res.body).error
}

export function fieldsOf(res: Response): Record<string, string> {
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  const error = errorOf(res)
  expect(error.code).toBe('VALIDATION_ERROR')
  return error.fields ?? {}
}

/** Moves a seeded user to another demo school (before the user logs in). */
export async function moveUser(db: TestDatabase, email: string, schoolCode: string | null): Promise<void> {
  const schoolId = schoolCode === null ? null : await schoolIdOf(db, schoolCode)
  await db.query(`update users set school_id = $1 where lower(email) = lower($2)`, [schoolId, email])
}

export const idOfUser = userIdOf

// --- SQL fixtures -----------------------------------------------------------------------------------

export interface VideoSeed {
  title: string
  uploader: string
  category?: string
  visibility?: 'global' | 'school'
  /** School codes the video is shared with. */
  sharedWith?: string[]
  subjectId?: number | null
  createdAt?: string
  views?: number
  url?: string
}

export async function insertVideo(db: TestDatabase, v: VideoSeed): Promise<string> {
  const uploaderId = await userIdOf(db, v.uploader)
  const rows = await db.query<{ id: string }>(
    `insert into videos (video_url, platform, title, category, subject_id, visibility, uploader_id, views, created_at, updated_at)
     values ($1, 'Other', $2, $3, $4, $5, $6, $7, $8, $8) returning id::text`,
    [v.url ?? `https://example.test/v/${encodeURIComponent(v.title)}`, v.title, v.category ?? 'tutorial', v.subjectId ?? null, v.visibility ?? 'global', uploaderId, v.views ?? 0, v.createdAt ?? '2026-10-01T00:00:00+08:00'],
  )
  const id = rows[0]?.id as string
  for (const code of v.sharedWith ?? []) {
    await db.query(`insert into video_schools (video_id, school_id) values ($1, $2)`, [id, await schoolIdOf(db, code)])
  }
  return id
}

export interface PostSeed {
  title: string
  author: string
  scope?: 'national' | 'school'
  /** School code for a school post. */
  school?: string
  status?: 'published' | 'scheduled' | 'draft'
  scheduledAt?: string | null
  isPinned?: boolean
  isPublic?: boolean
  body?: string
  createdAt?: string
  youtubeUrl?: string | null
}

export async function insertPost(db: TestDatabase, p: PostSeed): Promise<string> {
  const authorId = await userIdOf(db, p.author)
  const schoolId = p.school ? await schoolIdOf(db, p.school) : null
  const rows = await db.query<{ id: string }>(
    `insert into perutusan (title, body, youtube_url, is_pinned, is_public, status, scheduled_at, scope, school_id, author_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) returning id::text`,
    [
      p.title,
      p.body ?? '<p>Isi perutusan contoh.</p>',
      p.youtubeUrl ?? null,
      p.isPinned ?? false,
      p.isPublic ?? false,
      p.status ?? 'published',
      p.scheduledAt ?? null,
      p.scope ?? (p.school ? 'school' : 'national'),
      schoolId,
      authorId,
      p.createdAt ?? '2026-10-01T00:00:00+08:00',
    ],
  )
  return rows[0]?.id as string
}

// --- file fixtures ----------------------------------------------------------------------------------

export const PNG = (): Buffer => makePng()
export const JPG = (): Buffer => makeJpeg()
export const PDF = (): Buffer => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1')

/** A 1x1 GIF89a with a comment extension (metadata that must be dropped) and bytes after the trailer. */
export function makeGif(opts: { comment?: string; trailing?: Buffer } = {}): Buffer {
  const comment = opts.comment ? Buffer.concat([Buffer.from([0x21, 0xfe, opts.comment.length]), Buffer.from(opts.comment, 'latin1'), Buffer.from([0])]) : Buffer.alloc(0)
  return Buffer.concat([
    Buffer.from('GIF89a', 'latin1'),
    Buffer.from([1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255]),
    comment,
    Buffer.from([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b]),
    opts.trailing ?? Buffer.alloc(0),
  ])
}

export interface PostFiles {
  images?: { bytes: Buffer; name?: string }[]
  documents?: { bytes: Buffer; name?: string }[]
}

/** POST /api/perutusan as multipart (text fields and file parts). `csrf: null` omits the header. */
export function postPerutusan(
  who: Pick<LoggedIn, 'agent' | 'csrf'>,
  fields: Record<string, string>,
  files: PostFiles = {},
  opts: { csrf?: string | null; field?: { images: string; documents: string } } = {},
): Promise<Response> {
  const req = who.agent.post('/api/perutusan')
  const csrf = opts.csrf === undefined ? who.csrf : opts.csrf
  if (csrf) req.set('X-CSRF-Token', csrf)
  for (const [k, v] of Object.entries(fields)) req.field(k, v)
  for (const [i, f] of (files.images ?? []).entries()) req.attach(opts.field?.images ?? 'images', f.bytes, { filename: f.name ?? `gambar${String(i)}.png` })
  for (const [i, f] of (files.documents ?? []).entries()) req.attach(opts.field?.documents ?? 'documents', f.bytes, { filename: f.name ?? `dokumen${String(i)}.pdf` })
  return req as unknown as Promise<Response>
}

/** Inserts a curriculum subject (BE-08 table) and returns its id. */
export async function insertSubject(db: TestDatabase, code: string, name: string): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into subjects (code, name, name_en, color) values ($1, $2, $2, '#336699') returning id::text`,
    [code, name],
  )
  return rows[0]?.id as string
}
