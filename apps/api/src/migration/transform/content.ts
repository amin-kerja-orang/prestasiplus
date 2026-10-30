/**
 * Content transforms of `migrate:activity` (BE-29 Part B): articles, banners, notes, videos, Audio KBAT sets.
 * Pure functions; the loaders resolve the author / owner and the Malaysia dates. An article whose author does not resolve
 * falls back to the content owner (D1, LEAD 29 Oct; `articleAuthor`).
 *
 * Without `--files-dir` every `*_file_id` stays null and the loader only counts the rows that had
 * a source path. A v2 NOT NULL column that the staged table cannot give (note subject and grade, video category,
 * audio set level and subject; article content when the staged `body` is NULL) rejects the row as INVALID_VALUE
 * naming the v2 column (the article `body` is staged since D1, LEAD 29 Oct, and becomes the v2 `content`; .cloud has no
 * article excerpt, so the v2 `excerpt` is null); the
 * transforms read such a column from the staged row when the staging spec carries it (after the real export
 * completes the spec), so no code change is needed then. Nothing is invented.
 */
import type { HtmlSanitizer } from '../../modules/content/shared/html-sanitizer'
import { SanitizeHtmlSanitizer } from '../../modules/content/shared/sanitize-html.sanitizer'
import { isAllowedHost } from '../../modules/content/videos/videos.service'
import { enumMapper, flag, invalid, nonNegativeInt, orphan, unsupported } from './activity-common'
import { ok, squash, stamps, text, type Outcome, type Staged } from './activity-common'

const len = (s: string): number => Array.from(s).length

/**
 * Legacy HTML reaches pupils, so article `content` and note `body` go through the SAME sanitiser the API applies on write
 * (`SanitizeHtmlSanitizer`, bound to `HTML_SANITIZER` in `ContentSharedModule`); the API only sanitises on write and returns
 * the stored value on read. The default has no `PUBLIC_ORIGINS` (an image is kept only as a relative stored-file path);
 * the loader passes the run's own origins so the result equals what the API would store. Pure and deterministic.
 */
const DEFAULT_SANITIZER: HtmlSanitizer = new SanitizeHtmlSanitizer([])

/** An optional text column of the staged row: blank is null; absent from the spec is also null (the caller decides). */
const optText = (row: Staged, column: string): string | null => text(row[column])

// ---------------------------------------------------------------- articles

export const ARTICLE_CATEGORY_MAP: Readonly<Record<string, string>> = {
  tips_belajar: 'TIPS_BELAJAR',
  berita: 'BERITA',
  motivasi: 'MOTIVASI',
  panduan_ibu_bapa: 'PANDUAN_IBU_BAPA',
  panduan_guru: 'PANDUAN_GURU',
  kejayaan: 'KEJAYAAN',
  umum: 'UMUM',
}
export const ARTICLE_GRADE_MAP: Readonly<Record<string, string>> = {
  semua: 'SEMUA',
  darjah_1: 'DARJAH_1',
  darjah_2: 'DARJAH_2',
  darjah_3: 'DARJAH_3',
  darjah_4: 'DARJAH_4',
  darjah_5: 'DARJAH_5',
  darjah_6: 'DARJAH_6',
}
const articleCategory = enumMapper('category', ARTICLE_CATEGORY_MAP)
const articleGrade = enumMapper('grade_level', ARTICLE_GRADE_MAP, { blankIsNull: true })

export interface ArticleValues {
  title: string
  slug: string
  excerpt: string | null
  content: string
  featured_image_file_id: null
  category: string
  grade_level: string
  is_published: boolean
  views: number
  author_id: string
  published_at: string | null
  created_at: string
  updated_at: string
}

/**
 * The v2 author of an article (D1, LEAD 29 Oct): the staged `author_id` when it resolves to a v2 user, else the configured
 * content owner (`--content-owner`, an ACTIVE admin), else undefined (the row is rejected ORPHAN_PARENT on `author_id`).
 * `fromOwner` is true only when the owner stood in (the loader counts it as `articles.author_from_content_owner`).
 */
