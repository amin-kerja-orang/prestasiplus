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
  over: 'melebihi had',
  imageFailed: 'Rajah tidak dapat dimuatkan.',
  retry: 'Cuba lagi',
  report: 'Lapor',
  needStimulus: 'Muatkan rajah untuk meneruskan.',
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
  /** Reason of a picture kind without a picture; "imej belum dimuat naik" is verbatim from v2-admin-student-pipeline AC-04.2 (the R1 PRD has no reason text). */
  reasonNoPicture: 'imej belum dimuat naik',
} as const

export const kindFallbackCaption: Record<string, string> = {
  diagram: 'Rajah',
  map: 'Rajah',
  graph: 'Graf',
  table: 'Jadual',
}

export function wordCountLabel(n: number): string {
  return `${n} patah perkataan`
}
export function wordTargetLabel(n: number, min: number, max: number): string {
  return `${n} patah perkataan · sasaran ${min}–${max}`
}
export function chipLabel(label: string): string {
  return `Lihat ${label}`
}
export function visibleSummary(x: number, total = 7): string {
  return `Dilihat murid di ${x} daripada ${total} aktiviti`
}
export function notServedLine(reason: string): string {
  return `Tidak dihidangkan kerana ${reason}.`
}
/** "Sumber: {text}" (FR-PA-37). */
/**
 * "Sumber: {text}" under a stimulus (FR-PA-37, 46 section 2.4). Stored citations often already carry
 * the word (`source_citation = 'Sumber: buku teks'` in the API fixtures and seeds), so the prefix is
 * added only when missing; otherwise the line would read "Sumber: Sumber: …".
 */
export const sourceLine = (source: string): string => {
  const text = source.trim()
  return /^sumber\s*:/i.test(text) ? text : `Sumber: ${text}`
}
