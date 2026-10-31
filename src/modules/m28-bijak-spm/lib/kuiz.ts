/** Pure helpers of the Simulasi Kuiz pages (random and per paper). */
import type { BijakKuizItem } from '@pp/contract'

import type { McqOptionData, StimulusData, StimulusKind } from './question-display'

export { KUIZ_COUNTS, KUIZ_DEFAULT_COUNT, parseCount } from './kuiz-count'

/** V2 labels (exam-sim/quiz.blade.php, quiz-paper.blade.php), verbatim. */
export const kuizCopy = {
  title: 'Simulasi — Kuiz',
  time: 'Masa',
  semak: '✓ Semak',
  correct: '🎉 Betul!',
  wrong: '😟 Salah',
  next: 'Soalan Seterusnya →',
  finish: 'Tamat →',
  done: 'Kuiz Selesai!',
  score: 'Markah',
  accuracy: 'Ketepatan',
  retry: '↻ Cuba Lagi',
  fullPapers: '← Kertas penuh',
  empty: 'Belum ada soalan objektif',
  /** Source: docs/discovery/BIJAK-SPM-cloud.md S5 row (V2 empty state text). */
  emptyHelp:
    'Kuiz ini mengambil soalan objektif daripada kertas yang telah diterbitkan dan mempunyai skema jawapan. Buat masa ini belum ada kertas yang memenuhi kedua-duanya.',
  back: '← Sebelum',
  forward: 'Seterusnya →',
  paperEmpty: 'Kertas ini tiada soalan',
  paperBack: '← Kembali',
  written: 'Tulis jawapan anda di sini…',
  /** [PROPOSED] FD-9 / D-9: the one-line note under an unsaved textarea. */
  writtenNote: 'Latihan sendiri — jawapan ini tidak disimpan atau dimarkah.',
  /** V2 text of an objective part whose scheme is missing. */
  noScheme: 'Skema jawapan belum tersedia untuk soalan ini.',
} as const

export function parseSubject(raw: unknown): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,20}$/.test(v) ? v : undefined
}

/** `/api/files/{token}` for a stored picture. */
export function fileUrl(token: string): string {
  return `/api/files/${encodeURIComponent(token)}`
}

export function clock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  return `${m}:${String(seconds % 60).padStart(2, '0')}`
}

export function percent(score: number, total: number): number {
  return total ? Math.round((score / total) * 100) : 0
}

/** Wire stimulus to the shared display shape: any of the seven kinds, with caption, source and table grid (R1-T07). */
export function toStimulus(s: BijakKuizItem['stimuli'][number], id: string): StimulusData {
  const kind: StimulusKind = s.kind
  return {
    id,
    kind,
    label: s.label,
    ...(s.body ? { text: s.body } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    ...(s.source ? { source: s.source } : {}),
    ...(s.table ? { table: { head: s.table.head, rows: s.table.rows, ...(s.caption ? { caption: s.caption } : {}) } } : {}),
    ...(s.imageToken ? { src: fileUrl(s.imageToken) } : {}),
    ...(s.alt ? { alt: s.alt } : {}),
  }
}

export function toOptions(item: BijakKuizItem): McqOptionData[] {
  return item.options.map((o) => ({
    id: o.id,
    letter: o.label,
    text: o.text,
    ...(o.imageToken ? { imageSrc: fileUrl(o.imageToken) } : {}),
  }))
}

/** Text layers in reading order: stem, parent prompts, then `path` + the part prompt (no empties, no repeats). */
export function textLayers(item: BijakKuizItem): { text: string; strong?: boolean }[] {
  const out: { text: string; strong?: boolean }[] = []
  const seen = new Set<string>()
  const push = (text: string | null | undefined, strong = false): void => {
    const t = (text ?? '').trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push({ text: t, ...(strong ? { strong } : {}) })
  }
  push(item.stem, !item.prompt && !item.lead.length)
  for (const l of item.lead) push(l)
  if (item.prompt.trim()) push(item.path ? `(${item.path}) ${item.prompt}` : item.prompt, true)
  return out
}

