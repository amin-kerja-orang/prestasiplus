import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))
const TABLES = [
  'articles', 'article_attachments', 'banners', 'videos', 'video_schools', 'notes', 'perutusan', 'perutusan_comments',
  'perutusan_reactions', 'perutusan_reads', 'perutusan_files', 'screenshots', 'audio_kbat_sets', 'audio_kbat_attempts',
  'support_config', 'support_tickets',
]
const MIGRATABLE = ['articles', 'audio_kbat_sets', 'banners', 'notes', 'support_tickets', 'videos']

describe('content and support schema (migration 0009_content_support)', () => {
  let db: TestDatabase
  let userId: string
  let user2Id: string
  let schoolId: string
  let school2Id: string
  let n = 0

  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const columns = async (table: string): Promise<string[]> =>
    (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = $1`, [table])).map((c) => c.column_name)
  const one = async (sql: string, params: unknown[] = []): Promise<string> => (await db.query<{ id: string }>(`${sql} returning id::text`, params))[0]!.id
  const count = async (table: string): Promise<number> => Number((await db.query<{ n: string }>(`select count(*)::text n from ${table}`))[0]!.n)
  const file = (): Promise<string> =>
    one(
      `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'cms_image', 'image/png', 1, $2, $3)`,
      [`F${String(n).padStart(21, '0')}`, '0'.repeat(64), `cms_image/k${n++}.png`],
    )
  const perutusan = (): Promise<string> =>
    one(`insert into perutusan (title, body, scope, author_id) values ('Tajuk', 'Isi', 'national', $1)`, [userId])
  const video = (): Promise<string> =>
    one(`insert into videos (video_url, platform, title, category, uploader_id) values ('https://example.test/v', 'Youtube', 'V', 'tutorial', $1)`, [userId])

  beforeAll(async () => {
    db = await createTestDatabase()
    userId = await one(`insert into users (name) values ('Pengguna A')`)
    user2Id = await one(`insert into users (name) values ('Pengguna B')`)
    schoolId = await one(`insert into schools (name, code) values ('Sekolah A', 'CA1')`)
    school2Id = await one(`insert into schools (name, code) values ('Sekolah B', 'CB1')`)
  })
  afterAll(async () => {
    await db.drop()
  })

  it('creates the sixteen tables', async () => {
    for (const t of TABLES) expect((await columns(t)).length, t).toBeGreaterThan(0)
  })

  it('lists exactly the six tables with a .cloud source as migratable, with the legacy pair and unique', async () => {
    const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as string[]
    expect([...models].sort()).toEqual(models)
    for (const t of MIGRATABLE) {
      expect(models, t).toContain(t)
      expect(await columns(t)).toEqual(expect.arrayContaining(['legacy_source', 'legacy_id']))
      expect(await db.query(`select 1 from pg_indexes where indexname = $1`, [`uq_${t}_legacy`])).toHaveLength(1)
    }
    for (const t of TABLES.filter((x) => !MIGRATABLE.includes(x))) {
      expect(models, t).not.toContain(t)
      expect(await columns(t), t).not.toContain('legacy_source')
    }
  })

  it('uses identity ids (GENERATED ALWAYS) on every table except the singleton', async () => {
    for (const t of TABLES.filter((x) => x !== 'support_config')) {
      const [c] = await db.query<{ is_identity: string; identity_generation: string }>(
        `select is_identity, identity_generation from information_schema.columns where table_name = $1 and column_name = 'id'`,
        [t],
      )
      expect(c, t).toEqual({ is_identity: 'YES', identity_generation: 'ALWAYS' })
    }
  })

  it('articles: unique slug, category and grade checks, defaults, author FK, legacy source check', async () => {
    await db.query(`insert into articles (title, slug, content, category, author_id) values ('T', 'slug-unik', '<p>x</p>', 'UMUM', $1)`, [userId])
    expect(await rejects(`insert into articles (title, slug, content, category, author_id) values ('T', 'slug-unik', 'x', 'UMUM', $1)`, [userId])).toContain('uq_articles_slug')
    expect(await rejects(`insert into articles (title, slug, content, category, author_id) values ('T', 's2', 'x', 'umum', $1)`, [userId])).toContain('ck_articles_category')
    expect(await rejects(`insert into articles (title, slug, content, category, grade_level, author_id) values ('T', 's3', 'x', 'UMUM', 'DARJAH_7', $1)`, [userId])).toContain('ck_articles_grade_level')
    expect(await rejects(`insert into articles (title, slug, content, category, author_id, legacy_source) values ('T', 's4', 'x', 'UMUM', $1, 'other')`, [userId])).toContain('ck_articles_legacy_source')
    const [a] = await db.query<{ grade_level: string; is_published: boolean; views: number }>(`select grade_level, is_published, views from articles where slug = 'slug-unik'`)
    expect(a).toEqual({ grade_level: 'SEMUA', is_published: false, views: 0 })
    expect(await rejects(`insert into articles (title, slug, content, category, author_id) values ('T', 's5', 'x', 'UMUM', 999999)`)).toContain('fk_articles_author_id')
  })

  it('articles: featured image is a files FK set null when the file goes; attachments cascade with the article', async () => {
    const f = await file()
    const a = await one(`insert into articles (title, slug, content, category, author_id, featured_image_file_id) values ('T', 'dengan-gambar', 'x', 'BERITA', $1, $2)`, [userId, f])
    await db.query(`delete from files where id = $1`, [f])
    expect((await db.query(`select featured_image_file_id from articles where id = $1`, [a]))[0]!.featured_image_file_id).toBeNull()
    const f2 = await file()
    await db.query(`insert into article_attachments (article_id, file_id, label) values ($1, $2, 'Lampiran')`, [a, f2])
    expect(await rejects(`insert into article_attachments (article_id, file_id) values ($1, $2)`, [a, f2])).toContain('uq_article_attachments_article_file')
    expect(await rejects(`delete from files where id = $1`, [f2])).toContain('fk_article_attachments_file_id')
    await db.query(`delete from articles where id = $1`, [a])
    expect(await count('article_attachments')).toBe(0)
  })

  it('banners: placement, link and audience checks, defaults, date order', async () => {
    await db.query(`insert into banners (title, banner_type) values ('B', 'HERO')`)
    const [b] = await db.query<{ link_type: string; target_audience: string; is_active: boolean; display_order: number }>(`select link_type, target_audience, is_active, display_order from banners where title = 'B'`)
    expect(b).toEqual({ link_type: 'NONE', target_audience: 'ALL', is_active: true, display_order: 0 })
    expect(await rejects(`insert into banners (title, banner_type) values ('B', 'SIDEBAR')`)).toContain('ck_banners_banner_type')
    expect(await rejects(`insert into banners (title, banner_type, link_type) values ('B', 'HERO', 'PAGE')`)).toContain('ck_banners_link_type')
    expect(await rejects(`insert into banners (title, banner_type, target_audience) values ('B', 'HERO', 'PARENT')`)).toContain('ck_banners_target_audience')
    expect(await rejects(`insert into banners (title, banner_type, start_date, end_date) values ('B', 'HERO', '2026-02-01', '2026-01-01')`)).toContain('ck_banners_dates')
    expect(await rejects(`insert into banners (title, banner_type, image_file_id) values ('B', 'HERO', 999999)`)).toContain('fk_banners_image_file_id')
  })

  it('videos: platform, category and visibility checks; video_schools unique and cascading', async () => {
    const v = await video()
    expect(await rejects(`insert into videos (video_url, platform, title, category, uploader_id) values ('u', 'youtube', 'V', 'tutorial', $1)`, [userId])).toContain('ck_videos_platform')
    expect(await rejects(`insert into videos (video_url, platform, title, category, uploader_id) values ('u', 'Youtube', 'V', 'lain', $1)`, [userId])).toContain('ck_videos_category')
    expect(await rejects(`insert into videos (video_url, platform, title, category, visibility, uploader_id) values ('u', 'Youtube', 'V', 'tutorial', 'public', $1)`, [userId])).toContain('ck_videos_visibility')
    expect((await db.query(`select visibility, views, subject_id from videos where id = $1`, [v]))[0]).toEqual({ visibility: 'global', views: 0, subject_id: null })
    await db.query(`insert into video_schools (video_id, school_id) values ($1, $2)`, [v, schoolId])
    await db.query(`insert into video_schools (video_id, school_id) values ($1, $2)`, [v, school2Id])
    expect(await rejects(`insert into video_schools (video_id, school_id) values ($1, $2)`, [v, schoolId])).toContain('uq_video_schools_video_school')
    await db.query(`delete from videos where id = $1`, [v])
    expect(await count('video_schools')).toBe(0)
  })

  it('notes: subject and type checks', async () => {
    await db.query(`insert into notes (title, content, subject, note_type, grade, author_id) values ('N', 'x', 'sains', 'MIND_MAP', 'DARJAH_6', $1)`, [userId])
    expect(await rejects(`insert into notes (title, content, subject, note_type, grade, author_id) values ('N', 'x', 'geografi', 'LENGKAP', 'T4', $1)`, [userId])).toContain('ck_notes_subject')
    expect(await rejects(`insert into notes (title, content, subject, note_type, grade, author_id) values ('N', 'x', 'sains', 'VIDEO', 'T4', $1)`, [userId])).toContain('ck_notes_note_type')
  })

  it('perutusan: status and scope checks, scheduled needs a time, default draft', async () => {
    const p = await perutusan()
    expect((await db.query(`select status, is_pinned, is_public from perutusan where id = $1`, [p]))[0]).toEqual({ status: 'draft', is_pinned: false, is_public: false })
    expect(await rejects(`insert into perutusan (title, body, scope, status, author_id) values ('T', 'B', 'national', 'archived', $1)`, [userId])).toContain('ck_perutusan_status')
    expect(await rejects(`insert into perutusan (title, body, scope, author_id) values ('T', 'B', 'state', $1)`, [userId])).toContain('ck_perutusan_scope')
    expect(await rejects(`insert into perutusan (title, body, scope, status, author_id) values ('T', 'B', 'national', 'scheduled', $1)`, [userId])).toContain('ck_perutusan_scheduled')
    await db.query(`insert into perutusan (title, body, scope, school_id, author_id) values ('T', 'B', 'school', $1, $2)`, [schoolId, userId])
  })

  it('perutusan_files: kind check, file FK, cascade with the perutusan (OD-28)', async () => {
    const p = await perutusan()
    const [f1, f2, f3] = [await file(), await file(), await file()]
    await db.query(`insert into perutusan_files (perutusan_id, file_id, kind, position) values ($1, $2, 'image', 0), ($1, $3, 'image', 1), ($1, $4, 'document', 0)`, [p, f1, f2, f3])
    expect(await rejects(`insert into perutusan_files (perutusan_id, file_id, kind) values ($1, $2, 'video')`, [p, f1])).toContain('ck_perutusan_files_kind')
    expect(await rejects(`insert into perutusan_files (perutusan_id, file_id, kind) values ($1, 999999, 'image')`, [p])).toContain('fk_perutusan_files_file_id')
    expect(await rejects(`insert into perutusan_files (perutusan_id, file_id, kind) values (999999, $1, 'image')`, [f1])).toContain('fk_perutusan_files_perutusan_id')
    expect((await db.query(`select kind, count(*)::int n from perutusan_files where perutusan_id = $1 group by kind order by kind`, [p])).map((r) => [r.kind, r.n])).toEqual([['document', 1], ['image', 2]])
    await db.query(`delete from perutusan where id = $1`, [p])
    expect(await db.query(`select 1 from perutusan_files where perutusan_id = $1`, [p])).toHaveLength(0)
    expect(await db.query(`select 1 from files where id = $1`, [f1])).toHaveLength(1)
  })

  it('perutusan comments, reactions and reads: checks, uniques, cascades', async () => {
    const p = await perutusan()
    await db.query(`insert into perutusan_comments (perutusan_id, user_id, body) values ($1, $2, 'Komen')`, [p, userId])
    expect((await db.query(`select status from perutusan_comments where perutusan_id = $1`, [p]))[0]!.status).toBe('pending')
    expect(await rejects(`insert into perutusan_comments (perutusan_id, user_id, body, status) values ($1, $2, 'K', 'spam')`, [p, userId])).toContain('ck_perutusan_comments_status')

    await db.query(`insert into perutusan_reactions (perutusan_id, user_id, kind) values ($1, $2, 'like'), ($1, $2, 'love'), ($1, $3, 'like')`, [p, userId, user2Id])
    expect(await rejects(`insert into perutusan_reactions (perutusan_id, user_id, kind) values ($1, $2, 'like')`, [p, userId])).toContain('uq_perutusan_reactions_perutusan_user_kind')
    expect(await rejects(`insert into perutusan_reactions (perutusan_id, user_id, kind) values ($1, $2, 'angry')`, [p, userId])).toContain('ck_perutusan_reactions_kind')

    await db.query(`insert into perutusan_reads (perutusan_id, user_id) values ($1, $2)`, [p, userId])
    expect(await rejects(`insert into perutusan_reads (perutusan_id, user_id) values ($1, $2)`, [p, userId])).toContain('uq_perutusan_reads_perutusan_user')

    await db.query(`delete from perutusan where id = $1`, [p])
    for (const t of ['perutusan_comments', 'perutusan_reactions', 'perutusan_reads']) expect(await db.query(`select 1 from ${t} where perutusan_id = $1`, [p]), t).toHaveLength(0)
  })

  it('screenshots: file and uploader FKs', async () => {
    const f = await file()
    await db.query(`insert into screenshots (file_id, original_name, uploaded_by_id) values ($1, 'tangkap.png', $2)`, [f, userId])
    expect(await rejects(`insert into screenshots (file_id, original_name, uploaded_by_id) values (999999, 'x.png', $1)`, [userId])).toContain('fk_screenshots_file_id')
    expect(await rejects(`delete from files where id = $1`, [f])).toContain('fk_screenshots_file_id')
  })

  it('audio_kbat_sets and attempts: status check, json arrays, curriculum FKs, attempt score rules', async () => {
    const levelId = await one(`insert into education_levels (code, name, name_en, stage, curriculum) values ('SCH1', 'Tahap', 'Level', 'primary', 'KSSR')`)
    const subjectId = await one(`insert into subjects (code, name, name_en, color) values ('SCH1', 'Subjek', 'Subject', '#4f46e5')`)
    const s = await one(`insert into audio_kbat_sets (title, education_level_id, subject_id, created_by_id) values ('Set', $1, $2, $3)`, [levelId, subjectId, userId])
    expect((await db.query(`select status, sections, questions from audio_kbat_sets where id = $1`, [s]))[0]).toEqual({ status: 'draft', sections: [], questions: [] })
    expect(await rejects(`insert into audio_kbat_sets (title, education_level_id, subject_id, status, created_by_id) values ('S', $2, $3, 'live', $1)`, [userId, levelId, subjectId])).toContain('ck_audio_kbat_sets_status')
    expect(await rejects(`insert into audio_kbat_sets (title, education_level_id, subject_id, sections, created_by_id) values ('S', $2, $3, '{}', $1)`, [userId, levelId, subjectId])).toContain('ck_audio_kbat_sets_documents')
    // FKs to curriculum (BE-08) besides created_by_id; an unknown level or subject is refused, and a used one cannot be deleted.
    const fks = await db.query<{ constraint_name: string }>(`select constraint_name from information_schema.table_constraints where table_name = 'audio_kbat_sets' and constraint_type = 'FOREIGN KEY'`)
    expect(fks.map((r) => r.constraint_name).sort()).toEqual(['fk_audio_kbat_sets_created_by_id', 'fk_audio_kbat_sets_education_level_id', 'fk_audio_kbat_sets_subject_id'])
    expect(await rejects(`insert into audio_kbat_sets (title, education_level_id, subject_id, created_by_id) values ('S', 999999, $1, $2)`, [subjectId, userId])).toContain('fk_audio_kbat_sets_education_level_id')
    expect(await rejects(`insert into audio_kbat_sets (title, education_level_id, subject_id, created_by_id) values ('S', $1, 999999, $2)`, [levelId, userId])).toContain('fk_audio_kbat_sets_subject_id')
    expect(await rejects(`delete from subjects where id = $1`, [subjectId])).toContain('fk_audio_kbat_sets_subject_id')
    expect(await rejects(`delete from education_levels where id = $1`, [levelId])).toContain('fk_audio_kbat_sets_education_level_id')
    // videos.subject_id is optional: an unknown subject is refused, deleting the subject clears it
    expect(await rejects(`insert into videos (video_url, platform, title, category, uploader_id, subject_id) values ('u', 'Youtube', 'V', 'tutorial', $1, 999999)`, [userId])).toContain('fk_videos_subject_id')
    const vs = await one(`insert into videos (video_url, platform, title, category, uploader_id, subject_id) values ('u', 'Youtube', 'V', 'tutorial', $1, $2)`, [userId, subjectId])

    await db.query(`insert into audio_kbat_attempts (set_id, user_id, answers, score, total_marks) values ($1, $2, '[{"no":1,"choice":"A"}]', 1, 30)`, [s, userId])
    expect(await rejects(`insert into audio_kbat_attempts (set_id, user_id, answers, score, total_marks) values ($1, $2, '[]', 31, 30)`, [s, userId])).toContain('ck_audio_kbat_attempts_score')
    expect(await rejects(`insert into audio_kbat_attempts (set_id, user_id, answers, score, total_marks) values ($1, $2, '{}', 0, 30)`, [s, userId])).toContain('ck_audio_kbat_attempts_answers')
    expect((await db.query(`select is_test from audio_kbat_attempts`))[0]!.is_test).toBe(false)
    await db.query(`delete from audio_kbat_sets where id = $1`, [s])
    expect(await count('audio_kbat_attempts')).toBe(0)
    await db.query(`delete from subjects where id = $1`, [subjectId])
    expect((await db.query(`select subject_id from videos where id = $1`, [vs]))[0]).toEqual({ subject_id: null })
    await db.query(`delete from videos where id = $1`, [vs])
    await db.query(`delete from education_levels where id = $1`, [levelId])
  })

  it('support_config is a singleton row (id = 1)', async () => {
    await db.query(`insert into support_config (id, email, whatsapp_number) values (1, 'a@demo.test', '600')`)
    expect(await rejects(`insert into support_config (id, email, whatsapp_number) values (2, 'b@demo.test', '601')`)).toContain('ck_support_config_singleton')
    expect(await rejects(`insert into support_config (id, email, whatsapp_number) values (1, 'c@demo.test', '602')`)).toContain('support_config_pkey')
  })

  it('support_tickets: status and subject checks, defaults, indexes, user FK cascade', async () => {
    const t = await one(`insert into support_tickets (user_id, subject, body) values ($1, 'Subjek', 'Butiran')`, [user2Id])
    expect((await db.query(`select status, is_test, admin_reply from support_tickets where id = $1`, [t]))[0]).toEqual({ status: 'dibuka', is_test: false, admin_reply: null })
    expect(await rejects(`insert into support_tickets (user_id, subject, body, status) values ($1, 'S', 'B', 'open')`, [user2Id])).toContain('ck_support_tickets_status')
    expect(await rejects(`insert into support_tickets (user_id, subject, body) values ($1, '', 'B')`, [user2Id])).toContain('ck_support_tickets_subject')
    expect(await rejects(`insert into support_tickets (user_id, subject, body) values ($1, $2, 'B')`, [user2Id, 'x'.repeat(256)])).toContain('too long')
    const [idx] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_support_tickets_open'`)
    expect(idx!.indexdef).toContain(`status = 'dibuka'`)
    for (const name of ['ix_support_tickets_user_status_created', 'ix_articles_published', 'ix_articles_category_published', 'uq_articles_slug', 'ix_videos_visibility_school']) {
      expect(await db.query(`select 1 from pg_indexes where indexname = $1`, [name]), name).toHaveLength(1)
    }
    await db.query(`delete from users where id = $1`, [user2Id])
    expect(await db.query(`select 1 from support_tickets where id = $1`, [t])).toHaveLength(0)
  })
})
