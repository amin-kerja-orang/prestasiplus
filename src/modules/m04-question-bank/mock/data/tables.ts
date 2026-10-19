/**
 * Allocation inputs of the M04 question datasets (SRS v1.11 §4.1, §6.11, §6.13), transcribed
 * literally from the owner SRS and the documents it names as sources:
 * - Tables A (active), B (inactive) and C (scored) by subject × level — M04 §6.13.1;
 * - S1 tile values (Q-ALL / Q-APPROVED per subject) — M04 discovery §2.1, DV-M04-18;
 * - SPM pool per subject × T4/T5 × difficulty — M06 §6.10 (the allocation input M06 supplies);
 * - D1–D4 difficulty and Darjah 1 chapter counts — M05 `_practice-data.json` (`difficultyByLevel`,
 *   S5 chapter pages), with the chapter ids of M03 (`curriculum.json`), per M04 §6.13.1
 *   "curriculumChapterId";
 * - PKSK domain × level totals — M07 §6.8; SP availability — M08/M10 (XL2-20);
 * - S6 per-subject and per-level scored means — M04 discovery §2.6.
 *
 * Nothing here is tuned: every value is the documented one. PROPOSED splits (not observed) are
 * computed by the spec builder (`datasets/questions-spec.ts`) and labelled there.
 *
 * The chapter ids are M03 ids (references, not a copy of the curriculum store). The spec needs them
 * at module load (the seed version hashes the distribution before any seed runs), so they are kept
 * here; a unit test checks each one against the M03 repository after boot.
 */

/** M03 subject ids (1–31) used by M04. */
export const SUBJECT = {
  BM: 1,
  BI: 2,
  MATH: 3,
  SCI: 4,
  SEJ: 5,
  PI: 6,
  PM: 7,
  ADDMATH: 8,
  PHY: 9,
  CHEM: 10,
  BIO: 11,
  GEO: 12,
  PSV: 13,
  MUZ: 14,
  PJK: 15,
  RBT: 16,
  SK: 17,
  BA: 18,
  BC: 19,
  BT: 20,
  AKAUN: 21,
  EKON: 22,
  PERNIAGA: 23,
  PQS: 24,
  TI: 25,
  JAWI: 26,
  PSI: 27,
} as const

/** M03 education level ids: Darjah 1–6 = 1–6, Tingkatan 1–5 = 7–11. */
export const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
export const T4 = 10
export const T5 = 11

type Row11 = readonly (number | null)[]

/**
 * Table A — active rows by subject × level (D1…T5); `null` = no row ("–"). Σ 129,380. v1.11
 * (XL3-11): the M17 S10 coverage matrix (Q-M17-COV) + the 1,746 `coverageExcluded` rows.
 */
export const TABLE_A: Readonly<Record<number, Row11>> = {
  1: [958, 2540, 805, 530, 407, 400, 2104, 1800, 1500, 257, 387],
  2: [926, 1225, 846, 524, 403, 992, 1609, 400, null, 362, 752],
  3: [2734, 2129, 682, 993, 583, 641, 1300, 1300, 900, 1511, 1090],
  4: [3230, 611, 515, 547, 347, 310, 900, 1300, 1000, 1927, 1478],
  5: [650, 451, 418, 412, 234, 204, 800, 1000, 800, 777, 762],
  6: [985, 1124, 893, 369, 400, 400, 1500, 1500, 1500, 239, 244],
  7: [1013, 1265, 717, 312, 400, 417, 3300, 1500, 1400, 2666, 2424],
  8: [null, null, null, null, null, null, null, null, null, 1146, 955],
  9: [null, null, null, null, null, null, null, null, null, 461, 800],
  10: [null, null, null, null, null, null, null, null, null, 1350, 895],
  11: [null, null, null, null, null, null, null, null, null, 2282, 1953],
  12: [200, 200, 200, 200, 200, 200, 1269, 1100, 1200, 250, 978],
  13: [null, null, null, null, null, null, 1710, 1100, 1000, 550, 550],
  14: [null, null, null, null, null, null, 600, 500, 700, null, null],
  15: [null, null, null, null, null, null, 1000, 1100, 800, null, null],
  16: [null, null, null, null, null, null, null, 200, null, null, null],
  17: [null, null, null, null, null, null, 400, 300, 400, null, null],
  18: [400, 400, 400, 500, 500, 500, 500, 500, 500, 600, 600],
  20: [null, null, null, null, null, null, 2100, 2100, 2100, null, null],
  21: [null, null, null, null, null, null, null, null, null, 845, 2125],
  22: [null, null, null, null, null, null, null, null, null, 1251, 1519],
  23: [null, null, null, null, null, null, null, null, null, 727, 2005],
  24: [null, null, null, null, null, null, null, null, null, 500, 500],
  25: [null, null, null, null, null, null, null, null, null, 675, 625],
  26: [300, 300, 300, 400, 400, 400, null, null, null, null, null],
  27: [null, null, null, null, null, null, 363, null, null, 737, 128],
}

