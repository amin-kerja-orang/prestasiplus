/**
 * M04's own question anchors (SRS §6.11 "Observed anchors", "Coverage anchors", "State profile";
 * cells per §6.13.1 "Anchors (seed phase) and their cells"). Each anchor replaces one generated row
 * of its cell, so no total changes. Texts and values are the observed ones where the SRS gives them;
 * the remaining attributes follow the anchor's cell. No personal name appears.
 *
 * The facet tuple of each anchor is complete: the spec builder reserves exactly one row of that
 * tuple for it (`datasets/questions-spec.ts`).
 */

import type { Question, QuestionFacets } from '../repository/types'
import { genericSpId } from './tables'

/**
 * The creator of generated rows other than users 1 and 5 and the M02 contributor anchors
 * 4501–4504: M02 fixture admin 5801 (PROPOSED placeholder; it also carries the 7,565
 * Q-TEACHER-CONTRIB rows of teachers without a published id).
 */
export const OTHER_CREATOR = 5801

/** An approved, active, MCQ, verified, textbook, tagged objective tuple; `p` overrides it. */
export function objectiveFacets(
  subjectId: number,
  levelId: number | null,
  p: Partial<QuestionFacets> = {},
): QuestionFacets {
  const tagged = p.dskpTagged ?? true
  return {
    subjectId,
    educationLevelId: levelId,
    pkskDomainId: null,
    pkskTargetLevel: null,
    status: 'approved',
    isActive: true,
    questionType: 'mcq',
    spmPool: false,
    difficultyLevel: 2,
    complianceStatus: 'verified',
    aiVerified: false,
    sourceType: 'textbook',
    hasSourceFile: true,
    dskpTagged: tagged,
    dskpSpId: tagged && levelId !== null ? genericSpId(subjectId, levelId) : null,
    needsDiagram: false,
    qualityBucket: 'unscored',
    legacyGeneric: false,
    curriculumChapterId: null,
    createdBy: OTHER_CREATOR,
    teacherDatabank: false,
    coverageExcluded: false,
    contribSchoolId: null,
    ...p,
  }
}

export interface AnchorDef {
  id: number
  facets: QuestionFacets
  /** Literal field values (observed copy, pinned scores, dates). */
  overrides: Partial<Question>
  /** Pinned quality score (`null` = not scored). */
  qualityScore: number | null
}

const pool = (s: number, l: number, d: number, p: Partial<QuestionFacets> = {}) =>
  objectiveFacets(s, l, { spmPool: true, difficultyLevel: d, ...p })

const SATELIT_OPTIONS = [
  'Objek buatan manusia yang mengorbit Bumi',
  'Objek semula jadi yang mengorbit Matahari',
  'Bintang yang memancarkan cahaya sendiri',
  'Batuan angkasa yang jatuh ke Bumi',
]

