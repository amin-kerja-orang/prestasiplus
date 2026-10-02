/** S33 copy (SRS M10 §8; OBSERVED unless noted). */
export const KELAS_COPY = {
  label: 'Masukkan Kod Kelas',
  placeholder: 'cth: MAT5B2',
  submit: 'Sertai',
  emptyTitle: 'Belum Sertai Mana-Mana Kelas',
  emptyText: 'Minta kod kelas daripada guru anda dan masukkan di atas',
  /** Not on live (list failure, PROPOSED); same wording as the other student pages. */
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
  retry: 'Cuba semula',
  /** M10 S28 network copy, reused for a join that never reached the server. */
  network: 'Ralat rangkaian. Sila cuba lagi.',
  joinFailed: 'Gagal menyertai kelas. Sila cuba lagi.',
} as const
