/**
 * The M10 class and enrolment build (F-30; SRS M10 v1.18 §6.2.1). A pure function of the people
 * snapshot (the M01 users repository), so every figure is computed from the users dataset and no
 * population count is hard-coded:
 *
 * - 752 records = 750 classrooms + the 2 school classes sc-419 / sc-806. The 750 classrooms are 745 with
 *   ids in 1–1,156 (24 observed anchors + 719 generated + 2 appended after the build) + the 5 designed
 *   classes 2001, 2002, 2011–2013; T4 13 (11 classrooms + 2 school classes), T5 645, other levels 94
 *   (INFERRED); 27 distinct subjects (T5: the 26 of M08 A.4); 310 distinct owners.
 * - T4 149 distinct pupils (Σ 356 memberships), T5 3,911 distinct.
 *
 * INFERRED choices (the SRS leaves them open) are marked `INFERRED` next to the code and listed in
 * the F-30 report.
 */

import { toIsoMyt } from '@/lib/time'

import {
  ACADEMIC_YEAR,
  ANCHORS,
  ANCHOR_IDS_IN_RANGE,
  CLASSES_EXTRA,
  CLASSES_OTHER_BASE,
  CLASSES_T5,
  CLASSES_TOTAL,
  CLASS_ID_MAX,
  CLASS_OWNERS_TOTAL,
  CLASS_SUBJECT_POOL,
  LEGACY_SUBJECT_POOL,
  NO_LEVEL_LINK_SUBJECTS,
  T5_SUBJECTS_A4,
  COMPLIMENTARY_IDS,
  DARJAH_ONLY_SUBJECTS,
  DEMO_PUPILS,
  DESIGNED,
  LEVEL_SLUGS,
  M19_PAYER_IDS,
  PUPILS_370,
  PUPIL_1156,
  PUPIL_2016,
  SCHOOL_8080,
  SCHOOL_8102,
  SCHOOL_DEMO,
  SCHOOL_8082_COVERED,
  SCHOOL_8082,
  SCHOOL_8880,
  SCHOOL_CLASSES,
  SIZES_8080,
  T5_DISTINCT,
  TEACHER_KL01,
  TRIO_SEJ,
  TWIN_NAMES,
  UNLINKED_SUBJECT,
  UPPER_ONLY_SUBJECTS,
  classKey,
  levelIdOf,
  type AnchorClass,
} from '../data/spec'
import type {
  ClassroomKind,
  ClassroomRow,
  EducationLevelSlug,
  EnrolmentSource,
} from '../repository/types'
import type { People, Pupil, Teacher } from './people'
import { designGuruEnrolments } from './guru'
import { planSchoolSets, planT4, type SchoolPlan, type T4Holders, type T4Plan } from './sets'
import { byHash, h32, shuffled, splitTotal, unit } from './util'

export interface BuiltClass {
  row: ClassroomRow
  /** Member ids in class order (each a distinct pupil). */
  members: number[]
  /** Source of the seeded enrolments (`complimentary` for 2011–2013). */
  source: EnrolmentSource | null
}

/** What the build decided, for the repository (`designation()`) and for the build check. */
export interface Designation {
  holders: T4Holders
  /** Register pupils that join the T4 classes at the M18 schools (the 21). */
  t4Joiners: number[]
  /** Pupils of the 8 M18 schools in no class. */
  noClass: number[]
  /** Pupils that the plan expects M05 to give sessions to (8765) and that are T5-only members. */
  answeringMembers: number[]
  /** The 6 answering pupils of 8765 (M18), all active, in M05 ladder order. */
  answering8765: number[]
  /** The 9 renamed T5 classes of the M08 "Murid Berisiko" rows (names "5 LEQOE" … "5 IKHLAS"). */
  atRiskClasses: { name: string; classId: number }[]
  /** The observed S1 "Prestasi Guru" cards: classes and distinct pupils (1/0, 2/76, 3/89). */
  teacherCards: { teacherId: number; classes: number; students: number }[]
  /** Grade-11 pupils outside every T5 class. */
  t5NonMembers: number[]
  /** The 32 generated T5 members that leave every T5 class (one for one with the twins' joiners). */
  t5Leavers: number[]
  t5Twins: { name: string; bm: number; sej: number }[]
  owners: number[]
}

export interface BuildResult {
  classes: BuiltClass[]
  designation: Designation
  /** Human-readable facts for the build check. */
  facts: Record<string, number>
}

function fail(message: string): never {
  throw new Error(`M10 build: ${message}`)
}

// --- Naming --------------------------------------------------------------------------------------

const ADJECTIVES = [
  'AMANAH',
  'ANGGERIK',
  'BAKTI',
  'BIJAK',
  'BISTARI',
  'CEKAP',
  'DAHLIA',
  'DINAMIK',
  'ELITE',
  'FAJAR',
  'GEMILANG',
  'HARMONI',
  'IKHLAS',
  'INSAF',
  'JAYA',
  'KEMBOJA',
  'KREATIF',
  'LESTARI',
  'MAJU',
  'MAWAR',
  'MELATI',
  'MURNI',
  'NAJAH',
  'PERMATA',
  'RAMLI',
  'RAJIN',
  'SAKTI',
  'SEROJA',
  'SINAR',
  'TEKUN',
  'TERAJU',
  'USAHA',
  'UTAMA',
  'WAWASAN',
  'YAKIN',
  'ZAMRUD',
]

const SUBJECT_SHORT: Readonly<Record<number, string>> = {
  1: 'BM',
  2: 'BI',
  3: 'Matematik',
  4: 'Sains',
  5: 'Sejarah',
  6: 'Pendidikan Islam',
  7: 'Pendidikan Moral',
  8: 'Add Math',
  9: 'Fizik',
  10: 'Kimia',
  11: 'Biologi',
  12: 'Geografi',
  13: 'PSV',
  14: 'Muzik',
  15: 'PJK',
  16: 'RBT',
  17: 'Sains Komputer',
  18: 'Bahasa Arab',
  20: 'Bahasa Tamil',
  21: 'Prinsip Akaun',
  22: 'Ekonomi',
  23: 'Perniagaan',
  24: 'Al-Quran & As-Sunnah',
  25: 'Tasawwur Islam',
  26: 'Jawi',
  27: 'Syariah',
  28: 'SRT',
}