/**
 * Active rows without a level (Q-ACTIVE Σ subjects 129,389 vs Σ levels 129,380): 9 excluded
 * Matematik rows (v1.11: moved from Bahasa Melayu, whose S10 row is its whole Q-ACTIVE).
 */
export const NULL_LEVEL_ACTIVE = { subjectId: 3, count: 9 } as const

/** Table B — inactive rows by subject × level. Σ 335,889. */
export const TABLE_B: Readonly<Record<number, Row11>> = {
  1: [251, 2137, 2138, 2144, 2149, 2152, 1898, 1945, 1946, 2227, 2230],
  2: [128, 1095, 1095, 1100, 1099, 1099, 973, 996, 996, 1141, 1141],
  3: [291, 2483, 2483, 2493, 2493, 2493, 2206, 2258, 2258, 2587, 2587],
  4: [356, 3041, 3041, 3054, 3053, 3053, 2702, 2766, 2766, 3169, 3169],
  5: [164, 1402, 1402, 1407, 1407, 1407, 1245, 1275, 1275, 1461, 1461],
  6: [222, 1896, 1896, 1904, 1903, 1903, 1684, 1725, 1725, 1975, 1975],
  7: [272, 2325, 2325, 2335, 2335, 2334, 2065, 2115, 2115, 2423, 2423],
  8: [null, null, null, null, null, null, null, null, null, 2740, 2739],
  9: [null, null, null, null, null, null, null, null, null, 779, 778],
  10: [null, null, null, null, null, null, null, null, null, 2529, 2529],
  11: [null, null, null, null, null, null, null, null, null, 4883, 4883],
  12: [181, 1544, 1544, 1551, 1551, 1550, 1372, 1405, 1405, 1609, 1609],
  13: [513, 4379, 4379, 4398, 4397, 4397, 3891, 3984, 3984, 4564, 4564],
  14: [247, 2106, 2106, 2115, 2114, 2114, 1871, 1916, 1916, null, null],
  15: [171, 1456, 1456, 1462, 1462, 1462, 1293, 1325, 1324, 1517, 1517],
  16: [19, 163, 162, 163, 163, 163, 144, 148, 148, 169, 169],
  17: [null, null, null, 2625, 2625, 2625, 2323, 2378, 2378, 2725, 2725],
  18: [195, 1665, 1665, 1671, 1671, 1671, 1479, 1514, 1514, 1734, 1734],
  20: [230, 1965, 1965, 1974, 1974, 1974, 1746, 1788, 1788, 2048, 2048],
  21: [null, null, null, null, null, null, null, null, null, 1541, 1541],
  22: [null, null, null, null, null, null, null, null, null, 1411, 1410],
  23: [null, null, null, null, null, null, null, null, null, 1339, 1339],
  24: [null, null, null, null, null, null, null, null, null, 1485, 1485],
  25: [null, null, null, null, null, null, null, null, null, 1845, 1845],
  26: [142, 1212, 1212, 1217, 1217, 1216, null, null, null, null, null],
  27: [null, null, null, null, null, null, 646, null, null, 757, 757],
}

/** Table C — scored rows (`qualityBucket ≠ unscored`) by subject × level. Σ 147,026 (T4 +230, D9). */
export const TABLE_C: Readonly<Record<number, Row11>> = {
  1: [387, 348, 519, 631, 758, 876, 1650, 1243, 1368, 1274, 983],
  2: [325, 293, 439, 533, 640, 739, 1393, 1048, 996, 1076, 831],
  3: [512, 461, 692, 839, 1007, 1164, 2193, 1650, 1816, 1693, 1308],
  4: [653, 589, 882, 1070, 1285, 1485, 2798, 2104, 2317, 2160, 1669],
  5: [353, 318, 477, 578, 694, 802, 1512, 1137, 1252, 1167, 902],
  6: [439, 396, 594, 720, 864, 999, 1882, 1415, 1559, 1453, 1122],
  7: [377, 340, 509, 618, 742, 857, 1614, 1214, 1337, 1246, 963],
  8: [null, null, null, null, null, null, null, null, null, 1286, 993],
  9: [null, null, null, null, null, null, null, null, null, 1063, 821],
  10: [null, null, null, null, null, null, null, null, null, 3296, 2546],
  11: [null, null, null, null, null, null, null, null, null, 6430, 4967],
  12: [280, 252, 378, 458, 550, 635, 1198, 901, 992, 925, 714],
  13: [175, 158, 237, 287, 344, 398, 750, 564, 621, 579, 447],
  14: [89, 81, 121, 147, 176, 203, 383, 288, 317, null, null],
  15: [113, 102, 153, 185, 223, 257, 484, 364, 401, 374, 289],
  16: [19, 47, 71, 86, 104, 120, 144, 169, 148, 169, 134],
  17: [null, null, null, 79, 95, 110, 208, 156, 172, 160, 124],
  18: [154, 138, 208, 252, 303, 350, 659, 496, 546, 509, 393],
  20: [228, 219, 328, 397, 477, 551, 1038, 781, 860, 802, 619],
  21: [null, null, null, null, null, null, null, null, null, 1383, 1069],
  22: [null, null, null, null, null, null, null, null, null, 1801, 1392],
  23: [null, null, null, null, null, null, null, null, null, 2059, 2681],
  24: [null, null, null, null, null, null, null, null, null, 564, 436],
  25: [null, null, null, null, null, null, null, null, null, 773, 597],
  26: [221, 199, 298, 362, 434, 502, null, null, null, null, null],
  27: [null, null, null, null, null, null, 840, null, null, 930, 718],
}

