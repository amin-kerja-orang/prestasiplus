/**
 * The seeded DSKP records (SRS M10 v1.15 §6.9 "Seeded DSKP records read by other modules", XL2-20,
 * M04 v1.13 SQ-7): observed records keep their live ids and codes; "designed" ones are demo data.
 *
 * Id blocks: observed live ids ≤ 6191; generic 8021–8551 (`8000 + 20 × subjectId + levelId`);
 * named designed 9001–9112; further designed fillers 9201–9299 (INFERRED, this file); the Tingkatan 4–5
 * demo standards 9501–9525 (UAT 2026-10-24, D54; Bidang 9501–9515, SK 9501–9516, SP 9501–9525);
 * teacher-created rows ≥ 9,000,001 (`floor`).
 *
 * No record carries placeholder wording ("fixture", "INFERRED filler"): the demo text is shown to users on
 * the M27 DSKP heatmap, the M08 maps and the M04/M10 DSKP pickers.
 */

import type { DskpBidangRow, DskpSkRow, DskpSpRow } from '../repository/types'

/** M03 subjects that carry DSKP pairs (M10 §6.9 generic-SP row): id → name. */
export const DSKP_SUBJECT_NAMES: Readonly<Record<number, string>> = {
  1: 'Bahasa Melayu',
  2: 'Bahasa Inggeris',
  3: 'Matematik',
  4: 'Sains',
  5: 'Sejarah',
  6: 'Pendidikan Islam',
  7: 'Pendidikan Moral',
  8: 'Matematik Tambahan',
  9: 'Fizik',
  10: 'Kimia',
  11: 'Biologi',
  12: 'Geografi',
  13: 'Pendidikan Seni Visual',
  14: 'Pendidikan Muzik',
  15: 'Pendidikan Jasmani & Kesihatan',
  16: 'Reka Bentuk & Teknologi',
  17: 'Sains Komputer',
  18: 'Bahasa Arab',
  20: 'Bahasa Tamil',
  21: 'Prinsip Perakaunan',
  22: 'Ekonomi',
  23: 'Perniagaan',
  24: 'Pendidikan Al-Quran & As-Sunnah',
  25: 'Tasawwur Islam',
  26: 'Jawi',
  27: 'Pendidikan Syariah Islamiah',
}

/** M03 level id → code (D1…D6 = 1…6, T1…T5 = 7…11). */
export const LEVEL_CODES: readonly string[] = [
  '',
  'D1',
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
]

/** M03 level id → name (Darjah 1…6 = 1…6, Tingkatan 1…5 = 7…11). */
const LEVEL_NAMES: readonly string[] = [
  '',
  ...[1, 2, 3, 4, 5, 6].map((n) => `Darjah ${String(n)}`),
  ...[1, 2, 3, 4, 5].map((n) => `Tingkatan ${String(n)}`),
]

/**
 * Pairs whose generic chain carries real-looking KSSM text instead of the neutral wording (UAT
 * 2026-10-24, S-52): Matematik T4 (Bab 1; the Bidang code stays empty, the name-only format of M04
 * E2E-19) and Sejarah T4 (Bab 1). Aligned with the M03 chapters of the pair.
 */
const REAL_GENERIC: Readonly<
  Record<string, { bidangCode: string | null; bidang: string; sk: string; sp: string }>
> = {
  '3:10': {
    bidangCode: null,
    bidang: 'Fungsi dan Persamaan Kuadratik',
    sk: 'Fungsi',
    sp: 'Mengenal pasti dan memerihalkan hubungan antara dua pemboleh ubah dalam fungsi.',
  },
  '5:10': {
    bidangCode: '1.0',
    bidang: 'Kemunculan Tamadun Awal',
    sk: 'Kemunculan tamadun awal manusia',
    sp: 'Menerangkan kemunculan tamadun awal manusia.',
  },
}

const D = [1, 2, 3, 4, 5, 6]
const T = [7, 8, 9, 10, 11]
const T123 = [7, 8, 9]
const T45 = [10, 11]
const ALL = [...D, ...T]

/**
 * The 187 subject–level pairs that hold M04 question rows (M04 §6.13 Tables A–C as checked in M04
 * v1.13; M10 §6.9): subject id → level ids.
 */
