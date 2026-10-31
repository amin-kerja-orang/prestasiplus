/**
 * HTTP implementation of the Bijak SPM admin (staff) server: the paper builder and the blueprint
 * list (`/api/admin/papers*`, `/api/admin/blueprints*`, BE-39). It extends the student client so
 * `bijakAdminServer()` is one object with both surfaces, sharing its CSRF and error handling.
 *
 * The intake list, detail and upload call the BE-37 routes (`/api/intake/*`, see ./intake-wire); the
 * extracted-question editor, the extraction step and the review queue call the BE-38 routes
 * (`/api/intake/items*`, `/stimuli`, `/extract`, `/review`; ./intake-wire, ./review-wire); the bank
 * list, stats and preview read the BE-09 admin questions (`/api/questions*`; ./bank-wire). The few
 * methods with no route (the bank "Sunting" versions, "Minta Pembetulan") REJECT (never throw
 * synchronously) with `BijakError('unavailable')`, so each page shows its own state, not a crash.
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
import type {
  BankDetail,
  BankFilter,
  BankRow,
  BankStats,
  DecisionAction,
  DecisionResult,
  QueueFilter,
  QueueItem,
  QuestionStatus as BankStatus,
  ReviewDetail,
} from '../domain/admin-types'
import type {
  IntakeBatch,
  IntakeIssue,
  IntakeQuestion,
  IntakeStimulus,
  IntakeSummary,
  IntakeMeta,
  ExtractedPaper,
  ManualMeta,
  PageText,
  IntakeStatus,
  SaveExtractedPayload,
} from '../admin/intake/types'
import {
  bankDetailFrom,
  bankRowFrom,
  wireStatusesOf,
  type WireBankDetail,
  type WireBankRow,
} from './bank-wire'
import { BijakError } from './errors'
import {
  batchCreateToWire,
  batchFromWire,
  issuesFromWire,
  itemPatch,
  pagesFromWire,
  questionFromItem,
  stimulusFromWire,
  summaryFromWire as intakeSummaryFromWire,
  type SaveIdMap,
  type WireBatchDetail,
  type WireBatchSummary,
  type WireItem,
  type WirePage,
  type WireReview,
  type WireStimulus,
} from './intake-wire'
import {
  countsFromWire,
  queueItemFromRow,
  reviewDetailFromItem,
  statesOfStatus,
  type QueueContext,
} from './review-wire'
import type { IntakeItemRow, IntakeItemStateCounts } from '@pp/contract'
import { ApiError } from '@/api'
import { HttpBijakServer, toBijakError, type HttpBijakOptions } from './http'
import type { BijakServer } from './store'

/** The admin methods of the mock server (the contract the admin pages read). */
export type BijakAdminMethods = Omit<
  Pick<
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
  | 'createManualBatch'
  | 'saveExtracted'
  | 'submitForReview'
  | 'decideIntakeItem'
  | 'acceptUnreviewed'
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
>,
  'createIntakeBatch'
> & {
  /** `file` (http mode) is the PDF uploaded to the server; the mock reads the extraction instead. */
  createIntakeBatch(
    userId: number,
    meta: IntakeMeta,
    extracted: ExtractedPaper,
    pages: PageText[],
    file?: File,
  ): Promise<IntakeBatch>
  /** http mode only: asks the server to extract the questions of an uploaded batch (BE-38). */
  extractBatch?(batchId: string): Promise<void>
}

export const UNAVAILABLE_MESSAGE = 'Fungsi ini belum tersedia.'

/* ------------------------------------------------------------------------------ mappers */

const toMs = (iso: string): number => Date.parse(iso)