/**
 * Q-APPROVED(subject) — S1 tile "lulus" (discovery §2.1), with Prinsip Perakaunan = 2,970
 * (DV-M04-18) and Bahasa Tamil 6,300. Σ 146,330. Subjects without a tile value have 0.
 */
export const APPROVED_BY_SUBJECT: Readonly<Record<number, number>> = {
  1: 13081,
  2: 8879,
  3: 16645,
  4: 15067,
  5: 10301,
  6: 10455,
  7: 15996,
  8: 2579,
  9: 2185,
  10: 2670,
  11: 4580,
  12: 6886,
  13: 4910,
  14: 1800,
  15: 2900,
  16: 200,
  17: 1100,
  18: 5400,
  20: 6300,
  21: 2970,
  22: 3051,
  23: 2732,
  24: 1000,
  25: 1300,
  26: 2100,
  27: 1243,
}

/** Pendidikan Moral archived-but-active rows by level (D5, D6, T1, T2, T3; PROPOSED in the SRS v1.11). */
export const PM_ARCHIVED_ACTIVE: Readonly<Record<number, number>> = {
  5: 23,
  6: 24,
  7: 189,
  8: 85,
  9: 79,
}

/**
 * SPM pool (M06 §6.10): subject → [T4 by difficulty 1–4, T5 by difficulty 1–4]. Σ 21,033.
 * Bahasa Arab is listed with 0 (keeps the live lock).
 */
export const SPM_POOL: Readonly<Record<number, readonly [readonly number[], readonly number[]]>> = {
  1: [
    [3, 101, 80, 21],
    [10, 94, 162, 43],
  ],
  2: [
    [0, 134, 166, 62],
    [228, 313, 127, 84],
  ],
  3: [
    [199, 309, 410, 58],
    [306, 205, 167, 27],
  ],
  4: [
    [20, 801, 246, 105],
    [27, 498, 293, 86],
  ],
  5: [
    [385, 184, 122, 86],
    [1, 319, 371, 71],
  ],
  6: [
    [0, 79, 109, 51],
    [0, 71, 103, 70],
  ],
  7: [
    [0, 429, 224, 59],
    [0, 402, 205, 34],
  ],
  12: [
    [0, 52, 121, 77],
    [217, 353, 327, 81],
  ],
  11: [
    [5, 616, 318, 139],
    [0, 531, 211, 179],
  ],
  10: [
    [0, 442, 123, 42],
    [20, 263, 102, 17],
  ],
  9: [
    [0, 182, 213, 66],
    [68, 268, 332, 132],
  ],
  23: [
    [0, 218, 24, 7],
    [162, 306, 196, 21],
  ],
  21: [
    [0, 393, 70, 40],
    [286, 659, 255, 67],
  ],
  22: [
    [70, 301, 376, 149],
    [164, 341, 367, 218],
  ],
  8: [
    [0, 132, 128, 14],
    [0, 107, 106, 14],
  ],
  13: [
    [0, 87, 135, 51],
    [0, 78, 119, 75],
  ],
  18: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  25: [
    [39, 64, 106, 66],
    [79, 14, 98, 64],
  ],
  27: [
    [0, 86, 197, 152],
    [0, 18, 19, 38],
  ],
}

/** The 19 SPM (Latih Tubi) subjects: runtime S2/S5 rows at T4/T5 join the pool (BR-M04-32). */
export const SPM_POOL_SUBJECTS: readonly number[] = Object.keys(SPM_POOL).map(Number)

export interface PracticeLevelData {
  /** Eligible rows by difficulty 1–4 (M05 `difficultyByLevel`; difficulty 5 = 0). */
  difficulty: readonly [number, number, number, number]
  /** `[chapterId, count]`: Darjah 1 counts OBSERVED (M05 S5); `null` = not observed (even split). */
  chapters: readonly (readonly [number, number | null])[]
}

/** The ten practice subjects' Darjah 1–4 cells (M05 S3 pins, XL-30). */
export const PRACTICE_LEVELS: Readonly<
  Record<number, Readonly<Record<number, PracticeLevelData>>>
