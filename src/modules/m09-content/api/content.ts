/**
 * M09 reader client functions (SRS M09 v1.5 §7 #6–#9, #20, #24–#40, #43; build-plan M09-T1). UI
 * tasks import these and do not change this file (build-plan §S.3 rule 5). The admin endpoints are
 * deferred.
 *
 * Failures reject with `ApiError`: 404 `NOT_FOUND` for an unknown or hidden id or slug, 403
 * `FORBIDDEN` (video not yours, perutusan writer rule), 422 `VALIDATION_ERROR` with `fields`, 401
 * without a session on the logged-in endpoints (the client's 401 policy sends the user to `/login`).
 * The mutating calls resolve to `{data, status}` (`status` = the flash text, PROPOSED COPY).
 */

import { api, type ListResult } from '@/api'

import type {
  ActiveBanner,
  ArticleCard,
  ArticleDetail,
  ArticleListQuery,
  AudioAttemptRequest,
  AudioAttemptResult,
  AudioSetDetail,
  AudioSetListItem,
  AudioSetListQuery,
  CommentResult,
  ComposeContext,
  HotCard,
  MutationResult,
  OwnPerutusanItem,
  PerutusanCard,
  PerutusanDetail,
  PerutusanInput,
  PublicPerutusan,
  ReactionResult,
  ReactionType,
  SupportConfig,
  VideoCard,
  VideoDetail,
  VideoFormContext,
  VideoInput,
  VideoListMeta,
  VideoListQuery,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

// --- articles -------------------------------------------------------------------------------------

/** #6 `GET /api/articles` (public; 18 per page, published only). */
export function fetchArticles(
  query: ArticleListQuery = {},
  options: Signal = {},
): Promise<ListResult<ArticleCard>> {
  return api.list<ArticleCard>('/api/articles', {
    query: { ...query },
    ...withSignal(options),
  })
}

/** #7 `GET /api/articles/hot` (public; a new random draw of 6 per call). */
export function fetchHotArticles(options: Signal = {}): Promise<ListResult<HotCard>> {
  return api.list<HotCard>('/api/articles/hot', withSignal(options))
}

/** #9 `GET /api/articles/latest` (public; `limit` default 5). */
export function fetchLatestArticles(
  limit = 5,
  options: Signal = {},
): Promise<ListResult<ArticleCard>> {
  return api.list<ArticleCard>('/api/articles/latest', { query: { limit }, ...withSignal(options) })
}

/** #8 `GET /api/articles/:slug` (public; counts a view; 404 for an unknown or unpublished slug). */
export function fetchArticle(slug: string, options: Signal = {}): Promise<ArticleDetail> {
  return api.get<ArticleDetail>(`/api/articles/${encodeURIComponent(slug)}`, withSignal(options))
}

// --- banners --------------------------------------------------------------------------------------

/** #20 `GET /api/banners/active` (logged in). */
export function fetchActiveBanners(options: Signal = {}): Promise<ListResult<ActiveBanner>> {
  return api.list<ActiveBanner>('/api/banners/active', withSignal(options))
}

// --- audio KBAT (provisional, L-3) ----------------------------------------------------------------

/** #24 `GET /api/audio-kbat-sets` (approved sets only). */
export function fetchAudioSets(
  query: AudioSetListQuery = {},
  options: Signal = {},
): Promise<ListResult<AudioSetListItem>> {
  return api.list<AudioSetListItem>('/api/audio-kbat-sets', {
    query: { ...query },
    ...withSignal(options),
  })
}

/** #25 `GET /api/audio-kbat-sets/:id` (404 for an unknown or not approved set). */
export function fetchAudioSet(id: number, options: Signal = {}): Promise<AudioSetDetail> {
  return api.get<AudioSetDetail>(`/api/audio-kbat-sets/${String(id)}`, withSignal(options))
}

/** #26 `POST /api/audio-kbat-sets/:id/attempts` (201). */
export function submitAudioAttempt(
  id: number,
  body: AudioAttemptRequest,
): Promise<AudioAttemptResult> {
  return api.post<AudioAttemptResult>(`/api/audio-kbat-sets/${String(id)}/attempts`, { body })
}

// --- videos ---------------------------------------------------------------------------------------

/** #27 `GET /api/videos` (public; 24 per page; `meta.facets` carries the pills). */
export function fetchVideos(
  query: VideoListQuery = {},
  options: Signal = {},
): Promise<ListResult<VideoCard, VideoListMeta>> {
  return api.list<VideoCard, VideoListMeta>('/api/videos', {
    query: { ...query },
    ...withSignal(options),
  })
}

/** #28 `GET /api/videos/:id` (public; the shown `views` excludes this open, BR-M09-07). */
export function fetchVideo(id: number, options: Signal = {}): Promise<VideoDetail> {
  return api.get<VideoDetail>(`/api/videos/${String(id)}`, withSignal(options))
}

/** #29 `POST /api/videos` (201; 422 `fields`, e.g. `visibility` = `school` without a school). */
export function createVideo(body: VideoInput): Promise<MutationResult<VideoDetail>> {
  return api.post<MutationResult<VideoDetail>>('/api/videos', { body, raw: true })
}

/** #30 `PUT /api/videos/:id` (the uploader or the admin; 403 otherwise). */
export function updateVideo(id: number, body: VideoInput): Promise<MutationResult<VideoDetail>> {
  return api.put<MutationResult<VideoDetail>>(`/api/videos/${String(id)}`, { body, raw: true })
}

/** #31 `DELETE /api/videos/:id` (the uploader or the admin; 403 otherwise). */
export function deleteVideo(id: number): Promise<MutationResult<{ deleted: number }>> {
  return api.delete<MutationResult<{ deleted: number }>>(`/api/videos/${String(id)}`, {
    raw: true,
  })
}

/** #32 `GET /api/videos/form-context` (logged in). */
export function fetchVideoFormContext(options: Signal = {}): Promise<VideoFormContext> {
  return api.get<VideoFormContext>('/api/videos/form-context', withSignal(options))
}

// --- perutusan ------------------------------------------------------------------------------------

/** #33 `GET /api/perutusan` (logged in; pinned first, then newest). */
export function fetchPerutusan(options: Signal = {}): Promise<ListResult<PerutusanCard>> {
  return api.list<PerutusanCard>('/api/perutusan', withSignal(options))
}

/** #34 `GET /api/perutusan/mine`. */
export function fetchMyPerutusan(options: Signal = {}): Promise<ListResult<OwnPerutusanItem>> {
  return api.list<OwnPerutusanItem>('/api/perutusan/mine', withSignal(options))
}

/** #35 `GET /api/perutusan/:id` (records the read, BR-M09-07; 404 for an unknown or hidden post). */
export function fetchPerutusanDetail(id: number, options: Signal = {}): Promise<PerutusanDetail> {
  return api.get<PerutusanDetail>(`/api/perutusan/${String(id)}`, withSignal(options))
}

/** #36 `GET /api/perutusan/compose-context`. */
export function fetchComposeContext(options: Signal = {}): Promise<ComposeContext> {
  return api.get<ComposeContext>('/api/perutusan/compose-context', withSignal(options))
}

/** #37 `POST /api/perutusan` (multipart; 403 for a non-writer, 422 for the pin limit and files). */
export function createPerutusan(input: PerutusanInput): Promise<MutationResult<PerutusanDetail>> {
  const form = new FormData()
  form.append('title', input.title)
  form.append('body', input.body ?? '')
  for (const file of input.images ?? []) form.append('images', file)
  for (const file of input.documents ?? []) form.append('documents', file)
  if (input.youtubeUrl) form.append('youtubeUrl', input.youtubeUrl)
  form.append('isPinned', input.isPinned ? '1' : '0')
  form.append('isPublic', input.isPublic ? '1' : '0')
  form.append('status', input.status)
  if (input.scheduledAt) form.append('scheduledAt', input.scheduledAt)
  return api.multipart<MutationResult<PerutusanDetail>>('/api/perutusan', form, { raw: true })
}

/** #38 `POST /api/perutusan/:id/reactions` (toggle, BR-M09-25). */
export function reactToPerutusan(id: number, type: ReactionType): Promise<ReactionResult> {
  return api.post<ReactionResult>(`/api/perutusan/${String(id)}/reactions`, { body: { type } })
}

/** #39 `POST /api/perutusan/:id/comments` (201; stored pending, BR-M09-26). */
export function commentOnPerutusan(
  id: number,
  body: string,
): Promise<MutationResult<CommentResult>> {
  return api.post<MutationResult<CommentResult>>(`/api/perutusan/${String(id)}/comments`, {
    body: { body },
    raw: true,
  })
}

/** #40 `GET /api/public/perutusan/:id` (public; counts no read; 404 unless public and published). */
export function fetchPublicPerutusan(id: number, options: Signal = {}): Promise<PublicPerutusan> {
  return api.get<PublicPerutusan>(`/api/public/perutusan/${String(id)}`, withSignal(options))
}

// --- support --------------------------------------------------------------------------------------

/** #43 `GET /api/config/support` (public). */
export function fetchSupportConfig(options: Signal = {}): Promise<SupportConfig> {
  return api.get<SupportConfig>('/api/config/support', withSignal(options))
}