function generatedName(id: number, level: EducationLevelSlug, subjectId: number | null): string {
  const digit = level.startsWith('tahun') ? level.slice(-1) : level.slice(-1)
  const adj = ADJECTIVES[h32(`m10:name:${String(id)}`) % ADJECTIVES.length] as string
  const suffix =
    subjectId !== null && unit(`m10:name-suffix:${String(id)}`) < 0.7
      ? ` - ${SUBJECT_SHORT[subjectId] ?? ''}`
      : ''
  return `${digit} ${adj}${suffix}`
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'

/** Deterministic 6-character join code (upper-case letters and digits, BR-M10-02). */
function joinCodeOf(id: number, taken: Set<string>): string {
  for (let salt = 0; ; salt++) {
    let h = h32(`m10:joincode:${String(id)}:${String(salt)}`)
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[h % CODE_CHARS.length] as string
      h = Math.imul(h, 1_664_525) + 1_013_904_223
      h >>>= 0
    }
    if (!taken.has(code)) {
      taken.add(code)
      return code
    }
  }
}

/** Live auto-increment: createdAt grows with the id (M08 BR-M08-30). */
const CREATED_BASE = Date.parse('2025-05-01T08:00:00+08:00')
const TEN_HOURS = 10 * 3_600_000
export const createdAtOf = (id: number): string => toIsoMyt(CREATED_BASE + id * TEN_HOURS)

// --- The build ------------------------------------------------------------------------------------

