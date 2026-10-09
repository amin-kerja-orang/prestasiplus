/**
 * S6 `/permainan` card data (SRS M16 v1.6 FR-M16-52; URS FN-M16-4.1.3 to 4.1.11; discovery A.3): 18 cards in
 * live order (17 games + the Peta Pengembaraan link card). Copy is exact (DV-M16-21, DV-M16-22, DV-M16-23
 * keep the live wording). Badge colours are the observed pairs mapped to the palette classes (the live hex
 * values are the Tailwind v3 palette the theme overrides).
 */

export type HubChipFlag = 'papanBijakPlayed' | 'battled'

export interface HubCard {
  /** Stable id (test ids). */
  id: string
  /** Optional corner badge text. */
  badge?: string
  /** Tailwind classes of the badge. */
  badgeClass?: string
  /** Banner emoji above the title. */
  emoji: string
  title: string
  text: string
  /** Stat chips; a chip with `unlessFlag` shows only while that #22 chip flag is false. */
  chips: { text: string; unlessFlag?: HubChipFlag }[]
  /** Font Awesome class of the button icon (resolved by `AppIcon`). */
  icon: string
  button: string
  /** Where the card and its button go. */
  to: string
}

const MULTIPLAYER = {
  badge: '👥 MULTIPLAYER',
  badgeClass: 'bg-indigo-100 text-indigo-700',
} as const

