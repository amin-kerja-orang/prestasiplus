/**
 * The Kontrak Blueprint admin API (BJS-F1..F4), shared by the HTTP client and the in-browser mock.
 * Types are the contract's (`packages/contract/src/bijak/{builder,standards}`); the pages only
 * depend on this interface. Failures arrive as one `KontrakError` with a `kind`, so the screens
 * read the 422 lists (problems, check, shortages) without touching HTTP.
 */
import type {
  BijakBlueprintAdminCreate,
  BijakBlueprintAdminVersionInput,
  BijakBlueprintProblem,
  BijakBlueprintVersionItem,
  BijakBlueprintView,
  BijakBlueprintWarning,
  BijakEvidenceInput,
  BijakEvidenceItem,
  BijakGenerateShortage,
  BijakPoolPreview,
  BijakDskpUnit,
  BijakVerificationCheck,
  BijakVerificationState,
} from '@pp/contract'

export type KontrakErrorKind =
  | 'invalid' // 422 BLUEPRINT_INVALID: problems
  | 'verification' // 422 VERIFICATION_FAILED: check
  | 'shortage' // 422 SHORTAGE: shortages
  | 'no_blueprint'
  | 'conflict' // 409
  | 'not_found'
  | 'forbidden'
  | 'unavailable'
  | 'offline'
  | 'other'

export class KontrakError extends Error {
  readonly problems: BijakBlueprintProblem[]
  readonly warnings: BijakBlueprintWarning[]
  readonly check: BijakVerificationCheck | null
  readonly shortages: BijakGenerateShortage[]
  constructor(
    readonly kind: KontrakErrorKind,
    message: string,
    extra: {
      problems?: BijakBlueprintProblem[]
      warnings?: BijakBlueprintWarning[]
      check?: BijakVerificationCheck | null
      shortages?: BijakGenerateShortage[]
    } = {},
  ) {
    super(message)
    this.problems = extra.problems ?? []
    this.warnings = extra.warnings ?? []
    this.check = extra.check ?? null
    this.shortages = extra.shortages ?? []
  }
}

export interface KontrakApi {
  list(): Promise<BijakBlueprintView[]>
  get(subject: string, kertas: number): Promise<BijakBlueprintView>
  create(body: BijakBlueprintAdminCreate): Promise<BijakBlueprintView>
  saveVersion(
    subject: string,
    kertas: number,
    body: BijakBlueprintAdminVersionInput,
  ): Promise<BijakBlueprintView>
  retire(subject: string, kertas: number): Promise<void>
  versions(subject: string, kertas: number): Promise<BijakBlueprintVersionItem[]>
  evidence(subject: string, kertas: number): Promise<BijakEvidenceItem[]>
  addEvidence(subject: string, kertas: number, body: BijakEvidenceInput): Promise<BijakEvidenceItem>
  removeEvidence(subject: string, kertas: number, evidenceId: string): Promise<void>
  verification(subject: string, kertas: number): Promise<BijakVerificationState>
  verify(subject: string, kertas: number, note: string): Promise<BijakBlueprintView>
  pool(subject: string, kertas: number): Promise<BijakPoolPreview>
  generateDraft(subject: string, kertas: number): Promise<{ paperId: string }>
  /** DSKP units of a subject for the unit picker (`GET /admin/bijak/dskp/units`). */
  listUnits(subject: string): Promise<BijakDskpUnit[]>
  /** Subjects the admin can add a contract for (`GET /admin/bijak/subjects`). */
  subjectOptions(): Promise<{ code: string; name: string }[]>
}

export const KONTRAK_ROUTES = {
  list: 'm28.admin.kontrak',
  edit: 'm28.admin.kontrak.edit',
  pool: 'm28.admin.kontrak.pool',
} as const

export const SOURCE_LABEL = { Draf: 'Draf', Spec: 'Spec', Disahkan: 'Disahkan' } as const
