/**
 * HTTP implementation of `BuilderApi` (`/api/admin/papers*`, R1-B09a). Reuses the student client's
 * plumbing (CSRF on mutations, one refresh on `CSRF_INVALID`). The 422 bodies are read into
 * `BuilderError` (shortages, the server's BM line) before the generic mapping.
 */
import type {
  BijakBlueprintView,
  BijakBuilderEditor,
  BijakBuilderPaperSummary,
  BijakBuilderPlacementResult,
  BijakBuilderPoolUnit,
  BijakBuilderPublishResult,
  BijakBuilderReview,
  BijakBuilderStudentView,
  BijakDskpUnit,
  BijakGenerateShortage,
  BijakPoolPreview,
} from '@pp/contract'

import { API_ERROR_CODES, ApiError } from '@/api'

import type { AdminPaperSummary, PaperEditorData } from '../../../domain/admin-types'
import { HttpBijakServer, type HttpBijakOptions } from '../../../server/http'
import { editorFromWire, summaryFromWire } from '../../../server/http-admin'
import {
  BuilderError,
  type BuilderApi,
  type BuilderSubject,
  type HeaderPatch,
  type PlacementResult,
  type SectionPool,
  type SectionPoolQuery,
} from './api'

const PAGE_SIZE = 100
const MAX_PAGES = 50
const enc = encodeURIComponent
const GENERIC = 'Sesuatu tidak kena. Sila cuba lagi.'

interface ErrBody {
  error?: { code?: string; message?: string; details?: { shortages?: BijakGenerateShortage[] } }
}

/** Maps a failed request to a `BuilderError`; `missing` = what a 404 means on this route. */
export function builderErrorFrom(e: unknown, missing: 'not_found' | 'no_blueprint' = 'not_found'): unknown {
  if (!(e instanceof ApiError)) return e
  if (e.code === API_ERROR_CODES.NETWORK_ERROR) return new BuilderError('offline', 'Luar talian')
  const body = (e.body ?? {}) as ErrBody
  const msg = e.message && !/^HTTP \d+$/.test(e.message) ? e.message : ''
  if (e.status === 422 && e.code === 'SHORTAGE')
    return new BuilderError('shortage', msg, { shortages: body.error?.details?.shortages ?? [] })
  if (e.status === 422 && e.code === 'NO_BLUEPRINT') return new BuilderError('no_blueprint', msg)
  if (e.status === 404)
    return new BuilderError(missing, msg || (missing === 'no_blueprint' ? 'Tiada blueprint untuk subjek dan kertas ini' : 'Kertas tidak ditemui'))
  if (e.status === 403) return new BuilderError('forbidden', msg || 'Akses ditolak')
  if (e.status === 400 || e.status === 422) return new BuilderError('invalid', msg || GENERIC)
  return new BuilderError('other', msg || GENERIC)
}

export class HttpBuilderServer extends HttpBijakServer implements BuilderApi {
  constructor(options: HttpBijakOptions = {}) {
    super(options)
  }