export const HUB_CARDS: readonly HubCard[] = [
  {
    id: 'papan-bijak',
    emoji: '🎲',
    title: 'Papan Bijak',
    text: 'Board game matematik! Gulung dadu, jawab soalan, dan lumba ke garisan penamat bersama kawan.',
    chips: [{ text: '🆕 Belum main lagi', unlessFlag: 'papanBijakPlayed' }],
    icon: 'fa-play',
    button: 'Main Sekarang',
    to: '/papan-bijak',
  },
  {
    id: 'battle',
    badge: '🔥 HOT',
    badgeClass: 'bg-red-100 text-red-700',
    emoji: '⚔️',
    title: 'Battle Arena',
    text: 'Duel 1-lawan-1 dengan pelajar lain! Siapa jawab betul dan cepat, dialah juara.',
    chips: [{ text: '🆕 Belum battle lagi', unlessFlag: 'battled' }],
    icon: 'fa-bolt',
    button: 'Battle!',
    to: '/battle',
  },
  {
    id: 'perang-fakta',
    ...MULTIPLAYER,
    emoji: '⚔️',
    title: 'Perang Fakta',
    text: 'Betul atau Salah? Vote bersama 2-6 pemain! 15 pusingan, 10 saat setiap pernyataan.',
    chips: [{ text: '👥 2-6 Pemain' }, { text: '⚡ 10 Saat' }],
    icon: 'fa-fist-raised',
    button: 'Main!',
    to: '/perang-fakta',
  },
  {
    id: 'benteng-ilmu',
    ...MULTIPLAYER,
    emoji: '🏰',
    title: 'Benteng Ilmu',
    text: 'Duel 1v1! Serang benteng lawan dengan kuasa ilmu. Jawab betul = serang, salah = rosak sendiri!',
    chips: [{ text: '🏰 HP 100' }, { text: '⚡ Special Effect' }],
    icon: 'fa-shield-alt',
    button: 'Duel!',
    to: '/benteng-ilmu',
  },
  {
    id: 'perlumbaan-matematik',
    ...MULTIPLAYER,
    emoji: '🏎️',
    title: 'Perlumbaan Matematik',
    text: 'Lumba ke garisan penamat! Jawab betul = maju 1 langkah. Siapa sampai 20 dulu menang!',
    chips: [{ text: '🏎️ 2-4 Pemain' }, { text: '🏁 20 Langkah' }],
    icon: 'fa-flag-checkered',
    button: 'Lumba!',
    to: '/perlumbaan-matematik',
  },
  {
    id: 'kuiz-relay',
    ...MULTIPLAYER,
    emoji: '🏃',
    title: 'Kuiz Relay',
    text: 'Berpasukan! 2 pasukan jawab bergilir-gilir. Bonus kelajuan, pasukan terbaik menang!',
    chips: [{ text: '👥 4-8 Pemain' }, { text: '🏆 2 Pasukan' }],
    icon: 'fa-users',
    button: 'Main!',
    to: '/kuiz-relay',
  },
  {
    id: 'teka-silang-kata',
    ...MULTIPLAYER,
    emoji: '📝',
    title: 'Teka Silang Kata',
    text: 'Isi silang kata lawan masa! 2 pemain, 5 minit, siapa isi paling banyak menang!',
    chips: [{ text: '📝 2 Pemain' }, { text: '⏱️ 5 Minit' }],
    icon: 'fa-pencil-alt',
    button: 'Main!',
    to: '/teka-silang-kata',
  },
  {
    id: 'betul-salah',
    badge: '✅❌ BARU!',
    badgeClass: 'bg-violet-100 text-violet-800',
    emoji: '✅',
    title: 'Betul atau Salah',
    text: 'Kenyataan keluar laju — tekan Betul atau Salah dalam 45 saat! Bina kombo untuk bonus!',
    chips: [{ text: '⏱️ 45 Saat' }, { text: '🔥 Kombo' }],
    icon: 'fa-check-circle',
    button: 'Mula',
    to: '/permainan/betul-salah',
  },
  {
    id: 'roda-nasib',
    badge: '📅 HARIAN',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    emoji: '🎯',
    title: 'Roda Nasib',
    text: 'Pusing roda setiap hari untuk dapat ganjaran misteri — Syiling, bonus XP, atau cabaran khas!',
    chips: [{ text: '🎁 Hadiah Harian' }, { text: '1x / hari' }],
    icon: 'fa-circle-notch',
    button: 'Spin Sekarang!',
    to: '/permainan/roda-nasib',
  },
  {
    id: 'pertandingan',
    badge: '📅 MINGGUAN',
    badgeClass: 'bg-amber-100 text-amber-700',
    emoji: '🏆',
    title: 'Pertandingan Mingguan',
    text: 'Lumba dengan semua pelajar setiap minggu! Top 3 dapat Syiling bonus dan badge istimewa.',
    chips: [{ text: '📊 Ranking Live' }, { text: '🥇 Hadiah Top 3' }],
    icon: 'fa-trophy',
    button: 'Lihat Ranking',
    to: '/permainan/pertandingan',
  },
  {
    id: 'peta-pengembaraan',
    emoji: '🗺️',
    title: 'Peta Pengembaraan',
    text: 'Jelajah dunia matematik! Selesaikan misi di setiap checkpoint untuk unlock kawasan baru.',
    chips: [{ text: '🌍 Jelajah Dunia' }, { text: '📈 Progress' }],
    icon: 'fa-map-marked-alt',
    button: 'Jelajah',
    to: '/peta-belajar',
  },
  {
    id: 'uji-minda',
    badge: '👨‍👩‍👧 IBU BAPA',
    badgeClass: 'bg-pink-100 text-pink-700',
    emoji: '🧠',
    title: 'Uji Minda',
    text: 'Cabaran khas dari ibu/bapa kamu! Jawab soalan, kumpul mata, dan tebus hadiah istimewa.',
    chips: [{ text: '🎁 Hadiah Custom' }, { text: '⏳ Menunggu Ibu Bapa' }],
    icon: 'fa-brain',
    button: 'Mula',
    to: '/permainan/uji-minda',
  },
  {
    id: 'cabaran-kilat',
    badge: '⚡ BARU!',
    badgeClass: 'bg-sky-100 text-sky-700',
    emoji: '⚡',
    title: 'Cabaran Kilat',
    text: '60 saat! Jawab laju, bina combo, pecah rekod! Makin panjang kombo, makin banyak Syiling.',
    chips: [{ text: '⏱️ 60 Saat' }, { text: '🔥 Combo' }],
    icon: 'fa-bolt',
    button: 'Mula!',
    to: '/permainan/cabaran-kilat',
  },
  {
    id: 'jutawan',
    badge: '💰 BARU!',
    badgeClass: 'bg-amber-100 text-amber-800',
    emoji: '💰',
    title: 'Jutawan Ilmu',
    text: 'Pilih subjek, jawab 15 soalan makin susah — menang sehingga 1,000 Syiling! 3 lifeline disediakan.',
    chips: [{ text: '📚 Semua Subjek' }, { text: '🏆 1000🪙' }],
    icon: 'fa-crown',
    button: 'Main!',
    to: '/permainan/jutawan',
  },
  {
    id: 'susun-jawapan',
    badge: '🧩 BARU!',
    badgeClass: 'bg-teal-100 text-teal-700',
    emoji: '🧩',
    title: 'Susun Jawapan',
    text: 'Huruf/perkataan bercampur aduk — susun semula untuk bentuk jawapan yang betul!',
    chips: [{ text: '🔤 Susun' }, { text: '🧠 Logik' }],
    icon: 'fa-puzzle-piece',
    button: 'Susun!',
    to: '/permainan/susun-jawapan',
  },
  {
    id: 'tembak-jawapan',
    badge: '🎯 BARU!',
    badgeClass: 'bg-orange-50 text-orange-800',
    emoji: '🎯',
    title: 'Tembak Jawapan',
    text: 'Jawapan jatuh dari atas — tap yang betul sebelum sampai bawah! Makin laju setiap level!',
    chips: [{ text: '❤️ 3 Nyawa' }, { text: '⚡ Speed Up' }],
    icon: 'fa-crosshairs',
    button: 'Tembak!',
    to: '/permainan/tembak-jawapan',
  },
  {
    id: 'sambung-kata',
    badge: '🔗 BARU!',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    emoji: '🔗',
    title: 'Sambung Kata',
    text: 'Taip perkataan bermula huruf terakhir! Bina rantaian paling panjang sebelum masa habis.',
    chips: [{ text: '⌨️ Taip Laju' }, { text: '🔗 Chain' }],
    icon: 'fa-link',
    button: 'Mula!',
    to: '/permainan/sambung-kata',
  },
  {
    id: 'kad-memori',
    badge: '🧠 HOT!',
    badgeClass: 'bg-purple-100 text-purple-800',
    emoji: '🃏',
    title: 'Kad Memori',
    text: 'Padankan soalan dengan jawapan yang betul! Cari semua pasangan kad sebelum masa habis.',
    chips: [{ text: '🃏 6 Pasangan' }, { text: '🧠 Ingatan' }],
    icon: 'fa-brain',
    button: 'Main!',
    to: '/permainan/kad-memori',
  },
]

/** The hero copy (FN-M16-4.1.1). */
export const HUB_HEADING = '🎮 Zona Permainan'
export const HUB_INTRO =
  'Main sambil belajar! Kumpul Syiling, naik ranking, dan jadi champion sekolah. Pilih permainan kegemaran kamu.'

/** Open-rooms strip, empty state (FN-M16-4.1.2). */
export const HUB_NO_ROOMS = {
  emoji: '🌙',
  title: 'Tiada bilik terbuka buat masa ini.',
  hint: 'Cipta bilik permainan dan jemput rakan-rakan!',
} as const
