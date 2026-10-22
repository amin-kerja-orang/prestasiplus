import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Test } from '@nestjs/testing'
import {
  ErrorBodySchema,
  IntakeBatchDetailEnvelopeSchema,
  IntakeBatchSummaryEnvelopeSchema,
  IntakeUploadResultEnvelopeSchema,
  type IntakeBatchCreate,
  type IntakeBatchDetail,
  type IntakeBatchSummary,
  type IntakeUploadResult,
} from '@pp/contract'
import type { Response } from 'supertest'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { FilesModule } from '../../src/modules/files'
import { IntakeFilesModule } from '../../src/modules/intake/files'
import { JobsService } from '../../src/modules/jobs'
import { OCR_ENGINE, OcrError, type OcrEngine, type OcrResult } from '../../src/modules/ocr'
import { type AuthTestApp, START } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { addAccount } from '../files/helpers'
export { expectError, loginAs, type LoggedIn } from '../auth/helpers'

/** A recording OCR engine: never tesseract, never the network. */
export class FakeOcrEngine implements OcrEngine {
  available = true
  readonly calls: Buffer[] = []
  /** Throw this for the n-th call (1-based). */
  failOn = new Map<number, OcrError>()
  /** Page text returned by OCR. */
  text = 'Teks OCR sintetik untuk halaman imbasan ini'
  confidence = 91.5
  delayMs = 0

  async recognize(png: Buffer, signal?: AbortSignal): Promise<OcrResult> {
    this.calls.push(png)
    const n = this.calls.length
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs))
    if (signal?.aborted) throw signal.reason
    const err = this.failOn.get(n)
    if (err) throw err
    return {
      text: this.text,
      confidence: this.confidence,
      blocks: [{ text: this.text, bbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.05 }, confidence: this.confidence }],
    }
  }
}

export interface IntakeTestApp extends AuthTestApp {
  dir: string
  ocr: FakeOcrEngine
  jobs: JobsService
  /** Runs queued jobs until none is left (the worker is disabled in tests). Returns how many ran. */
  drain(maxRounds?: number): Promise<number>
  closeApp(): Promise<void>
}

export async function bootIntakeApp(
  env: Record<string, string | undefined> = {},
  reuse?: { db: TestDatabase; dir: string },
  ocr: FakeOcrEngine = new FakeOcrEngine(),
): Promise<IntakeTestApp> {
  const db: TestDatabase = reuse?.db ?? (await createTestDatabase())
  if (!reuse) await runSeeds([identitySeed], { prisma: db.prisma })
  const dir = reuse?.dir ?? (await mkdtemp(join(tmpdir(), 'pp-intake-test-')))

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
    FILE_READS_PER_MINUTE: '10000',
    JOBS_WORKER_ENABLED: 'false',
    JOBS_CANCEL_CHECK_MS: '50',
    OCR_ENGINE: undefined,
    OCR_LANG_DIR: undefined,
    OCR_MAX_PAGES: undefined,
    INTAKE_MAX_FILES_PER_BATCH: undefined,
    INTAKE_MAX_ACTIVE_BATCHES: undefined,
    INTAKE_DAILY_PAGE_QUOTA: undefined,
    // These suites exercise the teacher paths: the AZ-35 flag is on here and its default (off) is pinned in
    // test/intake-workflow/teacher-gate.spec.ts.
    INTAKE_TEACHER_ENABLED: 'true',
    INTAKE_WRITES_PER_MINUTE: '1000',
    INTAKE_READS_PER_MINUTE: '10000',
    ...env,
  }
  for (const [k, v] of Object.entries(full)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, FilesModule, IntakeFilesModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(OCR_ENGINE)
    .useValue(ocr)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  const jobs = app.get(JobsService)

  let appClosed: Promise<void> | undefined
  const closeOnce = (): Promise<void> => (appClosed ??= app.close())

  return {
    app,
    db,
    clock,
    dir,
    ocr,
    jobs,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async drain(maxRounds = 200) {
      let total = 0
      for (let i = 0; i < maxRounds; i++) {
        const n = await jobs.runOnce(10)
        if (n === 0) return total
        total += n
      }
      throw new Error('jobs did not settle')
    },
    closeApp: closeOnce,
    async close() {
      await closeOnce()
      if (reuse) return
      await db.drop()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

export const DECLARATION: IntakeBatchCreate = {
  paperType: 'trial',
  subject: 'MAT',
  kertas: 1,
  year: 2025,
  source: 'Sumber ujian sintetik',
  copyright: 'sendiri',
  notes: 'Nota penghantar sintetik',
  declaration: true,
}

export interface Who {
  agent: TestAgent
  csrf: string
}

export async function createBatch(who: Who, over: Partial<IntakeBatchCreate> = {}): Promise<IntakeBatchSummary> {
  const res = await who.agent.post('/api/intake/batches').set('X-CSRF-Token', who.csrf).send({ ...DECLARATION, ...over })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return IntakeBatchSummaryEnvelopeSchema.parse(res.body).data
}

export interface Part {
  bytes: Buffer
  filename?: string
  contentType?: string
}

/** POST /api/intake/batches/:id/files with one `files` part per entry. */
export function uploadFiles(who: Who, batchId: string, parts: Part[], opts: { csrf?: string | null; field?: string } = {}): Promise<Response> {
  const req = who.agent.post(`/api/intake/batches/${batchId}/files`)
  const csrf = opts.csrf === undefined ? who.csrf : opts.csrf
  if (csrf) req.set('X-CSRF-Token', csrf)
  parts.forEach((p, i) => {
    req.attach(opts.field ?? 'files', p.bytes, { filename: p.filename ?? `kertas-${i + 1}.pdf`, contentType: p.contentType ?? 'application/pdf' })
  })
  return req as unknown as Promise<Response>
}

export async function uploadOk(who: Who, batchId: string, parts: Part[]): Promise<IntakeUploadResult> {
  const res = await uploadFiles(who, batchId, parts)
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return IntakeUploadResultEnvelopeSchema.parse(res.body).data
}

export async function getBatch(who: Who, batchId: string): Promise<IntakeBatchDetail> {
  const res = await who.agent.get(`/api/intake/batches/${batchId}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return IntakeBatchDetailEnvelopeSchema.parse(res.body).data
}

/** A 422 on `fields.files` with exactly this message. */
export function expectFilesError(res: Response, message: string): void {
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  const parsed = ErrorBodySchema.parse(res.body)
  expect(parsed.error.code).toBe('VALIDATION_ERROR')
  expect(parsed.error.fields?.files).toBe(message)
}

export function binary(res: Response, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = []
  ;(res as unknown as NodeJS.ReadableStream).on('data', (c: Buffer) => chunks.push(c))
  ;(res as unknown as NodeJS.ReadableStream).on('end', () => callback(null, Buffer.concat(chunks)))
}

export async function countRows(db: TestDatabase, table: 'files' | 'intake_files' | 'intake_pages' | 'jobs' | 'intake_batches'): Promise<number> {
  return Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table}`))[0]?.n)
}

/** Every key and string value of a JSON value, for the "no storage detail" scans. */
export function walk(value: unknown, visit: (key: string | null, v: unknown) => void, key: string | null = null): void {
  visit(key, value)
  if (Array.isArray(value)) for (const v of value) walk(v, visit, key)
  else if (value !== null && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, visit, k)
}
