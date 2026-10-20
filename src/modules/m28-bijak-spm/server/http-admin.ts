/**
 * HTTP implementation of the Bijak SPM admin (staff) server: the paper builder and the blueprint
 * list (`/api/admin/papers*`, `/api/admin/blueprints*`, BE-39). It extends the student client so
 * `bijakAdminServer()` is one object with both surfaces, sharing its CSRF and error handling.
 *
 * The intake, review-queue and question-bank admin screens have no Bijak backend route yet: those
 * methods REJECT (never throw synchronously) with `BijakError('unavailable')`, so each page shows
 * its own load/save error state instead of crashing.
 *
 * Like `./http` this must never import `store.ts` or the seed registry (type imports only).
 */
import type {
  BijakBlueprintView,
  BijakBuilderEditor,
  BijakBuilderPaper,
  BijakBuilderPaperSummary,
  BijakBuilderPreview,
  BijakBuilderQuestion,
  BijakBuilderQuestionStatus,
} from '@pp/contract'

import type {
  AdminPaper,
  AdminPaperSummary,
  BlueprintView,
  BuilderQuestion,
  PaperEditorData,
  PaperPatch,
  PublishPaperResult,
  QuestionStatus,
  ReviewQuestion,
} from '../domain/admin-types'
import type { StimulusDef, Subject, SubjectCode } from '../domain/types'
import { BijakError } from './errors'
import { HttpBijakServer, toBijakError, type HttpBijakOptions } from './http'
import type { BijakServer } from './store'

/** The admin methods of the mock server (the contract the admin pages read). */
export type BijakAdminMethods = Pick<
  BijakServer,
  | 'listAdminPapers'
  | 'getPaperEditor'
  | 'createPaper'
  | 'savePaper'
  | 'publishPaper'
  | 'unpublishPaper'
  | 'deletePaper'
  | 'previewQuestions'
  | 'listBlueprints'
  | 'listIntakeBatches'
  | 'getIntakeBatch'
  | 'createIntakeBatch'
  | 'createManualBatch'
  | 'saveExtracted'
  | 'submitForReview'
  | 'listReviewQueue'
  | 'getReviewItem'
  | 'reviewDecision'
  | 'resubmit'
  | 'reviseQuestion'
  | 'reviseQuestionFull'
  | 'getBankEditable'
  | 'listBank'
  | 'bankStats'
  | 'getBankDetail'
>

export const UNAVAILABLE_MESSAGE = 'Fungsi ini belum tersedia.'

/* ------------------------------------------------------------------------------ mappers */

const toMs = (iso: string): number => Date.parse(iso)

/** Wire question lifecycle code to the status the admin UI shows. */
export function questionStatusFromWire(s: BijakBuilderQuestionStatus): QuestionStatus {
  switch (s) {
    case 'published':
      return 'terbit'
    case 'review':
    case 'approved':
      return 'semakan'
    case 'archived':
      return 'ditolak'
    default:
      return 'draf'
  }
}

export function paperFromWire(p: BijakBuilderPaper): AdminPaper {
  const { createdAt, updatedAt, publishedAt, subject, kertas, ...rest } = p
  return {
    ...rest,
    subject: subject,
    kertas: kertas as 1 | 2,
    createdAt: toMs(createdAt),
    updatedAt: toMs(updatedAt),
    ...(publishedAt !== undefined ? { publishedAt: toMs(publishedAt) } : {}),
  }
}

export function summaryFromWire(s: BijakBuilderPaperSummary): AdminPaperSummary {
  return { ...s, subject: s.subject, updatedAt: toMs(s.updatedAt) }
}

export function blueprintFromWire(b: BijakBlueprintView): BlueprintView {
  return { ...b, subject: b.subject, kertas: b.kertas as 1 | 2 }
}

function questionFromWire(q: BijakBuilderQuestion): BuilderQuestion {
  return { ...q, subject: q.subject, status: questionStatusFromWire(q.status) }
}

export function editorFromWire(e: BijakBuilderEditor): PaperEditorData {
  return {
    paper: paperFromWire(e.paper),
    blueprint: e.blueprint ? blueprintFromWire(e.blueprint) : null,
    questions: e.questions.map(questionFromWire),
    groups: e.groups,
  }
}

export function previewFromWire(p: BijakBuilderPreview): {
  questions: ReviewQuestion[]
  stimuli: Record<string, StimulusDef>
  optionBanks: Record<string, { id: string; text: string }[]>
} {
  return {
    questions: p.questions.map((q) => ({
      ...q,
      curriculum: { ...q.curriculum, subject: q.curriculum.subject },
    })),
    stimuli: p.stimuli,
    optionBanks: p.optionBanks,
  }
}

/* ------------------------------------------------------------------------------- client */

const enc = encodeURIComponent
const PAGE_SIZE = 100
const MAX_PAGES = 50

function unavailable<T>(): Promise<T> {
  return Promise.reject(new BijakError('unavailable', UNAVAILABLE_MESSAGE))
}

