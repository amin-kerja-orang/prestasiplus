/**
 * Seed tags (D11, v2-dskp-integration section 6): the DSKP tag of every seed question, authored in
 * one table. A seed is tagged from the catalogue only when its own text states the competence of
 * exactly one SP (verb and object correspond); the row carries the evidence. When no SP matches, the
 * seed is flagged `perlu-semakan` with a note and a person tags it later; an SP is never guessed, and
 * a label that is merely close to a unit title is never enough. Content from Tingkatan 1-3 is outside
 * DSKP (Q-S2): no unit, no SP. TP is the value the seed was authored with (seeds default to 2; three
 * Sejarah questions state 3, 4, 4); it is not a catalogue value and is not tuned here (risk R-A).
 *
 * The seed builders leave a placeholder tag (`untagged`); `applySeedTags` replaces it from this table
 * when the registry and the review seeds are built. Tagging adds metadata only: no seed question is
 * added, removed or edited. A flagged question is blocked at publish and revision by the shared tag
 * rule (`gateErrors`, DSKP-T05). Catalogue ids are the opaque keys M03 issues (`SUBJECT:T4|T5:u|sp:<code>`).
 */
import type { CurriculumTag, DskpSpId, DskpUnitId, QuestionDef, TpLevel } from '../domain/types'
import { catalogueVersion } from '../lib/dskp-source'

export type SeedTagSpec =
  /** Tagged from the catalogue; `evidence` points at the question text that states the SP. */
  | {
      kind: 'tagged'
      subject: string
      /** The old free-text unit label of the seed (documentation only, never displayed). */
      label: string
      formOrigin: 'T4' | 'T5'
      unitId: DskpUnitId
      spIds: DskpSpId[]
      tp: TpLevel
      evidence: string
    }
  /** No SP matches: flagged `perlu-semakan`, no tingkatan, unit or SP; `note` says why. */
  | { kind: 'flagged'; subject: string; label: string; tp: TpLevel; note: string }
  /** Tingkatan 1-3 content (Q-S2): outside DSKP, not flagged. */
  | { kind: 't1t3'; subject: string; label: string; tp: TpLevel }

const t1t3 = (subject: string, label: string, tp: TpLevel): SeedTagSpec => ({
  kind: 't1t3',
  subject,
  label,
  tp,
})

const flagged = (subject: string, label: string, tp: TpLevel, note: string): SeedTagSpec => ({
  kind: 'flagged',
  subject,
  label,
  tp,
  note,
})

function tagged(
  subject: string,
  label: string,
  formOrigin: 'T4' | 'T5',
  unitId: string,
  spId: string,
  tp: TpLevel,
  evidence: string,
): SeedTagSpec {
  return {
    kind: 'tagged',
    subject,
    label,
    formOrigin,
    unitId: unitId as DskpUnitId,
    spIds: [spId as DskpSpId],
    tp,
    evidence,
  }
}

/* ------------------------------------------------------------------------------ tagged rows */

/** Stem "Faktorkan ..." then "selesaikan persamaan kuadratik itu". */
const quadraticByFactorising = (tp: TpLevel): SeedTagSpec =>
  tagged(
    'MAT',
    'Persamaan kuadratik',
    'T4',
    'MAT:T4:u:1.0',
    'MAT:T4:sp:1.1.6',
    tp,
    'Part (a) factorises the quadratic expression and part (b)(i) solves the quadratic equation "Seterusnya" ' +
      '(by that factorisation): SP 1.1.6 "Menentukan punca suatu persamaan kuadratik dengan kaedah ' +
      'pemfaktoran". Part (b)(ii), the sum of the roots, has no SP of its own. The reviewer confirms.',
  )

/** Stem "Diberi n(A), n(B) dan n(A and B). Cari n(A or B)". */
const unionOfSets = (tp: TpLevel): SeedTagSpec =>
  tagged(
    'MAT',
    'Set',
    'T4',
    'MAT:T4:u:4.0',
    'MAT:T4:sp:4.2.3',
    tp,
    'The stem gives n(A), n(B) and n(A and B) and asks for n(A or B), a problem that involves the union of ' +
      'sets: SP 4.2.3 "Menyelesaikan masalah yang melibatkan kesatuan set". Considered and rejected: 4.2.1 ' +
      '(identify and describe a union with representations; the stem asks for a count, not a description), ' +
      '4.1.3 (intersection problems; n(A and B) is given, not asked) and 4.3.3 (problems on a combination of ' +
      'set operations; the stem uses the union only). The reviewer confirms.',
  )

