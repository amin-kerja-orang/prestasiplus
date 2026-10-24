/**
 * Default BM copy of the `Ds*` composites (glossary `docs/design/v2-copy-glossary.md`). One flat
 * object: no component writes a literal default. `{name}` placeholders are filled with `fillCopy`.
 * Callers pass a label only for a live exception or a domain noun.
 */
export const dsCopy = {
  // Filters (glossary 1)
  filterSearch: 'Cari',
  filterSheetApply: 'Guna',
  filterOpen: 'Penapis',
  filterMore: 'Lagi Penapis',
  filterSheetTitle: 'Penapis',
  filterReset: 'Set Semula',
  filtersActive: 'Penapis aktif:',
  filterRemove: 'Buang penapis {name}',
  // Retry and errors (glossary 1, 6)
  retry: 'Cuba Semula',
  loadError: 'Tidak dapat memuatkan data. Sila cuba semula.',
  loading: 'Memuatkan...',
  // Pager and tables (glossary 2)
  pagerSummary: 'Menunjukkan {from}-{to} daripada {total} hasil',
  pagerSummaryEmpty: 'Menunjukkan 0 daripada 0 hasil',
  pageSize: '{n} / halaman',
  pageSizeAria: 'Baris setiap halaman',
  pagePrev: 'Sebelum',
  pageNext: 'Seterusnya',
  pageAria: 'Halaman {n}',
  sort: 'Isih',
  selectAll: 'Pilih semua',
  selectRow: 'Pilih baris',
  // Row actions (glossary 1)
  rowActions: 'Tindakan',
  actionCancel: 'Batal',
  actionDelete: 'Padam',
  actionIrreversible: 'Tindakan ini tidak boleh dibatalkan.',
  // Empty states (glossary 5)
  emptyNever: 'Belum ada {item}.',
  emptyFiltered: 'Tiada {item} dijumpai.',
  emptyFilteredNoItem: 'Tiada data dijumpai.',
  emptyFilteredHint: 'Cuba ubah atau set semula penapis.',
  emptyNoPeriod: 'Tiada data untuk tempoh ini.',
  emptyNoData: 'Tiada data.',
  // KPI delta (screen-reader words)
  deltaUp: 'naik',
  deltaDown: 'turun',
  deltaFlat: 'tiada perubahan',
  // Status words (glossary 4)
  statusActive: 'Aktif',
  statusInactive: 'Tidak Aktif',
  statusApproved: 'Diluluskan',
  statusPendingApproval: 'Belum Diluluskan',
  statusAwaitingReview: 'Menunggu Semakan',
  statusRejected: 'Ditolak',
  statusDraft: 'Draf',
  statusPublished: 'Diterbitkan',
  statusDone: 'Selesai',
  statusInProgress: 'Sedang Berjalan',
  statusExpired: 'Tamat Tempoh',
  statusRiskLow: 'Rendah',
  statusRiskMid: 'Sederhana',
  statusRiskHigh: 'Tinggi',
  statusNew: 'Baharu',
  statusLive: 'LIVE',
  // Form kit and navigation (v2/ds1)
  save: 'Simpan',
  cancel: 'Batal',
  back: 'Kembali',
  search: 'Cari',
  apply: 'Guna',
  reset: 'Set Semula',
  required: 'wajib',
  selectPlaceholder: 'Pilih',
  breadcrumbAria: 'Jejak navigasi',
  breadcrumbMore: 'Lagi',
  fileDrop: 'Seret fail ke sini atau klik untuk memilih',
  fileTooLarge: 'Fail melebihi saiz maksimum {n} MB.',
  // Learner and game defaults (v2-ds-hardening R10)
  quizCorrect: 'Betul',
  quizWrong: 'Salah',
  badgeNew: 'BARU',
  badgeLocked: 'Terkunci',
  progress: 'Kemajuan',
  ownRow: 'Anda',
  heatLow: 'Rendah',
  heatHigh: 'Tinggi',
  heatNoData: 'Tiada data',
  heatLegend: 'Petunjuk warna',
  audioPlay: 'Main',
  audioPause: 'Jeda',
  audioSeek: 'Kedudukan audio',
  audioSpeed: 'Kelajuan',
  audioTranscript: 'Transkrip',
  levelDone: 'Selesai',
  levelCurrent: 'Sekarang',
  levelLocked: 'Terkunci',
  wheelSpin: 'Putar',
  wheelSpinning: 'Sedang berputar...',
  wheelReset: 'Cuba Lagi',
  friendSelected: 'Dipilih',
  // Dialog and confirm
  confirmTitle: 'Pengesahan',
  confirmYes: 'Ya',
  // Error pages
  error403Title: 'Akses Ditolak',
  error403Description: 'Halaman ini tidak tersedia untuk peranan anda.',
  error404Title: 'Halaman Tidak Dijumpai',
  error404Description:
    'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
  error500Title: 'Sesuatu tidak kena',
  error500Description: 'Kami tidak dapat memuatkan halaman ini. Cuba lagi sebentar.',
  // Chart
  chartLegend: 'Petunjuk {title}',
  chartTable: 'Data bagi {title}',
  chartEmpty: 'Tiada data untuk dipaparkan.',
} as const

export type DsCopyKey = keyof typeof dsCopy

/** Fills `{name}` placeholders of a copy string. */
export function fillCopy(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
