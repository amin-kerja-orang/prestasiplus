/**
 * M08-T1b seed (SRS M08 v1.12 §6.3, §6.4, §6.10; overview §6.9): the headcount configs and entries, and
 * the registration of the headcount reader (`registerHeadcountReads`) on every boot and every
 * `mock.reset()` (the T1 seed no longer resets it). Runs in the finalise phase, after the M01 users and
 * the M10 classes exist (D12: only their public mock entries are read).
 *
 * Population, all computed (never tuned) from `headcount-data.ts` and the rows below:
 * - class 516 "4 Simulasi" (8880, T4): configs 209–213, 75 pairs (34 On Track / 41 Below) with the live
 *   TOV / AR3 pairs of config 213 and the 14 at-risk rows of 209–212 (OBSERVED);
 * - the designed configs 501–506 of teacher 5 (SMK DEMO, school admin GPS 5.33 from 6 graded entries);
 * - the 73 T5 entries of 8880 pupils (class 517, 540, 628) → 148 graded entries for 8880 (GPS 2.49);
 * - M12 XR-M12-04 (pupils 4664, 4644 of 8080, TOV only) and M17 XR-M17-13 (config 617 of class 370, 30
 *   entries; pupil 2022);
 * - generated filler (T5 level 11: 14 observed at-risk rows + 246; other levels: 330) that completes the
 *   platform allocation: 744 graded entries, grade counts and the 16 subject rows of discovery A.2,
 *   T5 pairs 114 On Track / 289 Below.
 *
 * DEFERRED (DL decision): XR-M18-06 KLUANG coverage (65 pupils in configs of KLUANG classes, 64 graded) is
 * not seeded; only 8880 has M10 classes in the district, and M18-T1a decides how to satisfy it. Accepted
 * deviation: 8880's 41 Matematik / 34 Sains pins cover 30 enrolled pupils, so 15 pupil-subject pairs repeat.
 *
 * INFERRED (unobserved): the class / teacher placement of generated configs (classes of schools outside
 * the monitored set, in a stable order), config dates, ETR = latest AR and RS = AR3 of the generated
 * class-516 rows, the pupils of the other-level configs (members of those classes).
 */

import { users } from '@/modules/m01-authentication/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import { registerHeadcountReads } from '../repository/headcount-port'
import { headcountRepo } from '../repository/headcount'
import type {
  ConfidenceLabel,
  HeadcountConfigRow,
  HeadcountEntryRow,
  HeadcountMode,
  TrendLabel,
} from '../repository/headcount-types'
import {
  AT_RISK_GROUPS,
  L11_GROUPS,
  OTHER_LEVEL_GROUPS,
  T4_ROWS,
  T5_8880_GROUPS,
  type MarkGroup,
  type Marks,
} from './headcount-data'

const YEAR = 2026
/**
 * Schools whose pupils keep only the pinned entries (8880 pins, 900001 GPS 5.33, 8080 / 8082 / 8102
 * monitoring). One observed exception: 8080 also holds the graded rows of class 366 "5 SAINS TULEN", an
 * observed T5 at-risk anchor (`seedAtRisk`).
 */
const PINNED_SCHOOLS: ReadonlySet<number> = new Set([8880, 900001, 8080, 8082, 8102])
/** Pinned schools where no observed at-risk class may sit (8080 is allowed for class 366 only). */
const AT_RISK_FORBIDDEN_SCHOOLS: ReadonlySet<number> = new Set([8102, 8082, 8880, 900001])
const GENERATED_CONFIG_START = 701

interface Builder {
  configs: HeadcountConfigRow[]
  entries: HeadcountEntryRow[]
  nextEntry: number
  nextConfig: number
  /** `classId:subjectId:year:mode` already used. */
  keys: Set<string>
  /** `studentId:subjectId` already holding an entry (a pupil gets a subject once among the generated entries). */
  held: Set<string>
}

const slots = (n: number, values: readonly (number | null)[] = []): (number | null)[] =>
  Array.from({ length: n }, (_, i) => values[i] ?? null)

