/**
 * The ONE eligibility call of the papers recompute: which of these V3 questions may be placed on a PUBLISHED paper (pupils are served from it).
 *
 * TODO(M-A, coordinator): this is a stand-in adapter. The exam builder's servability rule (builder.service.ts `reasonOf` / serving/rules.ts:
 * held `legacy_image_unresolved`, inactive, unresolved media, ...) is being fixed by another agent, which will export one function. When it exists,
 * replace the body of `servableQuestionIds` with a call to it; nothing else in the recompute changes. Do not grow a second copy of the rule here.
 * The stand-in is deliberately strict: active, has a live version, and the live version carries no `legacy_image_unresolved` hold.
 */
import type { SqlExecutor } from '../../kit/types'

export async function servableQuestionIds(db: SqlExecutor, questionIds: readonly string[]): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set()
  const res = await db.query<{ id: string }>(
    `SELECT q.id::text AS id FROM questions q
       JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
      WHERE q.id = ANY($1::bigint[]) AND q.is_active
        AND NOT coalesce(jsonb_typeof(v.import_issues) = 'array' AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false)`,
    [questionIds],
  )
  return new Set(res.rows.map((r) => r.id))
}
