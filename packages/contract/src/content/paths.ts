import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import {
  AUDIO_TEMPLATE_CONTENT_TYPES,
  AdminAudioKbatCreateRequestSchema,
  AdminAudioKbatCreatedSchema,
  AdminAudioKbatListQuerySchema,
  AdminAudioKbatListResponseSchema,
  AdminAudioKbatListMetaSchema,
  AdminAudioKbatQuestionInputSchema,
  AdminAudioKbatSectionInputSchema,
  AdminAudioKbatSectionSchema,
  AdminAudioKbatSetItemSchema,
  AdminAudioKbatStatsSchema,
  AdminAudioKbatTemplateQuerySchema,
  AudioChoiceSchema,
  AudioKbatAnswerSchema,
  AudioKbatAttemptRequestSchema,
  AudioKbatAttemptResultSchema,
  AudioKbatPlayQuestionSchema,
  AudioKbatPlaySectionSchema,
  AudioKbatPlaySetSchema,
  AudioKbatSetListItemSchema,
  AudioKbatSetListQuerySchema,
  AudioKbatStatusSchema,
} from './audio'
import { ContentSupportConfigSchema, ScreenshotFileSchema, ScreenshotListMetaSchema, ScreenshotListResponseSchema, ScreenshotUploadRequestSchema, ScreenshotUploadResultSchema } from './admin'
import {
  AdminArticleCreateRequestSchema,
  AdminArticleDetailSchema,
  AdminArticleItemSchema,
  AdminArticleListQuerySchema,
  AdminArticleUpdateRequestSchema,
  ArticleAttachmentSchema,
  ArticleAuthorRefSchema,
  ArticleCardSchema,
  ArticleCategorySchema,
  ArticleDetailSchema,
  ArticleGradeLevelSchema,
  ArticleHotCardSchema,
  ArticleLatestQuerySchema,
  ArticleListQuerySchema,
  ArticleSlugParamsSchema,
} from './articles'
import {
  ActiveBannerSchema,
  AdminBannerCreateRequestSchema,
  AdminBannerSchema,
  AdminBannerUpdateRequestSchema,
  BannerAudienceSchema,
  BannerLinkTypeSchema,
  BannerTypeSchema,
} from './banners'
import {
  AdminNoteCreateRequestSchema,
  AdminNoteDetailSchema,
  AdminNoteItemSchema,
  AdminNoteListQuerySchema,
  AdminNoteUpdateRequestSchema,
  NoteFormTypeSchema,
  NoteGradeSchema,
  NoteWriteGradeSchema,
  NoteStoredTypeSchema,
  NoteSubjectSchema,
} from './notes'
import {
  PerutusanAuthorSchema,
  PerutusanCardSchema,
  PerutusanCommentRequestSchema,
  PerutusanCommentResultSchema,
  PerutusanComposeContextSchema,
  PerutusanCreateRequestSchema,
  PerutusanDetailSchema,
  PerutusanFileSchema,
  PerutusanOwnItemSchema,
  PerutusanPublicSchema,
  PerutusanReactionCountsSchema,
  PerutusanReactionRequestSchema,
  PerutusanReactionResultSchema,
  PerutusanReactionTypeSchema,
  PerutusanStatusSchema,
} from './perutusan'
import {
  VideoCardSchema,
  VideoCategorySchema,
  VideoCreateRequestSchema,
  VideoDetailQuerySchema,
  VideoDetailSchema,
  VideoFacetsSchema,
  VideoFormContextSchema,
  VideoListMetaSchema,
  VideoListQuerySchema,
  VideoListResponseSchema,
  VideoPlatformSchema,
  VideoUpdateRequestSchema,
  VideoUploaderSchema,
  VideoVisibilitySchema,
} from './videos'
import {
  ContentDeletedSchema,
  ContentLevelRefSchema,
  ContentSchoolRefSchema,
  ContentSubjectRefSchema,
  ContentUserRefSchema,
  FormBooleanSchema,
  contentMutationOf,
  idParams,
} from './common'

/** Builds `{ [meta id]: schema }` so a component key can never drift from its `.meta({ id })`. */
function byId(schemas: readonly z.ZodType[]): Record<string, z.ZodType> {
  return Object.fromEntries(
    schemas.map((schema) => {
      const id = z.globalRegistry.get(schema)?.id
      if (!id) throw new Error('content contract: component schema without a meta id')
      return [id, schema]
    }),
  )
}

