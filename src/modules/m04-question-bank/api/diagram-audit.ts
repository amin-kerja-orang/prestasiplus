/**
 * M04 diagram-audit endpoints (SRS §7 #23–#25; build-plan M04-T2): S11 "Soalan Perlu Gambar Rajah",
 * upload and dismiss. Every call needs an admin session. UI tasks read this file and do not change it
 * (build-plan §S.3 rule 5).
 *
 * A diagram image must be JPG, PNG, WebP or GIF and at most 2 MB; SVG is refused (SEC-M04-02).
 */

import { api } from '@/api'

export interface DiagramRef {
  id: number
  name: string
}

/** A flagged objective question. */
export interface DiagramMcqItem {
  id: number
  questionText: string
  subject: DiagramRef | null
  /** "oleh {name}". */
  createdBy: { id: number; name: string | null }
  sourceFile: string | null
  sourcePage: number | null
}

/** A flagged structured question. `stimulusExcerpt` is cut at 400 characters (FR-M04-98). */
export interface DiagramStructuredItem {
  id: number
  stimulusExcerpt: string
  subject: DiagramRef | null
  createdBy: { id: number; name: string | null }
  sourceFile: string | null
  sourcePage: number | null
}

export interface DiagramPageMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  from: number | null
  to: number | null
}

/** #23 response: two lists, each with its own pager, and the shared aggregates. */
export interface DiagramAudit {
  data: {
    mcq: { items: DiagramMcqItem[]; meta: DiagramPageMeta }
    structured: { items: DiagramStructuredItem[]; meta: DiagramPageMeta }
  }
  meta: {
    /** The stat cards, under the active filters (DV-M04-11). */
    stats: { mcq: number; structured: number; total: number }
    /** Top 10 subjects by flagged MCQ count, global under every filter. */
    bySubject: { name: string; count: number }[]
    /** Q-FLAGGED-MCQ without filters (the SHU badge). */
    unfilteredMcq: number
  }
}

export interface DiagramAuditQuery {
  subjectId?: number | string | null
  /** Applies to the MCQ list only (BR-M04-19). */
  schoolId?: number | string | null
  mcqPage?: number
  strPage?: number
  signal?: AbortSignal
}

export type DiagramKind = 'mcq' | 'structured'

/** #24 / #25 result plus the flash text. */
export interface DiagramMutation {
  data: { id: number; needsDiagram: false }
  status: string
}

/** #23 `GET /api/diagram-audit` (raw: the body carries `data` and `meta`). */
export function fetchDiagramAudit(query: DiagramAuditQuery = {}): Promise<DiagramAudit> {
  return api.get<DiagramAudit>('/api/diagram-audit', {
    query: {
      subjectId: query.subjectId ?? null,
      schoolId: query.schoolId ?? null,
      mcqPage: query.mcqPage ?? null,
      strPage: query.strPage ?? null,
    },
    raw: true,
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #24 `POST /api/diagram-audit/:kind/:id/image` (multipart `image`; 404; 422 `fields.image`). */
export function uploadDiagramImage(
  kind: DiagramKind,
  id: number,
  image: File,
): Promise<DiagramMutation> {
  const form = new FormData()
  form.append('image', image)
  return api.post<DiagramMutation>(`/api/diagram-audit/${kind}/${String(id)}/image`, {
    body: form,
    raw: true,
  })
}

/** #25 `POST /api/diagram-audit/:kind/:id/dismiss` (404 for an unknown id). */
export function dismissDiagram(kind: DiagramKind, id: number): Promise<DiagramMutation> {
  return api.post<DiagramMutation>(`/api/diagram-audit/${kind}/${String(id)}/dismiss`, {
    raw: true,
  })
}
