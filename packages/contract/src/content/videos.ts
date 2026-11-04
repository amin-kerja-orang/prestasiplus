import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ListMetaSchema } from '../common/envelope'
import { ContentSchoolRefSchema, ContentSubjectRefSchema, counter, httpUrl, pageQuery, requiredText } from './common'

/**
 * M09 videos (#27-#32). Mock: `handlers/videos.ts`. Reads are public (BR-M09-19: a guest sees
 * `global` videos; a signed-in non-admin also sees `school` videos of the same school; admin sees all).
 * Writes are for admin and teacher only (API-MUR-05); edit and delete are for the uploader or an admin.
 */

export const VIDEO_CATEGORIES = ['motivasi', 'tutorial', 'tips-spm', 'ceramah', 'lain-lain'] as const
export const VideoCategorySchema = z.enum(VIDEO_CATEGORIES).meta({ id: 'VideoCategory' })
export type VideoCategory = z.infer<typeof VideoCategorySchema>

export const VIDEO_CATEGORY_LABELS = {
  motivasi: 'Motivasi',
  tutorial: 'Tutorial',
  'tips-spm': 'Tips SPM',
  ceramah: 'Ceramah',
  'lain-lain': 'Lain-lain',
} as const satisfies Record<VideoCategory, string>

export const VIDEO_VISIBILITIES = ['global', 'school'] as const
export const VideoVisibilitySchema = z.enum(VIDEO_VISIBILITIES).meta({ id: 'VideoVisibility' })

/** Stored platform spelling shown in `VideoDetail.platform` (parsed from the URL). */
export const VIDEO_PLATFORMS = ['Youtube', 'Vimeo', 'Dailymotion', 'TikTok', 'Facebook', 'Other'] as const
export const VideoPlatformSchema = z.enum(VIDEO_PLATFORMS).meta({ id: 'VideoPlatform' })

/** Fixed page size of the library (newest first). */
export const VIDEO_PAGE_SIZE = 24
/** Page size of the admin video list (R1-ADM-N-01), requested with `pageSize`. */
export const ADMIN_VIDEO_PAGE_SIZE = 25
/** Largest `pageSize` a client may request. */
export const VIDEO_PAGE_SIZE_MAX = 50

/** Exact BM copy of the video form (20 R1-GUR-7). */
export const VIDEO_MESSAGES = {
  titleRequired: 'Sila isi tajuk video.',
  titleTooLong: 'Tajuk video tidak boleh melebihi 150 aksara.',
  urlRequired: 'Sila isi pautan YouTube.',
  urlInvalid: 'Pautan mesti pautan YouTube yang sah.',
  categoryRequired: 'Sila pilih kategori.',
} as const

const YOUTUBE_HOSTS: ReadonlySet<string> = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])

/** True for an http(s) link on a YouTube host that carries a video id (youtu.be/<id>, /watch?v=<id>, /embed/<id>, /shorts/<id>). */
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

export function isYoutubeVideoUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  const host = u.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(host)) return false
  const segments = u.pathname.split('/').filter((x) => x !== '')
  // A YouTube video id is 11 characters of [A-Za-z0-9_-]; anything else is not a video link.
  const isId = (id: string | null | undefined): boolean => YOUTUBE_VIDEO_ID.test(id ?? '')
  if (host === 'youtu.be') return segments.length === 1 && isId(segments[0])
  if (segments[0] === 'watch') return segments.length === 1 && isId(u.searchParams.get('v'))
  if (segments[0] === 'embed' || segments[0] === 'shorts') return segments.length === 2 && isId(segments[1])
  return false
}

export const VideoUploaderSchema = z
  .strictObject({ name: z.string(), initial: z.string(), roleLabel: z.string() })
  .meta({ id: 'VideoUploader' })

const videoCardShape = {
  id: IdSchema,
  title: z.string(),
  platformLabel: z.string().meta({ description: 'Chip label, e.g. "YouTube", "Lain-lain" (platform Other).' }),
  thumbnailUrl: z.string().nullable(),
  views: counter(),
  createdAt: TimestampSchema,
  uploader: VideoUploaderSchema,
  category: VideoCategorySchema,
  categoryLabel: z.string(),
  subject: ContentSubjectRefSchema.nullable(),
}

