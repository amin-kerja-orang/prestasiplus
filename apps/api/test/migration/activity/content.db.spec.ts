/**
 * BE-29 Part B, content group against a real PostgreSQL: articles, banners, notes, videos and Audio KBAT sets.
 *
 * The staging spec does not carry every column the v2 content tables need (article content, note subject and grade, video
 * category, audio level and subject; the lead's Perlu pengesahan rows). Three runs show the three states:
 *   R1  no content owner:      owner-bound rows are ORPHAN_PARENT;
 *   R2  owner, spec as it is:  the unsourced NOT NULL columns reject the row INVALID_VALUE, never invented;
 *   R3  owner + the missing columns injected into the extract (what the steps do once the spec has them): rows load.
 * Only the content group runs. Staged values are synthetic.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { contentGroup } from '../../../src/migration/load/activity/part-b'
import { bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness
let u: string[] = []
let ownerV2 = ''
let level = ''
let subject = ''
const groups = [contentGroup]

interface RunOut {
  runId: string
  status: string
  reasons: Record<string, number>
  notes: Map<string, number>
  recon: Record<string, { source: number; eligible: number; loaded: number; rejected: number }>
}

/** Adds columns the staging spec does not have yet to the rows an entity reads, by source id. */
const inject =
  (extra: Record<string, Record<string, Record<string, string>>>) =>
  (steps: AnyEntityStep[]): AnyEntityStep[] =>
    steps.map((step) => {
      const add = extra[step.entity]
      if (!add) return step
      return {
        ...step,
        extract: (after: string | null) =>
          (async function* () {
            for await (const row of step.extract(after) as AsyncIterable<Record<string, string | null>>) yield { ...row, ...(add[row.id as string] ?? {}) }
          })(),
      }
    })

async function runApply(extra: Parameters<ActivityHarness['run']>[1] = {}): Promise<RunOut> {
  const dry = await h.run('dry-run', { groups, ...extra })
  expect(dry.report.status).toBe('succeeded')
  const applied = await h.run('apply', { groups, ...extra })
  const rows = await h.q<{ entity: string; reason: string; column_name: string; n: number }>(
    `select entity, reason, column_name, count(*)::int n from etl_rejects where run_id = $1 group by 1, 2, 3`, [applied.report.runId],
  )
  return {
    runId: applied.report.runId,
    status: applied.report.status,
    reasons: Object.fromEntries(rows.map((r) => [`${r.entity}|${r.reason}|${r.column_name}`, r.n])),
    notes: applied.activity.notes.counters,
    recon: Object.fromEntries(applied.report.recon.map((r) => [r.entity, { source: r.sourceCount, eligible: r.eligibleCount, loaded: r.loaded, rejected: r.rejected }])),
  }
}

const n = (r: RunOut, entity: string, reason: string, column: string): number => r.reasons[`${entity}|${reason}|${column}`] ?? 0

let r1: RunOut
let r2: RunOut
let r3: RunOut

