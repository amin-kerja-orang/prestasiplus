/**
 * Wallet anchors 4001–4108 (SRS M14 v1.7 §6.11.4; values from the live snapshot, fictitious
 * students registered by M02 v1.12 as users-dataset anchors, XR-M14-05). `null` = "gen.": generated
 * within the §6.11.1 constraints (deterministic from the user id).
 *
 * The "gen." balances of 4021–4029 are **chosen** (INFERRED; the snapshot shows only their
 * lifetime): each equals the "Baki" of the last observed ledger row assigned to that user in
 * `./ledger-anchors.ts` (1,058 / 17 / 5,813 / 5 / 897 / 103 / 752 / 154 / 5,424), so the balance at
 * the clock never contradicts an observed row (review MINOR-7). All are ≤ the observed lifetime.
 *
 * `createdAt` is unobserved (INFERRED): 4001–4093 from 2025-09-15 08:00, one hour apart in id order
 * (4092 before 4093 keeps the S4 bronze page-1 order of the 498 tie); 4094–4108 are the newest
 * wallets of all (S4 page 113 order), from 2026-09-24 10:00, one minute apart.
 */

import { hashKey } from '@/mock/dataset'
import { toIsoMyt } from '@/lib/time'

import type { WalletRow } from '../repository/types'

/** [userId, tier, level, balance | gen., tokens | gen., lifetime, xp | gen.] */
type AnchorTuple = readonly [
  number,
  string,
  number,
  number | null,
  number | null,
  number,
  number | null,
]

