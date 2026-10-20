/** The 3 canned regeneration notes, cycled (BR-M04-23; OD-7: no external AI). Copy of the mock `CANNED_NOTES`. */
export const CANNED_NOTES: readonly { noteText: string; trapText: string; tokens: number }[] = [
  {
    noteText:
      'Mungkin anda keliru sebab anda menganggap dua konsep yang berkaitan sebagai sama. Bandingkan takrifan setiap konsep sebelum memilih jawapan.',
    trapText: 'Salah faham tentang perbezaan antara dua konsep yang hampir serupa.',
    tokens: 745,
  },
  {
    noteText:
      'Mungkin anda tergesa-gesa membaca soalan dan terlepas kata kunci. Baca semula arahan dan tandakan kata kunci sebelum mengira atau memilih.',
    trapText: 'Terlepas kata kunci dalam soalan lalu memilih jawapan yang kelihatan betul.',
    tokens: 802,
  },
  {
    noteText:
      'Mungkin anda mengingati peraturan tetapi tersalah menggunakannya dalam situasi ini. Semak syarat penggunaan peraturan itu langkah demi langkah.',
    trapText: 'Menggunakan peraturan yang betul pada situasi yang tidak sesuai.',
    tokens: 768,
  },
]

/**
 * The index of the canned note to write next. The mock keeps a `regenCount`; the table has no such
 * column, so the position is read from the stored text: after canned note n comes n + 1 (wrapping),
 * and any other text (the first regeneration of an original note) starts at 0. Same cycle as the mock
 * for a note that was only ever regenerated.
 */
export function nextCannedIndex(currentNoteText: string): number {
  const at = CANNED_NOTES.findIndex((n) => n.noteText === currentNoteText)
  return at === -1 ? 0 : (at + 1) % CANNED_NOTES.length
}
