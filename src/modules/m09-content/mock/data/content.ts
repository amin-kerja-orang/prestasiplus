/**
 * Notes, banners, perutusan and support config seeds (SRS M09 v1.2 §6.9). Authors are the
 * fictitious users of §6.9 (accounts 1, 3102–3109); the school anchors are M02's 900001–900003.
 */

import { toIsoMyt } from '@/lib/time'

import type {
  BannerRow,
  NoteRow,
  NoteSubject,
  NoteType,
  PerutusanReactionRow,
  PerutusanRow,
  SupportConfigRow,
} from '../types'

const at = (stamp: string): string => toIsoMyt(Date.parse(`${stamp}:00+08:00`))

// --- Notes (10, all by Admin Demo, published, 0 / 0) ---------------------------------------------

const NOTE_CREATED = at('2026-02-06T10:00')

const NOTE_TUPLES: readonly (readonly [number, string, NoteSubject, NoteType, string])[] = [
  [1, 'Sifir 1 hingga 12 — Carta Lengkap', 'matematik', 'FORMULA', 'DARJAH_2'],
  [2, 'Formula Perimeter dan Luas', 'matematik', 'FORMULA', 'DARJAH_4'],
  [3, 'Sistem Pencernaan Manusia — Nota Ringkas', 'sains', 'RINGKASAN', 'DARJAH_4'],
  [4, 'Benda Hidup dan Bukan Hidup', 'sains', 'RINGKASAN', 'DARJAH_1'],
  [5, 'Imbuhan Awalan dan Akhiran — Nota Lengkap', 'bahasa_melayu', 'LENGKAP', 'DARJAH_3'],
  [6, 'Kata Nama, Kata Kerja, Kata Adjektif', 'bahasa_melayu', 'RINGKASAN', 'DARJAH_2'],
  [7, 'Common English Tenses — Quick Guide', 'bahasa_inggeris', 'RINGKASAN', 'DARJAH_4'],
  [8, 'English Prepositions — In, On, At', 'bahasa_inggeris', 'TIPS_TRICKS', 'DARJAH_3'],
  [9, 'Rantai Makanan — Sains Darjah 3', 'sains', 'RINGKASAN', 'DARJAH_3'],
  [10, 'Pecahan — Nota dan Contoh', 'matematik', 'LENGKAP', 'DARJAH_3'],
]

export const SEED_NOTES: readonly NoteRow[] = Object.freeze(
  NOTE_TUPLES.map(([id, title, subject, noteType, grade]) =>
    Object.freeze({
      id,
      title,
      summary:
        id === 1
          ? 'Carta sifir lengkap dari 1 hingga 12 untuk hafalan mudah.'
          : `Ringkasan contoh untuk ${title}.`,
      content:
        id === 1
          ? '<h2>Sifir 1 hingga 12</h2> <p>Sifir adalah asas kepada semua operasi Matematik. Hafal sifir ini dan Matematik jadi mudah!</p> <h3>Sifir 2</h3> <p>2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24</p>'
          : `<h2>${title}</h2><p>Nota contoh.</p>`,
      subject,
      noteType,
      grade,
      isPublished: true,
      views: 0,
      downloads: 0,
      authorId: 1,
      createdAt: NOTE_CREATED,
      updatedAt: NOTE_CREATED,
    }),
  ),
)

// --- Banners (5, all active 2026-01-01 → 2026-12-31, link NONE) ------------------------------------

const BANNER_CREATED = at('2026-01-01T09:00')

const BANNER_TUPLES: readonly (readonly [
  id: number,
  type: string,
  audience: string,
  title: string,
  description: string,
])[] = [
  [
    1,
    'HERO',
    'ALL',
    'Selamat Datang ke PRESTASIPLUS',
    'Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar hari ini!',
  ],
  [
    2,
    'FEATURE',
    'STUDENT',
    '2,000+ Soalan Latihan Tersedia!',
    'Latih diri dengan ribuan soalan Matematik, Sains, BM dan BI. Kumpul coins dan naik ranking!',
  ],
  [
    3,
    'PROMOTIONAL',
    'STUDENT',
    'Cabaran Mingguan: Siapa Paling Rajin?',
    'Sertai cabaran mingguan dan lihat nama kamu di papan pendahulu. Streak 7 hari = bonus coins!',
  ],
  [
    4,
    'ANNOUNCEMENT',
    'ALL',
    'Tips untuk Ibu Bapa: Bimbing Anak Belajar',
    'Panduan untuk ibu bapa membantu anak-anak cemerlang dalam pelajaran. Klik untuk baca lebih lanjut.',
  ],
  [
    5,
    'FEATURE',
    'STUDENT',
    'Kumpul Badge & Tunjukkan Kehebatan!',
    '15 badge istimewa menanti! Jawab soalan, kekalkan streak, dan jadi juara kelas.',
  ],
]