/** Stem "Hitung laju kereta mainan" from a distance and a time. */
const speedProblem = (tp: TpLevel): SeedTagSpec =>
  tagged(
    'SN',
    'Daya dan gerakan',
    'T4',
    'SN:T4:u:11.0',
    'SN:T4:sp:11.1.3',
    tp,
    'The stem gives the distance a toy car moves and the time taken and asks for its speed: SP 11.1.3 ' +
      '"Solve problems that involve speed, average speed, velocity and acceleration in daily life". The BM ' +
      'label is not used as evidence (the catalogue title is "Force and Motion"; BM aliases are Q-D9, later).',
  )

/* ------------------------------------------------------------------------------ flagged notes */

const NOTE = {
  GARIS:
    'Stems ask the gradient, midpoint, distance, y-intercept or a value of a straight line; no Matematik ' +
    'T4/T5 SP covers them. Probably Tingkatan 1-3 content: the reviewer may re-tag it T1-T3 (then exempt).',
  ALGEBRA:
    '"Algebra" is a strand word, not a unit. The stems factorise an expression and solve a linear equation; ' +
    'no Matematik T4/T5 SP covers them.',
  KETAKSAMAAN:
    'The stem solves a one-variable linear inequality; the Matematik T4 unit 6.0 is two variables.',
  KEBARANGKALIAN:
    'Single-event probability; Matematik T5 has no probability unit and T4 9.0 is combined events.',
  TRIGO:
    'A bare tangent ratio in a right-angled triangle: Matematik T5 6.1.1 and 6.1.2 are sin, cos and tan of ' +
    'angles in quadrants II to IV (not this item), 6.1.3 gives the value and asks for the angle (not this ' +
    'item) and 6.1.4 is problem solving (not this item). 6.1.3 and 6.1.4 were considered and rejected; 6.2 ' +
    'is graphs. No Matematik T4/T5 SP covers it.',
  LUASTRIGO:
    'Area of a right-angled triangle and a sin/cos ratio from its sides. Area has no Matematik T4/T5 SP. The ' +
    'ratio is not quadrants II to IV (T5 6.1.1, 6.1.2), not finding an angle from a value (6.1.3) and not ' +
    'problem solving (6.1.4); 6.1.3 and 6.1.4 were considered and rejected. No SP covers it.',
  DAYA: 'The stem asks the SI unit of force; no Sains SP is about units of force.',
  OSMOSIS: 'The stem is about osmosis in root cells; no Sains T4/T5 SP covers osmosis.',
  FOTO: 'The stem asks the factors of the rate of photosynthesis; no Sains T4/T5 SP covers it.',
  MERDEKA:
    'The stem spans several SK of Tajuk 10 and 11 and K-coded items; no single SP wording matches. A person ' +
    'picks the SP. Lead for the reviewer, not applied: the only unit whose title shares words with the old ' +
    'label is SEJ:T4:u:Tajuk 11.',
  MERDEKA_Q3:
    'The stem asks the importance of a constitution to a newly independent country. Nearest candidates, ' +
    'neither applied: K11.3.8 "Mentafsir kepentingan menjunjung keluhuran perlembagaan" (T4) and, in T5, ' +
    'K12.2.5 "Menerangkan kepentingan mendaulatkan perlembagaan negara". Both are K-coded values items on ' +
    'upholding the constitution, in two forms, so no single SP wording matches. A person picks the SP.',
  MERDEKA_Q4:
    'The stem asks the role of inter-ethnic cooperation in building national unity. Nearest candidates, none ' +
    'close enough to apply: 11.1.2 (the Communities Liaison Committee), K11.2.8 (power sharing among a ' +
    'multi-ethnic society) and, in T5, 14.1.1 "Menyatakan usaha-usaha perpaduan dan integrasi nasional". No ' +
    'close SP; a person picks.',
  KRONO:
    'Matching events to years (Persekutuan Tanah Melayu, the first general election, independence) spans ' +
    'Tajuk 10 and 11; no single SP matches.',
} as const

const SEL_ORG =
  'The stem is about organelles of a plant cell (name and function); the only Sains T4 cell SP is cell ' +
  'division (5.1).'
const SEL_RBC =
  'The stem is about the function of the red blood cell and its missing nucleus; the only Sains T4 cell SP ' +
  'is cell division (5.1).'

/* ----------------------------------------------------------------------------------- the table */