> = {
  18: {
    1: {
      difficulty: [136, 132, 132, 0],
      chapters: [
        [263, 100],
        [1039, 100],
        [1040, 100],
        [1041, 100],
      ],
    },
    2: {
      difficulty: [136, 132, 132, 0],
      chapters: [
        [1042, null],
        [1043, null],
        [1044, null],
        [1045, null],
      ],
    },
    3: {
      difficulty: [136, 132, 132, 0],
      chapters: [
        [1046, null],
        [1047, null],
        [1048, null],
        [1049, null],
      ],
    },
    4: {
      difficulty: [170, 165, 165, 0],
      chapters: [
        [1050, null],
        [1051, null],
        [1052, null],
        [1053, null],
        [1054, null],
      ],
    },
  },
  2: {
    1: {
      difficulty: [737, 189, 0, 0],
      chapters: [
        [57, 309],
        [88, 306],
        [89, 311],
      ],
    },
    2: {
      difficulty: [596, 629, 0, 0],
      chapters: [
        [90, null],
        [93, null],
        [94, null],
        [95, null],
      ],
    },
    3: {
      difficulty: [0, 296, 550, 0],
      chapters: [
        [96, null],
        [97, null],
        [98, null],
        [99, null],
      ],
    },
    4: {
      difficulty: [0, 298, 196, 30],
      chapters: [
        [100, null],
        [101, null],
        [102, null],
      ],
    },
  },
  1: {
    1: {
      difficulty: [689, 211, 13, 45],
      chapters: [
        [35, 320],
        [36, 317],
        [2, 321],
      ],
    },
    2: {
      difficulty: [73, 1482, 632, 353],
      chapters: [
        [4, null],
        [5, null],
        [6, null],
        [7, null],
        [8, null],
        [9, null],
        [10, null],
        [11, null],
      ],
    },
    3: {
      difficulty: [15, 156, 601, 33],
      chapters: [
        [12, null],
        [13, null],
        [14, null],
        [15, null],
      ],
    },
    4: {
      difficulty: [15, 19, 481, 15],
      chapters: [
        [16, null],
        [17, null],
        [19, null],
      ],
    },
  },
  12: {
    1: {
      difficulty: [192, 2, 4, 2],
      chapters: [
        [179, 100],
        [617, 100],
      ],
    },
    2: {
      difficulty: [192, 2, 4, 2],
      chapters: [
        [618, null],
        [619, null],
      ],
    },
    3: {
      difficulty: [192, 2, 4, 2],
      chapters: [
        [620, null],
        [621, null],
      ],
    },
    4: {
      difficulty: [192, 2, 4, 2],
      chapters: [
        [622, null],
        [623, null],
      ],
    },
  },
  26: {
    1: {
      difficulty: [288, 6, 3, 3],
      chapters: [
        [325, 100],
        [1224, 100],
        [1225, 100],
      ],
    },
    2: {
      difficulty: [288, 6, 3, 3],
      chapters: [
        [1226, null],
        [1227, null],
        [1228, null],
      ],
    },
    3: {
      difficulty: [288, 6, 3, 3],
      chapters: [
        [1229, null],
        [1230, null],
        [1231, null],
      ],
    },
    4: {
      difficulty: [384, 8, 4, 4],
      chapters: [
        [1232, null],
        [1233, null],
        [1234, null],
        [1235, null],
      ],
    },
  },
  3: {
    1: {
      difficulty: [558, 695, 1402, 79],
      chapters: [
        [1, 464],
        [143, 302],
        [136, 316],
        [137, 319],
        [138, 352],
        [139, 316],
        [140, 329],
        [141, 336],
      ],
    },
    2: {
      difficulty: [278, 635, 780, 436],
      chapters: [
        [3, null],
        [150, null],
        [144, null],
        [145, null],
        [146, null],
        [147, null],
        [148, null],
        [149, null],
      ],
    },
    3: {
      difficulty: [316, 326, 27, 13],
      chapters: [
        [151, null],
        [152, null],
        [153, null],
      ],
    },
    4: {
      difficulty: [188, 474, 302, 29],
      chapters: [
        [154, null],
        [155, null],
        [156, null],
        [157, null],
        [158, null],
        [159, null],
      ],
    },
  },
  6: {
    1: {
      difficulty: [318, 645, 11, 11],
      chapters: [
        [120, 319],
        [383, 333],
        [384, 333],
      ],
    },
    2: {
      difficulty: [296, 781, 30, 17],
      chapters: [
        [385, null],
        [386, null],
        [387, null],
        [388, null],
      ],
    },
    3: {
      difficulty: [0, 33, 839, 21],
      chapters: [
        [389, null],
        [390, null],
        [391, null],
        [392, null],
      ],
    },
    4: {
      difficulty: [0, 8, 345, 16],
      chapters: [
        [393, null],
        [394, null],
        [395, null],
      ],
    },
  },
  7: {
    1: {
      difficulty: [1005, 8, 0, 0],
      chapters: [
        [142, 327],
        [452, 343],
        [453, 343],
      ],
    },
    2: {
      difficulty: [1248, 17, 0, 0],
      chapters: [
        [454, null],
        [455, null],
        [456, null],
        [457, null],
      ],
    },
    3: {
      difficulty: [0, 545, 172, 0],
      chapters: [
        [458, null],
        [459, null],
        [460, null],
        [461, null],
      ],
    },
    4: {
      difficulty: [0, 159, 140, 13],
      chapters: [
        [462, null],
        [463, null],
        [464, null],
      ],
    },
  },
  4: {
    1: {
      difficulty: [689, 618, 1557, 366],
      chapters: [
        [18, 314],
        [229, 343],
        [230, 330],
        [231, 332],
        [232, 326],
        [233, 325],
        [234, 307],
        [235, 315],
        [236, 319],
        [237, 319],
      ],
    },
    2: {
      difficulty: [317, 266, 16, 12],
      chapters: [
        [238, null],
        [239, null],
      ],
    },
    3: {
      difficulty: [88, 393, 23, 11],
      chapters: [
        [240, null],
        [241, null],
        [242, null],
      ],
    },
    4: {
      difficulty: [96, 395, 45, 11],
      chapters: [
        [243, null],
        [244, null],
        [245, null],
      ],
    },
  },
  5: {
    1: {
      difficulty: [9, 641, 0, 0],
      chapters: [
        [164, 342],
        [335, 308],
      ],
    },
    2: {
      difficulty: [0, 451, 0, 0],
      chapters: [
        [336, null],
        [337, null],
      ],
    },
    3: {
      difficulty: [3, 315, 75, 25],
      chapters: [
        [338, null],
        [339, null],
      ],
    },
    4: {
      difficulty: [0, 366, 25, 21],
      chapters: [
        [340, null],
        [341, null],
      ],
    },
  },
}

