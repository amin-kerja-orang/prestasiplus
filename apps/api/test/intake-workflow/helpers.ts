import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Test } from '@nestjs/testing'
import type { AiExtractedPaper, AiExtractRequest, AiQuestionDraft } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { FilesModule } from '../../src/modules/files'
import { AI_EXTRACTOR, IntakeFilesModule, type AiExtractor } from '../../src/modules/intake/files'
import { IntakeWorkflowModule } from '../../src/modules/intake/workflow'
import { JobsService } from '../../src/modules/jobs'
import { OCR_ENGINE } from '../../src/modules/ocr'
import { QuestionsModule } from '../../src/modules/questions'
import { type AuthTestApp, START } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { FakeOcrEngine, createBatch, uploadOk, type LoggedIn } from '../intake-files/helpers'
import { textPdf } from '../intake-files/pdf-fixtures'

export { addAccount, loginAs, type LoggedIn } from '../intake-files/helpers'
export { expectError } from '../auth/helpers'

/** Real curriculum codes of the seed (MATH, T4): a unit and one of its SP. */
export interface TagCodes {
  unit: string
  sp: string
}

/** A scripted AI port: records every request and answers from a queue or a factory. Never the network. */
export class MockExtractor implements AiExtractor {
  readonly id = 'mock'
  readonly calls: AiExtractRequest[] = []
  /** Errors thrown for the next calls (shifted one per call). */
  readonly failures: unknown[] = []
  paper: (req: AiExtractRequest) => AiExtractedPaper = () => {
    throw new Error('MockExtractor.paper not set')
  }

  async extractPaper(req: AiExtractRequest): Promise<unknown> {
    this.calls.push(req)
    const failure = this.failures.shift()
    if (failure !== undefined) throw failure
    return this.paper(req)
  }
}

export interface WorkflowTestApp extends AuthTestApp {
  dir: string
  ai: MockExtractor
  jobs: JobsService
  codes: TagCodes
  /** Runs jobs that are due until none is left. */
  drain(maxRounds?: number): Promise<number>
  /** Makes every delayed job due now (the clock of the job table is the database). */
  releaseDelayed(): Promise<void>
}

