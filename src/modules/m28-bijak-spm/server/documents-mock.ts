/**
 * In-browser mock of `KertasDokumenApi` (one per tab, in memory). Fictitious papers; the page images are generated SVG data URIs, so the
 * viewer and the Terbit/Sembunyi flow can be exercised without a backend. Mirrors the API rules: a pupil sees published documents only
 * (a Draf is a 404), a document with no paper page cannot be published (the V2 copy), the tiles ignore the filters.
 */
import { API_ERROR_CODES, ApiError } from '@/api'

import type {
  DokumenAdminQuery,
  KertasDokumen,
  KertasDokumenAdminDetail,
  KertasDokumenAdminList,
  KertasDokumenAdminRow,
  KertasDokumenApi,
  KertasDokumenPage,
  KertasDokumenStatus,
  KertasDokumenSummary,
  KertasDokumenToggleResult,
} from './documents-types'

interface MockDoc extends KertasDokumenSummary {
  status: KertasDokumenStatus
}

const NOT_FOUND_MESSAGE = 'Kertas tidak ditemui'

/** A plain page: a light sheet with the paper label and the page number (no real exam content). */
function pageImage(label: string, position: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">` +
    `<rect width="794" height="1123" fill="#ffffff"/><rect x="40" y="40" width="714" height="1043" fill="none" stroke="#9ca3af" stroke-width="2"/>` +
    `<text x="397" y="140" font-family="sans-serif" font-size="30" text-anchor="middle" fill="#374151">${label}</text>` +
    `<text x="397" y="200" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#6b7280">Muka surat ${position}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const pagesOf = (label: string, count: number): KertasDokumenPage[] =>
  Array.from({ length: count }, (_, i) => ({ position: i + 1, url: pageImage(label, i + 1), width: 794, height: 1123 }))

const SEED: Array<{ doc: MockDoc; scheme: number }> = [
  {
    doc: { id: '1', title: 'Sejarah Kertas 2 Percubaan Johor', subject: 'SEJ', subjectName: 'Sejarah', kertas: 2, negeri: 'Johor', year: 2024, pageCount: 4, schemePageCount: 3, marks: 100, durationMinutes: 150, status: 'terbit' },
    scheme: 3,
  },
  {
    doc: { id: '2', title: 'Sejarah Kertas 3 Percubaan Kedah', subject: 'SEJ', subjectName: 'Sejarah', kertas: 3, negeri: 'Kedah', year: 2024, pageCount: 3, schemePageCount: 0, marks: null, durationMinutes: null, status: 'terbit' },
    scheme: 0,
  },
  {
    doc: { id: '3', title: 'Matematik Kertas 2 Percubaan Selangor', subject: 'MAT', subjectName: 'Matematik', kertas: 2, negeri: 'Selangor', year: 2023, pageCount: 5, schemePageCount: 2, marks: 100, durationMinutes: 150, status: 'terbit' },
    scheme: 2,
  },
  {
    doc: { id: '4', title: 'Matematik Kertas 2 Percubaan Perak', subject: 'MAT', subjectName: 'Matematik', kertas: 2, negeri: 'Perak', year: 2023, pageCount: 4, schemePageCount: 2, marks: 100, durationMinutes: 150, status: 'draf' },
    scheme: 2,
  },
  {
    doc: { id: '5', title: 'Kertas Tanpa Halaman', subject: 'MAT', subjectName: 'Matematik', kertas: 4, negeri: 'Pahang', year: 2022, pageCount: 0, schemePageCount: 0, marks: null, durationMinutes: null, status: 'draf' },
    scheme: 0,
  },
]

const summaryOf = (d: MockDoc): KertasDokumenSummary => {
  const { status: _status, ...summary } = d
  void _status
  return summary
}

/** Runs `fn` as an async call would: its result resolves, a throw rejects. */
const run = <T>(fn: () => T): Promise<T> =>
  new Promise((resolve, reject) => {
    try {
      resolve(fn())
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })

export function createMockKertasDokumenApi(): KertasDokumenApi {
  const docs = SEED.map((s) => ({ ...s.doc }))
  const schemes = new Map(SEED.map((s) => [s.doc.id, s.scheme]))
  const find = (id: string): MockDoc => {
    const d = docs.find((x) => x.id === id)
    if (!d) throw notFound()
    return d
  }
  const notFound = (): ApiError => new ApiError({ status: 404, code: API_ERROR_CODES.NOT_FOUND, message: NOT_FOUND_MESSAGE })
  const view = (d: MockDoc): KertasDokumen => ({
    ...summaryOf(d),
    paperPages: pagesOf(d.title, d.pageCount),
    schemePages: pagesOf(`Skema ${d.title}`, schemes.get(d.id) ?? 0),
  })
  const byOrder = (a: MockDoc, b: MockDoc): number => a.kertas - b.kertas || (a.negeri ?? '￿').localeCompare(b.negeri ?? '￿', 'ms')

  return {
    list: () => run(() => docs.filter((d) => d.status === 'terbit').sort(byOrder).map(summaryOf)),
    get: (id) =>
      run(() => {
        const d = find(id)
        if (d.status !== 'terbit') throw notFound()
        return view(d)
      }),
    adminList: (query: DokumenAdminQuery = {}) => run((): KertasDokumenAdminList => {
      const pageSize = query.pageSize ?? 30
      const page = query.page ?? 1
      const rows = docs
        .filter((d) => (query.subject ? d.subject === query.subject : true))
        .filter((d) => (query.kertas ? d.kertas === query.kertas : true))
        .filter((d) => (query.status ? d.status === query.status : true))
        .sort((a, b) => (a.subject ?? '￿').localeCompare(b.subject ?? '￿') || byOrder(a, b))
      const out: KertasDokumenAdminRow[] = rows.slice((page - 1) * pageSize, page * pageSize).map((d) => ({ ...summaryOf(d), status: d.status }))
      return {
        rows: out,
        total: rows.length,
        counts: { total: docs.length, published: docs.filter((d) => d.status === 'terbit').length, withScheme: docs.filter((d) => d.schemePageCount > 0).length },
      }
    }),
    adminGet: (id) =>
      run((): KertasDokumenAdminDetail => {
        const d = find(id)
        return { ...view(d), status: d.status }
      }),
    toggle: (id) => run((): KertasDokumenToggleResult => {
      const d = find(id)
      if (d.status === 'draf' && d.pageCount <= 0) {
        const message = `“${d.title}” tiada halaman — tidak boleh diterbitkan.`
        throw new ApiError({ status: 422, code: API_ERROR_CODES.VALIDATION_ERROR, message, fields: { id: message } })
      }
      d.status = d.status === 'terbit' ? 'draf' : 'terbit'
      return { id: d.id, title: d.title, status: d.status }
    }),
  }
}
