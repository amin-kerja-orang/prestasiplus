/**
 * The Set Builder / Semak Kertas admin API (R1-F08, F09), shared by the HTTP client and the
 * in-browser mock. The wire shapes are the contract's (`packages/contract/src/bijak/builder`); the
 * editor data is the existing `PaperEditorData` so `PaperEditorPage` and the builder read the same
 * thing. Failures arrive as one `BuilderError` with a `kind`; `message` is the server's BM line
 * (for example `BIJAK_BUILDER_PLACEMENT_LINES`), shown verbatim by the pages.
 */
import type {
  BijakBuilderPoolUnit,
  BijakBuilderPublishResult,
  BijakBuilderReview,
  BijakBuilderSourceFilters,
  BijakBuilderStudentView,
  BijakDskpUnit,
  BijakGenerateShortage,
  BijakLevelScope,
  BijakPoolPreview,
} from '@pp/contract'

import type { AdminPaperSummary, PaperEditorData } from '../../../domain/admin-types'

export type BuilderErrorKind =
  | 'shortage' // 422 SHORTAGE: shortages
  | 'no_blueprint' // 422 NO_BLUEPRINT / 404 on pool-preview
  | 'invalid' // 400 / 422 with a BM message (placement, locked paper, order mismatch)
  | 'not_found'
  | 'forbidden'
  | 'offline'
  | 'other'

export class BuilderError extends Error {
  readonly shortages: BijakGenerateShortage[]
  constructor(
    readonly kind: BuilderErrorKind,
    message: string,
    extra: { shortages?: BijakGenerateShortage[] } = {},
  ) {
    super(message)
    this.shortages = extra.shortages ?? []
  }
}

export interface BuilderSubject {
  code: string
  name: string
  kertas: number[]
  /** The default of `Dilihat murid` per kertas, from the contract. Absent: Tingkatan 4 dan 5. */
  levelScopes?: Record<number, BijakLevelScope>
}

/** Tahun and Negeri of Jana set (multi-select, 13-08, 13-09), and the size asked. */
export interface JanaFilters {
  years?: number[]
  negeri?: string[]
  /** `Bilangan soalan`; omitted = the contract total. */
  count?: number
}

/** `POST /admin/papers/generate` (API-BIJAK-11). */
export interface GenerateOptions extends JanaFilters {
  title?: string
  levelScope?: BijakLevelScope
}

export interface PlacementResult {
  editor: PaperEditorData
  /** Question ids that were added (a whole stimulus group) or removed. */
  changed: string[]
}

export interface SectionPoolQuery {
  q?: string
  level?: 't4' | 't5' | 't1_t3'
  unit?: string
  /** `Tahun` (14-01, one year). */
  tahun?: number
  /** `Negeri` (14-02, multi-select). */
  negeri?: string[]
  page?: number
  pageSize?: number
}

export interface SectionPool {
  units: BijakBuilderPoolUnit[]
  total: number
  totalPages: number
  /** The values `Tahun` and `Negeri` offer; a filter with none is hidden (its column holds no data). */
  filters?: BijakBuilderSourceFilters
}

export interface HeaderPatch {
  title?: string
  year?: number
  durationMin?: number
  /** `Kod kertas (kulit)`; blank = the subject code. */
  code?: string
  instructions?: string[]
}

/**
 * "Sunting bahagian" patch (`PUT /admin/papers/:id`, `sections[]`, `BijakBuilderSectionPatch`). `rule` is the
 * `Jawab Semua` / `Pilih N` control (FR-ADM-Q14.2); it never changes the mark budget.
 */
export interface SectionPatch {
  label?: string
  /** `null` or empty clears it (the rule line is derived again). */
  instruction?: string | null
  compulsory?: boolean
  rule?: { type: 'all' } | { type: 'choose'; n: number }
}

/** A reference-sheet panel (`BijakPaperReferencePanel`): title, text / formula lines and an optional stored image. */
export interface ReferencePanel {
  title: string
  items: string[]
  /** File token from `POST /api/files?purpose=question_image`. */
  imageFileId?: string
}

/** Terbitkan with the audited override (R1-T34 `BijakBuilderPublishRequest`): reason of at least 5 characters. */
/** Publish answer (R1-T34): `errors`, and on a refusal `blockerDetails` + `canOverride`; `overridden` after an override. */
export type PublishResult = BijakBuilderPublishResult

export interface PublishOptions {
  override?: boolean
  reason?: string
}

/** Review answer, exactly the contract's (`blockerDetails` and `canOverride` are required). */
export type RawReview = BijakBuilderReview

export interface BuilderApi {
  listSets(): Promise<AdminPaperSummary[]>
  /** Subjects and the kertas that have a blueprint (Mula kosong / Jana set choices). */
  builderSubjects(): Promise<BuilderSubject[]>
  /** "Mula kosong": an empty draft with the blueprint's sections. Returns the paper id. */
  create(input: { subject: string; kertas: number; title?: string; levelScope?: BijakLevelScope }): Promise<string>
  /** "Jana set": a draft generated from the blueprint. Rejects with `BuilderError('shortage')`. */
  generate(subject: string, kertas: number, options?: GenerateOptions): Promise<string>
  poolPreview(subject: string, kertas: number, filters?: JanaFilters): Promise<BijakPoolPreview>
  /** `Padam` of a Draf set (a Terbit one is refused). */
  deleteSet(id: string): Promise<void>
  getEditor(id: string): Promise<PaperEditorData>
  updateHeader(id: string, patch: HeaderPatch): Promise<PaperEditorData>
  /** D90: placing a member of a stimulus group places the whole group. */
  addPlacement(id: string, sectionId: string, questionId: string): Promise<PlacementResult>
  /** D90: removing a member removes the whole group. */
  removePlacement(id: string, questionId: string): Promise<PlacementResult>
  reorder(id: string, sectionId: string, order: string[]): Promise<PaperEditorData>
  pool(id: string, sectionId: string, query?: SectionPoolQuery): Promise<SectionPool>
  review(id: string): Promise<RawReview>
  studentView(id: string): Promise<BijakBuilderStudentView>
  publish(id: string, options?: PublishOptions): Promise<PublishResult>
  /** Sunting bahagian. */
  updateSection(id: string, sectionId: string, patch: SectionPatch): Promise<PaperEditorData>
  /** Bahan rujukan (kulit kertas): replaces the whole reference-sheet list (`PUT /admin/papers/:id {reference}`, R1-T34). */
  updateReference(id: string, panels: ReferencePanel[]): Promise<PaperEditorData>
  /** Sunting petikan: the title of a stimulus group (`PUT /admin/papers/:id/groups/:groupId`). */
  updateGroupLabel(id: string, groupId: string, label: string): Promise<PaperEditorData>
  /** Tarik balik. */
  withdraw(id: string): Promise<void>
  /** Salin set: a new draft copy. Returns the new paper id. */
  copy(id: string): Promise<string>
  units(subject: string): Promise<BijakDskpUnit[]>
}

export const BUILDER_ROUTES = {
  landing: 'm28.admin.studio.sets',
  builder: 'm28.admin.studio.sets.builder',
} as const

export const BUILDER_PATH = '/admin/studio/sets'
export const builderPath = (paperId: string): string => `${BUILDER_PATH}/${encodeURIComponent(paperId)}/builder`

/** The BM text of any thrown value (the server's own line when it sent one). */
export function builderMessage(e: unknown, fallback: string): string {
  if (e instanceof BuilderError && e.kind === 'offline') return 'Luar talian. Semak sambungan anda.'
  if (e instanceof BuilderError && e.kind === 'invalid' && e.message) return e.message
  return fallback
}
