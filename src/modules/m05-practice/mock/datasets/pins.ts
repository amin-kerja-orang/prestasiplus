/**
 * Observed and pinned figures of the M05 answer log and session datasets (SRS M05 v1.16 §6.14.1,
 * §6.14.2), with the owner SRS each comes from. Values are literal; nothing here is tuned. Where
 * the SRS leaves a split open, the designed choice is marked **INFERRED** and kept minimal.
 */

// ---------------------------------------------------------------------------------------------
// Totals (§6.14.1)
// ---------------------------------------------------------------------------------------------

/** Q-ANS-ALL (M08 S1 "Soalan Dijawab"). */
export const ANSWERS_TOTAL = 478_499
/** Q-ANS-CORRECT (XL3-01 pin). */
export const ANSWERS_CORRECT = 396_391
/** Answers of P (active students outside the fixture schools; M17 Q-M17-ANS at the clock). */
export const P_ANSWERS = 477_743
/** Correct answers of P (M17 Q-M17-ACC 82.9 %). */
export const P_CORRECT = 395_873
/** Q-ANS-SEG (M11 S2 snapshot). */
export const SEGMENT_TOTAL = 472_371
/** Q-ANS-OTHER. */
export const OTHER_TOTAL = ANSWERS_TOTAL - SEGMENT_TOTAL
/** Q-ANS-NOSESSION (admin 35 + 3201–3215 6,563 + pupil 2022 6). */
export const SESSIONLESS_TOTAL = 6_604
/** Q-SESS-ALL (M08 S1 "Sesi Latihan"). */
export const SESSIONS_TOTAL = 32_122
/** Q-SESS-MEAN-ACC (all): M08 S1 "Purata Ketepatan" 79.8 % (XL3-02). */
export const SESSION_MEAN_ACC_ALL = 79.8

/** M11 period totals of the segment at the clock (7d, 30d, 3m; BR-M11-10). */
export const SEGMENT_PERIODS = { d7: 7_651, d30: 22_207, m3: 86_697 } as const

/** Non-P answers: anchors 333 + 423 free (M17 C-02). */
export const NON_P_TOTAL = ANSWERS_TOTAL - P_ANSWERS
/** Correct non-P answers: anchors 180 + free 338 (PROPOSED: 80 % of 423). */
export const NON_P_CORRECT = ANSWERS_CORRECT - P_CORRECT

/**
 * Generated answers of P outside the segment, by month (M17 C-11 "other-segment 1,360 / 1,873 /
 * 1,740 / 399 in May / Jul / Aug / Sep"; Σ 5,372).
 */
export const OTHER_P_BY_MONTH = { may: 1_360, jul: 1_873, aug: 1_740, sep: 399 } as const
export const OTHER_P_TOTAL = P_ANSWERS - SEGMENT_TOTAL

// ---------------------------------------------------------------------------------------------
// M17 activity pins over P at the clock (§6.14.1 "M17 activity pins")
// ---------------------------------------------------------------------------------------------

export const M17_PINS = {
  answers: { today: 340, week: 2_508, month: 20_206, all: P_ANSWERS },
  correct: { today: 264, week: 2_122, month: 17_667, all: P_CORRECT },
  engaged: { today: 4, week: 32, month: 86, all: 1_563 },
  sessions: { today: 17, week: 152, month: 1_250 },
} as const

/**
 * The 25 Sep sessions of M17 §6.7 B (school → [sessions, answers, correct]): pupil 2022 (8080)
 * 1 × 20, all correct; pupil 2016 (8082) 4 × 40 with 118 correct; pupils 2018 and 2019 (8106) 6
 * sessions each, 80 answers / 63 correct each, in `latih_tubi`. M17 contributes the anchors; the
 * generated rows fill the same cells until then.
 */
export const TODAY_BY_SCHOOL: Readonly<Record<number, readonly [number, number, number]>> = {
  8080: [1, 20, 20],
  8082: [4, 160, 118],
  8106: [12, 160, 126],
}
/** Distinct pupils answering today, per school (2022; 2016; 2018 and 2019). */
export const TODAY_USERS: Readonly<Record<number, number>> = { 8080: 1, 8082: 1, 8106: 2 }
/** Sessions of 8106 today are SPM `latih_tubi` (M17 §6.7 B). */
export const LATIH_TUBI_TODAY_SCHOOL = 8106

/**
 * M08 S20 / M16 S20 week participants (§6.14.1): 46 distinct users with ≥ 1 completed session
 * since Mon 21 Sep 00:00 = P engaged in the week (32) + 14 non-P users (the 8 designed users:
 * pelajar 2, pelajarmaju 4, M08's 3001, 3002, 3005–3008; and 6 more). **INFERRED:** the 6 are
 * generated non-P users (teachers), the only non-P users who may practise.
 */
export const WEEK_PARTICIPANTS = 46

// ---------------------------------------------------------------------------------------------
// Mission sessions (§6.14.1, M10 v1.7, R2-03)
// ---------------------------------------------------------------------------------------------

/** 8 existing sessions of class-813 members at 8082: [missionId, count, local date]. */
export const MISSION_SESSIONS: readonly (readonly [number, number, string])[] = [
  [7103, 5, '2026-09-08'],
  [7104, 3, '2026-09-22'],
]
export const MISSION_SCHOOL = 8082
/** BR-09: mission sessions pay 3 coins per correct answer (the one source of the rate). */
export const MISSION_COINS_PER_CORRECT = 3

