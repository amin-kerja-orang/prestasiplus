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
  BijakBuilderStudentView,
  BijakDskpUnit,
  BijakGenerateShortage,
  BijakPoolPreview,
} from '@pp/contract'

import type { RawBlocker } from '../domain/blockers'
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
  page?: number
  pageSize?: number
}

export interface SectionPool {
  units: BijakBuilderPoolUnit[]
  total: number
  totalPages: number
}

export interface HeaderPatch {
  title?: string
  year?: number
  durationMin?: number
  instructions?: string[]
}

/**
 * "Sunting bahagian" patch (`PUT /admin/papers/:id`, `sections[]`, R1-T34 `BijakBuilderSectionPatch`
 * @ r1/t34-builder-review 4d771b47). The answering rule and the count come from the blueprint and are
 * not editable here.
 */
export interface SectionPatch {
  label?: string
  /** `null` or empty clears it (the rule line is derived again). */
  instruction?: string | null
  compulsory?: boolean
}

/** Terbitkan with the audited override (R1-T34 `BijakBuilderPublishRequest`): reason of at least 5 characters. */
/** Publish answer; `overridden` is R1-T34 (absent on the base contract until T34 merges). */
export type PublishResult = BijakBuilderPublishResult & { overridden?: string[] }

export interface PublishOptions {
  override?: boolean
  reason?: string
}

/** Review answer in either blocker shape (see `domain/blockers.ts`); `canOverride` comes with the A3 shape. */
export type RawReview = Omit<BijakBuilderReview, 'blockers'> & {
  blockers: (string | RawBlocker)[]
  canOverride?: boolean
}

export interface BuilderApi {
  listSets(): Promise<AdminPaperSummary[]>
  /** Subjects and the kertas that have a blueprint (Mula kosong / Jana set choices). */
  builderSubjects(): Promise<BuilderSubject[]>
  /** "Mula kosong": an empty draft with the blueprint's sections. Returns the paper id. */
  create(input: { subject: string; kertas: number; title?: string }): Promise<string>
  /** "Jana set": a draft generated from the blueprint. Rejects with `BuilderError('shortage')`. */
  generate(subject: string, kertas: number): Promise<string>
  poolPreview(subject: string, kertas: number): Promise<BijakPoolPreview>
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