export function articleAuthor(authorId: string | undefined, ownerId: string | undefined): { id: string | undefined; fromOwner: boolean } {
  if (authorId !== undefined) return { id: authorId, fromOwner: false }
  return { id: ownerId, fromOwner: ownerId !== undefined }
}

/**
 * .cloud `articles.body` (HTML) is the v2 `content`, sanitised like the API does on write; a NULL or blank `body` is
 * INVALID_VALUE on `content` (v2 NOT NULL). .cloud has no excerpt column, so the v2 `excerpt` (optional, the API also
 * stores null for an empty one) is null: nothing is derived or invented (D1, LEAD 29 Oct).
 */
export function transformArticle(
  row: Staged,
  parents: { authorId: string | undefined; ownerId?: string | undefined; sanitizer?: HtmlSanitizer },
): Outcome<ArticleValues> {
  const title = squash(row.title)
  if (title === null) return invalid('title')
  const slug = text(row.slug)
  if (slug === null || len(slug) > 200) return invalid('slug')
  const category = articleCategory(row.category)
  if (!category.ok) return category
  if (category.value === null) return invalid('category')
  const grade = articleGrade(row.grade_level)
  if (!grade.ok) return grade
  const author = articleAuthor(parents.authorId, parents.ownerId).id
  if (author === undefined) return orphan('author_id')
  const published = flag(row.is_published, false)
  if (published === 'invalid') return invalid('is_published')
  const views = nonNegativeInt(row.views)
  if (views === 'invalid') return invalid('views')
  const raw = optText(row, 'body')
  if (raw === null) return invalid('content')
  const content = (parents.sanitizer ?? DEFAULT_SANITIZER).sanitize(raw)
  const s = stamps(row)
  return ok({
    title,
    slug,
    excerpt: null,
    content,
    featured_image_file_id: null,
    category: category.value,
    grade_level: grade.value ?? 'SEMUA',
    is_published: published,
    views: views ?? 0,
    author_id: author,
    published_at: published ? s.created_at : null,
    ...s,
  })
}

// ---------------------------------------------------------------- banners

/**
 * .cloud `banners.type` -> v2 `banner_type`. v2 stores only the four form codes (`ck_banners_banner_type`: HERO, PROMO,
 * ANNOUNCEMENT, EVENT). The two legacy .cloud codes cannot be stored as they are, so A1-FIX maps them: `PROMOTIONAL` is
 * `PROMO` (same meaning), and `FEATURE` (a product-feature advert, e.g. "2,000+ Soalan Latihan Tersedia!") is `PROMO` too.
 * The alternative for `FEATURE` was `ANNOUNCEMENT`; see the deviations log.
 */
export const BANNER_TYPE_MAP: Readonly<Record<string, string>> = {
  hero: 'HERO',
  promo: 'PROMO',
  announcement: 'ANNOUNCEMENT',
  event: 'EVENT',
  promotional: 'PROMO',
  feature: 'PROMO',
}
const bannerType = enumMapper('type', BANNER_TYPE_MAP)

const HTTP_URL = /^https?:\/\/[^\s]{1,2040}$/i

