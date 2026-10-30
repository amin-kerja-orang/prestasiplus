/**
 * Display helpers of the Pengesahan tab (design 4.5): the Syarat Disahkan rows (AC-39.1 a to e),
 * the evidence comparison rows (AC-39.7) and the evidence summary line. Pure functions over the
 * contract's `BijakVerificationCheck` so the panel and its tests share one reading of it.
 */
import type {
  BijakEvidenceItem,
  BijakEvidenceLine,
  BijakVerificationCheck,
} from '@pp/contract'

import type { ContractForm } from './form'
import { incompleteMessage, issueFromProblem, type Issue } from './validate'

export interface GateRow {
  key: string
  ok: boolean
  label: string
  /** Failure detail lines (empty when ok). */
  details: string[]
  /** First failing issue, for "Pergi ke medan". */
  goto?: { section: number | null; part: Issue['part']; target: string }
}

const labelAt = (f: ContractForm, pos?: number): string =>
  pos ? (f.sections[pos - 1]?.label.trim() || `Bahagian ${pos}`) : 'Kertas'

/** The gate list, one row per condition; a row is ok when none of its failures is present. */
export function gateRows(check: BijakVerificationCheck, form: ContractForm): GateRow[] {
  const by = (code: string) => check.completeness.filter((c) => c.code === code)
  const mk = (
    key: string,
    label: string,
    details: string[],
    first?: { section: number | null; part: Issue['part']; target: string },
  ): GateRow => ({ key, ok: details.length === 0, label, details, ...(first && details.length ? { goto: first } : {}) })

  const problems = check.blueprintProblems.map((p) => issueFromProblem(p, form.sections))
  const sec = (c: { sectionPosition?: number }): number | null => (c.sectionPosition ? c.sectionPosition - 1 : null)
  const first = (list: { sectionPosition?: number }[], part: Issue['part'], name: string) => {
    const s = list[0] ? sec(list[0]) : null
    return { section: s, part, target: s === null ? 'kontrak-umum-jumlah' : `kontrak-s${s}-${name}` }
  }
  const unrev = by('UNREVIEWED')
  const lines = check.lines.filter((l) => l.status !== 'ok')
  return [
    mk(
      'konsisten',
      'Markah, tempoh, Bahagian dan peraturan konsisten',
      problems.map((p) => p.message),
      problems[0] ? { section: problems[0].section, part: problems[0].part, target: problems[0].target } : undefined,
    ),
    mk(
      'profil',
      'Profil kesukaran ditetapkan untuk setiap Bahagian',
      by('NO_PROFILE').map((c) => incompleteMessage('NO_PROFILE', labelAt(form, c.sectionPosition))),
      first(by('NO_PROFILE'), 'profil', 'profil'),
    ),
    mk(
      'kuota',
      'Kuota topik lengkap untuk setiap Bahagian',
      by('NO_QUOTA').map((c) => incompleteMessage('NO_QUOTA', labelAt(form, c.sectionPosition))),
      first(by('NO_QUOTA'), 'kuota', 'kuota'),
    ),
    mk(
      'kbat',
      'Kuota KBAT diisi (0 dikira diisi)',
      by('NO_KBAT').map((c) => incompleteMessage('NO_KBAT', labelAt(form, c.sectionPosition))),
      first(by('NO_KBAT'), 'kbat', 'kbat'),
    ),
    mk(
      'disemak',
      'Semua nilai telah disemak (tiada "Belum disemak")',
      unrev.map((c) => incompleteMessage('UNREVIEWED', labelAt(form, c.sectionPosition))),
      first(unrev, unrev[0]?.unit ? 'kuota' : 'kbat', unrev[0]?.unit ? 'kuota' : 'kbat'),
    ),
    mk(
      'rekod',
      'Rekod pengesahan lengkap (sekurang-kurangnya 2 badan)',
      by('NO_EVIDENCE_BODIES').map(() => incompleteMessage('NO_EVIDENCE_BODIES', 'Kertas')),
    ),
    mk(
      'bukti',
      'Semakan bukti lulus',
      lines.map((l) => `${evidenceFieldLabel(l, form)}: ${PADANAN[l.status].word}`),
    ),
  ]
}

