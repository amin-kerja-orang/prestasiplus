/**
 * Seed of Soalan & Rujukan (S6-T16): the demo teacher's private MCQ. The PRD has no observed rows (the list page was not
 * captured), so these are designed, generic study questions. Deterministic rule for the 409 path: the question at index
 * `i` is "drawn into an active Misi" exactly when `i % 3 === 0` (indices 0 and 3), so deleting it is refused with
 * "Soalan sedang digunakan dalam misi." and the others delete normally. Every row carries a valid Bab, SP, TP 3 and Aras so that editing an untouched row passes the form's own D112 rule. Ids 7801…; newest first by `createdAt`.
 */

import { toIsoMyt } from '@/lib/time'

import type { PersonalQuestionRow } from '../repository/types'

/** The demo teacher (profile 4 / user 5, the owner of the designed missions). */
const OWNER = 5
/** M03 ids: Matematik, Kimia; Tingkatan 4 and 5. */
const MATEMATIK = 3
const KIMIA = 10
const TINGKATAN_4 = 10
const TINGKATAN_5 = 11

interface Template {
  subjectId: number
  educationLevelId: number
  difficulty: number
  text: string
  options: [string, string, string, string]
  correctIndex: number
  referenceUrl: string | null
  /** Bab and SP of the pair (M03 / M10 DSKP mock): every seeded pair has chapters and DSKP nodes (D112). */
  chapterId: number
  spId: number
}

const TEMPLATES: readonly Template[] = [
  {
    subjectId: MATEMATIK,
    educationLevelId: TINGKATAN_4,
    difficulty: 3,
    text: 'Apakah nilai bagi 2x + 3 apabila x = 4?',
    options: ['8', '9', '10', '11'],
    correctIndex: 3,
    referenceUrl: 'https://example.org/rujukan/ungkapan-algebra',
    chapterId: 91,
    spId: 8070,
  },
  {
    subjectId: MATEMATIK,
    educationLevelId: TINGKATAN_4,
    difficulty: 2,
    text: 'Ungkapkan 0.00045 dalam bentuk piawai.',
    options: ['4.5 x 10^-3', '4.5 x 10^-4', '4.5 x 10^-5', '45 x 10^-5'],
    correctIndex: 1,
    referenceUrl: null,
    chapterId: 91,
    spId: 8070,
  },
  {
    subjectId: KIMIA,
    educationLevelId: TINGKATAN_5,
    difficulty: 4,
    text: 'Apakah hasil yang terbentuk di anod semasa elektrolisis larutan natrium klorida pekat?',
    options: ['Hidrogen', 'Klorin', 'Oksigen', 'Natrium'],
    correctIndex: 1,
    referenceUrl: 'https://example.org/video/elektrolisis',
    chapterId: 571,
    spId: 9001,
  },
  {
    subjectId: KIMIA,
    educationLevelId: TINGKATAN_5,
    difficulty: 3,
    text: 'Yang manakah ialah contoh tindak balas eksotermik?',
    options: [
      'Pelarutan ammonium nitrat',
      'Pembakaran etanol',
      'Penguraian kalsium karbonat',
      'Fotosintesis',
    ],
    correctIndex: 1,
    referenceUrl: null,
    chapterId: 571,
    spId: 9001,
  },
  {
    subjectId: MATEMATIK,
    educationLevelId: TINGKATAN_5,
    difficulty: 5,
    text: 'Selesaikan persamaan kuadratik x^2 - 5x + 6 = 0.',
    options: ['x = 1 atau x = 6', 'x = 2 atau x = 3', 'x = -2 atau x = -3', 'x = 5 atau x = 1'],
    correctIndex: 1,
    referenceUrl: 'https://example.org/rujukan/persamaan-kuadratik.pdf',
    chapterId: 228,
    spId: 8071,
  },
  {
    subjectId: KIMIA,
    educationLevelId: TINGKATAN_4,
    difficulty: 1,
    text: 'Apakah jenis zarah yang terdapat dalam nukleus atom?',
    options: [
      'Proton dan neutron',
      'Proton dan elektron',
      'Neutron dan elektron',
      'Elektron sahaja',
    ],
    correctIndex: 0,
    referenceUrl: null,
    chapterId: 562,
    spId: 8210,
  },
]

export const DESIGNED_PERSONAL_QUESTIONS: readonly PersonalQuestionRow[] = TEMPLATES.map(
  (t, i) => ({
    id: 7801 + i,
    ownerId: OWNER,
    subjectId: t.subjectId,
    educationLevelId: t.educationLevelId,
    difficulty: t.difficulty,
    text: t.text,
    chapterId: t.chapterId,
    spIds: [t.spId],
    tp: 3,
    cognitiveLevel: 'memahami',
    options: [...t.options],
    correctIndex: t.correctIndex,
    referenceUrl: t.referenceUrl,
    inActiveMission: i % 3 === 0,
    // Newest first: index 0 is the newest, one day apart (2026-09-24 down to 2026-09-19).
    createdAt: toIsoMyt(Date.UTC(2026, 8, 24 - i, 1, 0, 0)),
  }),
)
