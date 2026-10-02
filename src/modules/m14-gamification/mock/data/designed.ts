/**
 * Account seeds of M14 (SRS M14 v1.7 §6.11.2 admin mirror, §6.11.3 designed accounts, §6.11.5
 * teacher wallets and cash requests). Every person is fictitious (CLAUDE.md §6).
 *
 * The designed sessions are the M05 §6.12 sessions P1–P4 (pelajar, account 2) and M1–M4
 * (pelajarmaju, account 4). M14 does **not** read them from M05 at seed time: the seed replays them
 * through the runtime engine (`../seeds/replay.ts`) to compute the designed wallets and ledgers.
 * F-26 must seed exactly these sessions (same `completedAt`, mode, correct / total, `timeSpent` in
 * seconds, and for M3 / M4 answers on the chapters listed) and must not call
 * `gamification.onSessionCompleted` for them.
 */

import type { DaySession } from '../repository/engine'

/** M03 ids of MATH D1 Bab 1–3 (M03 fixture: chapterNumber 1 → 1, 2 → 143, 3 → 136). */
export const MATH_D1_CHAPTERS = { bab1: 1, bab2: 143, bab3: 136 } as const

export interface DesignedSession extends DaySession {
  userId: number
  completedAt: string
  /** M05 BR-09: 10 points per correct answer. */
  pointsEarned: number
  /** Chapters of the session's answers (SPM pool questions have none). */
  chapterIds: readonly number[]
}

const s = (
  userId: number,
  sessionId: string,
  completedAt: string,
  mode: string,
  total: number,
  correct: number,
  timeSpent: number,
  chapterIds: readonly number[] = [],
): DesignedSession => ({
  userId,
  sessionId,
  completedAt,
  mode,
  total,
  correct,
  timeSpent,
  pointsEarned: 10 * correct,
  chapterIds,
})

const { bab1, bab2, bab3 } = MATH_D1_CHAPTERS

/** M05 §6.12 sessions of accounts 2 and 4, in completion order. */
export const DESIGNED_SESSIONS: readonly DesignedSession[] = [
  s(2, 'P1', '2026-09-22T19:00:00+08:00', 'past_year', 10, 4, 300),
  s(2, 'P2', '2026-09-24T20:15:00+08:00', 'latih_tubi', 34, 26, 360),
  s(2, 'P3', '2026-09-24T20:40:00+08:00', 'past_year', 10, 6, 270),
  s(2, 'P4', '2026-09-25T08:30:00+08:00', 'ramalan', 40, 34, 900),
  s(4, 'M1', '2026-09-23T16:10:00+08:00', 'chapter', 10, 8, 260, [bab1]),
  s(4, 'M2', '2026-09-24T17:05:00+08:00', 'chapter', 10, 9, 230, [bab1]),
  s(4, 'M3', '2026-09-25T09:15:00+08:00', 'random', 10, 6, 310, [bab2, bab3]),
  s(4, 'M4', '2026-09-25T10:00:00+08:00', 'revision', 7, 3, 150, [bab1, bab2, bab3]),
]

/** Designed wallet fields that the replay does not compute (level stored, createdAt). */
export const DESIGNED_WALLETS: Readonly<Record<number, { level: number; ledgerIdStart: number }>> =
  {
    2: { level: 1, ledgerIdStart: 140_101 },
    4: { level: 3, ledgerIdStart: 140_201 },
  }

/** §6.11.2: the admin's wallet (observed). */
export const ADMIN_WALLET = {
  id: 1,
  userId: 1,
  tierKey: 'bronze',
  currentSyiling: 256,
  totalSyilingEarned: 256,
  tokenBalance: 0,
  xp: 8,
  level: 2,
  createdAt: '2026-02-11T05:23:00+08:00',
} as const