export function buildClasses(people: People): BuildResult {
  const pupilById = people.pupilById
  const need = (id: number): Pupil => pupilById.get(id) ?? fail(`pupil ${String(id)} is missing`)
  const schoolSets: SchoolPlan[] = planSchoolSets(people)
  const t4: T4Plan = planT4(people, schoolSets)
  const byId = (a: Pupil, b: Pupil) => a.id - b.id

  const members = new Map<string, number[]>()
  const sources = new Map<string, EnrolmentSource>()
  const setMembers = (
    kind: ClassroomKind,
    id: number,
    ids: readonly number[],
    src?: EnrolmentSource,
  ) => {
    const unique = [...new Set(ids)]
    if (unique.length !== ids.length) fail(`class ${classKey(kind, id)} repeats a member`)
    members.set(classKey(kind, id), unique)
    if (src) sources.set(classKey(kind, id), src)
  }
  const t5Members = new Set<number>()
  const t5Add = (ids: readonly number[]) => ids.forEach((i) => t5Members.add(i))

  // ---- T4 classes --------------------------------------------------------------------------------
  for (const [trioId, sejId] of Object.entries(TRIO_SEJ)) {
    const list = t4.trio[Number(trioId)] as number[]
    setMembers('classroom', Number(trioId), list)
    setMembers('classroom', sejId, list)
  }
  setMembers('classroom', 419, t4.c419)
  setMembers('school_class', 419, t4.sc419)
  setMembers('school_class', 806, t4.sc806)
  setMembers('classroom', 516, t4.c516)
  for (const id of [25, 90, 115]) setMembers('classroom', id, [])

  // ---- Designed classes -------------------------------------------------------------------------
  for (const id of DEMO_PUPILS) need(id)
  setMembers('classroom', 2001, DEMO_PUPILS)
  setMembers('classroom', 2002, DEMO_PUPILS)
  t5Add(DEMO_PUPILS)
  for (const id of COMPLIMENTARY_IDS) need(id)
  const comp = (a: number, b: number) => COMPLIMENTARY_IDS.filter((i) => i >= a && i <= b)
  setMembers('classroom', 2011, comp(5901, 5930), 'complimentary')
  setMembers('classroom', 2012, [...comp(5931, 5960), 5901], 'complimentary')
  setMembers('classroom', 2013, [...comp(5961, 5990), 5901], 'complimentary')
  t5Add(COMPLIMENTARY_IDS)

  // ---- 8080: classes 366–372 -------------------------------------------------------------------
  const p80 = people.pupils.filter((p) => p.schoolId === SCHOOL_8080 && p.grade === 11).sort(byId)
  for (const id of PUPILS_370)
    if (!p80.some((p) => p.id === id))
      fail(`class 370 member ${String(id)} is not a grade-11 pupil of 8080`)
  setMembers('classroom', 370, PUPILS_370)
  {
    const rest = p80.filter((p) => !PUPILS_370.includes(p.id)).map((p) => p.id)
    let at = 0
    for (const [id, size] of SIZES_8080) {
      setMembers('classroom', id, rest.slice(at, at + size))
      at += size
    }
    if (at > rest.length) fail(`8080 has only ${String(rest.length)} pupils for classes 366–372`)
  }
  for (const id of [366, 367, 368, 369, 370, 371, 372])
    t5Add(members.get(classKey('classroom', id)) as number[])

  // ---- 8082: classes 228 and 813, class 1156, and the 34 pupils outside its owners' classes -----
  const p82 = people.pupils.filter((p) => p.schoolId === SCHOOL_8082 && p.grade === 11).sort(byId)
  need(PUPIL_1156)
  need(PUPIL_2016)
  const eligible82 = (p: Pupil) => p.generated && p.isActive && p.hasLoggedIn && p.id !== PUPIL_1156
  const c813 = [
    PUPIL_2016,
    ...byHash(
      p82.filter((p) => eligible82(p) && p.id !== PUPIL_2016),
      'm10:813',
      (p) => p.id,
    )
      .slice(0, 43)
      .map((p) => p.id),
  ]
  const c813Set = new Set(c813)
  const c228 = byHash(
    p82.filter((p) => eligible82(p) && !c813Set.has(p.id)),
    'm10:228',
    (p) => p.id,
  )
    .slice(0, 93)
    .map((p) => p.id)
  if (c813.length !== 44 || c228.length !== 93)
    fail('8082 has too few active pupils for classes 228 and 813')
  const anchored82 = new Set([...c813, ...c228, PUPIL_1156])
  // INFERRED: 549 − 515 = 34 pupils of 8082 sit outside its owners' classes (M17 §6.7 C "Σ 515 distinct
  // pupils"). 4627 is one of them: class 1156 is owned by a teacher outside 8082's 14 owners (M10
  // v1.15), so the other 33 are generated pupils, inactive or
  // never logged in first, taken from the tail of the id order (M05 practises from the head).
  const uncovered82 = p82
    .filter((p) => p.generated && !anchored82.has(p.id))
    .sort(
      (a, b) =>
        Number(a.isActive) - Number(b.isActive) ||
        Number(a.hasLoggedIn) - Number(b.hasLoggedIn) ||
        b.id - a.id,
    )
    .slice(0, p82.length - SCHOOL_8082_COVERED - 1)
    .map((p) => p.id)
  if (uncovered82.length !== p82.length - SCHOOL_8082_COVERED - 1)
    fail("8082 has too few pupils outside its owners' classes")
  setMembers('classroom', 813, c813)
  setMembers('classroom', 228, c228)
  setMembers('classroom', 1156, [PUPIL_1156])
  for (const id of [1154, 1155]) setMembers('classroom', id, [])
  t5Add(c813)
  t5Add(c228)
  t5Add([PUPIL_1156])

  // ---- 8880: classes 517 and the generated "5 Sinar" / "5 Delima" ------------------------------
  const p88 = people.pupils.filter((p) => p.schoolId === SCHOOL_8880 && p.grade === 11).sort(byId)
  const ordered88 = [
    ...p88.filter((p) => p.isActive && p.hasLoggedIn),
    ...p88.filter((p) => !(p.isActive && p.hasLoggedIn)),
  ]
  const c517 = ordered88.slice(0, 15).map((p) => p.id)
  if (c517.length !== 15) fail('8880 has fewer than 15 grade-11 pupils')
  const uncovered88 = ordered88.slice(15).map((p) => p.id)
  setMembers('classroom', 517, c517)
  t5Add(c517)

  // ---- The T5 twins of the M18 schools -----------------------------------------------------------
  t5Add(t4.twins.flat())

  // ---- Forced non-members: the M19 payers, 8082's 34, 8880's 12 --------------------------------
  for (const id of M19_PAYER_IDS) need(id)
  const forced = new Set<number>([...M19_PAYER_IDS, ...uncovered82, ...uncovered88])

  // ---- The rest of the grade-11 pupils: members of generated classes, or non-members -------------
  const U = people.pupils.filter((p) => p.grade === 11 && p.schoolId !== null)
  const uRest = U.filter(
    (p) => !t5Members.has(p.id) && !forced.has(p.id) && !t4.schoolPupils.has(p.id),
  )
  const wanted = T5_DISTINCT - t5Members.size
  if (wanted < 0 || wanted > uRest.length) {
    fail(
      `T5 needs ${String(wanted)} more members but ${String(uRest.length)} grade-11 pupils are free`,
    )
  }
  const fillCount = uRest.length - wanted
  const keepMonitoring = new Set([SCHOOL_8082, SCHOOL_8080, SCHOOL_8880])
  // INFERRED: the non-members among the free pupils are generated pupils taken from the tail of the
  // id order, inactive and never-logged-in first (M05 practises from the head, inactive never).
  const fillCandidates = uRest
    .filter((p) => p.generated && !keepMonitoring.has(p.schoolId as number))
    .sort(
      (a, b) =>
        Number(a.isActive) - Number(b.isActive) ||
        Number(a.hasLoggedIn) - Number(b.hasLoggedIn) ||
        b.id - a.id,
    )
  if (fillCandidates.length < fillCount)
    fail(
      `only ${String(fillCandidates.length)} pupils can be non-members, ${String(fillCount)} needed`,
    )
  const fill = fillCandidates.slice(0, fillCount).map((p) => p.id)
  const fillSet = new Set(fill)
  const generic = uRest.filter((p) => !fillSet.has(p.id))

  // ---- Owners ---------------------------------------------------------------------------------
  const owners = planOwners(people, generic)

  // ---- Class ids and levels of the 719 generated classrooms -------------------------------------
  const free: number[] = []
  for (let id = 1; id <= CLASS_ID_MAX; id++) if (!ANCHOR_IDS_IN_RANGE.has(id)) free.push(id)
  const generatedCount =
    CLASSES_TOTAL - CLASSES_EXTRA - ANCHORS.length - SCHOOL_CLASSES.length - DESIGNED.length
  const slots: number[] = Array.from(
    { length: generatedCount },
    (_, p) => free[Math.floor((p * free.length) / generatedCount)] as number,
  )
  const anchorsT5 =
    ANCHORS.filter((a) => a.educationLevel === 'tingkatan-5').length + DESIGNED.length
  const genT5 = CLASSES_T5 - anchorsT5
  const genOther = CLASSES_OTHER_BASE
  if (genT5 + genOther !== generatedCount)
    fail(
      `level cells do not add up (${String(genT5)} + ${String(genOther)} ≠ ${String(generatedCount)})`,
    )
  const levelOfSlot = shuffled(
    [...Array<'T5'>(genT5).fill('T5'), ...Array<'O'>(genOther).fill('O')],
    'm10:class-levels',
  )
  const t5Slots = slots.filter((_, i) => levelOfSlot[i] === 'T5')
  const otherSlots = slots.filter((_, i) => levelOfSlot[i] === 'O')

  // Specials among the T5 slots: 6 twins, "5 Sinar", "5 Delima", 5 classes of "Guru Demo KL-02".
  const SPECIAL_AT = [11, 57, 103, 149, 195, 241, 287, 333, 379, 425, 471, 517, 563]
  const specialSlots = SPECIAL_AT.map((i) => t5Slots[i] as number)
  const specialSet = new Set(specialSlots)
  const genericT5Slots = t5Slots.filter((id) => !specialSet.has(id))

  const rows: ClassroomRow[] = []
  const codes = new Set<string>(
    ANCHORS.flatMap((a) => (a.joinCode ? [a.joinCode] : [])).concat(
      DESIGNED.flatMap((a) => (a.joinCode ? [a.joinCode] : [])),
    ),
  )
  const teacherOf = (id: number): Teacher | undefined => people.teacherById.get(id)
  const make = (a: {
    kind: ClassroomKind
    id: number
    name: string
    subjectId: number | null
    level: EducationLevelSlug
    teacherId: number | null
    schoolId?: number | null
    joinCode?: string
    createdAt?: string
  }): ClassroomRow => ({
    id: classKey(a.kind, a.id),
    kind: a.kind,
    classId: a.id,
    name: a.name,
    teacherId: a.teacherId,
    schoolId:
      a.schoolId !== undefined
        ? a.schoolId
        : a.teacherId !== null
          ? (teacherOf(a.teacherId)?.schoolId ?? null)
          : null,
    subjectId: a.subjectId,
    educationLevel: a.level,
    levelId: levelIdOf(a.level),
    academicYear: ACADEMIC_YEAR,
    description: null,
    joinCode: a.kind === 'school_class' ? '' : (a.joinCode ?? joinCodeOf(a.id, codes)),
    isActive: true,
    createdAt: a.createdAt ?? createdAtOf(a.id),
  })

  // Anchors with owners fixed by the SRS, or generated teachers (masked on live).
  const anchorOwner = (a: AnchorClass): number | null => {
    if (a.teacherId !== undefined) return a.teacherId
    if (a.id === 228) return owners.o228
    if ([4, 8].includes(a.id)) return owners.special.tA
    if ([5, 9].includes(a.id)) return owners.special.tB
    if ([6, 10].includes(a.id)) return owners.special.tC
    if (a.id === 25) return owners.special.t25
    if (a.id === 90) return owners.special.t90
    if (a.id === 115) return owners.special.t115
    if (a.id === 419) return owners.special.t419
    if (a.id === 1154) return owners.special.t1154
    if (a.id === 1155) return owners.special.t1155
    if (a.id === 1156) return owners.special.t1156
    return fail(`anchor ${String(a.id)} has no owner rule`)
  }
  for (const a of [...ANCHORS, ...SCHOOL_CLASSES, ...DESIGNED]) {
    rows.push(
      make({
        kind: a.kind,
        id: a.id,
        name: a.name,
        subjectId: a.subjectId,
        level: a.educationLevel,
        teacherId: a.kind === 'school_class' ? null : anchorOwner(a),
        ...(a.schoolId !== undefined ? { schoolId: a.schoolId } : {}),
        ...(a.joinCode ? { joinCode: a.joinCode } : {}),
        ...(a.createdAt ? { createdAt: a.createdAt } : {}),
      }),
    )
  }

  // Specials.
  const twinBm = [1, 2, 3].map((k) => specialSlots[k - 1] as number)
  const twinSej = [1, 2, 3].map((k) => specialSlots[k + 2] as number)
  const sinar = specialSlots[6] as number
  const delima = specialSlots[7] as number
  const kl02Slots = specialSlots.slice(8)
  const twinOwner = [owners.special.twB, owners.special.twC, owners.special.twD]
  const twinNames: { name: string; bm: number; sej: number }[] = []
  TWIN_NAMES.forEach((n, k) => {
    rows.push(
      make({
        kind: 'classroom',
        id: twinBm[k] as number,
        name: `5 ${n} - BM`,
        subjectId: 1,
        level: 'tingkatan-5',
        teacherId: twinOwner[k] as number,
      }),
    )
    rows.push(
      make({
        kind: 'classroom',
        id: twinSej[k] as number,
        name: `5 ${n} - SEJ`,
        subjectId: 5,
        level: 'tingkatan-5',
        teacherId: twinOwner[k] as number,
      }),
    )
    setMembers('classroom', twinBm[k] as number, t4.twins[k] as number[])
    setMembers('classroom', twinSej[k] as number, t4.twins[k] as number[])
    twinNames.push({ name: n, bm: twinBm[k] as number, sej: twinSej[k] as number })
  })
  rows.push(
    make({
      kind: 'classroom',
      id: sinar,
      name: '5 Sinar',
      subjectId: 9,
      level: 'tingkatan-5',
      teacherId: TEACHER_KL01,
      schoolId: SCHOOL_8880,
    }),
  )
  rows.push(
    make({
      kind: 'classroom',
      id: delima,
      name: '5 Delima',
      subjectId: 4,
      level: 'tingkatan-5',
      teacherId: TEACHER_KL01,
      schoolId: SCHOOL_8880,
    }),
  )
  setMembers('classroom', sinar, c517.slice(0, 8))
  setMembers('classroom', delima, c517.slice(8))
  const KL02_NAMES = ['5 Kenari', '5 Melur', '5 Kesturi', '5 Seroja', '5 Mawar']
  kl02Slots.forEach((id, i) => {
    rows.push(
      make({
        kind: 'classroom',
        id,
        name: KL02_NAMES[i] as string,
        subjectId: null,
        level: 'tingkatan-5',
        teacherId: owners.kl02,
        schoolId: SCHOOL_8880,
      }),
    )
    setMembers('classroom', id, [])
  })

  // Generic classes: which school each belongs to, then owners round-robin.
  const schoolLabels = (counts: ReadonlyMap<number, number>, stream: string): number[] =>
    shuffled(
      [...counts].flatMap(([s, n]) => Array<number>(n).fill(s)),
      stream,
    )
  const t5Labels = schoolLabels(owners.t5Count, 'm10:t5-school-labels')
  const otherLabels = schoolLabels(owners.otherCount, 'm10:other-school-labels')
  if (t5Labels.length !== genericT5Slots.length)
    fail(`generic T5 classes ${String(genericT5Slots.length)} ≠ planned ${String(t5Labels.length)}`)
  if (otherLabels.length !== otherSlots.length)
    fail(`other-level classes ${String(otherSlots.length)} ≠ planned ${String(otherLabels.length)}`)

  interface Gen {
    id: number
    school: number
    t5: boolean
  }
  const gens: Gen[] = [
    ...genericT5Slots.map((id, i) => ({ id, school: t5Labels[i] as number, t5: true })),
    ...otherSlots.map((id, i) => ({ id, school: otherLabels[i] as number, t5: false })),
  ].sort((a, b) => a.id - b.id)
  const bySchool = new Map<number, Gen[]>()
  for (const g of gens) bySchool.set(g.school, [...(bySchool.get(g.school) ?? []), g])

  const subjectFor = subjectPicker()
  const otherLevels: EducationLevelSlug[] = LEVEL_SLUGS.filter(
    (l) => l !== 'tingkatan-4' && l !== 'tingkatan-5',
  )
  const genRows = new Map<number, ClassroomRow>()
  for (const [school, list] of bySchool) {
    const ownerList = owners.bySchool.get(school) as number[]
    list.forEach((g, i) => {
      const teacherId = ownerList[i % ownerList.length] as number
      const level: EducationLevelSlug = g.t5
        ? 'tingkatan-5'
        : (otherLevels[h32(`m10:level:${String(g.id)}`) % otherLevels.length] as EducationLevelSlug)
      const subjectId = subjectFor(g.id, level)
      const row = make({
        kind: 'classroom',
        id: g.id,
        name: generatedName(g.id, level, subjectId),
        subjectId,
        level,
        teacherId,
      })
      genRows.set(g.id, row)
    })
  }
  // Every one of the 27 subjects appears (the observed "Subjek 27"): give the missing ones to
  // generic classes of a fitting level.
  ensureSubjects(genRows, [...rows])
  rows.push(...genRows.values())

  // ---- Deal the free grade-11 pupils into the generic T5 classes ---------------------------------
  const schools = [...owners.bySchool.keys()].filter((s) =>
    (bySchool.get(s) ?? []).some((g) => g.t5),
  )
  const groupOf = new Map<number, number[]>(schools.map((s) => [s, []]))
  const misc: number[] = []
  for (const p of generic) {
    if (groupOf.has(p.schoolId as number))
      (groupOf.get(p.schoolId as number) as number[]).push(p.id)
    else misc.push(p.id)
  }
  misc.forEach((id, i) => (groupOf.get(schools[i % schools.length] as number) as number[]).push(id))
  const dealt = new Map<number, number[]>()
  for (const [school, ids] of groupOf) {
    const classes = (bySchool.get(school) as Gen[]).filter((g) => g.t5)
    ids.sort((a, b) => a - b)
    ids.forEach((id, k) => {
      const n = classes.length
      const first = classes[k % n] as Gen
      const list = dealt.get(first.id) ?? []
      list.push(id)
      dealt.set(first.id, list)
      if (n > 1 && unit(`m10:second:${String(id)}`) < 0.5) {
        const other = classes[
          (k + 1 + Math.floor(unit(`m10:second-at:${String(id)}`) * (n - 1))) % n
        ] as Gen
        if (other.id !== first.id) {
          const l2 = dealt.get(other.id) ?? []
          l2.push(id)
          dealt.set(other.id, l2)
        }
      }
    })
  }
  for (const g of gens) {
    if (g.t5) setMembers('classroom', g.id, dealt.get(g.id) ?? [])
    else setMembers('classroom', g.id, [])
  }
  // ---- XR-F30-02: the at-risk class names and the observed teacher cards of M08 S1 ------------------
  // Existing generated classes keep their id, owner, level and join code; only 9 are renamed and the
  // members of two owners' classes are rebalanced (existing members only, so T5 stays 3,911).
  const pinnedSchools = new Set([SCHOOL_8080, SCHOOL_8082, SCHOOL_8880])
  // M08's PINNED_SCHOOLS also hold 8102 and 900001: no renamed class may sit there.
  const renamePinned = new Set([...pinnedSchools, SCHOOL_8102, SCHOOL_DEMO])
  const rowOf = new Map(rows.map((r) => [r.classId, r] as const))
  const ownerClasses = new Map<number, ClassroomRow[]>()
  for (const r of rows) {
    if (r.kind === 'classroom' && r.teacherId !== null) {
      ownerClasses.set(r.teacherId, [...(ownerClasses.get(r.teacherId) ?? []), r])
    }
  }
  const genT5Ids = new Set(gens.filter((g) => g.t5).map((g) => g.id))
  const free5 = (cls: ClassroomRow) =>
    genT5Ids.has(cls.classId) &&
    cls.schoolId !== null &&
    !pinnedSchools.has(cls.schoolId) &&
    (members.get(cls.id) as number[]).length > 0
  const cardOwner = (n: number, stream: string): number => {
    const pool = [...ownerClasses.entries()]
      .filter(([, list]) => list.length === n && list.every(free5))
      .map(([id]) => id)
      .sort((a, b) => a - b)
    const pick = byHash(pool, stream, (id) => id)[0]
    if (pick === undefined) fail(`no owner with exactly ${String(n)} classes for the teacher card`)
    return pick
  }
  const cardA = cardOwner(2, 'm10:card-2')
  const cardB = cardOwner(3, 'm10:card-3')
  // The observed first card "1 kelas · 0 murid": an owner of one class without members.
  const emptyOwner = [...ownerClasses.entries()]
    .filter(
      ([, l]) =>
        l.length === 1 && (members.get((l[0] as ClassroomRow).id) as number[]).length === 0,
    )
    .map(([id]) => id)
    .sort((a, b) => a - b)[0]
  const t5Keys = rows.filter((r) => r.educationLevel === 'tingkatan-5').map((r) => r.id)
  const t5Count = new Map<number, number>()
  for (const k of t5Keys)
    for (const id of members.get(k) as number[]) t5Count.set(id, (t5Count.get(id) ?? 0) + 1)
  const fitCard = (teacherId: number, target: number, school: number) => {
    const keys = (ownerClasses.get(teacherId) as ClassroomRow[]).map((r) => r.id)
    const union = () => new Set(keys.flatMap((k) => members.get(k) as number[]))
    let u = union()
    if (u.size < target) {
      for (const id of byHash(groupOf.get(school) ?? [], 'm10:card-add', (x) => x)) {
        if (u.size >= target) break
        if (u.has(id)) continue
        const k = keys.reduce((a, b) =>
          (members.get(a) as number[]).length <= (members.get(b) as number[]).length ? a : b,
        )
        ;(members.get(k) as number[]).push(id)
        t5Count.set(id, (t5Count.get(id) ?? 0) + 1)
        u.add(id)
      }
    } else if (u.size > target) {
      for (const id of byHash([...u], 'm10:card-drop', (x) => x)) {
        if (u.size <= target) break
        const inOwn = keys.filter((k) => (members.get(k) as number[]).includes(id))
        if ((t5Count.get(id) ?? 0) - inOwn.length < 1) continue
        for (const k of inOwn)
          members.set(
            k,
            (members.get(k) as number[]).filter((x) => x !== id),
          )
        t5Count.set(id, (t5Count.get(id) ?? 0) - inOwn.length)
        u.delete(id)
      }
    }
    u = union()
    if (u.size !== target)
      fail(
        `teacher ${String(teacherId)}: ${String(u.size)} distinct pupils, ${String(target)} needed`,
      )
  }
  fitCard(
    cardA,
    76,
    (rowOf.get((ownerClasses.get(cardA) as ClassroomRow[])[0]?.classId as number) as ClassroomRow)
      .schoolId as number,
  )
  fitCard(
    cardB,
    89,
    (rowOf.get((ownerClasses.get(cardB) as ClassroomRow[])[0]?.classId as number) as ClassroomRow)
      .schoolId as number,
  )
  const cardClassIds = new Set(
    [...(ownerClasses.get(cardA) ?? []), ...(ownerClasses.get(cardB) ?? [])].map((r) => r.classId),
  )
  const atRiskNames = [
    'LEQOE',
    'ZUHRAH',
    'IMTIAZ',
    'CAMELIA',
    'MUSYTARI',
    'NURANI',
    'JUJUR',
    'BAKTI',
    'IKHLAS',
  ]
  const nameCandidates = byHash(
    [...genT5Ids]
      .filter((id) => {
        const r = rowOf.get(id) as ClassroomRow
        return (
          free5(r) &&
          !renamePinned.has(r.schoolId as number) &&
          !cardClassIds.has(id) &&
          (members.get(r.id) as number[]).length >= 10
        )
      })
      .sort((a, b) => a - b),
    'm10:at-risk-names',
    (id) => id,
  )
  if (nameCandidates.length < atRiskNames.length) fail('too few classes to carry the at-risk names')
  const atRiskClasses = atRiskNames.map((n, i) => {
    const id = nameCandidates[i] as number
    const r = rowOf.get(id) as ClassroomRow
    const renamed = { ...r, name: `5 ${n}` }
    rows[rows.indexOf(r)] = renamed
    rowOf.set(id, renamed)
    return { name: renamed.name, classId: id }
  })
  const teacherCards = [
    ...(emptyOwner === undefined ? [] : [{ teacherId: emptyOwner, classes: 1, students: 0 }]),
    { teacherId: cardA, classes: 2, students: 76 },
    { teacherId: cardB, classes: 3, students: 89 },
  ]
  const cardOwners = new Set(teacherCards.map((t) => t.teacherId))

  // ---- XR to M17 (R2-06): the designed "{n} GURU" enrolments (data/guru.ts, build/guru.ts) -------------
  // Enrolments of the answering pupils only, in generated T5 classes: the at-risk classes and every class
  // of a teacher-card owner keep their members; no class, owner or id changes and no pupil leaves T5.
  const atRiskIds = new Set(atRiskClasses.map((c) => c.classId))
  const cardOwnerClassIds = new Set(
    [...cardOwners].flatMap((o) => (ownerClasses.get(o) ?? []).map((r) => r.classId)),
  )
  const t5Distinct = (): Set<number> => {
    const out = new Set<number>()
    for (const r of rows)
      if (r.educationLevel === 'tingkatan-5')
        for (const id of members.get(r.id) as number[]) out.add(id)
    return out
  }
  const t5BeforeGuru = t5Distinct()
  const genericIds = new Set(gens.map((g) => g.id))
  const protectedOwners = new Set<number>(cardOwners)
  for (const r of rows) {
    if (r.kind !== 'classroom' || r.teacherId === null) continue
    if (!genericIds.has(r.classId) || atRiskIds.has(r.classId)) protectedOwners.add(r.teacherId)
  }
  designGuruEnrolments({
    members,
    ownerClasses,
    eligible: new Set(
      [...genT5Ids].filter((id) => !atRiskIds.has(id) && !cardOwnerClassIds.has(id)),
    ),
    ownersBySchool: owners.bySchool,
    protectedOwners,
  })
  const t5AfterGuru = t5Distinct()
  if (
    t5AfterGuru.size !== t5BeforeGuru.size ||
    [...t5BeforeGuru].some((id) => !t5AfterGuru.has(id))
  )
    fail('the guru enrolments changed the T5 member set')

  for (const g of gens) if (g.t5) t5Add(members.get(classKey('classroom', g.id)) as number[])

  // ---- Two further other-level classrooms (M10 v1.16, XR-F30-01) ---------------------------------
  // Appended after everything else with their own rules, so no existing row, owner, subject or join
  // code moves: the lowest two ids that no generated class uses, fixed levels, owners outside the
  // round-robin. INFERRED: levels, subjects and owners (the SRS observes only the 750 total).
  {
    const used = new Set<number>([...slots, ...ANCHOR_IDS_IN_RANGE])
    const spare: number[] = []
    for (let id = 1; id <= CLASS_ID_MAX && spare.length < CLASSES_EXTRA; id++)
      if (!used.has(id)) spare.push(id)
    const ownerPool = [...new Set([...owners.bySchool.values()].flat())]
      .filter((id) => !cardOwners.has(id))
      .sort((a, b) => a - b)
    const extraLevels: EducationLevelSlug[] = ['tahun-3', 'tingkatan-2']
    spare.forEach((id, i) => {
      const level = extraLevels[i] as EducationLevelSlug
      const subjectId = subjectFor(id, level)
      const teacherId = ownerPool[h32(`m10:extra-owner:${String(id)}`) % ownerPool.length] as number
      rows.push(
        make({
          kind: 'classroom',
          id,
          name: generatedName(id, level, subjectId),
          subjectId,
          level,
          teacherId,
        }),
      )
      setMembers('classroom', id, [])
    })
  }

  // ---- Assemble -----------------------------------------------------------------------------------
  const classes: BuiltClass[] = rows
    .sort((a, b) => (a.kind === b.kind ? a.classId - b.classId : a.kind === 'classroom' ? -1 : 1))
    .map((row) => ({
      row,
      members: members.get(row.id) ?? fail(`class ${row.id} has no member list`),
      source: sources.get(row.id) ?? null,
    }))

  const t5NonMembers = U.filter((p) => !t5Members.has(p.id)).map((p) => p.id)
  return {
    classes,
    designation: {
      holders: t4.holders,
      t4Joiners: schoolSets.flatMap((s) => s.joiners),
      noClass: schoolSets.flatMap((s) => s.noClass),
      atRiskClasses,
      teacherCards,
      answering8765: schoolSets.flatMap((s) => (s.school === 8765 ? s.answering : [])),
      answeringMembers: schoolSets.flatMap((s) =>
        s.school === 8765 ? s.answering.slice(0, 2) : [],
      ),
      t5NonMembers,
      t5Leavers: fill.slice(0, 32),
      t5Twins: twinNames,
      owners: [...owners.all],
    },
    facts: {
      classes: classes.length,
      t4Classes: classes.filter((c) => c.row.educationLevel === 'tingkatan-4').length,
      t5Classes: classes.filter((c) => c.row.educationLevel === 'tingkatan-5').length,
      t5Members: t5Members.size,
      t4Members: t4.members.length,
      nonMembers: t5NonMembers.length,
    },
  }
}

