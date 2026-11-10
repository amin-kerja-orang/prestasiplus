/**
 * Kertas Subjektif page-image documents (V2 parity, API `/api/bijak/kertas-dokumen*` and `/api/admin/kertas-dokumen*`, contract
 * `packages/contract/src/bijak/kertas`). The pupil list and view, and the Admin Pusat list, preview and Terbit/Sembunyi toggle.
 * Pages talk only to this interface; `documents-client.ts` picks the http or the in-browser mock implementation.
 */
import type {
  KertasDokumen,
  KertasDokumenAdminDetail,
  KertasDokumenAdminList,
  KertasDokumenAdminQuery,
  KertasDokumenSummary,
  KertasDokumenToggleResult,
} from '@pp/contract'

export type {
  KertasDokumen,
  KertasDokumenAdminDetail,
  KertasDokumenAdminList,
  KertasDokumenAdminRow,
  KertasDokumenAdminQuery,
  KertasDokumenCounts,
  KertasDokumenPage,
  KertasDokumenStatus,
  KertasDokumenSummary,
  KertasDokumenToggleResult,
} from '@pp/contract'

/** The filters of the admin list (V2: subject, kertas, status; the API pages 30 at a time). */
export type DokumenAdminQuery = Partial<Pick<KertasDokumenAdminQuery, 'subject' | 'kertas' | 'status' | 'page' | 'pageSize'>>

export interface KertasDokumenApi {
  /** Pupil: the published documents (V2 `/kertas-subjektif`). */
  list(): Promise<KertasDokumenSummary[]>
  /** Pupil: one published document with its pages; rejects with a 404 `ApiError` for a Draf or unknown id. */
  get(id: string): Promise<KertasDokumen>
  /** Admin: every document with the three tiles. */
  adminList(query?: DokumenAdminQuery): Promise<KertasDokumenAdminList>
  /** Admin: the preview of any document (Draf included). */
  adminGet(id: string): Promise<KertasDokumenAdminDetail>
  /** Admin: Terbit or Sembunyi; rejects with a 422 `ApiError` (V2 copy) for a document with no page. */
  toggle(id: string): Promise<KertasDokumenToggleResult>
}