/** One row per seed question id (bank seeds and review seeds). */
export const SEED_TAGS: Readonly<Record<string, SeedTagSpec>> = {
  // MAT: Tingkatan 1-3 (outside DSKP, Q-S2)
  'mat1-pecahan-v1': t1t3('MAT', 'Pecahan', 2),
  'mat1-pecahan-v2': t1t3('MAT', 'Pecahan', 2),
  'mat1-peratus-v1': t1t3('MAT', 'Peratusan', 2),
  'mat1-peratus-v2': t1t3('MAT', 'Peratusan', 2),
  'mat1-bentuk-piawai-v1': t1t3('MAT', 'Bentuk piawai', 2),
  'mat1-bentuk-piawai-v2': t1t3('MAT', 'Bentuk piawai', 2),
  'mat1-persamaan-v1': t1t3('MAT', 'Persamaan linear', 2),
  'mat1-persamaan-v2': t1t3('MAT', 'Persamaan linear', 2),
  'mat1-kembang-v1': t1t3('MAT', 'Ungkapan algebra', 2),
  'mat1-kembang-v2': t1t3('MAT', 'Ungkapan algebra', 2),
  'mat1-faktor-v1': t1t3('MAT', 'Pemfaktoran', 2),
  'mat1-faktor-v2': t1t3('MAT', 'Pemfaktoran', 2),
  'mat1-indeks-v1': t1t3('MAT', 'Indeks', 2),
  'mat1-indeks-v2': t1t3('MAT', 'Indeks', 2),
  'mat1-min-v1': t1t3('MAT', 'Statistik', 2),
  'mat1-min-v2': t1t3('MAT', 'Statistik', 2),
  'mat1-laju-v1': t1t3('MAT', 'Laju, jarak dan masa', 2),
  'mat1-laju-v2': t1t3('MAT', 'Laju, jarak dan masa', 2),
  'mat1-poligon-v1': t1t3('MAT', 'Poligon', 2),
  'mat1-poligon-v2': t1t3('MAT', 'Poligon', 2),
  'mat1-pythagoras-v1': t1t3('MAT', 'Teorem Pythagoras', 2),
  'mat1-pythagoras-v2': t1t3('MAT', 'Teorem Pythagoras', 2),
  'mat1-bulatan-v1': t1t3('MAT', 'Bulatan', 2),
  'mat1-bulatan-v2': t1t3('MAT', 'Bulatan', 2),
  'mat1-g1-q1': t1t3('MAT', 'Teorem Pythagoras', 2),
  'mat1-g1-q2': t1t3('MAT', 'Perimeter', 2),
  'mat1-g1-q3': t1t3('MAT', 'Luas', 2),
  'mat1-g2-q1': t1t3('MAT', 'Statistik', 2),
  'mat1-g2-q2': t1t3('MAT', 'Statistik', 2),
  'mat1-g2-q3': t1t3('MAT', 'Statistik', 2),
  'mat1-g2-q4': t1t3('MAT', 'Statistik', 2),
  'mat2-segitiga-v1-q1': t1t3('MAT', 'Teorem Pythagoras', 2),
  'mat2-segitiga-v2-q1': t1t3('MAT', 'Teorem Pythagoras', 2),
  'mat2-diskaun-v1': t1t3('MAT', 'Peratusan', 2),
  'mat2-diskaun-v2': t1t3('MAT', 'Peratusan', 2),
  'mat2-diskaun-v3': t1t3('MAT', 'Peratusan', 2),
  'mat2-statistik-v1': t1t3('MAT', 'Statistik', 2),
  'mat2-statistik-v2': t1t3('MAT', 'Statistik', 2),
  'mat1-rev-1': t1t3('MAT', 'Pecahan', 2),
  'mat1-rev-2': t1t3('MAT', 'Peratusan', 2),
  'mat1-rev-3': t1t3('MAT', 'Indeks', 2),
  'mat2-rev-g1-q1': t1t3('MAT', 'Teorem Pythagoras', 2),
  'mat1-pub-1': t1t3('MAT', 'Persamaan linear', 2),
  'mat1-pub-2': t1t3('MAT', 'Statistik', 2),
  // MAT: tagged (own text states one SP)
  'mat1-set-v1': unionOfSets(2),
  'mat1-set-v2': unionOfSets(2),
  'mat2-kuadratik-v1': quadraticByFactorising(2),
  'mat2-kuadratik-v2': quadraticByFactorising(2),
  // MAT: flagged (no SP matches)
  'mat1-kecerunan-v1': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat1-kecerunan-v2': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat1-kebarangkalian-v1': flagged('MAT', 'Kebarangkalian', 2, NOTE.KEBARANGKALIAN),
  'mat1-kebarangkalian-v2': flagged('MAT', 'Kebarangkalian', 2, NOTE.KEBARANGKALIAN),
  'mat1-ketaksamaan-v1': flagged('MAT', 'Ketaksamaan linear', 2, NOTE.KETAKSAMAAN),
  'mat1-ketaksamaan-v2': flagged('MAT', 'Ketaksamaan linear', 2, NOTE.KETAKSAMAAN),
  'mat1-g1-q4': flagged('MAT', 'Trigonometri', 2, NOTE.TRIGO),
  'mat1-g3-q1': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat1-g3-q2': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat1-g3-q3': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat1-g3-q4': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat2-algebra-v1': flagged('MAT', 'Algebra', 2, NOTE.ALGEBRA),
  'mat2-algebra-v2': flagged('MAT', 'Algebra', 2, NOTE.ALGEBRA),
  'mat2-segitiga-v1-q2': flagged('MAT', 'Luas dan trigonometri', 2, NOTE.LUASTRIGO),
  'mat2-segitiga-v2-q2': flagged('MAT', 'Luas dan trigonometri', 2, NOTE.LUASTRIGO),
  'mat2-garis-v1': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat2-garis-v2': flagged('MAT', 'Garis lurus', 2, NOTE.GARIS),
  'mat2-rev-g1-q2': flagged('MAT', 'Luas dan trigonometri', 2, NOTE.LUASTRIGO),
  // SN: tagged (own text states one SP)
  'sn2-laju-v1': speedProblem(2),
  'sn2-laju-v2': speedProblem(2),
  'sn2-laju-v3': speedProblem(2),
  // SN: flagged (no SP matches)
  'sn2-sel-q1': flagged('SN', 'Sel', 2, SEL_ORG),
  'sn2-sel-q2': flagged('SN', 'Sel', 2, SEL_ORG),
  'sn2-osmosis': flagged('SN', 'Pergerakan bahan merentasi membran', 2, NOTE.OSMOSIS),
  'sn2-fotosintesis': flagged('SN', 'Fotosintesis', 2, NOTE.FOTO),
  'sn2-rev-1': flagged('SN', 'Sel', 2, SEL_RBC),
  'sn1-rev-1': flagged('SN', 'Daya dan gerakan', 2, NOTE.DAYA),
  // SEJ: flagged (no SP matches)
  'sej2-q1': flagged('SEJ', 'Kemerdekaan Tanah Melayu', 3, NOTE.MERDEKA),
  'sej2-q2': flagged('SEJ', 'Kronologi sejarah negara', 2, NOTE.KRONO),
  'sej2-q3': flagged('SEJ', 'Kemerdekaan Tanah Melayu', 4, NOTE.MERDEKA_Q3),
  'sej2-q4': flagged('SEJ', 'Kemerdekaan Tanah Melayu', 4, NOTE.MERDEKA_Q4),
}