// --- Owners -----------------------------------------------------------------------------------------

interface OwnerPlan {
  o228: number
  kl02: number
  special: Record<
    | 'tA'
    | 'tB'
    | 'tC'
    | 't25'
    | 't90'
    | 't115'
    | 't419'
    | 't1154'
    | 't1155'
    | 't1156'
    | 'twB'
    | 'twC'
    | 'twD',
    number
  >
  /** Owners of the generic classes of each school. */
  bySchool: Map<number, number[]>
  /** Generic T5 / other-level classes per school. */
  t5Count: Map<number, number>
  otherCount: Map<number, number>
  all: Set<number>
}

const FIXED_OWNERS = [5, 5302, 1919, 4402, TEACHER_KL01]

function planOwners(people: People, generic: readonly Pupil[]): OwnerPlan {
  const teachers = people.teachers
  const eligible = teachers.filter(
    (t) =>
      t.generated &&
      t.isActive &&
      t.schoolId !== null &&
      t.schoolId < 900_001 &&
      t.schoolId !== SCHOOL_8080 &&
      t.schoolId !== SCHOOL_8880,
  )
  const e82 = byHash(
    eligible.filter((t) => t.schoolId === SCHOOL_8082),
    'm10:owners-8082',
    (t) => t.id,
  )
  const eOther = byHash(
    eligible.filter((t) => t.schoolId !== SCHOOL_8082),
    'm10:owners',
    (t) => t.id,
  )
  const kl02 =
    teachers.find((t) => t.schoolId === SCHOOL_8880 && t.id !== TEACHER_KL01)?.id ??
    fail('school 8880 has no second teacher')
  if (e82.length < 13) fail('school 8082 has too few active generated teachers')
  const o228 = (e82[0] as Teacher).id
  const extras82 = e82.slice(1, 13).map((t) => t.id)
  const names = [
    'tA',
    'tB',
    'tC',
    't25',
    't90',
    't115',
    't419',
    't1154',
    't1155',
    't1156',
    'twB',
    'twC',
    'twD',
  ] as const
  const specialIds = eOther.slice(0, names.length).map((t) => t.id)
  const special = Object.fromEntries(
    names.map((n, i) => [n, specialIds[i] as number]),
  ) as OwnerPlan['special']
  const fixed = new Set<number>([...FIXED_OWNERS, kl02, o228, ...extras82, ...specialIds])
  const remaining = CLASS_OWNERS_TOTAL - fixed.size

  // Owner schools: schools with candidates left, weighted by their grade-11 pupils (INFERRED).
  const pool = new Map<number, number[]>()
  for (const t of eOther.slice(names.length)) {
    const s = t.schoolId as number
    pool.set(s, [...(pool.get(s) ?? []), t.id])
  }
  const pupilsAt = new Map<number, number>()
  const allU = people.pupils.filter((p) => p.grade === 11 && p.schoolId !== null)
  for (const p of allU)
    pupilsAt.set(p.schoolId as number, (pupilsAt.get(p.schoolId as number) ?? 0) + 1)
  const cand = [...pool.keys()].sort((a, b) => a - b)
  const alloc = waterFill(
    remaining,
    cand.map((s) => [pupilsAt.get(s) ?? 0, (pool.get(s) as number[]).length] as const),
  )
  const bySchool = new Map<number, number[]>()
  cand.forEach((s, i) => {
    const n = alloc[i] as number
    if (n > 0) bySchool.set(s, (pool.get(s) as number[]).slice(0, n))
  })
  bySchool.set(SCHOOL_8082, [o228, ...extras82])

  const all = new Set<number>(fixed)
  for (const list of bySchool.values()) for (const id of list) all.add(id)
  if (all.size !== CLASS_OWNERS_TOTAL) {
    fail(
      `${String(all.size)} distinct class owners, ${String(CLASS_OWNERS_TOTAL)} needed (not enough eligible teachers)`,
    )
  }

  // Generic class counts per school: every owner gets at least one T5 class, the rest by pupils.
  const t5Specials = 13
  const genericT5 =
    CLASSES_T5 -
    (ANCHORS.filter((a) => a.educationLevel === 'tingkatan-5').length + DESIGNED.length) -
    t5Specials
  const ownerSchools = [...bySchool.keys()].sort((a, b) => a - b)
  const base = ownerSchools.map((s) => (bySchool.get(s) as number[]).length)
  const extra = genericT5 - base.reduce((a, b) => a + b, 0)
  if (extra < 0) fail('more owners than generic T5 classes')
  const genericAt = new Map<number, number>()
  for (const p of generic)
    genericAt.set(p.schoolId as number, (genericAt.get(p.schoolId as number) ?? 0) + 1)
  const weights = ownerSchools.map((s) => genericAt.get(s) ?? 0)
  const extraAlloc = splitTotal(extra, weights)
  const t5Count = new Map(
    ownerSchools.map((s, i) => [s, (base[i] as number) + (extraAlloc[i] as number)] as const),
  )
  const otherAlloc = splitTotal(CLASSES_OTHER_BASE, base)
  const otherCount = new Map(ownerSchools.map((s, i) => [s, otherAlloc[i] as number] as const))

  return { o228, kl02, special, bySchool, t5Count, otherCount, all }
}

