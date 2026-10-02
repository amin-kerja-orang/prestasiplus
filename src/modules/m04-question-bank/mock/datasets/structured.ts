/**
 * The `structuredQuestions` virtual dataset (owner M04; SRS v1.10 §6.11, §6.13.3): 4,064 structured
 * questions, ids 393–4456 (consecutive), all `published` and `visibility = public`, levels T4/T5.
 *
 * Observed: per-subject counts (S8 pills), KBAT 5 = 483, Bahasa Melayu KBAT 6 = 3 (Matematik none),
 * 5 inactive rows (3699, 3703, 2509 and two Biologi rows) so the student-visible total is 4,059,
 * `needsDiagram` 522 (Fizik 6). PROPOSED: the T4/T5 split, the KBAT 1–4 spread and the other
 * `needsDiagram` rows. Anchors (§6.11 "Structured anchors") are literal.
 *
 * Runtime rows (M10 `structured.create`) take ids from 9,000,001 (BR-M04-36).
 */

import { defineVirtualDataset, hashKey, split, type CellSpec } from '@/mock/dataset'
import { floor } from '@/mock/define'
import { toIsoMyt } from '@/lib/time'

import { OTHER_CREATOR } from '../data/anchors'
import {
  STRUCTURED_BY_SUBJECT,
  STRUCTURED_ID_RANGE,
  STRUCTURED_KBAT5,
  STRUCTURED_NEEDS_DIAGRAM,
  TEACHER_CONTRIB,
} from '../data/tables'
import type {
  StructuredCheapKey,
  StructuredFacetKey,
  StructuredFacets,
  StructuredQuestion,
  StructuredSubQuestion,
} from '../repository/types'
import { CellBuilder } from './cell-builder'
import { scriptOf } from './question-derive'

type SF = StructuredFacets

export const STRUCTURED_FACETS = [
  'subjectId',
  'educationLevelId',
  'kbatLevel',
  'status',
  'isActive',
  'needsDiagram',
  'contribSchoolId',
] as const satisfies readonly (keyof SF)[]

export const STRUCTURED_RUNTIME_FLOOR = 9_000_001

// --- time --------------------------------------------------------------------------------------

const S_T0 = Date.parse('2024-09-02T09:00:00+08:00')
const S_T1 = Date.parse('2026-05-19T21:00:00+08:00')
const S_STEP = (S_T1 - S_T0) / (STRUCTURED_ID_RANGE.max - STRUCTURED_ID_RANGE.min)

export function structuredCreatedAtMs(key: number): number {
  const k = Math.min(Math.max(key, STRUCTURED_ID_RANGE.min), STRUCTURED_ID_RANGE.max)
  return Math.floor((S_T0 + (k - STRUCTURED_ID_RANGE.min) * S_STEP) / 1000) * 1000
}

/** M02 v1.20 contributor anchor of a Q-TEACHER-CONTRIB school, or null. */
export function teacherOfSchool(schoolId: number | null): number | null {
  if (schoolId === null) return null
  return TEACHER_CONTRIB.find((t) => t.schoolId === schoolId)?.teacherId ?? null
}

// --- anchors -------------------------------------------------------------------------------------

interface StructuredAnchorDef {
  id: number
  facets: SF
  fields: Partial<StructuredQuestion> & { subs?: readonly (readonly [string, number, string?])[] }
}

const sf = (subjectId: number, levelId: number, kbat: number, active = true): SF => ({
  subjectId,
  educationLevelId: levelId,
  kbatLevel: kbat,
  status: 'published',
  isActive: active,
  needsDiagram: false,
  contribSchoolId: null,
})

const BM_PART = (n: number) =>
  Array.from({ length: n }, (_, i) => [String.fromCharCode(97 + i), 2] as const)

