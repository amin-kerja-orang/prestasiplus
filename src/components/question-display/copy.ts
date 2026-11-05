/** Verbatim .cloud labels (DISC 1.4/1.5) and the [PROPOSED] lines of docs/design/v2-admin-student-pipeline.md 11. */
export const qdCopy = {
  mcqAria: 'Pilihan jawapan',
  shortTextPlaceholder: 'Tulis jawapan…',
  shortTextAria: 'Jawapan',
  numericPlaceholder: 'cth. 3.14…',
  numericAria: 'Jawapan berangka',
  essayPlaceholder: 'Tulis jawapan anda di sini…',
  essayAria: 'Jawapan esei',
  essayChoicePlaceholder: 'Tulis karangan anda di sini…',
  essayChoiceAria: 'Karangan',
  essayChoiceTopicsAria: 'Pilih satu tajuk',
  essayChoiceHint: 'Pilih satu tajuk dahulu.',
  imageFailed: 'Rajah tidak dapat dimuatkan.',
  retry: 'Cuba lagi',
  report: 'Lapor',
  needStimulus: 'Muatkan rajah untuk meneruskan.',
  pinnedAria: 'Rajah kekal dipapar',
  pinnedHint: '📌 Petikan kekal dipapar semasa menjawab',
  sheetDescription: 'Rajah kekal boleh dibuka semasa menjawab.',
  close: 'Tutup',
  notServed: 'Tidak disajikan',
  visibleTitle: 'Dilihat murid di',
  canSee: 'Boleh dilihat',
  cannotSee: 'Tidak boleh dilihat',
  show: 'Lihat',
  hide: 'Sembunyi',
  passageFallback: 'Petikan',
  figureFallback: 'Rajah',
  /** PaperView (S8-T05), verbatim from the V3 PaperCoverPage and QuestionPreview. */
  question: 'Soalan',
  markah: 'markah',
  compulsory: '(wajib)',
} as const

export const kindFallbackCaption: Record<string, string> = {
  diagram: 'Rajah',
  map: 'Rajah',
  graph: 'Graf',
  table: 'Jadual',
  image: 'Gambar',
  infographic: 'Infografik',
  passage: 'Petikan',
}

/** Marks in brackets, then the unit word. */
export const marksLabel = (n: number): string => `[${n} ${qdCopy.markah}]`
/** "Soalan 3" */
export const questionLabel = (n: number): string => `${qdCopy.question} ${n}`
/**
 * V3 PaperCoverPage section line (148-159), after the bold label:
 * " · [N markah] · {count} soalan · {instruction}", with " (wajib)" appended to the instruction when compulsory.
 */
export function sectionMeta(marks: number | undefined, count: number, instruction?: string, compulsory?: boolean): string {
  const parts: string[] = []
  if (marks !== undefined) parts.push(marksLabel(marks))
  parts.push(`${count} ${qdCopy.question.toLowerCase()}`)
  if (instruction) parts.push(`${instruction}${compulsory ? ` ${qdCopy.compulsory}` : ''}`)
  else if (compulsory) parts.push(qdCopy.compulsory)
  return ` · ${parts.join(' · ')}`
}
/** FR-QA-48: group cap line, shown only when the scheme is revealed. */
export const maksLabel = (n: number): string => `Maks ${n}`
/** D115 deduction line, e.g. "Potongan: kesalahan 7 x 1 (maks 5)". */
export const deductionLine = (label: string, n: number, amount: number, cap?: number): string =>
  `Potongan: ${label} ${n} x ${amount}${cap === undefined ? '' : ` (maks ${cap})`}`

export function wordCountLabel(n: number): string {
  return `${n} patah perkataan`
}
export function wordTargetLabel(n: number, min: number, max: number): string {
  return `${n} / ${min}-${max} patah perkataan`
}
/** 46 2.2.1: hint above the maximum (never blocks, never truncates). */
export function overLabel(max: number): string {
  return `Jawapan melebihi ${max} patah perkataan.`
}
/** 46 2.2.1: hint below the minimum. */
export function shortLabel(n: number, min: number): string {
  return `Jawapan terlalu pendek (${n} patah perkataan; minimum ${min}).`
}
export function chipLabel(label: string): string {
  return `Lihat ${label}`
}
export function visibleSummary(x: number, total = 6): string {
  return `Dilihat murid di ${x} daripada ${total} aktiviti`
}
export function notServedLine(reason: string): string {
  return `Tidak disajikan kerana ${reason}.`
}
/**
 * "Sumber: {text}" under a stimulus (FR-PA-37, 46 section 2.4). Stored citations often already carry
 * the word (`source_citation = 'Sumber: buku teks'` in the API fixtures and seeds), so the prefix is
 * added only when missing; otherwise the line would read "Sumber: Sumber: …".
 */
export const sourceLine = (source: string): string => {
  const text = source.trim()
  return /^sumber\s*:/i.test(text) ? text : `Sumber: ${text}`
}