/** Proportional split of `total` by weight with per-item caps (the surplus of a capped item moves on). */
function waterFill(total: number, items: readonly (readonly [number, number])[]): number[] {
  const out = items.map(() => 0)
  let left = total
  let active = items.map((_, i) => i)
  while (left > 0 && active.length > 0) {
    const shares = splitTotal(
      left,
      active.map((i) => (items[i] as readonly [number, number])[0]),
    )
    const capped = active.filter(
      (i, k) =>
        (shares[k] as number) > (items[i] as readonly [number, number])[1] - (out[i] as number),
    )
    if (capped.length === 0) {
      active.forEach((i, k) => (out[i] = (out[i] as number) + (shares[k] as number)))
      left = 0
      break
    }
    for (const i of capped) {
      left -= (items[i] as readonly [number, number])[1] - (out[i] as number)
      out[i] = (items[i] as readonly [number, number])[1]
    }
    active = active.filter((i) => !capped.includes(i))
  }
  return out
}

// --- Subjects -----------------------------------------------------------------------------------

/** Subjects a class of `level` may carry (T5: exactly the A.4 set, M08 S3 "26 subjek"; INFERRED elsewhere). */
function allowedSubjects(level: EducationLevelSlug): number[] {
  if (level === 'tingkatan-5') return T5_SUBJECTS_A4.filter((s) => s !== UNLINKED_SUBJECT)
  const t4 = level === 'tingkatan-4'
  return CLASS_SUBJECT_POOL.filter((s) => {
    if (NO_LEVEL_LINK_SUBJECTS.includes(s)) return false
    if (DARJAH_ONLY_SUBJECTS.includes(s)) return level.startsWith('tahun')
    if (UPPER_ONLY_SUBJECTS.includes(s)) return t4
    return true
  })
}