export const DSKP_PAIRS: Readonly<Record<number, readonly number[]>> = {
  1: ALL,
  2: ALL,
  3: ALL,
  4: ALL,
  5: ALL,
  6: ALL,
  7: ALL,
  8: T45,
  9: T45,
  10: T45,
  11: T45,
  12: ALL,
  13: ALL,
  14: [...D, ...T123],
  15: ALL,
  16: ALL,
  17: [4, 5, 6, ...T],
  18: ALL,
  20: ALL,
  21: T45,
  22: T45,
  23: T45,
  24: T45,
  25: T45,
  26: D,
  27: [7, ...T45],
}

/** The generic SP of a subject–level pair (M10 §6.9); Sains T5 (4, 11) uses SP 6191 instead. */
export function genericSpId(subjectId: number, levelId: number): number {
  return subjectId === 4 && levelId === 11 ? 6191 : 8000 + 20 * subjectId + levelId
}

export function dskpPairCount(): number {
  return Object.values(DSKP_PAIRS).reduce((n, levels) => n + levels.length, 0)
}

/** Pairs whose records are not the plain generic chain (they reuse observed or named records). */
const SPECIAL_PAIRS = new Set(['4:11', '1:10', '1:11', '10:11', '5:11', '1:4', '5:4'])

export interface DskpSeed {
  bidang: DskpBidangRow[]
  sk: DskpSkRow[]
  sp: DskpSpRow[]
}

const bidang = (
  id: number,
  subjectId: number,
  educationLevelId: number,
  code: string | null,
  name: string,
): DskpBidangRow => ({ id, subjectId, educationLevelId, code, name, createdBy: null })

const sk = (id: number, bidangId: number, code: string, description: string): DskpSkRow => ({
  id,
  bidangId,
  code,
  description,
  createdBy: null,
})

const sp = (id: number, skId: number, code: string, description: string): DskpSpRow => ({
  id,
  skId,
  code,
  description,
  createdBy: null,
})

const BM_BIDANG = [
  'Kemahiran Mendengar dan Bertutur',
  'Kemahiran Membaca',
  'Kemahiran Menulis',
  'Aspek Seni Bahasa',
  'Aspek Tatabahasa',
] as const

/** Sains T5 Bidang 3.0–8.0 (PROPOSED titles: the M03 chapter names of Sains Tingkatan 5). */
const SAINS_T5_BIDANG = [
  'Kelestarian Alam Sekitar',
  'Aplikasi Kadar Tindak Balas',
  'Alkohol',
  'Sel Elektrolisis',
  'Alat Optik',
  'Tekanan dalam Bendalir',
] as const