/** §6.11.2: the admin's 14 ledger rows, oldest first, ids 140001–140014 (observed values). */
export const ADMIN_LEDGER: readonly (readonly [string, string, string, number])[] = [
  ['2026-02-11T05:23:00+08:00', 'legacy', 'Cabaran Kilat: 3 betul, combo 2x', 4],
  ['2026-02-19T21:47:00+08:00', 'legacy', 'Betul/Salah: 3 betul, streak 2', 4],
  [
    '2026-02-19T23:12:00+08:00',
    'legacy',
    'One-time sync: transfer missing coins from legacy student_coins table',
    35,
  ],
  ['2026-05-11T14:22:00+08:00', 'quiz_spm', 'Latih Tubi SPM: 14 betul — 35%', 42],
  ['2026-05-11T14:22:00+08:00', 'spm', 'Streak activity (spm)', 7],
  ['2026-05-11T14:22:00+08:00', 'daily_challenge', 'Cabaran selesai: Mula Hari Ini', 10],
  ['2026-05-11T14:22:00+08:00', 'daily_challenge', 'Cabaran selesai: Kilat Matematik', 30],
  ['2026-05-11T14:22:00+08:00', 'daily_challenge', 'Cabaran selesai: Jawab 5 Betul', 12],
  ['2026-05-11T14:27:00+08:00', 'quiz_spm', 'Latih Tubi SPM: 11 betul — 32.35%', 22],
  ['2026-05-11T14:27:00+08:00', 'daily_challenge', 'Cabaran selesai: Rajin Berlatih', 15],
  ['2026-05-11T14:27:00+08:00', 'daily_challenge', 'Cabaran selesai: Cabaran Kilat', 40],
  ['2026-05-19T03:26:00+08:00', 'quiz_spm', 'SPM Tahun Lepas: 1 betul — 20%', 3],
  ['2026-05-19T03:26:00+08:00', 'spm', 'Streak activity (spm)', 7],
  ['2026-05-19T03:26:00+08:00', 'daily_challenge', 'Cabaran selesai: Penjelajah Topik', 25],
]

/** §6.11.2: admin streak (observed). */
export const ADMIN_STREAK = { current: 1, best: 5, lastActivityDate: '2026-05-19', totalDays: 0 }

/** §6.11.2: admin's historical challenge completions (11/05: 5, 4, 6, 1, 10; 19/05: 3). */
export const ADMIN_COMPLETIONS: readonly (readonly [string, number])[] = [
  ['2026-05-11T14:22:00+08:00', 5],
  ['2026-05-11T14:22:00+08:00', 4],
  ['2026-05-11T14:22:00+08:00', 6],
  ['2026-05-11T14:27:00+08:00', 1],
  ['2026-05-11T14:27:00+08:00', 10],
  ['2026-05-19T03:26:00+08:00', 3],
]

/**
 * §6.11.2: the admin's teacher ledger, 18 rows oldest first (Σ 92,683). Row ids 1–18 are designed
 * (live ids unobserved).
 */
export const ADMIN_TEACHER_LEDGER: readonly (readonly [string, string, number])[] = [
  ['2026-02-06T16:26:00+08:00', 'Latihan - 60% ketepatan', 3],
  ['2026-02-19T22:23:00+08:00', 'Latihan - 30% ketepatan', 3],
  ['2026-02-19T22:27:00+08:00', 'Latihan - 20% ketepatan', 2],
  ['2026-02-19T22:39:00+08:00', 'Latihan - 100% ketepatan', 15],
  ['2026-02-19T22:48:00+08:00', 'Latihan - 100% ketepatan', 20],
  ['2026-03-21T23:02:00+08:00', 'Badge: Penyumbang Baru (10 soalan)', 100],
  ['2026-03-21T23:02:00+08:00', 'Badge: Penyumbang Aktif (100 soalan)', 500],
  ['2026-03-21T23:02:00+08:00', 'Badge: Penyumbang Dedikasi (500 soalan)', 2000],
  ['2026-03-21T23:02:00+08:00', 'Badge: Penyumbang Cemerlang (1000 soalan)', 5000],
  ['2026-03-21T23:02:00+08:00', 'Badge: Penyumbang Terbilang (2500 soalan)', 10000],
  ['2026-03-21T23:02:00+08:00', 'Badge: Legenda Soalan (5000 soalan)', 25000],
  ['2026-03-21T23:02:00+08:00', 'Badge: Guru Maestro (10000 soalan)', 50000],
  ['2026-05-11T14:22:00+08:00', 'Latih Tubi SPM - 35% ketepatan', 14],
  ['2026-05-11T14:22:00+08:00', 'Aktiviti harian: spm', 7],
  ['2026-05-11T14:27:00+08:00', 'Latih Tubi SPM - 32.35% ketepatan', 11],
  ['2026-05-19T03:26:00+08:00', 'SPM Tahun Lepas - 20% ketepatan', 1],
  ['2026-05-19T03:26:00+08:00', 'Aktiviti harian: spm', 7],
  ['2026-05-19T03:49:00+08:00', 'SPM Tahun Lepas - 0% ketepatan', 0],
]

