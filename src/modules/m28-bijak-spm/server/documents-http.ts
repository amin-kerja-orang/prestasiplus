/**
 * HTTP implementation of `KertasDokumenApi`: the shared `api` client (cookie session and the CSRF header on the POST come from the installed
 * transport). It must never import the mock (`documents-mock.ts`): the http bundle stays free of it.
 */
import type { KertasDokumen, KertasDokumenAdminDetail, KertasDokumenAdminList, KertasDokumenSummary, KertasDokumenToggleResult } from '@pp/contract'

import { api } from '@/api'

import type { KertasDokumenApi } from './documents-types'

const enc = encodeURIComponent

export function createHttpKertasDokumenApi(): KertasDokumenApi {
  return {
    list: () => api.get<KertasDokumenSummary[]>('/api/bijak/kertas-dokumen'),
    get: (id) => api.get<KertasDokumen>(`/api/bijak/kertas-dokumen/${enc(id)}`),
    adminList: (query = {}) =>
      api.get<KertasDokumenAdminList>('/api/admin/kertas-dokumen', {
        query: { subject: query.subject, kertas: query.kertas, status: query.status, page: query.page ?? 1, pageSize: query.pageSize ?? 30 },
      }),
    adminGet: (id) => api.get<KertasDokumenAdminDetail>(`/api/admin/kertas-dokumen/${enc(id)}`),
    toggle: (id) => api.post<KertasDokumenToggleResult>(`/api/admin/kertas-dokumen/${enc(id)}/terbit`),
  }
}