export const SEED_BANNERS: readonly BannerRow[] = Object.freeze(
  BANNER_TUPLES.map(([id, bannerType, targetAudience, title, description]) =>
    Object.freeze({
      id,
      title,
      description,
      imageUrl: null,
      bannerType,
      linkType: 'NONE',
      externalUrl: null,
      targetAudience,
      displayOrder: id,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isActive: true,
      createdAt: BANNER_CREATED,
      updatedAt: BANNER_CREATED,
    }),
  ),
)

// --- Perutusan (3 live posts; authors fictitious) ---------------------------------------------------

const BODY_4 =
  '<p style="text-align:center">✦ ✦ ✦</p><p style="text-align:center">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</p><p style="text-align:center">Dengan Nama Allah Yang Maha Pemurah Lagi Maha Penyayang</p><h2 style="text-align:center">Selamat Hari Raya Aidilfitri</h2><p style="text-align:center">1 Syawal 1447H / 2026M</p><p>Ucapan Perutusan Hari Raya Aidilfitri 2026 daripada pihak pengurusan sekolah kepada seluruh warga sekolah, ibu bapa dan penjaga.</p><h3 style="text-align:center">Takbir Bergema, Hati Bersatu</h3>'
const BODY_2 =
  '<p>Assalamualaikum warahmatullahi wabarakatuh. Yang dihormati para ibu bapa, para guru yang berdedikasi, dan anak-anak murid yang saya kasihi sekalian. Pertama sekali, saya ingin merakamkan setinggi-tinggi penghargaan dan terima kasih kepada semua warga sekolah atas kerjasama sepanjang bulan Ramadan. Semoga kita menyambut Syawal dengan penuh hikmah.</p>'
const BODY_3 =
  '<p>✦ ✦ ✦ بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ Dengan Nama Allah Yang Maha Pemurah Lagi Maha Penyayang Selamat Hari Raya Aidilfitri 1 Syawal 1447H / 2026M ✦ ✦ ✦ Ucapan Perutusan Hari Raya Aidilfitri 2026 Daripada Pihak Pengurusan Sekolah Kepada seluruh warga sekolah, ibu bapa dan penjaga. Selamat Hari Raya, maaf zahir dan batin.</p>'

export const SEED_PERUTUSAN: readonly PerutusanRow[] = Object.freeze([
  Object.freeze({
    id: 2,
    title: 'Ucapan Penghargaan & Ramadan – Menyambut Syawal dengan Hikmah',
    body: BODY_2,
    images: [],
    documents: [],
    youtubeUrl: null,
    isPinned: true,
    isPublic: false,
    status: 'published',
    scheduledAt: null,
    scope: 'school',
    schoolId: 900001,
    authorId: 3103,
    reads: 4,
    createdAt: at('2026-03-16T20:00'),
    updatedAt: at('2026-03-16T20:00'),
  } satisfies PerutusanRow),
  Object.freeze({
    id: 3,
    title: 'Video Ucapan Selamat Hari Raya 2026',
    body: BODY_3,
    images: [],
    documents: [],
    youtubeUrl: 'https://www.youtube.com/watch?v=SEEDPRT0003',
    isPinned: false,
    isPublic: false,
    status: 'published',
    scheduledAt: null,
    scope: 'school',
    schoolId: 900002,
    authorId: 3104,
    reads: 55,
    createdAt: at('2026-03-18T08:00'),
    updatedAt: at('2026-03-18T08:00'),
  } satisfies PerutusanRow),
  Object.freeze({
    id: 4,
    title: 'Video Ucapan Selamat Hari Raya Dari Pihak Pengurusan SMK Bandar Seri Putra',
    body: BODY_4,
    images: [],
    documents: [],
    youtubeUrl: 'https://www.youtube.com/watch?v=SEEDPRT0004',
    isPinned: true,
    isPublic: true,
    status: 'published',
    scheduledAt: null,
    scope: 'school',
    schoolId: 900003,
    authorId: 3102,
    reads: 3,
    createdAt: at('2026-03-17T23:23'),
    updatedAt: at('2026-03-17T23:23'),
  } satisfies PerutusanRow),
])

/** like 1 on #4 (guru, id 5); love 5 on #3 (3105–3109). No read rows, no comments. */
export const SEED_REACTIONS: readonly Omit<PerutusanReactionRow, 'id'>[] = Object.freeze([
  { perutusanId: 4, userId: 5, type: 'like', createdAt: at('2026-03-18T09:00') },
  ...[3105, 3106, 3107, 3108, 3109].map((userId) => ({
    perutusanId: 3,
    userId,
    type: 'love' as const,
    createdAt: at('2026-03-18T10:00'),
  })),
])

export const SEED_SUPPORT: SupportConfigRow = Object.freeze({
  id: 1,
  email: 'support@prestasiplus.my',
  whatsappNumber: '60123456789',
})

/** DATA-M09-13 seed: one row, guru (5) to SMK DEMO (900001), provisional. */
export const SEED_VIDEO_SCHOOLS: readonly { userId: number; schoolId: number }[] = Object.freeze([
  { userId: 5, schoolId: 900001 },
])
