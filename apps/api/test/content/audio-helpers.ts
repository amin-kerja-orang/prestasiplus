import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { contentSeed } from '../../prisma/seed/content'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { PrismaService } from '../../src/db/prisma.service'
import { AuthModule } from '../../src/modules/auth'
import { AudioKbatModule } from '../../src/modules/content/audio'
import { FILE_STORAGE, FilesModule, FilesService, InMemoryStorage } from '../../src/modules/files'
import { NotificationsModule } from '../../src/modules/notifications'
import { SupportModule } from '../../src/modules/support'
import { START, loginAs, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { START, expectError, userIdOf, type LoggedIn } from '../auth/helpers'
export { ADMIN, STUDENT, TEACHER, apiOf, type Api } from '../users/helpers'

export interface PartCApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  storage: InMemoryStorage
  prisma: PrismaService
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/**
 * Nest app with auth, files (in-memory storage), notifications, audio KBAT and support on a private migrated
 * database (identity + content seeds). Throttles are raised except the ones a test sets itself.
 */
export async function bootPartC(env: Record<string, string | undefined> = {}) {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, contentSeed], { prisma: db.prisma })
  // Curriculum parents with fixed ids (the audio sets reference level 10/11 and subject 1/2); names are fictitious test data.
  await db.query(`insert into education_levels (id, code, name, name_en, stage, curriculum) overriding system value values (10, 'T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM'), (11, 'T5', 'Tingkatan 5', 'Form 5', 'upper_secondary', 'KSSM')`)
  await db.query(`insert into subjects (id, code, name, name_en, color) overriding system value values (1, 'BM', 'Bahasa Melayu', 'Malay', '#4f46e5'), (2, 'BI', 'Bahasa Inggeris', 'English', '#0ea5e9')`)
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_NOTIFICATION_READ_PER_MINUTE: '100000',
    THROTTLE_NOTIFICATION_WRITE_PER_MINUTE: '100000',
    THROTTLE_SUPPORT_TICKET_CREATE_PER_HOUR: '100000',
    THROTTLE_SUPPORT_READ_PER_MINUTE: '100000',
    THROTTLE_SUPPORT_CONFIG_PER_MINUTE: '100000',
    THROTTLE_AUDIO_KBAT_READ_PER_MINUTE: '100000',
    THROTTLE_AUDIO_KBAT_FILE_PER_MINUTE: '100000',
    THROTTLE_AUDIO_KBAT_ATTEMPT_PER_MINUTE: '100000',
    THROTTLE_AUDIO_KBAT_ADMIN_WRITE_PER_HOUR: '100000',
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
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, FilesModule, NotificationsModule, AudioKbatModule, SupportModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(FILE_STORAGE)
    .useValue(storage)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    storage,
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export const loginPartC = (t: Pick<PartCApp, 'agent'>, identifier: string): Promise<LoggedIn> =>
  loginAs(t as unknown as Parameters<typeof loginAs>[0], identifier)

/** A logged-in user that can post JSON with the CSRF header. */
export function jsonOf(who: LoggedIn) {
  return {
    get: (path: string) => who.agent.get(`/api${path}`),
    post: (path: string, body: unknown = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body as object),
    postNoCsrf: (path: string, body: unknown = {}) => who.agent.post(`/api${path}`).send(body as object),
  }
}

export function errorOf(res: Response) {
  const parsed = ErrorBodySchema.parse(res.body)
  return parsed.error
}

export function fieldsOf(res: Response): Record<string, string> {
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  const error = errorOf(res)
  expect(error.code).toBe('VALIDATION_ERROR')
  return error.fields ?? {}
}

// --- audio fixtures --------------------------------------------------------------------------------

/** Tiny buffers that start with the real magic bytes of each container. */
export const AUDIO_BYTES = {
  mp3: Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64, 1)]),
  m4a: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(64, 2)]),
  wav: Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64, 3)]),
  ogg: Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64, 4)]),
  aac: Buffer.concat([Buffer.from([0xff, 0xf1]), Buffer.alloc(64, 5)]),
} as const

/** Stores audio bytes as an audio_kbat file (what the admin create does) and returns its public id. */
export async function storeAudio(t: Pick<PartCApp, 'app' | 'db'>, ownerId: string, bytes: Buffer): Promise<string> {
  return (await t.app.get(FilesService).storeManaged({ ownerUserId: ownerId, purpose: 'audio_kbat', bytes })).publicId
}

export type Choice = 'A' | 'B' | 'C' | 'D'

export interface FixtureOptions {
  title?: string
  status?: string
  levelId?: number
  subjectId?: number
  /** Marks of every question (default 1). */
  marks?: number
  /** The correct answer of question n (default 'A'). */
  correct?: (n: number) => Choice
  /** `audioFileId` of section n, or null. */
  audioFileId?: (n: number) => string | null
  createdById: string
}

export const RANGES = [
  [1, 8],
  [9, 16],
  [17, 24],
  [25, 30],
] as const

/** Inserts an audio KBAT set straight into the table (sections and questions as the service stores them). */
export async function insertAudioSet(db: TestDatabase, o: FixtureOptions): Promise<string> {
  const sections = RANGES.map(([from, to], i) => {
    const n = i + 1
    const audioFileId = o.audioFileId?.(n) ?? null
    return { no: n, title: `Audio ${String(n)}`, audioFileId, audioFileName: audioFileId ? `audio${String(n)}.mp3` : null, transcript: null, questionFrom: from, questionTo: to }
  })
  const questions = Array.from({ length: 30 }, (_, i) => {
    const n = i + 1
    return {
      no: n,
      questionText: `Soalan contoh ${String(n)}`,
      optionA: `Pilihan A ${String(n)}`,
      optionB: `Pilihan B ${String(n)}`,
      optionC: `Pilihan C ${String(n)}`,
      optionD: `Pilihan D ${String(n)}`,
      correctAnswer: o.correct?.(n) ?? 'A',
      marks: o.marks ?? 1,
      kbatLevel: 4,
      dskpSpId: '77',
      explanation: `Penjelasan rahsia ${String(n)}`,
    }
  })
  const rows = await db.query<{ id: string }>(
    `insert into audio_kbat_sets (title, education_level_id, subject_id, status, source_label, instructions, sections, questions, created_by_id)
     values ($1, $2, $3, $4, 'Sumber demo', 'Dengar dengan teliti.', $5::jsonb, $6::jsonb, $7) returning id::text`,
    [o.title ?? 'BM T4 Ujian Mendengar Set 1', o.levelId ?? 10, o.subjectId ?? 1, o.status ?? 'approved', JSON.stringify(sections), JSON.stringify(questions), o.createdById],
  )
  return (rows[0] as { id: string }).id
}

/** Every key name found anywhere in a JSON value. */
export function allKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) allKeys(v, into)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k)
      allKeys(v, into)
    }
  }
  return into
}