/** Designed creation time of seeded teacher wallets whose date is unobserved (INFERRED). */
const TEACHER_WALLET_CREATED = '2026-02-06T16:26:00+08:00'

/**
 * §6.11.5 teacher wallets (questionsCount, balance). 1: observed; 5: the M10 contribution 700302;
 * 4201–4206 observed on S22 (4202 = the M17 Guru-tab row <teacher:137>, placed at 8087 by M02
 * v1.25; wallet unchanged); 4207 / 4208 designed (the minimum that lets their PENDING requests
 * exist). `totalEarned` = balance (INFERRED: no debit was observed).
 */
export const SEED_TEACHER_WALLETS: readonly (readonly [number, number, number])[] = [
  [1, 20_719, 92_683],
  [5, 1, 0],
  [4201, 3_906, 20_720],
  [4202, 1_559, 0],
  [4203, 256, 0],
  [4204, 1, 10],
  [4205, 0, 110],
  [4206, 0, 2],
  [4207, 0, 18_140],
  [4208, 0, 163_445],
]
export { TEACHER_WALLET_CREATED }

/**
 * §6.11.5 (v1.6–v1.7, XL3 Addendum B-01): the fixture teacher **5316** (M02 v1.24; no school, never
 * logged in) is the observed M17 Guru-tab row `<teacher:101>` — balance and totalEarned **42,600**,
 * `questionsCount` 0 (its M04 contributions are imported rows, not contribution events).
 */
export const FIXTURE_TEACHER_WALLET = { userId: 5316, balance: 42_600 } as const

/**
 * §6.11.5 (v1.6): two designed wallets (unobserved) on the two highest-id generated active teachers
 * with `questionsCount` 0 outside the fixture schools, balances in descending id order. Σ with
 * 5316 = 42,617, so Σ over active non-fixture teachers stays 63,459 (M17 Q-M17-TEACHER-COINS).
 */
export const DESIGNED_EXTRA_TEACHER_BALANCES: readonly number[] = [9, 8]

/** §6.11.5 cash requests 1–2 (fictitious bank data; returned masked). */
export const SEED_CASH_REQUESTS = [
  {
    id: 1,
    userId: 4208,
    coins: 163_445,
    cashSen: 130_756,
    bankName: 'Maybank',
    bankAccount: '5140 2233 8819',
    accountHolder: 'Cikgu Demo Tunai Dua',
    status: 'PENDING',
    adminNote: null,
    createdAt: '2026-04-14T23:04:00+08:00',
    paidDebited: false,
  },
  {
    id: 2,
    userId: 4207,
    coins: 18_140,
    cashSen: 14_512,
    bankName: 'Bank Rakyat',
    bankAccount: '2201 7788 1100',
    accountHolder: 'Cikgu Demo Tunai Satu',
    status: 'PENDING',
    adminNote: null,
    createdAt: '2026-04-15T13:15:00+08:00',
    paidDebited: false,
  },
] as const