export class HttpBijakAdminServer extends HttpBijakServer implements BijakAdminMethods {
  constructor(options: HttpBijakOptions = {}) {
    super(options)
  }

  /** Reads every page of a paged admin list (page size 100). */
  private async listAll<T>(url: string): Promise<T[]> {
    const out: T[] = []
    try {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const body = await this.client.request<{
          data: T[]
          meta?: { totalPages?: number }
        }>('GET', `${url}?page=${page}&pageSize=${PAGE_SIZE}`, { raw: true })
        out.push(...(body?.data ?? []))
        if (page >= (body?.meta?.totalPages ?? 1)) break
      }
    } catch (e) {
      throw toBijakError(e)
    }
    return out
  }

  /**
   * Staff pages must not call the student-only `GET /api/bijak/subjects` (a teacher or admin gets
   * 403, D43). The subject list comes from the admin blueprints (code and name) instead, fetched
   * once; a failed fetch degrades to an empty list without retrying.
   */
  override subjects(): readonly Subject[] {
    if (!this.subjectsRequested) {
      this.subjectsRequested = true
      this.listBlueprints().then(
        (rows) => {
          const seen = new Map<string, Subject>()
          for (const b of rows) {
            if (!seen.has(b.subject)) seen.set(b.subject, { code: b.subject, name: b.subjectName })
          }
          this.subjectList.splice(0, this.subjectList.length, ...seen.values())
        },
        () => {},
      )
    }
    return this.subjectList
  }

  /* ---------------------------------------------------------------- with a backend route */

  async listAdminPapers(): Promise<AdminPaperSummary[]> {
    const rows = await this.listAll<BijakBuilderPaperSummary>('/api/admin/papers')
    return rows.map(summaryFromWire)
  }

  async getPaperEditor(id: string): Promise<PaperEditorData> {
    return editorFromWire(
      await this.send<BijakBuilderEditor>('GET', `/api/admin/papers/${enc(id)}`),
    )
  }

  async createPaper(input: {
    subject: SubjectCode
    kertas: 1 | 2
    title?: string
  }): Promise<string> {
    const body: Record<string, unknown> = { subject: input.subject, kertas: input.kertas }
    if (input.title?.trim()) body.title = input.title.trim()
    const out = await this.send<{ id: string }>('POST', '/api/admin/papers', body)
    return out.id
  }

  async savePaper(id: string, patch: PaperPatch): Promise<PaperEditorData> {
    return editorFromWire(
      await this.send<BijakBuilderEditor>('PUT', `/api/admin/papers/${enc(id)}`, { ...patch }),
    )
  }

  publishPaper(id: string): Promise<PublishPaperResult> {
    return this.send<PublishPaperResult>('POST', `/api/admin/papers/${enc(id)}/publish`)
  }

  async unpublishPaper(id: string): Promise<void> {
    await this.send<unknown>('POST', `/api/admin/papers/${enc(id)}/withdraw`)
  }

  async deletePaper(id: string): Promise<void> {
    await this.send<unknown>('DELETE', `/api/admin/papers/${enc(id)}`)
  }

  async previewQuestions(ids: string[]) {
    return previewFromWire(
      await this.send<BijakBuilderPreview>('POST', '/api/admin/papers/preview', { ids }),
    )
  }

  async listBlueprints(): Promise<BlueprintView[]> {
    const rows = await this.listAll<BijakBlueprintView>('/api/admin/blueprints')
    return rows.map(blueprintFromWire)
  }

  /* ---------------------------------------------------- no backend route yet: not available */

  listIntakeBatches: BijakAdminMethods['listIntakeBatches'] = () => unavailable()
  getIntakeBatch: BijakAdminMethods['getIntakeBatch'] = () => unavailable()
  createIntakeBatch: BijakAdminMethods['createIntakeBatch'] = () => unavailable()
  createManualBatch: BijakAdminMethods['createManualBatch'] = () => unavailable()
  saveExtracted: BijakAdminMethods['saveExtracted'] = () => unavailable()
  submitForReview: BijakAdminMethods['submitForReview'] = () => unavailable()
  listReviewQueue: BijakAdminMethods['listReviewQueue'] = () => unavailable()
  getReviewItem: BijakAdminMethods['getReviewItem'] = () => unavailable()
  reviewDecision: BijakAdminMethods['reviewDecision'] = () => unavailable()
  resubmit: BijakAdminMethods['resubmit'] = () => unavailable()
  reviseQuestion: BijakAdminMethods['reviseQuestion'] = () => unavailable()
  reviseQuestionFull: BijakAdminMethods['reviseQuestionFull'] = () => unavailable()
  getBankEditable: BijakAdminMethods['getBankEditable'] = () => unavailable()
  listBank: BijakAdminMethods['listBank'] = () => unavailable()
  bankStats: BijakAdminMethods['bankStats'] = () => unavailable()
  getBankDetail: BijakAdminMethods['getBankDetail'] = () => unavailable()
}

export function createHttpBijakAdminServer(options: HttpBijakOptions = {}): HttpBijakAdminServer {
  return new HttpBijakAdminServer(options)
}