export const STRUCTURED_ANCHORS: readonly StructuredAnchorDef[] = [
  {
    id: 3698,
    facets: sf(5, 11, 3),
    fields: {
      questionNumber: 3,
      stimulus: 'Baca sumber berikut dengan teliti dan jawab soalan-soalan yang berikutnya.',
      createdAt: '2026-04-08T10:00:00+08:00',
      subs: [
        ['a', 2, 'Nyatakan dua ciri negara berdaulat.'],
        ['b', 4, 'Jelaskan kepentingan perlembagaan kepada negara.'],
        ['c', 4, 'Pada pendapat anda, bagaimanakah semangat patriotisme dapat dipupuk?'],
      ],
    },
  },
  {
    id: 3699,
    facets: sf(1, 11, 2, false),
    fields: { stimulus: 'Petikan 1: Rencana Wau Kapal.', subs: BM_PART(5) },
  },
  {
    id: 3700,
    facets: sf(1, 11, 2),
    fields: { stimulus: 'Petikan 2: Dialog Kerabu Rumpai Laut.', isTrial: true, subs: BM_PART(5) },
  },
  {
    id: 3701,
    facets: sf(1, 11, 2),
    fields: {
      stimulus: 'Petikan 3: Berita Pakaian Terpakai Jadi Pilihan.',
      isTrial: true,
      subs: BM_PART(5),
    },
  },
  {
    id: 3702,
    facets: sf(1, 11, 2),
    fields: {
      stimulus: 'Petikan 4: Cerpen Gerai Karipap Parkir.',
      isTrial: true,
      subs: BM_PART(5),
    },
  },
  {
    id: 3703,
    facets: sf(2, 11, 3, false),
    fields: {
      stimulus: 'Part 1 email response to cousin Fairuz about planning an outing after exams.',
      subs: [
        ['a', 2],
        ['b', 2],
        ['c', 3],
        ['d', 3],
      ],
    },
  },
  ...[3704, 3705, 3706].map((id) => ({
    id,
    facets: sf(2, 11, 3),
    fields: {
      estimatedMinutes: 10,
      subs: [
        ['a', 2],
        ['b', 2],
        ['c', 3],
        ['d', 3],
      ] as const,
    },
  })),
  ...[2505, 2510, 2511].map((id) => ({ id, facets: sf(3, 10, 1), fields: { isTrial: true } })),
  {
    id: 2509,
    facets: sf(3, 10, 1, false),
    fields: {
      stimulus: 'Jadual 1 menunjukkan markah Irfan dalam lima ujian Matematik.',
      complianceStatus: 'draft',
    },
  },
  {
    id: 4454,
    facets: sf(23, 11, 3),
    fields: {
      questionNumber: null,
      stimulus:
        'Soalan Oleh: Guru Pakar\nKertas 2 Bab 7 Tingkatan 5 (2019)\nItem 1\nBaca situasi perniagaan berikut dan jawab soalan.',
      topic: 'Merancang Pengendalian Perniagaan',
      isTrial: true,
      curriculumChapterId: 1281,
      createdAt: '2026-05-20T09:00:00+08:00',
      subs: [['a', 8, 'Huraikan empat langkah merancang pengendalian perniagaan.']],
    },
  },
  {
    id: 4455,
    facets: sf(23, 11, 3),
    fields: { createdAt: '2026-05-20T09:00:00+08:00' },
  },
  {
    id: 4456,
    facets: sf(23, 11, 3),
    fields: { createdAt: '2026-05-20T09:00:00+08:00' },
  },
]

// --- spec ----------------------------------------------------------------------------------------

let memo: CellSpec<SF>[] | null = null