/** Wire question lifecycle code to the status the admin UI shows. */
export function questionStatusFromWire(s: BijakBuilderQuestionStatus): QuestionStatus {
  switch (s) {
    case 'approved':
      return 'terbit' // ADR-0027: approved is the servable (Terbit) state
    case 'review':
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

const BANK_PAGE = 50
const EMPTY_COUNTS: IntakeItemStateCounts = { generated: 0, needs_review: 0, accepted: 0, rejected: 0, duplicate: 0 }
const REMOVED_REASON = 'Dibuang oleh penyemak.'
const REJECT_REASON_REQUIRED = 'Sebab penolakan diperlukan.'

/** 409 of an item that was accepted or rejected meanwhile (contract INTAKE_MESSAGES.itemLocked / itemAlreadyAccepted). */
const ITEM_LOCKED = [
  'Item ini sudah diterima atau ditolak dan tidak boleh disunting.',
  'Item ini sudah diterima.',
]
function isItemLocked(e: unknown): boolean {
  return e instanceof BijakError && e.code === 'bad_request' && ITEM_LOCKED.includes(e.message)
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Runs `fn` over `items` with at most `limit` in flight; results keep the input order. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** PATCH body of a stimulus, or null when nothing changed. */
function stimulusPatch(prev: IntakeStimulus, next: IntakeStimulus): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  if (prev.label !== next.label) out.label = next.label
  if ((prev.caption ?? '') !== (next.caption ?? '')) out.caption = next.caption || null
  if (prev.alt !== next.alt) out.alt = next.alt
  if ((prev.text ?? '') !== (next.text ?? '')) out.text = next.text || null
  if (JSON.stringify(prev.table ?? null) !== JSON.stringify(next.table ?? null)) out.table = next.table ?? null
  return Object.keys(out).length > 0 ? out : null
}

/** BM messages of a refused accept / reject: the gate issues, else the field messages, else the message. */
export function decisionErrors(e: ApiError): string[] {
  const body = e.body as { error?: { details?: { issues?: { where: string; message: string }[] } } } | null
  const issues = body?.error?.details?.issues
  if (issues && issues.length > 0) return issues.map((i) => `${i.where}: ${i.message}`)
  if (e.fields && Object.keys(e.fields).length > 0) return Object.values(e.fields)
  return [e.message]
}

function unavailable<T>(): Promise<T> {
  return Promise.reject(new BijakError('unavailable', UNAVAILABLE_MESSAGE))
}

/** 413 / 422 of the upload to the UI copy (the 422 body names the rule in `fields.files`). */
export function uploadError(e: unknown): unknown {
  if (e instanceof ApiError) {
    if (e.status === 413) return new BijakError('bad_request', 'Fail melebihi had 20 MB.')
    if (e.status === 422) {
      return new BijakError('bad_request', e.fields?.files ?? e.message)
    }
  }
  return toBijakError(e)
}

interface Snapshot {
  /** Open items and stimuli as the server last returned them (the base of the next diff). */
  questions: Map<string, IntakeQuestion>
  stimuli: Map<string, IntakeStimulus>
  /** Local id (a row the editor added) to the server id it got. */
  alias: Map<string, string>
  /** Items decided elsewhere (accepted or rejected from the queue) while the editor was open. */
  locked: Set<string>
  base: IntakeBatch
}

export class HttpBijakAdminServer extends HttpBijakServer implements BijakAdminMethods {
  private readonly snapshots = new Map<string, Snapshot>()
  private readonly batchInfo = new Map<string, WireBatchDetail>()
  private subjectsReady: Promise<readonly Subject[]> | null = null

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

  /* ------------------------------------------------------- intake (BE-37 routes) */

  async listIntakeBatches(
    filter: { status?: IntakeStatus; subject?: SubjectCode; q?: string } = {},
  ): Promise<IntakeSummary[]> {
    const rows = await this.listAll<WireBatchSummary>('/api/intake/batches')
    const nameOf = (code: string): string =>
      this.subjectList.find((s) => s.code === code)?.name ?? code
    const needle = filter.q?.trim().toLowerCase()
    return rows
      .map((b) => intakeSummaryFromWire(b, nameOf))
      .filter((b) => !filter.status || b.status === filter.status)
      .filter((b) => !filter.subject || b.subject === filter.subject)
      .filter((b) => !needle || `${b.title} ${b.fileName}`.toLowerCase().includes(needle))
  }

  async getIntakeBatch(id: string): Promise<IntakeBatch> {
    const detail = await this.send<WireBatchDetail>('GET', `/api/intake/batches/${enc(id)}`)
    this.batchInfo.set(id, detail)
    const lists: { pages: WirePage[] }[] = []
    for (const f of detail.files) {
      if (f.status !== 'done') {
        lists.push({ pages: [] })
        continue
      }
      try {
        lists.push(
          await this.send<{ pages: WirePage[] }>('GET', `/api/intake/files/${enc(f.id)}/pages`),
        )
      } catch {
        lists.push({ pages: [] }) // the text is a convenience; the batch still opens
      }
    }
    // The extracted items are what the screen edits; if they cannot be read the batch still opens
    // with the "unavailable" note (itemsUnavailable) instead of failing.
    let extras: { items?: WireItem[]; review?: WireReview } = {}
    try {
      const review = await this.send<WireReview>('GET', `/api/intake/batches/${enc(id)}/review`)
      extras = { review, items: await this.loadOpenItems(id) }
    } catch {
      extras = {}
    }
    const batch = batchFromWire(detail, pagesFromWire(lists), extras)
    this.snapshots.set(id, {
      questions: new Map(batch.questions.map((q) => [q.id, clone(q)])),
      stimuli: new Map(batch.stimuli.map((x) => [x.id, clone(x)])),
      alias: this.snapshots.get(id)?.alias ?? new Map(),
      locked: new Set(),
      base: clone(batch),
    })
    return batch
  }

  /** Items still to decide (generated, needs_review, duplicate), in paper order, with full content. */
  private async loadOpenItems(batchId: string): Promise<WireItem[]> {
    const { rows } = await this.pagedAll<IntakeItemRow>(`/api/intake/items?batchId=${enc(batchId)}`)
    const open = rows.filter((r) => r.state !== 'accepted' && r.state !== 'rejected')
    const items = await mapLimit(open, 6, (r) =>
      this.send<WireItem>('GET', `/api/intake/items/${enc(r.id)}`),
    )
    return items.sort((a, b) => a.position - b.position)
  }

  /** Every page of a paged list (page size 100) with the `meta` of the first page. */
  private async pagedAll<T, M = Record<string, unknown>>(
    url: string,
  ): Promise<{ rows: T[]; meta: M | undefined }> {
    const rows: T[] = []
    let first: M | undefined
    try {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const sep = url.includes('?') ? '&' : '?'
        const body = await this.client.request<{
          data: T[]
          meta?: M & { totalPages?: number }
        }>('GET', `${url}${sep}page=${page}&pageSize=${PAGE_SIZE}`, { raw: true })
        rows.push(...(body?.data ?? []))
        if (page === 1) first = body?.meta
        if (page >= (body?.meta?.totalPages ?? 1)) break
      }
    } catch (e) {
      throw toBijakError(e)
    }
    return { rows, meta: first }
  }

  /** Declaration (POST /intake/batches); the same body for an upload and a manual batch. */
  private declare(meta: Omit<IntakeMeta, 'fileName' | 'fileHash' | 'pageCount'>): Promise<WireBatchSummary> {
    return this.send<WireBatchSummary>('POST', '/api/intake/batches', batchCreateToWire(meta))
  }

  /**
   * Declaration (POST /intake/batches) then the PDF (multipart `files` part, POST
   * /intake/batches/{id}/files). The browser extraction (`extracted`, `pages`) is not sent: the
   * server reads the file itself and extracts on request (`extractBatch`). A failed upload cancels
   * the new batch (best effort).
   */
  async createIntakeBatch(
    _userId: number,
    meta: IntakeMeta,
    _extracted: ExtractedPaper,
    _pages: PageText[],
    file?: File,
  ): Promise<IntakeBatch> {
    const created = await this.declare(meta)
    if (file) {
      const form = new FormData()
      form.append('files', file, file.name)
      try {
        await this.exec('POST', `/api/intake/batches/${enc(created.id)}/files`, form)
      } catch (e) {
        await this.exec('POST', `/api/intake/batches/${enc(created.id)}/cancel`).catch(() => {})
        throw uploadError(e)
      }
    }
    return this.getIntakeBatch(created.id)
  }

  /** "Tulis Soalan Manual": a declaration without a file plus one blank item (POST .../items). */
  async createManualBatch(_userId: number, meta: ManualMeta): Promise<IntakeBatch> {
    // `forPaperId` (return to the paper builder) has no wire field: the link back is not kept.
    const created = await this.declare(meta)
    await this.send<WireItem>('POST', `/api/intake/batches/${enc(created.id)}/items`, { page: 1 })
    return this.getIntakeBatch(created.id)
  }

  /** POST /intake/batches/{id}/extract: 202 (queued or running) or 200 (already done); the page polls. */
  async extractBatch(batchId: string): Promise<void> {
    await this.send<unknown>('POST', `/api/intake/batches/${enc(batchId)}/extract`, {})
  }

  /* --------------------------------------------------- items: save the editor (BE-38) */

  /** Saves are serialised: an autosave and the "Simpan draf" button must not interleave. */
  private saveChain: Promise<unknown> = Promise.resolve()

  saveExtracted(id: string, payload: SaveExtractedPayload): Promise<IntakeBatch> {
    const run = this.saveChain.then(() => this.persistExtracted(id, payload))
    this.saveChain = run.catch(() => {})
    return run
  }

  /**
   * Sends only what changed since the last read: new stimuli (POST), edited ones (PATCH), removed
   * ones (DELETE), new items (POST then PATCH), edited items (PATCH), removed items (reject with a
   * fixed reason, the item is kept with it). The page keeps its local ids for new rows until the
   * result's `idMap` is applied; progress made before a failure is remembered so a retry does not
   * create a second copy.
   */
  private async persistExtracted(id: string, payload: SaveExtractedPayload): Promise<IntakeBatch> {
    if (!this.snapshots.has(id)) await this.getIntakeBatch(id)
    const snap = this.snapshots.get(id)!
    const stimOf = (sid: string): string => snap.alias.get(sid) ?? sid

    // 1. stimuli, so that items can point at their server ids
    const keepStimuli = new Set<string>()
    for (const st of payload.stimuli) {
      const sid = stimOf(st.id)
      keepStimuli.add(sid)
      const prev = snap.stimuli.get(sid)
      if (!prev) {
        const created = await this.send<WireStimulus>('POST', `/api/intake/batches/${enc(id)}/stimuli`, {
          kind: st.kind,
          label: st.label,
          ...(st.page ? { page: st.page } : {}),
          ...(st.caption ? { caption: st.caption } : {}),
          ...(st.alt ? { alt: st.alt } : {}),
          ...(st.text ? { text: st.text } : {}),
          ...(st.table ? { table: st.table } : {}),
        })
        snap.alias.set(st.id, created.id)
        snap.stimuli.set(created.id, stimulusFromWire(created))
        keepStimuli.add(created.id)
        continue
      }
      const patch = stimulusPatch(prev, st)
      if (patch) {
        const updated = await this.send<WireStimulus>('PATCH', `/api/intake/stimuli/${enc(sid)}`, patch)
        snap.stimuli.set(sid, stimulusFromWire(updated))
      }
    }
    // (removal of a stimulus waits until the items stopped using it, below)

    // 2. items
    const keepItems = new Set<string>()
    for (const q of payload.questions) {
      let qid = snap.alias.get(q.id) ?? q.id
      if (snap.locked.has(qid)) continue
      let prev = snap.questions.get(qid)
      if (!prev) {
        const created = await this.send<WireItem>('POST', `/api/intake/batches/${enc(id)}/items`, {
          page: q.page,
        })
        qid = created.id
        snap.alias.set(q.id, qid)
        prev = questionFromItem(created)
        snap.questions.set(qid, clone(prev))
      }
      keepItems.add(qid)
      const next: IntakeQuestion = {
        ...q,
        id: qid,
        ...(q.stimulusId ? { stimulusId: stimOf(q.stimulusId) } : {}),
      }
      if (!q.stimulusId) delete next.stimulusId
      const patch = itemPatch(prev, next)
      if (patch) {
        try {
          const updated = await this.send<WireItem>('PATCH', `/api/intake/items/${enc(qid)}`, patch)
          snap.questions.set(qid, questionFromItem(updated))
        } catch (e) {
          if (!isItemLocked(e)) throw e
          // Decided from the queue meanwhile: leave it out from now on and carry on with the rest.
          snap.questions.delete(qid)
          snap.locked.add(qid)
        }
      }
    }
    for (const [qid] of [...snap.questions]) {
      if (keepItems.has(qid)) continue
      try {
        await this.send<unknown>('POST', `/api/intake/items/${enc(qid)}/reject`, {
          reason: REMOVED_REASON,
        })
      } catch (e) {
        if (!isItemLocked(e)) throw e
      }
      snap.questions.delete(qid)
    }

    // 3. stimuli the editor dropped (their items were detached above or by the server)
    for (const [sid] of [...snap.stimuli]) {
      if (keepStimuli.has(sid)) continue
      await this.send<unknown>('DELETE', `/api/intake/stimuli/${enc(sid)}`)
      snap.stimuli.delete(sid)
      for (const [k, v] of snap.questions) if (v.stimulusId === sid) snap.questions.set(k, { ...v, stimulusId: undefined })
    }

    const idMap: SaveIdMap = { items: {}, stimuli: {} }
    for (const [local, server] of snap.alias) {
      if (snap.questions.has(server)) idMap.items[local] = server
      else if (snap.stimuli.has(server)) idMap.stimuli[local] = server
    }
    return {
      ...clone(snap.base),
      questions: payload.questions
        .filter((q) => !snap.locked.has(snap.alias.get(q.id) ?? q.id))
        .map((q) => clone(snap.questions.get(snap.alias.get(q.id) ?? q.id) ?? q)),
      stimuli: payload.stimuli.map((x) => clone(snap.stimuli.get(snap.alias.get(x.id) ?? x.id) ?? x)),
      idMap,
    }
  }

  /**
   * The batch moves nothing server-side (the items are in the review queue since extraction); this
   * runs the batch gate (`GET .../review`, which also lists the batch-level rules) and shows the
   * Semakan state for the session.
   */
  async submitForReview(
    id: string,
  ): Promise<{ ok: true; batch: IntakeBatch } | { ok: false; issues: IntakeIssue[] }> {
    const review = await this.send<WireReview>('GET', `/api/intake/batches/${enc(id)}/review`)
    if (review.issues.length > 0) return { ok: false, issues: issuesFromWire(review.issues) }
    const batch = await this.getIntakeBatch(id)
    const at = Date.now()
    return { ok: true, batch: { ...batch, status: 'semakan', submittedAt: at, updatedAt: at } }
  }

  /** "Terima (A)" / "Tolak (R)" of one item of the batch (`POST /api/intake/items/:id/accept|reject`). */
  async decideIntakeItem(
    id: string,
    questionId: string,
    d: { action: 'terbit' | 'tolak'; reason?: string },
  ): Promise<{ ok: boolean; errors: string[]; batch: IntakeBatch }> {
    const res = await this.reviewDecision(questionId, { action: d.action, ...(d.reason ? { reason: d.reason } : {}) })
    return { ok: res.ok, errors: res.errors, batch: await this.getIntakeBatch(id) }
  }

  /**
   * "Terima semua yang belum disemak": `POST /api/intake/items/bulk` with `accept` over the items still open.
   * The server takes only the items at or above its confidence threshold and lists the rest.
   */
  async acceptUnreviewed(
    id: string,
  ): Promise<{ done: number; skipped: { id: string; reason: 'BELOW_THRESHOLD' | 'GATE_FAILED' }[]; batch: IntakeBatch }> {
    const batch = await this.getIntakeBatch(id)
    const ids = batch.questions.map((q) => q.id).slice(0, 100)
    if (ids.length === 0) return { done: 0, skipped: [], batch }
    const res = await this.send<{ done: number; results: { id: string; outcome: string; reason: string | null }[] }>(
      'POST',
      '/api/intake/items/bulk',
      { action: 'accept', ids },
    )
    const skipped = res.results
      .filter((r) => r.outcome === 'skipped')
      .map((r) => ({ id: r.id, reason: (r.reason === 'GATE_FAILED' ? 'GATE_FAILED' : 'BELOW_THRESHOLD') as 'BELOW_THRESHOLD' | 'GATE_FAILED' }))
    return { done: res.done, skipped, batch: await this.getIntakeBatch(id) }
  }

  /* ----------------------------------------------------- review queue (BE-38 items) */

  private async queueContext(batchIds: readonly string[]): Promise<QueueContext> {
    const subjects = await this.ensureSubjects()
    await mapLimit(
      batchIds.filter((b) => !this.batchInfo.has(b)),
      6,
      async (b) => {
        try {
          this.batchInfo.set(b, await this.send<WireBatchDetail>('GET', `/api/intake/batches/${enc(b)}`))
        } catch {
          /* the row still lists; kertas and source stay blank */
        }
      },
    )
    return {
      subjectName: (code) => subjects.find((s) => s.code === code)?.name ?? code,
      batch: undefined,
      now: Date.now(),
    }
  }

  private ctxFor(base: QueueContext, batchId: string): QueueContext {
    const b = this.batchInfo.get(batchId)
    return { ...base, batch: b ? { kertas: b.kertas, source: b.source } : undefined }
  }

  async listReviewQueue(f: QueueFilter = {}): Promise<{
    items: QueueItem[]
    counts: Record<BankStatus, number>
  }> {
    const status = f.status ?? 'semakan'
    const states = statesOfStatus(status)
    const params = new URLSearchParams()
    if (f.subject) params.set('subject', f.subject)
    if (states && states.length === 1) params.set('state', states[0]!)
    if (states && states.length === 0) {
      // Nothing in the queue is Terbit (accept makes a Draf): one tiny read for the tab counts only.
      params.set('pageSize', '1')
      let meta: { counts?: IntakeItemStateCounts } | undefined
      try {
        meta = (
          await this.client.request<{ meta?: { counts?: IntakeItemStateCounts } }>(
            'GET',
            `/api/intake/items?${params}`,
            { raw: true },
          )
        )?.meta
      } catch (e) {
        throw toBijakError(e)
      }
      return { items: [], counts: countsFromWire(meta?.counts ?? EMPTY_COUNTS) }
    }
    const { rows, meta } = await this.pagedAll<IntakeItemRow, { counts?: IntakeItemStateCounts }>(
      `/api/intake/items${params.size ? `?${params}` : ''}`,
    )
    const counts = countsFromWire(
      meta?.counts ?? EMPTY_COUNTS,
    )
    const wanted = states === null ? rows : rows.filter((r) => states.includes(r.state))
    const base = await this.queueContext([...new Set(wanted.map((r) => r.batchId))])
    const items = wanted
      .map((r) => queueItemFromRow(r, this.ctxFor(base, r.batchId)))
      .filter((i) => (!f.kertas || i.kertas === f.kertas) && (!f.kind || i.kind === f.kind))
    return { items, counts }
  }

  async getReviewItem(key: string): Promise<ReviewDetail> {
    const item = await this.send<WireItem>('GET', `/api/intake/items/${enc(key)}`)
    const base = await this.queueContext([item.batchId])
    return reviewDetailFromItem(item, this.ctxFor(base, item.batchId))
  }

  /**
   * Lulus = accept (creates a Draf question, never publishes); Tolak = reject with the mandatory
   * reason. A gate failure (422 `details.issues`) or a locked item (409) comes back as `errors`, the
   * way the page shows them. "Minta Pembetulan" has no route (the page hides it in http mode).
   */
  async reviewDecision(
    key: string,
    d: { action: DecisionAction; reason?: string; by?: string },
  ): Promise<DecisionResult> {
    if (d.action === 'betulkan') return unavailable()
    const reason = d.reason?.trim() ?? ''
    if (d.action === 'tolak' && !reason) return { ok: false, errors: [REJECT_REASON_REQUIRED] }
    try {
      if (d.action === 'terbit') await this.exec('POST', `/api/intake/items/${enc(key)}/accept`, {})
      else await this.exec('POST', `/api/intake/items/${enc(key)}/reject`, { reason })
      return { ok: true, errors: [] }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        return { ok: false, errors: decisionErrors(e) }
      }
      throw toBijakError(e)
    }
  }

  /* ---------------------------------------------------------- bank (BE-09 admin questions) */

  /** Bijak subjects (code and name) from the admin blueprints, loaded once. */
  private ensureSubjects(): Promise<readonly Subject[]> {
    this.subjectsReady ??= this.listBlueprints().then(
      (rows) => {
        const seen = new Map<string, Subject>()
        for (const b of rows) if (!seen.has(b.subject)) seen.set(b.subject, { code: b.subject, name: b.subjectName })
        this.subjectList.splice(0, this.subjectList.length, ...seen.values())
        this.subjectsRequested = true
        return this.subjectList
      },
      (e) => {
        this.subjectsReady = null
        throw e
      },
    )
    return this.subjectsReady
  }

  /** Subject id (BE-09 `subject.id`) of each Bijak subject, matched by name. */
  private async bankSubjects(): Promise<{ code: string; name: string; id: string; total: number; published: number }[]> {
    const subjects = await this.ensureSubjects()
    const summary = await this.send<{ subjects: { id: string; name: string; total: number; approved: number }[] }>(
      'GET',
      '/api/questions/summary',
    )
    const out: { code: string; name: string; id: string; total: number; published: number }[] = []
    for (const s of subjects) {
      const hit = summary.subjects.find((x) => x.name.trim().toLowerCase() === s.name.trim().toLowerCase())
      if (hit) out.push({ code: s.code, name: s.name, id: hit.id, total: hit.total, published: hit.approved })
    }
    return out
  }

  private async questionList<T>(
    params: Record<string, string>,
  ): Promise<{ data: T[]; meta: { totalItems?: number } | undefined }> {
    try {
      const body = await this.client.request<{ data: T[]; meta?: { totalItems?: number } }>(
        'GET',
        `/api/questions?${new URLSearchParams(params)}`,
        { raw: true },
      )
      return { data: body?.data ?? [], meta: body?.meta }
    } catch (e) {
      throw toBijakError(e)
    }
  }

  async listBank(f: BankFilter = {}): Promise<BankRow[]> {
    const subjects = (await this.bankSubjects()).filter((s) => !f.subject || s.code === f.subject)
    const wire = wireStatusesOf(f.status ?? 'terbit')
    const combos = subjects.flatMap((s) => (wire ?? [undefined]).map((st) => ({ s, st })))
    const lists = await mapLimit(combos, 4, async ({ s, st }) => {
      const res = await this.questionList<WireBankRow>({
        subjectId: s.id,
        pageSize: String(BANK_PAGE),
        ...(st ? { status: st } : {}),
        ...(f.q?.trim() ? { search: f.q.trim() } : {}),
      })
      return res.data.map((r) => ({ r, s }))
    })
    const found = lists.flat()
    // The row has no question type or marks: one read per row (at most BANK_PAGE per subject).
    const rows = await mapLimit(found, 6, async ({ r, s }) => {
      const d = await this.send<WireBankDetail>('GET', `/api/questions/${enc(r.id)}`)
      return bankRowFrom(r, d, s)
    })
    return rows
      .filter((r) => !f.kind || r.kind === f.kind)
      .sort((a, b) => a.subject.localeCompare(b.subject))
  }

  async bankStats(): Promise<BankStats> {
    const subjects = await this.bankSubjects()
    const count = async (id: string, status: string): Promise<number> =>
      (await this.questionList({ subjectId: id, status, pageSize: '1' })).meta?.totalItems ?? 0
    const by = await mapLimit(subjects, 2, async (s) => {
      const [review, draft, archived] = await Promise.all(['review', 'draft', 'archived'].map((st) => count(s.id, st)))
      return {
        code: s.code,
        name: s.name,
        terbit: s.published,
        semakan: review ?? 0, // ADR-0027: `approved` is Terbit (`s.published`), not Semakan
        draf: draft ?? 0,
        ditolak: archived ?? 0,
      }
    })
    return {
      total: subjects.reduce((n, s) => n + s.total, 0),
      bySubject: by,
    }
  }

  async getBankDetail(qid: string): Promise<BankDetail> {
    const d = await this.send<WireBankDetail>('GET', `/api/questions/${enc(qid)}`)
    const subjects = await this.ensureSubjects()
    const name = d.subject?.name ?? ''
    const subject = subjects.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? {
      code: name,
      name,
    }
    return bankDetailFrom(d, subject, bankRowFrom(d, d, subject))
  }

  /* ------------------------------------------------ no backend route: not available */

  // The bank "Sunting" makes version n+1 of a published question; BE-09 edits a question in place
  // (PUT /questions/{id}) and has no version or revision queue, and the flat BE-09 shape cannot be
  // round-tripped into the intake editor without losing the mark scheme.
  getBankEditable: BijakAdminMethods['getBankEditable'] = () => unavailable()
  reviseQuestion: BijakAdminMethods['reviseQuestion'] = () => unavailable()
  reviseQuestionFull: BijakAdminMethods['reviseQuestionFull'] = () => unavailable()
  // An accepted or rejected item is final (409); the queue has no correction or resubmit step.
  resubmit: BijakAdminMethods['resubmit'] = () => unavailable()
}

export function createHttpBijakAdminServer(options: HttpBijakOptions = {}): HttpBijakAdminServer {
  return new HttpBijakAdminServer(options)
}
