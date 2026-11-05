/** M15 student pages copy (SRS M15 §8.1 observed, §8.2 PROPOSED). */

export const SHOP_COPY = {
  heading: '🎁 Kedai Hadiah',
  sub: 'Tebus token anda untuk hadiah menarik!',
  tileLabel: 'Baki Token 🎫',
  emptyIcon: '🎁',
  emptyTitle: 'Tiada Hadiah Tersedia',
  emptyBody: 'Hadiah akan ditambah tidak lama lagi. Tunggu ya!',
} as const

export const BOX_COPY = {
  heading: '📦 Kotak Misteri',
  sub: 'Buka kotak & menang ganjaran rawak — nasib baik menanti!',
  chip: '🎫 Token Anda:',
  token: 'Token',
  locked: '🔒 Token Tidak Cukup',
  /** PROPOSED (FN-M15-6.2.1). */
  open: 'Buka Kotak',
  opening: 'Membuka…',
  /** PROPOSED (FN-M15-6.2.3). */
  close: 'Tutup',
  /** PROPOSED (FN-M15-6.2.4). */
  historyHeading: 'Sejarah Kotak Misteri',
} as const

export const DRAW_COPY = {
  heading: '🎟️ Cabutan Bertuah',
  sub: 'Guna syiling untuk beli tiket & menangi hadiah hebat!',
  tileLabel: 'Syiling anda',
  openHeading: 'Cabutan Dibuka',
  empty: 'Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈',
  /** PROPOSED (FN-M15-7.1.3/7.1.4). */
  buy: '🎟️ Beli Tiket',
  buying: 'Memproses…',
} as const

/** Shared error convention (FR-G-10); M15 adds no further error copy. */
export const COMMON_COPY = {
  loadFailed: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
  actionFailed: 'Ralat berlaku. Sila cuba lagi.',
} as const

/** S10 `/cikgu/hadiah` (SRS M15 §8.1; DV-M15-16: the caption carries the viewer's tier rate). */
export const DIGITAL_COPY = {
  heading: '🎁 Kedai Hadiah Digital',
  sub: 'Tukar token kepada hadiah digital — terus dihantar, tanpa pos.',
  /** DOM mixed case; the page renders it upper case with CSS (as live). */
  tokenLabel: 'Token Anda',
  syilingLabel: 'Syiling',
  myRedemptions: 'Tebusan Saya',
  empty: 'Tiada hadiah dalam kategori ini.',
} as const

/** S11 `/cikgu/hadiah/saya`. */
export const MY_REDEMPTIONS_COPY = {
  heading: '📋 Tebusan Saya',
  toShop: '🎁 Kedai Hadiah',
  icon: '🎁',
  empty: 'Belum ada tebusan. Kumpul syiling dulu, lepas tukar token dan tebus hadiah.',
  browse: 'Layari Kedai Hadiah',
} as const

/**
 * R1-ADM-P2-07 `/admin/hadiah`, `/baharu`, `/:id/edit` (30 P2-07, field list P07-01..15; S7-T11). Every
 * string here is exact BM from the SRS; the strings it does not give are in `HADIAH_ADMIN_PROPOSED`.
 */