function addConfig(
  b: Builder,
  c: Omit<HeadcountConfigRow, 'status' | 'mode' | 'academicYear'> &
    Partial<Pick<HeadcountConfigRow, 'mode' | 'academicYear'>>,
): HeadcountConfigRow {
  const row: HeadcountConfigRow = {
    mode: 'auto',
    academicYear: YEAR,
    status: 'active',
    ...c,
  }
  b.keys.add(
    `${String(row.classroomId)}:${String(row.subjectId)}:${String(row.academicYear)}:${row.mode}`,
  )
  b.configs.push(row)
  return row
}

function addEntry(
  b: Builder,
  configId: number,
  activeOtrs: number,
  studentId: number,
  marks: {
    tov?: number | null
    targets?: readonly (number | null)[]
    actuals?: readonly (number | null)[]
    etr?: number | null
    rs?: number | null
    rsRecordedAt?: string | null
    trend?: TrendLabel
    confidence?: ConfidenceLabel
  } = {},
): void {
  const row: HeadcountEntryRow = {
    id: b.nextEntry++,
    configId,
    studentId,
    tov: marks.tov ?? null,
    targets: slots(activeOtrs, marks.targets),
    actuals: slots(activeOtrs, marks.actuals),
    etr: marks.etr ?? null,
    rs: marks.rs ?? null,
    rsRecordedAt: marks.rsRecordedAt ?? null,
    dropped: false,
  }
  if (marks.trend !== undefined) row.trendOverride = marks.trend
  if (marks.confidence !== undefined) row.confidenceOverride = marks.confidence
  b.entries.push(row)
}

const teacherOf = (classId: number): number => {
  const c = classrooms.get('classroom', classId)
  if (!c || c.teacherId === null) {
    throw new Error(`M08 headcount seed: class ${String(classId)} has no teacher`)
  }
  return c.teacherId
}

const at = (date: string, time = '09:00:00'): string => `${date}T${time}+08:00`

// ---------------------------------------------------------------------------------------------
// Observed and designed configs
// ---------------------------------------------------------------------------------------------

/** Class 516 configs 209–213: subject and `updatedAt` (newest first: Sejarah, Matematik, BM, Sains, BI). */
const T4_CONFIGS: readonly { id: number; subjectId: number; updatedAt: string }[] = [
  { id: 209, subjectId: 1, updatedAt: at('2026-04-11', '11:00:00') },
  { id: 210, subjectId: 2, updatedAt: at('2026-04-09', '11:00:00') },
  { id: 211, subjectId: 3, updatedAt: at('2026-04-12', '11:00:00') },
  { id: 212, subjectId: 4, updatedAt: at('2026-04-10', '11:00:00') },
  { id: 213, subjectId: 5, updatedAt: at('2026-04-13', '11:00:00') },
]

/** The observed S15 anchors of config 213 (RS, recorded date, chips). */
const ANCHORS_213: Readonly<
  Record<number, { recordedAt?: string; trend: TrendLabel; confidence?: ConfidenceLabel }>
> = {
  3201: { recordedAt: '2026-04-13', trend: 'Menurun', confidence: 'Rendah' },
  3202: { trend: 'Stabil' },
  3203: { trend: 'Meningkat' },
}

function seedClass516(b: Builder): void {
  const teacherId = teacherOf(516)
  for (const cfg of T4_CONFIGS) {
    addConfig(b, {
      id: cfg.id,
      teacherId,
      classroomId: 516,
      subjectId: cfg.subjectId,
      educationLevelId: 10,
      activeOtrs: 3,
      createdAt: at('2026-04-01'),
      updatedAt: cfg.updatedAt,
    })
    for (const [pupil, tov, t1, t2, t3, ar3, etr, rs] of T4_ROWS[cfg.id] ?? []) {
      const anchor = cfg.id === 213 ? ANCHORS_213[pupil] : undefined
      addEntry(b, cfg.id, 3, pupil, {
        tov,
        targets: [t1, t2, t3],
        actuals: [null, null, ar3],
        etr,
        rs,
        ...(anchor?.recordedAt ? { rsRecordedAt: anchor.recordedAt } : {}),
        ...(anchor ? { trend: anchor.trend } : {}),
        ...(anchor?.confidence ? { confidence: anchor.confidence } : {}),
      })
    }
  }
}