/* --------------------------------------------------------------------------------- application */

/** The tag a spec stands for (a fresh object each call, so no two questions share arrays). */
export function tagOfSpec(spec: SeedTagSpec): CurriculumTag {
  switch (spec.kind) {
    case 'tagged':
      return {
        subject: spec.subject,
        formOrigin: spec.formOrigin,
        unitId: spec.unitId,
        spIds: [...spec.spIds],
        tp: spec.tp,
        kbat: null,
        catalogueVersion: catalogueVersion(),
      }
    case 't1t3':
      return {
        subject: spec.subject,
        formOrigin: 'T1-T3',
        unitId: null,
        spIds: [],
        tp: spec.tp,
        kbat: null,
        catalogueVersion: null,
      }
    case 'flagged':
      return {
        subject: spec.subject,
        formOrigin: null,
        unitId: null,
        spIds: [],
        tp: spec.tp,
        kbat: null,
        catalogueVersion: null,
        review: 'perlu-semakan',
      }
  }
}

/**
 * Replaces the placeholder tag of each seed question with its row of `SEED_TAGS`. A question without
 * a row, or whose subject differs from its row, is a build error (a seed is never left untagged and
 * never tagged by guess).
 */
export function applySeedTags(questions: Iterable<QuestionDef>): void {
  for (const q of questions) {
    const spec = SEED_TAGS[q.id]
    if (!spec) throw new Error(`seed-tags: no tag row for seed question "${q.id}"`)
    if (spec.subject !== q.curriculum.subject)
      throw new Error(
        `seed-tags: the row for "${q.id}" is ${spec.subject}, the question is ${q.curriculum.subject}`,
      )
    q.curriculum = tagOfSpec(spec)
  }
}
