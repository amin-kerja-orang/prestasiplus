/** S34 copy (SRS M10 §8). The empty card is OBSERVED; the row texts are PROPOSED (FN-M10-5.7.2). */
export const SET_COPY = {
  emptyTitle: 'Tiada Set Soalan',
  emptyText: 'Guru anda belum menyediakan sebarang set soalan buat masa ini.',
  /** Second line of the observed empty state (R1-MUR-26). */
  emptyHint: 'Set soalan akan muncul di sini sebaik sahaja guru anda menerbitkannya.',
  start: 'Mula',
  /** Not on live - PROPOSED. */
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
  /** Not on live - PROPOSED. */
  retry: 'Cuba semula',
} as const
