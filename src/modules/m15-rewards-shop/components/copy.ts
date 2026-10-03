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