export interface BannerValues {
  title: string
  description: string | null
  /** Null until the loader has copied the file (`--files-dir`) and checked its checksum. */
  image_file_id: string | null
  banner_type: string
  link_type: string
  external_url: string | null
  display_order: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BannerOutcome {
  out: Outcome<BannerValues>
  /** The row had an `image_path` (counted in the report notes, or migrated as a file with `--files-dir`). */
  hadImage: boolean
  /** The `target` was not an absolute http(s) address, so no link is kept. */
  droppedTarget: boolean
}

/**
 * `start` / `end` are the Malaysia dates the loader computed in SQL (`klDateSql`). A banner link is kept only when
 * `target` is an absolute http(s) address (link type EXTERNAL); any other target is dropped and counted.
 */
export function transformBanner(row: Staged, dates: { start: string | null; end: string | null }): BannerOutcome {
  const hadImage = text(row.image_path) !== null
  const target = text(row.target)
  const external = target !== null && HTTP_URL.test(target)
  const droppedTarget = target !== null && !external
  const fail = (o: Outcome<never>): BannerOutcome => ({ out: o, hadImage, droppedTarget })
  const title = squash(row.title)
  if (title === null) return fail(invalid('title'))
  const type = bannerType(row.type)
  if (!type.ok) return fail(type)
  if (type.value === null) return fail(invalid('type'))
  const active = flag(row.is_active, true)
  if (active === 'invalid') return fail(invalid('is_active'))
  const order = nonNegativeInt(row.sort_order)
  if (order === 'invalid') return fail(invalid('sort_order'))
  if (dates.start !== null && dates.end !== null && dates.end < dates.start) return fail(invalid('end_date'))
  return {
    hadImage,
    droppedTarget,
    out: ok({
      title,
      description: optText(row, 'description'),
      image_file_id: null,
      banner_type: type.value,
      link_type: external ? 'EXTERNAL' : 'NONE',
      external_url: external ? target : null,
      display_order: order ?? 0,
      start_date: dates.start,
      end_date: dates.end,
      is_active: active,
      ...stamps(row),
    }),
  }
}

// ---------------------------------------------------------------- notes

export const NOTE_TYPE_MAP: Readonly<Record<string, string>> = {
  formula: 'FORMULA',
  ringkasan: 'RINGKASAN',
  lengkap: 'LENGKAP',
  tips_tricks: 'TIPS_TRICKS',
  mind_map: 'MIND_MAP',
  flashcard: 'FLASHCARD',
  cheat_sheet: 'CHEAT_SHEET',
}
const noteType = enumMapper('note_type', NOTE_TYPE_MAP)
export const NOTE_SUBJECTS: readonly string[] = ['matematik', 'sains', 'bahasa_melayu', 'bahasa_inggeris', 'sejarah']

export interface NoteValues {
  title: string
  summary: string | null
  content: string
  subject: string
  note_type: string
  grade: string
  is_published: boolean
  views: number
  author_id: string
  created_at: string
  updated_at: string
}

/** `ownerId` is the configured content owner (LEAD Q7): undefined rejects ORPHAN_PARENT. `subject` and `grade` have no staged source. */
export function transformNote(row: Staged, parents: { ownerId: string | undefined; sanitizer?: HtmlSanitizer }): Outcome<NoteValues> {
  if (parents.ownerId === undefined) return orphan('author_id')
  const title = squash(row.title)
  if (title === null) return invalid('title')
  const type = noteType(row.note_type)
  if (!type.ok) return type
  if (type.value === null) return invalid('note_type')
  const published = flag(row.is_published, false)
  if (published === 'invalid') return invalid('is_published')
  const views = nonNegativeInt(row.views)
  if (views === 'invalid') return invalid('views')
  const subject = optText(row, 'subject')?.toLowerCase() ?? null
  if (subject === null || !NOTE_SUBJECTS.includes(subject)) return invalid('subject')
  const grade = optText(row, 'grade')
  if (grade === null) return invalid('grade')
  const raw = optText(row, 'body')
  if (raw === null) return invalid('content')
  const content = (parents.sanitizer ?? DEFAULT_SANITIZER).sanitize(raw)
  return ok({
    title,
    summary: optText(row, 'summary'),
    content,
    subject,
    note_type: type.value,
    grade,
    is_published: published,
    views: views ?? 0,
    author_id: parents.ownerId,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- videos

export const VIDEO_CATEGORIES: readonly string[] = ['motivasi', 'tutorial', 'tips-spm', 'ceramah', 'lain-lain']

/** The video platform from the address host (the v2 check list); anything else is `Other`. */
export function videoPlatform(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'Other'
  }
  const is = (d: string): boolean => host === d || host.endsWith(`.${d}`)
  if (is('youtube.com') || is('youtu.be') || is('youtube-nocookie.com')) return 'Youtube'
  if (is('vimeo.com')) return 'Vimeo'
  if (is('dailymotion.com') || is('dai.ly')) return 'Dailymotion'
  if (is('tiktok.com')) return 'TikTok'
  if (is('facebook.com') || is('fb.watch') || is('fb.com')) return 'Facebook'
  return 'Other'
}

export interface VideoValues {
  video_url: string
  platform: string
  title: string
  description: string | null
  category: string
  visibility: string
  uploader_id: string
  views: number
  created_at: string
  updated_at: string
}

/**
 * `.cloud` videos carry no publication flag (the real columns are title, subject, url, duration), so every staged video is
 * live there and none is rejected as a draft. Child safety (LEAD 2026-10-20, D9): the address must pass the API's own
 * `isAllowedHost` (https on a YouTube or Vimeo host), else UNSUPPORTED on `url`; the API holds every non-staff uploader
 * to the same rule.
 * `category` has no staged source: INVALID_VALUE until the spec carries it.
 */
export function transformVideo(row: Staged, parents: { ownerId: string | undefined }): Outcome<VideoValues> {
  if (parents.ownerId === undefined) return orphan('uploader_id')
  const title = squash(row.title)
  if (title === null) return invalid('title')
  const url = text(row.url)
  if (url === null || !HTTP_URL.test(url)) return invalid('url')
  if (!isAllowedHost(url)) return unsupported('url')
  const category = optText(row, 'category')?.toLowerCase() ?? null
  if (category === null || !VIDEO_CATEGORIES.includes(category)) return invalid('category')
  return ok({
    video_url: url,
    platform: videoPlatform(url),
    title,
    description: optText(row, 'description'),
    category,
    // `global` is allowed only because the owner is an ACTIVE admin: the loader refuses any other `--content-owner`
    // (see `assertContentOwner`), and the API lets only admin or teacher publish a `global` video.
    visibility: 'global',
    uploader_id: parents.ownerId,
    views: 0,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- audio KBAT

export const AUDIO_STATUS_MAP: Readonly<Record<string, string>> = {
  draft: 'draft',
  pending_review: 'pending_review',
  approved: 'approved',
  archived: 'archived',
}
const audioStatus = enumMapper('status', AUDIO_STATUS_MAP)

export interface AudioSetValues {
  title: string
  education_level_id: string
  subject_id: string
  status: string
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface AudioOutcome {
  out: Outcome<AudioSetValues>
  /** The row had an `audio_path` (file migration off: counted in the report notes; `sections` stays empty). */
  hadAudio: boolean
}

/** `education_level_id` and `subject_id` are NOT NULL in v2 and have no staged source: INVALID_VALUE until the spec carries them. */
export function transformAudioSet(
  row: Staged,
  parents: { ownerId: string | undefined; levelId: string | undefined; subjectId: string | undefined },
): AudioOutcome {
  const hadAudio = text(row.audio_path) !== null
  const fail = (o: Outcome<never>): AudioOutcome => ({ out: o, hadAudio })
  if (parents.ownerId === undefined) return fail(orphan('created_by_id'))
  const title = squash(row.title)
  if (title === null) return fail(invalid('title'))
  const status = audioStatus(row.status)
  if (!status.ok) return fail(status)
  if (status.value === null) return fail(invalid('status'))
  if (parents.levelId === undefined) return fail(invalid('education_level_id'))
  if (parents.subjectId === undefined) return fail(invalid('subject_id'))
  return {
    hadAudio,
    out: ok({
      title,
      education_level_id: parents.levelId,
      subject_id: parents.subjectId,
      status: status.value,
      created_by_id: parents.ownerId,
      ...stamps(row),
    }),
  }
}
