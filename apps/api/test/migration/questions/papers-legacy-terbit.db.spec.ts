/**
 * Legacy publication of V2-published papers (V2 parity, design 10.5a): V2 `exam_papers` has no blueprint reference, so every loaded paper has
 * no Kontrak and the plain Terbit gate refuses it with the overridable "no Kontrak" line. The pass calls the REAL gate
 * (`BuilderService.publish`) with the audited override of the Studio, so a paper pupils could take in V2 is published in V3, while
 *  - a hard blocker (here: a placed question pupils cannot be served) still refuses it, and it stays `draft` with the gate's line;
 *  - a paper the V2 load held (kertas unknown) is not offered at all;
 *  - the plain Terbit of the same gate still refuses a paper with no Kontrak (the gate stays meaningful for new papers).
 * Synthetic data only.
 */
import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { defineAppModule } from '../../../src/app.module'
import { LEGACY_PUBLISH_BODY, LEGACY_PUBLISH_REASON, runPapers, runTerbitPass, terbitCsv } from '../../../src/migration/load/papers'
import { findMigrationActor } from '../../../src/migration/load/papers/terbit-nest'
import { BijakPapersModule } from '../../../src/modules/bijak/papers'
import { ExamBlueprintsModule } from '../../../src/modules/exam/blueprints'
import { BuilderService, ExamBuilderModule } from '../../../src/modules/exam/builder'
import { AS_OF, addArchive, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
const sql = (t: string, p: unknown[] = []) => h.pool.query(t, p)

beforeAll(async () => {
  h = await bootQuestions()
  await sql(`insert into staging_cloud.paper_statuses (id, slug) values (91, 'published'), (92, 'draft') on conflict (id) do update set slug = excluded.slug`)
  await sql(`insert into archive_cloud.selection_rules (id, slug) values (1, 'answer_all') on conflict (id) do nothing`)
  // 952: an approved MCQ (servable); 953: a rejected one (not servable in V3).
  // Subject 2, level 2 (Tingkatan 4), chapter 3 and topic 3 are the consistent T4 set of the fixture curriculum.
  const t4 = { subject: 2, level: 2, chapter: 3, topic: 3 }
  await addArchive(h.pool, [{ id: 952, ...t4 }, { id: 953, ...t4, status: 'ditolak' }])
  // The fixture curriculum has T4 as an inactive primary-stage level; the gate only serves a secondary, active level.
  await sql(`update education_levels set stage = 'upper_secondary', is_active = true where code = 'T4'`)
  await h.both()
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id) values
      (861, 'Kertas Lama Terbit', 2, '1', 90, 91), (862, 'Kertas Lama Soalan Tidak Boleh', 2, '1', 90, 91), (863, 'Kertas Lama Draf', 2, '1', 90, 92), (864, 'Kertas Lama Tanpa Kertas', 2, null, 90, 91),
      (865, 'Kertas Lama Tanpa Tempoh', 2, '1', null, 91)`)
  await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values (61, 861, 'Bahagian A', 1, 1), (62, 862, 'Bahagian A', 1, 1), (63, 863, 'Bahagian A', 1, 1), (64, 864, 'Bahagian A', 1, 1), (65, 865, 'Bahagian A', 1, 1)`)
  await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, position) values (7061, 861, 1, 1), (7062, 862, 1, 1), (7063, 863, 1, 1), (7064, 864, 1, 1), (7065, 865, 1, 1)`)
  await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values
      (9061, 'questions', '952', 'exam_question', 7061), (9062, 'questions', '953', 'exam_question', 7062), (9063, 'questions', '952', 'exam_question', 7063), (9064, 'questions', '952', 'exam_question', 7064), (9065, 'questions', '952', 'exam_question', 7065)`)
  await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order) values (61, 7061, 61, 1), (62, 7062, 62, 1), (63, 7063, 63, 1), (64, 7064, 64, 1), (65, 7065, 65, 1)`)
  const base = { pool: h.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 5 }
  for (const mode of ['dry-run', 'apply'] as const) expect((await runPapers({ ...base, mode })).report.status).toBe('succeeded')
}, 600_000)
afterAll(async () => {
  await h?.close()
})

describe('ck_papers_duration (0266): only a legacy paper may be untimed', () => {
  const insert = (extra: string) =>
    sql(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, surface, status, version${extra === '' ? '' : ', legacy_untimed'}) values ('pilihan', 'Ujian Tempoh', 2, 1, 0, 'simulasi', 'draft', 1${extra === '' ? '' : ', ' + extra})`)
  it('refuses a V3-authored Simulasi paper with no duration, and allows the flagged legacy paper', async () => {
    await expect(insert('')).rejects.toThrow(/ck_papers_duration/)
    await expect(insert('false')).rejects.toThrow(/ck_papers_duration/)
    await insert('true')
    // the flag never allows a negative duration
    await expect(sql(`update papers set printed_duration_min = -1 where title = 'Ujian Tempoh'`)).rejects.toThrow(/ck_papers_duration/)
    await sql(`delete from papers where title = 'Ujian Tempoh'`)
  })
})

