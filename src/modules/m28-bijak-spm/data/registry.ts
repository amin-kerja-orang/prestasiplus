/**
 * Seed registry: subjects, curated papers (Kertas Pilihan), blueprints (Kontrak Blueprint) and the
 * question pool behind Jana Kertas. Built once at module load; fictitious practice content.
 */
import type { Blueprint, PaperDef, Subject, SubjectCode } from '../domain/types'
import { Bank } from './builders'
import { seedMatK1 } from './mat-k1'
import { seedMatK2 } from './mat-k2'
import { seedSainsK2 } from './sains-k2'
import { seedSejarahK2 } from './sejarah-k2'

export const SUBJECTS: Subject[] = [
  { code: 'MAT', name: 'Matematik' },
  { code: 'SN', name: 'Sains' },
  { code: 'SEJ', name: 'Sejarah' },
]

export const subjectName = (code: SubjectCode): string =>
  SUBJECTS.find((s) => s.code === code)?.name ?? code

const MAT_REFERENCE: NonNullable<PaperDef['reference']> = [
  {
    title: 'Rumus (ringkas)',
    items: [
      'Teorem Pythagoras: $c^2 = a^2 + b^2$',
      'Kecerunan: $m = \\frac{y_2 - y_1}{x_2 - x_1}$',
      'Luas segi tiga: $\\frac{1}{2} \\times \\text{tapak} \\times \\text{tinggi}$',
      'Luas bulatan: $\\pi j^2$, $\\pi = \\frac{22}{7}$',
      'Min: $\\frac{\\text{jumlah nilai}}{\\text{bilangan nilai}}$',
    ],
  },
]

const bank = new Bank()
const k1 = seedMatK1(bank)
seedMatK2(bank)
const sn = seedSainsK2(bank)
const sej = seedSejarahK2(bank)

const matK1Instructions = [
  'Kertas ini mengandungi 40 soalan objektif.',
  'Jawab semua soalan. Pilih satu jawapan sahaja bagi setiap soalan.',
  'Rajah tidak dilukis mengikut skala kecuali dinyatakan.',
]
const matK2Instructions = [
  'Kertas ini mengandungi tiga bahagian: Bahagian A, Bahagian B dan Bahagian C.',
  'Jawab semua soalan dalam Bahagian A dan Bahagian B, dan satu soalan dalam Bahagian C.',
  'Tunjukkan langkah kerja anda. Markah boleh diberi untuk kaedah yang betul.',
]
const snInstructions = [
  'Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.',
  'Jawab semua soalan dalam Bahagian A dan satu soalan dalam Bahagian B.',
]

export const PAPERS: PaperDef[] = [
  {
    id: 'mat-k1-2025-a',
    title: 'Percubaan SPM Matematik Kertas 1 Set A',
    subject: 'MAT',
    kertas: 1,
    year: 2025,
    code: '1449/1',
    durationMin: 75,
    instructions: matK1Instructions,
    reference: MAT_REFERENCE,
    // Real blueprint: one section "Objektif", all questions, 1 mark each (PoC: 10 of 40 questions).
    sections: [
      {
        id: 'mat-k1-2025-a-s1',
        label: 'Objektif',
        rule: { type: 'all' },
        markBudget: 10,
        questionCount: 10,
        questionIds: k1.setA,
      },
    ],
  },
  {
    id: 'mat-k2-2025-a',
    title: 'Percubaan SPM Matematik Kertas 2 Set A',
    subject: 'MAT',
    kertas: 2,
    year: 2025,
    code: '1449/2',
    durationMin: 150,
    instructions: matK2Instructions,
    reference: MAT_REFERENCE,
    // Real blueprint structure (A all, B all, C choose 1 of 2) at PoC scale: Q1-Q2 share Rajah 1,
    // Q4 has parts (a)(b)(c)(i)(ii), Bahagian C offers two questions of equal marks.
    sections: [
      {
        id: 'mat-k2-2025-a-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        markBudget: 9,
        questionCount: 3,
        questionIds: ['mat2-segitiga-v1-q1', 'mat2-segitiga-v1-q2', 'mat2-diskaun-v1'],
      },
      {
        id: 'mat-k2-2025-a-s2',
        label: 'Bahagian B',
        rule: { type: 'all' },
        markBudget: 6,
        questionCount: 1,
        questionIds: ['mat2-garis-v1'],
      },
      {
        id: 'mat-k2-2025-a-s3',
        label: 'Bahagian C',
        instruction: 'Jawab 1 soalan sahaja.',
        rule: { type: 'choose', n: 1 },
        markBudget: 6,
        questionCount: 2,
        questionIds: ['mat2-statistik-v1', 'mat2-kuadratik-v1'],
      },
    ],
  },
  {
    id: 'sn-k2-2025-a',
    title: 'Percubaan SPM Sains Kertas 2 (Contoh Pendek)',
    subject: 'SN',
    kertas: 2,
    year: 2025,
    code: '4541/2',
    durationMin: 60,
    instructions: snInstructions,
    sections: [
      {
        id: 'sn-k2-2025-a-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        markBudget: 9,
        questionCount: 3,
        questionIds: sn.setA,
      },
      {
        id: 'sn-k2-2025-a-s2',
        label: 'Bahagian B',
        instruction: 'Jawab 1 soalan sahaja.',
        rule: { type: 'choose', n: 1 },
        markBudget: 4,
        questionCount: 2,
        questionIds: sn.setB,
      },
    ],
  },
  {
    id: 'sej-k2-2025-a',
    title: 'Percubaan SPM Sejarah Kertas 2 (Contoh Pendek)',
    subject: 'SEJ',
    kertas: 2,
    year: 2025,
    code: '1249/2',
    durationMin: 90,
    instructions: [
      'Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.',
      'Jawab semua soalan dalam Bahagian A dan satu soalan dalam Bahagian B.',
      'Esei dinilai oleh guru mengikut band; markah tidak diberi secara automatik.',
    ],
    sections: [
      {
        id: 'sej-k2-2025-a-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        markBudget: 9,
        questionCount: 2,
        questionIds: sej.setA,
      },
      {
        id: 'sej-k2-2025-a-s2',
        label: 'Bahagian B',
        instruction: 'Jawab 1 soalan sahaja.',
        rule: { type: 'choose', n: 1 },
        markBudget: 10,
        questionCount: 2,
        questionIds: sej.setB,
      },
    ],
  },
]