export const HADIAH_ADMIN_COPY = {
  heading: '🎁 Kedai Hadiah Digital',
  sub: 'Urus catalog hadiah + proses tebusan pelajar',
  addNew: 'Tambah Hadiah',
  queueLink: 'Tebusan Queue',
  tiles: {
    total: 'Total Hadiah',
    active: 'Aktif',
    month: 'Tebusan Bulan Ini',
    pending: 'Pending Proses',
  },
  pillsLabel: 'Kategori hadiah',
  pillAll: 'Semua',
  catalogue: 'Katalog Hadiah',
  columns: {
    reward: 'Hadiah',
    category: 'Kategori',
    rm: 'RM',
    token: 'Token',
    stock: 'Stok',
    redemptions: 'Tebusan',
    status: 'Status',
    actions: 'Tindakan',
  },
  /** Unlimited stock (`null`). */
  unlimited: '∞',
  statusOn: 'On',
  statusOff: 'Off',
  edit: 'Edit',
  /** Category filters only (FR-ADM-P2-07.2). */
  empty: 'Tiada hadiah dalam kategori ini.',
  selected: (n: number): string => `${String(n)} hadiah dipilih`,
  bulk: {
    activate: 'Aktifkan',
    deactivate: 'Nyahaktifkan',
    stock: 'Set Stok',
    maxPerMonth: 'Had/Bulan',
    tokenCost: 'Pelaras Token',
    remove: 'Padam',
    cancel: 'Batal',
  },
  /** `keptIds` of a bulk delete (P07-15). */
  hasRedemptions: 'Hadiah ini mempunyai tebusan. Nyahaktifkan sahaja.',
  form: {
    createTitle: 'Tambah Hadiah',
    editTitle: 'Edit Hadiah',
    category: 'Kategori',
    vendor: 'Vendor',
    vendorPlaceholder: 'cth: Roblox, Touch n Go, Hotlink',
    title: 'Tajuk',
    titlePlaceholder: 'cth: TnG eWallet RM50',
    description: 'Penerangan',
    denominationRm: 'Nilai (RM)',
    tokenCost: 'Kos Token',
    tokenCostHint: '100 syiling = 1 token = RM1',
    iconEmoji: 'Emoji Icon',
    stockQuantity: 'Stok (kosong = tanpa had)',
    maxPerMonthPerStudent: 'Maks/bulan/pelajar',
    voucherValidityDays: 'Sah Hari (default 365)',
    deliveryMethod: 'Delivery',
    deliveryManual: 'Manual (admin paste)',
    deliveryInstant: 'Instant',
    vendorSku: 'Vendor SKU (optional)',
    displayOrder: 'Display Order',
    imageUrl: 'Image URL (optional)',
    termsText: 'Terma Khas',
    isActive: 'Aktif',
    create: 'Tambah',
    save: 'Simpan',
  },
} as const

/**
 * R1-ADM-P2-08 `/admin/hadiah/tebusan` and the "Tebusan Queue" card (30 P2-08, GAME-21; S7-T11).
 * The admin words are the three of FR-ADM-P2-08.4; a stored `pending_parent_consent` row reads with the
 * pupil's word of 10 (OPT-STATUS-REDEEM) and shows under `Semua` only.
 */
export const TEBUSAN_ADMIN_COPY = {
  heading: '📋 Tebusan Hadiah Pelajar',
  sub: 'Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar.',
  card: 'Tebusan Queue',
  pillsLabel: 'Status tebusan',
  pillAll: 'Semua',
  status: {
    pending_admin: 'Menunggu',
    delivered: 'Dihantar',
    cancelled: 'Dibatalkan',
    pending_parent_consent: 'Menunggu Ibu Bapa',
  },
  columns: {
    student: 'Pelajar',
    reward: 'Hadiah',
    rm: 'RM',
    token: 'Token',
    status: 'Status',
    date: 'Tarikh',
    actions: 'Tindakan',
  },
  empty: 'Tiada tebusan dalam status ini.',
  deliver: 'Hantar kod',
  cancel: 'Batal',
  codeRequired: 'Kod baucar diperlukan.',
  delivered: 'Kod dihantar kepada pelajar.',
  confirmTitle: 'Batalkan tebusan ini?',
  confirmBody: 'Token pelajar akan dipulangkan.',
  confirmKeep: 'Batal',
  confirmGo: 'Ya, Batalkan',
} as const

/**
 * PROPOSED (no source in 10, 30, 40 or 48): the bulk prompts and flashes, the delete confirmation, the
 * save flashes and the delivery code field. Each is a labelled placeholder for the product owner.
 */
export const HADIAH_ADMIN_PROPOSED = {
  stockPrompt: 'Stok (kosong = tanpa had)',
  maxPerMonthPrompt: 'Maks/bulan/pelajar (kosong atau 0 = tiada had)',
  tokenCostPrompt: 'Pelaras Token (%)',
  tokenCostPlaceholder: 'cth: +10 atau -20',
  apply: 'Guna',
  deleteTitle: 'Padam hadiah terpilih?',
  deleteBody: (n: number): string => `${String(n)} hadiah akan dipadam.`,
  deleteGo: 'Ya, Padam',
  bulkDone: (n: number): string => `${String(n)} hadiah dikemas kini.`,
  bulkDeleted: (n: number): string => `${String(n)} hadiah dipadam.`,
  created: 'Hadiah ditambah.',
  saved: 'Hadiah disimpan.',
  codeLabel: 'Kod baucar',
  cancelled: 'Tebusan dibatalkan.',
} as const