export function buildDskp(): DskpSeed {
  const out: DskpSeed = { bidang: [], sk: [], sp: [] }
  const { bidang: B, sk: K, sp: P } = out

  // --- Generic chain: one Bidang "1.0", SK "1.1" and SP "1.1.1" per pair -------------------------
  for (const [s, levels] of Object.entries(DSKP_PAIRS)) {
    const subjectId = Number(s)
    const name = DSKP_SUBJECT_NAMES[subjectId] as string
    for (const levelId of levels) {
      if (SPECIAL_PAIRS.has(`${String(subjectId)}:${String(levelId)}`)) continue
      const id = genericSpId(subjectId, levelId)
      const tag = `${name} ${LEVEL_NAMES[levelId] as string}`
      const real = REAL_GENERIC[`${String(subjectId)}:${String(levelId)}`]
      B.push(bidang(id, subjectId, levelId, real ? real.bidangCode : '1.0', real?.bidang ?? tag))
      K.push(sk(id, id, '1.1', real?.sk ?? `Standard kandungan ${tag}`))
      P.push(sp(id, id, '1.1.1', real?.sp ?? `Menguasai kandungan ${tag}`))
    }
  }

  // --- Kimia T5: SP 9001–9004 (M08 weak topics of class 2001) + the pair's generic SP 8211 --------
  B.push(bidang(9021, 10, 11, '1.0', 'Elektrokimia, Sebatian Karbon dan Polimer'))
  K.push(sk(9011, 9021, '1.1', 'Sel elektrolisis, siri homolog dan polimer'))
  P.push(sp(9001, 9011, '1.1.1', 'Sel Elektrolisis'))
  P.push(sp(9002, 9011, '1.1.2', 'Polimer'))
  P.push(sp(9003, 9011, '1.1.3', 'Siri Homolog'))
  P.push(sp(9004, 9011, '1.1.4', 'Getah Asli'))
  P.push(sp(8211, 9011, '1.1.5', 'Menguasai kandungan Kimia Tingkatan 5'))

  // --- Bahasa Melayu T4: observed Bidang 1.0–5.0 and 8 SK under 1.0 ------------------------------
  BM_BIDANG.forEach((n, i) => {
    const id = i === 0 ? 8030 : 9200 + i
    B.push(bidang(id, 1, 10, `${String(i + 1)}.0`, n))
  })
  K.push(sk(8030, 8030, '1.1', 'Mendengar, mengenal dan menyebut …'))
  for (let n = 2; n <= 8; n++) {
    K.push(
      sk(
        9209 + n,
        8030,
        `1.${String(n)}`,
        `Standard kandungan 1.${String(n)} — Kemahiran Mendengar`,
      ),
    )
  }
  P.push(sp(8030, 8030, '1.1.1', 'Menguasai kandungan Bahasa Melayu Tingkatan 4'))
  K.push(sk(9031, 9201, '2.1', 'Standard kandungan 2.1 — Kemahiran Membaca'))
  K.push(sk(9032, 9202, '3.4', 'Standard kandungan 3.4 — Kemahiran Menulis'))
  K.push(sk(9033, 9203, '4.2', 'Standard kandungan 4.2 — Aspek Seni Bahasa'))
  K.push(sk(9034, 9204, '5.1', 'Standard kandungan 5.1 — Aspek Tatabahasa'))
  K.push(sk(9035, 9204, '5.3', 'Standard kandungan 5.3 — Aspek Tatabahasa'))
  // Observed ids, codes and title prefixes (M08 S7 cards); the text after the cut is not known.
  P.push(
    sp(
      194,
      9031,
      '2.1.1',
      'Membaca pelbagai jenis teks untuk mengenal pasti dan membandingkan intonasi serta nada yan…',
    ),
  )
  P.push(sp(206, 9032, '3.4.1', 'Menulis kerangka karangan dengan menyusun dan menganalisis i…'))
  P.push(sp(214, 9033, '4.2.1', 'Memahami dan menggunakan perbandingan semacam, kata-kata hik…'))
  P.push(sp(221, 9034, '5.1.2', 'Mengaplikasi pelbagai kata terbitan dalam pelbagai laras bah…'))
  P.push(sp(222, 9034, '5.1.3', 'Mengaplikasi bentuk kata ganda dan akronim dalam pelbagai la…'))
  P.push(
    sp(
      179,
      9035,
      '5.3.4',
      'Mengenal pasti dan menggunakan ayat penyata, ayat tanya, ayat perintah dan ayat seruan yan…',
    ),
  )

  // --- Bahasa Melayu T5: Bidang 1.0–5.0; SK 8031 "1.1" and SP 8031 under 1.0 ---------------------
  BM_BIDANG.forEach((n, i) => {
    const id = i === 0 ? 8031 : 9205 + i
    B.push(bidang(id, 1, 11, `${String(i + 1)}.0`, n))
  })
  K.push(sk(8031, 8031, '1.1', 'Standard kandungan 1.1 — Kemahiran Mendengar dan Bertutur'))
  P.push(sp(8031, 8031, '1.1.1', 'Menguasai kandungan Bahasa Melayu Tingkatan 5'))

  // --- Sejarah T5: SP 418 (observed) + the pair's generic SP 8111 ---------------------------------
  B.push(bidang(9052, 5, 11, '15.0', 'Malaysia dan Hubungan Antarabangsa'))
  K.push(sk(9051, 9052, '15.3', 'Peranan Malaysia dalam hubungan antarabangsa'))
  P.push(
    sp(418, 9051, '15.3.2', 'Menerangkan peranan Malaysia dalam hubungan ekonomi antarabangsa.'),
  )
  P.push(sp(8111, 9051, '15.3.1', 'Menguasai kandungan Sejarah Tingkatan 5'))

  // --- Sains T5: Bidang 515, 57–65 (observed), SK 2667 / BAB9, SP 6191 (M04 anchor 564159) --------
  B.push(bidang(515, 4, 11, 'T5-SUB4-TEXTBOOK', 'Sains T5 - Sokongan Bab Buku Teks'))
  const sains: readonly string[] = [
    'Mikroorganisma',
    'Nutrisi dan Teknologi Makanan',
    ...SAINS_T5_BIDANG,
    'Teknologi Angkasa',
  ]
  sains.forEach((n, i) => B.push(bidang(57 + i, 4, 11, `${String(i + 1)}.0`, n)))
  K.push(
    sk(
      2667,
      515,
      'T5SN.B9',
      'Menguasai konsep utama Bab 9: Satelit berdasarkan buku teks Sains Tingkatan 5.',
    ),
  )
  K.push(sk(2668, 515, 'BAB9', 'Sokongan pembelajaran BAB9: Satelit'))
  P.push(
    sp(
      6191,
      2667,
      'T5SN.B9.1',
      'Menjawab soalan objektif berkaitan konsep dan aplikasi Bab 9: Satelit.',
    ),
  )

  // --- Matematik T4 is a generic chain with an empty Bidang code (generated above) ---------------

  // --- Darjah 4 map tiles (M08 S7 map; observed codes and titles, designed ids and parents) ------
  B.push(bidang(8024, 1, 4, '1.0', 'Bahasa Melayu Darjah 4'))
  K.push(sk(9101, 8024, '1.1', 'Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4'))
  K.push(sk(9102, 8024, '2.1', 'Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4'))
  K.push(sk(9103, 8024, '3.1', 'Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4'))
  P.push(sp(8024, 9101, '1.1', 'Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4'))
  P.push(sp(9401, 9102, '2.1', 'Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4'))
  P.push(sp(9402, 9103, '3.1', 'Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4'))
  B.push(bidang(8104, 5, 4, '1.0', 'Sejarah Darjah 4'))
  K.push(sk(9111, 8104, '1.1', 'Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4'))
  K.push(sk(9112, 8104, '2.1', 'Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4'))
  P.push(sp(8104, 9111, '1.1', 'Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4'))
  P.push(sp(9403, 9112, '2.1', 'Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4'))

  addAdminFillers(out)
  addDemoStandards(out)

  return out
}