/** The memoised structured distribution (see the file header). */
export function structuredSpec(): CellSpec<SF>[] {
  if (memo) return memo
  const b = new CellBuilder<SF>(STRUCTURED_FACETS, 'structured spec')
  const subjects = Object.keys(STRUCTURED_BY_SUBJECT).map(Number)
  const kbat5 = new Map(
    split(
      STRUCTURED_KBAT5,
      subjects.map((s) => [s, STRUCTURED_BY_SUBJECT[s] as number] as const),
    ),
  )
  for (const s of subjects) {
    const total = STRUCTURED_BY_SUBJECT[s] as number
    for (const [l, n] of split(total, [
      [10, 1],
      [11, 1],
    ] as const)) {
      const k5 = split(kbat5.get(s) ?? 0, [
        [10, 1],
        [11, 1],
      ] as const).find(([lv]) => lv === l)?.[1] as number
      const k6 = s === 1 && l === 11 ? 3 : 0
      const rest = n - k5 - k6
      b.add(sf(s, l, 5), k5)
      b.add(sf(s, l, 6), k6)
      for (const [k, m] of split(rest, [
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
      ] as const)) {
        b.add(sf(s, l, k), m)
      }
    }
  }
  // Anchors keep their tuples (reserved); two Biologi rows are inactive (PROPOSED: T5, KBAT 3).
  for (const a of STRUCTURED_ANCHORS) {
    const t = a.facets
    b.reserve(
      (f) =>
        f.subjectId === t.subjectId &&
        f.educationLevelId === t.educationLevelId &&
        f.kbatLevel === t.kbatLevel &&
        f.isActive,
      1,
      t,
      `anchor:${String(a.id)}`,
    )
  }
  b.take((f) => f.subjectId === 11 && f.educationLevelId === 11 && f.kbatLevel === 3, 2, {
    isActive: false,
  })
  // needsDiagram: Fizik 6, the rest spread over the other subjects by count (PROPOSED).
  const others = subjects.filter((s) => s !== 9)
  const nd = new Map(
    split(
      STRUCTURED_NEEDS_DIAGRAM - 6,
      others.map((s) => [s, STRUCTURED_BY_SUBJECT[s] as number] as const),
    ),
  )
  nd.set(9, 6)
  for (const [s, n] of nd) {
    b.take((f) => f.subjectId === s && f.isActive, n, { needsDiagram: true })
  }
  // Teacher contributions (Q-TEACHER-CONTRIB structured part, BR-M04-38 c; placement PROPOSED).
  for (const t of TEACHER_CONTRIB) {
    b.take((f) => f.isActive && f.contribSchoolId === null, t.structured, {
      contribSchoolId: t.schoolId,
    })
  }
  memo = b.build()
  return memo
}

// --- derivation ----------------------------------------------------------------------------------

const STIMULI: Readonly<Record<number, readonly string[]>> = {
  1: ['Baca petikan di bawah dengan teliti, kemudian jawab soalan-soalan yang berikutnya.'],
  2: ['Read the text below carefully and answer the questions that follow.'],
  3: ['Rajah menunjukkan maklumat tentang satu situasi. Jawab soalan-soalan berikut.'],
  4: ['Rajah menunjukkan satu eksperimen. Berdasarkan rajah, jawab soalan-soalan berikut.'],
  5: ['Baca sumber berikut dengan teliti dan jawab soalan-soalan yang berikutnya.'],
  23: ['Baca situasi perniagaan berikut dan jawab soalan-soalan yang berikutnya.'],
}
const GENERIC_STIMULUS = 'Berdasarkan maklumat yang diberi, jawab soalan-soalan yang berikutnya.'

export function structuredStimulusOf(key: number, f: Readonly<SF>): string {
  const list = STIMULI[f.subjectId]
  return list ? (list[hashKey(key, 61) % list.length] as string) : GENERIC_STIMULUS
}

export function subQuestionsOf(
  id: number,
  parts: readonly (readonly [string, number, string?])[],
): StructuredSubQuestion[] {
  return parts.map(([label, marks, text], i) => ({
    id: id * 100 + i + 1,
    structuredQuestionId: id,
    partLabel: label,
    questionText: text ?? `Jawab bahagian (${label}) berdasarkan maklumat yang diberi.`,
    marks,
    answerType: 'text',
    expectedNumeric: null,
    numericTolerance: null,
    rubrics: [{ konstruk: 'F', keyword: 'isi utama', marks }],
    modelAnswer: 'Jawapan mengandungi isi utama dan huraian yang tepat.',
    parentSubId: null,
    order: i + 1,
  }))
}

