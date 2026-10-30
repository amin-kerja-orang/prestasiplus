/**
 * HTTP implementation of `KontrakApi` (`/api/admin/blueprints*`, `/api/admin/papers/generate`).
 * Reuses the student client's plumbing (CSRF on mutations, one refresh on `CSRF_INVALID`). The 422
 * bodies are read into `KontrakError` (problems, check, shortages) before the generic mapping.
 */
import type {
  BijakBlueprintAdminCreate,
  BijakBlueprintAdminVersionInput,
  BijakBlueprintProblem,
  BijakBlueprintVersionItem,
  BijakBlueprintView,
  BijakBlueprintWarning,
  BijakEvidenceInput,
  BijakEvidenceItem,
  BijakGenerateShortage,
  BijakPoolPreview,
  BijakDskpUnit,
  BijakVerificationCheck,
  BijakVerificationState,
} from '@pp/contract'

import { API_ERROR_CODES, ApiError } from '@/api'

import { HttpBijakServer, type HttpBijakOptions } from '../../../server/http'
import { KontrakError, type KontrakApi } from './api'

const PAGE_SIZE = 100
const MAX_PAGES = 20
const enc = encodeURIComponent

interface ErrBody {
  error?: {
    code?: string
    message?: string
    details?: {
      problems?: BijakBlueprintProblem[]
      warnings?: BijakBlueprintWarning[]
      check?: BijakVerificationCheck
      shortages?: BijakGenerateShortage[]
    }
  }
}

export function kontrakErrorFrom(e: unknown): unknown {
  if (!(e instanceof ApiError)) return e
  if (e.code === API_ERROR_CODES.NETWORK_ERROR) return new KontrakError('offline', 'Luar talian')
  const body = (e.body ?? {}) as ErrBody
  const d = body.error?.details
  const msg = e.message && !/^HTTP \d+$/.test(e.message) ? e.message : ''
  if (e.status === 422 && e.code === 'BLUEPRINT_INVALID')
    return new KontrakError('invalid', msg, { problems: d?.problems ?? [], warnings: d?.warnings ?? [] })
  if (e.status === 422 && e.code === 'VERIFICATION_FAILED')
    return new KontrakError('verification', msg, { check: d?.check ?? null })
  if (e.status === 422 && e.code === 'SHORTAGE')
    return new KontrakError('shortage', msg, { shortages: d?.shortages ?? [] })
  if (e.status === 422 && e.code === 'NO_BLUEPRINT') return new KontrakError('no_blueprint', msg)
  if (e.status === 409) return new KontrakError('conflict', msg || 'Pertembungan')
  if (e.status === 404) return new KontrakError('not_found', msg || 'Kontrak tidak ditemui')
  if (e.status === 403) return new KontrakError('forbidden', msg || 'Akses ditolak')
  return new KontrakError('other', msg || 'Sesuatu tidak kena. Sila cuba lagi.')
}

export class HttpKontrakServer extends HttpBijakServer implements KontrakApi {
  constructor(options: HttpBijakOptions = {}) {
    super(options)
  }

  private async call<T>(method: 'GET' | 'POST' | 'DELETE', url: string, body?: Record<string, unknown>): Promise<T> {
    try {
      return await this.exec<T>(method, url, body)
    } catch (e) {
      throw kontrakErrorFrom(e)
    }
  }

  private base(subject: string, kertas: number): string {
    return `/api/admin/blueprints/${enc(subject)}/${kertas}`
  }

  async list(): Promise<BijakBlueprintView[]> {
    const out: BijakBlueprintView[] = []
    try {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await this.client.request<{
          data: BijakBlueprintView[]
          meta?: { totalPages?: number }
        }>('GET', `/api/admin/blueprints?page=${page}&pageSize=${PAGE_SIZE}`, { raw: true })
        out.push(...(res?.data ?? []))
        if (page >= (res?.meta?.totalPages ?? 1)) break
      }
    } catch (e) {
      throw kontrakErrorFrom(e)
    }
    return out
  }

  get(subject: string, kertas: number): Promise<BijakBlueprintView> {
    return this.call('GET', this.base(subject, kertas))
  }
  create(body: BijakBlueprintAdminCreate): Promise<BijakBlueprintView> {
    return this.call('POST', '/api/admin/blueprints', body)
  }
  saveVersion(subject: string, kertas: number, body: BijakBlueprintAdminVersionInput): Promise<BijakBlueprintView> {
    return this.call('POST', `${this.base(subject, kertas)}/versions`, body)
  }
  reviewSection(subject: string, kertas: number, position: number): Promise<BijakBlueprintView> {
    return this.call('POST', `${this.base(subject, kertas)}/sections/${position}/review`, {})
  }
  async retire(subject: string, kertas: number): Promise<void> {
    await this.call('POST', `${this.base(subject, kertas)}/retire`)
  }
  versions(subject: string, kertas: number): Promise<BijakBlueprintVersionItem[]> {
    return this.call('GET', `${this.base(subject, kertas)}/versions`)
  }
  evidence(subject: string, kertas: number): Promise<BijakEvidenceItem[]> {
    return this.call('GET', `${this.base(subject, kertas)}/evidence`)
  }
  addEvidence(subject: string, kertas: number, body: BijakEvidenceInput): Promise<BijakEvidenceItem> {
    return this.call('POST', `${this.base(subject, kertas)}/evidence`, body)
  }
  async removeEvidence(subject: string, kertas: number, evidenceId: string): Promise<void> {
    await this.call('DELETE', `${this.base(subject, kertas)}/evidence/${enc(evidenceId)}`)
  }
  verification(subject: string, kertas: number): Promise<BijakVerificationState> {
    return this.call('GET', `${this.base(subject, kertas)}/verification`)
  }
  verify(subject: string, kertas: number, note: string): Promise<BijakBlueprintView> {
    return this.call('POST', `${this.base(subject, kertas)}/verify`, note.trim() ? { note: note.trim() } : {})
  }
  pool(subject: string, kertas: number): Promise<BijakPoolPreview> {
    return this.call('GET', `${this.base(subject, kertas)}/pool`)
  }
  generateDraft(subject: string, kertas: number): Promise<{ paperId: string }> {
    return this.call('POST', '/api/admin/papers/generate', { subject, kertas })
  }

  listUnits(subject: string): Promise<BijakDskpUnit[]> {
    return this.call('GET', `/api/admin/bijak/dskp/units?subject=${enc(subject)}`)
  }

  async subjectOptions(): Promise<{ code: string; name: string }[]> {
    const rows = await this.call<{ code: string; name: string }[]>('GET', '/api/admin/bijak/subjects')
    return rows.map((r) => ({ code: r.code, name: r.name }))
  }
}

export function createHttpKontrakServer(options: HttpBijakOptions = {}): HttpKontrakServer {
  return new HttpKontrakServer(options)
}