/**
 * BR-09 (OBSERVED: S9 coins = "betul" on every live session): the coins stored on a session are the
 * correct answers, × 3 for a `mission` session. M14 credits the wallet with its own rate and returns
 * that value in the #6 response only (Delivery Lead, F-26 G4 MJ-1).
 */
export function sessionCoins(mode: string, correct: number): number {
  return mode === 'mission' ? correct * MISSION_COINS_PER_CORRECT : correct
}

// ---------------------------------------------------------------------------------------------
// Sessionless answers inside the segment (§6.14.1)
// ---------------------------------------------------------------------------------------------

/** 3201–3215 at 8880: 6,563 answers without a session, inside 8880's weekly cells (M18). */
export const SESSIONLESS_8880 = 6_563
/**
 * 8880 (M18 XR-M18-05, §6.11 C): the log holds 7,307 correct answers there (S9 calendar, S30 10,194 ×
 * 71.7 %); the 6,563 sessionless answers of 3201–3215 read 76.3 % (5,008 correct), which leaves 2,299
 * correct in the other 3,633 answers (= 485 in the 60 practice sessions + 1,814 in the latih_tubi
 * sessions of M18, contributed later). The 2 orphan answers are wrong (INFERRED).
 */
export const SCHOOL_8880_CORRECT = 7_307
export const SESSIONLESS_8880_CORRECT = 5_008

/** Pupil 2022 (8080): 6 answers without a session dated 2026-05-04 (week M12). */
export const SESSIONLESS_2022 = { schoolId: 8080, week: 12, count: 6 } as const
/** The admin's 35 answers of 2026-02-19 (live; anchors of this module). */
export const SESSIONLESS_ADMIN = 35

// ---------------------------------------------------------------------------------------------
// Session count design (INFERRED, the SRS gives only the totals and window pins)
// ---------------------------------------------------------------------------------------------

/**
 * Non-P sessions: the 12 canonical anchors (A2–A5, P1–P4, M1–M4) + M08 H01–H14 (14) + 28 generated
 * sessions for the 423 free non-P answers (≈ 15 per session, the platform mean). **INFERRED.**
 */
export const NON_P_SESSIONS = 12 + 14 + 28
/**
 * Generated sessions of P outside the segment (5,372 answers): ≈ 15 answers per session (the
 * platform mean). The week and month pins fix 4 in the week (60 answers) and 27 in the month.
 * **INFERRED.**
 */
export const OTHER_P_SESSIONS = 358
export const OTHER_P_WEEK_SESSIONS = 4
export const OTHER_P_MONTH_SESSIONS = 27

/**
 * Distinct users of P outside the segment (M17 engaged − M11 Aktif): all 1,563 − 1,462 = 101,
 * month 86 − 81, week 32 − 30. The mon week / month user totals (30 / 81) and the othP 7d / 30d /
 * 3m ladder rungs are **INFERRED** (no pin).
 */
export const OTHER_P_USERS = {
  today: 0,
  week: 2,
  d7: 3,
  month: 5,
  d30: 6,
  m3: 40,
  all: 101,
} as const
export const SEGMENT_WEEK_USERS = 30
export const SEGMENT_MONTH_USERS = 81

// ---------------------------------------------------------------------------------------------
// Pupil 4627 (M02 v1.26, class 1156, school 8082, T5; XR-M02-06) is seeded (F-26c): sessions K01-K03
// (`repository/class1156.ts`, anchors inside 8082's cells, session mean 58.6 %) and 19 mastery rows
// (mean level 3.95, `datasets/m18-anchors.ts`). No count moves.
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Per-school accuracy and the named pupils of M17 (XR-M17-02; decision of the Delivery Lead)
// ---------------------------------------------------------------------------------------------

/**
 * M17 §6.7 C accuracies over the M11 cell totals (Delivery Lead: M11 wins on the answers, so 8082 reads
 * 130,233 and 8080 53,494 answers): 8082 82.3 % = 107,171 correct, 8080 81.7 % = 43,704 correct. The correct
 * answers come out of the old cells of both schools and go to the old cells of the other segment schools
 * (none of which has an observed accuracy); every window total (today / week / month) and the P total stay.
 * This replaces the AUD-04 drift note (the 8880 attribution had raised both schools by 0.24 points).
 */
export const SCHOOL_CORRECT: Readonly<Record<number, number>> = { 8082: 107_171, 8080: 43_704 }
/**
 * Correct answers of the rest of the calendar week (week 32, band 1) per school, from M17 §6.7 B (week
 * 8080 552 · 92.8 % = 512 less today's 20; 8106 507 · 78.7 % = 399 less today's 126), so that the named pupils
 * fit. 8082's month part (bands 2-3): 8,298 · 90.9 % = 7,543 less its week 838 = 6,705.
 */
export const WEEK_REST_CORRECT: Readonly<Record<number, number>> = { 8080: 492, 8106: 273 }
export const MONTH_REST_CORRECT_8082 = 6_705
/** Pupil 2022's 6 sessionless answers hold 1 correct answer (its sessions read 93.7 %, the pupil 93.5 %). */
export const SESSIONLESS_2022_CORRECT = 1