/**
 * Tingkatan 4–5 demo standards (UAT 2026-10-24, S-52; D45 small, D54 secondary only): real-looking
 * Bidang / Standard Kandungan / Standard Pembelajaran, aligned with the M03 chapters, for three core
 * subjects of the SMK DEMO demo school so `/admin-sekolah/dskp-heatmap` and the guru DSKP pickers
 * show several populated rows. The performance behind them is M08's `DESIGNED_SP_PERFORMANCE`.
 * Ids: Bidang 9501–9515, SK 9501–9516, SP 9501–9525 (new blocks); the generic SPs 8070, 8110 and 8211
 * are reused as the first Standard Pembelajaran of their Bab.
 */
function addDemoStandards(out: DskpSeed): void {
  const { bidang: B, sk: K, sp: P } = out
  // Matematik T4 (3 / 10): Bab 1 is the generic chain (Bidang 8070, SK 8070 "Fungsi", SP 8070). Every
  // Matematik T4 Bidang has an empty code (name-only format, M04 E2E-19), like the KSSM Bab titles.
  const math = [
    [9501, 'Asas Nombor'],
    [9502, 'Penaakulan Logik'],
    [9503, 'Operasi Set'],
  ] as const
  for (const [id, name] of math) B.push(bidang(id, 3, 10, null, name))
  K.push(sk(9501, 8070, '1.2', 'Persamaan kuadratik'))
  K.push(sk(9502, 9501, '2.1', 'Nombor dalam asas dua, lapan dan lima'))
  K.push(sk(9503, 9502, '3.1', 'Pernyataan'))
  K.push(sk(9504, 9502, '3.2', 'Hujah'))
  K.push(sk(9505, 9503, '4.1', 'Operasi set'))
  P.push(sp(9501, 8070, '1.1.2', 'Mewakilkan fungsi dengan pelbagai bentuk perwakilan.'))
  P.push(sp(9502, 9501, '1.2.1', 'Memahami konsep persamaan kuadratik.'))
  P.push(sp(9503, 9501, '1.2.2', 'Menyelesaikan persamaan kuadratik dengan pelbagai kaedah.'))
  P.push(
    sp(9504, 9502, '2.1.1', 'Menukar nombor dalam asas sepuluh kepada asas dua, lapan dan lima.'),
  )
  P.push(sp(9505, 9502, '2.1.2', 'Melakukan operasi tambah dan tolak nombor dalam asas dua.'))
  P.push(
    sp(9506, 9502, '2.1.3', 'Menyelesaikan masalah yang melibatkan nombor dalam pelbagai asas.'),
  )
  P.push(sp(9507, 9503, '3.1.1', 'Menentukan nilai kebenaran bagi pernyataan.'))
  P.push(sp(9508, 9503, '3.1.2', "Membina pernyataan majmuk menggunakan 'dan' dan 'atau'."))
  P.push(sp(9509, 9504, '3.2.1', 'Membina hujah deduksi dan induksi yang sah.'))
  P.push(sp(9510, 9505, '4.1.1', 'Menentukan persilangan dan kesatuan set.'))
  P.push(sp(9511, 9505, '4.1.2', 'Menyelesaikan masalah yang melibatkan operasi set.'))

  // Sejarah T4 (5 / 10): Bab 1 is the generic chain (Bidang 8110 "1.0", SK 8110 "1.1", SP 8110).
  const sej = [
    [9511, '2.0', 'Tamadun Hwang Ho dan Mesir Purba'],
    [9512, '3.0', 'Kemajuan Kerajaan Awal Asia Tenggara'],
    [9513, '4.0', 'Masyarakat Arab Jahiliah dan Penyebaran Islam'],
  ] as const
  for (const [id, code, name] of sej) B.push(bidang(id, 5, 10, code, name))
  K.push(sk(9511, 9511, '2.1', 'Tamadun Hwang Ho dan Mesir Purba'))
  K.push(sk(9512, 9512, '3.1', 'Kerajaan awal di Asia Tenggara'))
  K.push(sk(9513, 9513, '4.1', 'Penyebaran Islam di Tanah Arab'))
  P.push(sp(9512, 8110, '1.1.2', 'Menghuraikan ciri-ciri tamadun awal manusia.'))
  P.push(sp(9513, 9511, '2.1.1', 'Menerangkan kemunculan tamadun Hwang Ho dan Mesir Purba.'))
  P.push(sp(9514, 9511, '2.1.2', 'Menghuraikan sumbangan tamadun Hwang Ho dan Mesir Purba.'))
  P.push(sp(9515, 9512, '3.1.1', 'Menerangkan faktor kemunculan kerajaan awal Asia Tenggara.'))
  P.push(sp(9516, 9512, '3.1.2', 'Menghuraikan sistem pemerintahan kerajaan awal Asia Tenggara.'))
  P.push(sp(9517, 9512, '3.1.3', 'Menilai kemajuan kerajaan awal Asia Tenggara.'))
  P.push(sp(9518, 9513, '4.1.1', 'Menerangkan keadaan masyarakat Arab Jahiliah.'))
  P.push(sp(9519, 9513, '4.1.2', 'Menghuraikan penyebaran Islam di Tanah Arab.'))

  // Kimia T5 (10 / 11): Bidang 9021 "1.0" holds SP 9001–9004 and 8211; two more Bab follow.
  B.push(bidang(9514, 10, 11, '2.0', 'Termokimia'))
  B.push(bidang(9515, 10, 11, '3.0', 'Kimia Konsumer dan Industri'))
  K.push(sk(9514, 9514, '2.1', 'Perubahan haba dalam tindak balas'))
  K.push(sk(9515, 9515, '3.1', 'Minyak, lemak dan bahan pencuci'))
  K.push(sk(9516, 9515, '3.2', 'Bahan tambah makanan'))
  P.push(sp(9520, 9514, '2.1.1', 'Menjelaskan tindak balas eksotermik dan endotermik.'))
  P.push(sp(9521, 9514, '2.1.2', 'Menentukan haba tindak balas melalui eksperimen.'))
  P.push(sp(9522, 9514, '2.1.3', 'Menghuraikan aplikasi tindak balas eksotermik dan endotermik.'))
  P.push(sp(9523, 9515, '3.1.1', 'Menerangkan komposisi dan kegunaan minyak dan lemak.'))
  P.push(sp(9524, 9515, '3.1.2', 'Membandingkan keberkesanan sabun dan detergen.'))
  P.push(sp(9525, 9516, '3.2.1', 'Menjelaskan fungsi bahan tambah makanan.'))
}

