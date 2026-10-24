/**
 * M09 reader API types (SRS M09 v1.5 §6, §7 #6–#9, #20, #24–#40, #43; build-plan M09-T1). The admin
 * endpoints (#1–#5, #10–#19, #21–#23, #41–#42) are deferred and have no types yet. Dates are ISO 8601
 * with +08:00.
 */

export type ArticleCategory =
  'TIPS_BELAJAR' | 'BERITA' | 'MOTIVASI' | 'PANDUAN_IBU_BAPA' | 'PANDUAN_GURU' | 'KEJAYAAN' | 'UMUM'

export type GradeLevel = 'SEMUA' | 'TINGKATAN_4' | 'TINGKATAN_5'

export interface AuthorRef {
  name: string
  initial: string
}

/** #6 and #9 item. `publishedAt` is shown as a relative date (BR-M09-09). */
export interface ArticleCard {
  id: number
  slug: string
  title: string
  excerpt: string | null
  category: ArticleCategory
  categoryLabel: string
  isFeatured: boolean
  views: number
  publishedAt: string | null
  author: AuthorRef
}

/** #7 item (BR-M09-05). */
export interface HotCard extends ArticleCard {
  badge: 'PILIHAN' | 'POPULAR'
}

/** #8 (`views` already includes this open, BR-M09-07). `content` is HTML (SEC-M09-01). */
export interface ArticleDetail extends ArticleCard {
  content: string
  gradeLevel: GradeLevel
  gradeLabel: string
  likes: number
  related: ArticleCard[]
}

export interface ArticleListQuery {
  search?: string
  category?: ArticleCategory | 'all'
  page?: number
}

// --- banners ------------------------------------------------------------------------------------

/** #20 item; the dashboard maps `description` to its `body`. */
export interface ActiveBanner {
  type: string
  title: string
  description: string | null
}

// --- audio KBAT (provisional, L-3) ----------------------------------------------------------------

export interface AudioSetListItem {
  id: number
  title: string
  educationLevel: { id: number; name: string }
  subject: { id: number; name: string }
}

export interface AudioQuestion {
  no: number
  questionText: string
  options: { A: string; B: string; C: string; D: string }
  marks: number
}

export interface AudioSection {
  no: number
  title: string
  /** INFERRED storage path; `null` when the section has no audio file. */
  audioUrl: string | null
  questions: AudioQuestion[]
}

/** #25 (no answers, no explanations). */
export interface AudioSetDetail {
  id: number
  title: string
  instructions: string | null
  sections: AudioSection[]
}

export interface AudioAttemptRequest {
  answers: { no: number; choice: 'A' | 'B' | 'C' | 'D' }[]
}

export interface AudioAttemptResult {
  score: number
  totalMarks: number
}

export interface AudioSetListQuery {
  educationLevelId?: number
  subjectId?: number
}

// --- videos ---------------------------------------------------------------------------------------

export type VideoCategory = 'motivasi' | 'tutorial' | 'tips-spm' | 'ceramah' | 'lain-lain'
export type VideoVisibility = 'global' | 'school'

export interface VideoUploader {
  name: string
  initial: string
  roleLabel: string
}

export interface VideoCard {
  id: number
  title: string
  platformLabel: string
  thumbnailUrl: string | null
  views: number
  createdAt: string
  uploader: VideoUploader
}

export interface VideoFacets {
  /** "Semua (n)". */
  total: number
  categories: { code: VideoCategory; label: string; count: number }[]
  subjects: { id: number; name: string; count: number }[]
}

/** `meta` extension of #27. */
export interface VideoListMeta {
  facets: VideoFacets
}

export interface VideoListQuery {
  search?: string
  category?: VideoCategory | 'all'
  subject?: number
  page?: number
}

/**
 * #28, #29, #30. `platform` is the stored spelling ("Youtube", S19 preview) and is an addition to the
 * SRS §6.5 shape.
 */
export interface VideoDetail extends VideoCard {
  videoUrl: string
  embedUrl: string | null
  platform: string
  description: string | null
  category: VideoCategory
  categoryLabel: string
  subject: { id: number; name: string } | null
  visibility: VideoVisibility
  canManage: boolean
  related: VideoCard[]
}

export interface VideoInput {
  videoUrl: string
  title: string
  description?: string | null
  category: VideoCategory
  subjectId?: number | null
  visibility: VideoVisibility
}

/** #32. `school` is the user's video-form school (BR-M09-21), not the profile school. */
export interface VideoFormContext {
  uploader: VideoUploader
  school: { id: number; name: string } | null
}

/** Mutating answers: `{data, status}` with the flash text (PROPOSED COPY, SRS §8.2). */
export interface MutationResult<T> {
  data: T
  status: string
}

// --- perutusan ------------------------------------------------------------------------------------

export type ReactionType = 'like' | 'love' | 'thanks'
export type PerutusanStatus = 'published' | 'scheduled' | 'draft'

export interface PerutusanCard {
  id: number
  title: string
  excerpt: string
  isPinned: boolean
  hasVideo: boolean
  scopeLabel: string
  createdAt: string
  author: { name: string; initials: string; roleLabel: string }
  topReaction: { type: ReactionType; emoji: string; count: number } | null
  commentCount: number
  reads: number
}

export interface PerutusanFile {
  fileName: string
  size: number
}

/** #35 and #37. `publicUrl` is the path `/perutusan/awam/{id}` (the client adds the origin). */
export interface PerutusanDetail extends PerutusanCard {
  body: string
  youtubeEmbedUrl: string | null
  images: PerutusanFile[]
  documents: PerutusanFile[]
  isPublic: boolean
  publicUrl: string | null
  reactions: Record<ReactionType, number>
  myReactions: ReactionType[]
  canWrite: boolean
}

export interface OwnPerutusanItem {
  id: number
  title: string
  status: PerutusanStatus
  statusLabel: string
  createdAt: string
}

/** #36. `scope` is `null` for a role that cannot write. */
export interface ComposeContext {
  scope: 'national' | 'school' | null
  scopeLabel: string
  canWrite: boolean
}

/** #37 fields; the client sends them as multipart (`FormData`). */
export interface PerutusanInput {
  title: string
  body?: string
  images?: File[]
  documents?: File[]
  youtubeUrl?: string
  isPinned?: boolean
  isPublic?: boolean
  status: PerutusanStatus
  scheduledAt?: string
}

export interface ReactionResult {
  reactions: Record<ReactionType, number>
  myReactions: ReactionType[]
}

export interface CommentResult {
  id: number
  status: 'pending'
}

/** #40 (provisional; the extras beyond the SRS field list are what FR-M09-131 needs). */
export interface PublicPerutusan {
  id: number
  title: string
  author: { name: string; initials: string; roleLabel: string }
  body: string
  createdAt: string
  youtubeEmbedUrl: string | null
  scopeLabel: string
  reactionTotal: number
  reads: number
  commentCount: number
}

// --- support --------------------------------------------------------------------------------------

/** #43. */
export interface SupportConfig {
  email: string
  whatsappNumber: string
}
