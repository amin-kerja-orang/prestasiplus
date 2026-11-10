/**
 * T-B10-4: the Terbit pass over loaded papers. The pass logic (candidates, holds, report) with a fake publisher, then the REAL gate:
 * `BuilderService.publish` from a Nest context on the same database. The real-gate assertion is consistency, not a fixed verdict: a paper is
 * `published` if and only if the gate said ok, a refusal keeps it `draft` and returns the gate's BM lines.
 */
import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { defineAppModule } from '../../../src/app.module'
import { runPapers, runTerbitPass, terbitCandidates, terbitCsv } from '../../../src/migration/load/papers'
import { findMigrationActor } from '../../../src/migration/load/papers/terbit-nest'
import { runStructured } from '../../../src/migration/load/questions/structured-index'
import { BijakPapersModule } from '../../../src/modules/bijak/papers'
import { ExamBlueprintsModule } from '../../../src/modules/exam/blueprints'
import { BuilderService, ExamBuilderModule } from '../../../src/modules/exam/builder'
import { AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
beforeAll(async () => {
  h = await bootQuestions()
  const sql = (t: string, p: unknown[] = []) => h.pool.query(t, p)
  await sql(`insert into staging_cloud.paper_statuses (id, slug) values (91, 'published'), (92, 'draft') on conflict (id) do update set slug = excluded.slug`)
  await sql(`insert into archive_cloud.selection_rules (id, slug) values (1, 'answer_all') on conflict (id) do nothing`)
  await sql(`insert into archive_cloud.questions (id, subject_id, education_level_id, type, status, body, explanation, created_at, updated_at) values
    (951, 1, 2, 'subjektif', 'diluluskan', 'Huraikan satu contoh P.', 'Jawapan model P.', '2025-01-01', '2025-01-01')`)
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id) values (851, 'Kertas Terbit', 1, '2', 90, 91), (852, 'Kertas Draf V2', 1, '2', 90, 92)`)
  await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values (51, 851, 'Bahagian A', 1, 1), (52, 852, 'Bahagian A', 1, 1)`)
  await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, position) values (7051, 851, 1, 1), (7052, 852, 1, 1)`)
  await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values (9051, 'questions', '951', 'exam_question', 7051), (9052, 'questions', '951', 'exam_question', 7052)`)
  await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order) values (51, 7051, 51, 1), (52, 7052, 52, 1)`)
  const base = { pool: h.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 5 }
  for (const mode of ['dry-run', 'apply'] as const) expect((await runStructured({ ...base, mode })).report.status).toBe('succeeded')
  for (const mode of ['dry-run', 'apply'] as const) expect((await runPapers({ ...base, mode })).report.status).toBe('succeeded')
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('terbit pass', () => {
  it('offers only the V2-published papers that are loaded as draft, and reports published, failed and held', async () => {
    const candidates = await terbitCandidates(h.pool, 'cloud')
    const titles = (await h.q<{ id: string; title: string }>(`select id::text id, title from papers where id = any($1::bigint[])`, [candidates.map((c) => c.paperId)])).map((r) => r.title)
    expect(titles).toContain('Kertas Terbit')
    expect(titles).not.toContain('Kertas Draf V2')
    const seen: string[] = []
    const report = await runTerbitPass(h.pool, 'cloud', async (id) => {
      seen.push(id)
      return id === candidates[0]?.paperId ? { ok: true, errors: [] } : { ok: false, errors: ['Bahagian A: contoh garis gate.'] }
    })
    expect(report.considered).toBe(candidates.length)
    expect(report.published + report.failed + report.held).toBe(candidates.length)
    expect(report.published).toBe(1)
    expect(terbitCsv(report).split('\n')[0]).toBe('v2_paper_id,v3_paper_id,outcome,legacy,lines')
    // the fake publisher does not publish: nothing changed in the database
    expect(await h.count('papers', `t.status <> 'draft'`)).toBe(0)
  })

  it('the real gate (BuilderService.publish) decides: published if and only if it said ok', async () => {
    Object.assign(process.env, { DATABASE_URL: h.h.env.db.url, COOKIE_SECURE: 'false', SESSION_SECRET: 'x'.repeat(32), LEGACY_BCRYPT_DUMMY_COST: '4', LOGIN_FAILURE_FLOOR_MS: '0' })
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([BijakPapersModule, ExamBuilderModule, ExamBlueprintsModule])] }).compile()
    const app = moduleRef.createNestApplication({ bufferLogs: false })
    await app.init()
    try {
      const actorId = await findMigrationActor(h.pool)
      expect(actorId).not.toBeNull()
      const builder = app.get(BuilderService)
      const actor = { userId: actorId as string, role: 'admin', requestId: null, ip: null, isTest: false }
      const report = await runTerbitPass(h.pool, 'cloud', async (id) => {
        const r = await builder.publish(actor, id)
        return { ok: r.ok, errors: r.errors }
      })
      expect(report.considered).toBeGreaterThanOrEqual(1)
      for (const row of report.rows.filter((r) => r.outcome !== 'held')) {
        const status = (await h.q<{ status: string }>(`select status from papers where id = $1::bigint`, [row.paperId]))[0]?.status
        expect(status).toBe(row.outcome === 'published' ? 'published' : 'draft')
        if (row.outcome === 'failed') expect(row.lines.length).toBeGreaterThan(0)
      }
    } finally {
      await app.close()
    }
  }, 120_000)
})

describe('link backfills (T-B9-G)', () => {
  it('runs on the loaded data: the SQL is valid, dry-run changes nothing and counts are sane', async () => {
    const { backfillLinks } = await import('../../../src/migration/load/papers/links-backfill')
    const dry = await backfillLinks(h.pool, 'cloud', 'dry-run')
    expect(dry).toMatchObject({ mode: 'dry-run', setItemsInserted: expect.any(Number) })
    const again = await backfillLinks(h.pool, 'cloud', 'dry-run')
    expect(again).toEqual(dry)
  })
})