beforeAll(async () => {
  h = await bootActivity()
  const q = (sql: string) => h.env.pool.query(sql)
  u = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' order by legacy_id::bigint limit 2`)).map((r) => r.legacy_id)
  ownerV2 = (await h.q<{ new_id: string }>(`select new_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' and legacy_id = $1`, [u[1]]))[0]?.new_id ?? ''
  level = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'education_levels' order by legacy_id::bigint limit 1`))[0]?.legacy_id ?? ''
  subject = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'subjects' order by legacy_id::bigint limit 1`))[0]?.legacy_id ?? ''
  expect([u.length, ownerV2 !== '', level !== '', subject !== '']).toEqual([2, true, true, true])

  for (const t of ['articles', 'banners', 'notes', 'videos', 'audio_kbat']) await q(`delete from staging_cloud.${t}`)
  await q(`insert into staging_cloud.articles (id, slug, category, title, views, is_published, author_id) values
    (1, 'artikel-a', 'umum', 'Artikel A', 5, '1', ${u[0]}),
    (2, 'artikel-a', 'berita', 'Artikel B', 0, '0', ${u[0]}),
    (3, 'artikel-c', 'tidak_wujud', 'Artikel C', 0, '1', ${u[0]}),
    (4, 'artikel-d', 'motivasi', 'Artikel D', 0, '1', 99999)`)
  await q(`insert into staging_cloud.banners (id, title, type, target, image_path, starts_at, ends_at, sort_order, is_active) values
    (1, 'Sepanduk A', 'hero', 'https://contoh.invalid/laman', 'banners/a.png', '2026-03-01T17:00:00Z', '2026-03-10T00:00:00Z', 2, '1'),
    (2, 'Sepanduk B', 'promo', '/relatif', null, null, null, 1, '0'),
    (3, 'Sepanduk C', 'event', null, null, '2026-03-10T00:00:00Z', '2026-03-01T00:00:00Z', 0, '1'),
    (4, 'Sepanduk D', 'xyz', null, null, null, null, 0, '1')`)
  await q(`insert into staging_cloud.notes (id, title, note_type, body, views, is_published) values
    (1, 'Nota A', 'formula', 'Isi nota A', 3, '1'), (2, 'Nota B', 'tidak_ada', 'Isi nota B', 0, '0')`)
  await q(`insert into staging_cloud.videos (id, title, url, duration_seconds, is_published) values
    (1, 'Video A', 'https://www.youtube.com/watch?v=abc123', 60, '1'),
    (2, 'Video B', 'https://vimeo.com/123456', null, '0'),
    (3, 'Video C', 'ftp://contoh.invalid/c', null, '1')`)
  await q(`insert into staging_cloud.audio_kbat (id, title, audio_path, status) values
    (1, 'Audio A', 'audio/a.mp3', 'draft'), (2, 'Audio B', null, 'tidak_dikenali')`)

  r1 = await runApply()
  r2 = await runApply({ contentOwnerUserId: ownerV2 })
  r3 = await runApply({
    contentOwnerUserId: ownerV2,
    transformSteps: inject({
      articles: { '1': { content: '<p>Isi</p>' }, '2': { content: '<p>Isi</p>' }, '3': { content: '<p>Isi</p>' }, '4': { content: '<p>Isi</p>' } },
      notes: { '1': { subject: 'matematik', grade: 'Tingkatan 4' }, '2': { subject: 'matematik', grade: 'Tingkatan 4' } },
      videos: { '1': { category: 'tutorial' }, '2': { category: 'tutorial' }, '3': { category: 'tutorial' } },
      audio_kbat_sets: { '1': { education_level_id: level, subject_id: subject }, '2': { education_level_id: level, subject_id: subject } },
    }),
  })
}, 600_000)
afterAll(async () => {
  await h?.close()
})

describe('R1: no content owner', () => {
  it('rejects notes, videos and audio sets ORPHAN_PARENT (the owner column), and loads nothing for them', async () => {
    expect(r1.status).toBe('succeeded')
    expect(n(r1, 'notes', 'ORPHAN_PARENT', 'author_id')).toBe(2)
    expect(n(r1, 'videos', 'ORPHAN_PARENT', 'uploader_id')).toBe(3)
    expect(n(r1, 'audio_kbat_sets', 'ORPHAN_PARENT', 'created_by_id')).toBe(2)
  })

  it('an owner id that is not a v2 user is the same as no owner', async () => {
    // The owner is part of the input hash, so this apply needs its own dry-run.
    await h.run('dry-run', { groups, contentOwnerUserId: '987654321' })
    const bad = await h.run('apply', { groups, contentOwnerUserId: '987654321' })
    const rows = await h.q<{ n: number }>(`select count(*)::int n from etl_rejects where run_id = $1 and entity = 'notes' and reason = 'ORPHAN_PARENT'`, [bad.report.runId])
    expect(rows[0]?.n).toBe(2)
  })
})

describe('R2: owner, staging spec as it is', () => {
  it('rejects INVALID_VALUE naming the column that has no staged source', () => {
    expect(r2.status).toBe('succeeded')
    expect(n(r2, 'articles', 'INVALID_VALUE', 'content')).toBe(2) // ids 1 and 2
    expect(n(r2, 'notes', 'INVALID_VALUE', 'subject')).toBe(1) // id 1; id 2 has an unknown type
    expect(n(r2, 'notes', 'UNKNOWN_ENUM', 'note_type')).toBe(1)
    expect(n(r2, 'videos', 'INVALID_VALUE', 'category')).toBe(1)
    expect(n(r2, 'audio_kbat_sets', 'INVALID_VALUE', 'education_level_id')).toBe(1)
  })
})