interface DesignedEntry {
  student: number
  tov?: number
  targets?: (number | null)[]
  actuals?: (number | null)[]
  etr?: number
  rs?: number
}

interface DesignedConfig {
  id: number
  classId: number
  subjectId: number
  levelId: number
  year: number
  otrs: number
  mode: HeadcountMode
  updatedAt: string
  entries: DesignedEntry[]
}

/** §6.10 "Headcount configs of teacher 5" (updatedAt newest first: 504, 501, 502, 503, 505, 506). */
const DESIGNED: readonly DesignedConfig[] = [
  {
    id: 501,
    classId: 2001,
    subjectId: 10,
    levelId: 11,
    year: 2026,
    otrs: 3,
    mode: 'auto',
    updatedAt: at('2026-09-19', '10:00:00'),
    entries: [
      { student: 3001, tov: 60, targets: [62, 66, 70], actuals: [65, 70, null], etr: 75 },
      { student: 3002, tov: 55, targets: [58, null, null], actuals: [50, null, null] },
      { student: 3003, tov: 48, targets: [52, null, null], actuals: [52, null, null] },
      { student: 3004, tov: 40, targets: [45, null, null], actuals: [30, null, null] },
    ],
  },
  {
    id: 502,
    classId: 2001,
    subjectId: 10,
    levelId: 11,
    year: 2026,
    otrs: 3,
    mode: 'manual',
    updatedAt: at('2026-09-18', '10:00:00'),
    entries: [{ student: 3001, tov: 64 }],
  },
  {
    id: 503,
    classId: 2002,
    subjectId: 1,
    levelId: 11,
    year: 2026,
    otrs: 3,
    mode: 'manual',
    updatedAt: at('2026-09-17', '10:00:00'),
    // TOV only; 3001 is observed (58), the others INFERRED.
    entries: [58, 52, 47, 55, 60, 49, 63, 44].map((tov, i) => ({ student: 3001 + i, tov })),
  },
  {
    id: 504,
    classId: 2001,
    subjectId: 5,
    levelId: 11,
    year: 2026,
    otrs: 2,
    mode: 'auto',
    updatedAt: at('2026-09-20', '10:00:00'),
    entries: [{ student: 3001, tov: 50, targets: [55, 60], actuals: [40, 45], etr: 65 }],
  },
  {
    id: 505,
    classId: 2002,
    subjectId: 1,
    levelId: 11,
    year: 2025,
    otrs: 3,
    mode: 'manual',
    updatedAt: at('2026-09-16', '10:00:00'),
    entries: [
      { student: 3001, tov: 62, targets: [65, 70, 75], actuals: [68, 72, 78], etr: 80, rs: 82 },
    ],
  },
  {
    id: 506,
    classId: 2002,
    subjectId: 5,
    levelId: 10,
    year: 2026,
    otrs: 2,
    mode: 'manual',
    updatedAt: at('2026-09-15', '10:00:00'),
    entries: [],
  },
]

