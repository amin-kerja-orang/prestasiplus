/**
 * `User.lastActiveAt` (M02 SRS v1.23 DATA-M02-01, §6.14 "Activity dates"; M18 XR-M18-21): a stored
 * activity date, separate from `lastLoginAt`. The 169 M18-visible pupils carry the observed
 * "Terakhir aktif" dates of M18 S22 / S28 / S18 / S17 (time 12:00 MYT, PROPOSED; "Tiada aktiviti"
 * → null): 115 dated / 54 null. Every other user: `lastActiveAt` = `lastLoginAt`.
 *
 * The M18 pupils are mostly generated rows, so the dates are assigned to them once, after the
 * dataset compiles (M01 `finalise`), by a deterministic rule over the school's pupils in id order:
 * 1. entries with a stated grade (e.g. 7780 "T4 … 02-26") take the first unassigned pupil of that
 *    grade;
 * 2. undated entries without a grade take the first unassigned pupil who never logged in (then any);
 * 3. dated entries without a grade take the remaining pupils in id order, in the listed (live rank)
 *    order.
 * Anchors carry their value literally (3201–3215 and 4320 null; 4321 2026-02-27), and their entries
 * are not listed below.
 *
 * The class-1156 pupil is user 4627 (v1.26; 8082, grade 11): 2026-09-15 12:00, a literal anchor
 * value, so all 169 pupils (115 dated / 54 null) are seeded (168 here + 4627).
 */

/** One observed activity entry: grade (1–11) or null (any), and the MM-DD date or null. */
type Entry = readonly [grade: number | null, date: string | null]

const T = (form: number) => 6 + form // Tingkatan n → grade 6 + n

function times(n: number, entry: Entry): Entry[] {
  return Array.from({ length: n }, () => entry)
}

/** Entries of the generated pupils per school (anchors excluded). */
export const M18_ACTIVITY: Readonly<Record<number, readonly Entry[]>> = {
  // 7780: 15 dated / 2 null (T4 "4 Dedikasi - BM", T5 no class).
  7780: [
    [T(4), '02-26'],
    [T(1), '02-26'],
    [T(3), '02-27'],
    [T(5), '02-27'],
    [T(2), '02-27'],
    [T(1), '02-26'],
    [T(3), '02-26'],
    [T(5), '02-28'],
    [T(1), '02-26'],
    [T(2), '02-28'],
    [T(3), '02-28'],
    [T(4), '02-27'],
    [T(1), '02-27'],
    [T(2), '02-26'],
    [T(3), '02-28'],
    [T(4), null],
    [T(5), null],
  ],
  // School 1: 14 dated / 2 null (rank order).
  1: [
    ...(
      [
        '02-26',
        '02-28',
        '02-27',
        '02-27',
        '02-28',
        '02-27',
        '02-27',
        '02-26',
        '02-28',
        '02-26',
        '02-28',
        '02-28',
        '02-28',
        '02-28',
      ] as const
    ).map((d): Entry => [null, d]),
    [null, null],
    [null, null],
  ],
  // 8880 (generated pupils; the anchors 3201–3215 and 4320 are null): 13 no-session pupils, the 4
  // session pupils (class 517 ×3, "Tiada Kelas" 90% pupil), the rest null.
  8880: [
    [T(5), '05-19'],
    [6, '02-26'],
    [T(5), '02-26'],
    [T(2), '02-28'],
    [T(4), '02-27'],
    [T(1), '02-26'],
    [T(5), '02-28'],
    [T(2), '02-26'],
    [T(4), '02-27'],
    [T(4), '02-27'],
    [T(5), '02-27'],
    [T(4), '02-27'],
    [T(5), '02-26'],
    [T(5), '03-17'],
    [T(5), '03-21'],
    [T(5), '03-26'],
    [T(5), '02-27'],
    ...times(7, [T(4), null]),
    ...times(17, [T(5), null]),
    ...times(2, [null, null]),
  ],
  // 8765: 19 dated / 2 null (a T5 pupil with mastery L1; one no-class pupil without mastery).
  8765: [
    ...times(7, [null, '02-26']),
    ...times(9, [null, '02-27']),
    ...times(2, [null, '02-28']),
    [null, '03-21'],
    [T(5), null],
    [null, null],
  ],
  8767: [
    ...times(6, [null, '02-26']),
    [null, '02-27'],
    ...times(4, [null, '02-28']),
    ...times(2, [null, null]),
  ],
  8772: [
    ...times(2, [null, '02-26']),
    ...times(2, [null, '02-27']),
    ...times(6, [null, '02-28']),
    ...times(2, [null, null]),
  ],
  2700: [
    [null, '02-26'],
    ...times(6, [null, '02-27']),
    ...times(5, [null, '02-28']),
    ...times(2, [null, null]),
  ],
  3160: [...times(3, [null, '02-26']), ...times(3, [null, '02-27']), ...times(6, [null, '02-28'])],
  // 2710: 4 dated; 4321 (anchor) takes 02-27.
  2710: [
    [null, '05-19'],
    [null, '05-21'],
    [null, '02-26'],
  ],
}

