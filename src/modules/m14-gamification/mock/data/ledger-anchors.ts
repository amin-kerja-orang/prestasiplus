/**
 * Ledger anchors with live ids (SRS M14 v1.7 §6.11.1; values from the live snapshot
 * `_snapshot-2026-09-26.json`, transcribed; the app never imports `docs/`):
 * - S5 page 1 at the project clock, #53668 … #53654 (15 rows; the 10 rows stored after the clock,
 *   #53669–#53678, are **not** seeded — clock treatment);
 * - the S5 convert filter page 1 (25 rows, #53663 … #52427);
 * - #42 (the only spend row), #51 and #44 (the only bonus rows);
 * - S5 page 2118 (#44, #39 … #15 as listed).
 *
 * The live rows show no user (the snapshot masks it). **INFERRED owners** (review MINOR-7):
 * - Rows chain to one user when their balances chain (+3 → 5,813 after +2 → 5,810; 80 → 88 → 93
 *   → 103; +2 → 401 then −400 → 1; the Papan Bijak chains of page 2118).
 * - A row later than the newest generated row (12:19 on 25/09) is the owner's last row before the
 *   clock, so the owner's balance at the clock **equals** its "Baki": such rows go to users whose
 *   balance matches — observed (4004 = 129, 4046 = 3,010) or a chosen "gen." balance of platinum
 *   anchors 4021–4027 (`./wallet-anchors.ts`) — never to a wallet that contradicts them.
 * - The bronze conversion chain #53662 / #53663 (400 → 8 = rate 50) needs a bronze owner with
 *   balance 1; no bronze anchor has it, so it goes to the **generated** student
 *   `LEDGER_PINNED_OWNER`, whose generated bronze wallet is pinned to 1 at prime.
 * - Older convert chains keep a tier-matching owner: 4017 (12 → 14 by the clock), 4014, 4036,
 *   4028 (Baki 154 = its chosen balance), 4029 (5,424 = its chosen balance). Page-2118 and the
 *   February rows stay on bronze anchors 4075, 4077, 4079, 4080, 4081 (their later balances rise).
 * - Generated rows never belong to these owners (`./prime.ts`). Per-user reconciliation of older
 *   history is not claimed (SQ-M14-04).
 */

import type { LedgerRow, LedgerType } from '../repository/types'

/**
 * Generated M01 student (pattern `pelajar{000000}@demo.test`, not an anchor) that owns the bronze
 * conversion chain #53662 / #53663; the M14 prime checks it and fails with a clear message if the
 * users store changes.
 */
export const LEDGER_PINNED_OWNER = 12
/** Its pinned balance at the clock (#53663 "Baki" 1). */
export const LEDGER_PINNED_BALANCE = 1

type Tuple = readonly [
  id: number,
  userId: number,
  type: LedgerType,
  source: string,
  tokens: number | null,
  amount: number,
  balanceAfter: number,
  description: string,
  /** dd/mm/yyyy HH:mm (local, as shown). */
  shown: string,
]

const DL = 'Streak activity (daily_login)'
const PB = 'Jawab betul dalam Papan Bijak 🎲'
const TUKAR = (s: number, t: number) => `Tukar ${String(s)} syiling → ${String(t)} token`

