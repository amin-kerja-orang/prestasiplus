/**
 * Row and API-shape types of the M09 stores (SRS M09 v1.2 §6.1–§6.8b). Integer ids (§6 intro).
 * Dates are ISO 8601 with +08:00 ("now" from the mock clock); date-only fields are `YYYY-MM-DD`.
 */

export const ARTICLE_CATEGORIES = [
  'TIPS_BELAJAR',
  'BERITA',
  'MOTIVASI',
  'PANDUAN_IBU_BAPA',
  'PANDUAN_GURU',
  'KEJAYAAN',
  'UMUM',
] as const
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

/** Article levels. D54 (2026-10-24): secondary / SPM only, so no Darjah (supersedes BR-M09-01's list). */
export const GRADE_LEVELS = ['SEMUA', 'TINGKATAN_4', 'TINGKATAN_5'] as const
export type GradeLevel = (typeof GRADE_LEVELS)[number]

/** DATA-M09-01. */
export interface ArticleRow {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content: string
  featuredImage: string | null
  youtubeUrl: string | null
  category: ArticleCategory
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
  views: number
  likes: number
  authorId: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

/** DATA-M09-14. */
export interface ArticleAttachmentRow {
  id: number
  articleId: number
  fileName: string
  label: string | null
  mime: string
  size: number
  storedPath: string
  createdAt: string
}

/** D54: the SPM subjects with Tingkatan 4/5 chapters in M03 (supersedes the BR-M09-11 primary list). */
export type NoteSubject =
  | 'matematik'
  | 'matematik_tambahan'
  | 'sains'
  | 'fizik'
  | 'kimia'
  | 'biologi'
  | 'bahasa_melayu'
  | 'bahasa_inggeris'
  | 'sejarah'
export type NoteType =
  'FORMULA' | 'RINGKASAN' | 'LENGKAP' | 'TIPS_TRICKS' | 'MIND_MAP' | 'FLASHCARD' | 'CHEAT_SHEET'

/** DATA-M09-02. */
export interface NoteRow {
  id: number
  title: string
  summary: string | null
  content: string
  subject: NoteSubject
  noteType: NoteType
  grade: string
  isPublished: boolean
  views: number
  downloads: number
  authorId: number
  createdAt: string
  updatedAt: string
}

/** DATA-M09-03 (codes stored upper case, BR-M09-12). */
export interface BannerRow {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  bannerType: string
  linkType: string
  externalUrl: string | null
  targetAudience: string
  displayOrder: number
  startDate: string | null
  endDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** `ActiveBanner` (§6.3): the M05 carousel maps `description` to its `body`. */
export interface ActiveBanner {
  type: string
  title: string
  description: string | null
}

export type AudioKbatStatus = 'draft' | 'pending_review' | 'approved' | 'archived'

export interface AudioKbatSection {
  no: number
  title: string
  audioFileName: string | null
  transcript: string | null
  questionFrom: number
  questionTo: number
}

export interface AudioKbatQuestion {
  no: number
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  marks: number
  kbatLevel: number
  dskpSpId: number | null
  explanation: string | null
}

/** DATA-M09-04 (sections and questions embedded). */
export interface AudioKbatSetRow {
  id: number
  title: string
  educationLevelId: number
  subjectId: number
  status: AudioKbatStatus
  sourceLabel: string | null
  instructions: string | null
  sections: AudioKbatSection[]
  questions: AudioKbatQuestion[]
  createdById: number
  createdAt: string
  updatedAt: string
}

/** `AudioKbatAttempt` (§6.4, provisional L-3; BR-M09-16): one row per submit. */
export interface AudioKbatAttemptRow {
  id: number
  setId: number
  userId: number
  answers: { no: number; choice: 'A' | 'B' | 'C' | 'D' }[]
  score: number
  totalMarks: number
  submittedAt: string
}

export type VideoCategory = 'motivasi' | 'tutorial' | 'tips-spm' | 'ceramah' | 'lain-lain'
export type VideoPlatform = 'Youtube' | 'Vimeo' | 'Dailymotion' | 'TikTok' | 'Facebook' | 'Other'
export type VideoVisibility = 'global' | 'school'

/**
 * DATA-M09-05. `listKey` is the display-order key (BR-M09-19): the list shows rows by `listKey`
 * descending. Seeded rows carry 2,260 − (position in the captured live list), so the order equals the
 * capture; runtime rows carry their creation time (always above). Not a live field.
 */
export interface VideoRow {
  id: number
  videoUrl: string
  platform: VideoPlatform
  externalId: string | null
  thumbnailUrl: string | null
  title: string
  description: string | null
  category: VideoCategory
  subjectId: number | null
  visibility: VideoVisibility
  schoolId: number | null
  uploaderId: number
  views: number
  createdAt: string
  updatedAt: string
  listKey: number
}

export type VideoFacetKey = 'subjectId' | 'category'
export type VideoCheapKey =
  | 'title'
  | 'views'
  | 'createdAt'
  | 'listKey'
  | 'platform'
  | 'visibility'
  | 'schoolId'
  | 'uploaderId'

/** DATA-M09-13. */
export interface VideoSchoolRow {
  id: number
  userId: number
  schoolId: number
}

export type PerutusanStatus = 'published' | 'scheduled' | 'draft'
export type PerutusanScope = 'national' | 'school'

export interface PerutusanFile {
  fileName: string
  size: number
}

/** DATA-M09-06. */
export interface PerutusanRow {
  id: number
  title: string
  body: string
  images: PerutusanFile[]
  documents: PerutusanFile[]
  youtubeUrl: string | null
  isPinned: boolean
  isPublic: boolean
  status: PerutusanStatus
  scheduledAt: string | null
  scope: PerutusanScope
  schoolId: number | null
  authorId: number
  reads: number
  createdAt: string
  updatedAt: string
}

export type ReactionType = 'like' | 'love' | 'thanks'

/** DATA-M09-07. */
export interface PerutusanReactionRow {
  id: number
  perutusanId: number
  userId: number
  type: ReactionType
  createdAt: string
}

export type CommentStatus = 'pending' | 'approved' | 'rejected'

/** DATA-M09-08. */
export interface PerutusanCommentRow {
  id: number
  perutusanId: number
  userId: number
  body: string
  status: CommentStatus
  createdAt: string
}

/** DATA-M09-09. */
export interface PerutusanReadRow {
  id: number
  perutusanId: number
  userId: number
  readAt: string
}

/** DATA-M09-10. */
export interface ScreenshotRow {
  id: number
  fileName: string
  originalName: string
  size: number
  mimeType: string
  uploadedById: number
  createdAt: string
}

/** DATA-M09-11 (one row, id 1). */
export interface SupportConfigRow {
  id: number
  email: string
  whatsappNumber: string
}

// --- API shapes (§6.1, §6.5, §6.7) -----------------------------------------------------------------

export interface AuthorRef {
  name: string
  initial: string
}

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

export interface HotCard extends ArticleCard {
  badge: 'PILIHAN' | 'POPULAR'
}

export interface ArticleDetail extends ArticleCard {
  content: string
  gradeLevel: GradeLevel
  gradeLabel: string
  likes: number
  related: ArticleCard[]
}

export interface AdminArticleItem {
  id: number
  title: string
  category: ArticleCategory
  categoryLabel: string
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
  views: number
  createdAt: string
  author: { id: number; name: string }
}

export interface VideoCard {
  id: number
  title: string
  platformLabel: string
  thumbnailUrl: string | null
  views: number
  createdAt: string
  uploader: { name: string; initial: string; roleLabel: string }
}

/** The viewer of a video/perutusan query (`null` = guest). */
export interface Viewer {
  id: number
  role: string
  schoolId: number | null
}

/** The user `banners.activeFor` needs. */
export interface BannerAudienceUser {
  role: string
}
