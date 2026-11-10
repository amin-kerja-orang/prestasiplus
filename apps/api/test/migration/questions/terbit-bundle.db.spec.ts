/**
 * `migrate:terbit` as the BUILT bundle (`dist/migrate-terbit.js`, vite + SWC with decorator metadata) run with plain node, the way
 * `slot.sh etl migrate:terbit` runs it in the migrate image. Under tsx the Nest providers cannot resolve their dependencies (no
 * `emitDecoratorMetadata`), which is why the Terbit pass is a bundle. The paper is published through the real `BuilderService.publish`
 * with the audited override. Synthetic data only.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LEGACY_PUBLISH_REASON, runPapers } from '../../../src/migration/load/papers'
import { AS_OF, addArchive, bootQuestions, type QuestionsHarness } from './helpers'

const API = fileURLToPath(new URL('../../..', import.meta.url))
// Inside apps/api/node_modules so the bundle's external imports (nest, pg, prisma ...) resolve; removed afterwards.
const BUNDLE_DIR = join(API, 'node_modules', '.cache', `pp-terbit-bundle-${process.pid}`)
const OUT = join(BUNDLE_DIR, '.migration-out')

let h: QuestionsHarness
const sql = (t: string, p: unknown[] = []) => h.pool.query(t, p)

beforeAll(async () => {
  h = await bootQuestions()
  await sql(`insert into staging_cloud.paper_statuses (id, slug) values (91, 'published') on conflict (id) do update set slug = excluded.slug`)
  await sql(`insert into archive_cloud.selection_rules (id, slug) values (1, 'answer_all') on conflict (id) do nothing`)
  const t4 = { subject: 2, level: 2, chapter: 3, topic: 3 }
  await addArchive(h.pool, [{ id: 952, ...t4 }])
  await sql(`update education_levels set stage = 'upper_secondary', is_active = true where code = 'T4'`)
  await h.both()
  // 871: published in V2 with a duration; 872: published in V2 with none (served untimed in V2).
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id) values (871, 'Kertas Bundle Bermasa', 2, '1', 90, 91), (872, 'Kertas Bundle Tanpa Tempoh', 2, '1', null, 91)`)
  await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values (71, 871, 'Bahagian A', 1, 1), (72, 872, 'Bahagian A', 1, 1)`)
  await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, position) values (7071, 871, 1, 1), (7072, 872, 1, 1)`)
  await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values (9071, 'questions', '952', 'exam_question', 7071), (9072, 'questions', '952', 'exam_question', 7072)`)
  await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order) values (71, 7071, 71, 1), (72, 7072, 72, 1)`)
  const base = { pool: h.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 5 }
  for (const mode of ['dry-run', 'apply'] as const) expect((await runPapers({ ...base, mode })).report.status).toBe('succeeded')
  mkdirSync(OUT, { recursive: true })
  await build({
    root: API,
    configFile: join(API, 'vite.build.terbit.config.ts'),
    logLevel: 'silent',
    build: { outDir: BUNDLE_DIR, emptyOutDir: false, sourcemap: false },
  })
}, 900_000)
afterAll(async () => {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
  await h?.close()
})

describe('node dist/migrate-terbit.js', () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [join(BUNDLE_DIR, 'migrate-terbit.js'), ...args, '--out-dir', OUT], {
      cwd: API,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        DATABASE_URL: h.h.env.db.url,
        PP_ALLOW_MIGRATE_APPLY: '1',
        COOKIE_SECURE: 'false',
        SESSION_SECRET: 'x'.repeat(32),
        LEGACY_BCRYPT_DUMMY_COST: '4',
        LOGIN_FAILURE_FLOOR_MS: '0',
      },
      timeout: 240_000,
    })

  it('a dry-run only counts: nothing is published', async () => {
    const r = run()
    expect(r.status, r.stderr + r.stdout).toBe(0)
    expect(r.stdout).toMatch(/dry-run: 2 candidate\(s\), 0 held at load, 2 would go to the gate/)
    expect(await h.count('papers', `t.status = 'published'`)).toBe(0)
  }, 300_000)

  it('--apply publishes through the real BuilderService.publish (audited override), timed and untimed, and a second run publishes nothing', async () => {
    const r = run('--apply')
    expect(r.status, r.stderr + r.stdout).toBe(0)
    expect(r.stdout).toContain('terbit published: 2')
    expect(r.stdout).toContain('terbit legacy: 2')
    expect(r.stdout).toContain('terbit failed: 0')
    const rows = await h.q(`select title, status, printed_duration_min, legacy_untimed from papers where title like 'Kertas Bundle%' order by title`)
    expect(rows).toEqual([
      { title: 'Kertas Bundle Bermasa', status: 'published', printed_duration_min: 90, legacy_untimed: false },
      { title: 'Kertas Bundle Tanpa Tempoh', status: 'published', printed_duration_min: 0, legacy_untimed: true },
    ])
    const audit = await h.q<{ detail: { reason?: string } }>(`select detail from audit_events where action = 'bijak.paper.published_override'`)
    expect(audit).toHaveLength(2)
    expect(audit.every((a) => a.detail.reason === LEGACY_PUBLISH_REASON)).toBe(true)
    const csvName = readdirSync(OUT).find((f) => f.startsWith('papers-terbit-'))
    expect(csvName).toBeDefined()
    expect(existsSync(join(OUT, csvName as string))).toBe(true)
    expect(readFileSync(join(OUT, csvName as string), 'utf8').split('\n').filter((l) => l.includes(',published,yes,'))).toHaveLength(2)

    const again = run('--apply')
    expect(again.status, again.stderr + again.stdout).toBe(0)
    expect(again.stdout).toContain('terbit considered: 0')
  }, 600_000)
})