const ROWS: readonly Tuple[] = [
  // S5 page 1 at the clock (#53668 … #53654).
  [53668, 4021, 'earn', 'daily_login', null, 2, 1058, DL, '25/09/2026 15:29'],
  [
    53667,
    4022,
    'earn',
    'quiz_spm',
    null,
    12,
    17,
    'SPM Tahun Lepas: 12 betul — 60%',
    '25/09/2026 14:18',
  ],
  [
    53666,
    4023,
    'earn',
    'quiz_spm',
    null,
    3,
    5813,
    'SPM Tahun Lepas: 3 betul — 60%',
    '25/09/2026 14:08',
  ],
  [53665, 4023, 'earn', 'daily_login', null, 2, 5810, DL, '25/09/2026 13:54'],
  [
    53664,
    4024,
    'earn',
    'quiz_spm',
    null,
    4,
    5,
    'SPM Tahun Lepas: 4 betul — 80%',
    '25/09/2026 13:33',
  ],
  [
    53663,
    LEDGER_PINNED_OWNER,
    'convert',
    'token_conversion',
    8,
    -400,
    1,
    TUKAR(400, 8),
    '25/09/2026 13:29',
  ],
  [53662, LEDGER_PINNED_OWNER, 'earn', 'daily_login', null, 2, 401, DL, '25/09/2026 13:28'],
  [53661, 4004, 'earn', 'daily_login', null, 2, 129, DL, '25/09/2026 13:07'],
  [53660, 4046, 'earn', 'daily_login', null, 2, 3010, DL, '25/09/2026 12:47'],
  [
    53659,
    4026,
    'earn',
    'quiz_practice',
    null,
    10,
    103,
    'Latih Tubi: 10 betul — 100%',
    '25/09/2026 12:46',
  ],
  [
    53658,
    4026,
    'earn',
    'quiz_practice',
    null,
    5,
    93,
    'Latih Tubi: 5 betul — 50%',
    '25/09/2026 12:44',
  ],
  [53657, 4025, 'earn', 'daily_login', null, 2, 897, DL, '25/09/2026 12:44'],
  [
    53656,
    4026,
    'earn',
    'quiz_practice',
    null,
    8,
    88,
    'Latih Tubi: 8 betul — 80%',
    '25/09/2026 12:41',
  ],
  [53655, 4026, 'earn', 'daily_login', null, 2, 80, DL, '25/09/2026 12:34'],
  [
    53654,
    4027,
    'earn',
    'quiz_spm',
    null,
    8,
    752,
    'SPM Tahun Lepas: 8 betul — 80%',
    '25/09/2026 12:20',
  ],
  // S5 convert page 1 (after #53663).
  [53521, 4017, 'convert', 'token_conversion', 25, -500, 12, TUKAR(500, 25), '22/09/2026 11:59'],
  [53520, 4017, 'convert', 'token_conversion', 25, -500, 512, TUKAR(500, 25), '22/09/2026 11:59'],
  [53189, 4029, 'convert', 'token_conversion', 1, -20, 5424, TUKAR(20, 1), '19/09/2026 16:25'],
  [52802, 4014, 'convert', 'token_conversion', 1, -20, 48, TUKAR(20, 1), '14/09/2026 14:27'],
  [52803, 4014, 'convert', 'token_conversion', 1, -20, 28, TUKAR(20, 1), '14/09/2026 14:27'],
  [52804, 4014, 'convert', 'token_conversion', 1, -20, 8, TUKAR(20, 1), '14/09/2026 14:27'],
  [52801, 4014, 'convert', 'token_conversion', 1, -20, 68, TUKAR(20, 1), '14/09/2026 14:27'],
  [52800, 4014, 'convert', 'token_conversion', 1, -20, 88, TUKAR(20, 1), '14/09/2026 14:27'],
  [52799, 4014, 'convert', 'token_conversion', 1, -20, 108, TUKAR(20, 1), '14/09/2026 14:27'],
  [52798, 4014, 'convert', 'token_conversion', 1, -20, 128, TUKAR(20, 1), '14/09/2026 14:27'],
  [52797, 4014, 'convert', 'token_conversion', 1, -20, 148, TUKAR(20, 1), '14/09/2026 14:27'],
  [52796, 4014, 'convert', 'token_conversion', 1, -20, 168, TUKAR(20, 1), '14/09/2026 14:27'],
  [52795, 4014, 'convert', 'token_conversion', 1, -20, 188, TUKAR(20, 1), '14/09/2026 14:27'],
  [52794, 4014, 'convert', 'token_conversion', 1, -20, 208, TUKAR(20, 1), '14/09/2026 14:26'],
  [52793, 4014, 'convert', 'token_conversion', 1, -20, 228, TUKAR(20, 1), '14/09/2026 14:26'],
  [52792, 4014, 'convert', 'token_conversion', 1, -20, 248, TUKAR(20, 1), '14/09/2026 14:26'],
  [52791, 4014, 'convert', 'token_conversion', 1, -20, 268, TUKAR(20, 1), '14/09/2026 14:26'],
  [52790, 4014, 'convert', 'token_conversion', 1, -20, 288, TUKAR(20, 1), '14/09/2026 14:26'],
  [52663, 4028, 'convert', 'token_conversion', 1, -20, 154, TUKAR(20, 1), '12/09/2026 14:52'],
  [52662, 4028, 'convert', 'token_conversion', 1, -20, 174, TUKAR(20, 1), '12/09/2026 14:52'],
  [52430, 4036, 'convert', 'token_conversion', 1, -30, 30, TUKAR(30, 1), '09/09/2026 12:33'],
  [52427, 4036, 'convert', 'token_conversion', 1, -30, 120, TUKAR(30, 1), '09/09/2026 12:33'],
  [52428, 4036, 'convert', 'token_conversion', 1, -30, 90, TUKAR(30, 1), '09/09/2026 12:33'],
  [52429, 4036, 'convert', 'token_conversion', 1, -30, 60, TUKAR(30, 1), '09/09/2026 12:33'],
  // The only spend and bonus rows.
  [
    42,
    4075,
    'spend',
    'reward_claim',
    null,
    -100,
    365,
    'Tuntut: Lencana Super Learner',
    '28/02/2026 08:00',
  ],
  [51, 4077, 'bonus', 'streak_bonus', null, 25, 140, 'Bonus Kombo 3 Hari', '27/02/2026 10:00'],
  [44, 4079, 'bonus', 'streak_bonus', null, 50, 445, 'Bonus Kombo 10 Hari!', '27/02/2026 09:00'],
  // S5 page 2118 (#39 … #15).
  [39, 4080, 'earn', 'papan_bijak', null, 5, 85, PB, '26/02/2026 14:01'],
  [38, 4081, 'earn', 'papan_bijak', null, 5, 123, PB, '26/02/2026 14:01'],
  [37, 4080, 'earn', 'papan_bijak', null, 5, 80, PB, '26/02/2026 13:59'],
  [36, 4081, 'earn', 'papan_bijak', null, 5, 118, PB, '26/02/2026 13:58'],
  [
    35,
    4080,
    'earn',
    'papan_bijak_win',
    null,
    25,
    75,
    'Menang Papan Bijak! 🏆🎲',
    '26/02/2026 13:38',
  ],
  [34, 4081, 'earn', 'papan_bijak', null, 5, 113, PB, '26/02/2026 13:38'],
  [33, 4081, 'earn', 'papan_bijak', null, 5, 108, PB, '26/02/2026 13:37'],
  [32, 4081, 'earn', 'papan_bijak', null, 5, 103, PB, '26/02/2026 13:37'],
  [31, 4081, 'earn', 'papan_bijak', null, 5, 98, PB, '26/02/2026 13:35'],
  [30, 4080, 'earn', 'papan_bijak', null, 5, 50, PB, '26/02/2026 13:35'],
  [29, 4081, 'earn', 'papan_bijak', null, 5, 93, PB, '26/02/2026 13:35'],
  [28, 4080, 'earn', 'papan_bijak', null, 5, 45, PB, '26/02/2026 13:34'],
  [27, 4081, 'earn', 'papan_bijak', null, 5, 88, PB, '26/02/2026 13:34'],
  [26, 4081, 'earn', 'papan_bijak', null, 5, 83, PB, '26/02/2026 13:34'],
  [25, 4080, 'earn', 'papan_bijak', null, 5, 40, PB, '26/02/2026 13:33'],
  [24, 4081, 'earn', 'papan_bijak', null, 5, 78, PB, '26/02/2026 13:33'],
  [23, 4080, 'earn', 'papan_bijak', null, 5, 35, PB, '26/02/2026 13:33'],
  [22, 4080, 'earn', 'papan_bijak', null, 5, 30, PB, '26/02/2026 13:31'],
  [20, 4081, 'earn', 'papan_bijak', null, 5, 58, PB, '26/02/2026 13:22'],
  [
    21,
    4081,
    'earn',
    'daily_challenge',
    null,
    15,
    73,
    'Cabaran selesai: Rajin Berlatih',
    '26/02/2026 13:22',
  ],
  [18, 4080, 'earn', 'papan_bijak', null, 5, 10, PB, '26/02/2026 13:22'],
  [
    19,
    4080,
    'earn',
    'daily_challenge',
    null,
    15,
    25,
    'Cabaran selesai: Rajin Berlatih',
    '26/02/2026 13:22',
  ],
  [17, 4080, 'earn', 'papan_bijak', null, 5, 5, PB, '26/02/2026 13:21'],
  [15, 4081, 'earn', 'papan_bijak', null, 5, 23, PB, '26/02/2026 13:21'],
]

