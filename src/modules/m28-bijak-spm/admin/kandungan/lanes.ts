/** Hub and lane copy (V2 DISC 3.10 P1/P2). The cards themselves come from the API (`overview.cards`, T45). */

/** V2 strings of the hub (DISC 3.10 P1/A1). */
export const hubCopy = {
  title: 'Kandungan SPM',
  intro: 'Setiap kad ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
  allGood: 'Semua elok',
  open: 'Buka senarai',
} as const

/** V2 strings of a lane list (DISC 3.10 P2/A2). */
export const laneCopy = {
  title: 'Kandungan SPM',
  back: 'Kembali',
  allSubjects: 'Semua Subjek',
  allStatuses: 'Semua Status',
  search: 'Cari',
  apply: 'Tapis',
  reset: 'Set Semula',
  colList: 'Senarai',
  colTitle: 'Tajuk',
  colStatus: 'Status',
  colAttention: 'Perhatian',
  colActions: 'Tindakan',
  preview: 'Pratonton',
  copy: 'Salin',
  edit: 'Sunting',
  /** V2 (A2/P2): the attention text of a published paper. Kept for the zero-question case. */
  noQuestions: 'Disajikan tetapi tiada soalan',
  empty: 'Tiada rekod dijumpai.',
} as const
