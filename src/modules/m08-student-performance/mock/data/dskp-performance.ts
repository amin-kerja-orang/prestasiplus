/**
 * Designed DSKP performance of the SMK DEMO pupils (UAT 2026-10-24, S-52 "DSKP Heatmap tidak terpapar
 * jelas"; D45 small data, D54 secondary only): Standard Pembelajaran records for Matematik T4, Sejarah T4
 * and Kimia T5, so the school admin's DSKP heatmap shows several Bidang rows with values in all three bands.
 *
 * The SP ids are the demo standards of M10 (`DEMO_STANDARD_SP_IDS`, seed `buildDskp`). Pupils: canonical 2
 * ("pelajar", Tingkatan 4) and the pupils 3001–3008 of the guru's classes 2001 / 2002 ("5 MARIKH").
 * Values are designed, not derived from the answer log, so the records are stored with origin `anchor`
 * (they do not feed the S6 weak topics, which read `log` records only). An SP without an entry stays
 * "Belum Cuba". All values are literal and asserted by the tests.
 */

/** `[spId, [userId, answered, correct][]]` per subject. */
type SpPerformance = readonly (readonly [spId: number, rows: readonly Row[]])[]
type Row = readonly [userId: number, answered: number, correct: number]

/** Matematik T4 (subject 3). Pooled: 80, 78, 60, 56, 82, 38, -, 80, 63, 33, 82, 75 %. */
const MATEMATIK_T4: SpPerformance = [
  [
    8070,
    [
      [2, 6, 5],
      [3001, 5, 4],
      [3002, 4, 3],
    ],
  ],
  [
    9501,
    [
      [2, 5, 4],
      [3001, 4, 3],
    ],
  ],
  [
    9502,
    [
      [2, 6, 4],
      [3001, 5, 3],
      [3003, 4, 2],
    ],
  ],
  [
    9503,
    [
      [2, 5, 3],
      [3002, 4, 2],
    ],
  ],
  [
    9504,
    [
      [3001, 6, 5],
      [3002, 5, 4],
    ],
  ],
  [
    9505,
    [
      [3001, 4, 2],
      [3003, 4, 1],
    ],
  ],
  [
    9507,
    [
      [2, 5, 4],
      [3002, 5, 4],
    ],
  ],
  [
    9508,
    [
      [2, 4, 2],
      [3003, 4, 3],
    ],
  ],
  [
    9509,
    [
      [3001, 5, 2],
      [3002, 4, 1],
    ],
  ],
  [
    9510,
    [
      [2, 6, 5],
      [3003, 5, 4],
    ],
  ],
  [9511, [[3002, 4, 3]]],
]

/** Sejarah T4 (subject 5). Pooled: 79, 63, 56, 38, 83, 63, 25, 75, - %. */
const SEJARAH_T4: SpPerformance = [
  [
    8110,
    [
      [2, 5, 4],
      [3001, 5, 4],
      [3002, 4, 3],
    ],
  ],
  [
    9512,
    [
      [2, 4, 3],
      [3003, 4, 2],
    ],
  ],
  [
    9513,
    [
      [3001, 5, 3],
      [3002, 4, 2],
    ],
  ],
  [
    9514,
    [
      [2, 5, 2],
      [3003, 3, 1],
    ],
  ],
  [9515, [[3001, 6, 5]]],
  [
    9516,
    [
      [3002, 4, 3],
      [2, 4, 2],
    ],
  ],
  [9517, [[3003, 4, 1]]],
  [
    9518,
    [
      [2, 5, 4],
      [3001, 3, 2],
    ],
  ],
]

/** Kimia T5 (subject 10), the Standard Pembelajaran beside the designed 9001–9004. Pooled: 73, 71, 58, 71, 25, 75, - %. */
const KIMIA_T5: SpPerformance = [
  [
    8211,
    [
      [3001, 4, 3],
      [3002, 4, 3],
      [3004, 3, 2],
    ],
  ],
  [
    9520,
    [
      [3001, 5, 4],
      [3002, 5, 3],
      [3003, 4, 3],
    ],
  ],
  [
    9521,
    [
      [3004, 4, 2],
      [3005, 4, 2],
      [3006, 4, 3],
    ],
  ],
  [
    9522,
    [
      [3001, 4, 4],
      [3007, 3, 1],
    ],
  ],
  [
    9523,
    [
      [3002, 5, 2],
      [3005, 4, 1],
      [3008, 3, 0],
    ],
  ],
  [
    9524,
    [
      [3003, 4, 3],
      [3006, 4, 3],
    ],
  ],
]

export interface DesignedSpPerformance {
  userId: number
  subjectId: number
  dskpSpId: number
  answered: number
  correct: number
}

/** The designed records, subject by subject (Matematik 3, Sejarah 5, Kimia 10), in table order. */
export const DESIGNED_SP_PERFORMANCE: readonly DesignedSpPerformance[] = (
  [
    [3, MATEMATIK_T4],
    [5, SEJARAH_T4],
    [10, KIMIA_T5],
  ] as const
).flatMap(([subjectId, table]) =>
  table.flatMap(([dskpSpId, rows]) =>
    rows.map(([userId, answered, correct]) => ({
      userId,
      subjectId,
      dskpSpId,
      answered,
      correct,
    })),
  ),
)
