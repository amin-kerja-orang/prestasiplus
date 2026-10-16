import { z } from '../zod'
import { SCOPE_LEVELS } from '../common/enums'
import { IdSchema } from '../common/ids'

/**
 * Scope of a role grant, DERIVED BY THE SERVER (ADR-0017 item 4). The client displays it (scope
 * chip) and never sends it: no request schema contains a scope and there is no `scope` query
 * parameter. `ppd_officer` produces `district` in v2.0 (derived from the officer's school, D31a);
 * `state` stays in the enum so a later JPN grant needs no contract break.
 */
export const ScopeSchema = z
  .object({
    level: z.enum(SCOPE_LEVELS),
    stateCode: z.string().min(1).max(16).optional(),
    districtCode: z.string().min(1).max(32).optional(),
    schoolId: IdSchema.optional(),
    label: z.string().min(1).meta({ description: 'Chip text value, formed by the server (BM).' }),
  })
  .superRefine((s, ctx) => {
    const need = (ok: boolean, path: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message: `${path} is required for level ${s.level}` })
    }
    if (s.level === 'state') need(!!s.stateCode, 'stateCode')
    if (s.level === 'district') need(!!s.districtCode, 'districtCode')
    if (s.level === 'school' || s.level === 'class') need(!!s.schoolId, 'schoolId')
  })
  .meta({ id: 'Scope' })
export type Scope = z.infer<typeof ScopeSchema>
