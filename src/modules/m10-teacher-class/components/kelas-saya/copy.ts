/** S33 copy (SRS M10 §8; OBSERVED unless noted). */
export const KELAS_COPY = {
  emptyTitle: 'Anda belum dimasukkan ke dalam kelas',
  emptyText:
    'Guru anda yang menambah pelajar ke dalam kelas. Minta guru anda menambah nama anda supaya anda boleh melihat set soalan kelas dan kedudukan kelas.',
  /** Not on live (list failure, PROPOSED); same wording as the other student pages. */
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
  retry: 'Cuba semula',
  /** M10 S28 network copy, reused by the class-create page. */
  network: 'Ralat rangkaian. Sila cuba lagi.',
} as const
