/**
 * Seed registry: subjects, curated papers (Kertas Pilihan), blueprints (Kontrak Blueprint) and the
 * question pool behind Jana Kertas. Built once at module load; fictitious practice content.
 */
import type { Blueprint, PaperDef, Subject, SubjectCode } from '../domain/types'
import { dskpSource } from '../lib/dskp-source'
import { Bank } from './builders'
import { seedMatK1 } from './mat-k1'
import { seedMatK2 } from './mat-k2'
import { seedSainsK2 } from './sains-k2'
import { applySeedTags } from './seed-tags'
import { seedSejarahK2 } from './sejarah-k2'

export const SUBJECTS: Subject[] = [
  { code: 'MAT', name: 'Matematik' },
  { code: 'SN', name: 'Sains' },
  { code: 'SEJ', name: 'Sejarah' },
]

/** Name of a subject: the three blueprint subjects first, then the DSKP catalogue's name, else the code. */
export const subjectName = (code: SubjectCode): string =>
  SUBJECTS.find((s) => s.code === code)?.name ?? dskpSource().subject(code)?.name ?? code

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
// Every seed question gets its DSKP tag from the one authored table (seed-tags.ts).
applySeedTags(bank.questions.values())

const matK1Instructions = [
  // The count comes from the paper itself (this is a 10-question sample of the 40-question paper).
  `Kertas ini mengandungi ${k1.setA.length} soalan objektif.`,
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
        instruction: 'Jawab 1 daripada 2 soalan.',
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
        instruction: 'Jawab 1 daripada 2 soalan.',
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
        instruction: 'Jawab 1 daripada 2 soalan.',
        rule: { type: 'choose', n: 1 },
        markBudget: 10,
        questionCount: 2,
        questionIds: sej.setB,
      },
    ],
  },
]

export const BLUEPRINTS: Blueprint[] = [
  {
    subject: 'MAT',
    kertas: 1,
    source: 'Spec',
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
        instruction: 'Jawab 1 daripada 2 soalan.',
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
        instruction: 'Jawab 1 daripada 2 soalan.',
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
    source: 'Spec',
    code: '4541/1',
    durationMin: 60,
    instructions: ['Kertas ini mengandungi 40 soalan objektif.'],
    sections: [
      { label: 'Bahagian A', rule: { type: 'all' }, pool: 'SN1-A', take: 40, markBudget: 40 },
    ],
  },
]

export const BANK = bank
