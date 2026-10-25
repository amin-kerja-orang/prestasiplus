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
// D54 (2026-10-24): secondary / SPM only. The 10 live Darjah 1-4 notes are replaced by 10 Tingkatan 4/5
// PoC notes titled after the public KSSM chapter names in M03 (curriculum.json). The note types keep the
// live 5 / 2 / 2 / 1 split; the subject counts are NOT the live ones (see M09 SRS deviation DV-M09-22).

const NOTE_CREATED = at('2026-02-06T10:00')

const NOTE_TUPLES: readonly (readonly [number, string, NoteSubject, NoteType, string, string])[] = [
  [
    1,
    'Fungsi dan Persamaan Kuadratik — Formula Ringkas',
    'matematik',
    'FORMULA',
    'TINGKATAN_4',
    'Rumusan formula asas fungsi dan persamaan kuadratik.',
  ],
  [
    2,
    'Pembezaan — Formula Asas',
    'matematik_tambahan',
    'FORMULA',
    'TINGKATAN_5',
    'Senarai formula asas pembezaan untuk rujukan pantas.',
  ],
  [
    3,
    'Ikatan Kimia — Nota Ringkas',
    'kimia',
    'RINGKASAN',
    'TINGKATAN_4',
    'Ringkasan jenis ikatan kimia dan ciri-cirinya.',
  ],
  [
    4,
    'Biologi Sel dan Organisasi Sel — Nota Ringkas',
    'biologi',
    'RINGKASAN',
    'TINGKATAN_4',
    'Ringkasan struktur sel dan tahap organisasi sel.',
  ],
  [
    5,
    'Kemahiran Bahasa Tingkatan 5 — Nota Lengkap',
    'bahasa_melayu',
    'LENGKAP',
    'TINGKATAN_5',
    'Nota lengkap kemahiran bahasa untuk persediaan SPM.',
  ],
  [
    6,
    'Sejarah Tingkatan 4 — Nota Ringkas',
    'sejarah',
    'RINGKASAN',
    'TINGKATAN_4',
    'Ringkasan topik utama Sejarah Tingkatan 4.',
  ],
  [
    7,
    'English Form 5 — Quick Guide',
    'bahasa_inggeris',
    'RINGKASAN',
    'TINGKATAN_5',
    'A quick guide to the key language points for Form 5.',
  ],
  [
    8,
    'English Form 4 — Exam Tips',
    'bahasa_inggeris',
    'TIPS_TRICKS',
    'TINGKATAN_4',
    'Short tips for answering English paper questions.',
  ],
  [
    9,
    'Daun dan Fotosintesis — Nota Ringkas',
    'biologi',
    'RINGKASAN',
    'TINGKATAN_5',
    'Ringkasan struktur daun dan proses fotosintesis.',
  ],
  [
    10,
    'Termokimia — Nota dan Contoh',
    'kimia',
    'LENGKAP',
    'TINGKATAN_5',
    'Nota dan contoh ringkas tindak balas eksotermik dan endotermik.',
  ],
]

export const SEED_NOTES: readonly NoteRow[] = Object.freeze(
  NOTE_TUPLES.map(([id, title, subject, noteType, grade, summary]) =>
    Object.freeze({
      id,
      title,
      summary,
      content: `<h2>${title}</h2><p>Nota contoh.</p>`,
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
