/**
 * Pratonton Kolam helpers (BJS-F3, design 5 and 7.2): shortage lines in BM with the real numbers,
 * the reason labels of the excluded breakdown and the bank link. Pure functions over the
 * contract's `BijakPoolPreview` / `BijakGenerateShortage`.
 */
import type { BijakGenerateShortage, BijakPoolPreview } from '@pp/contract'

import { unitLabel } from './form'

export const REASON_LABEL: Record<string, string> = {
  no_unit: 'Tiada unit',
  no_tp: 'Tiada TP',
  no_marks: 'Tiada markah',
  tag_review: 'Perlu semakan tag',
  no_key: 'Tiada kunci jawapan',
  mode: 'Mod jawapan tidak dibenarkan',
}

/** One shortage line (design 7.2). The numbers are the real eligible counts. */
export function shortageLine(s: BijakGenerateShortage): string {
  const sec = s.section
  switch (s.kind) {
    case 'marks':
      return `${sec}: tidak dapat menyusun ${s.need} markah daripada soalan yang tersedia`
    case 'tp':
      return `${sec} soalan ${s.slot?.from ?? '?'}-${s.slot?.to ?? '?'}: tiada soalan layak pada TP ${s.tp?.min ?? '?'}-${s.tp?.max ?? '?'}`
    case 'unit':
      return `${sec}: perlu ${s.need} ${s.basis === 'marks' ? 'markah' : 'soalan'} ${s.unit ? unitLabel(s.unit) : ''}, hanya ${s.have} tersedia`.replace(/\s+,/, ',')
    case 'level_share':
      return `${sec}: nisbah Tingkatan 4 : 5 tidak dapat dipenuhi daripada soalan yang tersedia`
    case 'kbat':
      return `${sec}: perlu ${s.need} markah KBAT, hanya ${s.have} tersedia`
    case 'overlap':
      return `${sec}: soalan yang diperlukan sudah digunakan oleh ${s.otherSection ?? 'bahagian lain'}`
    case 'combination':
      return `${sec}: setiap baris cukup secara berasingan, tetapi gabungan kekangan tidak dapat dipenuhi`
    default:
      return `${sec}: perlu ${s.need} soalan, hanya ${s.have} tersedia`
  }
}

/** Bank filter per excluded reason (architecture 15.7); the server's `bankQuery` wins when present. */
export const REASON_BANK_QUERY: Record<string, Record<string, string>> = {
  no_unit: { dskpFilter: 'untagged' },
  no_tp: { missing: 'tp' },
  no_marks: { missing: 'marks' },
  no_key: { missing: 'key' },
  tag_review: { tagReview: 'true' },
}

export function reasonQuery(
  reason: string,
  server: Record<string, string> | undefined,
  base: Record<string, string> | undefined,
): Record<string, string> {
  if (server && Object.keys(server).length) return server
  return { ...(base ?? {}), status: 'approved', ...(REASON_BANK_QUERY[reason] ?? {}) }
}

export function bankHref(query: Record<string, string> | undefined, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ ...(query ?? {}), ...extra })
  const qs = p.toString()
  return `/admin/spm/soalan${qs ? `?${qs}` : ''}`
}

export interface PoolLine {
  key: string
  name: string
  perlu: string
  ada: string
  short: number
  query: Record<string, string>
}

type Sec = BijakPoolPreview['sections'][number]

const unitWord = (basis: 'questions' | 'marks'): string => (basis === 'marks' ? 'markah' : 'soalan')

export function topicLines(s: Sec): PoolLine[] {
  const out: PoolLine[] = [
    {
      key: 'count',
      name: 'Bilangan soalan',
      perlu: `${s.counts.needed} soalan`,
      ada: `${s.counts.available} soalan`,
      short: s.counts.short,
      query: s.bankQuery,
    },
  ]
  for (const q of s.quota) {
    const nodeId = q.unit.kind === 'unit' ? q.unit.nodeId : 't1_t3'
    out.push({
      key: `unit-${nodeId}`,
      name: unitLabel(q.unit),
      perlu: `${q.needed} ${unitWord(q.basis)}`,
      ada: `${q.available} ${unitWord(q.basis)}`,
      short: q.short,
      query: { ...s.bankQuery, unit: nodeId },
    })
  }
  return out
}

export function tpLines(s: Sec): PoolLine[] {
  return s.tp.map((t, i) => ({
    key: `tp-${i}`,
    name: t.tp
      ? `Slot ${t.slot.from} - ${t.slot.to}, TP ${t.tp}`
      : `Slot ${t.slot.from} - ${t.slot.to}, TP ${t.tpMin} - ${t.tpMax}`,
    perlu: `${t.needed} slot`,
    ada: `${t.available}`,
    short: t.short,
    query: { ...s.bankQuery, tpMin: String(t.tpMin), tpMax: String(t.tpMax) },
  }))
}

export function kbatLines(s: Sec): PoolLine[] {
  return s.kbat
    ? [
        {
          key: 'kbat',
          name: 'Markah KBAT',
          perlu: `${s.kbat.needed} markah`,
          ada: `${s.kbat.available} markah`,
          short: s.kbat.short,
          query: { ...s.bankQuery, kbat: '1' },
        },
      ]
    : []
}

/** Number of lines marked "Kurang" in the whole preview (the KPI equals the rows, NFR-12). */
export function shortLineCount(p: BijakPoolPreview): number {
  return p.sections.reduce(
    (n, s) => n + [...topicLines(s), ...tpLines(s), ...kbatLines(s)].filter((l) => l.short > 0).length,
    0,
  )
}

export function sectionShort(s: Sec): number {
  return [...topicLines(s), ...tpLines(s), ...kbatLines(s)].filter((l) => l.short > 0).length
}

/** "Soalan 11 - 15" from the cumulative slot counts. */
export function rangeOf(p: BijakPoolPreview, index: number): string {
  let start = 1
  for (let i = 0; i < index; i += 1) start += p.sections[i]?.slots ?? 0
  const n = p.sections[index]?.slots ?? 0
  return n === 1 ? `Soalan ${start}` : `Soalan ${start} - ${start + n - 1}`
}