/** SP ids of the three demo-standard subjects (M08 `DESIGNED_SP_PERFORMANCE` and the tests read them). */
export const DEMO_STANDARD_SP_IDS = {
  matematikT4: [8070, 9501, 9502, 9503, 9504, 9505, 9506, 9507, 9508, 9509, 9510, 9511],
  sejarahT4: [8110, 9512, 9513, 9514, 9515, 9516, 9517, 9518, 9519],
  kimiaT5: [8211, 9520, 9521, 9522, 9523, 9524, 9525],
} as const

/**
 * INFERRED filler SPs of XR-M08-M10-01 (M08 admin S7: BM 26 and SEJ 23 distinct SP records at the
 * T4 / T5 / Darjah 4 levels). Reserved id block 9401–9499 for SPs (SK ids 9053–9055): 9401, 9402 and 9403
 * are the Darjah 4 map tiles "2.1" / "3.1" (BM) and "2.1" (SEJ); BM T4 9411–9417 (SK 1.2–1.8),
 * 9421–9425 (SK 2.1, 3.4, 4.2, 5.1, 5.3); BM T5 9431–9433 (SK 1.1); SEJ T5 9441–9446 (SK 15.3),
 * 9451–9455 (SK 15.1), 9461–9464 (SK 15.2), 9471–9474 (SK 15.4). Codes continue each SK's own
 * numbering; the text is a deterministic "Standard Pembelajaran {code} — {subject}" line. The block starts at 9401 so it does not
 * collide with the M08 placeholders 9301+ until M08 switches to these ids.
 */
