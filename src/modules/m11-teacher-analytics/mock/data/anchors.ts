/**
 * The S4 / S5 anchors of school 8080 (SRS M11 v1.10 §6.7 "School 8080 anchors"; M04 §6.13.2 row
 * "M11 anchors"): the three pupils whose S4 pages are observed — Student A (2008), Student B (2002),
 * Student C (2010) — and the other anchors whose S5 row (Soalan · Ketepatan) is observed: D (2003),
 * E (2006), F (2001), G (2004), I (2007), J (2009).
 *
 * A pupil's answers are a list of **runs**, newest first: one subject × chapter label (and, for A, one
 * topic), answered in one practice session ending at `end`. Question ids are assigned newest first from
 * the M04 block 700401–700931 (A 700401–700471, B 700472–700666, C 700667–700931: one question per
 * observed answer of A, B and C, as M04 §6.13.2 allocates); D … J reuse those T5 questions (their
 * contents are unobserved).
 *
 * OBSERVED: the totals per pupil, subject, chapter label and topic (A's 18 topic rows), the last
 * activity of A, B, C, D and E, the first eight rows of A (text prefix, letters, two full questions).
 * INFERRED: every other timestamp, the order of the runs, the topic of B and C (none: "Umum"), the
 * options and texts of unobserved questions; all `observed:false`.
 */

export const SUBJECT = {
  bm: 1,
  bi: 2,
  math: 3,
  sains: 4,
  sejarah: 5,
  pi: 6,
  fizik: 9,
  bio: 11,
} as const

/** M03 level ids: T1 7 … T5 11. */
export const T5 = 11
export const T4 = 10
export const T3 = 9
export const T2 = 8
export const T1 = 7

/** A topic of M03 by chapter number and name (resolved when the seed runs). */
export interface TopicRef {
  bab: number
  name: string
}

export interface RunAnswer {
  ok: boolean
  topic?: TopicRef
  /** The observed student pick (index) and key (index), A's first rows only. */
  pick?: number
  key?: number
}

export interface Run {
  subjectId: number
  levelId: number
  label: string | null
  /** ISO time of the newest answer of the run. */
  end: string
  /** Seconds between two answers of the run (newest first). */
  step: number
  /** Newest first. */
  answers: RunAnswer[]
}

export interface PupilAnchor {
  userId: number
  /** Session id prefix (two capital letters). */
  key: string
  runs: Run[]
}

/** `n` answers with `c` correct, spread deterministically (a Bresenham-style spread). */
export function spread(n: number, c: number, topic?: TopicRef): RunAnswer[] {
  const out: RunAnswer[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += c
    const ok = acc >= n
    if (ok) acc -= n
    out.push(topic ? { ok, topic } : { ok })
  }
  return out
}

const t = (bab: number, name: string): TopicRef => ({ bab, name })
const one = (topic: TopicRef | undefined, ok: boolean): RunAnswer =>
  topic ? { ok, topic } : { ok }

// --- Student A (2008): 71 answers, 53 correct; BM 31/31, Sejarah 16/25, BI 6/15 -----------------------

const W = t(1, 'Warisan Negara Bangsa')
const LOKASI = t(3, 'Lokasi Zaman Prasejarah di Dunia')
const PENTADBIRAN = t(6, 'Pentadbiran Barat Berkaitan dengan Ekonomi')
const PTM = t(1, 'Persekutuan Tanah Melayu 1948')
const TAMADUN = t(1, 'Kemunculan tamadun awal')

/** The 8 observed rows (student pick / key letters A…D → 0…3, SRS §6.7) then the rest, newest first. */
const A_SEJARAH: RunAnswer[] = [
  { ok: false, topic: W, pick: 0, key: 3 },
  { ok: false, topic: W, pick: 2, key: 1 },
  { ok: false, topic: W, pick: 2, key: 1 },
  { ok: false, topic: W, pick: 1, key: 3 },
  { ok: true, topic: W, pick: 3, key: 3 },
  { ok: false, topic: W, pick: 1, key: 0 },
  { ok: true, topic: W, pick: 2, key: 2 },
  { ok: true, topic: W, pick: 0, key: 0 },
  // Rows 9–23: Warisan 12 (9 ✓ 3 ✗), Lokasi 2 ✓, Pentadbiran 1 ✓.
  one(W, true),
  one(LOKASI, true),
  one(W, false),
  one(W, true),
  one(W, true),
  one(PENTADBIRAN, true),
  one(W, true),
  one(W, false),
  one(W, true),
  one(W, true),
  one(LOKASI, true),
  one(W, true),
  one(W, false),
  one(W, true),
  one(W, true),
  // Rows 24–25 (the two oldest, which fixes the topic row order K, P, W).
  one(PTM, true),
  one(TAMADUN, false),
]