/** Observed and coverage anchors (default seed). */
export const M04_ANCHORS: readonly AnchorDef[] = [
  {
    id: 564159,
    facets: pool(4, 11, 3, { aiVerified: true, qualityBucket: 'cemerlang' }),
    qualityScore: 96,
    overrides: {
      questionText:
        'Topup Sains T5 Bab 9 item 1: Apakah maksud satelit buatan? Pilih jawapan yang paling tepat.',
      options: SATELIT_OPTIONS,
      correctAnswer: 0,
      explanation:
        'Satelit buatan ialah objek buatan manusia yang dilancarkan untuk mengorbit Bumi bagi tujuan komunikasi, cuaca dan navigasi.',
      sourceFile: 'DSKP KSSM Science Form 4 and 5.pdf',
      sourceSet: 'textbook',
      createdAt: '2026-05-18T23:21:00+08:00',
      usage: { attempts: 0, correct: 0 },
    },
  },
  {
    id: 564160,
    facets: pool(4, 11, 4, { aiVerified: true }),
    qualityScore: null,
    overrides: { createdAt: '2026-05-18T23:21:00+08:00' },
  },
  {
    id: 564161,
    facets: pool(4, 11, 3, { aiVerified: true }),
    qualityScore: null,
    overrides: { createdAt: '2026-05-18T23:21:00+08:00' },
  },
  {
    id: 564157,
    facets: pool(4, 11, 2, { aiVerified: true }),
    qualityScore: null,
    overrides: { createdAt: '2026-05-18T23:20:00+08:00' },
  },
  {
    id: 564158,
    facets: pool(4, 11, 2, { aiVerified: true }),
    qualityScore: null,
    overrides: { createdAt: '2026-05-18T23:20:00+08:00' },
  },
  {
    id: 129114,
    facets: objectiveFacets(3, 11, {
      status: 'archived',
      isActive: false,
      difficultyLevel: 1,
      complianceStatus: 'quarantined',
      sourceType: null,
      hasSourceFile: false,
      dskpTagged: false,
      qualityBucket: 'le50',
    }),
    qualityScore: 50,
    overrides: {
      questionText: '34^-1/2 =',
      options: ['1/34^2', '-1/34^2', '1/34^(1/2)', '-1/34^(1/2)'],
      explanation: null,
      sourceSet: 'trial_matematik_johor_set2_k1',
      createdAt: '2026-03-20T17:08:00+08:00',
    },
  },
  {
    id: 129216,
    facets: objectiveFacets(3, 11, {
      status: 'archived',
      isActive: false,
      difficultyLevel: 1,
      complianceStatus: 'quarantined',
      sourceType: null,
      hasSourceFile: false,
      dskpTagged: false,
      qualityBucket: 'le50',
    }),
    qualityScore: 50,
    overrides: {
      questionText: '(-21)(1 3) =',
      explanation: null,
      sourceSet: 'trial_matematik_johor_set2_k1',
      createdAt: '2026-03-20T17:08:00+08:00',
    },
  },
  {
    id: 136891,
    facets: objectiveFacets(3, 11, {
      status: 'approved',
      isActive: false,
      difficultyLevel: 2,
      sourceType: 'trial',
      dskpTagged: false,
    }),
    qualityScore: null,
    overrides: {
      questionText: 'Rajah 16 menunjukkan dua segi tiga yang serupa. Hitung nilai x.',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1,
      sourceSet: 'trial',
    },
  },
  {
    id: 124733,
    facets: objectiveFacets(5, 11, {
      status: 'archived',
      isActive: false,
      difficultyLevel: 2,
      sourceType: 'ai_generated',
      legacyGeneric: true,
      dskpTagged: false,
      qualityBucket: 'cemerlang',
    }),
    qualityScore: 80,
    overrides: { correctAnswer: 2, sourceSet: 'ai_generated' },
  },
  {
    id: 563393,
    facets: pool(11, 11, 2, { needsDiagram: true, dskpTagged: false }),
    qualityScore: null,
    overrides: {
      questionText: 'Rajah menunjukkan struktur sel haiwan. Namakan organel yang berlabel P.',
      sourceFile: 'T5-BT-BIO---BIOLOGI.pdf',
      sourcePage: 1,
    },
  },
  {
    id: 562177,
    facets: pool(7, 11, 2, { needsDiagram: true, dskpTagged: false }),
    qualityScore: null,
    overrides: {
      questionText:
        'Rajah menunjukkan satu situasi di taman permainan. Apakah nilai yang ditunjukkan?',
      sourceFile: 'T5-BT-PM---PENDIDIKAN MORAL.pdf',
      sourcePage: 12,
    },
  },
  {
    id: 561050,
    facets: pool(4, 11, 3, { needsDiagram: true, dskpTagged: false }),
    qualityScore: null,
    overrides: {
      questionText: 'Rajah menunjukkan orbit sebuah satelit. Apakah jenis orbit tersebut?',
      sourceFile: 'T5-BT-SAINS---SAINS.pdf',
      sourcePage: 147,
    },
  },
  { id: 129732, facets: pool(2, 11, 2), qualityScore: null, overrides: {} },
  { id: 129650, facets: pool(2, 11, 2), qualityScore: null, overrides: {} },
  { id: 129614, facets: pool(2, 11, 2), qualityScore: null, overrides: {} },
  // M08 S11 class-228 item-analysis rows (M08 discovery S11, BUG-07): three Bahasa Inggeris pool rows
  // with the observed question texts, in the observed row order (ids ascend; tie-break id ascending).
  // They are separate from 129732 / 129650 / 129614, which M04 S12 observed as reading-passage
  // questions. The observed label is "Bahasa Inggeris — English Form 4"; discovery shows no options,
  // so the four options and the key below are INFERRED (plain English, the grammatical answer is
  // the key). Subject and level follow the pool cell they replace; no DSKP tag fields are set.
  {
    id: 129601,
    facets: pool(2, 11, 2),
    qualityScore: null,
    overrides: {
      questionText: 'Which of the following is a fact?',
      options: [
        'The sun rises in the east.',
        'Durian is the most delicious fruit.',
        'Blue is the prettiest colour.',
        'Studying at night is better than studying in the morning.',
      ],
      correctAnswer: 0,
      chapterLabel: 'English Form 4',
    },
  },
  {
    id: 129602,
    facets: pool(2, 11, 2),
    qualityScore: null,
    overrides: {
      questionText:
        '"By the time we arrived, the movie _____ already started." Choose the correct form:',
      options: ['has', 'had', 'have', 'was'],
      correctAnswer: 1,
      chapterLabel: 'English Form 4',
    },
  },
  {
    id: 129603,
    facets: pool(2, 11, 2),
    qualityScore: null,
    overrides: {
      questionText:
        '"If it rains tomorrow, we _____ cancel the picnic." Choose the correct answer:',
      options: ['will', 'would', 'did', 'were'],
      correctAnswer: 0,
      chapterLabel: 'English Form 4',
    },
  },
  { id: 122411, facets: pool(9, 11, 2), qualityScore: null, overrides: {} },
  {
    id: 560001,
    facets: pool(3, 10, 2),
    qualityScore: null,
    overrides: { questionText: 'Selesaikan persamaan kuadratik x² − 5x + 6 = 0.' },
  },
  {
    id: 559916,
    facets: pool(3, 10, 2),
    qualityScore: null,
    overrides: {
      questionText:
        'Sebuah kotak mengandungi 3 bola merah dan 2 bola biru. Cari kebarangkalian peristiwa bergabung.',
    },
  },
  // Coverage anchors (prototype ids 570004–570025).
  {
    id: 570004,
    facets: objectiveFacets(11, 10, {
      complianceStatus: 'pending_mapping',
      sourceType: 'marking_scheme',
    }),
    qualityScore: null,
    overrides: { sourceFile: 'KIMIA K1 SBP-2024.pdf', sourceSet: 'marking_scheme' },
  },
  {
    id: 570005,
    facets: objectiveFacets(5, 6, {
      complianceStatus: 'draft',
      sourceType: null,
      hasSourceFile: false,
    }),
    qualityScore: null,
    overrides: {},
  },
  {
    id: 570006,
    facets: objectiveFacets(4, 7, { hasSourceFile: false }),
    qualityScore: null,
    overrides: {},
  },
  {
    id: 570020,
    facets: objectiveFacets(18, 9, { needsDiagram: true }),
    qualityScore: null,
    overrides: {
      questionText: 'انظر إلى الصورة ثم اختر الجواب الصحيح: أين الكتاب؟',
      options: ['على المكتب', 'تحت الكرسي', 'في الحقيبة', 'أمام الباب'],
      correctAnswer: 0,
      sourceFile: 'Bahasa Arab Tingkatan 3.pdf',
      sourcePage: 2,
    },
  },
  {
    id: 570021,
    facets: pool(7, 11, 2),
    qualityScore: null,
    overrides: { usage: { attempts: 42, correct: 30 } },
  },
  {
    id: 570022,
    facets: pool(9, 11, 3, { needsDiagram: true }),
    qualityScore: null,
    overrides: {
      questionImage: '/fixtures/m04/570022-question.png',
      optionImages: [
        '/fixtures/m04/570022-a.png',
        '/fixtures/m04/570022-b.png',
        '/fixtures/m04/570022-c.png',
        '/fixtures/m04/570022-d.png',
      ],
      sourceFile: 'SET 1-FIZIK K1 PAHANG(JUJ)-2025.pdf',
      sourcePage: 29,
    },
  },
  {
    id: 570023,
    facets: pool(10, 10, 2),
    qualityScore: null,
    overrides: {
      aiExplanation: {
        markdown:
          '## Penjelasan\n\nJawapan betul ialah **A**.\n\n- Kenal pasti konsep utama.\n- Bandingkan setiap pilihan.\n\n| Pilihan | Status |\n|---|---|\n| A | Betul |\n| B | Salah |',
        generatedAt: '2026-05-10T10:00:00+08:00',
      },
    },
  },
  {
    id: 570024,
    facets: pool(3, 10, 3, {
      sourceType: 'ai_generated',
      legacyGeneric: true,
      qualityBucket: 'baik',
    }),
    qualityScore: 55,
    overrides: { sourceSet: 'tracking_a_feed_20260308' },
  },
  {
    id: 570025,
    facets: objectiveFacets(20, 7),
    qualityScore: null,
    overrides: {},
  },
]