/** Inactive rows at difficulty 1 (= 45,686 − (39,694 − 253), v1.11); difficulties 2–5 split evenly. */
export const INACTIVE_DIFFICULTY_1 = 6245

/** Compliance (S1 filters). `verified` is the remainder (310,571). */
export const COMPLIANCE_TOTALS = {
  quarantined: 124299,
  pending_mapping: 2756,
  draft: 27652,
} as const

/** Source types (S1 filters); `ai_generated` = the legacy rows; `textbook` the remainder. */
export const SOURCE_TOTALS = {
  trial: 19219,
  dskp: 35401,
  marking_scheme: 199,
  ai_generated: 373,
} as const

/** Rows without a source file (`compliance_filter=missing_source`). */
export const MISSING_SOURCE_TOTAL = 128372

/** Untagged objective rows (`dskp_filter=untagged`). */
export const UNTAGGED_TOTAL = 14933

/** `needsDiagram` MCQ rows per subject (S11; top-10 pills observed, the other 172 PROPOSED). Σ 6,144. */
export const NEEDS_DIAGRAM: Readonly<Record<number, number>> = {
  11: 1587,
  10: 1077,
  9: 718,
  4: 662,
  22: 570,
  21: 393,
  3: 336,
  12: 320,
  23: 249,
  7: 60,
  18: 5,
}
/** The 172 rows outside the top-10 pills: Bahasa Arab 5 (observed) + 167 spread evenly over these. */
export const NEEDS_DIAGRAM_OTHERS_TOTAL = 167
export const NEEDS_DIAGRAM_OTHER_SUBJECTS: readonly number[] = [
  1, 2, 5, 6, 8, 13, 14, 15, 16, 17, 20, 24, 25, 26, 27,
]

/** Scored rows in the `baik` bucket per subject (S6 "Cemerlang" shares 99 %, 98 %, 97 %). Σ 749. */
export const BAIK_BY_SUBJECT: Readonly<Record<number, number>> = { 3: 131, 2: 166, 4: 452 }

/**
 * Q-CONTRIB(1): the admin's 16,817 approved, active rows (M10 S21). The listed subjects are
 * observed; "others 763" is split over the remaining subjects in proportion to Q-ELIGIBLE
 * (PROPOSED, SRS §6.13.1).
 */
export const USER1_BY_SUBJECT: Readonly<Record<number, number>> = {
  3: 3287,
  6: 2516,
  1: 2342,
  2: 2214,
  4: 1935,
  7: 1823,
  5: 795,
  13: 510,
  27: 363,
  12: 269,
}
export const USER1_OTHERS_TOTAL = 763
export const USER1_TOTAL = 16817
/** First id of the user-1 layout block (M10 anchors 522425–522447, S21 page 2 from 522445). */
export const USER1_BLOCK_START = 522425

/** Teacher databank (M10 S28, Bahasa Melayu): 6,048 = mcq 5,918 + essay 105 + 25 other types. */
export const TEACHER_DATABANK = {
  subjectId: 1,
  total: 6048,
  mcq: 5918,
  mcqDifficulty3: 950,
  nonMcq: { essay: 105, true_false: 9, short_answer: 8, fill_blank: 8 },
} as const

/**
 * Named SPs with observed availability (Q-SP-AVAILABLE, M08 S6/S7; subject/level per M10 §6.9).
 * 9001–9004 are the M08 Kimia T5 anchors; 418 sits in Sejarah T5, whose eligible rows are all SPM
 * pool rows (see the spec builder note).
 */
