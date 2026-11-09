/**
 * V2 Panel "Subjektif Sunting" (Skema & Rubrik) endpoints: `GET/PUT /api/structured-questions/:id/rubric`. Admin Pusat only.
 * A V2 sub-question is a leaf part of the V3 question; only a leaf with a points key is editable.
 */

import { api } from '@/api'

/** One leaf part. `id` is its label path; only a leaf with a points key is `editable`. */
export interface StructuredRubricSub {
  id: string
  number: string
  body: string
  marks: number
  editable: boolean
  scheme: string | null
  points: { id: string; code: string; text: string; marks: number }[]
}

export interface StructuredRubric {
  question: {
    id: string
    stimulus: string
    subject: string | null
    level: string | null
    status: 'draft' | 'review' | 'approved' | 'archived'
    totalMarks: number
  }
  subs: StructuredRubricSub[]
}

export interface StructuredRubricSave {
  subs: { id: string; scheme: string | null; points: { text: string; marks: number }[] }[]
}

/** `GET /api/structured-questions/:id/rubric` (404 for an unknown or objective id). */
export function fetchStructuredRubric(id: string, options: { signal?: AbortSignal } = {}): Promise<StructuredRubric> {
  return api.get<StructuredRubric>(
    `/api/structured-questions/${encodeURIComponent(id)}/rubric`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** `PUT /api/structured-questions/:id/rubric` (422 `fields` keyed `subs.<i>.scheme` and `subs.<i>.points.<j>.text|marks`). */
export function saveStructuredRubric(
  id: string,
  body: StructuredRubricSave,
): Promise<{ data: StructuredRubric; status: string }> {
  return api.put<{ data: StructuredRubric; status: string }>(`/api/structured-questions/${encodeURIComponent(id)}/rubric`, {
    body,
    raw: true,
  })
}