/** Components contributed by BE-24 (M09 content); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const CONTENT_COMPONENT_SCHEMAS = byId([
  // shared refs and helpers
  ContentLevelRefSchema,
  ContentSubjectRefSchema,
  ContentSchoolRefSchema,
  ContentUserRefSchema,
  ContentDeletedSchema,
  FormBooleanSchema,
  // articles
  ArticleCategorySchema,
  ArticleGradeLevelSchema,
  ArticleAuthorRefSchema,
  ArticleCardSchema,
  ArticleHotCardSchema,
  ArticleDetailSchema,
  ArticleListQuerySchema,
  ArticleLatestQuerySchema,
  AdminArticleItemSchema,
  ArticleAttachmentSchema,
  AdminArticleDetailSchema,
  AdminArticleListQuerySchema,
  AdminArticleCreateRequestSchema,
  AdminArticleUpdateRequestSchema,
  // banners
  BannerTypeSchema,
  BannerLinkTypeSchema,
  BannerAudienceSchema,
  ActiveBannerSchema,
  AdminBannerSchema,
  AdminBannerCreateRequestSchema,
  AdminBannerUpdateRequestSchema,
  // notes
  NoteSubjectSchema,
  NoteFormTypeSchema,
  NoteStoredTypeSchema,
  NoteGradeSchema,
  NoteWriteGradeSchema,
  AdminNoteItemSchema,
  AdminNoteDetailSchema,
  AdminNoteListQuerySchema,
  AdminNoteCreateRequestSchema,
  AdminNoteUpdateRequestSchema,
  // videos
  VideoCategorySchema,
  VideoVisibilitySchema,
  VideoPlatformSchema,
  VideoUploaderSchema,
  VideoCardSchema,
  VideoDetailSchema,
  VideoFacetsSchema,
  VideoListMetaSchema,
  VideoListResponseSchema,
  VideoListQuerySchema,
  VideoDetailQuerySchema,
  VideoCreateRequestSchema,
  VideoUpdateRequestSchema,
  VideoFormContextSchema,
  // perutusan
  PerutusanStatusSchema,
  PerutusanReactionTypeSchema,
  PerutusanAuthorSchema,
  PerutusanReactionCountsSchema,
  PerutusanCardSchema,
  PerutusanFileSchema,
  PerutusanDetailSchema,
  PerutusanOwnItemSchema,
  PerutusanComposeContextSchema,
  PerutusanCreateRequestSchema,
  PerutusanReactionRequestSchema,
  PerutusanReactionResultSchema,
  PerutusanCommentRequestSchema,
  PerutusanCommentResultSchema,
  PerutusanPublicSchema,
  // audio KBAT
  AudioKbatStatusSchema,
  AudioChoiceSchema,
  AudioKbatSetListItemSchema,
  AudioKbatSetListQuerySchema,
  AudioKbatPlayQuestionSchema,
  AudioKbatPlaySectionSchema,
  AudioKbatPlaySetSchema,
  AudioKbatAnswerSchema,
  AudioKbatAttemptRequestSchema,
  AudioKbatAttemptResultSchema,
  AdminAudioKbatSetItemSchema,
  AdminAudioKbatStatsSchema,
  AdminAudioKbatListMetaSchema,
  AdminAudioKbatListResponseSchema,
  AdminAudioKbatListQuerySchema,
  AdminAudioKbatTemplateQuerySchema,
  AdminAudioKbatSectionInputSchema,
  AdminAudioKbatQuestionInputSchema,
  AdminAudioKbatCreateRequestSchema,
  AdminAudioKbatSectionSchema,
  AdminAudioKbatCreatedSchema,
  // admin tools and public config
  ScreenshotFileSchema,
  ScreenshotListMetaSchema,
  ScreenshotListResponseSchema,
  ScreenshotUploadRequestSchema,
  ScreenshotUploadResultSchema,
  ContentSupportConfigSchema,
])

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/**
 * Registers the 43 M09 content endpoints (BE-24). Success bodies are `{ data }`, `{ data, meta }` or,
 * for writes, `{ data, status }` (`status` = BM flash text); failures are `{ error }`.
 * Static paths (`/articles/hot`, `/videos/form-context`, `/perutusan/mine`, ...) win over the
 * `{slug}` / `{id}` paths. File parts are stored through BE-04 (`FileStorage`).
 */