export const NAMED_SPS: readonly {
  sp: number
  subjectId: number
  levelId: number
  count: number
}[] = [
  { sp: 9001, subjectId: 10, levelId: 11, count: 30 },
  { sp: 9002, subjectId: 10, levelId: 11, count: 2 },
  { sp: 9003, subjectId: 10, levelId: 11, count: 2 },
  { sp: 9004, subjectId: 10, levelId: 11, count: 2 },
  { sp: 221, subjectId: 1, levelId: 10, count: 16 },
  { sp: 206, subjectId: 1, levelId: 10, count: 16 },
  { sp: 222, subjectId: 1, levelId: 10, count: 7 },
  { sp: 214, subjectId: 1, levelId: 10, count: 12 },
  { sp: 179, subjectId: 1, levelId: 10, count: 13 },
  { sp: 194, subjectId: 1, levelId: 10, count: 50 },
  { sp: 418, subjectId: 5, levelId: 11, count: 13 },
]

/** The generic SP of a subject–level pair (M10 §6.9): 8000 + 20 × subjectId + levelId; Sains T5 → 6191. */
export function genericSpId(subjectId: number, levelId: number): number {
  return subjectId === 4 && levelId === 11 ? 6191 : 8000 + 20 * subjectId + levelId
}

/** PKSK domains (M07 §6.1/§6.8): id → [Bahagian, T1 count, T4 count]. T1 383, T4 380. */
export const PKSK_DOMAINS: Readonly<Record<number, readonly ['A' | 'B' | 'C', number, number]>> = {
  1: ['A', 80, 80],
  2: ['B', 27, 27],
  3: ['B', 27, 27],
  4: ['B', 27, 27],
  5: ['B', 27, 24],
  6: ['B', 20, 20],
  7: ['B', 20, 20],
  8: ['B', 20, 20],
  9: ['B', 20, 20],
  10: ['B', 20, 20],
  11: ['B', 20, 20],
  12: ['B', 20, 20],
  13: ['B', 20, 20],
  14: ['B', 20, 20],
  15: ['C', 15, 15],
}
/** PKSK difficulty split 253 / 253 / 191 / 66 / 0 (v1.11, M17 XR-10; required of M07). */
export const PKSK_DIFFICULTY = [253, 253, 191, 66] as const
export const PKSK_TOTAL = 763
export const PKSK_ID_RANGE = { min: 177698, max: 178460 } as const

/** S6 "Mengikut Subjek" Purata (1 decimal) per subject. */
export const S6_SUBJECT_MEAN: Readonly<Record<number, number>> = {
  7: 96.4,
  22: 96.0,
  5: 96.0,
  9: 95.9,
  25: 95.8,
  6: 95.5,
  27: 95.5,
  23: 95.4,
  1: 95.3,
  12: 95.2,
  20: 95.0,
  2: 94.8,
  10: 94.6,
  21: 94.0,
  13: 93.9,
  11: 93.4,
  4: 93.2,
  17: 93.0,
  14: 93.0,
  26: 93.0,
  16: 92.9,
  3: 91.9,
  15: 91.6,
  8: 90.8,
  18: 88.1,
  24: 88.0,
}

/** S6 "Mengikut Tingkatan" average per level (1 decimal). */
export const S6_LEVEL_MEAN: Readonly<Record<number, number>> = {
  1: 95.4,
  2: 94.7,
  3: 96.6,
  4: 95.4,
  5: 96.9,
  6: 95.6,
  7: 93.6,
  8: 93.3,
  9: 93.2,
  10: 93.8,
  11: 93.4,
}

/** Observed M04 totals (SRS §4.1). */
export const TOTALS = {
  all: 465278,
  active: 129389,
  eligible: 128989,
  approved: 146330,
  archived: 318948,
  archivedActive: 400,
  approvedInactive: 17341,
  pksk: 763,
  scored: 147026,
  datasetN: 466041,
  spmPool: 21033,
  flaggedMcq: 6144,
} as const

/** Q-DIFFICULTY (active ∪ PKSK) by difficulty 1–5 (M05 S1 chart). */
export const Q_DIFFICULTY = [39694, 47138, 33720, 9600, 0] as const

/** Structured dataset (M04 §6.13.3): subject → count (S8 pills). Σ 4,064; ids 393–4456. */
export const STRUCTURED_BY_SUBJECT: Readonly<Record<number, number>> = {
  2: 774,
  1: 560,
  11: 219,
  22: 42,
  9: 246,
  12: 21,
  10: 232,
  3: 299,
  8: 256,
  23: 763,
  21: 76,
  4: 204,
  17: 22,
  5: 328,
  25: 22,
}
export const STRUCTURED_TOTAL = 4064
export const STRUCTURED_VISIBLE = 4059
export const STRUCTURED_ID_RANGE = { min: 393, max: 4456 } as const
export const STRUCTURED_KBAT5 = 483
export const STRUCTURED_NEEDS_DIAGRAM = 522

/** S1 tile totals (Q-ALL(subject), discovery §2.1); Bahasa Tamil 25,800 and Bahasa Cina 0 (DV-M04-04). */
export const S1_TOTAL_BY_SUBJECT: Readonly<Record<number, number>> = {
  1: 32905,
  2: 18902,
  3: 38504,
  4: 42335,
  5: 20414,
  6: 27962,
  7: 38481,
  8: 7580,
  9: 2818,
  10: 7303,
  11: 14001,
  12: 21318,
  13: 48360,
  14: 18305,
  15: 17345,
  16: 1811,
  17: 21504,
  18: 21913,
  19: 0,
  20: 25800,
  21: 6052,
  22: 5591,
  23: 5410,
  24: 3970,
  25: 4990,
  26: 8316,
  27: 3388,
  28: 0,
  29: 0,
  30: 0,
  31: 0,
}

