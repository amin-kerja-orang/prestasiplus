/**
 * Level and class cells of the generated sessions (SRS M05 v1.17 §6.14.1 "Level cells" and "Class
 * cells"; M08 §6.3, §6.10; M10 v1.12 §6.2.1 "Session neutrality", R4-01 / R5-01). The prime places the
 * generated sessions on the M10 class members so that M08's cards read these values (F-26c
 * alignment). Values are literal.
 */

/** Sessions of distinct T4-class members: exactly these 11, all held by H1–H4 (no other T4 member). */
export const T4_SESSIONS = 11
/** Sessions of distinct T5-class members (M08 T5 card, Q-SESS-LEVEL(T5)) and their session mean. */
export const T5_SESSIONS = 29_971
/** Q-SESS-MEAN-ACC(T5) = 79.7 % (display: one decimal). */
export const T5_MEAN_TENTHS = 797

/**
 * The exact session lists of the four T4 holders (M10 v1.12 §6.2.1): [holder 0…3 = H1…H4, correct,
 * questions]. H1 (classes 6/10) 0/7, 5/7, 11/13, 33/33; H2 (5/9) 10/10, 9/10, 9/10; H3 (5/9) 4/5, 4/6;
 * H4 (5/9) 3/15, 0/20.
 */
export const T4_HOLDER_SESSIONS: readonly (readonly [
  holder: 0 | 1 | 2 | 3,
  correct: number,
  questions: number,
])[] = [
  [0, 0, 7],
  [0, 5, 7],
  [0, 11, 13],
  [0, 33, 33],
  [1, 10, 10],
  [1, 9, 10],
  [1, 9, 10],
  [2, 4, 5],
  [2, 4, 6],
  [3, 3, 15],
  [3, 0, 20],
]

/**
 * The 10 T5 pupils of M08 "Murid Terbaik" (live order; every session fully correct, so a session
 * mean of 100 %; live shows 126.7 % … 103.1 %, a data fault shown "100%"): [sessions, questions]. Their
 * seeded user ids ascend in this order.
 */
export const T5_TOP_ROWS: readonly (readonly [sessions: number, questions: number])[] = [
  [3, 15],
  [4, 50],
  [6, 60],
  [3, 84],
  [5, 30],
  [3, 114],
  [5, 100],
  [6, 55],
  [3, 35],
  [13, 295],
]

/**
 * Class 228 "ALFA - Bahasa Inggeris" (93 members, 8082; M08 §6.3): 1,618 sessions, 34,882 answers,
 * 77.6 % per answer, 10.4 minutes per session, 2 members with a session in the last 7 days.
 */
export const CLASS_228 = {
  id: 228,
  school: 8082,
  sessions: 1_618,
  answers: 34_882,
  accuracyTenths: 776,
  /** Mean time per session in seconds: 10.4 min. */
  meanSeconds: 624,
  active7d: 2,
  /**
   * S5 "Perlu Perhatian (57)" (M08 BR-M08-10 / FR-M08-34): 11 members with accuracy < 50 % and 46 members
   * without a session ("Belum mula berlatih"; every session of the class is in its subject, so none in
   * the class subject = none at all). 93 members = 36 + 11 + 46. The total 57 is OBSERVED on live (S5, class
   * "UDL749"); the 11 / 46 split is an INFERRED generation choice (only the first three rows are observed,
   * `ATTENTION_ANCHORS`).
   */
  under50: 11,
  idle: 46,
  /** Class subject (M03 Bahasa Inggeris) and its tested questions (M08 §6.10, BR-M08-18). */
  subject: 2,
  questions: 596,
  difficulty: { mudah: 381, sederhana: 78, sukar: 137 },
} as const

/**
 * The first three rows of the class-228 attention list, OBSERVED on live (discovery M08 S5-prestasi-kelas,
 * docs/discovery/M08-student-performance.md lines 1218-1224): "3 sesi · 48.3%", "2 sesi · 45%",
 * "5 sesi · 44.6%" (accuracy descending, which is the list order). `tenths` = the accuracy shown at one
 * decimal, times ten. They are pinned to the first three of the 11 weak members in M05 pool order.
 */
export const ATTENTION_ANCHORS = [
  { sessions: 3, tenths: 483 },
  { sessions: 2, tenths: 450 },
  { sessions: 5, tenths: 446 },
] as const

/**
 * The first three rows of the class-228 item analysis (S11), OBSERVED on live (discovery M08 S11-analisa-item-kelas,
 * docs/discovery/M08-student-performance.md lines 1379-1382): Indeks 1.00, Ketepatan 0.0 %, "2 pelajar salah" /
 * "2 pelajar salah" / "1 pelajar salah" over 2 / 2 / 1 attempts by as many pupils. The ids are the M04 anchors
 * 129601-129603 (ascending, so BR-M08-18's tie-break by id lists them in this order); every attempt is wrong.
 */
export const CLASS_228_TOP_QUESTIONS = [
  { id: 129601, attempts: 2 },
  { id: 129602, attempts: 2 },
  { id: 129603, attempts: 1 },
] as const

/**
 * The two "Prestasi Guru" cards of the M08 S1 page that M10 designs (`classrooms.designation().teacherCards`),
 * OBSERVED on live (docs/discovery/M08-student-performance.md lines 1110-1113): "2 kelas · 76 murid" 72.5 % and
 * "3 kelas · 89 murid" 72.7 %. Keyed by the card's pupil count; the value is the accuracy at one decimal, times
 * ten. M08 shows the mean of the session accuracies of the pupils of the teacher's classes (BR-M08-07 / DV).
 * The mock reproduces the figure by shaping the pupils' sessions (`buildPracticePrime`).
 */
export const TEACHER_CARD_ACCURACY: Readonly<Record<number, number>> = { 76: 725, 89: 727 }
/** INFERRED: pupils that hold the sessions of a card whose pupils hold none (the rest stay without a session). */
export const TEACHER_CARD_MIN_PUPILS = 3