export function registerContentPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
  const multipart = (schema: z.ZodType) => ({ required: true, content: { 'multipart/form-data': { schema } } })

  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const adminOnly = err('FORBIDDEN "This action is unauthorized." (not an admin).')
  const csrfInvalid = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
  const notFound = err('NOT_FOUND "Not Found." (unknown id, or not visible to the caller).')
  const validation = (detail: string) => err(`VALIDATION_ERROR with fields. ${detail} Missing: "Medan ini diperlukan."; invalid: "Medan ini tidak sah.". Top-level message is the first field message (+ " (and N more error(s))" when several).`)
  const adminNotFound = (copy: string) => err(`NOT_FOUND "${copy}" (the BM text is the flash the screen shows).`)

  // -------------------------------------------------------------------------------------------
  // Articles and banners, public config
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/articles',
    tags: ['content'],
    summary: 'Published articles (reader list)',
    description: 'Public (guests allowed). Only published articles; 18 per page, `publishedAt` desc then id. An out-of-range page is an empty list, not an error.',
    request: { query: ArticleListQuerySchema },
    responses: { 200: json(listEnvelopeOf(ArticleCardSchema), 'Article cards with ListMeta.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/articles/hot',
    tags: ['content'],
    summary: 'Hot articles strip',
    description: 'Public. 6 cards drawn at random without replacement from featured published articles plus the 10 most-viewed non-featured published ones; `badge` is PILIHAN when featured else POPULAR. Unpaged meta.',
    responses: { 200: json(listEnvelopeOf(ArticleHotCardSchema), 'Hot cards in draw order.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/articles/latest',
    tags: ['content'],
    summary: 'Latest published articles',
    description: 'Public. Newest first; `limit` default 5 clamped to 1..50. Unpaged meta.',
    request: { query: ArticleLatestQuerySchema },
    responses: { 200: json(listEnvelopeOf(ArticleCardSchema), 'Latest article cards.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/articles/{slug}',
    tags: ['content'],
    summary: 'Article page',
    description: 'Public. Unpublished or unknown slug is 404. Increments `views` by 1 on every read (no de-duplication, guests included); the returned `views` includes this open. Up to 3 related articles of the same category.',
    request: { params: ArticleSlugParamsSchema },
    responses: { 200: json(envelopeOf(ArticleDetailSchema), 'The article.'), 404: err('NOT_FOUND "Not Found." (unknown or unpublished).') },
  })

  registry.registerPath({
    method: 'get',
    path: '/banners/active',
    tags: ['content'],
    summary: 'Active banners for the caller (dashboard carousel)',
    description: 'Any signed-in user. Included: isActive, today (Malaysia time) within startDate..endDate (null = open), and audience ALL or equal to the caller role (student to STUDENT, teacher to TEACHER, admin to ADMIN); admin receives every audience; other roles receive ALL only. Order displayOrder then id. Unpaged meta.',
    responses: { 200: json(listEnvelopeOf(ActiveBannerSchema), 'Active banners.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/config/support',
    tags: ['content'],
    summary: 'Support contact (help box)',
    description: 'Public. If the config row is missing the server answers 404 "Konfigurasi sokongan tidak dijumpai." (the mock would fail with a generic error).',
    responses: {
      200: json(envelopeOf(ContentSupportConfigSchema), 'E-mail and WhatsApp number.'),
      404: err('NOT_FOUND "Konfigurasi sokongan tidak dijumpai."'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Videos
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/videos',
    tags: ['content'],
    summary: 'Video library',
    description: 'Public. A guest sees `global` videos only; a signed-in non-admin also sees `school` videos of the same school; admin sees all. 24 per page, newest first. `meta.facets` carries the category and subject counts.',
    request: { query: VideoListQuerySchema },
    responses: { 200: json(VideoListResponseSchema, 'Video cards with meta.facets.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/videos/form-context',
    tags: ['content'],
    summary: 'Uploader and school shown on the video form',
    description: 'Any signed-in user. The school is the video-form school, not necessarily the profile school (OQ-API-B4-17). Matches before `/videos/{id}`.',
    responses: { 200: json(envelopeOf(VideoFormContextSchema), 'Uploader and school.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/videos/{id}',
    tags: ['content'],
    summary: 'Video page',
    description: 'Public with the same visibility as the list (an invisible video is 404). `views` is the count before this open; the count is incremented after the response is built unless `for=edit`.',
    request: { params: idParams, query: VideoDetailQuerySchema },
    responses: { 200: json(envelopeOf(VideoDetailSchema), 'The video with up to 6 related cards.'), 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/videos',
    tags: ['content'],
    summary: 'Publish a video link',
    description: 'Any signed-in user publishes immediately (the mock has no approval state, OQ-API-B4-16). Platform, external id and thumbnail are parsed from the URL.',
    request: { headers: [csrf], body: body(VideoCreateRequestSchema) },
    responses: {
      201: json(contentMutationOf(VideoDetailSchema), 'Created; status "Video berjaya diterbitkan.".'),
      401: unauthorized,
      403: csrfInvalid,
      422: validation('videoUrl, title, category, visibility required; description at most 1000 chars; subjectId must exist. Also "Anda tiada sekolah untuk dikongsi." under fields.visibility when `school` is chosen and the uploader has no video-form school.'),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/videos/{id}',
    tags: ['content'],
    summary: 'Edit a video',
    description: 'Uploader or admin. An invisible video is 404 before the role check; another user gets 403 "This action is unauthorized.".',
    request: { params: idParams, headers: [csrf], body: body(VideoUpdateRequestSchema) },
    responses: {
      200: json(contentMutationOf(VideoDetailSchema), 'Updated; status "Video berjaya dikemaskini.".'),
      401: unauthorized,
      403: err('FORBIDDEN "This action is unauthorized." (not the uploader nor an admin); FORBIDDEN "Anda tidak dibenarkan mengubah video ini." (repository race); or CSRF_INVALID.'),
      404: notFound,
      422: validation('Same rules as create, including "Anda tiada sekolah untuk dikongsi.".'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/videos/{id}',
    tags: ['content'],
    summary: 'Delete a video',
    description: 'Uploader or admin. Hard delete; answers 200 with `{ deleted: 1 }` and the flash.',
    request: { params: idParams, headers: [csrf] },
    responses: {
      200: json(contentMutationOf(ContentDeletedSchema), 'Deleted; status "Video berjaya dipadam.".'),
      401: unauthorized,
      403: err('FORBIDDEN "This action is unauthorized."; FORBIDDEN "Anda tidak dibenarkan memadam video ini." (repository race); or CSRF_INVALID.'),
      404: notFound,
    },
  })

  // -------------------------------------------------------------------------------------------
  // Perutusan
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/perutusan',
    tags: ['content'],
    summary: 'Perutusan feed',
    description: 'Any signed-in user. Posts that are published, or scheduled and due, and that are national, or belong to the viewer school, or are the viewer own, or the viewer is admin. Pinned first, then newest effective time, then id. Unpaged meta.',
    responses: { 200: json(listEnvelopeOf(PerutusanCardSchema), 'Feed cards.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/perutusan/mine',
    tags: ['content'],
    summary: 'Own perutusan (all statuses)',
    description: 'Any signed-in user. Matches before `/perutusan/{id}`. Unpaged meta.',
    responses: { 200: json(listEnvelopeOf(PerutusanOwnItemSchema), 'Own posts.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/perutusan/compose-context',
    tags: ['content'],
    summary: 'What the caller may write',
    description: 'Any signed-in user. admin is national, school_admin is school (label = school name, else "Sekolah"); every other role gets scope null, empty label and canWrite false. Matches before `/perutusan/{id}`.',
    responses: { 200: json(envelopeOf(PerutusanComposeContextSchema), 'The compose context.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/perutusan/{id}',
    tags: ['content'],
    summary: 'Perutusan page',
    description: 'Any signed-in user. A visible post, or a non-published post for its author and admin; anything else is 404 (never 403). Read counting: a viewer who is neither admin nor the author counts once per post; the returned `reads` includes this open.',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(PerutusanDetailSchema), 'The post.'), 401: unauthorized, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/perutusan',
    tags: ['content'],
    summary: 'Write a perutusan',
    description: 'admin (national) or school_admin (own school) only; other roles get 403. Multipart: images (JPG/PNG/GIF, 2 MB each) and documents (PDF, 5 MB each) are stored through BE-04 and returned as `images[]` / `documents[]`. At most 2 published-or-scheduled pinned posts per scope; drafts do not count. Flash by status: published "Perutusan berjaya dihantar.", scheduled "Perutusan dijadualkan.", draft "Draf perutusan disimpan.".',
    request: { headers: [csrf], body: multipart(PerutusanCreateRequestSchema) },
    responses: {
      201: json(contentMutationOf(PerutusanDetailSchema), 'Created; status is the flash for the chosen status.'),
      401: unauthorized,
      403: err('FORBIDDEN "This action is unauthorized." (role is not admin or school_admin), or CSRF_INVALID.'),
      422: validation('title and status required; scheduledAt invalid or not in the future; youtubeUrl not a YouTube URL; images / documents "{file}: format atau saiz tidak dibenarkan."; fields.isPinned "Maksimum 2 perutusan boleh disematkan."; fields.form "Pentadbir sekolah mesti mempunyai sekolah." (school_admin with no school).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/perutusan/{id}/reactions',
    tags: ['content'],
    summary: 'Toggle a reaction',
    description: 'Any signed-in user, on a post visible to the caller (else 404). Posting the same type again removes it.',
    request: { params: idParams, headers: [csrf], body: body(PerutusanReactionRequestSchema) },
    responses: {
      200: json(envelopeOf(PerutusanReactionResultSchema), 'Counts and the caller reactions after the toggle.'),
      401: unauthorized,
      403: csrfInvalid,
      404: notFound,
      422: validation('type must be like, love or thanks.'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/perutusan/{id}/comments',
    tags: ['content'],
    summary: 'Comment on a perutusan',
    description: 'Any signed-in user, on a visible post. Stored as `pending` and not shown (counts and lists use approved comments only); no moderation route exists (OQ-API-B4-18).',
    request: { params: idParams, headers: [csrf], body: body(PerutusanCommentRequestSchema) },
    responses: {
      201: json(contentMutationOf(PerutusanCommentResultSchema), 'Stored; status "Komen anda telah dihantar dan akan disemak.".'),
      401: unauthorized,
      403: csrfInvalid,
      404: notFound,
      422: validation('body 1 to 1000 characters; also "Komen mesti antara 1 hingga 1000 aksara." under fields.body.'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/public/perutusan/{id}',
    tags: ['content'],
    summary: 'Public share page of a perutusan',
    description: 'Public (guests allowed). Only a public AND published post, else 404. Counts no read.',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(PerutusanPublicSchema), 'The public post.'), 404: err('NOT_FOUND "Not Found.".') },
  })

  // -------------------------------------------------------------------------------------------
  // Audio KBAT: student play
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/audio-kbat-sets',
    tags: ['content'],
    summary: 'Approved Audio KBAT sets (student list)',
    description: 'Any signed-in user. Approved sets only. Unpaged meta.',
    request: { query: AudioKbatSetListQuerySchema },
    responses: { 200: json(listEnvelopeOf(AudioKbatSetListItemSchema), 'Approved sets.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/audio-kbat-sets/{id}',
    tags: ['content'],
    summary: 'Audio KBAT player data',
    description: 'Any signed-in user. Only approved sets; a draft, pending, archived or unknown set is 404. Never returns the correct answers or the explanations. `audioUrl` is served through BE-04 FileStorage (authenticated, not a public path).',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(AudioKbatPlaySetSchema), 'The set with 4 sections.'), 401: unauthorized, 404: notFound },
  })

  registry.registerPath({
    method: 'post',
    path: '/audio-kbat-sets/{id}/attempts',
    tags: ['content'],
    summary: 'Submit an Audio KBAT attempt',
    description: 'Any signed-in user, approved sets only (404 otherwise, checked before the body). One attempt row per submit; the user comes from the session. Score = sum of the marks of correct answers; totalMarks = sum of all marks. No ledger or streak effect. `is_test` is stamped under Mod Pelajar.',
    request: { params: idParams, headers: [csrf], body: body(AudioKbatAttemptRequestSchema) },
    responses: {
      201: json(envelopeOf(AudioKbatAttemptResultSchema), 'Score and total marks.'),
      401: unauthorized,
      403: csrfInvalid,
      404: notFound,
      422: err('VALIDATION_ERROR fields.answers "Medan ini diperlukan." (missing) or "Medan ini tidak sah." (not an array, `no` outside 1..30, duplicate `no`, or `choice` outside A..D).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/audio-kbat-sets/{id}/sections/{no}/audio',
    tags: ['content'],
    summary: 'Stream the audio of one section of an approved set',
    description:
      'Any signed-in user (the only way a student reads Audio KBAT audio; the generic /files route refuses audio_kbat files to everyone but admin). Approved sets only: a draft, pending, archived or unknown set, a section number outside 1..4, or a section without audio is 404 "Not Found.". This is the `audioUrl` of the player data. Headers: `Content-Type` of the stored audio (audio/mpeg, audio/mp4, audio/wav, audio/ogg), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src \'none\'; sandbox`, `Cache-Control: private, no-store`, `Accept-Ranges: bytes`. One `Range: bytes=a-b` is honoured with 206 and `Content-Range`; a range whose start is past the end is 416 with `Content-Range: bytes */size`; a malformed range (for example end before start) is ignored and the whole body is served with 200 (RFC 7233).',
    request: { params: z.object({ id: IdSchema, no: z.string().regex(/^[1-4]$/) }) },
    responses: {
      200: {
        description: 'The whole audio file.',
        content: { 'audio/*': { schema: z.string().meta({ type: 'string', format: 'binary' }) } },
      },
      206: {
        description: 'The requested byte range, with Content-Range.',
        content: { 'audio/*': { schema: z.string().meta({ type: 'string', format: 'binary' }) } },
      },
      401: unauthorized,
      404: notFound,
      416: { description: 'Range start is past the end of the file; Content-Range: bytes */size.' },
    },
  })

  // -------------------------------------------------------------------------------------------
  // Admin articles
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/articles',
    tags: ['content-admin'],
    summary: 'Admin article list (all statuses)',
    description: 'Admin only. 20 per page, `createdAt` desc then id.',
    request: { query: AdminArticleListQuerySchema },
    responses: { 200: json(listEnvelopeOf(AdminArticleItemSchema), 'Articles with ListMeta.'), 401: unauthorized, 403: adminOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/articles/{id}',
    tags: ['content-admin'],
    summary: 'Admin article detail',
    description: 'Admin only. Never counts a view.',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(AdminArticleDetailSchema), 'The article.'), 401: unauthorized, 403: adminOnly, 404: adminNotFound('Artikel tidak dijumpai.') },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/articles',
    tags: ['content-admin'],
    summary: 'Create an article',
    description: 'Admin only; the author is the session user. The slug is made unique with a numeric suffix and never changes on edit. `publishedAt` is set when created published. The HTML `content` is sanitised on write (BE-24 AC 2). Images and attachments go through BE-04 (`purpose=cms_image`); the mock only stores a URL.',
    request: { headers: [csrf], body: body(AdminArticleCreateRequestSchema) },
    responses: {
      201: json(contentMutationOf(AdminArticleDetailSchema), 'Created; status "Artikel berjaya ditambah.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      422: validation('title, content and category required; featuredImage must be an http(s) URL.'),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/articles/{id}',
    tags: ['content-admin'],
    summary: 'Update an article',
    description: 'Admin only. Absent fields keep their stored value; a sent blank text field clears it. `publishedAt` is set at the first publish only (kept after unpublish). The slug does not change.',
    request: { params: idParams, headers: [csrf], body: body(AdminArticleUpdateRequestSchema) },
    responses: {
      200: json(contentMutationOf(AdminArticleDetailSchema), 'Updated; status "Artikel berjaya dikemaskini.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: adminNotFound('Artikel tidak dijumpai.'),
      422: validation('Same rules as create.'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/articles/{id}',
    tags: ['content-admin'],
    summary: 'Delete an article',
    description: 'Admin only. Hard delete with its attachment rows (stored files per BE-04).',
    request: { params: idParams, headers: [csrf] },
    responses: {
      200: json(contentMutationOf(ContentDeletedSchema), 'Deleted; status "Artikel berjaya dipadam.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: adminNotFound('Artikel tidak dijumpai.'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Admin banners
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/banners',
    tags: ['content-admin'],
    summary: 'Admin banner list',
    description: 'Admin only. Every banner, unpaged, ordered displayOrder then id.',
    responses: { 200: json(listEnvelopeOf(AdminBannerSchema), 'Banners.'), 401: unauthorized, 403: adminOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/banners/{id}',
    tags: ['content-admin'],
    summary: 'Admin banner detail',
    description: 'Admin only.',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(AdminBannerSchema), 'The banner.'), 401: unauthorized, 403: adminOnly, 404: adminNotFound('Banner tidak dijumpai.') },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/banners',
    tags: ['content-admin'],
    summary: 'Create a banner',
    description: 'Admin only. Codes are upper-cased by the server before they are checked. `externalUrl` is required for linkType EXTERNAL and ignored otherwise. End date may not be before start date.',
    request: { headers: [csrf], body: body(AdminBannerCreateRequestSchema) },
    responses: {
      201: json(contentMutationOf(AdminBannerSchema), 'Created; status "Banner berjaya ditambah.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      422: validation('title and bannerType required; fields.externalUrl required for EXTERNAL; dates must be real YYYY-MM-DD, end not before start.'),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/banners/{id}',
    tags: ['content-admin'],
    summary: 'Update a banner',
    description: 'Admin only. Absent fields keep their value. The three codes also accept the banner own stored code even when it is not a form option (so seeded FEATURE / PROMOTIONAL banners can be saved unchanged).',
    request: { params: idParams, headers: [csrf], body: body(AdminBannerUpdateRequestSchema) },
    responses: {
      200: json(contentMutationOf(AdminBannerSchema), 'Updated; status "Banner berjaya dikemaskini.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: adminNotFound('Banner tidak dijumpai.'),
      422: validation('Same rules as create.'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/banners/{id}',
    tags: ['content-admin'],
    summary: 'Delete a banner',
    description: 'Admin only. Hard delete.',
    request: { params: idParams, headers: [csrf] },
    responses: {
      200: json(contentMutationOf(ContentDeletedSchema), 'Deleted; status "Banner berjaya dipadam.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: adminNotFound('Banner tidak dijumpai.'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Admin notes
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/notes',
    tags: ['content-admin'],
    summary: 'Admin note list',
    description: 'Admin only. 20 per page, id ascending (a new note is listed last). There is no notes reader.',
    request: { query: AdminNoteListQuerySchema },
    responses: { 200: json(listEnvelopeOf(AdminNoteItemSchema), 'Notes with ListMeta.'), 401: unauthorized, 403: adminOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/notes/{id}',
    tags: ['content-admin'],
    summary: 'Admin note detail',
    description: 'Admin only.',
    request: { params: idParams },
    responses: { 200: json(envelopeOf(AdminNoteDetailSchema), 'The note.'), 401: unauthorized, 403: adminOnly, 404: adminNotFound('Nota tidak dijumpai.') },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/notes',
    tags: ['content-admin'],
    summary: 'Create a note',
    description: 'Admin only; the author is the session user. The server lower-cases `subject` and upper-cases `noteType` and `grade` before checking them. The HTML `content` is sanitised on write.',
    request: { headers: [csrf], body: body(AdminNoteCreateRequestSchema) },
    responses: {
      201: json(contentMutationOf(AdminNoteDetailSchema), 'Created; status "Nota berjaya ditambah.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      422: validation('title, content, subject, noteType and grade required.'),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/notes/{id}',
    tags: ['content-admin'],
    summary: 'Update a note',
    description: 'Admin only. Absent fields keep their value.',
    request: { params: idParams, headers: [csrf], body: body(AdminNoteUpdateRequestSchema) },
    responses: {
      200: json(contentMutationOf(AdminNoteDetailSchema), 'Updated; status "Nota berjaya dikemaskini.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: adminNotFound('Nota tidak dijumpai.'),
      422: validation('Same rules as create.'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/notes/{id}',
    tags: ['content-admin'],
    summary: 'Delete a note',
    description: 'Admin only. Hard delete.',
    request: { params: idParams, headers: [csrf] },
    responses: {
      200: json(contentMutationOf(ContentDeletedSchema), 'Deleted; status "Nota berjaya dipadam.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      404: adminNotFound('Nota tidak dijumpai.'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Admin tools: screenshots and Audio KBAT sets
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/screenshots',
    tags: ['content-admin'],
    summary: 'Private screenshot list',
    description: 'Admin only. Newest first, unpaged meta plus `total`.',
    responses: { 200: json(ScreenshotListResponseSchema, 'Screenshots.'), 401: unauthorized, 403: adminOnly },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/screenshots',
    tags: ['content-admin'],
    summary: 'Upload screenshots',
    description: 'Admin only. Multipart `files[]`, 1 to 20 files, each JPG/PNG/GIF/WebP/BMP up to 10 MB (declared type and extension must agree). A refused file does not block the others: it is listed in `rejected` with "{file}: format atau saiz tidak dibenarkan.". Files are stored through BE-04 (`purpose=cms_image`).',
    request: { headers: [csrf], body: multipart(ScreenshotUploadRequestSchema) },
    responses: {
      201: json(contentMutationOf(ScreenshotUploadResultSchema), 'Saved and rejected files; status "{n} fail berjaya dimuat naik.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      422: err('VALIDATION_ERROR fields.files: "Medan ini diperlukan." (no file), "Maksimum 20 fail setiap muat naik." (more than 20), or "Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB." (none saved; also the top-level message).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/audio-kbat-sets',
    tags: ['content-admin'],
    summary: 'Admin Audio KBAT set list',
    description: 'Admin only. All statuses. `meta.stats` counts every set, never the filtered ones.',
    request: { query: AdminAudioKbatListQuerySchema },
    responses: { 200: json(AdminAudioKbatListResponseSchema, 'Sets with meta.stats.'), 401: unauthorized, 403: adminOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/audio-kbat-sets/template',
    tags: ['content-admin'],
    summary: 'Download the Audio KBAT set template',
    description: 'Admin only. A binary file, not JSON: `template-audio-kbat.xlsx` or `template-audio-kbat.docx`, with Content-Disposition attachment. Matches before any `{id}` path. The mock serves placeholder text files (OQ-M09-03).',
    request: { query: AdminAudioKbatTemplateQuerySchema },
    responses: {
      200: {
        description: 'The template file.',
        headers: { 'Content-Disposition': { description: 'attachment; filename="template-audio-kbat.xlsx" (or .docx).', schema: { type: 'string' } } },
        content: {
          [AUDIO_TEMPLATE_CONTENT_TYPES.xlsx]: { schema: z.string().meta({ type: 'string', format: 'binary' }) },
          [AUDIO_TEMPLATE_CONTENT_TYPES.docx]: { schema: z.string().meta({ type: 'string', format: 'binary' }) },
        },
      },
      401: unauthorized,
      403: adminOnly,
      422: err('VALIDATION_ERROR fields.format "Medan ini tidak sah." (format is not xlsx or docx).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/audio-kbat-sets',
    tags: ['content-admin'],
    summary: 'Create an Audio KBAT set',
    description: 'Admin only; the creator is the session user. Multipart: a set has exactly 4 sections (audio files up to 20 MB, stored through BE-04) and 30 questions; the nested parts are flattened as `sections[n][...]` and `questions[n][...]`. Question ranges per section are 1-8, 9-16, 17-24, 25-30. `educationLevelId` and `subjectId` must exist in curriculum (BE-08).',
    request: { headers: [csrf], body: multipart(AdminAudioKbatCreateRequestSchema) },
    responses: {
      201: json(contentMutationOf(AdminAudioKbatCreatedSchema), 'Created; status "Set Audio KBAT berjaya disimpan.".'),
      401: unauthorized,
      403: err('FORBIDDEN (not an admin) or CSRF_INVALID.'),
      422: err('VALIDATION_ERROR with dotted field keys, e.g. fields["sections.2.audio"] "{file}: format atau saiz tidak dibenarkan.", fields["questions.5.optionA"] "Medan ini diperlukan."; or "Set mesti mempunyai 4 bahagian dan 30 soalan.".'),
    },
  })
}