export const ADMIN_FILLER_SP_IDS = {
  bm: [
    9401, 9402, 9411, 9412, 9413, 9414, 9415, 9416, 9417, 9421, 9422, 9423, 9424, 9425, 9431, 9432,
    9433,
  ],
  sej: [
    9403, 9441, 9442, 9443, 9444, 9445, 9446, 9451, 9452, 9453, 9454, 9455, 9461, 9462, 9463, 9464,
    9471, 9472, 9473, 9474,
  ],
} as const

function addAdminFillers(out: DskpSeed): void {
  const { sk: K, sp: P } = out
  const filler = (id: number, skId: number, code: string, subject: string) =>
    P.push(sp(id, skId, code, `Standard Pembelajaran ${code} — ${subject}`))
  const BM_T4 = 'Bahasa Melayu Tingkatan 4'
  for (let n = 2; n <= 8; n++) filler(9409 + n, 9209 + n, `1.${String(n)}.1`, BM_T4)
  ;(
    [
      [9421, 9031, '2.1.2'],
      [9422, 9032, '3.4.2'],
      [9423, 9033, '4.2.2'],
      [9424, 9034, '5.1.1'],
      [9425, 9035, '5.3.1'],
    ] as const
  ).forEach(([id, skId, code]) => filler(id, skId, code, BM_T4))
  for (let i = 0; i < 3; i++)
    filler(9431 + i, 8031, `1.1.${String(i + 2)}`, 'Bahasa Melayu Tingkatan 5')
  const SEJ = 'Sejarah Tingkatan 5'
  K.push(sk(9053, 9052, '15.1', 'Kedudukan Malaysia dalam hubungan politik antarabangsa'))
  K.push(sk(9054, 9052, '15.2', 'Dasar luar Malaysia'))
  K.push(sk(9055, 9052, '15.4', 'Sumbangan Malaysia kepada keamanan dunia'))
  for (let i = 0; i < 6; i++) filler(9441 + i, 9051, `15.3.${String(i + 3)}`, SEJ)
  for (let i = 0; i < 5; i++) filler(9451 + i, 9053, `15.1.${String(i + 1)}`, SEJ)
  for (let i = 0; i < 4; i++) filler(9461 + i, 9054, `15.2.${String(i + 1)}`, SEJ)
  for (let i = 0; i < 4; i++) filler(9471 + i, 9055, `15.4.${String(i + 1)}`, SEJ)
}

/** SP ids that other modules name (M04 Q-SP-AVAILABLE, M08 S6/S7): they must all resolve. */
export const NAMED_SP_IDS: readonly number[] = [
  9001, 9002, 9003, 9004, 221, 206, 222, 214, 179, 194, 418, 6191,
]