describe('the legacy publication rule', () => {
  it('publishes the V2-published papers through the audited override and keeps every hard blocker', async () => {
    Object.assign(process.env, { DATABASE_URL: h.h.env.db.url, COOKIE_SECURE: 'false', SESSION_SECRET: 'x'.repeat(32), LEGACY_BCRYPT_DUMMY_COST: '4', LOGIN_FAILURE_FLOOR_MS: '0' })
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([BijakPapersModule, ExamBuilderModule, ExamBlueprintsModule])] }).compile()
    const app = moduleRef.createNestApplication({ bufferLogs: false })
    await app.init()
    try {
      const actorId = await findMigrationActor(h.pool)
      expect(actorId).not.toBeNull()
      const builder = app.get(BuilderService)
      const actor = { userId: actorId as string, role: 'admin', requestId: null, ip: null, isTest: false }
      const idOf = async (title: string) => String((await h.q<{ id: string }>(`select id::text id from papers where title = $1`, [title]))[0]?.id)

      // The plain Terbit of the same gate refuses a paper with no Kontrak (the gate stays meaningful for new papers).
      const plain = await builder.publish(actor, await idOf('Kertas Lama Terbit'))
      expect(plain.ok).toBe(false)
      expect(plain.errors.join(' ')).toMatch(/blueprint/i)
      expect(plain.canOverride).toBe(true)

      const report = await runTerbitPass(h.pool, 'cloud', async (id) => {
        const r = await builder.publish(actor, id, LEGACY_PUBLISH_BODY)
        return { ok: r.ok, errors: r.errors, overridden: r.overridden }
      })
      const byTitle = new Map<string, (typeof report.rows)[number]>()
      for (const r of report.rows) byTitle.set(String((await h.q<{ title: string }>(`select title from papers where id = $1::bigint`, [r.paperId]))[0]?.title), r)

      // published in V2 and servable: published in V3 through the override, listed as legacy
      expect(byTitle.get('Kertas Lama Terbit')).toMatchObject({ outcome: 'published', legacy: true })
      expect(String((await h.q<{ status: string }>(`select status from papers where id = $1::bigint`, [await idOf('Kertas Lama Terbit')]))[0]?.status)).toBe('published')
      // a hard blocker (a question pupils cannot be served) still refuses: stays draft with the gate's lines
      const refused = byTitle.get('Kertas Lama Soalan Tidak Boleh')
      expect(refused?.outcome).toBe('failed')
      expect(refused?.lines.length).toBeGreaterThan(0)
      expect(String((await h.q<{ status: string }>(`select status from papers where id = $1::bigint`, [await idOf('Kertas Lama Soalan Tidak Boleh')]))[0]?.status)).toBe('draft')
      // V2 draft is never offered; a paper the load held (no kertas) is held and listed
      expect(byTitle.has('Kertas Lama Draf')).toBe(false)
      expect(byTitle.get('Kertas Lama Tanpa Kertas')).toMatchObject({ outcome: 'held', lines: ['kertas_unknown:no_questions'] })
      // V2 parity: a paper with no duration was served untimed; it loads untimed (0, flagged) and is NOT held, so it publishes
      expect(byTitle.get('Kertas Lama Tanpa Tempoh')).toMatchObject({ outcome: 'published', legacy: true })
      expect(await h.q(`select printed_duration_min, legacy_untimed, surface, status from papers where title = 'Kertas Lama Tanpa Tempoh'`)).toEqual([{ printed_duration_min: 0, legacy_untimed: true, surface: 'simulasi', status: 'published' }])
      expect(report).toMatchObject({ considered: 4, published: 2, legacy: 2, failed: 1, held: 1 })

      // the audit trail: the override and its reason, by the migration actor
      const audit = await h.q<{ detail: { reason?: string; count?: number } }>(`select detail from audit_events where action = 'bijak.paper.published_override' and target_id = $1`, [await idOf('Kertas Lama Terbit')])
      expect(audit).toHaveLength(1)
      expect(audit[0]?.detail.reason).toBe(LEGACY_PUBLISH_REASON)
      expect(audit[0]?.detail.count).toBeGreaterThan(0)

      const csv = terbitCsv(report).split('\n')
      expect(csv[0]).toBe('v2_paper_id,v3_paper_id,outcome,legacy,lines')
      expect(csv.filter((l) => l.includes(',published,yes,'))).toHaveLength(2)

      // a second pass offers nothing that is already published
      const second = await runTerbitPass(h.pool, 'cloud', async () => ({ ok: false, errors: ['unused'] }))
      expect(second.rows.map((r) => r.outcome).sort()).toEqual(['failed', 'held'])
    } finally {
      await app.close()
    }
  }, 180_000)
})