/**
 * Seconds keep the observed within-minute order of page 2118 (#20 before #21, #18 before #19,
 * shown newest first as #20, #21, #18, #19): rows shown later on a page get an earlier second.
 */
function isoOf(shown: string, second: number): string {
  const [d, t] = shown.split(' ') as [string, string]
  const [dd, mm, yyyy] = d.split('/') as [string, string, string]
  return `${yyyy}-${mm}-${dd}T${t}:${String(second).padStart(2, '0')}+08:00`
}

/** Seconds per id where the within-minute order is observed (see `isoOf`). */
const SECONDS: Readonly<Record<number, number>> = {
  // 26/02 13:22: #20 newest, then #21, #18, #19.
  20: 40,
  21: 30,
  18: 20,
  19: 10,
  // 26/02 13:21: #17 before #15 on the page.
  17: 40,
  15: 20,
  // 14/09 14:27 as shown on the convert page: #52802, #52803, #52804, #52801, #52800 … #52795.
  52802: 50,
  52803: 45,
  52804: 40,
  52801: 35,
  52800: 30,
  52799: 25,
  52798: 20,
  52797: 15,
  52796: 10,
  52795: 5,
  // 09/09 12:33 as shown: #52430, #52427, #52428, #52429.
  52430: 40,
  52427: 30,
  52428: 20,
  52429: 10,
}

export const LIVE_LEDGER_ANCHORS: readonly LedgerRow[] = Object.freeze(
  ROWS.map(([id, userId, type, source, tokens, amount, balanceAfter, description, shown]) =>
    Object.freeze({
      id,
      userId,
      type,
      source,
      tokens,
      amount,
      balanceAfter,
      description,
      refId: null,
      createdAt: isoOf(shown, SECONDS[id] ?? 0),
    }),
  ),
)

/** Wallet users owning observed rows: no generated ledger row goes to them. */
export const OBSERVED_ROW_OWNERS: readonly number[] = Object.freeze(
  [...new Set(LIVE_LEDGER_ANCHORS.map((r) => r.userId))].sort((a, b) => a - b),
)
