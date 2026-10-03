/**
 * The M10 build check (overview §6.6 step 4): every documented figure of the class and enrolment
 * stores is computed from the compiled stores and compared with the SRS value. A failure stops
 * the boot (the plugin's `finalise` throws), so a contradiction never ships silently.
 */

import {
  CLASSES_OTHER,
  CLASSROOMS_TOTAL,
  CLASSES_T4,
  CLASSES_T5,
  CLASSES_TOTAL,
  CLASS_OWNERS_TOTAL,
  CLASS_SUBJECTS_DISTINCT,
  OBSERVED_SIZES,
  PUPIL_1156,
  T4_DISTINCT,
  T5_SUBJECTS_A4,
  T4_MEMBERSHIPS,
  T5_DISTINCT,
} from '../data/spec'
import { GURU_PLANS } from '../data/guru'
import type { ClassroomRow, EnrolmentRow } from '../repository/types'

export function checkClassBuild(
  classes: readonly ClassroomRow[],
  enrolments: readonly EnrolmentRow[],
): string[] {
  const issues: string[] = []
  const eq = (label: string, actual: number, expected: number) => {
    if (actual !== expected)
      issues.push(`${label} = ${String(actual)}, documented ${String(expected)}`)
  }
  eq('classes', classes.length, CLASSES_TOTAL)
  eq('classrooms', classes.filter((c) => c.kind === 'classroom').length, CLASSROOMS_TOTAL)
  eq('T4 classes', classes.filter((c) => c.educationLevel === 'tingkatan-4').length, CLASSES_T4)
  eq('T5 classes', classes.filter((c) => c.educationLevel === 'tingkatan-5').length, CLASSES_T5)
  eq(
    'other-level classes',
    classes.filter((c) => c.educationLevel !== 'tingkatan-4' && c.educationLevel !== 'tingkatan-5')
      .length,
    CLASSES_OTHER,
  )
  eq('school classes', classes.filter((c) => c.kind === 'school_class').length, 2)
  eq(
    'distinct owners',
    new Set(classes.flatMap((c) => (c.teacherId === null ? [] : [c.teacherId]))).size,
    CLASS_OWNERS_TOTAL,
  )
  eq(
    'distinct subjects',
    new Set(classes.flatMap((c) => (c.subjectId === null ? [] : [c.subjectId]))).size,
    CLASS_SUBJECTS_DISTINCT,
  )
  const t5Subjects = new Set(
    classes.flatMap((c) =>
      c.educationLevel === 'tingkatan-5' && c.subjectId !== null ? [c.subjectId] : [],
    ),
  )
  eq('T5 subjects (A.4 "26 subjek")', t5Subjects.size, T5_SUBJECTS_A4.length)
  for (const s of T5_SUBJECTS_A4) {
    if (!t5Subjects.has(s)) issues.push(`T5 classes lack subject ${String(s)} of M08 A.4`)
  }
  eq('distinct class keys', new Set(classes.map((c) => c.id)).size, classes.length)
  eq(
    'distinct join codes',
    new Set(classes.filter((c) => c.joinCode !== '').map((c) => c.joinCode)).size,
    classes.length - 2,
  )

  const t4 = enrolments.filter((e) => e.educationLevel === 'tingkatan-4' && e.status === 'active')
  const t5 = enrolments.filter((e) => e.educationLevel === 'tingkatan-5' && e.status === 'active')
  eq('T4 distinct students', new Set(t4.map((e) => e.studentId)).size, T4_DISTINCT)
  eq('T4 memberships', t4.length, T4_MEMBERSHIPS)
  eq('T5 distinct students', new Set(t5.map((e) => e.studentId)).size, T5_DISTINCT)

  const size = new Map<string, number>()
  for (const e of enrolments)
    if (e.status === 'active') size.set(e.classKey, (size.get(e.classKey) ?? 0) + 1)
  for (const [key, n] of Object.entries(OBSERVED_SIZES))
    eq(`members of ${key}`, size.get(key) ?? 0, n)
  const c1156 = enrolments.filter((e) => e.classKey === 'classroom:1156')
  if (c1156.length !== 1 || c1156[0]?.studentId !== PUPIL_1156) {
    issues.push(`class 1156 must have the single member ${String(PUPIL_1156)}`)
  }

  // "{n} GURU" (M17 BR-M17-11): distinct owners of a classroom with an active enrolment of the pupils of a
  // window (today ⊂ week ⊂ month), per plan school (data/guru.ts).
  const ownerOf = new Map(
    classes.flatMap((c) =>
      c.kind === 'classroom' && c.teacherId !== null ? [[c.id, c.teacherId] as const] : [],
    ),
  )
  const ownersByPupil = new Map<number, Set<number>>()
  for (const e of enrolments) {
    if (e.status !== 'active') continue
    const owner = ownerOf.get(e.classKey)
    if (owner === undefined) continue
    const set = ownersByPupil.get(e.studentId) ?? new Set<number>()
    set.add(owner)
    ownersByPupil.set(e.studentId, set)
  }
  const distinctOwners = (pupils: readonly number[]): number => {
    const out = new Set<number>()
    for (const p of pupils) for (const o of ownersByPupil.get(p) ?? []) out.add(o)
    return out.size
  }
  for (const plan of GURU_PLANS) {
    const week = [...plan.today, ...plan.week]
    eq(`GURU ${String(plan.school)} today`, distinctOwners(plan.today), plan.targets.today)
    eq(`GURU ${String(plan.school)} week`, distinctOwners(week), plan.targets.week)
    eq(
      `GURU ${String(plan.school)} month`,
      distinctOwners([...week, ...plan.month]),
      plan.targets.month,
    )
  }
  return issues
}
