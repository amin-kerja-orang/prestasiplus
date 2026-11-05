import {
  QuestionSchemeV2PointsKeySchema,
  QuestionSchemeV2RubricKeySchema,
  type QuestionGateIssue,
  type QuestionPart,
  type QuestionSchemeRules,
  type QuestionSchemeValidateResult,
} from '@pp/contract'
import type { z } from 'zod'

import { validateScheme, type SchemeKeyLike } from './publish-gate'
import { isLeaf, leavesOf } from './workflow/lifecycle/keys-gate'

/** Code of a body problem whose schema message is not itself a code (no PRD text; code only). */
export const SCHEME_INVALID_CODE = 'SCHEME_INVALID'
/** The Studio wizard step the scheme is edited in: 4 Tag & pengelasan (V2 Studio, 45 section 4.1). */
export const SCHEME_STEP = 4 as const

/** A zod message is a code when the contract spelled it as one (`BAND_RANGE_INVALID`, `CRITERION_MAX_REQUIRED`, ...). */
const CODE_LIKE = /^[A-Z][A-Z0-9_]+$/

export function schemeIssuesOfZod(error: z.ZodError, basePath: string): QuestionGateIssue[] {
  return error.issues.map((i) => ({
    path: [basePath, ...i.path.map(String)].join('.'),
    code: CODE_LIKE.test(i.message) ? i.message : SCHEME_INVALID_CODE,
    message: i.message,
    step: SCHEME_STEP,
  }))
}

/** The leaf of a question addressed by `partId` (its label path joined with `.`), or null for an unknown path or a branch. */
export function leafAt(parts: readonly QuestionPart[], partId: string) {
  const hit = leavesOf(parts).find((l) => l.path === partId)
  return hit && isLeaf(hit.leaf) ? hit : null
}

/**
 * API-Q-30: validates a scheme v2 body against one stored leaf. Pure and read-only. A body that does not parse is reported as issues (never
 * thrown), so the editor shows every problem at once.
 */
export function validateSchemeBody(
  parts: readonly QuestionPart[],
  partId: string,
  body: unknown,
  schemeRules: QuestionSchemeRules | null,
): QuestionSchemeValidateResult | null {
  const hit = leafAt(parts, partId)
  if (!hit) return null
  const basePath = `parts.${hit.path}.key`
  const kind = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as { kind?: unknown }).kind : undefined
  const schema = kind === 'points' ? QuestionSchemeV2PointsKeySchema : kind === 'rubric' ? QuestionSchemeV2RubricKeySchema : null
  if (!schema) {
    const message = SCHEME_INVALID_CODE
    return { ok: false, issues: [{ path: `${basePath}.kind`, code: SCHEME_INVALID_CODE, message, step: SCHEME_STEP }] }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, issues: schemeIssuesOfZod(parsed.error, basePath) }
  const mc = (hit.leaf as { modeConfig?: { example?: unknown; dependsOnPart?: string } }).modeConfig
  const issues = validateScheme(parsed.data as unknown as SchemeKeyLike, hit.leaf.marks, {
    path: basePath,
    example: mc?.example !== undefined,
    ownLabel: hit.path,
    partLabels: leavesOf(parts).map((l) => l.path),
    ...(mc?.dependsOnPart !== undefined ? { dependsOnPart: mc.dependsOnPart } : {}),
    ...(schemeRules ? { schemeRules } : {}),
  }).map((i) => ({ ...i, step: SCHEME_STEP }))
  return { ok: issues.length === 0, issues }
}