/** Q-ELIGIBLE(subject) as listed in SRS §4.1 (M05 S1/S2 subject cards). Σ 128,989. */
export const ELIGIBLE_BY_SUBJECT: Readonly<Record<number, number>> = {
  1: 11688,
  2: 8039,
  3: 13872,
  4: 12165,
  5: 6508,
  6: 9154,
  7: 15014,
  8: 2101,
  9: 1261,
  10: 2245,
  11: 4235,
  12: 5997,
  13: 4910,
  14: 1800,
  15: 2900,
  16: 200,
  17: 1100,
  18: 5400,
  19: 0,
  20: 6300,
  21: 2970,
  22: 2770,
  23: 2732,
  24: 1000,
  25: 1300,
  26: 2100,
  27: 1228,
}

/** Q-ACTIVE(level) = M03 S9 "Soalan" (Table A column sums). Σ 129,380. */
export const ACTIVE_BY_LEVEL: Readonly<Record<number, number>> = {
  1: 11396,
  2: 10245,
  3: 5776,
  4: 4787,
  5: 3874,
  6: 4464,
  7: 19455,
  8: 15700,
  9: 13800,
  10: 19113,
  11: 20770,
}

/** S6 "Purata Skor" 94.1 (SRS §6.13.1: the overall mean is 94.14). */
export const S6_OVERALL_MEAN = 94.14

// ---------------------------------------------------------------------------------------------
// v1.11 (XL batch 3): coverage, teacher contributions, Jutawan store, import runs, M18 block
// ---------------------------------------------------------------------------------------------

/**
 * `coverageExcluded` rows per subject × level (BR-M04-38, Table A caption): active, approved,
 * difficulty 1–3. Σ 1,746; the 9 level-less Matematik rows are `NULL_LEVEL_ACTIVE`. Level index as
 * the tables (D1…T5).
 */
export const COVERAGE_EXCLUDED: Readonly<Record<number, Row11>> = {
  3: [9, 33, 5, 61, 10, 8, null, null, null, 11, 372],
  4: [null, null, null, null, 11, 10, null, null, null, null, 16],
  5: [null, null, null, null, 5, 4, null, null, null, 15, 16],
  6: [null, null, null, null, null, null, null, null, null, 2, null],
  8: [null, null, null, null, null, null, null, null, null, null, 23],
  9: [null, null, null, null, null, null, null, null, null, null, 10],
  10: [null, null, null, null, null, null, null, null, null, null, 22],
  11: [null, null, null, null, null, null, null, null, null, null, 3],
  12: [null, null, null, null, null, null, null, null, null, null, 305],
  21: [null, null, null, null, null, null, null, null, null, null, 641],
  22: [null, null, null, null, null, null, null, null, null, null, 145],
}
export const COVERAGE_EXCLUDED_TOTAL = 1746

/**
 * Excluded rows by difficulty 1–3 (Σ 473 / 731 / 542 / 0): the observed per-subject splits; the
 * other subjects share the rest (75 / 118 / 89) by a fit (PROPOSED).
 */
export const COVERAGE_EXCLUDED_DIFFICULTY_TOTAL = [473, 731, 542] as const
export const COVERAGE_EXCLUDED_DIFFICULTY: Readonly<
  Record<number, readonly [number, number, number]>
> = {
  21: [174, 269, 198],
  3: [141, 216, 161],
  12: [83, 128, 94],
}

/**
 * M17 S10 "Taburan Kesukaran Mengikut Subjek": Q-M17-COV (covered active rows) by difficulty 1–4
 * per subject (OBSERVED; difficulty 5 = 0). Σ 38,968 / 46,154 / 32,987 / 9,534.
 */
export const S10_DIFFICULTY: Readonly<Record<number, readonly [number, number, number, number]>> = {
  18: [2826, 1287, 1287, 0],
  2: [2105, 2587, 2581, 766],
  1: [3018, 4608, 2880, 1182],
  20: [2142, 2079, 2079, 0],
  11: [10, 2429, 1119, 674],
  22: [269, 861, 983, 512],
  9: [66, 447, 540, 198],
  12: [3480, 1659, 383, 170],
  26: [2016, 42, 21, 21],
  10: [42, 1557, 492, 132],
  3: [3614, 4398, 4460, 882],
  8: [0, 985, 976, 117],
  24: [340, 330, 330, 0],
  6: [4614, 1907, 1937, 694],
  15: [2372, 264, 264, 0],
  7: [2763, 6686, 3959, 2006],
  14: [1008, 396, 396, 0],
  13: [1914, 1191, 1490, 315],
  27: [0, 384, 522, 322],
  23: [475, 1532, 641, 84],
  21: [240, 1526, 384, 179],
  16: [68, 66, 66, 0],
  4: [3846, 4363, 3176, 743],
  17: [374, 363, 363, 0],
  5: [1075, 4015, 1158, 220],
  25: [291, 192, 500, 317],
}
export const Q_M17_COV = 127643