/** The first build's allowed list: kept only so that existing picks do not move (XR-F30-02). */
function legacyAllowed(level: EducationLevelSlug): number[] {
  const t45 = level === 'tingkatan-4' || level === 'tingkatan-5'
  return LEGACY_SUBJECT_POOL.filter((s) => {
    if (s === UNLINKED_SUBJECT) return false
    if (DARJAH_ONLY_SUBJECTS.includes(s)) return level.startsWith('tahun')
    if (UPPER_ONLY_SUBJECTS.includes(s)) return t45
    return true
  })
}

function subjectPicker(): (id: number, level: EducationLevelSlug) => number | null {
  return (id, level) => {
    // INFERRED: a small share of classes has no subject ("Tiada Subjek").
    if (unit(`m10:nosubject:${String(id)}`) < 0.06) return null
    const old = legacyAllowed(level)
    const pick = old[h32(`m10:subject:${String(id)}`) % old.length] as number
    const now = allowedSubjects(level)
    // A first-build pick that is no longer allowed (RBT 16, Bahasa Tamil 20, Al-Quran 24) is remapped.
    return now.includes(pick)
      ? pick
      : (now[h32(`m10:subject2:${String(id)}`) % now.length] as number)
  }
}

function ensureSubjects(gen: Map<number, ClassroomRow>, fixed: readonly ClassroomRow[]): void {
  const give = (s: number, level: EducationLevelSlug | null) => {
    const ids = [...gen.keys()].sort((x, y) => x - y)
    const target = ids.find((id) => {
      const r = gen.get(id) as ClassroomRow
      if (level !== null && r.educationLevel !== level) return false
      return allowedSubjects(r.educationLevel).includes(s) && countOf(gen, r.subjectId, level) > 1
    })
    if (target === undefined) fail(`no class can carry subject ${String(s)}`)
    const r = gen.get(target) as ClassroomRow
    gen.set(target, { ...r, subjectId: s, name: generatedName(target, r.educationLevel, s) })
  }
  const usedAt = (level: EducationLevelSlug | null) => {
    const used = new Set<number>()
    for (const r of [...gen.values(), ...fixed]) {
      if (r.subjectId !== null && (level === null || r.educationLevel === level))
        used.add(r.subjectId)
    }
    return used
  }
  // T5 carries exactly the 26 subjects of A.4 (M08 S3 "26 subjek") ...
  const t5 = usedAt('tingkatan-5')
  for (const s of T5_SUBJECTS_A4) if (!t5.has(s)) give(s, 'tingkatan-5')
  // ... and the 27 subjects appear across all levels (M08 S1 "Subjek 27").
  const all = usedAt(null)
  for (const s of CLASS_SUBJECT_POOL) if (!all.has(s)) give(s, null)
}

function countOf(
  gen: ReadonlyMap<number, ClassroomRow>,
  subjectId: number | null,
  level: EducationLevelSlug | null,
): number {
  let n = 0
  for (const r of gen.values()) {
    if (r.subjectId === subjectId && (level === null || r.educationLevel === level)) n++
  }
  return n
}
