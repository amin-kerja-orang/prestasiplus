/**
 * Seed registry: subjects, curated papers (Kertas Pilihan), blueprints (Kontrak Blueprint) and the
 * question pool behind Jana Kertas. Built once at module load; fictitious practice content.
 */
import type { Blueprint, PaperDef, Subject, SubjectCode } from '../domain/types'
import { Bank } from './builders'
import { seedMatK1 } from './mat-k1'
import { seedMatK2 } from './mat-k2'
import { seedSainsK2 } from './sains-k2'

export const SUBJECTS: Subject[] = [
  { code: 'MAT', name: 'Matematik' },
  { code: 'SN', name: 'Sains' },
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

const matK1Instructions = [
  'Kertas ini mengandungi 40 soalan objektif.',
  'Jawab semua soalan. Pilih satu jawapan sahaja bagi setiap soalan.',
  'Rajah tidak dilukis mengikut skala kecuali dinyatakan.',
]
const matK2Instructions = [
  'Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.',
  'Jawab semua soalan dalam Bahagian A dan dua soalan dalam Bahagian B.',
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
    sections: [
      { id: 'mat-k1-2025-a-s1', label: 'Bahagian A', rule: { type: 'all' }, questionIds: k1.setA },
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
    // Proof of concept: 3 structured questions; Q1-Q2 share Rajah 1, Q3 has parts (a)(b)(c)(i)(ii).
    sections: [
      {
        id: 'mat-k2-2025-a-s1',
        label: 'Bahagian A',
        rule: { type: 'all' },
        questionIds: ['mat2-segitiga-v1-q1', 'mat2-segitiga-v1-q2', 'mat2-garis-v1'],
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
      { id: 'sn-k2-2025-a-s1', label: 'Bahagian A', rule: { type: 'all' }, questionIds: sn.setA },
      {
        id: 'sn-k2-2025-a-s2',
        label: 'Bahagian B',
        instruction: 'Jawab 1 daripada 2 soalan.',
        rule: { type: 'choose', n: 1 },
        questionIds: sn.setB,
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
    sections: [{ label: 'Bahagian A', rule: { type: 'all' }, pool: 'MAT1-A', take: 10 }],
  },
  {
    subject: 'MAT',
    kertas: 2,
    source: 'Spec',
    code: '1449/2',
    durationMin: 150,
    instructions: matK2Instructions,
    reference: MAT_REFERENCE,
    sections: [{ label: 'Bahagian A', rule: { type: 'all' }, pool: 'MAT2-A', take: 3 }],
  },
  {
    subject: 'SN',
    kertas: 2,
    source: 'Spec',
    code: '4541/2',
    durationMin: 60,
    instructions: snInstructions,
    sections: [
      { label: 'Bahagian A', rule: { type: 'all' }, pool: 'SN2-A', take: 3 },
      {
        label: 'Bahagian B',
        instruction: 'Jawab 1 daripada 2 soalan.',
        rule: { type: 'choose', n: 1 },
        pool: 'SN2-B',
        take: 2,
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
    sections: [{ label: 'Bahagian A', rule: { type: 'all' }, pool: 'SN1-A', take: 40 }],
  },
]

export const BANK = bank