/** BM (31 ✓), newest first; the oldest topic comes first on S4 (SULUH, Kemahiran, Penulisan …). */
const A_BM: RunAnswer[] = [
  one(
    t(
      99,
      'Mendengar, mengenal dan menyebut perkataan, rangkai kata, istilah dan ungkapan serta intonasi ayat dalam pelbagai ujaran.',
    ),
    true,
  ),
  one(t(13, 'Cergas Aktif'), true),
  one(t(10, 'SAINS DAN TEKNOLOGI PEMACU'), true),
  one(t(9, 'INDAH SENI, ENDAH BUDAYA'), true),
  one(t(5, 'Dunia Baharu Tani'), true),
  one(t(4, 'WASPADA SELALU!'), true),
  one(t(3, 'KECERDASAN MENINGKAT,'), true),
  one(t(3, 'Tatabahasa'), true),
  one(t(1, 'Penulisan karangan lanjutan'), true),
  ...Array.from({ length: 21 }, () => one(t(1, 'Kemahiran Membaca dan Memahami'), true)),
  one(t(1, 'SULUH MASA DEPAN'), true),
]

export const STUDENT_A: PupilAnchor = {
  userId: 2008,
  key: 'XA',
  runs: [
    {
      subjectId: SUBJECT.sejarah,
      levelId: T5,
      label: 'Sejarah Tingkatan 5 KSSM',
      end: '2026-06-16T14:19:57+08:00',
      step: 12,
      answers: A_SEJARAH,
    },
    {
      subjectId: SUBJECT.bm,
      levelId: T5,
      label: 'Bahasa Melayu Tingkatan 5',
      end: '2026-06-15T16:30:00+08:00',
      step: 15,
      answers: A_BM,
    },
    {
      subjectId: SUBJECT.bi,
      levelId: T5,
      label: 'Bahasa Inggeris Tingkatan 5',
      end: '2026-06-15T09:30:00+08:00',
      step: 20,
      // "Reading for main ideas" 4/5.
      answers: spread(5, 4, t(1, 'Reading for main ideas')),
    },
    {
      subjectId: SUBJECT.bi,
      levelId: T5,
      label: null,
      end: '2026-06-15T09:00:00+08:00',
      step: 20,
      // Umum 2/10 (no label, no topic).
      answers: spread(10, 2),
    },
  ],
}

// --- Student B (2002): 195 answers, 150 correct ---------------------------------------------------------

const run = (
  subjectId: number,
  levelId: number,
  label: string | null,
  end: string,
  n: number,
  c: number,
  step = 10,
): Run => ({ subjectId, levelId, label, end, step, answers: spread(n, c) })

export const STUDENT_B: PupilAnchor = {
  userId: 2002,
  key: 'XB',
  runs: [
    run(SUBJECT.bio, T5, 'Biologi Tingkatan 5', '2026-07-05T06:13:00+08:00', 75, 61),
    run(SUBJECT.sejarah, T5, 'Sejarah Tingkatan 5 KSSM', '2026-07-04T20:00:00+08:00', 40, 35),
    run(SUBJECT.bm, T5, 'Bahasa Melayu Tingkatan 5', '2026-07-03T20:00:00+08:00', 30, 28),
    run(SUBJECT.bm, T5, 'Kemahiran Bahasa Tingkatan 5', '2026-07-03T19:00:00+08:00', 4, 0),
    run(SUBJECT.bm, T4, 'Kemahiran Bahasa Tingkatan 4', '2026-07-03T18:00:00+08:00', 1, 0),
    run(SUBJECT.pi, T5, 'Pendidikan Islam Tingkatan 5', '2026-07-02T20:00:00+08:00', 20, 19),
    run(SUBJECT.fizik, T5, null, '2026-07-01T20:00:00+08:00', 15, 5),
    run(SUBJECT.math, T5, null, '2026-06-30T20:00:00+08:00', 10, 2),
  ],
}

// --- Student C (2010): 265 answers, 168 correct ---------------------------------------------------------

