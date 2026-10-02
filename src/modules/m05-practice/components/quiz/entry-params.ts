/**
 * S2 entry parameters (SRS M05 v1.19 FR-M05-33/34, BR-28, DV-M05-03): `?subject={CODE}` and
 * `?topic_id={id}` replace the URL with the subject's S3; `?level=` is ignored as live. Only internal
 * paths are produced (SEC-M05-11).
 */

import { api } from '@/api'

export interface EntryQuery {
  subject?: unknown
  topic_id?: unknown
}

const first = (v: unknown): string | null => {
  const raw = Array.isArray(v) ? v[0] : v
  return typeof raw === 'string' ? raw.trim() : null
}

/** The practice code (as in `codes`) that `?subject=` names, or `null`. Case-insensitive. */
export function subjectParamCode(query: EntryQuery, codes: readonly string[]): string | null {
  const raw = first(query.subject)
  if (!raw) return null
  const hit = codes.find((c) => c.toUpperCase() === raw.toUpperCase())
  return hit ?? null
}

/** The legacy topic id of `?topic_id=` (digits only), or `null`. */
export function topicParamId(query: EntryQuery): number | null {
  const raw = first(query.topic_id)
  if (!raw || !/^\d{1,9}$/.test(raw)) return null
  return Number.parseInt(raw, 10)
}

/** M03 SRS §7 #26 `GET /api/topics/:id` → `practiceCode` (M03 BR-16). Any failure → `null` (plain list). */
export async function fetchTopicPracticeCode(id: number): Promise<string | null> {
  try {
    const topic = await api.get<{ practiceCode?: string | null }>(`/api/topics/${String(id)}`)
    return typeof topic.practiceCode === 'string' && topic.practiceCode !== ''
      ? topic.practiceCode
      : null
  } catch {
    return null
  }
}

/**
 * Where S2 redirects to (replace), or `null` for the plain list. Precedence `subject`, then
 * `topic_id` (BR-28); unknown or invalid values are ignored.
 */
export async function entryTarget(
  query: EntryQuery,
  codes: readonly string[],
  lookupTopic: (id: number) => Promise<string | null> = fetchTopicPracticeCode,
): Promise<string | null> {
  const byCode = subjectParamCode(query, codes)
  if (byCode) return `/practice/${encodeURIComponent(byCode)}`
  const topicId = topicParamId(query)
  if (topicId === null) return null
  const code = await lookupTopic(topicId)
  if (!code) return null
  const known = codes.find((c) => c.toUpperCase() === code.toUpperCase())
  return known ? `/practice/${encodeURIComponent(known)}` : null
}