/**
 * Kertas Subjektif papers of the mock (S3-T06): the pupil lane `/kertas-subjektif`. Two published, one draft
 * (AC-MUR-13-20: the draft is never listed and its id answers 404). Built from the questions above, which all have a
 * scheme; fictitious titles. Untimed (`durationMin` 0, no Tempoh).
 */
export interface SubjektifPaperDef extends PaperDef {
  /** Slug of OPT-NEGERI-KERTAS. */
  examBoard: string
  published: boolean
}

export const SUBJEKTIF_PAPERS: SubjektifPaperDef[] = [
  {
    id: 'subj-sej-k2-selangor',
    title: 'Percubaan Negeri Selangor Sejarah Kertas 2 (Contoh)',
    subject: 'SEJ',
    kertas: 2,
    year: 2025,
    code: '1249/2',
    durationMin: 0,
    examBoard: 'selangor',
    published: true,
    instructions: ['Baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri.'],
    sections: [
      {
        id: 'subj-sej-k2-selangor-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        markBudget: 9,
        questionCount: 2,
        questionIds: sej.setA,
      },
      {
        id: 'subj-sej-k2-selangor-s2',
        label: 'Bahagian B',
        rule: { type: 'all' },
        markBudget: 10,
        questionCount: 1,
        questionIds: sej.setB.slice(0, 1),
      },
    ],
  },
  {
    id: 'subj-sn-k2-johor',
    title: 'Percubaan Negeri Johor Sains Kertas 2 (Contoh)',
    subject: 'SN',
    kertas: 2,
    year: 2025,
    code: '4541/2',
    durationMin: 0,
    examBoard: 'johor',
    published: true,
    instructions: ['Baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri.'],
    sections: [
      {
        id: 'subj-sn-k2-johor-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        markBudget: 9,
        questionCount: 3,
        questionIds: sn.setA,
      },
    ],
  },
  {
    id: 'subj-mat-k2-kedah-draf',
    title: 'Percubaan Negeri Kedah Matematik Kertas 2 (Draf)',
    subject: 'MAT',
    kertas: 2,
    year: 2025,
    code: '1449/2',
    durationMin: 0,
    examBoard: 'kedah',
    published: false,
    instructions: ['Baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri.'],
    sections: [
      {
        id: 'subj-mat-k2-kedah-draf-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        markBudget: 9,
        questionCount: 1,
        questionIds: ['mat2-diskaun-v1'],
      },
    ],
  },
]

/**
 * S3-T01 (D76): the one registry both mocks read. A head whose `source` is Disahkan serves pupils (`servesStudents`): the Kontrak admin
 * mock seeds it with a verification record, and the pupil mock (`GET /bijak/contracts`) lists exactly these rows. MAT/1 and SN/1 are the
 * pairs the Jana Kertas flow runs on; every other head is Spec.
 */
export const BLUEPRINTS: Blueprint[] = [
  {
    subject: 'MAT',
    kertas: 1,
    source: 'Disahkan',
    code: '1449/1',
    durationMin: 75,
    instructions: matK1Instructions,
    reference: MAT_REFERENCE,
    sections: [
      { label: 'Objektif', rule: { type: 'all' }, pool: 'MAT1-A', take: 10, markBudget: 10 },
    ],
  },
  {
    subject: 'MAT',
    kertas: 2,
    source: 'Spec',
    code: '1449/2',
    durationMin: 150,
    instructions: matK2Instructions,
    reference: MAT_REFERENCE,
    sections: [
      { label: 'Bahagian A', rule: { type: 'all' }, pool: 'MAT2-A', take: 3, markBudget: 9 },
      { label: 'Bahagian B', rule: { type: 'all' }, pool: 'MAT2-B', take: 1, markBudget: 6 },
      {
        label: 'Bahagian C',
        instruction: 'Jawab 1 soalan sahaja.',
        rule: { type: 'choose', n: 1 },
        pool: 'MAT2-C',
        take: 2,
        markBudget: 6,
      },
    ],
  },
  {
    subject: 'SN',
    kertas: 2,
    source: 'Spec',
    code: '4541/2',
    durationMin: 60,
    instructions: snInstructions,
    sections: [
      { label: 'Bahagian A', rule: { type: 'all' }, pool: 'SN2-A', take: 3, markBudget: 9 },
      {
        label: 'Bahagian B',
        instruction: 'Jawab 1 soalan sahaja.',
        rule: { type: 'choose', n: 1 },
        pool: 'SN2-B',
        take: 2,
        markBudget: 4,
      },
    ],
  },
  {
    // A contract with an empty pool: Jana Kertas rejects it with a shortage list.
    subject: 'SN',
    kertas: 1,
    source: 'Disahkan',
    code: '4541/1',
    durationMin: 60,
    instructions: ['Kertas ini mengandungi 40 soalan objektif.'],
    sections: [
      { label: 'Bahagian A', rule: { type: 'all' }, pool: 'SN1-A', take: 40, markBudget: 40 },
    ],
  },
]

export const BANK = bank