/** Card of the library (#27) and of `related` (#28). */
export const VideoCardSchema = z.strictObject(videoCardShape).meta({ id: 'VideoCard' })
export type VideoCard = z.infer<typeof VideoCardSchema>

/** Video page and the `data` of create/update (#28-#30). `views` shows the count before this open. */
export const VideoDetailSchema = z
  .strictObject({
    ...videoCardShape,
    videoUrl: z.string(),
    embedUrl: z.string().nullable(),
    platform: VideoPlatformSchema,
    description: z.string().nullable(),
    visibility: VideoVisibilitySchema,
    canManage: z.boolean().meta({ description: 'The caller is the uploader or an admin.' }),
    related: z.array(VideoCardSchema).max(6),
  })
  .meta({ id: 'VideoDetail' })
export type VideoDetail = z.infer<typeof VideoDetailSchema>

/** `meta.facets` of the library (#27); counts follow the other active filters. */
export const VideoFacetsSchema = z
  .strictObject({
    total: counter().meta({ description: '"Semua (n)".' }),
    categories: z
      .array(z.strictObject({ code: VideoCategorySchema, label: z.string(), count: counter() }))
      .meta({ description: 'All five categories, zero counts included.' }),
    subjects: z
      .array(z.strictObject({ id: IdSchema, name: z.string(), count: z.number().int().min(1) }))
      .meta({ description: 'Only subjects with a count above zero, in id order.' }),
  })
  .meta({ id: 'VideoFacets' })

export const VideoListMetaSchema = ListMetaSchema.extend({ facets: VideoFacetsSchema }).meta({ id: 'VideoListMeta' })

export const VideoListResponseSchema = z
  .object({ data: z.array(VideoCardSchema), meta: VideoListMetaSchema })
  .meta({ id: 'VideoListResponse' })

export const VideoListQuerySchema = z
  .object({
    search: z.string().optional().meta({ description: 'Title or description contains (case-insensitive).' }),
    category: z.string().optional().meta({ description: 'A VideoCategory code or `all`.' }),
    subject: IdSchema.optional().meta({ description: 'Subject id.' }),
    page: pageQuery(),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(VIDEO_PAGE_SIZE_MAX)
      .optional()
      .meta({ description: `Rows per page, 1..${String(VIDEO_PAGE_SIZE_MAX)}; default ${String(VIDEO_PAGE_SIZE)} (the admin list asks for ${String(ADMIN_VIDEO_PAGE_SIZE)}).` }),
  })
  .meta({ id: 'VideoListQuery' })

export const VideoDetailQuerySchema = z
  .object({
    for: z.literal('edit').optional().meta({ description: '`edit` returns the same body without counting a view (S19 form load).' }),
  })
  .meta({ id: 'VideoDetailQuery' })

const videoBodyShape = {
  videoUrl: httpUrl().meta({ description: 'Absolute http(s) video URL; platform, embed URL and thumbnail are parsed from it.' }),
  title: requiredText(150),
  description: z.string().max(1000).nullable().optional(),
  category: VideoCategorySchema,
  subjectId: IdSchema.nullable().optional().meta({ description: 'An existing subject (curriculum, BE-08); blank or null = none.' }),
  visibility: VideoVisibilitySchema.optional().meta({
    description:
      'Ignored: the server sets it by role (teacher = `school` with the teacher\'s school, else 422 "Anda tiada sekolah untuk dikongsi." under fields.visibility; admin = `global`).',
  }),
}

/** Create body (#29): admin and teacher only. */
export const VideoCreateRequestSchema = z.object(videoBodyShape).meta({ id: 'VideoCreateRequest' })
/** Update body (#30): the same required fields again (the mock validates the whole body on PUT). */
export const VideoUpdateRequestSchema = z.object(videoBodyShape).meta({ id: 'VideoUpdateRequest' })

/** `GET /videos/form-context` (#32): uploader and the school shown on the form (the video-form school). */
export const VideoFormContextSchema = z
  .strictObject({ uploader: VideoUploaderSchema, school: ContentSchoolRefSchema.nullable() })
  .meta({ id: 'VideoFormContext' })