export const STUDENT_C: PupilAnchor = {
  userId: 2010,
  key: 'XC',
  runs: [
    run(SUBJECT.sejarah, T5, 'Sejarah Tingkatan 5 KSSM', '2026-06-27T14:24:00+08:00', 18, 7),
    run(SUBJECT.sejarah, T4, 'Sejarah Tingkatan 4', '2026-06-27T12:00:00+08:00', 12, 6),
    run(SUBJECT.sejarah, T3, 'Sejarah Tingkatan 3', '2026-06-27T10:00:00+08:00', 75, 50),
    run(SUBJECT.bi, T5, null, '2026-06-26T21:00:00+08:00', 40, 15),
    run(SUBJECT.bio, T4, 'Biologi Tingkatan 4', '2026-06-26T20:00:00+08:00', 15, 10),
    run(SUBJECT.pi, T5, 'Pendidikan Islam Tingkatan 5', '2026-06-26T19:00:00+08:00', 50, 42),
    run(SUBJECT.math, T5, 'Matematik Tingkatan 5', '2026-06-26T18:00:00+08:00', 5, 5),
    run(SUBJECT.sains, T5, 'Sains Tingkatan 5', '2026-06-26T17:00:00+08:00', 10, 3),
    run(SUBJECT.sains, T4, 'Sains Tingkatan 4', '2026-06-26T16:30:00+08:00', 9, 4),
    run(SUBJECT.sains, T3, 'Sains Tingkatan 3', '2026-06-26T16:20:00+08:00', 2, 0),
    run(SUBJECT.sains, T2, 'Sains Tingkatan 2', '2026-06-26T16:10:00+08:00', 3, 1),
    run(SUBJECT.sains, T1, 'Sains Tingkatan 1', '2026-06-26T16:00:00+08:00', 26, 25),
  ],
}

/** The pupils whose S4 question block is M04's 700401–700931 (ids assigned newest first, A then B then C). */
export const QUESTION_PUPILS: readonly PupilAnchor[] = [STUDENT_A, STUDENT_B, STUDENT_C]

/** First id of the M11 anchor block (M04 §6.13.2: 700401–700931, 531 questions). */
export const QUESTION_BLOCK_START = 700401
export const QUESTION_BLOCK_SIZE = 531

/**
 * The other 8080 anchors with an observed S5 row `[userId, answers, correct, last activity]` (SRS §6.7;
 * F, G, I, J: last activity unobserved, INFERRED in week M18).
 */
export const OTHER_ANCHORS: readonly (readonly [string, number, number, number, string])[] = [
  ['XD', 2003, 40, 21, '2026-06-16T02:32:00+08:00'],
  ['XE', 2006, 20, 11, '2026-05-21T02:40:00+08:00'],
  ['XF', 2001, 100, 100, '2026-06-17T09:00:00+08:00'],
  ['XG', 2004, 171, 108, '2026-06-17T14:00:00+08:00'],
  ['XI', 2007, 190, 142, '2026-06-18T10:00:00+08:00'],
  ['XJ', 2009, 258, 196, '2026-06-18T16:00:00+08:00'],
]

/** First answer id of the M11 anchors (M05 anchor ids 510,001–999,999; M08 uses 510,001 upward). */
export const ANSWER_ID_START = 950_001

/**
 * A's question rows 1–8 (observed prefixes, letters in `A_SEJARAH`), by newest-first index. `text` is the
 * observed text or its observed prefix completed (`observed:false`); `options` are given when observed.
 */
export const A_OBSERVED_QUESTIONS: readonly {
  text: string
  options?: readonly string[]
  explanation?: string
  source?: string
  difficulty?: number
}[] = [
  {
    text: 'Apakah ciri negara berdaulat? I II III IV Pentadbiran yang sistematik Sempadan yang jelas Rakyat berbilang kaum Naungan kerajaan lain',
    options: ['I dan IV', 'II dan III', 'III dan IV', 'I dan II'],
    explanation:
      '[AI-repaired 2026-04-22] Ciri negara berdaulat termasuk pentadbiran yang sistematik dan sempadan yang jelas. Rakyat berbilang kaum tidak semestinya menjadi ciri utama, dan naungan kerajaan lain menunjukkan ketidakberdaulatan.',
    source: 'Percubaan SPM 2025 Sejarah Melaka',
    difficulty: 2,
  },
  {
    text: 'Apakah ciri Moden Perlembangaan Persekutuan?',
    options: [
      'Pilihan A',
      'Sarawak dan Sabah diberi beberapa autonomi',
      'Keberkesanan pentadbiran',
      'Pilihan D',
    ],
    explanation:
      'Jawapan yang betul ialah Sarawak dan Sabah diberi beberapa autonomi. Pilihan ini paling tepat kerana sepadan dengan konsep yang diuji dalam soalan.',
    source: 'Percubaan SPM 2025 Sejarah Johor Muar',
    difficulty: 2,
  },
  { text: 'Senarai Negeri memperuntukkan kuasa Kerajaan Negeri. Apakah kuasa yang diperuntukkan?' },
  { text: 'Apakah faktor yang menamatkan konfrontasi Indonesia terhadap Malaysia?' },
  { text: 'OIC (Pertubuhan Kerjasama Islam) adalah pertubuhan yang' },
  {
    text: 'Struktur organisasi berikut berkaitan dengan pentadbiran Kerajaan Persekutuan. Apakah fungsinya?',
  },
  {
    text: 'Apakah kepentingan perayaan bersama seperti Hari Raya, Tahun Baru Cina, dan Deepavali?',
  },
  { text: 'Apakah ciri-ciri tradisional dalam Perlembagaan Persekutuan?' },
]