const T: readonly AnchorTuple[] = [
  [4001, 'platinum', 66, 1_018_033, 1, 1_018_083, 19_794],
  [4002, 'platinum', 62, 680_230, 275, 686_730, 9_640],
  [4003, 'platinum', 45, 135_760, 0, 135_760, 2_274],
  [4004, 'platinum', 39, 129, 1764, 65_129, 55],
  [4005, 'platinum', 37, 60_245, 0, 60_305, 205],
  [4006, 'platinum', 36, 57_083, 0, 57_783, 1_915],
  [4007, 'platinum', 37, 26_737, 0, 54_937, 1_316],
  [4008, 'platinum', 33, 44_093, 0, 44_093, 1_811],
  [4009, 'platinum', 30, 31_864, 11, 32_084, 889],
  [4010, 'platinum', 30, 30_269, 0, 30_269, 282],
  [4011, 'platinum', 29, 29_902, 1, 29_942, 1_441],
  [4012, 'platinum', 28, 25_178, 0, 25_178, 491],
  [4013, 'platinum', 26, 20_223, 0, 20_223, 284],
  [4014, 'platinum', 24, 692, 327, 15_792, 875],
  [4015, 'platinum', 23, 15_264, 0, 15_264, 475],
  [4016, 'platinum', 22, 13_913, 0, 14_053, 609],
  [4017, 'platinum', 23, 14, 34, 12_934, 670],
  [4018, 'platinum', 21, 12_256, 0, 12_256, 278],
  [4019, 'platinum', 21, 11_732, 0, 11_732, 116],
  [4020, 'platinum', 20, 10_734, 0, 10_734, 259],
  [4021, 'platinum', 20, 1_058, null, 10_552, null],
  [4022, 'platinum', 19, 17, null, 8_720, null],
  [4023, 'platinum', 18, 5_813, null, 8_328, null],
  [4024, 'platinum', 17, 5, null, 7_845, null],
  [4025, 'platinum', 17, 897, null, 7_807, null],
  [4026, 'platinum', 16, 103, null, 6_792, null],
  [4027, 'platinum', 15, 752, null, 6_435, null],
  [4028, 'platinum', 14, 154, null, 5_873, null],
  [4029, 'platinum', 15, 5_424, null, 5_832, null],
  [4030, 'platinum', 14, null, null, 5_639, null],
  [4031, 'platinum', 15, null, null, 5_625, null],
  [4032, 'platinum', 14, null, null, 5_501, null],
  [4033, 'platinum', 14, null, null, 5_440, null],
  [4034, 'gold', 13, 4_877, 0, 4_937, 268],
  [4035, 'gold', 12, 4_176, 0, 4_176, 209],
  [4036, 'gold', 12, 977, 76, 4_107, 239],
  [4037, 'gold', 12, 4_012, 0, 4_012, 133],
  [4038, 'gold', 12, 3_956, 0, 3_956, 108],
  [4039, 'gold', 11, 3_740, 0, 3_740, 249],
  [4040, 'gold', 11, 3_627, 0, 3_627, 184],
  [4041, 'gold', 11, 3_464, 0, 3_464, 114],
  [4042, 'gold', 11, 3_421, 0, 3_421, 107],
  [4043, 'gold', 11, 3_327, 1, 3_367, 11],
  [4044, 'gold', 10, 3_174, 0, 3_174, 204],
  [4045, 'gold', 10, 3_045, 0, 3_045, 159],
  [4046, 'gold', 10, 3_010, 0, 3_010, 110],
  [4047, 'gold', 10, 2_987, 0, 2_987, 154],
  [4048, 'gold', 14, 2_362, 17, 2_945, 1_309],
  [4049, 'gold', 10, 185, 76, 2_935, 98],
  [4050, 'gold', 10, 2_780, 1, 2_930, 126],
  [4051, 'gold', 10, 2_901, 0, 2_901, 109],
  [4052, 'gold', 19, 2_355, 10, 2_900, 1_891],
  [4053, 'gold', 10, 2_885, 0, 2_885, 76],
  [4054, 'silver', 11, 1_916, 4, 2_423, 1_058],
  [4055, 'silver', 6, 1_923, -1, 2_372, 569],
  [4056, 'silver', 18, 1_862, 4, 2_357, 1_702],
  [4057, 'silver', 13, 1_873, 12, 2_341, 1_205],
  [4058, 'silver', 13, 1_818, 18, 2_170, 1_203],
  [4059, 'silver', 14, 1_995, 10, 2_160, 1_336],
  [4060, 'silver', 15, 1_910, 16, 2_125, 1_403],
  [4061, 'silver', 5, 1_862, 5, 2_103, 409],
  [4062, 'silver', 8, 1_717, -1, 2_072, 769],
  [4063, 'silver', 8, 1_607, 17, 2_055, 713],
  [4064, 'silver', 22, 1_588, 11, 2_043, 2_136],
  [4065, 'silver', 5, 1_852, 5, 2_010, 478],
  [4066, 'silver', 14, 1_767, 11, 2_001, 1_313],
  [4067, 'silver', 16, 1_801, 6, 1_993, 1_587],
  [4068, 'silver', 7, 1_990, 0, 1_990, 168],
  [4069, 'silver', 8, 1_979, 0, 1_979, 23],
  [4070, 'silver', 10, 1_811, 6, 1_966, 904],
  [4071, 'silver', 19, 1_680, 0, 1_959, 1_848],
  [4072, 'silver', 8, 1_948, 0, 1_948, 5],
  [4073, 'silver', 9, 1_643, -3, 1_934, 895],
  [4074, 'bronze', 5, 496, 15, 609, 481],
  [4075, 'bronze', 3, 484, 0, 581, 241],
  [4076, 'bronze', 5, 498, -2, 567, 497],
  [4077, 'bronze', 2, 470, 17, 561, 187],
  [4078, 'bronze', 5, 461, 15, 548, 459],
  [4079, 'bronze', 2, 422, 0, 545, 143],
  [4080, 'bronze', 3, 473, 10, 537, 237],
  [4081, 'bronze', 3, 473, 5, 534, 246],
  [4082, 'bronze', 4, 444, 15, 531, 345],
  [4083, 'bronze', 1, 468, 12, 527, 95],
  [4084, 'bronze', 3, 478, 6, 526, 234],
  [4085, 'bronze', 4, 459, 3, 525, 339],
  [4086, 'bronze', 2, 422, 7, 520, 127],
  [4087, 'bronze', 5, 459, 6, 514, 430],
  [4088, 'bronze', 2, 454, -2, 512, 167],
  [4089, 'bronze', 3, 491, 4, 510, 255],
  [4090, 'bronze', 1, 497, 12, 507, 90],
  [4091, 'bronze', 2, 400, 15, 504, 111],
  [4092, 'bronze', 3, 498, 0, 498, 35],
  [4093, 'bronze', 3, 498, 0, 498, 33],
  [4094, 'bronze', 1, 0, 0, 0, 0],
  [4095, 'bronze', 1, 0, 0, 0, 0],
  [4096, 'bronze', 1, 0, 0, 0, 0],
  [4097, 'bronze', 1, 0, 17, 0, 16],
  [4098, 'bronze', 1, 0, 11, 0, 13],
  [4099, 'bronze', 1, 0, 0, 0, 0],
  [4100, 'bronze', 1, 0, 0, 0, 16],
  [4101, 'bronze', 1, 0, 0, 0, 0],
  [4102, 'bronze', 1, 0, -1, 0, 3],
  [4103, 'bronze', 1, 0, 0, 0, 0],
  [4104, 'bronze', 1, 0, 0, 0, 0],
  [4105, 'bronze', 1, 0, 0, 0, 0],
  [4106, 'bronze', 1, 0, -1, 0, 21],
  [4107, 'bronze', 1, 0, 9, 0, 9],
  [4108, 'bronze', 1, 0, 0, 0, 0],
]