export const PADANAN: Record<
  BijakEvidenceLine['status'],
  { word: string; color: 'success' | 'error' | 'warning'; icon: string }
> = {
  ok: { word: 'Sepadan', color: 'success', icon: 'i-ph-check-circle' },
  differs: { word: 'Berbeza', color: 'error', icon: 'i-ph-x-circle' },
  tidak_disahkan: { word: 'Tidak disahkan', color: 'warning', icon: 'i-ph-question' },
  not_covered: { word: 'Tiada dalam bukti', color: 'warning', icon: 'i-ph-minus-circle' },
}

const FIELD: Record<BijakEvidenceLine['field'], string> = {
  durationMin: 'Tempoh',
  totalMarks: 'Jumlah markah',
  markBudget: 'Markah',
  rule: 'Peraturan',
  questionCount: 'Bilangan soalan',
}

export function evidenceFieldLabel(l: BijakEvidenceLine, form: ContractForm): string {
  return l.sectionPosition ? `${labelAt(form, l.sectionPosition)} ${FIELD[l.field].toLowerCase()}` : FIELD[l.field]
}

export function formatValue(field: BijakEvidenceLine['field'], v: unknown): string {
  if (v === undefined || v === null) return '-'
  if (field === 'rule' && typeof v === 'object') {
    const r = v as { type?: string; n?: number }
    return r.type === 'choose' ? `Jawab ${r.n}` : 'Jawab semua'
  }
  if (typeof v === 'object') return JSON.stringify(v)
  const text = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
  return field === 'durationMin' ? `${text} min` : text
}

export const bodyName = (b: string): string => b.replace(/_/g, ' ').toUpperCase()

export const evidenceStatements = (l: BijakEvidenceLine): string =>
  l.statements.length
    ? l.statements.map((s) => `${bodyName(s.body)} ${formatValue(l.field, s.value)}`).join(' - ')
    : '(tiada)'

/** Group label rows: lines grouped by Bahagian (paper-level first). */
export function groupLines(lines: readonly BijakEvidenceLine[], form: ContractForm): { title: string; lines: BijakEvidenceLine[] }[] {
  const out: { title: string; lines: BijakEvidenceLine[] }[] = []
  for (const l of lines) {
    const title = l.sectionPosition ? labelAt(form, l.sectionPosition) : 'Kertas'
    let g = out.find((x) => x.title === title)
    if (!g) {
      g = { title, lines: [] }
      out.push(g)
    }
    g.lines.push(l)
  }
  return out
}

/** Number of distinct bodies with human-entered evidence; an LPM document counts as two (AC-39.2). */
export function evidenceBodies(items: readonly BijakEvidenceItem[]): number {
  const admin = items.filter((e) => e.origin === 'admin')
  if (admin.some((e) => e.kind === 'lpm_format')) return Math.max(2, new Set(admin.map((e) => e.body)).size)
  return new Set(admin.map((e) => e.body)).size
}

export const KIND_LABEL = {
  trial_paper: 'Kertas percubaan',
  skema: 'Skema jawapan',
  lpm_format: 'Format / JSU LPM',
} as const

export function evidenceSummary(e: BijakEvidenceItem): string {
  const v = e.values
  const parts: string[] = []
  if (v.sections?.length) parts.push(`${v.sections.length} bahagian`)
  const q = v.sections?.reduce((n, s) => n + (s.questionCount ?? 0), 0)
  if (q) parts.push(`${q} soalan`)
  if (v.totalMarks !== undefined) parts.push(`${v.totalMarks} mk`)
  if (v.durationMin !== undefined) parts.push(`${v.durationMin} min`)
  return parts.length ? parts.join(', ') : 'Belum dibaca'
}
