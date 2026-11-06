/** M15 student pages copy (SRS M15 §8.1 observed, §8.2 PROPOSED). */

export const SHOP_COPY = {
  heading: '🎁 Kedai Hadiah',
  sub: 'Tebus token anda untuk hadiah menarik!',
  tileLabel: 'Baki Token 🎫',
  emptyIcon: '🎁',
  emptyTitle: 'Tiada Hadiah Tersedia',
  emptyBody: 'Hadiah akan ditambah tidak lama lagi. Tunggu ya!',
} as const

/** Kotak Misteri (48 GAME-23, 10-murid R1-MUR-35). Exact BM; `{n}` etc. are filled by the helpers below. */
export const BOX_COPY = {
  heading: '📦 Kotak Misteri',
  sub: 'Buka kotak & menang ganjaran rawak — nasib baik menanti!',
  cost: (n: number) => `Kos satu kotak ${String(n)} syiling`,
  balance: 'Baki syiling anda:',
  oddsHeading: 'Peluang ganjaran',
  oddsPrize: 'Ganjaran',
  oddsChance: 'Peluang',
  disclaimer:
    'Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling.',
  short: (n: number) => `Anda perlu ${String(n)} syiling lagi untuk membuka kotak.`,
  collect: 'Kumpul syiling',
  /** PROPOSED: the disabled open button while the balance is short. */
  shortButton: 'Syiling Tidak Cukup',
  daily: 'Had kotak hari ini telah dicapai. Cuba lagi esok.',
  /** PROPOSED (N5): no prize can be won, or no box is active. */
  unavailable: 'Kotak tidak tersedia buat masa ini.',
  open: 'Buka Kotak',
  opening: 'Membuka…',
  confirmTitle: 'Buka kotak?',
  confirmBody: (cost: number, balance: number) =>
    `${String(cost)} syiling akan ditolak daripada baki anda (${String(balance)} syiling).`,
  cancel: 'Batal',
  won: (prize: string) => `Tahniah! Anda dapat ${prize}.`,
  close: 'Tutup',
  historyHeading: 'Kotak yang telah dibuka',
  historyEmpty: 'Anda belum membuka sebarang kotak.',
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