const HOUR = 3_600_000
const OLDER_BASE = Date.parse('2025-09-15T08:00:00+08:00')
const NEWEST_BASE = Date.parse('2026-09-24T10:00:00+08:00')

function createdAtOf(userId: number): string {
  return userId >= 4094
    ? toIsoMyt(NEWEST_BASE + (userId - 4094) * 60_000)
    : toIsoMyt(OLDER_BASE + (userId - 4001) * HOUR)
}

/** "gen." values (§6.11.1): balance ∈ [lifetime ÷ 2, lifetime], tokens ∈ [0, 50], xp by level. */
function generatedFields(userId: number, lifetime: number, level: number) {
  return {
    currentSyiling: Math.floor((lifetime * (50 + (hashKey(userId, 31) % 51))) / 100),
    tokenBalance: hashKey(userId, 32) % 51,
    xp: level * 40 + (hashKey(userId, 33) % 100),
  }
}

export const WALLET_ANCHORS_4001: readonly WalletRow[] = Object.freeze(
  T.map(([userId, tierKey, level, balance, tokens, lifetime, xp]) => {
    const gen = generatedFields(userId, lifetime, level)
    return Object.freeze({
      id: userId,
      userId,
      tierKey,
      level,
      currentSyiling: balance ?? gen.currentSyiling,
      tokenBalance: tokens ?? gen.tokenBalance,
      totalSyilingEarned: lifetime,
      xp: xp ?? gen.xp,
      createdAt: createdAtOf(userId),
    })
  }),
)

/** Σ lifetime of the 108 anchors (§6.11.4): 2,564,844. */
export const ANCHOR_4001_LIFETIME_SUM = 2_564_844

/**
 * User anchors of every other module (M02 v1.12 §6.15 D placement table and later requests): a
 * generated wallet never takes one of them (§6.11.1). Wallet users 1, 2, 4 and 4001–4108 are
 * wallet anchors themselves.
 */
export const OTHER_MODULE_USER_ANCHORS: readonly (readonly [number, number])[] = [
  [1, 11],
  [1919, 1919],
  [2001, 2060],
  [3001, 3008],
  [3101, 3109],
  [3151, 3152],
  [3201, 3215],
  [4001, 4108],
  [4201, 4208],
  [4301, 4358],
  [4401, 4402],
  [4418, 4418],
  [4501, 4504],
  [4644, 4644],
  [4664, 4664],
  [5001, 5999],
]

export function isOtherModuleAnchor(userId: number): boolean {
  return OTHER_MODULE_USER_ANCHORS.some(([lo, hi]) => userId >= lo && userId <= hi)
}