describe('R3: owner and the missing columns present', () => {
  it('loads the notes, video and audio set with the owner as author, and rejects what cannot be represented', async () => {
    expect(r3.status).toBe('succeeded')
    const notes = await h.q<{ legacy_id: string; author_id: string; note_type: string; is_published: boolean }>(`select legacy_id, author_id::text, note_type, is_published from notes`)
    expect(notes).toEqual([{ legacy_id: '1', author_id: ownerV2, note_type: 'FORMULA', is_published: true }])
    const videos = await h.q<{ legacy_id: string; platform: string; uploader_id: string }>(`select legacy_id, platform, uploader_id::text from videos`)
    expect(videos).toEqual([{ legacy_id: '1', platform: 'Youtube', uploader_id: ownerV2 }])
    expect(n(r3, 'videos', 'UNSUPPORTED', 'is_published')).toBe(1) // v2 videos have no draft state
    expect(n(r3, 'videos', 'INVALID_VALUE', 'url')).toBe(1)
    const sets = await h.q<{ legacy_id: string; created_by_id: string; status: string }>(`select legacy_id, created_by_id::text, status from audio_kbat_sets`)
    expect(sets).toEqual([{ legacy_id: '1', created_by_id: ownerV2, status: 'draft' }])
    expect(n(r3, 'audio_kbat_sets', 'UNKNOWN_ENUM', 'status')).toBe(1)
  })

  it('articles: a slug clash is DUPLICATE_KEY, the category and author are checked, published_at follows is_published', async () => {
    const rows = await h.q<{ legacy_id: string; slug: string; category: string; author_id: string; published: boolean }>(
      `select legacy_id, slug, category, author_id::text, (published_at is not null) as published from articles`,
    )
    expect(rows).toEqual([{ legacy_id: '1', slug: 'artikel-a', category: 'UMUM', author_id: await v2User(u[0] as string), published: true }])
    expect(n(r3, 'articles', 'DUPLICATE_KEY', 'slug')).toBe(1)
    expect(n(r3, 'articles', 'UNKNOWN_ENUM', 'category')).toBe(1)
    expect(n(r3, 'articles', 'ORPHAN_PARENT', 'author_id')).toBe(1)
  })
})

describe('banners', () => {
  it('loads with Malaysia dates, keeps an absolute http(s) target as the link, and no file id', async () => {
    const rows = await h.q<{ legacy_id: string; banner_type: string; link_type: string; external_url: string | null; start_date: string | null; end_date: string | null; display_order: number; is_active: boolean; image_file_id: string | null }>(
      `select legacy_id, banner_type, link_type, external_url, start_date::text, end_date::text, display_order, is_active, image_file_id::text from banners order by legacy_id`,
    )
    expect(rows).toEqual([
      { legacy_id: '1', banner_type: 'HERO', link_type: 'EXTERNAL', external_url: 'https://contoh.invalid/laman', start_date: '2026-03-02', end_date: '2026-03-10', display_order: 2, is_active: true, image_file_id: null },
      { legacy_id: '2', banner_type: 'PROMO', link_type: 'NONE', external_url: null, start_date: null, end_date: null, display_order: 1, is_active: false, image_file_id: null },
    ])
    expect(n(r1, 'banners', 'INVALID_VALUE', 'end_date')).toBe(1)
    expect(n(r1, 'banners', 'UNKNOWN_ENUM', 'type')).toBe(1)
  })

  it('counts the rows that had a source path or a target that is not a link, in the report notes', () => {
    expect(r1.notes.get('file_migration_off.banners.image_path')).toBe(1)
    expect(r1.notes.get('banners.target_not_a_link')).toBe(1)
    expect(r1.notes.get('file_migration_off.audio_kbat.audio_path')).toBe(1)
  })

  it('reconciles every entity of the group (eligible - loaded - rejected = 0)', () => {
    for (const r of [r1, r2, r3]) {
      for (const [entity, c] of Object.entries(r.recon)) expect(c.eligible - c.loaded - c.rejected, entity).toBe(0)
    }
  })
})

async function v2User(legacyId: string): Promise<string> {
  return (await h.q<{ new_id: string }>(`select new_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' and legacy_id = $1`, [legacyId]))[0]?.new_id ?? ''
}