function seedDesigned(b: Builder): void {
  for (const d of DESIGNED) {
    addConfig(b, {
      id: d.id,
      teacherId: teacherOf(d.classId),
      classroomId: d.classId,
      subjectId: d.subjectId,
      educationLevelId: d.levelId,
      academicYear: d.year,
      activeOtrs: d.otrs,
      mode: d.mode,
      createdAt: at('2026-01-06'),
      updatedAt: d.updatedAt,
    })
    for (const e of d.entries) {
      addEntry(b, d.id, d.otrs, e.student, {
        tov: e.tov ?? null,
        targets: e.targets ?? [],
        actuals: e.actuals ?? [],
        etr: e.etr ?? null,
        rs: e.rs ?? null,
      })
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Monitoring-school requests (M12 XR-M12-04, M17 XR-M17-13)
// ---------------------------------------------------------------------------------------------

/** M17 R-26: the 30 observed TOVs of config 617 (class 370 "5 PERNIAGAAN"); pupil 2022 holds the first 40. */
const TOV_617: readonly number[] = [
  25, 30, 0, 27, 22, 17, 52, 26, 18, 37, 23, 24, 60, 14, 0, 40, 82.5, 21, 56.3, 50, 66.67, 27, 25,
  18, 29, 11, 0, 19, 40, 30,
]
const FIRST_40 = 15
const UPDATED_0616 = at('2026-06-16', '10:00:00')

/** Subjects of M12 AC-M12-31.1 / 31.2: [subjectId, TOV or null]. */
const STUDENT_A: readonly (readonly [number, number | null])[] = [
  [2, null],
  [1, null],
  [3, null],
  [6, 78],
  [15, null],
  [7, null],
  [23, null],
  [30, null],
  [21, null],
  [4, null],
  [17, null],
  [5, null],
]
const STUDENT_B: readonly (readonly [number, number | null])[] = [
  [2, 20],
  [1, 60],
  [3, 40],
  [6, 55],
  [15, null],
  [7, null],
  [30, null],
  [4, 33.33],
  [28, null],
  [31, 37],
  [5, null],
]

/** Finds or creates the (class, subject, year, auto) config of the monitoring requests. */
function configFor(b: Builder, classId: number, subjectId: number): HeadcountConfigRow {
  const found = b.configs.find(
    (c) =>
      c.classroomId === classId &&
      c.subjectId === subjectId &&
      c.academicYear === YEAR &&
      c.mode === 'auto',
  )
  if (found) return found
  return addConfig(b, {
    id: b.nextConfig++,
    teacherId: teacherOf(classId),
    classroomId: classId,
    subjectId,
    educationLevelId: 11,
    activeOtrs: 3,
    createdAt: UPDATED_0616,
    updatedAt: UPDATED_0616,
  })
}

function seedMonitoring(b: Builder): void {
  // M17: config 617 (class 370, Perniagaan, 30 entries, TOV only).
  addConfig(b, {
    id: 617,
    teacherId: teacherOf(370),
    classroomId: 370,
    subjectId: 23,
    educationLevelId: 11,
    activeOtrs: 3,
    createdAt: UPDATED_0616,
    updatedAt: UPDATED_0616,
  })
  const members = classrooms.memberIds('classroom', 370)
  if (!members.includes(2022) || members.length !== TOV_617.length) {
    throw new Error(
      `M08 headcount seed: class 370 has ${String(members.length)} members (30 incl. 2022 expected)`,
    )
  }
  const others = members.filter((id) => id !== 2022)
  const rest = TOV_617.filter((_, i) => i !== FIRST_40)
  addEntry(b, 617, 3, 2022, { tov: TOV_617[FIRST_40] as number })
  others.forEach((id, i) => addEntry(b, 617, 3, id, { tov: rest[i] as number }))
  // Pupil 2022: Sains and Matematik entries without a TOV in generated configs, updated 2026-06-16.
  for (const subjectId of [4, 3]) addEntry(b, configFor(b, 370, subjectId).id, 3, 2022)
  // M12: pupils 4664 (Student A) and 4644 (Student B) of 8080, TOV only.
  const home = (pupil: number): number =>
    classrooms.forStudent(pupil).find((c) => c.kind === 'classroom' && c.levelId === 11)?.classId ??
    372
  for (const [pupil, list] of [
    [4664, STUDENT_A],
    [4644, STUDENT_B],
  ] as const) {
    for (const [subjectId, tov] of list) {
      addEntry(b, configFor(b, home(pupil), subjectId).id, 3, pupil, { tov })
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Generated population
// ---------------------------------------------------------------------------------------------

interface PoolClass {
  cls: ClassroomRow
  members: number[]
}

/** Classes outside the pinned schools with at least one eligible member, biggest first. */
function poolOf(levelOk: (levelId: number) => boolean): PoolClass[] {
  const out: PoolClass[] = []
  for (const cls of classrooms.list({ kind: 'classroom', isActive: true })) {
    if (cls.teacherId === null || !levelOk(cls.levelId)) continue
    const school = cls.schoolId ?? users.get(cls.teacherId)?.schoolId ?? null
    if (school !== null && PINNED_SCHOOLS.has(school)) continue
    const members = classrooms
      .memberIds('classroom', cls.classId)
      .filter((id) => !PINNED_SCHOOLS.has(users.get(id)?.schoolId ?? -1))
    if (members.length > 0) out.push({ cls, members })
  }
  return out.sort((a, c) => c.members.length - a.members.length || a.cls.classId - c.cls.classId)
}

const hash = (n: number): number => Math.imul(n ^ 0x9e3779b1, 0x85ebca6b) >>> 0

function placedConfig(b: Builder, p: PoolClass, subjectId: number): HeadcountConfigRow {
  const id = b.nextConfig++
  const day = String(1 + (id % 27)).padStart(2, '0')
  return addConfig(b, {
    id,
    teacherId: p.cls.teacherId as number,
    classroomId: p.cls.classId,
    subjectId,
    educationLevelId: p.cls.levelId,
    activeOtrs: 3,
    createdAt: at(`2026-02-${day}`),
    updatedAt: at(`2026-05-${day}`, '14:00:00'),
  })
}

const heldKey = (studentId: number, subjectId: number): string =>
  `${String(studentId)}:${String(subjectId)}`

function addMarks(b: Builder, configId: number, studentId: number, m: Marks): void {
  addEntry(b, configId, 3, studentId, { tov: m[0], targets: m[1], actuals: m[2], etr: m[3] })
}

/** Places the groups' rows into classes of the pool (stable order), one config per class + subject. */
function place(b: Builder, groups: readonly MarkGroup[], pool: readonly PoolClass[]): void {
  if (pool.length === 0)
    throw new Error('M08 headcount seed: no class to place the generated entries in')
  for (const g of groups) {
    const remaining = [...g.rows]
    let at = hash(g.subjectId) % pool.length
    let guard = 0
    while (remaining.length > 0) {
      if (guard++ > pool.length * 2) throw new Error('M08 headcount seed: not enough classes')
      const p = pool[at % pool.length] as PoolClass
      at++
      const key = `${String(p.cls.classId)}:${String(g.subjectId)}:${String(YEAR)}:auto`
      if (b.keys.has(key)) continue
      const eligible = p.members.filter((id) => !b.held.has(heldKey(id, g.subjectId)))
      if (eligible.length === 0) continue
      const chunk = remaining.splice(0, Math.min(eligible.length, remaining.length))
      const cfg = placedConfig(b, p, g.subjectId)
      chunk.forEach((m, i) => {
        b.held.add(heldKey(eligible[i] as number, g.subjectId))
        addMarks(b, cfg.id, eligible[i] as number, m)
      })
    }
  }
}

/**
 * The entries of configs of the other levels (Darjah, Tingkatan 1–3; Auto-Setup levels 1–9). The M10 classes
 * of those levels have no member, so the pupils are the active pupils of that grade outside the pinned
 * schools (INFERRED); each (class, subject) holds distinct pupils.
 */
function placeOtherLevels(b: Builder, groups: readonly MarkGroup[]): void {
  const pupilsByGrade = new Map<number, number[]>()
  for (const u of users.query('U-ROLE', { sort: 'id' }, 'student').rows) {
    if (u.grade === null || u.grade < 1 || u.grade > 9 || !u.isActive) continue
    if (PINNED_SCHOOLS.has(u.schoolId ?? -1)) continue
    pupilsByGrade.set(u.grade, [...(pupilsByGrade.get(u.grade) ?? []), u.id])
  }
  const classesByLevel = new Map<number, ClassroomRow[]>()
  for (const cls of classrooms.list({ kind: 'classroom', isActive: true })) {
    if (cls.teacherId === null || cls.levelId < 1 || cls.levelId > 9) continue
    const school = cls.schoolId ?? users.get(cls.teacherId)?.schoolId ?? null
    if (school !== null && PINNED_SCHOOLS.has(school)) continue
    classesByLevel.set(cls.levelId, [...(classesByLevel.get(cls.levelId) ?? []), cls])
  }
  for (const g of groups) {
    const perLevel = new Map<number, Marks[]>()
    const start = hash(g.subjectId) % 9
    g.rows.forEach((m, i) => {
      const level = 1 + ((start + i) % 9)
      perLevel.set(level, [...(perLevel.get(level) ?? []), m])
    })
    for (const [level, rows] of [...perLevel.entries()].sort((a, c) => a[0] - c[0])) {
      const pupils = pupilsByGrade.get(level) ?? []
      const classes = (classesByLevel.get(level) ?? []).sort((a, c) => a.classId - c.classId)
      if (pupils.length === 0 || classes.length === 0) {
        throw new Error(
          `M08 headcount seed: level ${String(level)} has no class or pupil for the generated entries`,
        )
      }
      const remaining = [...rows]
      let at = hash(g.subjectId * 31 + level) % classes.length
      let guard = 0
      while (remaining.length > 0) {
        if (guard++ > classes.length * 2)
          throw new Error('M08 headcount seed: not enough classes (other levels)')
        const cls = classes[at % classes.length] as ClassroomRow
        at++
        if (b.keys.has(`${String(cls.classId)}:${String(g.subjectId)}:${String(YEAR)}:auto`))
          continue
        const eligible = pupils.filter((id) => !b.held.has(heldKey(id, g.subjectId)))
        if (eligible.length === 0) continue
        const chunk = remaining.splice(0, Math.min(eligible.length, remaining.length))
        const cfg = placedConfig(b, { cls, members: eligible }, g.subjectId)
        const offset = hash(g.subjectId * 7 + level) % eligible.length
        chunk.forEach((m, i) => {
          const pupil = eligible[(offset + i) % eligible.length] as number
          b.held.add(heldKey(pupil, g.subjectId))
          addMarks(b, cfg.id, pupil, m)
        })
      }
    }
  }
}

/** The 73 T5 entries of 8880 pupils: members of the named 8880 classes in id order. */
function seed8880T5(b: Builder): void {
  for (const g of T5_8880_GROUPS) {
    const cls = classrooms.get('classroom', g.classId)
    if (!cls || cls.teacherId === null) {
      throw new Error(`M08 headcount seed: class ${String(g.classId)} (8880) is missing`)
    }
    const members = classrooms.memberIds('classroom', g.classId)
    if (members.length < g.rows.length) {
      throw new Error(
        `M08 headcount seed: class ${String(g.classId)} has ${String(members.length)} members`,
      )
    }
    const cfg = placedConfig(b, { cls, members }, g.subjectId)
    g.rows.forEach((m, i) => addMarks(b, cfg.id, members[i] as number, m))
  }
}

/**
 * The class names of the observed T5 at-risk rows (discovery lines 1196–1209), in the order of
 * `AT_RISK_GROUPS`: LEQOE ×3 rows, ZUHRAH ×2, IMTIAZ ×2, then the single rows. M10 carries active T5
 * classes with exactly these names (`designation().atRiskClasses`; 5 SAINS TULEN is the anchor class 366).
 */
const AT_RISK_CLASS_NAMES: readonly string[] = [
  '5 LEQOE',
  '5 ZUHRAH',
  '5 IMTIAZ',
  '5 BAKTI',
  '5 CAMELIA',
  '5 MUSYTARI',
  '5 SAINS TULEN',
  '5 NURANI',
  '5 IKHLAS',
  '5 JUJUR',
]

/** The M10 T5 classroom with an observed at-risk name (the designation first, then the class list). */
function atRiskClass(name: string): ClassroomRow {
  const named = classrooms.designation().atRiskClasses.find((c) => c.name === name)
  const row =
    (named ? classrooms.get('classroom', named.classId) : undefined) ??
    classrooms
      .list({ kind: 'classroom', isActive: true })
      .find((c) => c.name === name && c.levelId === 11)
  if (!row || row.teacherId === null) {
    throw new Error(`M08 headcount seed: M10 has no active T5 class ${name}`)
  }
  return row
}

/**
 * The 14 observed T5 at-risk rows (SRS §6.3), each in the M10 class with the observed name (a name seen
 * on several rows maps to the same class) and held by real members of that class. These classes are
 * observed anchors, so they are not subject to the pinned-school exclusion of the generated filler.
 */
function seedAtRisk(b: Builder): void {
  AT_RISK_GROUPS.forEach((rows, k) => {
    const cls = atRiskClass(AT_RISK_CLASS_NAMES[k] as string)
    // A named class at a school with its own pins would break them: fail the boot loudly. The one observed
    // exception is class 366 "5 SAINS TULEN" at 8080 (its pupils hold graded rows).
    const school = cls.schoolId ?? users.get(cls.teacherId as number)?.schoolId ?? null
    if (school !== null && AT_RISK_FORBIDDEN_SCHOOLS.has(school)) {
      throw new Error(
        `M08 headcount seed: at-risk class ${cls.name} (${String(cls.classId)}) sits at pinned school ${String(school)}`,
      )
    }
    const members = classrooms
      .memberIds('classroom', cls.classId)
      .filter((id) => !b.held.has(heldKey(id, 23)))
    const key = `${String(cls.classId)}:23:${String(YEAR)}:auto`
    if (b.keys.has(key) || members.length < rows.length) {
      throw new Error(
        `M08 headcount seed: class ${cls.name} cannot hold ${String(rows.length)} rows`,
      )
    }
    const cfg = placedConfig(b, { cls, members }, 23)
    rows.forEach((m, i) => {
      b.held.add(heldKey(members[i] as number, 23))
      addMarks(b, cfg.id, members[i] as number, m)
    })
  })
}

export interface HeadcountSeed {
  configs: HeadcountConfigRow[]
  entries: HeadcountEntryRow[]
}

/** The classes the baseline is built on (M10 anchors and designed classes). */
const REQUIRED_CLASSES = [516, 517, 540, 628, 370, 2001, 2002] as const

/**
 * The whole baseline (pure function of the owners' data; deterministic). A boot without the M10 classes (or
 * the M01 users they come from) gets an empty baseline instead of a failed boot.
 */
export function buildHeadcountSeed(): HeadcountSeed {
  if (REQUIRED_CLASSES.some((id) => classrooms.get('classroom', id) === undefined)) {
    return { configs: [], entries: [] }
  }
  const b: Builder = {
    configs: [],
    entries: [],
    nextEntry: 1,
    nextConfig: GENERATED_CONFIG_START,
    keys: new Set(),
    held: new Set(),
  }
  seedClass516(b)
  seedDesigned(b)
  seed8880T5(b)
  seedMonitoring(b)
  const level11 = poolOf((l) => l === 11)
  seedAtRisk(b)
  place(b, L11_GROUPS, level11)
  placeOtherLevels(b, OTHER_LEVEL_GROUPS)
  b.configs.sort((x, y) => x.id - y.id)
  return { configs: b.configs, entries: b.entries }
}

/** Finalise phase: the baseline rows and the reader of the headcount port (every boot and reset). */
export function finaliseHeadcount(): void {
  const seed = buildHeadcountSeed()
  headcountRepo.seed(seed.configs, seed.entries)
  registerHeadcountReads({ entries: () => headcountRepo.views() })
}
