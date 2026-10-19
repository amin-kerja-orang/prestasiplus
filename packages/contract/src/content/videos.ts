import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ListMetaSchema } from '../common/envelope'
import { ContentSchoolRefSchema, ContentSubjectRefSchema, counter, httpUrl, pageQuery, requiredText } from './common'

/**
 * M09 videos (#27-#32). Mock: `handlers/videos.ts`. Reads are public (BR-M09-19: a guest sees
 * `global` videos; a signed-in non-admin also sees `school` videos of the same school; admin sees all).
 * Writes need a session; edit and delete are for the uploader or an admin.
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
    category: VideoCategorySchema,
    categoryLabel: z.string(),
    subject: ContentSubjectRefSchema.nullable(),
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
    search: z.string().optional().meta({ description: 'Title contains.' }),
    category: z.string().optional().meta({ description: 'A VideoCategory code or `all`.' }),
    subject: IdSchema.optional().meta({ description: 'Subject id.' }),
    page: pageQuery(),
  })
  .meta({ id: 'VideoListQuery' })

export const VideoDetailQuerySchema = z
  .object({
    for: z.literal('edit').optional().meta({ description: '`edit` returns the same body without counting a view (S19 form load).' }),
  })
  .meta({ id: 'VideoDetailQuery' })

const videoBodyShape = {
  videoUrl: httpUrl().meta({ description: 'Absolute http(s) video URL; platform, embed URL and thumbnail are parsed from it.' }),
  title: requiredText(255),
  description: z.string().max(1000).nullable().optional(),
  category: VideoCategorySchema,
  subjectId: IdSchema.nullable().optional().meta({ description: 'An existing subject (curriculum, BE-08); blank or null = none.' }),
  visibility: VideoVisibilitySchema.meta({
    description: '`school` needs the uploader to have a video-form school, else 422 "Anda tiada sekolah untuk dikongsi." under fields.visibility.',
  }),
}

/** Create body (#29): any signed-in user. */
export const VideoCreateRequestSchema = z.object(videoBodyShape).meta({ id: 'VideoCreateRequest' })
/** Update body (#30): the same required fields again (the mock validates the whole body on PUT). */
export const VideoUpdateRequestSchema = z.object(videoBodyShape).meta({ id: 'VideoUpdateRequest' })

/** `GET /videos/form-context` (#32): uploader and the school shown on the form (the video-form school). */
export const VideoFormContextSchema = z
  .strictObject({ uploader: VideoUploaderSchema, school: ContentSchoolRefSchema.nullable() })
  .meta({ id: 'VideoFormContext' })
