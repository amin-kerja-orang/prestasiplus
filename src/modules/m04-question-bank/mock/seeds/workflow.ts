/**
 * Seeds of the M04-T2 stores (SRS v1.11 §6.11 "Question papers" and "Master notes"): the 6 question
 * papers of S10 and the 525 master notes of S12, inserted through their repositories (overview §3
 * rule 3a).
 *
 * Question papers: ids 1–4 are the four observed S10 rows (files, statuses; the S10 crawl lists ids
 * 4, 3, 2, 1 and their file names). Subject, level, paper type and teacher of each row, the dates
 * and the file sizes are PROPOSED (the SRS lists the four subjects and three paper types without
 * pairing them). Ids 5 (pending) and 6 (rejected) are added to cover every status. Teachers are the
 * fictitious M01 / M02 teacher accounts.
 *
 * Master notes: 525 (ids 1–525, live), 0 flagged, 0 teacher-approved (live). The three observed S12
 * samples (question ids 122411, 560001, 559916; notes ids 525, 524, 523 by the S12 order) keep their
 * observed subject, chapter, tokens and confidence; the words the crawl cut off are completed
 * (PROPOSED). Notes 522–520 are the three Bahasa Inggeris pool questions named in SRS §6.11 (their
 * texts are read from the question rows). Every other note is PROPOSED: the first existing question
 * id at or after a deterministic start inside 522425–539241 (question ids are sparse, so the notes
 * are seeded in `finalise`, once the question dataset is compiled), tokens 700–1,400, confidence 85
 * with a few 70 and 90.
 */

import { toIsoMyt } from '@/lib/time'
import { hashKey } from '@/mock/dataset'
import type { SeedContext } from '@/mock/define'

import { masterNotesRepo, type MasterNote } from '../repository/master-notes'
import { questionsRepo } from '../repository/questions'
import { submissionsRepo, type QuestionSubmission } from '../repository/submissions'

/** `masterNotes: { flagged?: number[], approved?: number[] }` (E2E-M04-52). */
export const MASTER_NOTES_OVERRIDE = 'masterNotes'

/** The D11 size of the note set (SRS §6.11). */
export const MASTER_NOTES_TOTAL = 525

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF = 'application/pdf'

/** The six papers of S10 (PROPOSED pairing, see the file comment). Teachers: M01 4501–4504 and 5. */
export const SEED_SUBMISSIONS: readonly QuestionSubmission[] = [
  {
    id: 1,
    teacherId: 4501,
    subjectText: 'Sains',
    levelCode: 'T5',
    year: 2026,
    paperType: 'Buku Latihan',
    authorCredit: 'Oleh: Cikgu Demo 4501',
    note: 'Latih tubi kelas 5 Alfa pada 13 Mac 2026',
    files: [{ index: 0, name: 'GEAR UP 1 TINGKATAN 5.pdf', size: 2_412_544, mime: PDF }],
    status: 'processing',
    adminNotes: null,
    createdAt: '2026-03-14T10:20:00+08:00',
  },
  {
    id: 2,
    teacherId: 4502,
    subjectText: 'EKONOMI',
    levelCode: 'T5',
    year: 2026,
    paperType: 'Buku Latihan',
    authorCredit: 'Oleh: Cikgu Demo 4502',
    note: null,
    files: [{ index: 0, name: 'OBJ TOPIKAL T5.pdf', size: 1_187_328, mime: PDF }],
    status: 'processing',
    adminNotes: null,
    createdAt: '2026-03-18T15:05:00+08:00',
  },
  {
    id: 3,
    teacherId: 4503,
    subjectText: 'SEJARAH SPM',
    levelCode: 'T5',
    year: 2026,
    paperType: 'Lain-lain',
    authorCredit: 'Oleh: Cikgu Demo 4503',
    note: null,
    files: [
      {
        index: 0,
        name: 'HIMPUNAN_SOALAN_SEJARAH_K1_IKUT_BAB_PERUBAAN_SPM_NEGERI_2024_TINGKATAN copy.pdf',
        size: 3_604_480,
        mime: PDF,
      },
    ],
    status: 'processing',
    adminNotes: null,
    createdAt: '2026-03-27T09:42:00+08:00',
  },
  {
    id: 4,
    teacherId: 4504,
    subjectText: 'Perniagaan',
    levelCode: 'T4',
    year: 2026,
    paperType: 'Soalan Peperiksaan',
    authorCredit: 'Oleh: Cikgu Demo 4504',
    note: null,
    files: [{ index: 0, name: 'PPSA K1 T4 2026.docx', size: 148_992, mime: DOCX }],
    status: 'done',
    adminNotes: null,
    createdAt: '2026-04-06T11:30:00+08:00',
  },
  {
    id: 5,
    teacherId: 5,
    subjectText: 'Matematik',
    levelCode: 'T4',
    year: 2026,
    paperType: 'Trial Paper',
    authorCredit: 'Oleh: Guru Demo',
    note: 'Kertas 1 dan skema pemarkahan.',
    files: [
      { index: 0, name: 'MATEMATIK K1 TRIAL T4 2026.pdf', size: 1_843_200, mime: PDF },
      { index: 1, name: 'SKEMA MATEMATIK K1 T4 2026.pdf', size: 612_352, mime: PDF },
    ],
    status: 'pending',
    adminNotes: null,
    createdAt: '2026-05-12T14:10:00+08:00',
  },
  {
    id: 6,
    teacherId: 4501,
    subjectText: 'Fizik',
    levelCode: 'T5',
    year: 2025,
    paperType: 'Soalan DSKP',
    authorCredit: 'Oleh: Cikgu Demo 4501',
    note: null,
    files: [
      { index: 0, name: 'FIZIK K2 T5 2025.pdf', size: 2_097_152, mime: PDF },
      { index: 1, name: 'FIZIK K2 T5 2025 LAMPIRAN.docx', size: 96_256, mime: DOCX },
    ],
    status: 'rejected',
    adminNotes: 'Fail tidak boleh dibuka. Sila muat naik semula.',
    createdAt: '2026-06-03T16:45:00+08:00',
  },
]