/** Coverage anchors carry a fixed older date so they never lead the newest-first list (PROPOSED). */
export const COVERAGE_CREATED_AT = '2026-01-15T09:00:00+08:00'

/**
 * State profile (`questionStore: { profile: 'states' }`, test-only): one extra cell of count 1 per
 * anchor (live has none of these states), so the default dataset keeps the live zero counts.
 */
export const STATE_PROFILE_ANCHORS: readonly AnchorDef[] = [
  {
    id: 570001,
    facets: objectiveFacets(1, 3, {
      status: 'draft',
      complianceStatus: 'draft',
      sourceType: null,
      hasSourceFile: false,
    }),
    qualityScore: null,
    overrides: { sourceSet: null },
  },
  {
    id: 570002,
    facets: objectiveFacets(12, 8, { status: 'pending_review' }),
    qualityScore: null,
    overrides: {},
  },
  {
    id: 570003,
    facets: objectiveFacets(22, 10, { status: 'rejected' }),
    qualityScore: null,
    overrides: {},
  },
  {
    id: 570010,
    facets: objectiveFacets(4, 7, { questionType: 'true_false' }),
    qualityScore: null,
    overrides: { tfAnswer: true },
  },
  {
    id: 570011,
    facets: objectiveFacets(2, 9, { questionType: 'short_answer' }),
    qualityScore: null,
    overrides: { correctAnswerText: 'photosynthesis', altAnswers: ['photo synthesis'] },
  },
  {
    id: 570012,
    facets: objectiveFacets(3, 4, { questionType: 'fill_blank' }),
    qualityScore: null,
    overrides: { correctAnswerText: '12' },
  },
  {
    id: 570013,
    facets: objectiveFacets(5, 10, { questionType: 'essay' }),
    qualityScore: null,
    overrides: { modelAnswer: 'Huraikan tiga faktor dengan contoh yang sesuai.' },
  },
]