/**
 * Q-TEACHER-CONTRIB (BR-M04-38 c, M17 XR-20): generated contributions of active teachers, per
 * school of the teacher (0 = the other active teachers, PROPOSED all MCQ). Σ 11,414.
 * `teacherId`: the M02 v1.20 contributor anchor (first published in v1.18) that is the `createdBy` of the school's rows
 * (4501–4504). The 7,565 rows of the other teachers have no published teacher id yet and keep the
 * generated creator (`null` here → 5801).
 */
export const TEACHER_CONTRIB: readonly {
  schoolId: number
  teacherId: number | null
  mcq: number
  structured: number
}[] = [
  { schoolId: 8087, teacherId: 4501, mcq: 1368, structured: 1064 },
  { schoolId: 8107, teacherId: 4502, mcq: 1184, structured: 219 },
  { schoolId: 8880, teacherId: 4503, mcq: 13, structured: 0 },
  { schoolId: 8090, teacherId: 4504, mcq: 1, structured: 0 },
  { schoolId: 0, teacherId: null, mcq: 7565, structured: 0 },
]

/** Question holes (F-09 `absentIds`, M04 v1.13): 108527 (report 1's deleted question, BR-M04-30), 564156 (S1 page 1). */
export const QUESTION_ABSENT_IDS: readonly number[] = [108527, 564156]
export const TEACHER_CONTRIB_TOTAL = 11414

/** M18 critical-question anchor block (XL3-11). */
export const M18_ANCHOR_RANGE = { min: 701001, max: 701099 } as const

/**
 * `jutawanQuestions` cells (BR-M04-37, M16 discovery A.7): level → subject → count. 143 cells,
 * Σ 149,911; each split evenly over difficulty 1–4 (largest remainder, PROPOSED).
 */
export const JUTAWAN_CELLS: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 1009, 2: 1027, 3: 2754, 4: 3288, 5: 862, 6: 985, 7: 1013, 12: 200, 18: 400, 26: 300 },
  2: { 1: 2583, 2: 1307, 3: 2200, 4: 674, 5: 518, 6: 1124, 7: 1265, 12: 200, 18: 400, 26: 300 },
  3: { 1: 843, 2: 907, 3: 733, 4: 574, 5: 563, 6: 893, 7: 717, 12: 200, 18: 400, 26: 300 },
  4: { 1: 579, 2: 563, 3: 1077, 4: 616, 5: 660, 6: 369, 7: 312, 12: 200, 18: 500, 26: 400 },
  5: { 1: 448, 2: 464, 3: 688, 4: 400, 5: 500, 6: 400, 7: 400, 12: 200, 18: 500, 26: 400 },
  6: { 1: 666, 2: 1392, 3: 1022, 4: 578, 5: 232, 6: 400, 7: 417, 12: 200, 18: 500, 26: 400 },
  7: {
    1: 2407,
    2: 1609,
    3: 1937,
    4: 1615,
    5: 2974,
    6: 1793,
    7: 3593,
    12: 1952,
    13: 1710,
    14: 600,
    15: 1000,
    17: 400,
    18: 500,
    20: 2100,
    27: 363,
  },
  8: {
    1: 2088,
    2: 400,
    3: 1870,
    4: 1588,
    5: 1288,
    6: 1798,
    7: 1788,
    12: 1356,
    13: 1100,
    14: 500,
    15: 1100,
    16: 200,
    17: 300,
    18: 500,
    20: 2100,
  },
  9: {
    1: 1788,
    3: 1470,
    4: 1288,
    5: 1088,
    6: 1788,
    7: 1688,
    12: 1456,
    13: 1000,
    14: 700,
    15: 800,
    17: 400,
    18: 500,
    20: 2100,
  },
  10: {
    1: 369,
    2: 662,
    3: 2204,
    4: 2795,
    5: 1013,
    6: 659,
    7: 2573,
    8: 1400,
    9: 1126,
    10: 1495,
    11: 2508,
    12: 250,
    13: 550,
    18: 600,
    21: 845,
    22: 1393,
    23: 727,
    24: 500,
    25: 675,
    27: 737,
  },
  11: {
    1: 515,
    2: 1475,
    3: 1617,
    4: 2274,
    5: 966,
    6: 264,
    7: 2230,
    8: 1202,
    9: 1069,
    10: 1197,
    11: 2075,
    12: 978,
    13: 550,
    18: 600,
    21: 2125,
    22: 1803,
    23: 2005,
    24: 500,
    25: 625,
    27: 143,
  },
}
export const JUTAWAN_TOTAL = 149911

/** ImportRun D11 set (§6.13.5): 1,123 runs, Σ `importedCount` 31,101, none in Aug–Sep 2026. */
export const IMPORT_RUNS = {
  total: 1123,
  imported: 31101,
  anchor: {
    fileName: 'soalan-bm-d3.csv',
    importedCount: 12,
    failedCount: 1,
    createdAt: '2026-07-20T10:30:00+08:00',
  },
} as const