export async function bootWorkflowApp(env: Record<string, string | undefined> = {}): Promise<WorkflowTestApp> {
  const db: TestDatabase = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
  const dir = await mkdtemp(join(tmpdir(), 'pp-workflow-test-'))
  const full: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    FILE_STORAGE_DIR: dir,
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_READS_PER_MINUTE: '10000',
    JOBS_WORKER_ENABLED: 'false',
    JOBS_BACKOFF_BASE_MS: '100',
    INTAKE_WRITES_PER_MINUTE: '1000',
    INTAKE_READS_PER_MINUTE: '10000',
    INTAKE_REVIEW_WRITES_PER_MINUTE: '10000',
    INTAKE_REVIEW_READS_PER_MINUTE: '10000',
    INTAKE_EXTRACTS_PER_MINUTE: '10000',
    INTAKE_BULK_PER_MINUTE: '10000',
    INTAKE_BULK_ACCEPT_MIN_BAND: undefined,
    INTAKE_EXTRACT_BUDGET_RECHECK_SECONDS: undefined,
    ...env,
  }
  for (const [k, v] of Object.entries(full)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const ai = new MockExtractor()
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, FilesModule, CurriculumModule, QuestionsModule, IntakeFilesModule, IntakeWorkflowModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(OCR_ENGINE)
    .useValue(new FakeOcrEngine())
    .overrideProvider(AI_EXTRACTOR)
    .useValue(ai)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  const jobs = app.get(JobsService)

  const unit = (
    await db.query<{ code: string; id: string }>(
      `select n.code, n.id::text from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id
       where s.code = 'MATH' and l.code = 'T4' and n.kind = 'unit' order by n.id limit 1`,
    )
  )[0]
  const sp = (
    await db.query<{ code: string }>(
      `select n.code from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id
       where s.code = 'MATH' and l.code = 'T4' and n.kind = 'sp' order by n.id limit 1`,
    )
  )[0]
  if (!unit || !sp) throw new Error('curriculum seed has no MATH T4 unit and SP')

  return {
    app,
    db,
    clock,
    dir,
    ai,
    jobs,
    codes: { unit: unit.code, sp: sp.code },
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
    async releaseDelayed() {
      await db.query(`update jobs set run_after = now() - interval '1 second' where state = 'queued'`)
    },
    async close() {
      await app.close()
      await db.drop()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

/* ---- paper builders ---------------------------------------------------------------------------- */

export interface DraftOver extends Partial<Omit<AiQuestionDraft, 'tag'>> {
  tag?: Partial<AiQuestionDraft['tag']>
}

let wordSeed = 0
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
function word(): string {
  wordSeed += 1
  let n = wordSeed * 7919 + Math.floor(Math.random() * 1_000_000)
  let w = ''
  do {
    w += LETTERS[n % 26]
    n = Math.floor(n / 26)
  } while (n > 0)
  return w.padStart(5, 'q')
}

/** A stem whose words are all different from every other stem of the run (no accidental near-duplicates). Letters only. */
export function uniqueStem(): string {
  return `Tentukan ${Array.from({ length: 8 }, word).join(' ')} bagi kertas ujian sintetik`
}

/** A complete MCQ draft that passes the gate (unless `over` breaks it). */
export function draft(codes: TagCodes, label: string, over: DraftOver = {}): AiQuestionDraft {
  const { tag, ...rest } = over
  return {
    status: 'draft',
    id: `q-${label}`,
    label,
    type: 'mcq',
    stem: uniqueStem(),
    options: [
      { id: 'A', text: 'Pilihan A' },
      { id: 'B', text: 'Pilihan B' },
      { id: 'C', text: 'Pilihan C' },
      { id: 'D', text: 'Pilihan D' },
    ],
    marks: 1,
    mode: 'working',
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: 'Kerana B.' },
    tag: { subject: 'MATH', level: 'T4', unit: codes.unit, unitLabel: 'Unit ujian', sp: [codes.sp], tp: 3, formOrigin: 'T4', ...tag },
    page: 1,
    lowFields: [],
    confirmed: [],
    fieldConfidence: { stem: 0.97, marks: 0.97, scheme: 0.97, 'tag.unit': 0.97 },
    warnings: [],
    ...rest,
  }
}

export function paper(questions: AiQuestionDraft[], over: Partial<AiExtractedPaper> = {}): AiExtractedPaper {
  return {
    provider: 'mock',
    model: 'mock-1',
    questions,
    stimuli: [],
    unmatched: [],
    warnings: [],
    usage: { provider: 'mock', model: 'mock-1', pages: 1, tokensIn: 10, tokensOut: 10, costSen: 0 },
    redaction: { applied: true, masked: [] },
    ...over,
  }
}

/* ---- scenario helpers -------------------------------------------------------------------------- */

export interface Ready {
  batchId: string
}

let counter = 0

/** A batch (subject MATH) with a processed text PDF, ready for review. Every call uses different bytes (own hash). */
export async function readyBatch(t: WorkflowTestApp, who: LoggedIn, over: { pages?: number } = {}): Promise<Ready> {
  const batch = await createBatch(who, { subject: 'MATH' })
  counter += 1
  const bytes = Buffer.concat([textPdf(over.pages ?? 1), Buffer.from(`\n% unik ${counter} ${Date.now()}\n`)])
  await uploadOk(who, batch.id, [{ bytes, filename: `kertas-${counter}.pdf` }])
  await t.drain()
  return { batchId: batch.id }
}

export async function extract(t: WorkflowTestApp, who: LoggedIn, batchId: string, expectStatus = 202) {
  const res = await who.agent.post(`/api/intake/batches/${batchId}/extract`).set('X-CSRF-Token', who.csrf).send({})
  expect(res.status, JSON.stringify(res.body)).toBe(expectStatus)
  return res
}

/** Extract and run the job. */
export async function extractAndRun(t: WorkflowTestApp, who: LoggedIn, batchId: string) {
  await extract(t, who, batchId)
  await t.drain()
}

export const post = (who: LoggedIn, url: string, body: unknown = {}) => who.agent.post(`/api${url}`).set('X-CSRF-Token', who.csrf).send(body as object)
export const patch = (who: LoggedIn, url: string, body: unknown) => who.agent.patch(`/api${url}`).set('X-CSRF-Token', who.csrf).send(body as object)
export const del = (who: LoggedIn, url: string) => who.agent.delete(`/api${url}`).set('X-CSRF-Token', who.csrf)

export interface ItemIds {
  ids: string[]
}

export async function itemsOf(who: LoggedIn, batchId: string): Promise<Array<{ id: string; label: string; state: string }>> {
  const res = await who.agent.get(`/api/intake/items?batchId=${batchId}&pageSize=100`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return (res.body.data as Array<{ id: string; label: string; state: string }>).map((r) => ({ id: r.id, label: r.label, state: r.state }))
}
