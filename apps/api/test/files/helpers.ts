import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Test } from '@nestjs/testing'
import { ErrorBodySchema, FileRefSchema, type FileRef } from '@pp/contract'
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
import { FilesModule } from '../../src/modules/files'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { type AuthTestApp, START } from '../auth/helpers'

export { expectError, loginAs, type LoggedIn } from '../auth/helpers'

export interface FilesTestApp extends AuthTestApp {
  /** The folder FILE_STORAGE_DIR points at. */
  dir: string
}

/** Nest app with the auth and files modules on a private database, a temp storage folder and a fixed clock. */
export async function bootFilesApp(env: Record<string, string | undefined> = {}): Promise<FilesTestApp> {
  const db: TestDatabase = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  const dir = await mkdtemp(join(tmpdir(), 'pp-files-test-'))

  const full: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    SESSION_REMEMBER_DAYS: undefined,
    SESSION_REMEMBER_DAYS_STAFF: undefined,
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    FILE_STORAGE_DIR: dir,
    MAX_UPLOAD_MB: undefined,
    INTAKE_MAX_FILE_MB: undefined,
    UPLOAD_RATE_PER_MINUTE: '1000',
    ...env,
  }
  for (const [k, v] of Object.entries(full)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, FilesModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  return {
    app,
    db,
    clock,
    dir,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

export interface Uploader {
  agent: TestAgent
  csrf: string
}

/** POST /api/files with one `file` part. */
export function upload(
  who: Uploader,
  purpose: string | undefined,
  bytes: Buffer,
  opts: { filename?: string; contentType?: string; csrf?: string | null; field?: string } = {},
): Promise<Response> {
  const req = who.agent.post(purpose === undefined ? '/api/files' : `/api/files?purpose=${purpose}`)
  const csrf = opts.csrf === undefined ? who.csrf : opts.csrf
  if (csrf) req.set('X-CSRF-Token', csrf)
  return req.attach(opts.field ?? 'file', bytes, {
    filename: opts.filename ?? 'picture.png',
    contentType: opts.contentType ?? 'image/png',
  }) as unknown as Promise<Response>
}

/** Asserts a 201 and parses the body with the contract schema. */
export async function uploadOk(who: Uploader, purpose: string, bytes: Buffer, filename = 'picture.png', contentType = 'image/png'): Promise<FileRef> {
  const res = await upload(who, purpose, bytes, { filename, contentType })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return FileRefSchema.parse(res.body.data)
}

/** Asserts a 422 with `fields.file` (or the given field) equal to `message`; the body parses as the error envelope. */
export function expectFieldError(res: Response, message: string, field = 'file'): void {
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  const parsed = ErrorBodySchema.parse(res.body)
  expect(parsed.error.code).toBe('VALIDATION_ERROR')
  expect(parsed.error.fields?.[field]).toBe(message)
}

/** Binary response body for supertest (`.buffer().parse(...)`). */
export function binary(res: Response, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = []
  ;(res as unknown as NodeJS.ReadableStream).on('data', (c: Buffer) => chunks.push(c))
  ;(res as unknown as NodeJS.ReadableStream).on('end', () => callback(null, Buffer.concat(chunks)))
}