function generatedParts(key: number): [string, number][] {
  const n = 2 + (hashKey(key, 62) % 4)
  return Array.from({ length: n }, (_, i) => [
    String.fromCharCode(97 + i),
    2 + (hashKey(key, 63 + i) % 3),
  ])
}

type Derived = Omit<StructuredQuestion, 'id' | StructuredFacetKey | StructuredCheapKey>

function deriveStructured(key: number, f: Readonly<SF>): Derived {
  const subQuestions = subQuestionsOf(key, generatedParts(key))
  const { scriptType, textDirection } = scriptOf(f.subjectId)
  return {
    estimatedMinutes: 5 + 5 * (hashKey(key, 64) % 3),
    isTrial: hashKey(key, 65) % 3 === 0,
    topic: null,
    questionNumber: hashKey(key, 66) % 4 === 0 ? null : 1 + (hashKey(key, 67) % 8),
    stimulusImage: null,
    totalMarks: subQuestions.reduce((a, s) => a + s.marks, 0),
    visibility: 'public',
    complianceStatus: 'verified',
    sourceFile: null,
    sourcePage: null,
    sourceSet: null,
    curriculumChapterId: null,
    curriculumTopicId: null,
    dskpSpId: null,
    scriptType,
    textDirection,
    questionTemplate: null,
    subQuestions,
  }
}

function anchorRow(a: StructuredAnchorDef): StructuredQuestion {
  const { subs, ...fields } = a.fields
  const base = deriveStructured(a.id, a.facets)
  const subQuestions = subs ? subQuestionsOf(a.id, subs) : base.subQuestions
  const createdAt = fields.createdAt ?? toIsoMyt(structuredCreatedAtMs(a.id))
  const createdAtMs = Date.parse(createdAt)
  return {
    ...base,
    stimulus: structuredStimulusOf(a.id, a.facets),
    createdBy: OTHER_CREATOR,
    ...fields,
    createdAt,
    createdAtMs,
    updatedAt: createdAt,
    updatedAtMs: createdAtMs,
    subQuestions,
    totalMarks: subQuestions.reduce((x, s) => x + s.marks, 0),
    ...a.facets,
    id: a.id,
  }
}

export const STRUCTURED_ANCHOR_ROWS: readonly StructuredQuestion[] =
  STRUCTURED_ANCHORS.map(anchorRow)

export const structuredDataset = defineVirtualDataset<
  StructuredQuestion,
  StructuredFacetKey,
  StructuredCheapKey
>({
  name: 'structuredQuestions',
  owner: 'M04',
  idRange: STRUCTURED_ID_RANGE,
  runtimeIds: floor({ start: STRUCTURED_RUNTIME_FLOOR }),
  facets: STRUCTURED_FACETS,
  distribution: () => structuredSpec(),
  derive: (id, facets) => deriveStructured(id, facets),
  fields: {
    createdAt: (key) => toIsoMyt(structuredCreatedAtMs(key)),
    createdAtMs: (key) => structuredCreatedAtMs(key),
    updatedAt: (key) => toIsoMyt(structuredCreatedAtMs(key)),
    updatedAtMs: (key) => structuredCreatedAtMs(key),
    // Teacher contributions (Q-TEACHER-CONTRIB-STR) are credited to the M02 contributor anchor of
    // their school (4501–4504; only 8087 and 8107 have structured rows); every other generated row keeps the generated creator.
    createdBy: (_key, f) => teacherOfSchool(f.contribSchoolId) ?? OTHER_CREATOR,
    stimulus: (key, f) => structuredStimulusOf(key, f),
  },
  anchors: STRUCTURED_ANCHOR_ROWS,
  order: { field: 'createdAtMs', generated: structuredCreatedAtMs },
})
