/** Texts of Soalan & Rujukan (PRD-20 R1-GUR-44a). The delete confirm and the failure lines are not in the PRD; they follow the Sumbang Soalan wording. */
export const RUJUKAN_COPY = {
  listTitle: 'Soalan & Rujukan',
  backToList: 'Kembali ke Soalan & Rujukan',
  add: 'Tambah Soalan',
  empty: 'Belum ada soalan peribadi.',
  saved: 'Soalan disimpan.',
  filterLabel: 'Tahap',
  allLevels: '-- Semua tahap --',
  inUse: 'Soalan sedang digunakan dalam misi.',
  confirmDelete: (id: number): string =>
    `Padam soalan #${String(id)}? Tindakan ini tidak boleh dibatalkan.`,
} as const