  private async call<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: Record<string, unknown>,
    missing: 'not_found' | 'no_blueprint' = 'not_found',
  ): Promise<T> {
    try {
      return await this.exec<T>(method, url, body)
    } catch (e) {
      throw builderErrorFrom(e, missing)
    }
  }

  private async listAll<T>(url: string): Promise<T[]> {
    const out: T[] = []
    try {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await this.client.request<{ data: T[]; meta?: { totalPages?: number } }>(
          'GET',
          `${url}?page=${page}&pageSize=${PAGE_SIZE}`,
          { raw: true },
        )
        out.push(...(res?.data ?? []))
        if (page >= (res?.meta?.totalPages ?? 1)) break
      }
    } catch (e) {
      throw builderErrorFrom(e)
    }
    return out
  }

  async listSets(): Promise<AdminPaperSummary[]> {
    const rows = await this.listAll<BijakBuilderPaperSummary>('/api/admin/papers')
    return rows.map(summaryFromWire)
  }

  async builderSubjects(): Promise<BuilderSubject[]> {
    const rows = await this.listAll<BijakBlueprintView>('/api/admin/blueprints')
    const out = new Map<string, BuilderSubject>()
    for (const b of rows) {
      if (b.source === 'Draf') continue
      const s = out.get(b.subject) ?? { code: b.subject, name: b.subjectName, kertas: [] }
      if (!s.kertas.includes(b.kertas)) s.kertas.push(b.kertas)
      out.set(b.subject, s)
    }
    return [...out.values()].map((s) => ({ ...s, kertas: s.kertas.sort((a, b) => a - b) }))
  }

  async create(input: { subject: string; kertas: number; title?: string }): Promise<string> {
    const body: Record<string, unknown> = { subject: input.subject, kertas: input.kertas }
    if (input.title?.trim()) body.title = input.title.trim()
    const out = await this.call<{ id: string }>('POST', '/api/admin/papers', body)
    return out.id
  }

  async generate(subject: string, kertas: number): Promise<string> {
    const out = await this.call<{ paperId: string }>('POST', '/api/admin/papers/generate', { subject, kertas })
    return out.paperId
  }

  poolPreview(subject: string, kertas: number): Promise<BijakPoolPreview> {
    return this.call('GET', `/api/admin/papers/pool-preview?subject=${enc(subject)}&kertas=${kertas}`, undefined, 'no_blueprint')
  }

  async getEditor(id: string): Promise<PaperEditorData> {
    return editorFromWire(await this.call<BijakBuilderEditor>('GET', `/api/admin/papers/${enc(id)}`))
  }

  async updateHeader(id: string, patch: HeaderPatch): Promise<PaperEditorData> {
    return editorFromWire(await this.call<BijakBuilderEditor>('PUT', `/api/admin/papers/${enc(id)}`, { ...patch }))
  }

  private placement(r: BijakBuilderPlacementResult): PlacementResult {
    return { editor: editorFromWire(r.editor), changed: r.added ?? r.removed ?? [] }
  }

  async addPlacement(id: string, sectionId: string, questionId: string): Promise<PlacementResult> {
    return this.placement(
      await this.call<BijakBuilderPlacementResult>('POST', `/api/admin/papers/${enc(id)}/placements`, { sectionId, questionId }),
    )
  }

  async removePlacement(id: string, questionId: string): Promise<PlacementResult> {
    return this.placement(
      await this.call<BijakBuilderPlacementResult>('DELETE', `/api/admin/papers/${enc(id)}/placements/${enc(questionId)}`),
    )
  }

  async reorder(id: string, sectionId: string, order: string[]): Promise<PaperEditorData> {
    const r = await this.call<BijakBuilderPlacementResult>('PUT', `/api/admin/papers/${enc(id)}/sections/${enc(sectionId)}/order`, { order })
    return editorFromWire(r.editor)
  }

  async pool(id: string, sectionId: string, query: SectionPoolQuery = {}): Promise<SectionPool> {
    const qs = new URLSearchParams()
    if (query.q?.trim()) qs.set('q', query.q.trim())
    if (query.level) qs.set('level', query.level)
    if (query.unit) qs.set('unit', query.unit)
    qs.set('page', String(query.page ?? 1))
    qs.set('pageSize', String(query.pageSize ?? 20))
    try {
      const res = await this.client.request<{
        data: BijakBuilderPoolUnit[]
        meta?: { totalItems?: number; totalPages?: number }
      }>('GET', `/api/admin/papers/${enc(id)}/sections/${enc(sectionId)}/pool?${qs.toString()}`, { raw: true })
      const units = res?.data ?? []
      return { units, total: res?.meta?.totalItems ?? units.length, totalPages: res?.meta?.totalPages ?? 1 }
    } catch (e) {
      throw builderErrorFrom(e)
    }
  }

  review(id: string): Promise<BijakBuilderReview> {
    return this.call('GET', `/api/admin/papers/${enc(id)}/review`)
  }

  studentView(id: string): Promise<BijakBuilderStudentView> {
    return this.call('GET', `/api/admin/papers/${enc(id)}/student-view`)
  }

  publish(id: string): Promise<BijakBuilderPublishResult> {
    return this.call('POST', `/api/admin/papers/${enc(id)}/publish`)
  }

  async withdraw(id: string): Promise<void> {
    await this.call('POST', `/api/admin/papers/${enc(id)}/withdraw`)
  }

  async copy(id: string): Promise<string> {
    const out = await this.call<{ id: string }>('POST', `/api/admin/papers/${enc(id)}/copy`)
    return out.id
  }

  units(subject: string): Promise<BijakDskpUnit[]> {
    return this.call('GET', `/api/admin/bijak/dskp/units?subject=${enc(subject)}`)
  }
}

export function createHttpBuilderServer(options: HttpBijakOptions = {}): HttpBuilderServer {
  return new HttpBuilderServer(options)
}
