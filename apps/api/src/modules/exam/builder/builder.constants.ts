import type { RateLimitSpec } from '../../../common/throttle'

/**
 * Rate limits of the paper builder and blueprint admin routes (BE-39), per signed-in Admin Pusat
 * user. The environment variables are documented in `.env.api.example`. The preview is a POST that
 * reads, so it shares the write bucket (it is a write in the contract, D57a).
 */
export const BIJAK_BUILDER_LIMITS = {
  read: { bucket: 'bijak.builder.read', env: 'THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE', default: 240, per: 'user' },
  write: { bucket: 'bijak.builder.write', env: 'THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE', default: 60, per: 'user' },
  /** Jana set runs the solver and writes about forty rows: kept low. */
  generate: { bucket: 'bijak.builder.generate', env: 'THROTTLE_BIJAK_BUILDER_GENERATE_PER_MINUTE', default: 10, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/**
 * Question statuses a paper may place and serve (D54a). ONE constant and ONE helper. Since R1-B01 (ADR-0027)
 * `approved` is the only servable status of a question; `published` survives only on papers.
 */
export const SERVABLE_QUESTION_STATUSES: readonly string[] = ['approved']
export const isServableStatus = (status: string): boolean => SERVABLE_QUESTION_STATUSES.includes(status)

/** Candidates per page of the section pool. */
export const POOL_PAGE_SIZE = 30

/** Default page size of `GET /admin/papers` and `GET /admin/blueprints` (contract max 100). */
export const BIJAK_BUILDER_PAGE_SIZE = 20

/** The editor picker shows at most this many candidates (BE-39, security review M3). */
export const MAX_EDITOR_CANDIDATES = 1000
/** Extra candidates the source returns, because the editor drops those already on the paper before it caps. */
export const CANDIDATE_SLACK = 500

/** D90/D93: a stimulus group needs at least this many member questions to be placed in a paper. */
export const MIN_GROUP_MEMBERS = 2

/**
 * D93 builder blocker (exact BM text). Mirrors T32 `STIMULUS_MESSAGES.builderBlocker`
 * (`packages/contract/src/questions/stimuli.ts` on branch r1/t32-stimulus-api): swap this constant for that export once T32 is merged.
 */
export const GROUP_MIN_MEMBERS_MESSAGE = 'Kumpulan perlu sekurang-kurangnya 2 soalan.'

/** R1E2E-06: a placed question the attempt path (`resolveForAttempt` + BE-09 bridge) would refuse blocks Terbit; `reason` is the Servability sentence. */
export const attemptRefusalLine = (questionId: string, reason: string): string => `Soalan ${questionId} tidak dapat dihidangkan kepada murid: ${reason}`

/** R1E2E-06 / structural check: a placed question is not among the live candidates of the subject and kertas (reason text of `LINES.ineligible`). */
export const MISSING_FROM_POOL_TEXT = 'tiada dalam kolam soalan kertas ini'

/** R1E2E-07 / AC-R1-16.2: the contract (blueprint) the paper conforms to is not Disahkan. `status` is the wire provenance (Spec, Draf). */
export const contractNotVerifiedLine = (code: string, version: number, status: string): string =>
  `Kontrak Simulasi ${code} (versi ${String(version)}) belum Disahkan (status: ${status}); Terbit memerlukan kontrak Disahkan.`

/** Text search of the section pool describes candidates in chunks of this size. */
export const DESCRIBE_CHUNK = 1000
