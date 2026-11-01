/**
 * "Dilihat murid di" at paper level (REQ-A-018, AC-04.3): the published papers that carry a question, whether pupils can open
 * each, and what stops it. Pure mapping of `GET /api/admin/questions/:id/paper-servability` rows to display rows. The reason
 * sentences come from the API (the contract copy table); only the headings below are written here.
 */
import { SERVABILITY_REASON_MS, type QuestionPaperServabilityRow } from '@pp/contract'

export const PAPER_SERVED_COPY = {
  /** [PROPOSED] (UX-77): V2 has no paper-level list. */
  heading: 'Kertas diterbitkan',
  loading: 'Memuatkan senarai kertas…',
  loadError: 'Senarai kertas tidak dapat dimuat.',
  retry: 'Cuba semula',
  /** The approved sentence 9.3 "On no published paper". */
  empty: SERVABILITY_REASON_MS.not_on_published_paper,
  /** Same chip words as the activity list of the Studio status bar. */
  yes: 'Boleh dilihat',
  no: 'Tidak boleh dilihat',
} as const

/** [PROPOSED] summary line: "Boleh dibuka murid di 1 daripada 2 kertas diterbitkan." */
export const paperServedSummary = (rows: readonly Pick<QuestionPaperServabilityRow, 'served'>[]): string =>
  `Boleh dibuka murid di ${String(rows.filter((r) => r.served).length)} daripada ${String(rows.length)} kertas diterbitkan.`

/** [PROPOSED] (UX-77) caption when the API read only the first papers of a longer list (`meta.truncated`). */
export const paperServedTruncated = (shown: number, total: number): string => `Menunjukkan ${String(shown)} daripada ${String(total)} kertas.`

export interface PaperServedRow {
  paperId: string
  title: string
  served: boolean
  chip: string
  /** One sentence per reason; empty when served. */
  reasons: { key: string; text: string }[]
}

/** The placed question a reason is about: the id before the first colon of `detail` (the API starts `detail` with it). */
export function reasonQuestionId(detail: string | undefined): string | null {
  if (detail === undefined) return null
  const id = (detail.split(':', 1)[0] ?? '').trim()
  return id === '' ? null : id
}

/**
 * Rows for display. A reason about another question on the same paper (including `question_missing`, which is about a placement
 * that points at no question) is prefixed "Soalan #{id}:" so the admin knows which placement stops the paper.
 */
export function paperServedRows(rows: readonly QuestionPaperServabilityRow[], questionId: string): PaperServedRow[] {
  return rows.map((r) => ({
    paperId: r.paperId,
    title: r.title,
    served: r.served,
    chip: r.served ? PAPER_SERVED_COPY.yes : PAPER_SERVED_COPY.no,
    reasons: r.served
      ? []
      : r.reasons.map((x, i) => {
          const other = reasonQuestionId(x.detail)
          return { key: `${x.code}-${String(i)}`, text: other !== null && other !== questionId ? `Soalan #${other}: ${x.message}` : x.message }
        }),
  }))
}
