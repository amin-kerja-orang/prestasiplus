/**
 * The seeded DSKP records (SRS M10 v1.15 §6.9 "Seeded DSKP records read by other modules", XL2-20,
 * M04 v1.13 SQ-7): observed records keep their live ids and codes; "designed" ones are fixtures.
 *
 * Id blocks: observed live ids ≤ 6191; generic 8021–8551 (`8000 + 20 × subjectId + levelId`);
 * named designed 9001–9112; further designed fillers 9201–9299 (INFERRED, this file); teacher-created
 * rows ≥ 9,000,001 (`floor`).
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
      const tag = `${name} ${LEVEL_CODES[levelId] as string}`
      const isMathT4 = subjectId === 3 && levelId === 10
      B.push(bidang(id, subjectId, levelId, isMathT4 ? null : '1.0', `${tag} — fixture bidang`))
      K.push(sk(id, id, '1.1', `${tag} — fixture SK`))
      P.push(sp(id, id, '1.1.1', `${tag} — fixture SP`))
    }
  }

  // --- Kimia T5: SP 9001–9004 (M08 weak topics of class 2001) + the pair's generic SP 8211 --------
  B.push(bidang(9021, 10, 11, '1.0', 'Kimia T5 — fixture bidang'))
  K.push(sk(9011, 9021, '1.1', 'Kimia T5 — fixture SK'))
  P.push(sp(9001, 9011, '1.1.1', 'Sel Elektrolisis'))
  P.push(sp(9002, 9011, '1.1.2', 'Polimer'))
  P.push(sp(9003, 9011, '1.1.3', 'Siri Homolog'))
  P.push(sp(9004, 9011, '1.1.4', 'Getah Asli'))
  P.push(sp(8211, 9011, '1.1.5', 'Kimia T5 — fixture SP'))

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
  P.push(sp(8030, 8030, '1.1.1', 'Bahasa Melayu T4 — fixture SP'))
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
  K.push(sk(8031, 8031, '1.1', 'Bahasa Melayu T5 — fixture SK'))
  P.push(sp(8031, 8031, '1.1.1', 'Bahasa Melayu T5 — fixture SP'))

  // --- Sejarah T5: SP 418 (observed) + the pair's generic SP 8111 ---------------------------------
  B.push(bidang(9052, 5, 11, '15.0', 'Sejarah T5 — fixture bidang'))
  K.push(sk(9051, 9052, '15.3', 'Sejarah T5 — fixture SK'))
  P.push(
    sp(418, 9051, '15.3.2', 'Menerangkan peranan Malaysia dalam hubungan ekonomi antarabangsa.'),
  )
  P.push(sp(8111, 9051, '15.3.1', 'Sejarah T5 — fixture SP'))

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
  B.push(bidang(8024, 1, 4, '1.0', 'Bahasa Melayu D4 — fixture bidang'))
  K.push(sk(9101, 8024, '1.1', 'Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4'))
  K.push(sk(9102, 8024, '2.1', 'Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4'))
  K.push(sk(9103, 8024, '3.1', 'Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4'))
  P.push(sp(8024, 9101, '1.1', 'Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4'))
  P.push(sp(9401, 9102, '2.1', 'Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4'))
  P.push(sp(9402, 9103, '3.1', 'Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4'))
  B.push(bidang(8104, 5, 4, '1.0', 'Sejarah D4 — fixture bidang'))
  K.push(sk(9111, 8104, '1.1', 'Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4'))
  K.push(sk(9112, 8104, '2.1', 'Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4'))
  P.push(sp(8104, 9111, '1.1', 'Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4'))
  P.push(sp(9403, 9112, '2.1', 'Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4'))

  addAdminFillers(out)

  return out
}

/**
 * INFERRED filler SPs of XR-M08-M10-01 (M08 admin S7: BM 26 and SEJ 23 distinct SP records at the
 * T4 / T5 / Darjah 4 levels). Reserved id block 9401–9499 for SPs (SK ids 9053–9055): 9401, 9402 and 9403
 * are the Darjah 4 map tiles "2.1" / "3.1" (BM) and "2.1" (SEJ); BM T4 9411–9417 (SK 1.2–1.8),
 * 9421–9425 (SK 2.1, 3.4, 4.2, 5.1, 5.3); BM T5 9431–9433 (SK 1.1); SEJ T5 9441–9446 (SK 15.3),
 * 9451–9455 (SK 15.1), 9461–9464 (SK 15.2), 9471–9474 (SK 15.4). Codes continue each SK's own
 * numbering; the text is a deterministic placeholder. The block starts at 9401 so it does not
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
    P.push(sp(id, skId, code, `${subject} — SP ${code} (INFERRED filler)`))
  const BM_T4 = 'Bahasa Melayu T4'
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
  for (let i = 0; i < 3; i++) filler(9431 + i, 8031, `1.1.${String(i + 2)}`, 'Bahasa Melayu T5')
  const SEJ = 'Sejarah T5'
  K.push(sk(9053, 9052, '15.1', 'Sejarah T5 — fixture SK 15.1 (INFERRED filler)'))
  K.push(sk(9054, 9052, '15.2', 'Sejarah T5 — fixture SK 15.2 (INFERRED filler)'))
  K.push(sk(9055, 9052, '15.4', 'Sejarah T5 — fixture SK 15.4 (INFERRED filler)'))
  for (let i = 0; i < 6; i++) filler(9441 + i, 9051, `15.3.${String(i + 3)}`, SEJ)
  for (let i = 0; i < 5; i++) filler(9451 + i, 9053, `15.1.${String(i + 1)}`, SEJ)
  for (let i = 0; i < 4; i++) filler(9461 + i, 9054, `15.2.${String(i + 1)}`, SEJ)
  for (let i = 0; i < 4; i++) filler(9471 + i, 9055, `15.4.${String(i + 1)}`, SEJ)
}

/** SP ids that other modules name (M04 Q-SP-AVAILABLE, M08 S6/S7): they must all resolve. */
export const NAMED_SP_IDS: readonly number[] = [
  9001, 9002, 9003, 9004, 221, 206, 222, 214, 179, 194, 418, 6191,
]