/** The literal `lastActiveAt` of M18-visible anchors. */
export const M18_ACTIVITY_ANCHORS: Readonly<Record<number, string | null>> = {
  ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [3201 + i, null])),
  4320: null,
  4321: '2026-02-27T12:00:00+08:00',
  // M18 v1.8 XR-M18-21: the class-1156 pupil (M02 v1.26).
  4627: '2026-09-15T12:00:00+08:00',
}

export function activityIso(date: string | null): string | null {
  return date === null ? null : `2026-${date}T12:00:00+08:00`
}

export interface ActivityRow {
  id: number
  schoolId: number | null
  grade: number | null
  hasLoggedIn: boolean
}

/**
 * Assigns the entries of `M18_ACTIVITY` to the generated pupils (`rows`, anchors excluded).
 * Returns id → ISO date or null, and the problems found (a school whose pupil count differs from
 * its entries, or an entry without a pupil of its grade).
 */
export function assignActivity(rows: readonly ActivityRow[]): {
  values: Map<number, string | null>
  issues: string[]
} {
  const values = new Map<number, string | null>()
  const issues: string[] = []
  for (const [schoolText, entries] of Object.entries(M18_ACTIVITY)) {
    const school = Number(schoolText)
    const pupils = rows.filter((r) => r.schoolId === school).sort((a, b) => a.id - b.id)
    if (pupils.length !== entries.length) {
      issues.push(
        `lastActiveAt ${schoolText}: ${String(pupils.length)} pupils, ${String(entries.length)} entries`,
      )
      continue
    }
    const free = new Set(pupils.map((p) => p.id))
    const take = (pred: (p: ActivityRow) => boolean): ActivityRow | undefined => {
      const p = pupils.find((x) => free.has(x.id) && pred(x))
      if (p) free.delete(p.id)
      return p
    }
    const graded = entries.filter(([g]) => g !== null)
    const nulls = entries.filter(([g, d]) => g === null && d === null)
    const dated = entries.filter(([g, d]) => g === null && d !== null)
    for (const [grade, date] of graded) {
      const p = take((x) => x.grade === grade)
      if (!p) issues.push(`lastActiveAt ${schoolText}: no free pupil of grade ${String(grade)}`)
      else values.set(p.id, activityIso(date))
    }
    for (const [, date] of nulls) {
      const p = take((x) => !x.hasLoggedIn) ?? take(() => true)
      if (p) values.set(p.id, activityIso(date))
    }
    for (const [, date] of dated) {
      const p = take(() => true)
      if (p) values.set(p.id, activityIso(date))
    }
  }
  return { values, issues }
}

/** The compiled assignment (set by the M01 `finalise`; empty before). */
let compiled: ReadonlyMap<number, string | null> = new Map()

export function setCompiledActivity(values: ReadonlyMap<number, string | null>): void {
  compiled = values
}

/** `true` + the value when the pupil has a seeded activity date (null included). */
export function compiledActivity(id: number): { has: boolean; value: string | null } {
  return compiled.has(id)
    ? { has: true, value: compiled.get(id) ?? null }
    : { has: false, value: null }
}

/** Seeded counts (for the build check): dated / null over the compiled assignment. */
export function compiledActivityCounts(): { dated: number; nulls: number } {
  let dated = 0
  let nulls = 0
  for (const v of compiled.values()) {
    if (v === null) nulls++
    else dated++
  }
  return { dated, nulls }
}