const MODEL = 'gpt-4o-mini'
const FIRST_NOTE_AT = Date.parse('2026-06-01T09:00:00+08:00')
/** The user-1 id range (SRS §6.13.1): the filler notes probe from a deterministic start inside it. */
const USER1_FIRST = 522_425
const USER1_ROWS = 16_817

interface ObservedNote {
  questionId: number
  subjectName: string | null
  chapter: string | null
  tokens: number
  questionText: string | null
  noteText: string | null
  trapText: string | null
}

/** Notes 525…520, the six observed question ids (S12 order, INFERRED). */
const OBSERVED_NOTES: readonly ObservedNote[] = [
  {
    questionId: 122411,
    subjectName: 'Fizik',
    chapter: 'Fizik Tingkatan 5',
    tokens: 730,
    questionText: 'Apakah yang berlaku dalam litar apabila berlaku litar pintas (short circuit)?',
    noteText:
      'Mungkin anda keliru sebab anda fikir litar berfungsi seperti biasa tetapi sebenarnya litar pintas menyebabkan arus yang sangat besar mengalir.',
    trapText: 'Salah faham tentang arus dalam litar pintas.',
  },
  {
    questionId: 560001,
    subjectName: 'Matematik',
    chapter: 'Fungsi dan Persamaan Kuadratik',
    tokens: 812,
    questionText:
      'Fungsi kuadratik f(x) = x² - 6x + 5 diubah kepada f(x) = x² - 6x + 9. Apakah perubahan yang berlaku pada graf fungsi itu?',
    noteText:
      'Mungkin anda keliru sebab perubahan dalam fungsi kuadratik hanya melibatkan perpindahan sepanjang paksi mencancang.',
    trapText: 'Salah faham tentang perpindahan graf kuadratik yang melibatkan nilai pemalar.',
  },
  {
    questionId: 559916,
    subjectName: 'Matematik',
    chapter: 'Kebarangkalian Peristiwa Bergabung',
    tokens: 790,
    questionText:
      'Adakah peristiwa berikut saling eksklusif atau tidak saling eksklusif: memilih murid yang memakai cermin mata dan murid yang memakai kasut sukan?',
    noteText:
      'Mungkin anda keliru sebab anda berfikir bahawa peristiwa saling eksklusif bermakna tidak boleh berlaku serentak pada murid yang berbeza.',
    trapText: 'Salah faham tentang definisi peristiwa saling eksklusif.',
  },
  {
    questionId: 129732,
    subjectName: null,
    chapter: null,
    tokens: 0,
    questionText: null,
    noteText: null,
    trapText: null,
  },
  {
    questionId: 129650,
    subjectName: null,
    chapter: null,
    tokens: 0,
    questionText: null,
    noteText: null,
    trapText: null,
  },
  {
    questionId: 129614,
    subjectName: null,
    chapter: null,
    tokens: 0,
    questionText: null,
    noteText: null,
    trapText: null,
  },
]

const GENERIC_NOTE =
  'Mungkin anda keliru sebab anda menganggap konsep dalam soalan ini sama dengan konsep yang berkaitan. Semak semula takrifan asas sebelum memilih jawapan.'
const GENERIC_TRAP = 'Salah faham tentang konsep asas yang diuji dalam soalan ini.'

/** The first existing question id from `start` upwards (ids are sparse; a few probes at most). */
function existingFrom(start: number, exists: (id: number) => boolean): number {
  for (let id = start; id < start + 200; id++) if (exists(id)) return id
  return start
}

/** The 525 default notes (recomputed per seed); `exists` tells which question ids are in the store. */
export function defaultMasterNotes(exists: (questionId: number) => boolean): MasterNote[] {
  const rows: MasterNote[] = []
  for (let id = 1; id <= MASTER_NOTES_TOTAL; id++) {
    const observed = OBSERVED_NOTES[MASTER_NOTES_TOTAL - id]
    const hashed = 700 + (hashKey(id, 61) % 701)
    rows.push({
      id,
      questionId:
        observed?.questionId ?? existingFrom(USER1_FIRST + ((id * 32 + 7) % USER1_ROWS), exists),
      subjectName: observed?.subjectName ?? null,
      questionText: observed?.questionText ?? null,
      chapter: observed?.chapter ?? null,
      model: MODEL,
      tokens: observed && observed.tokens > 0 ? observed.tokens : hashed,
      confidence: observed ? 85 : id % 25 === 0 ? 70 : id % 17 === 0 ? 90 : 85,
      noteText: observed?.noteText ?? GENERIC_NOTE,
      trapText: observed?.trapText ?? GENERIC_TRAP,
      flagged: false,
      teacherApproved: false,
      regenCount: 0,
      createdAt: toIsoMyt(FIRST_NOTE_AT + id * 3_600_000),
    })
  }
  return rows
}

/** Seed phase: the question papers. */
export function seedWorkflow(): void {
  submissionsRepo.seedRows(SEED_SUBMISSIONS)
}

/** Finalise phase (the question dataset is compiled): the master notes and their override. */
export function finaliseWorkflow(ctx: SeedContext): void {
  masterNotesRepo.seedRows(defaultMasterNotes((id) => questionsRepo.exists(id)))
  masterNotesRepo.applySeedOverride(ctx.overrides[MASTER_NOTES_OVERRIDE])
}
